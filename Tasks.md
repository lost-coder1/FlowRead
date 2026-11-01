# FlowRead — Phase 16 Task Board

> Working document. `Claude.md` is the contract; this file is how we execute it.
> Every task references its governing `Claude.md` section. If the two disagree, `Claude.md` wins — and `Claude.md` gets updated *before* we change direction, not after.

**Layout:** this file is the **live board** — what is open, what it is waiting on, and every
decision taken. Completed work and resolved device findings live in
**[Tasks-archive.md](Tasks-archive.md)**. The split rule: anything that would change a future
decision stays here or in `Claude.md`; a record of an action already taken goes to the archive.

**Last updated:** 2026-11-02 — **1.5.2 / versionCode 40** built, carrying **16.1 (subscription
IAP)** and **16.3 (onboarding redesign)**. A subscription purchase completed on a clean
license-tester account; onboarding's O1 (a dead *Browse books* button, caused by awaiting a
notification promise that never settled) is fixed. Taglines across splash, home and onboarding
now read *"Read more. Scroll less."* — the launch screen was still selling the pre-pivot speed
reader. Usage access is now offered as an explicitly optional row on onboarding's permission
screen, because `triggers()` defaults to the threshold and without that grant §9.3a's timed
check cannot run at all, so a new user was landing in the degraded mode unasked.

**The three things between here and production, none of them engineering:**
1. The **16.2 device checklist** (items 1–16) has still never been run end to end — deferred
   four times. 1.5.x is also the first build where **R8 actually runs on a device**.
2. **Privacy policy and store listing** must describe a subscription and the habit framing
   (Task 16.10). Hard gate on selling `flowread_plus`.
3. **Production promotion.** Production is still on **1.4.5 / 32** — builds 33, 34, 36, 37, 38,
   39 and 40 have never left Internal testing, which includes the entire pivot.

Next engineering task: **16.8 (home screen widget)**. Next product task: **16.10**.
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
| 2026-09-16 | **Strict `Claude.md` order** — compliance block fully verified on a real device before any feature work starts. No parallel nudge development. | §3.3 sequencing. Avoids re-testing feature work against a shifting toolchain. |

---

## Open questions — product owner

Each is tagged with whether it blocks *starting* the task or only *finishing* it.

| # | Question | Blocks | Start/Finish | Ref |
|---|---|---|---|---|
| ~~Q1~~ | ~~Subscription price (monthly / annual)~~ | — | **Resolved 2026-10-30: ₹149/mo, ₹999/yr as `flowread_plus`; lifetime `pro_lifetime` repriced to ₹2,999 and widened to include OCR; `ocr_vision` retired from sale but honoured forever.** See 16.1. | §4 |
| ~~Q2~~ | ~~Nudge default thresholds~~ | — | **Resolved 2026-09-20: 15 min / 2 pages, both settings** | §9.2, §9.3 |
| ~~Q3~~ | ~~Is the nudge permission ask inline in onboarding or deferred?~~ | — | **Resolved 2026-11-01: inline**, and placed *after* the user names an app so the ask is concrete. Skippable throughout; N4's home card stays as the second chance for skippers. See Task 16.3. | §10.2 |
| Q4 | Monthly book-drop count, and bundled vs. remote-fetched catalog | 16.4 | **Start** | §4, §13 |
| Q5 | Leaderboard backend — reuse the analytics Worker with a new endpoint, or something more structured? | 16.5 | **Start** | §14 |
| Q6 | Exact copy/tone for the offline-triggered notification | 16.7 | Finish | §11 |
| Q7 | Widget: classic `AppWidgetProvider` vs. Jetpack Glance | 16.8 | Finish — default to classic, evaluate briefly first | §12 |
| ~~Q8~~ | ~~Is `AccessibilityService` escalation ever pursued?~~ | — | **Resolved 2026-09-20: yes, signed off. `UsageStatsManager` cannot do it without a permanent notification** | §9.4a |
| ~~Q9~~ | ~~Nudge screen copy/tone sign-off~~ | — | **Signed off 2026-09-25.** | §19 |
| ~~Q10~~ | ~~Share card / sheet / milestone copy + Hindi sign-off~~ | — | **Accepted as-is 2026-09-25 ("okay for now").** Owner-written Hindi may still replace the current Hinglish-register draft later; not a blocker. | §15 |
| ~~Q12~~ | ~~Should the one-app limit stand while the subscription does not exist?~~ | — | **Resolved 2026-09-25: (b) — `FREE_APP_LIMIT` temporarily raised to 2.** ✅ **Restored to 1 by Task 16.1 on 2026-11-01**, with the truncation now surfaced rather than silent. | §4, §9.7 |
| ~~Q11~~ | ~~Should sharing emit an analytics event?~~ | — | **Resolved 2026-09-25: yes.** `stats_shared` added to the `analytics-ping.js` allowlist, carrying the entry point only (`home` / `dashboard` / `milestone`) — never the book, the stat, or the app shared to. Inert until the Worker endpoint exists. | §9.6, §15 |

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
- [ ] Privacy policy + store copy describing a **subscription** product. Hard gate on production.

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
**Still open:** the end-to-end device checklist (items 1–16) was **deliberately deferred** to the
Internal testing period rather than run before upload (owner's call, 2026-10-06) — so the field
fixes are confirmed only by use, not by the checklist. Production promotion is also still open.
Q2/Q8 resolved · **Ref:** §9, §9.3a, §9.4a, §1.6 · **Size:** XL — largest single feature in Phase 16

**Why:** The core mechanic of the pivot (§0.1). Redirects time in distracting apps toward reading.

**🚨 Non-negotiable:** Every nudge screen shows a one-tap "Continue to [App] anyway", always visible, never behind a timer or a second tap. §21 calls this a product/legal rule, not a style preference — no future task overrides it without a logged product-owner decision.

*Full history in [Tasks-archive.md](Tasks-archive.md).*

### Still open before this ships

- [~] Device verification at API 36 — **four rounds run, 2026-09-21 to 2026-09-25.** Detection,
      the nudge screen, the escape hatch, the unlock prompt and the scoped return are all
      confirmed working on hardware. Each round surfaced the next layer of behaviour, which is
      what N1–N16 are.
- [x] **Fix N1–N16** — all sixteen done, 2026-09-21 to 2026-09-25. `:app:compileDebugJavaWithJavac`
      and `assembleDebug` clean, JS syntax clean, en/hi **532 keys each, full parity**.
- [x] **Fix N22–N24, N26–N28** — field round 2026-10-06. `assembleDebug` clean, JS syntax clean,
      en/hi **566 keys each, full parity**. **Not device-verified** — checklist items 12–16.
- [ ] **Run the full device checklist (items 1–16).** Still outstanding, and now deferred twice:
      first to the release test pass (2026-09-25), then past the upload itself (2026-10-06,
      "testing later"). 1.4.8 went to Internal testing without it. Never exercised end to end:
      scoped unlock with two targets (5), cold start (6), **battery (9)**, Hindi (10), the
      Page-mode regression (11), and all of 12–16 from the field round.
      **Item 9 is the one with no data behind it at all** — the timed in-session check is new, and
      a Handler waking every ≤10 minutes to run a 6-hour `queryEvents` is the kind of thing Play
      vitals notices before a developer does. Internal testing is the cheapest place to find out.
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
- [x] **Privacy policy — live 2026-10-13.** Covers the accessibility service (what it sees, what
      it structurally cannot see, that the app list is user-chosen, that nothing leaves the
      device), optional usage access, and the anonymous pings (§9.6) including `stats_shared`.
      The pings are described although they are inert in this build, so the policy does not need
      re-issuing when the Worker endpoint goes live — but Data safety **does**, and that is the
      trigger for it.
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

## Task 16.8 — Home screen widget (Android only)

**Status:** Not started — unblocked; Q7 needed to finish · **Ref:** §12 · **Size:** L

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

## Task 16.4 — Monthly curated book drops

**Status:** Blocked — **Q4 blocks start** · **Ref:** §4, §13 · **Size:** M

**Why:** The recurring value that justifies the subscription tier existing at all (§1.3).

**Steps**
- [ ] **Resolve Q4 first** — drop count (5/month is a placeholder) and bundled vs. remote-fetched catalog. The mechanism choice determines the whole implementation.
- [ ] Extend `www/data/free-books.json` and `views/free-books.js` with a rotation mechanism. Rotating, **not cumulative** (§4).
- [ ] Gate on `isSubscriber` (16.1).
- [ ] **Legal sources only.** Z-Library or any non-legal sourcing is non-negotiable and out (§4, §13.2). Ask before sourcing from anything not already verified.
- [ ] New i18n keys both languages.

**Files:** `www/data/free-books.json` · `www/js/views/free-books.js` · `www/i18n/*.json`

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

## Task 16.10 — India Custom Store Listing (messaging revision)

**Status:** Not started — unblocked · **Ref:** §19, §18 · **Size:** S — Play Console config, **no app code**

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
| **B — Pivot core** | ✅ 16.2 (shipped to Internal testing), ✅ 16.3 (code complete 2026-11-01) | **16.2 is on Internal testing as 1.4.8 / 36 (2026-10-13)** — both hard gates cleared, declaration submitted, privacy policy live. N22–N28 moved the threshold onto the current sitting and made the nudge fire *during* one; N29 closed a disclosure gap the declaration form surfaced. Before that: N1–N16 over four device rounds. **Remaining: the device checklist (never run) and production promotion.** **16.3 is code complete 2026-11-01** — designed then built, Q3 answered inline, onboarding extracted into its own view file. |
| **C — Features** | ✅ 16.9, ✅ 16.7, ✅ 16.6 (shipped to Internal testing) · 16.8, 16.4, 16.5, 16.10 open | 16.9 and 16.7 verified in 1.4.7 (2026-09-20); 16.7's copy still needs Q6 sign-off. **16.6 is on Internal testing in 1.4.8** — N25 added covers and extension-free titles. Outstanding: the native share path and the PDF page-one cover on a real device, plus Q10 copy. 16.4/16.5 still need Q4/Q5. **16.10 is now the active product task** — the store listing is being rewritten onto the habit framing, which is wider than the India CSL this task was originally scoped as. |
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
- **16.1 is code complete** (2026-11-01) and wants a device run, not more design; 16.4/16.5 stay on Q4/Q5; 16.10 wants 16.3's screenshots.

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
