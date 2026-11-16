# FlowRead — Phase 16 Task Board

> Working document. `Claude.md` is the contract; this file is how we execute it.
> Every task references its governing `Claude.md` section. If the two disagree, `Claude.md` wins — and `Claude.md` gets updated *before* we change direction, not after.

**Layout:** this file is the **live board** — what is open, what it is waiting on, and every
decision taken. Completed work and resolved device findings live in
**[Tasks-archive.md](Tasks-archive.md)**. The split rule: anything that would change a future
decision stays here or in `Claude.md`; a record of an action already taken goes to the archive.

**Last updated:** 2026-11-02 — **16.2's device checklist is done**: all sixteen items run and
passed on device against **1.5.3 / versionCode 41**, with R8 active for the first time. Item 9
(battery) showed no measurable idle drain. The nudge system now has no open engineering or
verification work — only promotion. Earlier the same day, **1.5.2 / versionCode 40** was built, carrying **16.1 (subscription
IAP)** and **16.3 (onboarding redesign)**. A subscription purchase completed on a clean
license-tester account; onboarding's O1 (a dead *Browse books* button, caused by awaiting a
notification promise that never settled) is fixed. Taglines across splash, home and onboarding
now read *"Read more. Scroll less."* — the launch screen was still selling the pre-pivot speed
reader. Usage access is now offered as an explicitly optional row on onboarding's permission
screen, because `triggers()` defaults to the threshold and without that grant §9.3a's timed
check cannot run at all, so a new user was landing in the degraded mode unasked.

**✅ 1.5.4 / versionCode 42 IS IN PRODUCTION (2026-11-02).** The pivot is released. Production had
been on 1.4.5 / 32 since September with builds 33–42 stuck in Internal testing; that backlog is
cleared in one promotion. Release notes in `release-notes-1.5.4.txt` (six locales, all within
Play's 500-char limit). **Still owed on the listing: 8 screenshots and the 1024×500 feature
graphic** — planned in `screenshots-and-books-plan.md`, and not a gate, which is why they did not
hold the release.

**Release order, decided 2026-11-02:** **promote the build and publish the listing text in the
same sitting; screenshots follow within the week.** Screenshots are conversion surface, not a
correctness gate — stale ones cost installs, they do not make the listing false — and they can
only honestly be captured from the build being shipped, so waiting inverts the order. The text,
however, **must not go live ahead of the build**: a listing describing the nudge while production
is 1.4.5 promises a feature the installed app does not have. **Promote at a 20% staged rollout** —
this is the first time R8 and the accessibility service reach production at all, and the battery
checklist passed on one device rather than a fleet.

**The three things between here and production, none of them engineering:**
1. ~~The **16.2 device checklist**~~ — ✅ **run and passed 2026-11-02** against 1.5.3 / 41, with
   R8 active. All sixteen items, battery included. No longer a gate.
2. **Store listing** must describe the subscription and the habit framing (Task 16.10). Hard gate
   on selling `flowread_plus`. The **privacy policy is done** — rewritten 2026-11-02 and now
   version-controlled as `privacy_policy.html` — but it still has to be **published to the hosted
   URL**, and **Play Console Data safety must be re-filed** (a separate form; editing the policy
   does not touch it).
3. **Production promotion.** Production is still on **1.4.5 / 32** — builds 33, 34, 36, 37, 38,
   39 and 40 have never left Internal testing, which includes the entire pivot.

**2026-11-03 — Q4 resolved and 16.4 Phase A shipped.** `Claude.md` §13.2 now exists, and the 6
unlabelled category chips are fixed. The catalogue work is re-scoped into four phases (see Task
16.4): growth for free users, drops for subscribers, deliberately not the same job.
**16.8 (home screen widget) is deferred by the owner until the app has traction.** Next product
task: **16.10**'s remaining screenshots + feature graphic.

**2026-11-16 — Page mode rewritten (Task 16.12).** Opening a book in Page mode no longer scales
with its length: 150k words went from **14.7s to 434ms**, first paint is one slab regardless of
size, and a re-open from the persisted grid is instant. The cause was a forced layout per word
plus a span and four listeners per word built for the whole corpus up front. **This closes N7 and
restores §9.5** — a nudged read lands in Page mode again, which it had not since 2026-09-21.
Device run still owed.

**2026-11-16 — 16.4 Phase B shipped.** The catalogue is **150 books**, grown by a curated batch of
62 weighted toward the genres the first 88 barely had. The 1.5.4 release state was also committed
(it had been sitting staged on the branch, never committed), and the **privacy policy is now
published to its hosted URL**. **Next engineering task: 16.4 Phase C** — the remote catalogue.
Earlier status entries are in the archive.

**Status legend:** `Not started` · `In progress` · `Blocked` · `Done`
**Checkbox markers:** `[x]` done · `[~]` partly done · `[→]` **not done, deliberately deferred to release and owned by the product owner** — these are release gates, not finished work.

---

## Decisions log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-09-16 | **API 36 via full Capacitor 6 → 8 upgrade**, not a hand-bump of AGP/Gradle on Capacitor 6. | compileSdk 36 needs AGP ≥8.9 + Gradle ≥8.11; Capacitor 6.2.1 ships AGP 8.2.1. The hand-bump is a smaller diff but an unsupported combination we'd own the breakage for, and it has to be redone at the next Capacitor upgrade anyway. The deadline blocks *all* releases, so we take the supported path once. |
| 2026-09-16 | **`@capacitor/network` approved** as a new dependency (Task 16.7). | Official Capacitor plugin, read-only connectivity listener. The only alternative is writing a native plugin for something Capacitor already ships. Satisfies the §21 new-dependency gate. |
| 2026-09-16 | **`@capacitor/share` approved** as a new dependency (Task 16.6). | Official Capacitor plugin for the native share sheet. `Claude.md` §15 assumes it exists; it was never installed. Satisfies the §21 gate. |
| 2026-09-20 | **Q8 resolved: `AccessibilityService` approved** for nudge detection, superseding §9.4's `UsageStatsManager` default. | `UsageStatsManager` answers *how long*, not *when* — and nothing keeps the app alive to poll. A plain background thread is killed; WorkManager's floor is 15 min. Polling needs a foreground service, whose notification Android 8+ makes undismissable by the app, and the product owner ruled a permanent notification out. Accessibility is the only mechanism left, and it is what One Sec/Opal/ScreenZen use. Scoped to the absolute minimum: `canRetrieveWindowContent="false"`, `typeWindowStateChanged` only, `packageNames` narrowed at runtime to the user's picks. `Claude.md` §9.4a records the full reasoning. |
| 2026-09-20 | **`<queries>` MAIN/LAUNCHER, never `QUERY_ALL_PACKAGES`**, for the app picker. | Same list of apps, but `QUERY_ALL_PACKAGES` is Play-policy-sensitive and needs a declaration form. This app already carries one rejection (§18). |
| 2026-09-20 | **`PACKAGE_USAGE_STATS` is optional**, not required. | Three settings-page grants before the feature does anything would be brutal onboarding. Granted it upgrades the trigger to real minutes-in-app; denied it falls back to "3rd open today" and Settings says so (§1.5). |
| 2026-09-20 | **Q2 defaults: 15 min → nudge, 2 pages → unlock**, cap 3/app/day, back off after 3 dismissals. | Starting values, all exposed as settings. Q9 copy review still outstanding. |
| 2026-09-25 | **Q12: `FREE_APP_LIMIT` temporarily raised 1 → 2**, to be restored to 1 by Task 16.1. | §4 says free = 1 app and unlimited is subscriber-only, but `hasSubscription()` is hardcoded false until 16.1, which is blocked on Q1 pricing. At a limit of 1, *no user could ever select a second app* — so §9.7's scoped unlock was unreachable in production and checklist item 5 was untestable. Leaving it would have meant shipping an advertised feature nobody could get to. The limit is one constant with a revert note on it, and `syncToNative()` already truncates an over-limit selection so lowering it later degrades cleanly. |
| 2026-11-01 | **`AppState.isPro` now means "has paid", not "owns lifetime"**; the lifetime purchase gets its own flag, `ownsLifetime`. | 16.1 kept the two *stored* entitlements independent as §4 requires, but every one of the 24 Pro gates in the app reads `AppState.isPro` — so leaving that as the lifetime flag would have locked a subscriber out of the very features they had just paid for. Making the *gate* a derived third thing keeps the Preferences keys separate (what the rule actually protects — the drops can gate on `isSubscriber` alone) without needing all 24 call sites to be found and changed correctly. |
| 2026-11-01 | **A subscription is revoked only from a query Play answered**, never from a failed one. | The first entitlement in this app that can stop being true. `queryPurchases` reports `checkedTypes` so "Play says no subscription" is distinguishable from "we could not ask" — revoking on the second would cut a paying subscriber off for having poor signal, the §1.5 failure mode at its most expensive. One-time purchases are still never revoked. |
| 2026-11-01 | **Subscription base plans are matched by billing period, not by base plan ID.** | A hardcoded plan ID is a silent breakage waiting for whoever renames it in Play Console. `P1M`/`P1Y` is what the user is actually choosing between. Offer tokens are never persisted (valid only for the query that produced them) and the native side re-resolves them against current details rather than trusting JS — charging the annual price to someone who tapped monthly is not a recoverable mistake. |
| 2026-11-01 | **The subscription's paywall copy does not mention monthly book drops.** | They are unbuilt — the §4 gap the owner accepted on 2026-10-30. The anchor strategy is ordinary pricing, but §1.3 only holds if the copy describes what a subscriber actually receives; promising unshipped content is where it would become a dark pattern. The line says what is true today (same tools, paid over time) and is flagged for rewrite when the drops ship. |
| 2026-09-25 | **Q11: sharing emits `stats_shared`**, carrying the entry point and nothing else. | §22 puts the product in a distribution bottleneck, and how often a card is actually shared is the direct measure of whether 16.6 addresses it. Widening the §9.6 allowlist was a privacy decision, so it was asked rather than assumed. No book, stat, or destination app is sent (§1.4). |
| 2026-09-25 | **Onboarding (16.3) becomes its own design task**; Q3 is answered inside it rather than ahead of it. | Q3 (inline vs deferred permission ask) is a design question, not an implementation flag, and answering it in the abstract before the onboarding narrative exists would have decided it backwards. N14's per-choice ask is the interim behaviour and is working. |
| 2026-09-25 | **The share card is free for everyone**, with a home-header entry point alongside the Pro dashboard one. | §15 puts Share on the dashboard, which is Pro-gated — so the feature prioritized *for distribution* (§22) would have been invisible to exactly the users whose shares reach non-users. `Claude.md` §15 updated to match. |
| 2026-09-25 | **Share hero = finished book, then streak, then total words**; milestones on book completion and on 7/30/100-day streaks. | A named book is the most shareable and most on-brand stat; streak milestones kept sparse so the prompt never becomes nagging (§9.1's tone applies here too). |
| 2026-10-06 | **The nudge may fire from inside a session** (N22), via navigation re-checks plus one pending timed check. | The minutes threshold could only ever be evaluated at the start of a session, so it reported time already spent instead of interrupting it. `every_open` is excluded — firing it mid-session makes it the wall §9.1 forbids. `Claude.md` §9.3a records the mechanism. |
| 2026-10-06 | **`UsageStatsManager.queryEvents` may be read to confirm the target app is still in front.** | The timed check must not interrupt someone who already left, and the accessibility service — correctly narrowed to the user's own picks — cannot tell it. The query can name an app the user never selected; it is compared and discarded, never stored or sent. A widening of what usage access is *used for*, not of the accessibility scope, and logged in `Claude.md` §9.4a precisely because it is a widening. |
| 2026-10-06 | **The minutes threshold counts the current sitting, not the day** (N26), superseding §9.3's original "15–20 minutes already spent that day". | The setting is labelled "After a while in the app"; at a 5-minute limit a daily total means you are permanently over, so the threshold trigger silently became "every time I open it"; and a daily total belongs to Android, so neither Reset nor the read credit could clear it — which is how a user who had just pressed Reset was greeted with "you have been on Reddit for 120 minutes". The two toggles are now orthogonal: one is the open, the other is the stretch. |
| 2026-10-06 | **The current sitting is timed by the wall clock, never by a usage-stats delta** (N28). | `getTotalTimeInForeground()` is built from daily buckets and does not include the session in progress, so it stands still for the whole time the user is inside the app and jumps when they leave. Timing a live sitting against it guarantees the thing it was meant to prevent: nothing fires inside, the nudge lands on the next open. The wall clock over-counts a brief switch away inside the session gap, which is the far smaller error. |
| 2026-10-06 | **Keep the "Nth open today" fallback** even though the minutes trigger now works without usage access. | The wall clock can time a sitting the user is navigating around in, but nothing can confirm they are still present when they are not, so the timed check still needs the grant — and an ungranted setup still needs something that fires at the moment of opening. |
| 2026-10-13 | **The prominent disclosure gates every route to the accessibility grant**, not just the master toggle (N29). | Play's declaration asserts it, so one unguarded path makes the declaration false — and the unguarded paths were the ones only a brand-new user could reach, which is to say exactly the reviewer. The guarantee now lives at the choke point (`openAccessibilitySettings` guards itself) rather than at each call site, because call sites get added and forgotten. |
| 2026-10-13 | **`isAccessibilityTool` stays unset (false), and the declaration says "App functionality" with no sensitive data collected.** | FlowRead is not an assistive tool for users with disabilities and claiming otherwise is a fast rejection. "No sensitive data" is defensible on the facts: the only input is a package name the user picked, it never leaves the device, and §9.6's closed allowlist keeps package names out of analytics. **That last clause is load-bearing — an event carrying a target package name would make the declaration wrong.** |
| 2026-10-06 | **A completed read refunds one nudge against the daily cap** (N23), on top of zeroing the clock. | Asked and answered by the product owner. Resetting a clock the gate has no nudges left to act on is theatre — the user would read, earn their fresh minutes, and never be interrupted again that day. The cap still holds between reads, so the only way past it is to have read. |
| 2026-10-06 | **Share-card covers are offline-only** (N25): PDF page one, else a typographic cover. | 65 of 88 catalogue books have a real cover, but as a remote Gutenberg URL with no CORS headers — fetching it would taint the canvas and fail the export outright, and the workaround adds a network path to a feature that has none. §1.1 and the §15 "works on a plane" promise both point the same way. |
| 2026-11-03 | **`Claude.md` §13.2 written**, and **per-book provenance declined** with the cost recorded in it. | The section was cited by §4, §14 and §21 — including the rule that governs book sourcing — and was not in the document. Writing it before the catalogue grows is the whole point; after a book is added it is an audit, not a constraint. Provenance was proposed as a field and declined by the owner for both the bundled 88 and the drops, which makes §13.2's allowlist the only thing standing between the project and a legal question about one book. That is a narrower margin, so the margin is written down. |
| 2026-11-03 | **Catalogue growth and monthly drops are separate tasks**, not one rotation mechanism. | §4 grants the free tier the *full catalog*, so a drop can never be one of the bundled 88 moved behind the paywall. Different audience, different source, different file. Merging them would have made the paywall boundary arbitrary and taken books off free users to populate it. |
| 2026-11-03 | **Q4: 3 drops/month; `catalog.json` hand-edited on public GitHub; book files in the WP media library; the existing 23 stay where they are.** | The owner's requirement was that a monthly drop never need an app release, and that the editing surface not be code. WordPress blocks `.json` uploads but accepts `.txt`/`.pdf`, so splitting the two puts each file where it can actually live. GitHub additionally gives version history, so a broken edit is diffable — which matters because the app's only safe response to malformed JSON is to fall back silently and say nothing. |
| 2026-11-03 | **No `generateFileId` change, and the previously-proposed fix must not be applied.** | It was correct only while the 23 off-site books were expected to move. With them staying put, dropping `sourceUrl` from the seed would re-key all 88 and orphan the position of every current reader — causing precisely the damage it was written to prevent. Replaced by two rules: never edit an existing entry's `sourceUrl`, and give each new self-hosted book its final URL on day one. |
| 2026-11-03 | **A drop's rotation hides the card, never the downloaded file** — and a lapsed subscription keeps what it downloaded. | The file is on the user's device and they paid for the month in which they got it. Reclaiming it would be the clearest §1.3 violation available to this product. The cost is that "rotating, not cumulative" is true of the catalogue and not of any individual user's library, which is the right way round. |
| 2026-09-16 | **Strict `Claude.md` order** — compliance block fully verified on a real device before any feature work starts. No parallel nudge development. | §3.3 sequencing. Avoids re-testing feature work against a shifting toolchain. |

---

## Open questions — product owner

Each is tagged with whether it blocks *starting* the task or only *finishing* it.

| # | Question | Blocks | Start/Finish | Ref |
|---|---|---|---|---|
| ~~Q1~~ | ~~Subscription price (monthly / annual)~~ | — | **Resolved 2026-10-30: ₹149/mo, ₹999/yr as `flowread_plus`; lifetime `pro_lifetime` repriced to ₹2,999 and widened to include OCR; `ocr_vision` retired from sale but honoured forever.** See 16.1. | §4 |
| ~~Q2~~ | ~~Nudge default thresholds~~ | — | **Resolved 2026-09-20: 15 min / 2 pages, both settings** | §9.2, §9.3 |
| ~~Q3~~ | ~~Is the nudge permission ask inline in onboarding or deferred?~~ | — | **Resolved 2026-11-01: inline**, and placed *after* the user names an app so the ask is concrete. Skippable throughout; N4's home card stays as the second chance for skippers. See Task 16.3. | §10.2 |
| ~~Q4~~ | ~~Monthly book-drop count, and bundled vs. remote-fetched catalog~~ | — | **Resolved 2026-11-03: 3 books/month, rotating. `catalog.json` hand-edited on a public GitHub repo (raw URL); book files uploaded to the WP media library. The existing 23 off-site books do not move.** No per-book provenance. See Task 16.4. | §4, §13 |
| Q5 | Leaderboard backend — reuse the analytics Worker with a new endpoint, or something more structured? | 16.5 | **Start** | §14 |
| Q6 | Exact copy/tone for the offline-triggered notification | 16.7 | Finish | §11 |
| Q7 | Widget: classic `AppWidgetProvider` vs. Jetpack Glance | 16.8 | Finish — default to classic, evaluate briefly first | §12 |
| ~~Q8~~ | ~~Is `AccessibilityService` escalation ever pursued?~~ | — | **Resolved 2026-09-20: yes, signed off. `UsageStatsManager` cannot do it without a permanent notification** | §9.4a |
| ~~Q9~~ | ~~Nudge screen copy/tone sign-off~~ | — | **Signed off 2026-09-25.** | §19 |
| ~~Q10~~ | ~~Share card / sheet / milestone copy + Hindi sign-off~~ | — | **Accepted as-is 2026-09-25 ("okay for now").** Owner-written Hindi may still replace the current Hinglish-register draft later; not a blocker. | §15 |
| ~~Q12~~ | ~~Should the one-app limit stand while the subscription does not exist?~~ | — | **Resolved 2026-09-25: (b) — `FREE_APP_LIMIT` temporarily raised to 2.** ✅ **Restored to 1 by Task 16.1 on 2026-11-01**, with the truncation now surfaced rather than silent. | §4, §9.7 |
| ~~Q11~~ | ~~Should sharing emit an analytics event?~~ | — | **Resolved 2026-09-25: yes.** `stats_shared` added to the `analytics-ping.js` allowlist, carrying the entry point only (`home` / `dashboard` / `milestone`) — never the book, the stat, or the app shared to. Inert until the Worker endpoint exists. | §9.6, §15 |

---

## ✅ Resolved finding — `Claude.md` §13.2 was missing

Found 2026-11-02 while planning the WordPress book hosting; **§13.2 written 2026-11-03**.

`Claude.md` cites **"the verified-legal sources in Section 13.2"** three times — §4's tier table,
§14's rejected list, and **§21's stop-and-ask rule**, which is the rule that governs book sourcing.
The section is absent: the document goes 13.1 → 13.3. So the one constraint meant to keep this
project away from legal exposure on book content **points at nothing**.

This was harmless while every book was a link to someone else's server. It stops being harmless
the moment books are served from a domain the project controls, because that makes the project the
**publisher** rather than a referrer.

**Written 2026-11-03.** Two allowed source types (public domain verified on the *edition*, not the
work's age; licences that permit redistribution), the load-bearing distinction that **"free to
read" is not "free to re-host"**, linking and hosting recorded as different legal positions that
are both fine but **not interchangeable**, shadow libraries out with no exception, and an explicit
line binding the monthly drops to the same rule. **Per-book provenance was proposed and declined**
(owner, 2026-11-03) for both the bundled 88 and the drops; §13.2 records what that costs — a
challenge on one book must be answered by re-deriving why that edition was clear — so the
allowlist is now the only thing doing that job.

Related, and also found 2026-11-02: **`generateFileId('freebook', book.id, book.sourceUrl)` hashes
the source URL**, so a book's identity is its location. Re-hosting any existing book orphans every
reader's copy and position and leaves a duplicate in their library.

**Closed by decision, not by code (owner, 2026-11-03): the existing 88 are not moving.** So
nothing to fix — and the fix originally proposed here (drop `sourceUrl` from the seed) would now
*cause* the damage it was meant to prevent, since re-keying all 88 orphans the positions of every
current reader. **Do not apply it.** Two rules replace it: never edit the `sourceUrl` of an
existing entry, and give every new self-hosted book its final URL on the day it is added. The trap
only bites when a URL *changes*.

---

## Codebase corrections found during planning

**Status:** ✅ Historical, folded into `Claude.md` by H2.

Describes the pre-1.4.5 state. **Every version in it is out of date by design** — do not read it as current.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

# Block A — Compliance ✅ shipped (16.1 code complete 2026-11-01)

The **2026-08-31** deadline had already passed when this work started, leaving the app unable to publish any update. A Play Console extension (valid to 2026-11-01) covered the gap, and 1.4.5 cleared both notices on 2026-09-16. 16.1 (Subscription IAP) remains open but gates nothing.

---

## Task 16.0a — API 36 target bump + toolchain upgrade

**Status:** ✅ Shipped in 1.4.5 / versionCode 32 (2026-09-16).

compileSdk/targetSdk 35 → 36, which forced Capacitor 6.2.1 → 8.5.2, AGP → 8.13.0, Gradle → 8.13, Java 17 → 21, and minSdk 22 → 24. **Budget the same for the next SDK bump** — see `Claude.md` §3.2 and §3.3.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Task 16.0b — Google Play Billing Library upgrade

**Status:** ✅ Shipped in 1.4.5 / versionCode 32 (2026-09-16).

Play Billing 7.1.1 → 9.1.0. See `Claude.md` §3.1.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Task 16.1 — Subscription IAP

**Status:** **Code complete 2026-11-01.** Q1 answered 2026-10-30, Play Console setup done by the
owner. Remaining work is a device test against a license tester, Hindi copy sign-off, and the
privacy-policy/store copy for a subscription product. · **Ref:** §4 · **Size:** M

**Why:** The subscription tier's value is recurring by nature (monthly book drops, ongoing nudge personalization) and can't honestly be sold as a one-time purchase.

**Prices:** see `Claude.md` §4 — it is the authority. ₹2,999 lifetime, ₹149/mo, ₹999/yr. ⚠️ Play
returned **₹3,000 / ₹150 / ₹1,000** on device (its own rounding, accepted 2026-11-01); the app
displays only what Play reports, so §4's table and what a user is charged now differ by rounding.

**⚠️ The subscription still carries no recurring value** — the drops, badges, scheduling and
strict mode are unbuilt, so a subscriber pays monthly for what ₹2,999 buys outright. Accepted
for the anchor strategy; it is also what drives month-two cancellation. **Revisit when 16.4
ships**, and rewrite `paywall.plan.sub_extra`, which deliberately promises nothing today.

**Remaining — none of it is code:**
- [ ] The device checklist below, against a Play **license tester**.
- [ ] Hindi copy sign-off on the paywall strings (drafted, not owner-written).
- [~] Privacy policy + store copy describing a **subscription** product. Hard gate on production.
      **Policy done 2026-11-02** (`privacy_policy.html`, rewritten — see 16.2) and
      **published to the hosted URL 2026-11-16**. Still owed: the **store listing** copy
      (Task 16.10).

**Device checklist (never run):**
- [ ] Subscribe on the **monthly** base plan; Pro surfaces unlock, `fr_purchase_subscription` is `true`.
- [ ] Subscribe on the **annual** base plan — confirms the offer token is per-plan and the right one is charged.
- [ ] Cancel in Play; the entitlement **persists** to period end and the Manage row still works.
- [ ] Let it lapse (or revoke as a tester); access closes on the next resume and Pro surfaces re-render locked.
- [ ] **Airplane mode on a live subscriber** — access must survive, nothing revoked.
- [ ] Restore on a fresh install for: lifetime only, subscription only, both, legacy `ocr_vision` only.
- [ ] Lifetime regression: fresh purchase, already-owned, restore (the 16.0b/H4 flows).
- [ ] OCR reachable for a subscriber who never bought `ocr_vision`.
- [ ] Nudge picker at the limit of 1 → paywall opens, picker closes (never two modals, §21).
- [ ] An existing two-app free user on upgrade: one app dropped, and **told once** which.

**⚠️ Testing constraint:** on an account owning `pro_lifetime` *no paywall is reachable at all* —
every entry point is behind `if (!pro)` and `appLimit()` returns `Infinity`. Four items above are
unreachable from the owner's own account, and clearing app data does not help because
`refreshEntitlements()` re-grants from Play on the next launch. **Use a second license-tester
account.**

*Full history — pricing rationale, and what the implementation settled — in
[Tasks-archive.md](Tasks-archive.md).*

# Block B — Pivot core

## Task 16.2 — Habit Interception System ("Nudge")

**Status:** ✅ **Code complete and shipped to Internal testing** as 1.4.8 / versionCode 36 on
2026-10-13, with the Play accessibility declaration submitted and the privacy policy live — both
hard gates now cleared. Built 2026-09-20; hardened across four device rounds to 2026-09-25
(N1–N16), then a field round on 2026-10-06 after several weeks of real use (**N22–N24, N26–N28**),
then **N29** found while filling in the Play declaration itself. The field round changed what the
minutes threshold means: it fires *during* a sitting rather than reporting on the last one, and it
counts the sitting rather than the day. §9.3 was rewritten to match.
**Device checklist run and passed 2026-11-02** against 1.5.3 / 41, with R8 active — four
deferrals closed in one pass, including item 9 (battery), which had no data behind it at all.
**Nothing engineering-side is open. The only thing left on 16.2 is production promotion.**
Q2/Q8 resolved · **Ref:** §9, §9.3a, §9.4a, §1.6 · **Size:** XL — largest single feature in Phase 16

**Why:** The core mechanic of the pivot (§0.1). Redirects time in distracting apps toward reading.

**🚨 Non-negotiable:** Every nudge screen shows a one-tap "Continue to [App] anyway", always visible, never behind a timer or a second tap. §21 calls this a product/legal rule, not a style preference — no future task overrides it without a logged product-owner decision.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

### Still open before this ships

- [x] Device verification at API 36 — **four rounds plus the full checklist, 2026-09-21 to
      2026-11-02.** Detection,
      the nudge screen, the escape hatch, the unlock prompt and the scoped return are all
      confirmed working on hardware. Each round surfaced the next layer of behaviour, which is
      what N1–N16 are.
- [x] **Fix N1–N16** — all sixteen done, 2026-09-21 to 2026-09-25. `:app:compileDebugJavaWithJavac`
      and `assembleDebug` clean, JS syntax clean, en/hi **532 keys each, full parity**.
- [x] **Fix N22–N24, N26–N28** — field round 2026-10-06. `assembleDebug` clean, JS syntax clean,
      en/hi **566 keys each, full parity**. **Device-verified 2026-11-02** via checklist items 12–16.
- [x] **Device checklist (items 1–16) — RUN AND PASSED on device, 2026-11-02.** All sixteen
      items exercised end to end against **1.5.3 / versionCode 41**, after being deferred four
      times. This is also the first device run with **R8 active**, so the obfuscated native
      plugin surface (`FlowReadNudgePlugin`, the accessibility service, the IAP plugin) is
      confirmed working rather than assumed. The items that had never been exercised against any
      build — scoped unlock with two targets (5), cold start (6), **battery (9)**, Hindi (10),
      the Page-mode regression (11) — and all of 12–16 from the field round are now covered.
      **Item 9 finally has data behind it:** the timed in-session check and its ≤6-hour
      `queryEvents` show no measurable idle drain, which was the one risk with no evidence either
      way and the kind Play vitals would have surfaced before a developer did.
      **16.2 has no open engineering or verification work left — only production promotion.**
- [x] **Q9 — nudge copy and tone: signed off 2026-09-25.**
- [x] **Play Console Accessibility API declaration — submitted 2026-10-13** against 1.4.8
      (versionCode 36), with the prominent-disclosure video. Declared **App functionality** only
      and **no** sensitive data collected: the service receives a package name the user chose
      themselves, it never leaves the device, and the §9.6 allowlist deliberately keeps package
      names out of analytics. `isAccessibilityTool` is left unset (i.e. false), which is the
      honest answer — FlowRead is not an assistive tool. **If a future event ever carries a target
      package name, this declaration becomes wrong and has to be amended.**
      Note the form does not live in App content: it is triggered by uploading a build containing
      the service, which is why 35 had to go up before it could be filled in.
- [x] **Privacy policy — rewritten 2026-11-02, now in the repo as `privacy_policy.html`.**
      **The 2026-10-13 entry here was wrong and overstated what was live.** That version did not
      describe the §9.6 pings — it stated *"no analytics of any kind"* and *"no network requests
      except in two specific cases"*, which denied them outright and also omitted Free Books
      downloads. The claim that it would not need re-issuing when the Worker goes live was
      therefore false: the policy contradicted the shipped allowlist rather than merely omitting
      it. The accessibility section was also missing *"cannot read your screen"*, the single
      disclosure the Play declaration rests on.
      The rewrite covers: the accessibility service (what it receives, that screen reading is off
      **in the service's own configuration** so it is not a choice FlowRead could make, that the
      app list is user-chosen, that nothing is stored or transmitted); optional usage access and
      what declining costs; the pings in full (the fixed event list, date-without-time, the
      explicit never-included list, best-effort delivery); all five network cases; on-device OCR;
      launcher-only app listing; and **the subscription** — Google Play as sole processor, only
      yes/no entitlement flags stored locally, no receipts or tokens, cancellation via Play with
      no step in front of it (§1.3).
      **The policy now lives in the repo** so an amendment is a diff rather than archaeology, and
      so the text that shipped with a given build is recoverable. **Published to the hosted URL
      2026-11-16** — that is a manual step and is not done by committing the file, so any future
      amendment needs it done again.
- [~] **Play Console Data safety — filed 2026-11-02, and must be re-filed once more.** The first
      filing had to answer *collection is required*, because no opt-out existed. An opt-out was
      then built the same day (below), so the answer becomes **Optional** — **re-file before
      promoting**, since the form as it stands understates the user's control and reads badly on
      a privacy-positioned listing.
- [x] **Analytics opt-out — built 2026-11-02.** `fr_analytics_opt_out`, a toggle in Settings →
      About, checked inside `logEvent()` on every call so it takes effect immediately rather than
      at the next launch. Three properties worth keeping: the storage key is the opt-**out** while
      the control reads as *share*, so absent means opted in and the checkbox still matches the
      user's intent; a localStorage throw is treated as opted **out**, because a consent check is
      the one place failing closed is correct; and it is deliberately **not** routed through
      `updateSetting()`/`AppState`, because `AnalyticsPing` reads localStorage directly and a
      second copy of a consent flag is a way for the two to disagree.
      **Why it was built rather than filed around:** §1.1 calls the pings "opt-out-safe-by-design",
      but that only ever meant *fails silently when offline* — there was no user-facing choice, so
      Data safety had to say collection was required. For an app positioned on §1.4
      privacy-by-architecture, that line is conspicuous on the listing.
      Hindi is **drafted, not signed off** — same standing as the other 16.1/16.3 strings.
- [ ] **Data safety, original note — still applies.** Editing the policy does not touch it; it is
      a separate form. Two triggers now, not one: the subscription, and the pings. Recommended
      declaration: **App activity → App interactions**, *not* linked to identity, *not* used for
      tracking or advertising — filed **now**, while `ENDPOINT = ''` makes it over-declaration,
      because the alternative is a declaration that silently becomes false on a one-character code
      change nobody will connect to a compliance form. Declare **nothing** under financial info:
      Google receives payment data, FlowRead never does.
- [ ] **Cloudflare Worker endpoint** — `analytics-ping.js` has `ENDPOINT = ''` and is inert until one exists. This is a safe shipping state, not a bug.
- [x] ~~Decide whether the nudge setup belongs in onboarding (Q3)~~ — **resolved 2026-09-25:
      answered inside Task 16.3's design, not ahead of it.** N14's per-choice ask is the interim
      behaviour.

### Device test checklist

1. Each of the three settings pages opens at the right screen; the grant is re-detected on return (handled by an `appStateChange` listener in settings.js). Denying any one degrades with a plain-language explanation.
2. Picker lists installed apps without `QUERY_ALL_PACKAGES`. Selecting a second app shows the paywall while `isSubscriber()` is false.
3. Below threshold: no nudge. Past it: nudge. Daily cap and the 3-dismissal back-off both hold.
4. **Escape hatch visible and working on first paint, every time, including hardware back.** Not waivable.
5. Scoped unlock: reading to threshold opens *that* app only; a second target still nudges on its own counters.
6. Cold start: force-stop FlowRead, open the target app — the nudge must still appear via `fr_pending_nudge`.
7. Engine preference preserved: set RSVP as default, take a nudge, confirm the reader is still RSVP afterwards.
8. Airplane mode: every analytics event fails silently, no user action blocks.
9. Battery: several hours idle, no measurable drain.
10. Hindi: walk the whole flow, no raw key names.
11. Regression: Page mode position round-trip; existing notifications still fire.
12. **N22 — mid-session, navigating.** Threshold 1 min, open a target app, tap around for two
    minutes without leaving. The nudge must arrive *during* the session, with the present-tense
    headline. `adb logcat -s FlowReadNudge` prints every decision either way.
12a. **N26 — the open itself is silent.** With only "After a while in the app" on, opening a target
    app must produce **no** nudge however long you spent in it earlier today, including straight
    after Reset. Settings must show the stretch at ~0 min alongside today's total.
12b. **N27 — both triggers on.** Open, get the open-nudge, escape, reopen within a minute: the
    second open must nudge again. Then stay in and confirm a separate threshold nudge arrives.
13. **N22 — mid-session, sitting still.** Same, but scroll one feed and touch nothing that changes
    a window. The timed check must fire. Then background the app before it is due and confirm
    nothing fires — the foreground check rejecting it is visible in logcat.
14. **N22 — no usage access.** Revoke it: the timed check must never schedule, the opens fallback
    must still work on a new open, and Settings must still say which trigger is in play.
15. **N23 — the credit.** Read past the threshold, take the unlock; the modal names pages, minutes
    and the fresh budget. Settings shows the clock near zero and one nudge refunded, and
    re-crossing the threshold produces another nudge. Then start a read, leave early, and confirm
    the clock is *not* credited.
16. **N24 — midnight.** Set the clock to 23:55, take an unlock, roll past midnight: the
    suppression survives; opens, nudges, dismissals and the credit are all clear.

**Re-test note:** §3.2 warns `UsageStatsManager` behavior shifts between API levels. Since this is built *after* the API 36 bump, test against 36 directly — but re-verify on any future SDK bump.
## Task R8 — DEX optimization / obfuscation (Play Console notice)

**Status:** ✅ Done (1.4.9 / versionCode 37), Play-side figure still unconfirmed.

Obfuscation 1% → 93% locally. Play computes the number itself, so it needs a build on a track to confirm. **Carried into 1.5.x** — every release since is minified.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Task 16.3 — Onboarding redesign

**Status:** **Code complete 2026-11-01.** Designed first (as decided 2026-09-25), then built in
the same session once the design was signed off. **Q3 answered inside that design: inline.**
Remaining is a device run and Hindi copy sign-off. · **Ref:** §10 · **Size:** L

**Why:** Onboarding was RSVP-calibration-first, built entirely under the pre-pivot
speed-reading identity. Full-surface redesign, not a copy tweak.

**All steps done.** Extracted into its own view file; habit pitch leads; the nudge is explained
before any ask; ends in Free Books; limitations repositioned rather than removed; every string in
both locales from day one. **§10.2 answered: the ask is inline**, placed after the user names an
app so it reads "when you open Instagram" rather than something abstract, and nothing dead-ends.

**Remaining:**
- [ ] Device run: the accessibility round-trip *from inside onboarding* (screen 3 must re-render
      to `On` when you come back), the notification dialog, the optional usage-access row, and
      how screen 2 looks on a small screen with a long app label.
- [ ] Hindi copy sign-off — this is the screen a new Hindi user judges the app on.

**Files:** NEW `www/js/views/onboarding.js` · `www/js/views/settings.js` (remove onboarding) · `www/js/app.js` · `www/index.html` · `www/js/storage.js` · `www/i18n/*.json` · `www/css/components.css`

*Full history in [Tasks-archive.md](Tasks-archive.md).*

# Block C — Independent features (any order after Block A)

## Task 16.9 — Home screen reorder (friction fix)

**Status:** ✅ Code complete (2026-09-16), shipped in 1.4.7 · **Ref:** §19 · **Size:** S

**Why:** In-progress books sit below the import grid; resuming a read is the most common action and currently requires scrolling past import options.

**Steps**
- [x] `#library-section` moved directly below `</header>`, above `.import-grid` and the Free Books featured card.
- [x] `renderLibrary()` and all re-render call sites still resolve — they re-query `#library-section` each time, and the element only moved within the same template.
- [x] **Empty state fixed.** `.upload-screen` is a flex column with `gap: var(--space-xl)`, so an empty-but-present `#library-section` would have added a second gap under the header on a fresh install. The section now carries `hidden` in the template and `renderLibrary()` toggles `section.hidden` on both paths. No `[hidden]` override exists in the CSS, so the browser default applies.
- [ ] Eyeball spacing/safe-area on a small device, with and without a library.

**Files:** `www/js/views/upload.js` · `www/css/components.css`
**Done when:** Home opens with in-progress books first, both with and without a library, on a real device.

---

## Task 16.7 — Offline-triggered reading notification

**Status:** ✅ **Done — verified on device 2026-09-20** (1.4.7). Q6 copy still needs sign-off. · **Ref:** §11 · **Size:** S–M

**Why:** Going offline is a natural reading moment. Third notification type, connectivity-triggered rather than time-of-day.

**Steps**
- [x] `@capacitor/network@8.0.1` installed (major matches the Capacitor 8 line) and `npx cap sync android` run — 7 plugins now detected. Adds only `ACCESS_NETWORK_STATE` to the merged manifest.
- [x] Listens for the online→offline transition via `networkStatusChange`. Read-only, no other use (§2).
- [x] `NOTIF_OFFLINE = 1003` added alongside 1001 / 1002.
- [x] Reuses `_hasReadToday()`, `_hasPermission()`, `_pick()`, `CHANNEL_ID` and the same `isExactNotification:false` + `allowWhileIdle:true` scheduling shape H3 established.
- [x] Anti-spam, all four rules: 4h throttle (`fr_notif_offline_last`); suppressed when `_hasReadToday()`; suppressed when the app is foregrounded (via `App.getState().isActive`, defaulting to "foreground" so an unknown state suppresses rather than fires); brief blips ignored via a 30s confirm window that re-checks `getStatus()` before firing.
- [x] Only a genuine online→offline **transition** arms the timer — `_wasConnected` prevents repeat offline events from re-arming it.
- [x] Settings toggle `fr_notif_offline` (default on), with the same permission-denial handling as the daily reminder. Turning it off cancels 1003.
- [~] Copy is **Q6 — draft only, needs product-owner sign-off.** Three rotating bodies per locale, deliberately light and non-preachy (§1.6): "No signal? Good time for a few pages." / "Nothing to scroll right now. Your book is still here." / "Offline — a quiet moment to read."
- [x] New keys in `en.json` + `hi.json` (451 keys each, full parity).
- [x] Device-verified 2026-09-20 on 1.4.7 — going offline fires the nudge.

**Honest limitation to document (§1.5):** the connectivity listener only runs while the app process is alive, so this catches going offline with FlowRead backgrounded — not after Android has reclaimed the process. It is a bonus trigger, not a guarantee. Noted in a comment above the implementation.

**Files:** `package.json` · `www/js/features/notifications.js` · `www/js/views/settings.js` (toggle) · `www/i18n/*.json`
**Done when:** Airplane-mode toggling fires at most one notification per throttle window, never when already read today, never in foreground.

---

## Task 16.6 — Share stats feature

**Status:** ✅ **Code complete 2026-09-25.** Verified in a headless Chrome against the real app
CSS — card rendering (English + Hindi), the sheet, the home Share button and the book-completion
milestone all confirmed. **Not yet device-tested and not yet in a release.** · **Ref:** §15 ·
**Size:** M
Prioritized partly as a **distribution** mechanic — the product's current bottleneck is distribution, not retention (§22).

*Full history in [Tasks-archive.md](Tasks-archive.md).*

### Still open before this ships

- [ ] **N25 — the PDF cover on device.** Share a finished PDF and confirm page one actually
      renders, within a sensible wait, and that the cached copy is used on the second share.
- [ ] **Device test.** All verification so far is headless Chrome against the real CSS, which cannot exercise the one genuinely native path: `Filesystem.writeFile` → `getUri` → `Share.share`, the FileProvider grant, and what the receiving app actually does with the PNG. Test at least one chat app, one social app and Gmail.
- [ ] **Q10 — copy/tone sign-off and Hindi**, for the card, the sheet and both milestone prompts. Fold into the same pass as Q9 (nudge copy) — same register, same reviewer.
- [ ] **Q11 — should sharing emit an analytics event?** Not added; see above.
- [ ] Airplane mode: the whole feature is on-device, so it should work offline end to end. Worth confirming, since it is a genuine §1.1 selling point.

**Done when:** Both entry points produce a shareable image through the native sheet on a real device, on-brand, with working toggles.

---

## Task 16.11 — Settings + onboarding text reduction

**Status:** ✅ Code complete 2026-11-02 · **Ref:** §1.5, §16, §17, §21 · **Size:** S–M

**Why:** reported from use — every option on Settings carried a permanent explanatory paragraph,
six of them in the nudge section alone, and onboarding's permission screen opened with 196
characters of prose above three more notes. §1.5 asks for honest limitations, not for every
explanation to be open at once; availability is the requirement, not simultaneity.

**What was built**
- **Inline disclosure (ⓘ).** One short line stays on screen per option; the full text — *the same
  string that used to sit there permanently* — moves behind a tap. Nothing is deleted, so no
  Hindi is lost and the only new translation is the short lines. `infoHint()` in `settings.js`,
  `.settings-hint` / `.settings-info-btn` / `.settings-info-body` in `components.css`.
- **Not a modal, deliberately** (§21 allows one at a time, and Settings has real ones — the app
  picker, the paywall — this must not compete with). The button is a 2px-radius square, not the
  conventional circular badge, because §16 rules out pills.
- **Delegated handler on the view**, not per button: permissions, the reminder note and the mode
  note all re-render their own markup, and a handler bound to a replaced node is a dead control.
- **Applied settings-wide** (nudge, notifications, library, about) **plus onboarding screen 4**,
  rather than to the two surfaces reported, to avoid a half-converted page carrying two patterns.
- **All three permission surfaces now agree** — Settings, onboarding, and `nudge.js`'s prompt
  modal share the short lines, which is what the "should look like one feature" note in
  `onboarding.js` asked for. The long text's single home is the Settings ⓘ.

**Two things kept deliberately visible**
- **A denied or failed reminder permission.** That is the one case the user has to act on, so it
  stays fully expanded; only the healthy note folds away (§1.5).
- **The escape-hatch promise.** Its short line carries the guarantee itself ("every nudge has a
  one-tap way to carry on anyway") and only the no-penalty elaboration folds. §21 makes the
  hatch on the *nudge screen* non-negotiable; that screen is untouched by this task.

**Two stale strings fixed in passing, both factually wrong rather than merely long**
- `settings.nudge.intro` said *"already spent a while in it **today**"* — the day-cumulative model
  §9.3 explicitly reversed on 2026-10-06. Now reads as a sitting.
- `settings.about.privacy` said *"no analytics backend"*, which stopped being true when the
  §9.6 pings shipped — and after the opt-out work it sat directly above a *"Share anonymous
  usage counts"* toggle. Rewritten to describe what actually happens and point at the toggle.

`onboarding.perm.body` (196 chars) is **removed**, not folded: `body_short` carries its substance
and the accessibility specifics belong to the prominent disclosure (§10.2/N29), which is the one
place that text should live.

**i18n:** 599 keys, en/hi parity verified. **Hindi is drafted, not signed off** — 10 short lines
plus the two rewrites, same standing as the other 16.1/16.3 strings (§17).

**Second round, same day — both reported from the device:**

- **The gate status was three lines of prose to say "0 of 2".** It joined up to five full
  sentences, each written to be read on its own. Now one scannable line of counters —
  `Instagram · 0/2 nudges · 12/15 min` — with the full sentences, unchanged, behind the ⓘ.
  The day's total moves into the ⓘ rather than off the screen: §1.5 wants it available, because
  a sitting figure far below the phone's own screen-time number reads as a bug, but it is context
  and does not belong on the glance line. An **exceptional state stays visible** (`daily limit
  reached`, `paused ~4 min`, `stopped until tomorrow`) — that is news, not explanation. The row
  label dropped from *"Today so far"* to *"Today"*, since the line under it now says the rest.
- **`Reset` did not look pressable — and nor did any other inline row button.** The cause is
  that `.settings-inline-btn` is a `.btn-ghost`, which is `background: transparent` **and**
  `border-color: transparent`, so in a settings row it rendered as muted text with no edge.
  Reset, Grant, Change and Restore were all affected; Reset is simply the one next to a label
  that reads like a heading. Fixed by giving inline row actions a face and an edge
  (`--surface-2` / `--border`, accent on press), **scoped to `.settings-inline-btn.btn-ghost`**
  rather than changed on `.btn-ghost`, which modals and onboarding rely on being invisible.

**Device test owed:** the ⓘ expand/collapse on a real touch target, that a hint inside a `<label>`
does not toggle its setting when the ⓘ is tapped, the Hindi line lengths at 400px, and that the
compact status line does not wrap on a narrow screen in Hindi.

---

## Task 16.12 — Page-mode pagination rewrite  ✅ code complete, device run outstanding

**Governed by `Claude.md` §5.1** (written for this work), §9.5, §21 (performance).

**Why.** Page mode's open time scaled with the book and was bad even on short ones. It built a
span for every word in the corpus — four word-tap listeners each — and read `offsetHeight` after
every single `appendChild`, so a forced layout per word. Measured on a desktop: **15k words 1.3s,
60k words 5.2s, 150k words 14.7s**, and a phone is several times slower. This is the defect behind
N7, and it is why §9.5's rule that a nudged read lands in Page mode had been overridden since
2026-09-21 — the pivot's own entry point could not use the engine it specified.

**What changed.**
1. **Slab measurement.** ~3000 words laid out in one `innerHTML` assignment, one forced layout,
   then `offsetTop` read off each word while layout is clean. Same single-flush trick FocusBold
   already used (`focusbold.js:150`), but slab by slab so the book is never all in the document.
2. **Lazy leaves.** Pages are two integers until they enter the prev/current/next window; leaves
   are built on demand and released on an LRU of five. A 150k-word book went from ~150k spans and
   ~600k listeners to ~550 spans and ~2,200 listeners.
3. **Two-phase open.** One slab is measured at the reader's own position and painted; the grid
   for the whole book is measured behind it on a 12ms frame budget. First paint no longer depends
   on book length at all.
4. **Persisted boundaries.** `fr_page_layout_*` in localStorage — integers only, never content —
   keyed by file+font+scale+viewport, LRU-evicted at 10. A later open measures nothing.
5. **Page mode dropped `hasCache()`**, so reader.js no longer shows it a loading card: first paint
   is now inside the window where a card would only flash.

**Measured (desktop Chrome, 412×700 stage, full pass):**

| Book | Before | After | Forced layouts |
|---|---|---|---|
| 15k words | 1,317 ms | **43 ms** | 15,000 → 6 |
| 60k words | 5,165 ms | **171 ms** | 60,000 → 21 |
| 150k words | 14,720 ms | **434 ms** | 150,000 → 51 |

First paint is one slab — **10–60 ms regardless of size** — and a re-open from the persisted grid
is **synchronous, 0 ms**. Page sizes agree with the old algorithm to within 1.2%, erring toward
slightly fewer words per page, so nothing overflows.

**Also fixed while in here:**
- `_switchEngine` never called `hasCache()`, so switching into Focus or Scroll showed the loading
  card even on a warm cache, unlike `renderReader`. They agree now.
- `seekTo()` snapped `_index` to the page start, rounding away intra-page position on a §7 bridge
  round-trip. It keeps the exact word; only `_gotoPage` moves the position.
- `_pageForIndex` was a linear scan over every page; it binary-searches.
- A destroy mid-build threw away all measurement. Boundaries now survive it.
- The nav bar — and with it the §7 bridge button — used to appear only when pagination finished.
  It is up at first paint.

**Honest limitation, by design (§1.5).** Resuming deep into a book that has not been measured
before, the grid on screen starts at the reader's position and so cannot know its own page
numbers. The indicator reads `~274 / ~341` until the background pass lands (sub-second), and the
first/last-page buttons are disabled for that moment rather than jumping somewhere wrong.
Resuming at word 0, or from a persisted grid, is exact immediately.

**Verified:** 40-assertion headless-Chrome harness against the real `page.js`, `storage.js` and
app CSS — grid contiguity (every word covered exactly once, no gaps), the provisional→canonical
swap not moving the reader, LRU bounds, persistence round-trip, mid-build destroy leaving nothing
behind. All pass. Harness is not committed; it is a scratch file.

- [ ] **Device run.** Large book, cold cache: open time, swipe across 20+ pages, word-tap and
      long-press dictionary on a page reached after LRU eviction, a `[Table — Tap to View]`
      placeholder, §7 bridge both ways, rotation + font-scale change, engine round-trip to RSVP
      and back (16.2 checklist item 11), kill-and-reopen (persisted grid), and a nudged read now
      landing in Page mode with the unlock counter still advancing.
- [ ] **Hindi.** Open a Devanagari book in Page mode — pagination and word tap unaffected. No new
      user-facing strings were added, so there are no new i18n keys.

---

## Task 16.8 — Home screen widget (Android only)

**Status:** **Deferred (owner, 2026-11-03)** — revisit once the app has traction. Unblocked and ready; Q7 needed to finish · **Ref:** §12 · **Size:** L

Not blocked by anything and not a dependency of anything. Deferred because it is polish for an app with an existing user base, and 16.4's drops close §4's revenue gap instead.

**Steps**
- [ ] Briefly evaluate classic `AppWidgetProvider`/`RemoteViews` vs. Jetpack Glance (Q7). **Default to classic** — consistent with the existing Java, no-Compose native plugin style. Flag if the evaluation says otherwise; don't force it.
- [ ] `FlowReadWidgetProvider.java`: show the most recent in-progress book — title + simple progress indication, legible at widget scale.
- [ ] **Event-driven data flow** (§21): `widget-bridge.js` pushes the current book to native storage on every position save. **Never polled.** The widget process runs outside the WebView and cannot read app state directly.
- [ ] Deep link: tapping opens *that book* at its last saved position in the last-used engine — not the app home screen. Needs an intent-extra so `app.js` can detect "cold start from widget with fileId X" and route straight to the reader.
- [ ] Widget styling per §16. New i18n keys both languages.
- [ ] Android only — no iOS equivalent planned (§22).

**Files:** NEW `FlowReadWidgetProvider.java` · NEW `www/js/features/widget-bridge.js` · `www/js/storage.js` (`savePosition` hook) · `www/js/app.js` (cold-start routing) · `AndroidManifest.xml` · new widget layout XML + `appwidget-provider` XML

**Done when:** The widget shows the right book, updates on position save without polling, and deep-links to the correct position from a cold start.

---

## Task 16.4 — Free-books catalogue growth + monthly curated drops

**Status:** **Q4 resolved 2026-11-03. Phases A and B done; C and D open.** · **Ref:** §4, §13, §13.2 ·
**Size:** M

**Why:** The drops are the recurring value that justifies the subscription tier existing at all
(§1.3) — §4's accepted gap closes when they ship. The catalogue growth (Phase B) is separate and
is for *free* users.

### The constraint that shapes the whole task

§4 grants the free tier the **full catalog**. So the 3 monthly books **can never be 3 of the
bundled 88 moved behind the paywall** — that takes books away from free users, which is the one
thing §4's "genuinely generous" clause rules out. **A drop is net-new content.** Catalogue growth
and drops are therefore two different jobs with different audiences, different sources and
different files, and must not be merged:

| | Phase B — catalogue growth | Phase D — monthly drops |
|---|---|---|
| Audience | everyone, free, forever | subscribers only |
| Source | gutenberg.org links, **not re-hosted** | owner-authored, WP-hosted files |
| Lives in | bundled `www/data/free-books.json` | remote `catalog.json` |
| Cadence | one-time batches | 3/month, rotating |

### Q4's answers (owner, 2026-11-03)

- **3 books per month**, rotating, not cumulative.
- **`catalog.json` lives on a public GitHub repo**, hand-edited, read over its raw URL. **Book
  files (`.txt`/`.pdf`) go in the WP media library** — WordPress rejects `.json` uploads but takes
  `.txt` and `.pdf` without complaint, so each tool does the thing it is good at. Workflow:
  upload book to WP → copy the media URL → paste it into the JSON on GitHub. **No app release for
  a monthly drop, ever** — that was the owner's requirement and it is what the design is for.
- **The existing 23 off-site books do not move.** The self-hosting phase in
  `screenshots-and-books-plan.md` is cancelled — not to be confused with Phase B below, which is
  the Gutenberg batch and reuses the letter.
- **No per-book provenance field**, anywhere (§13.2 records the cost).

**`CapacitorHttp` is enabled in `capacitor.config.json`**, which routes `fetch` through native and
bypasses CORS entirely. That is why the Gutenberg downloads work today, and it means **the GitHub
raw URL needs no CORS header**. This was the one thing that could have made the hand-edited-JSON
plan impossible. Verified 2026-11-03.

### Phases

**A — Foundations. ✅ done 2026-11-03.**
- [x] `Claude.md` §13.2 written (see the resolved finding above).
- [x] The 6 missing category labels fixed — `poetry`, `history_politics`, `science_fiction`,
      `drama`, `essays`, `strategy` rendered as **raw slugs** on the filter chips in both
      languages, because `_categoryLabel()` mapped 6 of the catalogue's 12 categories. Had to land
      before Phase B, which adds more categories and so more slugs.
- ~~Add `provenance`/`drop` fields to the 88~~ — **dropped (owner):** the bundled 88 are fixed
  links to other people's servers and nothing about them is changing. Retrofitting a field onto
  data that does not need it.
- ~~Make `_loadCatalog()` merge-capable~~ — **moved to Phase C**, where it belongs; it was one
  change split into two for no reason.

**B — Gutenberg batch (free users, ships alone, no backend). ✅ done 2026-11-16.**
- [x] One-time script — `scripts/build-gutenberg-batch.mjs`, **force-added**, since `.gitignore`
      ignores `scripts/` wholesale. **Source is Gutenberg's own `pg_catalog.csv.gz` feed, not
      Gutendex**, which this task named: gutendex.com resolves to Cloudflare but times out, so it
      is not a dependency worth having when the publisher serves the same data directly. §13.2
      position is unchanged — public domain, linked and not re-hosted.
- [x] **88 → 150, curated.** The 62 titles are **hand-written in the script** as
      title/author/category/slug; it resolves, verifies and measures them but never picks a book.
      Weighted to fill the thin genres rather than chase popularity, per the owner's "healthy
      combination of each genre": **science_fiction 2→12, drama 1→8, essays 1→7, strategy 1→5,
      biography_history 4→10, constitution_law 2→4**, against only **+3 classics** on an existing
      38. Indian titles added wherever a genre had one (Tagore's *The Post Office*, Naidu's *The
      Golden Threshold*, the *Bhagavad-Gita* as *The Song Celestial*).
- [x] **UTF-8 verified at build time** with a `fatal: true` decoder, per book, against the exact
      URL that ships. All 62 pass.
- [x] No new categories, so no new i18n keys — the batch deliberately uses only the existing 12,
      all of which have `_categoryLabel()` entries and en/hi keys (re-checked).

**Three things the batch had to be taught, each of which had produced a wrong entry:**
- **Prefer a "— Complete" edition.** Gutenberg splits long works into numbered volumes that sort
  *before* the collected edition, so lowest-id handed the reader volume 1 of Montaigne's 19 and
  called it his *Essays*. Where no complete edition exists (Tocqueville is two volumes and
  nothing else) the volume is kept and **the title says so** — *Democracy in America — Volume 1*,
  §1.5.
- **The feed's author field is cataloguing apparatus**, not a name: `H. G. (Herbert George)
  Wells`, `552 BCE-480 BCE Confucius`, and *The Narrative of Sojourner Truth* credited to its
  amanuensis. Dates (BCE forms included) and expanded initials are stripped, and a per-book
  override exists for the rest.
- **Titles carry subtitles** after a colon, a semicolon or a line break. Cut, because a card has
  one line — but a `— Volume N` tail is kept deliberately: that is not decoration.

**Verified:** 150 entries, no duplicate `id` or `sourceUrl`, all 62 cover URLs return 200, and
every one of the 127 `txt` entries (the new and the original 65) carries a header marker
`_stripGutenberg()` actually matches — its regex allows `THE PROJECT GUTENBERG` but not `THIS`,
which older texts use. **Not yet exercised in the app** — the library view has not been opened
against the grown file on device or in a browser.

**C — Remote catalogue.**
- [ ] `_loadCatalog()` reads bundled + remote, dedupes on `id`, remote wins. The bundled file stays
      in the app **forever as the offline floor** (§1.1) — a fresh install with no internet still
      has a library. The remote file only ever *adds*.
- [ ] **Cache-bust the request** (`?v=<timestamp>`). Without it an edit is invisible for hours and
      "I updated it and nothing happened" becomes a monthly frustration. `raw.githubusercontent`
      serves a ~5-minute cache, which is tolerable; WP's was not.
- [ ] **Fail silently to the bundled 88** on any error — invalid JSON, no network, timeout. A
      hand-edited file breaks on one trailing comma, and the user must never see an empty library.
      Trade-off to accept knowingly: the owner gets no feedback that their edit was malformed.
      A small local HTML form that emits valid JSON was offered and not taken up; revisit if
      hand-editing proves error-prone.
- [ ] **Privacy policy gains a line** — a catalogue fetch is a new network request, and the GitHub
      /WP servers see IPs. §1.1 needs the exception recorded too.

**D — Monthly drops.**
- [ ] `drops` is a **flat array of 3 ids** in `catalog.json` — no month keys. The owner edits it to
      this month's three; the app shows whatever is in it. A calendar in the file would be a
      calendar the owner has to maintain.
- [ ] **Never delete an entry from `books[]`** — only ever edit `drops`. A book that vanishes while
      someone has it downloaded leaves the id-lookup paths with nothing to resolve. The file grows
      3/month; 36 a year is nothing.
- [ ] Gate on `AppState.isSubscriber` (16.1), **not** `isPro` — the drops are the one thing §4
      makes subscription-only, and `isPro` is now true for lifetime owners too (see the 2026-11-01
      decision).
- [ ] **Rotation controls visibility, never a downloaded file.** A subscriber who downloads
      December's book keeps it in January and forever; rotation only stops showing the card.
      Deleting it would be indefensible. Same for a **lapsed subscription** — keeps what was
      downloaded, loses future drops. The paywall copy must say so.
- [ ] **Non-subscribers see drop cards locked, not hidden**, with a Plus badge that opens the
      paywall. Hidden means nobody learns the subscription has recurring value, which is §4's
      month-two cancellation problem restated.
- [ ] New i18n keys both languages.

### UI placement — decided 2026-11-03, needs owner confirmation on one half

- **A "This month" shelf pinned to the top of the Free Books section** is the canonical home for
  drops. Always present, above the language tabs.
- **On home, a card only when the `drops` list has changed, only for subscribers, dismissing
  itself once tapped.** Not a standing card: 16.9 deliberately reordered home to put in-progress
  books first, and a permanent card pushes reading back down.
- **Free users get no home card.** A monthly home-screen card advertising something they cannot
  have is an upsell on the main screen — close enough to §4's rejected "in-app advertising" and
  §1.3's dark-pattern line that the locked shelf inside the library is the honest version. A user
  who opened the library is already looking for books. ⚠️ **Owner has not confirmed this half.**

### ✅ Resolved finding — a Gutenberg outage took most of the library with it

**Found on device 2026-11-16, hours after Phase B landed:** no Gutenberg cover rendered anywhere
in the library, and downloads failed with *"Check your connection and try again."* Neither was
caused by the batch. **`www.gutenberg.org` was returning a site-wide `503` maintenance page**,
while Gutenberg's own mirrors answered `200` from the same machine at the same moment. The
pre-existing 65 Gutenberg books were just as broken as the 62 new ones; the only covers still
showing were the 23 off-site entries, which is exactly the split that was reported.

**Phase B made an existing concentration worse and that is the real finding** — the catalogue went
from 65 of 88 on one host (74%) to **127 of 150 (85%)**. An outage there is not a degraded
library, it is most of the free product at once, on an app whose free catalogue is its main draw.

**Two fixes, built and device-verified the same day (owner: "mirror retry will be automatic"):**

- **Automatic mirror retry.** Any failed request to `www.gutenberg.org` is retried against
  **`gutenberg.pglaf.org`**, official PG infrastructure serving the identical `/cache/epub` tree
  over https. Four other public mirrors were probed and **404 on these paths** — they carry only
  `/files`, so there is exactly one usable fallback, not a list. A session latch (`_pgDown`, set
  by the first failure, **never persisted**) then puts the mirror first, so a grid of 127 covers
  does not each wait for its own 503; the latch dies with the session, which is how the app
  discovers maintenance has ended. The mirror is slower, so this restores the library — it does
  not make a 2 MB download quick.
- **Covers needed their own hop.** An `<img>` never goes through `fetch()`, so it cannot use
  `_fetchBook()`; the `onerror` handler swaps to the mirror once, sets the latch, and only then
  falls back to the initials placeholder. Covers are also what fail *first*, on opening the
  library, long before anyone taps Download.

**`sourceUrl` was deliberately not rewritten.** Pointing the 127 entries at the mirror would have
been the obvious fix and would have orphaned the saved position of every reader who already had
one — `generateFileId()` hashes the URL, so a book's identity *is* its location (the trap logged
2026-11-03). **Only the fetch moves; what is stored stays what shipped.**

**The error copy was misdiagnosing** (§1.5). `_fetchBook()` now throws with a `reason`, so a server
that answered badly and a connection that never answered no longer share one string: the new
`freebooks.error.download_server` says the book's server is not responding **and that it is not
the user's connection**. Telling someone to check a working connection sends them to fix the wrong
thing. Only a fetch sets `reason` — the four parse/OCR call sites keep the generic message.
en/hi **612 keys, parity verified**; the **Hindi is drafted, not signed off** (§17), same standing
as the 16.1/16.3/16.11 strings.

**Device-verified 2026-11-16** against the live outage, which is the only honest way to test this:
covers load, a 2.1 MB download of *The Wealth of Nations* completes. **Worth re-testing once
Gutenberg is back**, since the healthy path — main host answers first, mirror never touched — has
not been exercised since the fix.

---

**Files:** `www/data/free-books.json` · `www/js/views/free-books.js` · `www/i18n/*.json` ·
`privacy_policy.html` (Phase C) · NEW build script for Phase B (not shipped in the app)

---

## Task 16.5 — Opt-in leaderboard & badges

**Status:** Blocked — **Q5 blocks start** · **Ref:** §14 · **Size:** L
Lowest priority in Block C — needs backend work beyond the anonymous pings.

**Steps**
- [ ] **Resolve Q5 first** — a leaderboard needs opt-in, user-chosen-name records, which anonymous counts cannot provide. Reuse the Cloudflare Worker with a new endpoint, or build something more structured?
- [ ] **Opt-in only, never default-shown.** Monthly reset, no permanent ranking (§14).
- [ ] Free users can view and participate; **badges are subscriber-exclusive** (§4).
- [ ] Start with 1–2 badge types tied to the book drops (16.4). Expand only if usage data supports it.
- [ ] Explicitly rejected — do not build: default-visible leaderboards, permanent rankings, competitive-pressure framing, mascot/persona leveling (§14).
- [ ] New i18n keys both languages.

**Files:** NEW `www/js/features/leaderboard.js` · `www/js/views/dashboard.js` · `www/i18n/*.json` · backend (TBD per Q5)

---

## Task 16.10 — Store listing rewrite onto the habit framing

**Status:** **English copy drafted 2026-11-02** in **[store_listing.md](store_listing.md)** —
title, short and full descriptions, all three measured against Play's hard limits (28/30, 71/80,
**3960/4000**). Hindi and screenshots outstanding. · **Ref:** §0.1, §19, §18 · **Size:** S —
Play Console config, **no app code**

**Wider than the India CSL this task was originally scoped as**: this is now the main listing,
because the pivot changed what the app *is*, not just how it is pitched in one region.

**Three things in the draft that are decisions, not wording:**
- **No prices in the copy.** Play shows them per region and the lifetime price is expected to rise
  to ₹4,999 (§4) — hardcoding it buys a listing edit later.
- **The escape hatch is in the third paragraph, not the fine print.** Burying it would attract the
  users who want a hard blocker, who then leave one-star reviews on discovering it is not one
  (§9.1).
- **"No analytics" is claimed nowhere.** It was in the old privacy policy and stopped being true.

**The book-drops line was cut, 2026-11-02 (owner).** The draft had sold monthly curated drops as
a Plus feature while **16.4 is not built**. In the app §4 records that gap as accepted; in a
listing it is a promise made to someone *before* they pay, which is a different thing. **Put it
back when 16.4 ships, not before.** Full description now 3891/4000.

**Outstanding**
- [x] Data safety re-filed as **Optional**, 2026-11-02.
- [~] Hindi title / short / full — **"okay for now" (owner, 2026-11-02)**, same standing as Q10:
      the English listing can go live, and owner-written Hindi may replace the drafts later. The
      India CSL leads with the habit framing, **not** a translation of the Phase 15 speed-reading
      drafts (§18).
- [ ] **Screenshots — 8 planned, captioned, in `store_listing.md`.** Play requires a minimum of 2
      and allows 8; eight is conversion surface, not a gate, which is why it does **not** block
      promotion. Capture from **1.5.4+** — taglines, the onboarding permission screen and the
      whole Settings surface changed after 1.5.2. The first three carry the pivot alone, since
      Play shows roughly three in search results: the nudge *with its escape hatch visible*, the
      book catalogue, then the reader.
- [ ] **Feature graphic, 1024×500** — required, and the thing listings actually get rejected for.

**Steps**
- [ ] Rewrite the CSL copy to lead with the **habit/nudge** angle. The Phase 15 drafts were written under the speed-reading identity, which underperformed with a real test audience — **do not treat old drafts as final** (§18).
- [ ] Capture the two missing screenshots: Free Books catalog, Page mode.
- [ ] Hindi copy from the product owner (§17).

**Blocked on:** ideally ships after 16.2/16.3 so the screenshots show the actual pivoted product.

---

# Block D — Housekeeping (cheap, unblocked, no dependency on Block A)

## Task H1 — Verify §13.3 html-fileType issue is closed

**Status:** ✅ Closed.

The catalog holds only `pdf` and `txt`. See `Claude.md` §13.3.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Task H4 — Pro purchase fails with a generic error ✅ DONE

**Status:** ✅ Fixed and verified on a Play build (1.4.7 / 34, 2026-09-20).

The revenue blocker is closed. Root defect was the error taxonomy: every non-OK `BillingResponseCode` collapsed into one string, so a customer who *owned* Pro was told their purchase failed. The taxonomy it introduced is what 16.1 builds on.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Task H3 — Notifications fail silently when exact-alarm permission is denied

**Status:** ✅ Fixed, shipped in 1.4.7, scheduling confirmed on device.

**The load-bearing correction:** the original diagnosis was wrong — Capacitor 8's LocalNotifications plugin already degrades exact → inexact by itself, so `SCHEDULE_EXACT_ALARM` was removed rather than requested. Two denial-path checks remain unexercised.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Task H2 — Correct stale facts in `Claude.md`

**Status:** ✅ Done.

Stale facts corrected in `Claude.md`.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---

## Summary

| Block | Tasks | State |
|---|---|---|
| **A — Compliance** | ✅ 16.0a, ✅ 16.0b, ✅ 16.1 (code complete) | Shipped as 1.4.5 / versionCode 32, published 2026-09-16. **16.1 went code complete 2026-11-01** once Q1 settled; it is not on a build yet and wants a license-tester device run. |
| **B — Pivot core** | ✅ 16.2 (shipped to Internal testing), ✅ 16.3 (code complete 2026-11-01) | **16.2 is on Internal testing as 1.4.8 / 36 (2026-10-13)** — both hard gates cleared, declaration submitted, privacy policy live. N22–N28 moved the threshold onto the current sitting and made the nudge fire *during* one; N29 closed a disclosure gap the declaration form surfaced. Before that: N1–N16 over four device rounds. **Device checklist run and passed on device 2026-11-02** against 1.5.3 / 41 with R8 active — all sixteen items, battery included. **Remaining: production promotion only.** **16.3 is code complete 2026-11-01** — designed then built, Q3 answered inline, onboarding extracted into its own view file. |
| **C — Features** | ✅ 16.9, ✅ 16.7, ✅ 16.6 (shipped to Internal testing) · 16.8, 16.4, 16.5, 16.10 open | 16.9 and 16.7 verified in 1.4.7 (2026-09-20); 16.7's copy still needs Q6 sign-off. **16.6 is on Internal testing in 1.4.8** — N25 added covers and extension-free titles. Outstanding: the native share path and the PDF page-one cover on a real device, plus Q10 copy. **Q4 is resolved (2026-11-03) and 16.4 Phase A has shipped**; 16.5 still needs Q5. **16.10 is now the active product task** — the store listing is being rewritten onto the habit framing, which is wider than the India CSL this task was originally scoped as. |
| **D — Housekeeping** | ✅ H1, ✅ H2, ✅ **H4** · H3 substantially done | **H4 verified on a Play build 2026-09-20 — the revenue blocker is closed.** H3's fix is live and scheduling works; only the two denial-path checks remain. |

**Merged to `master` as `33ed6d1` on 2026-09-20.** H4, H3, 16.9 and 16.7 all shipped in 1.4.7 (versionCode 34) and verified on a Play-distributed build. The revenue blocker is closed.

**Before promoting 1.4.7 to production:** fold in the committed `iap.toast.billing_unavailable` copy fix (not yet in a bundle), and ideally run the two cheap H3 denial-path checks plus the silent-cancel case. None are blockers — as it stands the release is a strict improvement on 1.4.5.

**Done 2026-09-25: Task 16.6 — Share stats.** Code complete; Q10 accepted as-is, Q11 answered yes
and `stats_shared` implemented. Only the device test remains. The "time reclaimed" note below was
honoured — the card's supporting lines are a flat array, so adding it later costs one entry and
no redraw.

**Decided next 2026-09-25: Task 16.8 — Home screen widget.**

Why it, now that Q3 has been answered:
- **16.3 (Onboarding) is deliberately not next.** Q3 resolved *by scoping onboarding as its own
  design task* — the narrative gets designed before it gets built. That design is product work
  and does not need to block engineering in the meantime.
- **16.8 is the only substantial item with nothing in front of it.** Q7 (classic
  `AppWidgetProvider` vs Jetpack Glance) is a finish-gate, not a start-gate, and `Claude.md` §12
  already defaults to classic.
- **It compounds with what just shipped.** 16.9 put in-progress books at the top of home and 16.6
  made progress shareable; a widget puts the current book one tap from the launcher. All three
  attack the same friction — the distance between wanting to read and reading.
- **16.1 is code complete** (2026-11-01) and wants a device run, not more design; **16.4 is unblocked and moving — Phase B next**; 16.5 stays on Q5; 16.10 wants 16.3's screenshots.

**Worth noting:** three features — 16.2, 16.6 and the H4 copy fix — are now sitting on `master`
unreleased, and 1.4.7 is still on Internal testing. 16.2 additionally cannot ship at all until the
Play Console Accessibility declaration and the privacy-policy update are done. The engineering
queue is getting further ahead of the release queue with each task.

**Still owed on 16.2, for the product owner — all deferred to the release pass (2026-09-25):**
- **The 11-point device checklist**, in particular items 5, 6, 9, 10 and 11, which have never been
  exercised against a single build.
- **Play Console Accessibility API declaration** and the **privacy-policy update**. Both are hard
  release gates — a build carrying the accessibility service is rejected without the declaration.
  Owner-owned and to be actioned when the release is prepared, not before.
- ~~Q9 copy sign-off~~ — **done 2026-09-25.**
- **16.3 (Onboarding)** — unblocked, and now scoped design-first: the flow gets designed (Q3
  included) before it gets built. Product work, not currently blocking engineering.
- **16.6 (Share stats)** — ✅ built 2026-09-25, Q10 and Q11 both answered. Owes only a **device
  test** of the native `Filesystem` → `Share` path.
- **16.1 (Subscription IAP)** — ✅ code complete 2026-11-01. H4's error taxonomy carried straight over, and two new codes joined it (`OFFER_NOT_LOADED` for an inactive base plan, plus per-type query errors). Remaining: the device checklist in 16.1, Hindi sign-off, privacy-policy and store copy for a subscription product.

---

## H4 device verification — steps *(completed 2026-09-20; kept as the procedure for future billing work)*

**Status:** ✅ Completed 2026-09-20.

Kept as the procedure to reuse for 16.1's billing device run.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

---
