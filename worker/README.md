# FlowRead analytics Worker

Receiver for the anonymous usage pings in `www/js/features/analytics-ping.js`
(Claude.md §9.6). Aggregate counters only — see the header comments in
`src/index.js` and `schema.sql` for the four rules it exists to enforce, the
first being that the client IP is never read, stored or logged.

**Live since 2026-11-17** at
`https://flowread-analytics.flowread-android.workers.dev` (account
`bdf1a1bc473345a64ce54a543fd2ef49`, D1 database `flowread-analytics`, region
APAC). `ENDPOINT` in `analytics-ping.js` points at `/e` there.

## Deploy

Already done once; these are the steps to repeat it on a new account or after a
rebuild. Wrangler is a devDependency of *this* folder only — the app's
`package.json` deliberately does not carry it.

```sh
cd worker
npx wrangler d1 create flowread-analytics          # copy the id into wrangler.toml
npx wrangler d1 execute flowread-analytics --remote --file=./schema.sql
npx wrangler secret put STATS_TOKEN                # any long random string
npx wrangler deploy
```

**A new account has no workers.dev subdomain and the first deploy fails without
one.** The dashboard link Wrangler prints 404s; registering it is a one-time
account-level action with no CLI command, so do it over the API with the token
Wrangler already holds:

```sh
TOK=$(grep -m1 '^oauth_token' ~/Library/Preferences/.wrangler/config/default.toml | sed 's/.*= *"\(.*\)"/\1/')
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/subdomain" \
  -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"subdomain":"flowread-android"}'
```

Then deploy again. TLS on a brand-new subdomain takes a minute or two to
provision; a `curl` failing with SSL error 35 in that window means wait, not
misconfigured.

Then set the endpoint in the app — this is the one-character change that takes
the whole system from inert to live:

```js
// www/js/features/analytics-ping.js
const ENDPOINT = 'https://flowread-analytics.<subdomain>.workers.dev/e';
```

**Must be `https`.** Play Console's Data safety declaration answers "encrypted
in transit: yes" on this module's behalf.

## Verifying it works

The client is deliberately silent — fire-and-forget, failures swallowed — so a
dead endpoint and a working one look identical from inside the app. `/stats` is
the only feedback. Send test pings as `"platform":"web"`, which real devices
never send, so they stay separable; `DELETE FROM daily WHERE platform='web'`
clears them afterwards.

Every request answers **204**, including one that is dropped: an unlisted
event, a date more than 36h from the server's own, malformed JSON. That is
deliberate, so the response cannot be used to probe what the allowlist holds.
The only way to confirm something was *stored* is to read `/stats` back.

## Going to a custom domain

Planned once the domain is bought. Add a route to `wrangler.toml`, redeploy,
and change the one constant in `analytics-ping.js`. Nothing migrates: D1 is
attached to the account, not the hostname, and the workers.dev address keeps
accepting pings from older installs indefinitely, so there is no cutover and no
gap. Worth doing — `workers.dev` appears on DNS-filter and ad-block lists, and
pings lost that way are indistinguishable from a feature nobody used.

## Before going live

- **Re-file Data safety as _Optional_**, not required. The first filing had to
  say required because no opt-out existed; `fr_analytics_opt_out` now does.
  Tasks.md flags this as owed before the rollout is promoted.
- Confirm the privacy policy's event list matches `ALLOWED` in both files.
  Three lists have to agree: the client, this Worker, and the published policy.

## Reading the numbers

```sh
curl "https://flowread-analytics.<subdomain>.workers.dev/stats?token=$TOKEN&days=30"
```

Returns named aggregates rather than arbitrary SQL — deliberately, an open
query endpoint on a privacy-positioned product is an own goal.

| Key | Answers |
|---|---|
| `totals` | every event, 30-day count |
| `by_day` | the same per day, for trend |
| `finishing` | `first_time_finishers` = how many people have ever finished a book; `books_finished` = total, split `read` vs `marked` |
| `sharing` | `first_time_sharers` = **how many people have ever shared a card**; `shares` = total shares, split by entry point |
| `funnel` | nudge shown → read started → completed / skipped; paywall shown → purchased; book downloaded → opened; onboarding completed → permission granted |
| `engines` | sessions, minutes and pages per reading engine — whether Page mode (16.13's default) is actually where people read |
| `tenure` | app opens bucketed by days since install: a retention curve built from counters, with no identifier stored |

### Why `first_time_sharers` is a count of people

Nothing here can distinguish two devices. The client instead marks a device's
*first ever* share with `first: true` (a one-shot local flag), so the number of
`is_first = 1` rows is the number of devices that have ever shared — a unique
count derived without a unique id. Two limits to know: it undercounts a
reinstall as a new sharer rather than the same one, and a user opted out at
their first share will count at their second instead. Both are acceptable for a
reach figure; neither can be fixed without storing an identifier.

The same trick is available to any event via `firstTag` — see
`analytics-ping.js`.
