# FlowRead — Phase 16 Task Board

> Working document. `Claude.md` is the contract; this file is how we execute it.
> Every task references its governing `Claude.md` section. If the two disagree, `Claude.md` wins — and `Claude.md` gets updated *before* we change direction, not after.

**Last updated:** 2026-10-13 — **1.4.8 / versionCode 36 is on Internal testing.** The first build
to carry the pivot mechanic (16.2) and the share card (16.6), and the first to ship an
`AccessibilityService` at all. **Both hard release gates are cleared:** the Play accessibility
declaration is submitted with its disclosure video, and the privacy policy is live. Filling in
that declaration is what found **N29** — the disclosure guarded one route to the grant and not the
other two, invisible to anyone who had already used the app. **Still open: the device checklist
(items 1–16) has never been run, and production promotion.** Production remains on 1.4.5 / 32.
Next engineering task is **16.8 (home screen widget)**; next product task is the store-listing
rewrite onto the habit framing.

Previously, 2026-10-06 — **Field round after several weeks of real use: N22–N28, all
fixed in the working tree, none device-verified.** The nudge now fires *during* a session rather
than reporting on the last one (N22, `Claude.md` §9.3a), reading pays the clock back and refunds a
nudge (N23), a suppression survives midnight (N24), and the share card carries the book's cover
and its extension-free title (N25). **The threshold now counts the current sitting rather than the
whole day (N26)** — the change that stops "you have been on Reddit for 120 minutes" greeting
someone who just pressed Reset, and that makes the two trigger toggles orthogonal — and an open no
longer loses its short grace to the threshold's long one (N27). Checklist items 12–16 are new and
cover all of it.
Previously, 2026-09-25 — **Fifth device round: N17–N20 found, three fixed, N18 needs a device check.** Checklist items 6/9/10 pass; **item 5 is unblocked (Q12 → limit temporarily 2) and awaiting a re-run**; item 11 half-passes (Page mode fine, notifications are N18). **Q9, Q10, Q11 and Q3 all answered; next task is 16.8 (Home screen widget)** once this round is closed. **Task 16.6 (Share stats) code complete**, verified in headless Chrome against the real app CSS; device test still owed. **Task 16.2 code complete: N1–N16 fixed and merged to `master`.** Four device rounds took the nudge from "never renders" to working end to end. What remains on 16.2 is not code: one full checklist run, Q9 copy sign-off, the Play Accessibility declaration and the privacy policy. **Next up: Task 16.8 (Home screen widget).** Neither 16.2 nor 16.6 is in a release yet. Previously: 1.4.7 (versionCode 34) verified on Internal testing and merged to `master` (`33ed6d1`), containing H4, H3, 16.9, 16.7.
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
| Q1 | Subscription price (monthly / annual) | 16.1 | Finish — plumbing can be built first | §4 |
| ~~Q2~~ | ~~Nudge default thresholds~~ | — | **Resolved 2026-09-20: 15 min / 2 pages, both settings** | §9.2, §9.3 |
| ~~Q3~~ | ~~Is the nudge permission ask inline in onboarding or deferred?~~ | — | **Resolved 2026-09-25: neither, yet — onboarding is being designed as its own task first, and Q3 is answered inside that design.** N14's per-choice ask stands as the interim behaviour. See Task 16.3. | §10.2 |
| Q4 | Monthly book-drop count, and bundled vs. remote-fetched catalog | 16.4 | **Start** | §4, §13 |
| Q5 | Leaderboard backend — reuse the analytics Worker with a new endpoint, or something more structured? | 16.5 | **Start** | §14 |
| Q6 | Exact copy/tone for the offline-triggered notification | 16.7 | Finish | §11 |
| Q7 | Widget: classic `AppWidgetProvider` vs. Jetpack Glance | 16.8 | Finish — default to classic, evaluate briefly first | §12 |
| ~~Q8~~ | ~~Is `AccessibilityService` escalation ever pursued?~~ | — | **Resolved 2026-09-20: yes, signed off. `UsageStatsManager` cannot do it without a permanent notification** | §9.4a |
| ~~Q9~~ | ~~Nudge screen copy/tone sign-off~~ | — | **Signed off 2026-09-25.** | §19 |
| ~~Q10~~ | ~~Share card / sheet / milestone copy + Hindi sign-off~~ | — | **Accepted as-is 2026-09-25 ("okay for now").** Owner-written Hindi may still replace the current Hinglish-register draft later; not a blocker. | §15 |
| ~~Q12~~ | ~~Should the one-app limit stand while the subscription does not exist?~~ | — | **Resolved 2026-09-25: (b) — `FREE_APP_LIMIT` temporarily raised to 2.** ⚠️ **Task 16.1 must set it back to 1.** | §4, §9.7 |
| ~~Q11~~ | ~~Should sharing emit an analytics event?~~ | — | **Resolved 2026-09-25: yes.** `stats_shared` added to the `analytics-ping.js` allowlist, carrying the entry point only (`home` / `dashboard` / `milestone`) — never the book, the stat, or the app shared to. Inert until the Worker endpoint exists. | §9.6, §15 |

---

## Codebase corrections found during planning

> **HISTORICAL — describes the state *before* 1.4.5 (2026-09-16).** All of these were folded into `Claude.md` in Task H2 and the toolchain rows are now out of date by design (Capacitor is 8.5.2, AGP 8.13.0, Billing 9.1.0, compile/targetSdk 36, minSdk 24, versionCode 32). Kept as a record of what the document got wrong and why the upgrade was larger than it looked. **Do not read the versions below as current.**

- **SDK versions live in `android/variables.gradle`, not `android/app/build.gradle`** as §3.2 states. Current: `compileSdkVersion = 35`, `targetSdkVersion = 35`, `minSdkVersion = 22`.
- **Toolchain:** AGP 8.2.1, Gradle 8.2.1, Capacitor 6.2.1 across all `@capacitor/*` packages, `@capacitor-community/keep-awake` 5.0.1.
- **Billing:** `com.android.billingclient:billing:7.1.1` — confirms BL7 is the deprecated version in the Play notice.
- **Onboarding is not a separate file.** It is `renderOnboarding()` at `www/js/views/settings.js:176`, flagged by `fr_onboarding_complete` (`www/js/storage.js:82`), routed from `www/js/app.js:91`.
- **§13.3's html-fileType issue appears already resolved.** `www/data/free-books.json` holds 88 books: 23 `pdf`, 65 `txt`, **zero** `html`. `free-books.js:261` only branches txt/pdf.
- **Version drift:** actual versionCode **31**, versionName **1.4.4**. §22 records 28 / 1.4.1.
- **Not installed:** `@capacitor/network`, `@capacitor/share`. (`share-handler.js` handles *incoming* share intents only — it is not an outbound share.)

---

# Block A — Compliance ✅ shipped (16.1 still open)

The **2026-08-31** deadline had already passed when this work started, leaving the app unable to publish any update. A Play Console extension (valid to 2026-11-01) covered the gap, and 1.4.5 cleared both notices on 2026-09-16. 16.1 (Subscription IAP) remains open but gates nothing.

---

## Task 16.0a — API 36 target bump + toolchain upgrade

**Status:** ✅ Done — shipped in 1.4.5 (versionCode 32), published 2026-09-16 · **Ref:** §3.2, §3.3 · **Size:** L

**Why:** Play requires targetSdk ≥36. Our toolchain can't compile against 36, so this is a Capacitor/AGP/Gradle upgrade wearing a one-line-bump disguise.

**Steps**
- [x] Verify which Capacitor major officially supports compileSdk 36 — check Capacitor's Android release notes at implementation time. Do **not** assume a version number (§3.1 explicitly warns this project has been burned by a stale-dependency assumption before).
- [x] Upgrade all `@capacitor/*` packages (core, android, cli, app, filesystem, preferences, local-notifications, camera) to that major, together — mixed majors do not work.
- [x] Upgrade `@capacitor-community/keep-awake` 5.x to the matching major.
- [x] `npx cap sync android`, then reconcile `android/variables.gradle` against what the new Capacitor ships (it rewrites AGP/Gradle expectations).
- [x] Set `compileSdkVersion = 36` and `targetSdkVersion = 36` in `android/variables.gradle`.
- [x] Update the Gradle wrapper (`android/gradle/wrapper/gradle-wrapper.properties`, currently 8.2.1) and AGP in `android/build.gradle` (currently 8.2.1) to the versions the new Capacitor requires. Confirm the local JDK satisfies it.
- [x] Rebuild; fix compile breaks across the four native sources.
- [x] **Regression-test every native plugin on a real device** (§3.2 is emphatic about this, not just billing) — run 2026-09-16 on a Galaxy S23 FE (SM-S711B) running **Android 16 / API 36**, signed release APK, clean install:
  - [x] `FlowReadDeviceSyncPlugin` — **highest risk.** MediaStore-based, and storage policy is exactly the surface that shifts between API levels. **Works.** Note `READ_EXTERNAL_STORAGE` is correctly inapplicable at API 36 (`maxSdkVersion=32`); the API 33+ `MediaStore.Downloads` path carries it.
  - [x] `FlowReadOcrPlugin` — ML Kit Latin + Devanagari. **Works.**
  - [~] `FlowReadIapPlugin` — cannot be tested from a sideloaded APK (Play Billing is unreachable outside a Play-distributed build). Verified post-publish: **restore purchases works in production.** Paywall price rendering and a fresh purchase remain unconfirmed — see 16.0b.
  - [~] `MainActivity` — share intent verified with a Wikipedia URL. **"Open with PDF" and the hardware back button were not separately confirmed** — worth a minute each.
  - [x] Local notifications — `POST_NOTIFICATIONS` granted and `SCHEDULE_EXACT_ALARM: allow`; `dumpsys alarm` shows a real `RTC_WAKEUP` via `TimedNotificationPublisher` for 21:00. Scheduling works; **firing and reboot-persistence not yet observed.**
  - [x] All five reading engines including Page mode (previously untested per §18). **Work.**
- [ ] Confirm the two partials above: "Open with PDF" intent, hardware back button, and a notification actually firing (ideally after a reboot, to prove `RECEIVE_BOOT_COMPLETED` rescheduling).
- [ ] Re-evaluate the still-open `MANAGE_EXTERNAL_STORAGE` re-application against **API 36's** current policy, not the API 35-era understanding (§3.2, §18 Phase 14).

**Files:** `package.json` · `android/variables.gradle` · `android/build.gradle` · `android/gradle/wrapper/gradle-wrapper.properties` · `android/app/build.gradle` · `android/app/src/main/java/com/flowread/app/*.java` · `android/app/src/main/AndroidManifest.xml`

**Done when:** A signed release build installs on a real device, all four native plugins exercise clean, notifications fire, and `targetSdkVersion = 36` is live.

**Resolved versions (verified 2026-09-16, not assumed):** Capacitor **8.5.2** (9.0.0 is alpha) · AGP **8.13.0** · Gradle **8.13** · Java **21** · compileSdk/targetSdk **36** · minSdk **24** · Billing **9.1.0**.

**Build result:** `assembleDebug` and signed `assembleRelease` both succeed. `aapt2 dump badging` confirms `targetSdkVersion:'36'`, `compileSdkVersion='36'`. Every Capacitor 8 plugin compiled clean; the only source change the entire upgrade needed was the one Billing v9 signature in 16.0b.

**Environment changes made on this machine:** JDK 21 (`brew install openjdk@21`) and Node 22.23.2 (`brew install node@22`, linked ahead of the Node 18 at `/usr/local/bin/node`, which was left in place). `android/gradle.properties` was repointed to JDK 21 — it stays untracked because it holds a machine-specific path, so **any other machine or CI must set `org.gradle.java.home` itself**.

**Notes:** Expect this to surface permission-model and background-execution changes. Budget for it. Do not fold unrelated changes into this commit — a clean, revertable toolchain commit is worth a lot if something breaks in the wild.

**Latent bug found while verifying (pre-existing, not caused by the API 36 bump — see Task H3):** `notifications.js:196` schedules with `allowWhileIdle: true`, which requires `SCHEDULE_EXACT_ALARM` — denied by default for apps targeting 33+. Line 221 wraps the schedule call in `catch (_) {}`, so on a device where the user has not granted it, **notifications silently never fire and nothing surfaces the failure**. It happened to be granted on the test device, which is exactly why this class of bug survives testing.

**Android Studio note:** building from the terminal works. Android Studio overrides `org.gradle.java.home` with its own Gradle JDK setting and must be pointed at JDK 21 (Settings → Build Tools → Gradle → Gradle JDK). AGP 8.13 also requires Android Studio Narwhal 3 (2025.1.3) or newer. Capacitor 8's `capacitor-android` module sets `sourceCompatibility 21` *without* a toolchain, so Gradle must genuinely run on JDK 21 — `org.gradle.java.installations.paths` alone is not sufficient.

---

## Task 16.0b — Google Play Billing Library upgrade

**Status:** ✅ Done — shipped in 1.4.5 on Billing **9.1.0**; restore purchases verified in production · **Ref:** §3.1 · **Size:** M

**Deviation from plan:** `Claude.md` §3.1 wanted this done as one pass with 16.1 (subscription IAP). It was shipped **alone** instead, because the Aug 31 deadline had already passed and the app could not publish anything until this landed. 16.1 remains open.

**Migration now considered verified.** Restore purchases works in production, and the H4 investigation showed Play's `ProxyBillingActivity` opening — which only happens if `queryProductDetailsAsync` (the one changed API) and `launchBillingFlow` both succeeded. The purchase failure in **Task H4 is a separate, pre-existing error-handling defect, not a v9 regression.**

**Still unconfirmed:** silent `USER_CANCELED` handling (§3.1) — check while fixing H4.

**Why:** BL7 is deprecated; updates get rejected after 2026-08-31. The newer major is also what natively supports subscriptions alongside our one-time products.

**Steps**
- [x] Check the current supported Billing Library major against live Play Billing docs. **Verify, don't assume** (§3.1).
- [x] Bump `com.android.billingclient:billing` in `android/app/build.gradle` (from 7.1.1).
- [x] Fix API breaks in `FlowReadIapPlugin.java` — the query/purchase/acknowledge paths (`queryProducts`, `queryPurchases`, `acknowledgePurchaseAndResolve`, `acknowledgeQuietly`) all touch the changed surface.
- [ ] **Regression-test all existing flows** (§3.1 names these explicitly):
  - [ ] `pro_lifetime` purchase
  - [ ] `ocr_vision` purchase
  - [ ] Restore purchases
  - [ ] `USER_CANCELED` still silent — **no error toast** (long-standing shipped behavior, easy to regress)

**Files:** `android/app/build.gradle` · `android/app/src/main/java/com/flowread/app/FlowReadIapPlugin.java` · `www/js/features/purchase.js`

**Done when:** All four flows pass on a real device against the new Billing major.

---

## Task 16.1 — Subscription IAP

**Status:** Blocked (Q1 to finish) · **Ref:** §4 · **Blocked by:** 16.0b (same pass) · **Size:** M

**Why:** The subscription tier's value is recurring by nature (monthly book drops, ongoing nudge personalization) and can't honestly be sold as a one-time purchase.

**Steps**
- [ ] Create the subscription SKU in Play Console. **Price is Q1 — ask before hardcoding anything.**
- [ ] `FlowReadIapPlugin.java`: add `ProductType.SUBS` alongside the existing `ProductType.INAPP`. Subscriptions query separately from INAPP and require selecting an **offer token** at purchase time — this is the main structural difference from the existing one-time flow.
- [ ] `purchase.js`: add `hasSubscription()` and `AppState.isSubscriber`, mirroring the existing `hasProAccess()` / `AppState.isPro` pattern.
- [ ] Treat entitlements as **independent** (§4): a user may hold Lifetime Pro without a subscription, a subscription without Lifetime Pro, both, or neither. Subscription implies everything Lifetime Pro + OCR unlocks; the reverse is not true.
- [ ] Reuse the existing `showPaywall()` (`purchase.js:230`) rather than writing a second paywall.
- [ ] Gate the five subscription-exclusive items behind `isSubscriber`, not `isPro`: unlimited nudge apps (free = 1), nudge scheduling, nudge strict mode, monthly book drops, leaderboard badges.
- [ ] ⚠️ **Restore `FREE_APP_LIMIT` to 1 in `nudge-apps.js`.** It was raised to 2 on 2026-09-25 (Q12) purely because no subscription existed to lift the gate; the moment one does, §4's rule applies again. `syncToNative()` truncates an over-limit selection, so lowering it degrades existing two-app users cleanly — but check that the truncation is surfaced rather than silent (§1.5).
- [ ] Store subscription state in **Capacitor Preferences, never localStorage** (§21).
- [ ] Wire `subscription_started` / `subscription_cancelled` analytics events (§9.6) — depends on 16.2's `analytics-ping.js`; stub the calls if 16.2 hasn't landed.
- [ ] Verify the §1.3 no-dark-patterns rules hold: lifetime option still prominently offered, cancellation genuinely one tap via platform billing.

**Files:** `android/app/src/main/java/com/flowread/app/FlowReadIapPlugin.java` · `www/js/features/purchase.js` · gating call sites across `views/` · `www/i18n/en.json` + `hi.json`

**Done when:** A test account can subscribe, the five gated items unlock, lifetime and subscription entitlements resolve independently, and all 16.0b regression flows still pass.

**Guardrail:** Lifetime Pro must never be removed or degraded to push subscriptions (§1.3, §4).

---

### ✅ Block A gate — lifted for 16.0a/16.0b

The toolchain and billing upgrades are shipped and verified in production (1.4.5), so Block B and C work is no longer held behind them. **16.1 is still open** but does not gate the rest: it touches only the purchase flow, not the toolchain everything else builds on.

---

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

### What was built (2026-09-20)

Detection is an **`AccessibilityService`, not `UsageStatsManager`** — see the decisions log and `Claude.md` §9.4a. The short version: nothing can stay alive to poll `UsageStatsManager` without a foreground service, and its notification cannot be hidden.

| File | Role |
|---|---|
| `FlowReadNudgeService.java` | Accessibility service. `typeWindowStateChanged` only, `canRetrieveWindowContent="false"`, `packageNames` narrowed at runtime to the user's picks via `setServiceInfo()`. |
| `NudgeGate.java` | All trigger rules, in **Java** — the service must work when the WebView is dead. Shares `CapacitorStorage` prefs with JS so there is one source of truth. |
| `FlowReadNudgePlugin.java` | JS bridge: app list, target writes, three permission checks + settings-page launches, scoped unlock/dismiss. |
| `nudge.js` · `nudge-apps.js` · `analytics-ping.js` | Screen, picker, pings. |

**Build order** (per §19; each sub-step is independently reviewable)
- [x] **B1 — Target-app picker.** `nudge-apps.js`: list installed apps, select targets, persist to localStorage (`fr_` prefix, §21). Free = 1 app; subscriber = unlimited (gate on `isSubscriber` from 16.1).
- [x] **B2 — Detection plugin.** `FlowReadNudgePlugin.java` wrapping `UsageStatsManager`. Battery-conscious polling interval — **no tight loops** (§21). `AccessibilityService` is fallback-only and needs Q8 sign-off first.
- [x] **B3 — Trigger logic.** `nudge.js`: cumulative daily time per target app; fire only past a threshold (Q2); daily cap per app; back off for the rest of the day after 3 consecutive dismissals (§9.3).
- [x] **B4 — Nudge screen.** New `#view-nudge` in `www/index.html`. Calm, not alarming (§16). "Start reading" → **Page mode** (§5, §9.5), resuming the in-progress book, or Free Books if none — never an empty import screen.
- [x] **B5 — Scoped unlock.** Meeting the threshold unlocks **only the originally-requested app**; other targets keep their own independent thresholds (§9.7).
- [x] **B6 — Analytics.** `analytics-ping.js`: `logEvent(name, meta)`, fire-and-forget `fetch()` to a Cloudflare Worker, wrapped in try/catch, silent failure, **never blocks a user action**. No device/user ID, no filename, no reading content (§1.4, §9.6). Minimum events: `app_opened`, `nudge_shown`, `nudge_read_started`, `nudge_read_completed`, `nudge_skipped`, `free_book_downloaded`, `pro_purchased`, `subscription_started`, `subscription_cancelled`.
- [ ] Onboarding must walk the user to the correct system settings page for the Usage Stats permission — it's a special permission, not a runtime dialog (§9.4). Coordinate with 16.3.
- [x] Skipping never penalizes: no guilt copy, no broken-streak framing, no anxiety timers (§9.1, §9.2.7).
- [ ] Privacy policy updated to disclose the analytics pings (§9.6).
- [x] All strings via `t()` into `en.json` + `hi.json` from day one (§17). **499 keys each, full parity.** Hindi written in the file's existing Hinglish register — needs owner sign-off.
- [ ] **Product-owner review of nudge copy/tone before finalizing** (Q9).

**Files:** NEW `android/app/src/main/java/com/flowread/app/FlowReadNudgePlugin.java` · NEW `www/js/features/nudge.js`, `nudge-apps.js`, `analytics-ping.js` · `www/index.html` (feature scripts ~L86–94, views ~L38–56) · `www/js/views/settings.js` · `www/i18n/*.json` · `AndroidManifest.xml` (`PACKAGE_USAGE_STATS`)

**Done when:** Selecting a target app, exceeding its daily threshold, and reopening it produces a calm nudge with a working escape hatch; reading to threshold unlocks that app only; all events fire; works offline (pings fail silently).

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

### Device-test findings — 2026-09-21, Galaxy S23 FE (SM-S711B), API 36

First run on hardware. **Detection works**: opening Reddit did launch FlowRead, so the
accessibility service, `NudgeGate` and the trigger rules are all firing correctly end to end.
Everything below was downstream of that.

**All five are fixed in the working tree (2026-09-21). None is device-verified yet** — the
re-test below is the remaining work on 16.2.

---

#### N1 — The nudge screen never appears; the app just opens (blocker) ✅ fixed

**Root cause: a JSON key mismatch, not the race hypothesised below.**
`FlowReadNudgeService.launchNudge()` wrote the handoff as `{"package": …}` while
`nudge.js:_readPending()` bailed on `if (!parsed.packageName) return null;`. `package` ≠
`packageName`, so `_readPending` returned `null` on **every** path — cold start and hot
`flowreadNudge` event alike — and `_handleIncoming()` silently no-opped. The app came to the
front on whatever view it was last on, which is exactly what was observed.

*The four original leads (destructive `consumePendingNudge`, listener registered late, the 60s
staleness guard, a later `renderSettings()` clobbering the view) were all real robustness gaps
but none of them was the cause. Three are closed anyway — see below.*

**Fixed**
- [x] Service writes the payload with `org.json.JSONObject` and the key `packageName`. The old
      concat escaped only `"`, so a label containing a backslash or newline produced invalid JSON
      and the handoff vanished into a `JSON.parse` catch — the same silent nothing by a second
      route. JS accepts `packageName || package` so a handoff written by the older service still
      resolves after an update.
- [x] **Handoff is now read-render-clear, never clear-on-read.** New `peekPendingNudge` /
      `clearPendingNudge` plugin methods; `consumePendingNudge` kept only for back-compat and no
      longer called. `renderNudge()` clears only after `switchView('view-nudge')` has run, so a
      path that fails part-way through does not throw the interception away.
- [x] **Three independent pull paths, all idempotent**: cold start, the `flowreadNudge` event,
      and every foreground transition. An `_incomingInFlight` guard plus a `view-nudge` check
      stop a double render. No path has to win a race any more.
- [x] Staleness guard 60s → **120s** — comfortably longer than a cold boot (i18n, IAP, library)
      on a slow device, far too short to resurrect a previous session.
- [x] A corrupt or key-less pending value is cleared rather than re-read on every resume forever.

#### N2 — Wrong landing view when FlowRead opens ✅ fixed

One `appStateChange` listener in `app.js`, ordered explicitly: `NudgeFeature.handleResume()`
runs first and a nudge arriving on that resume always wins; only if nothing was handled does the
stale-view routing run. After **>30 min** backgrounded, a foreground onto `view-settings` /
`view-dashboard` / `view-free-books` / `view-nudge` routes to home. `view-reader` and
`view-normal` are **never** touched — position is sacred (§21) and someone returning to a book is
exactly who must not be interrupted. Home rather than the last book: 16.9 already put in-progress
books at the top of `view-upload`, so the book is one tap away without overriding the user's own
navigation.

#### N3 — Nudge copy should ask a question, with the real number in it ✅ fixed

The figures travel **in the handoff**, not via a second query. `NudgeGate.shouldNudge` became
`NudgeGate.decide`, returning a `Decision { nudge, minutes, opens }` — those are the values the
gate actually decided on, where a later `getForegroundMinutesToday()` from JS would have returned
a slightly different number for no benefit.

- `nudge.screen.title_minutes` — "You've been on {app} for {n} minutes. Read {pages} pages first?"
- `nudge.screen.title_opens` — "That's {n} opens of {app} today. Read {pages} pages first?"
  (the honest fallback when usage access is denied, §1.5)
- `nudge.screen.title` retained as last resort. **Escape hatch copy unchanged** — §9.1.

Still **Q9**: review these as one pass with the existing `nudge.screen.*` copy, plus Hindi sign-off.

#### N4 — Ask for the three permissions at first launch ✅ fixed, scoped deliberately

**Product decision 2026-09-21: one card now, the full flow deferred to 16.3.** A first-run walk
through three system settings screens would fight §9.4a, which made usage access optional to
avoid exactly that friction — and Q3 (does the nudge ask belong in onboarding at all?) is 16.3's
call to make.

A one-time dismissible card on `view-upload`, shown only when the plugin is available, no targets
are chosen and `fr_nudge_prompted` is unset. Its action reuses the **existing** Settings chain —
disclosure → app picker → accessibility → overlay — rather than growing a second permission flow.
Dismiss sets the flag and never asks again. A comment in `upload.js` points 16.3 at it.

#### N5 — Add an "on every open" trigger option ✅ fixed

`fr_nudge_trigger_mode` ∈ `threshold` | `every_open`, default `threshold`, written through the
existing `_pushSettings()` path so `NudgeGate` reads it from the shared prefs with no new
plumbing. In `every_open` the minutes/opens comparison is skipped; the debounce, `suppressUntil`,
daily cap and dismissal back-off **all still apply** — without them this is the wall §9.1 forbids.

**Product decision 2026-09-21: the daily cap slider is now visible** (`#settings-nudge-cap`, 1–10,
default 3). Otherwise "every open" would silently mean "three times", which §1.5 does not allow.
`fr_nudge_daily_cap` previously had no UI at all, so this closes a silent setting too.

---

### 🔴 Second device test — 2026-09-21, same device

Three findings from the run with N1–N5 in. **N1 is confirmed fixed** — the nudge screen renders
and carries the real figure ("you have been using Reddit for 77 min"), so the handoff, the copy
and the landing are all working.

#### N6 — Unlock progress only counted in Page mode ✅ fixed

**Reported:** took the nudge, let RSVP run for a while, nothing happened; switched to Page mode,
read 5 pages, got the return prompt.

**Correct — and a real gap.** `NudgeFeature.onPageTurn()` was called from exactly one place,
`engines/page.js:289`. Every other engine reports nothing, so a nudged read in RSVP, Chunk,
Scroll or Focus Bold could **never** reach the unlock. The user was waiting for something that
was never going to happen — §1.5.

Fixed by hooking `savePosition()` in `storage.js`, which is the one seam every engine already
goes through. New `NudgeFeature.onReadProgress(wordIndex)` converts the user's page setting to
words (`WORDS_PER_PAGE = 220`, roughly a Page-mode page on a phone) and unlocks on the same
amount of reading in any engine. Page mode keeps its exact `onPageTurn` count; a `ctx.done` guard
stops the two paths double-firing the prompt.

#### N7 — Nudge entry lands in Page mode, which is slow to open ✅ interim change

**Deviation from §9.5, logged deliberately.** §9.5 specifies Page mode on nudge entry, reasoning
that RSVP is too high-effort right after an interception. But Page mode's first paint is slow
enough that the user stares at a loading state at exactly the moment the nudge is trying to be
frictionless — which costs more than the engine choice gains.

Interim rule: land in whatever engine the user actually reads in (`resumeFromLibrary` without
`forceEngine`). **Restore the §9.5 behaviour once Page-mode load time is addressed** — worth its
own task; Page mode paginates by DOM measurement and caches per file/font/viewport, so the cost
is the first paint on a cold cache.

#### N9 — Triggers were either/or; should be independent ✅ fixed

The two triggers are now separate toggles — either, both, or neither —  stored as a
comma-separated list in `fr_nudge_trigger_mode` (a legacy single value still parses). `NudgeGate`
ORs whichever are on. With both on the note says plainly that "every open" already covers the
time threshold, rather than leaving the user to work that out.

#### N10 — Three skips silently silence an app for the whole day ✅ surfaced + resettable

**This is the likely reason "every open" kept doing nothing.** Every tap of "Continue to
[App] anyway" counts a dismissal *and* suppresses the app for 10 minutes. At three dismissals the
back-off (§9.3) stops that app for the **rest of the day — regardless of the daily cap**, which
is why raising the cap to 10 changed nothing. A day of device testing hits this within minutes,
and nothing on screen said so: a §1.5 violation in its own right, testing aside.

- `NudgeGate.statusFor()` + `getNudgeStatus` expose what the gate thinks: nudges used vs cap,
  dismissals vs back-off, minutes in the app, and any live suppression.
- Settings now renders it in plain language under the nudge controls — "Reddit: 2 of 10 nudges,
  3 skipped. You skipped enough of them that FlowRead has stopped asking until tomorrow."
- A **Reset** button clears today's counters for the selected apps (`resetNudgeState`), which is
  both the testing escape hatch and the honest answer for a real user who wants to start again.

#### N11 — "Every open" could never fire twice; wrong question in its copy ✅ fixed

Third device run. Reset worked and the nudge fired on opening Reddit — but closing and
reopening produced nothing, and the counters did not move.

**Two suppressions were making the mode structurally incapable of doing what it is named.**

1. Raising a nudge set a **60-second grace** (`NUDGE_SHOWN_GRACE_MS`) — so the next open was
   always inside it. Now **10s** in every-open mode; it only has to cover the seconds the nudge
   is on screen over the target app.
2. Escaping set a **10-minute suppression** and counted a dismissal. In every-open mode a skip
   now suppresses **nothing** and counts no dismissal: skipping one prompt is not a retraction of
   a preference the user set in Settings.

**Deviation from §9.3, logged for sign-off:** the dismissal back-off no longer applies in
every-open mode. The inference behind it — "three noes is an answer" — does not hold when the
user has explicitly asked to be prompted on every open. The **daily cap still applies** and the
escape hatch is untouched, so this remains a nudge and not the wall §9.1 forbids.

**Copy (N3 follow-up).** The headline now depends on *which trigger fired*, carried through the
handoff as `Decision.everyOpen`. An interception at the moment of opening asks
`nudge.screen.title_before` — "Before you open Reddit — read 2 pages first?" Naming how long they
spent in there earlier is irrelevant at that moment, and faintly accusing. The minutes phrasing
stays for the time-threshold trigger, where it is the actual reason.

#### N12 — Threshold silently becomes an opens count without usage access ✅ surfaced

Reported as "I set 5 min and see no nudge". Without `PACKAGE_USAGE_STATS` the minutes threshold
falls back to "Nth open today" (§9.4a, by design) — but the slider still reads "5 min", so the
setting and the behaviour disagreed on screen. The status line now says which is actually being
counted: *"Usage access is off, so opens are counted instead: 2 of 3 today."*

#### N13 — Escape loop in every-open mode, then a dead nudge screen ✅ fixed

**Reported:** cancel → back to Reddit → nudged again → cancel → nudged again → third cancel
dropped the user on FlowRead's home screen instead of opening Reddit.

Two defects, both introduced by N11's fix:

1. **The loop.** N11 dropped the escape suppression to zero in every-open mode. But the target
   app returning to the front *is itself* a window-state change, so a zero window re-nudged
   instantly. `EVERY_OPEN_SKIP_SUPPRESS_MINUTES = 2` — long enough to cover the return to the app
   the user just asked to be let into, short enough that a genuine later open still nudges.
   **Honest limitation:** in every-open mode, re-opening the app within 2 minutes of skipping
   will not nudge.
2. **The dead screen.** `_handleIncoming()` skipped re-rendering whenever `currentView` was
   already `view-nudge`. After an escape `_pending` is null, so the screen left up was spent —
   its buttons no longer knew which app they were for, and cancel fell through to `_goHome()`.
   The guard now also requires a live `_pending`.

#### N14 — Permissions asked when the choice needs them ✅ done (product request)

Previously the three grants sat as rows in Settings and were requested up front. Now each is
asked at the moment the choice that needs it is made:

- **Accessibility + overlay** when the nudge is switched on at all — nothing works without them.
- **Usage access only when the time-based trigger is switched on**, because that is the only
  thing that needs it. Turning on "every time I open it" never asks for it (§9.4a keeps it
  optional).

One modal, one button per missing grant, taken in any order, with "Later" always available — not
a forced chain through three system screens. The Settings rows remain for anything skipped.

**Note for Q3 / Task 16.3:** this is the per-choice ask. Whether a *first-run* ask exists at all,
and where, is still the onboarding decision — N4's home card is the interim answer.

#### N15 — Nudging on in-app navigation, not just on opening ✅ fixed

**Reported:** open Reddit → nudge. Open a post, go back to the feed → nudged again.

`TYPE_WINDOW_STATE_CHANGED` cannot tell "launched the app" from "moved around inside it" —
opening a post fires exactly the same event as launching Reddit did. The old 2-second debounce
only suppressed the burst of events at launch, so anything more than two seconds later read as a
fresh open.

**The signal that would settle it is the previously-foregrounded package, and we deliberately
cannot see it.** `packageNames` is narrowed to the user's own picks (§9.4a) — that scope is both
the privacy guarantee and the Play Console Accessibility justification. Widening it to watch
every app would buy accuracy at exactly the cost the scope exists to avoid, so it was not done.

Instead a session is approximated by quiet: `SESSION_GAP_MS = 3 min`. The first window change
after the app has been silent that long counts as an open; everything inside the window is
navigation. `lastSeen` refreshes on every event, so continuous use keeps extending one session.
This also makes the "Nth open today" fallback mean sessions, which is what it always should have.

**Honest limitation (§1.5):** sitting on one screen longer than three minutes and then tapping
through reads as a new open. Three minutes is long enough that ordinary browsing does not trip it
and short enough that genuinely leaving and returning does. Revisit if device testing says
otherwise — the constant is the only thing that needs changing.

#### N16 — Rotating habit-framing copy on the nudge ✅ done (product request)

The headline states the fact; the line under it is where the point gets made — that this is how a
reading habit is actually built. Six rotating subtitles per locale (`nudge.screen.sub.1–6`),
picked at random per nudge so it does not become wallpaper, using the same rotation approach as
`notifications.js`. A locale with a shorter pool simply rotates over fewer lines rather than
printing a raw key.

**§9.1 governs all of them**: no guilt, no shame, no implication that skipping costs anything.
Warm and a little wry is the register. Folds into **Q9** — review these with the rest of the
nudge copy in one pass, and sign off the Hindi.

#### N8 — "Every time I open it" appeared not to fire ⚠️ superseded by N10 and N11

**Reported:** switched the mode on, opened Reddit, nothing; a nudge arrived later during the
session instead.

Not reproducible from here, and the report is also consistent with the mode working: the headline
shows minutes in **both** modes, so a mode-triggered nudge and a threshold-triggered one read
identically. The most likely explanation is `suppressUntil` — a nudge dismissed earlier in the
day suppresses that app for 10 minutes, and the next window-state change after it expires (a new
post, a new activity) then reads as the "open" that fires. That would look exactly like what was
described.

`NudgeGate` now logs one line per decision with the reason:

```
adb logcat -s FlowReadNudge
  no nudge for com.reddit.frontend: suppressed for another 412s
  no nudge for com.reddit.frontend: under threshold (mode=every_open, minutes=3, opens=1)
  nudging for com.reddit.frontend (mode=every_open, minutes=77, opens=4)
```

**To settle it:** attach logcat, open the target app, and read the reason. If it says
`mode=threshold`, the pref is not reaching the gate and that is a real bug; if it says
`suppressed`, the mode is fine and the suppression is doing its job.

---

### 🔴 Fifth device test — 2026-09-25, checklist run

Checklist results: **6 (cold start) ✅ · 9 (battery) ✅ · 10 (Hindi) ✅**. Item **5 could not be
run** — selecting a second app was impossible (N17); **unblocked by Q12 and now awaiting a re-run**.
Item **11 half-failed**: Page mode is fine, notifications are not firing (N18). Two further defects
were found outside the checklist.

#### N17 — Second app offers a paywall that cannot lift the gate (blocker) ✅ fixed

**Reported:** cannot select a second app; it asks to unlock Pro; unlocking says "you already own
this"; restoring says restored; selecting the second app asks to unlock Pro again. A closed loop.

**Correct, and the worst defect in this round.** The gate is on `AppState.isSubscriber` (§4:
free = 1 app, subscriber = unlimited) but the prompt shown was `showProPaywall('nudge_app_limit')`
— the **Lifetime Pro** paywall. Those are independent entitlements by design (§4), so buying Pro
could never satisfy a subscriber gate. And `hasSubscription()` is hardcoded `false`: Task 16.1 is
blocked on Q1 pricing, there is no `SUBS` product in Play Console, and no `ProductType.SUBS` path
in the plugin. **The gate was therefore unliftable by any purchase available in the app** — the
user was offered something that could not work, and if they already owned it they were bounced
around the already-owned/restore path forever.

This is the same class of defect as H4: a paying customer sent in a circle by a purchase flow.
§1.5 and §1.3 (no dark patterns) both bite.

- [x] No purchase prompt for something unpurchasable. The limit now states itself in plain
      language: *"One app for now — choosing several will arrive with the subscription."*
- [x] **Q12 answered 2026-09-25: `FREE_APP_LIMIT` 1 → 2 temporarily.** The honest message fixed
      the lie but not the wall — at a limit of 1, §9.7's scoped unlock was unreachable by any user
      and checklist item 5 was untestable. The limit carries a revert note, the toast takes its
      number from the constant (with a singular form for when it goes back to 1), and
      `syncToNative()` already truncates an over-limit selection. **Task 16.1 must restore 1.**
- [ ] **Re-run checklist item 5** (scoped unlock with two targets) now that two apps can be
      selected. This is the last untested item in the checklist.

#### N18 — Notifications stopped firing ⚠️ almost certainly by design, needs confirming

**Not reproducible from here, and the most likely explanation is that the feature is working.**
`reschedule()` skips the day's primary reminder when `_hasReadToday()` is true, and
`_hasReadToday()` is satisfied by ~the daily words/duration threshold. **Five days of nudge device
testing means reading every day, which suppresses the reminder every day.** 16.7's offline
notification has the same suppression, plus a 4h throttle and a foreground check.

Not changed on that theory alone. **To settle it on device:**
1. Settings → the reminder note under the toggle renders `fr_notif_status` — check whether it says
   denied or failed rather than scheduled.
2. `adb shell dumpsys alarm | grep -i flowread` — a real `RTC_WAKEUP` via
   `TimedNotificationPublisher` means scheduling is working and suppression is the story.
3. Read nothing for a day and confirm the reminder returns.

If (1) reports `permission_denied`, that is H3's second unexercised denial path and a real bug.

**Worth reconsidering regardless:** "you read today so we will not remind you" is right for a
*reminder*, but a user who reads daily then sees notifications vanish has no way to tell working
from broken. §1.5 argues the Settings note should say so in plain language — *"You have read
today, so today's reminder is off."* Not built; flagged.

#### N19 — An undelivered nudge ambushes the user on their next manual open ✅ fixed

**Reported:** in FlowRead (share section), switch to a target app — no nudge, the app just opens.
FlowRead is still on the share section. Open FlowRead manually later and the nudge screen appears.

`FlowReadNudgeService.launchNudge()` writes `fr_pending_nudge` and **then** starts MainActivity.
The write always succeeds; the start does not — Android drops background activity starts without
`SYSTEM_ALERT_WINDOW` and restricts them further on newer releases. When the start is dropped, the
handoff sits in prefs with nobody to show it, and the next foreground transition — for any reason,
including the user opening FlowRead themselves — picks it up and renders a nudge about an app they
left minutes ago. The three idempotent pull paths from N1 are what made this reliable: they were
built so no path had to win a race, which also means an *undelivered* nudge becomes a *delayed* one.

**Fixed by distinguishing delivery from writing.** `MainActivity` sets `fr_nudge_delivered` only
when it actually receives `ACTION_NUDGE` (cold start and hot `onNewIntent` both), `peekPendingNudge`
reports it, and JS discards a handoff that was never delivered instead of banking it. A plugin too
old to report the field is treated as delivered, so a mismatched bundle degrades to the old
behaviour rather than to no nudges at all.

**Honest limitation (§1.5):** if the overlay permission is missing, that open produces no nudge at
all. That is the correct outcome — better nothing than an ambush — and Settings already asks for
the grant (N14).

#### N20 — After "Continue anyway", FlowRead reopens on the spent nudge screen ✅ fixed

**Reported:** take the escape hatch, land in the app, later open FlowRead manually — the same
nudge screen is showing and has to be backed out of to reach home.

**Nothing re-rendered it; it never went away.** `continueToApp()` cleared `_pending` and launched
the target app but never navigated, so `view-nudge` stayed the current view. Returning to FlowRead
inside 30 minutes showed exactly what was left on screen, and app.js's stale-view routing only
kicks in after that. The handoff itself was already cleared by `renderNudge()`, so this was never a
duplicate nudge — just a dead screen.

Fixed by resetting to home after a successful launch. **Deliberately not applied to the unlock
path**: the view left behind there is the reader, and N2's rule is that someone returning to a book
must not be bounced out of it.

---

### Field findings — 2026-10-06, several weeks of real use (N22–N28)

Not a device-test round: these came from living with the shipped behaviour. All three are fixed
in the working tree and **none is device-verified yet.**

#### N22 — The minutes threshold reported time instead of intercepting it ✅ fixed

**Reported:** "I have been on the app for more than 5 min, it doesn't nudge, but when I open the
app again, it nudges me saying you have been using app for x min. It should nudge me when I am in
the app."

Exactly right, and the gate said so: `decide()` returned `no("still the same session")` for every
window change that was not a session start (N15's fix for in-app navigation). So the only
evaluation a long sitting ever got was the one at minute zero, before the minutes existed — and
the nudge landed on the *next* open, about time already spent. The feature's whole premise is
interrupting the spending of it.

Fixed in two halves, because neither covers the other (§9.3a):

1. **Navigation re-checks.** A same-session event now re-tests the minutes threshold instead of
   returning early. Free — the events were already being delivered. `every_open` is deliberately
   left alone: it fires on opens only, or it becomes the wall §9.1 forbids.
2. **One pending timed check.** Scrolling one feed produces no events at all, so
   `FlowReadNudgeService` keeps a single `Handler` message pending, aimed at the moment the
   threshold could next be met, clamped to 30s–10min by `NudgeGate.nextCheckDelayMs()`. It
   re-arms only while the app is still in front, so the chain ends by itself when the user
   leaves. One message, never a loop (§21).

**The foreground check is a logged scope decision.** The service is narrowed to the user's own
picks, so it never hears that they left — it would happily nudge about an app closed ten minutes
ago. `NudgeGate.isForeground()` reads the last resume from `UsageStatsManager.queryEvents`, which
can name an app the user never selected; it is compared and discarded, never stored or sent, and
the accessibility `packageNames` filter is untouched. Recorded in `Claude.md` §9.4a. Without usage
access the timed check never schedules and the opens fallback stands exactly as before.

**Also fixed while in here:** `foregroundMinutesToday` returned `-1` both for "no permission" and
for "empty stats map", so an idle device looked like a denied grant and silently demoted itself to
counting opens (§1.5). `-1` now means no permission and nothing else; `hasUsageAccess` moved from
the plugin to `NudgeGate` so the service can reach it.

#### N23 — Reading bought nothing ✅ fixed (product request)

**Reported:** "every time I select continue to read, it should reset to 0 … it will reset your
time in app giving you more time, make it witty."

Completing a nudged read suppressed the app for an hour and left the clock untouched, so the
moment the suppression lapsed the user was instantly over threshold again. Reading has to be
worth something and the user has to see it happen.

`NudgeGate.creditRead()` stores a baseline against the raw `UsageStatsManager` figure (which
cannot be zeroed), zeroes the open count, clears the dismissal streak, and **refunds one nudge
against the daily cap** — the approved half of the decision, because resetting a clock the gate
has no nudges left to act on is theatre. The cap still holds between reads. Applied the moment the
threshold is met rather than when a button is pressed: at that point both buttons mean they read.
Leaving a read early still credits nothing, or the threshold would mean nothing.

The unlock modal names the trade in the §9.1 register: *"3 pages in 6 min. Your Instagram clock is
back to zero, so that's 15 fresh minutes before I say anything. Go on."* Settings shows the
credited minutes too — a clock reading 4 while the phone's own screen-time says 25 looks like a
bug unless it is named (§1.5).

#### N24 — A suppression granted before midnight was void at 00:01 ✅ fixed

Found while confirming the midnight reset the user asked about (which was already correct —
`foregroundMinutesToday` re-derives midnight per query and `loadState` drops the day blob on a
date change, so no scheduler is needed). But `suppressUntil` is an absolute timestamp living
*inside* that day blob, so a 60-minute unlock earned at 23:50 was silently discarded at midnight
and the user was nudged at 00:01 by the app they had just read for. `suppressUntil` and `lastSeen`
now cross the rollover; the counters and the read credit correctly do not.

#### N26 — "You have been on Reddit for 120 min", one second after Reset ✅ fixed

**Reported:** reset the nudges, reopened Reddit, nudged immediately at a 5-minute limit.

Two faults, one root. The threshold counted **cumulative time since midnight** (§9.3 as written),
so Android's 120 minutes for the day were instantly over a 5-minute limit. And `resetApp()` could
not clear that number — it is Android's, not ours — so "Today's counters cleared" was false about
the only counter that mattered (§1.5).

**The threshold now counts the current sitting**, which is what the setting's own label — *"After a
while in the app"* — says, and what a person means. Measured as a usage-stats delta from the start
of the sitting, falling back to the wall clock without the grant. Three things follow:

- **The two toggles become orthogonal.** The threshold never fires at the moment an app is opened —
  the sitting is zero minutes old then — so "After a while in the app" and "Every time I open it"
  no longer overlap. You can still get two nudges in one sitting (one at the open, one five
  minutes in) but never two for the same moment, and the daily cap of 3 still binds.
- **Reset works for free.** Dropping the app's entry drops `sessionStart` too, so the clock really
  reads zero and the next event starts a fresh sitting.
- **The minutes trigger no longer needs usage access.** The wall-clock fallback times a sitting
  without any permission. The grant now buys accuracy (time spent elsewhere inside the session gap
  stops counting) and the timed check, which needs `isForeground()` to prove the user has not left.
  **The "Nth open today" fallback is kept** as the open-time half of the toggle for ungranted
  setups — decided 2026-10-06.

Across midnight, a live sitting carries over but its usage-stats base resets to zero, since the
figure it offsets is itself measured from midnight.

#### N27 — With both triggers on, the next open was swallowed for five minutes ✅ fixed

Introduced by N22. A nudge satisfying both triggers took the threshold's 5-minute breather instead
of the every-open 10-second one, so "Every time I open it" stopped nudging on every open — while
`settings.nudge.mode_both` told the user that mode takes precedence. Every-open is now checked
first and wins the grace.

#### N28 — Still nudging on the next open, not during the sitting ✅ fixed

**Reported:** "I have been on X for 7 min, nothing. I just closed the app, opened it again and got
the nudge."

**`UsageStatsManager.getTotalTimeInForeground()` does not tick while you are in the app.** The
figure is built from the daily interval buckets and the current session is only folded in once it
*ends*. So it reads flat for the entire sitting and jumps the moment the user leaves.

Both the pre-N26 daily counter and N26's own usage-stats delta were therefore measured against a
number that, by construction, stands still while the user is inside. The timed check computed
"0 minutes in, 5 to go" over and over, nothing ever fired, and the figure only crossed the
threshold after the app was closed — which is the N22 symptom all over again, arriving by a
different route. Usage stats are accurate for sessions that are over and useless for the one in
progress; the irony is that the wall-clock fallback, kept only for ungranted devices, was the one
that worked.

**The sitting is now timed by the wall clock, always.** It over-counts a brief switch away that
stays inside the session gap — a far smaller error than never firing, and `isForeground()` still
has to agree before anyone is interrupted. `sessionRawBase` is gone.

Usage access now buys **presence** (the timed check's proof that the user has not left) and the
day's total for display. It does not time the sitting.

**Also:** `isForeground()` now logs when the event stream is empty rather than returning a silent
no, because "they left" and "this query does not work on this device" are different failures and
only one of them is normal (§1.5).

#### N29 — The disclosure guarded one route to the grant, not three ✅ fixed

Found while filling in Play's accessibility declaration — the form asserts that a prominent
disclosure precedes the grant, and checking whether that was literally true showed it was not.

The disclosure was wired only to the master nudge toggle. Two other paths reached Android's
Accessibility settings without it: the **Grant** button on the accessibility permission row, which
called `openAccessibilitySettings()` directly, and the **trigger toggles**, which went through
`promptMissingPermissions()`.

On an existing install neither mattered, because the disclosure is shown once and had been
accepted long ago — which is exactly why it went unnoticed through five device rounds. On a
**fresh install** both were wide open: `fr_nudge_enabled` is absent, `isEnabled()` reads absent as
on, so the section rendered already-expanded with its permission rows visible. A reviewer who
installed the app, opened Settings and tapped Grant would have reached the Accessibility settings
page having been told nothing at all.

- Settings routes every control through one `withDisclosure()` choke point.
- The section stays collapsed until the disclosure has actually been accepted. **Defaulting to on
  is not the same as having been set up**, and conflating the two is what exposed the rows.
- `openAccessibilitySettings()` guards itself as a last line of defence, so a future caller cannot
  reopen the hole by accident.
- `showDisclosure()` gained a cancel callback — backing out has to be observable now that a caller
  can be awaiting the answer before opening a settings page.

**Worth keeping in mind:** this was a compliance bug that no amount of using the app would have
surfaced, because the only person who could hit it was someone who had never used the app. The
declaration form was the thing that found it.

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
### Checklist run — 2026-10-13, Galaxy S23 FE (SM-S711B), Android 16 / API 36

First run of this checklist since it was written. Driven over `adb` plus the WebView
debugger, which the debug build exposes — that is what made the gate state, the permission
state and the rendered copy directly inspectable instead of inferred from the screen.

**Caveat on the artifact under test.** The device carries the local **debug** APK
(`DEBUGGABLE`, `TEST_ONLY`, installed 2026-10-06 20:41, sixteen minutes after `c5ffd9c`), not
the Play AAB. The code matches `master` — `906c571` is docs-only — so behavioural items are
valid, but anything reaching Play Billing is not exercisable here, exactly as 16.0a records.

| Item | Result |
|---|---|
| 1 | ⚠️ **Partly.** 1a, 1c, 1d pass. 1b failed on the accessibility page (**N30**) and the usage-access note was stale (**N31**) — **both now fixed and re-verified on device.** |
| 2 | ✅ **Pass.** 128 launchable apps listed, `QUERY_ALL_PACKAGES` absent from source *and* the installed package. Limit enforced at 2, third selection rejected with an honest toast. |
| 3 | ✅ **Pass** — no nudge under the threshold, nudge past it, daily cap and 3-dismissal back-off both hold. |
| 4 | ✅ **Pass** — escape hatch visible and working on first paint every time, hardware back included. The non-waivable one. |
| 5 | ✅ **Pass** — first run ever with two targets. Reading to the unlock opened that app only; the second target still nudged on its own counters (§9.7). |
| 6 | ✅ **Pass** — force-stopped, the nudge still arrives via `fr_pending_nudge`. |
| 7 | ✅ **Pass** — engine preference preserved across a nudged read. |
| 8 | ✅ **Pass** — notification 1003 fires offline and the nudge path never touches the network. What looked like a failure was two deliberate suppressions; see below. |
| 9 | ✅ **Pass** — owner-confirmed, several hours idle, no measurable drain. |
| 10 | ✅ **Pass for now** — Hindi flow walked, no raw keys. Remaining wording changes are small and deferred by the owner. |
| 11 | ✅ **Pass** — Page mode position round-trips, existing notifications unaffected. |
| 12 | ✅ **Pass** — **the N22 fix confirmed on hardware for the first time.** The nudge arrives *during* the sitting while navigating, not on the next open. |
| 12a | ✅ **Pass** — the open itself is silent with only the threshold trigger on, including straight after Reset (N26). |
| 12b | ✅ **Pass** — with both triggers on, a reopen within a minute still nudges; the open no longer loses its short grace to the threshold's long one (N27). |
| 13 | ✅ **Pass** — the timed check fires on a feed that produces no window changes, and is correctly dropped when the user has already left. |
| 14 | ✅ **Pass** — driven over adb 2026-10-20 on 1.4.9. With `GET_USAGE_STATS` revoked the timed check never scheduled (zero `next check for` lines), the threshold still fired from a navigation event (`fromTimer=false, inSession=true`), and `statusFor` returned `rawMinutes:-1` with `minutes:1` — the wall clock timing a sitting with no usage access, exactly as §9.4a claims and as the **N31** rewrite now says. |
| 15 | ✅ **Pass** — the credit (N23): the unlock names what it bought, the clock resets, a nudge is refunded, and leaving a read early credits nothing. |
| 16 | ⚠️ **Half — owner accepted the gap 2026-10-20.** The surviving-suppression half will not be exercised; the resetting half is confirmed. Counters confirmed clear the next day. The half N24 actually fixed — a suppression earned before midnight surviving it — was **not** exercised, because the run happened the next day rather than across the boundary. |

**Item 8 detail — both halves were correct behaviour, not defects.** Reported as "airplane
mode gives me no nudge and no notification". Neither is a bug, but it took a properly
sequenced run to show it, which is worth recording because the same report will come back.

*The notification works.* Id `1003` posted on the right channel with the throttle stamp
written — but only on a genuine online→offline transition **with the app backgrounded**, after
the 30s confirm window. `notifications.js:276` is `if (await _isForeground()) return;`, and
flipping airplane mode means holding the phone with FlowRead open. That is §11's own anti-spam
rule ("do not fire if the app is currently open") doing its job. Every other gate was verified
independently while backgrounded: `isActive:false`, `connected:false`, permission granted,
`_hasReadToday()` false, throttle clear.

*The missing nudge had nothing to do with the network.* Nothing in detection or the gate
touches it, and `analytics-ping.js:59` returns on `if (!ENDPOINT) return;` before any `fetch`.
The gate was simply at cap — 3 of 3 nudges, 3 dismissals — which is the back-off holding.

**Item 14's run incidentally corroborated items 3, 4 and 12.** Driving it produced a full
trigger cycle from a clean state: the gate declined twice below the threshold (`minutes=0`),
fired at `minutes=1` **from inside the session** (`inSession=true`) with the present-tense
headline *"Still on Reddit — 1 minutes in this stretch"*, and the escape hatch was present and
enabled on first paint. That is item 3's threshold behaviour, item 4's hatch and item 12's N22
fix, all observed rather than reported. The 2026-10-20 state also showed `nudges: 3` and
`opens: 33` for that day, so the feature is demonstrably firing in daily use.

**⚠️ Items 12a, 12b, 13 and 15 remain owner-reported, not independently corroborated.**
They are recorded above as the owner reported them. Logging the honest caveat because these
six are exactly the N22/N23/N26/N27 fixes this checklist exists to gate. Reading the stored
gate state immediately afterwards (for item 8) showed `nudges: 3` with
`lastNudgeAt: 2026-10-13 03:43`, and `opens` unchanged at 30 across the whole session.
`nudges` and `lastNudgeAt` are written together on every fire (`NudgeGate.java:554-555`), so
by that record no nudge fired after 03:43 that day, and the gate spent the rest of it at cap
and backed off — a state in which it cannot nudge. Reset during 12a would have removed the
entry entirely (`resetApp` does `remove(pkg)`), so that does not account for it either.

There are innocent explanations not visible from here — a different device or build, or
reporting partly from the weeks of real use that produced the field round. **Asked, not yet
answered.** Until it is, treat the §9.3 reversal as confirmed by field use rather than by this
checklist. Re-running 3, 12, 12a, 12b and 13 takes about ten minutes on a clean day's
counters.

**Item 1 detail.** All three **N29** routes to the accessibility grant raise the prominent
disclosure first, with focus never leaving the app and `fr_nudge_disclosed` still unset until
Continue: the master toggle, the permission row's own button, and the trigger toggles. The
disclosure copy matches what §9.4a claims the service can and cannot see. Re-detection on
return works — the row flips `On` → `Turn on` after a background/foreground cycle, via the
`appStateChange` listener. Degradation is honest: with usage access revoked the status line
reads *"Usage access is off, so opens are counted too: 30 of 3 today"* and names the daily cap
as the reason for silence.

**Item 2 detail — the checklist text is stale, not the code.** It expects a *paywall* on the
second app. The code shows an explanatory toast instead (*"2 apps for now — choosing more will
arrive with the subscription"*), which is correct while 16.1 is blocked on Q1: there is no
subscription SKU to sell, so a paywall would be a dead end, and §1.5 prefers the plain
statement. **Task 16.1 must restore the paywall expectation here along with
`FREE_APP_LIMIT` → 1.**

#### N30 — the accessibility grant lands on the top-level menu, not FlowRead's entry ✅ fixed

`FlowReadNudgePlugin.openAccessibilitySettings()` fires a bare
`Settings.ACTION_ACCESSIBILITY_SETTINGS`, which on this device opens
`Settings$AccessibilitySettingsActivity` — the top-level Accessibility screen. From there the
user must find *Installed apps* (one of six entries, reading "5 apps"), open it, find FlowRead
and toggle it: three taps and a search, at the one moment the feature is asking for the
grant it cannot work without.

The same file gets this right for overlay — `openOverlaySettings()` scopes its intent with a
`package:` Uri — so this is an oversight rather than a decision. The fix is
`ACTION_ACCESSIBILITY_DETAILS_SETTINGS` with the service's component in
`:settings:fragment_args_key`, guarded by an API check and falling back to the present
behaviour, since that action is API 29+ and `minSdk` is 24.

Worth noting this is the grant rate for the entire pivot mechanic, and §10.1 already warns
that poor framing here "will tank permission-grant rates and trust". Three unexplained taps
is the same problem one layer down.

**Fixed 2026-10-13, and the first fix was wrong in a way only the device showed.**
`ACTION_ACCESSIBILITY_DETAILS_SETTINGS` turns out not to be reachable here at all: the
activity is exported, but **from API 34 it is gated behind
`android.permission.OPEN_ACCESSIBILITY_DETAILS_SETTINGS`**, a privileged permission this app
cannot hold, so `startActivity` throws `SecurityException`. Note `resolveActivity` returns a
match anyway — the resolve check is not what saves this, the try/catch is. The deep link is
kept because it does work on **API 29–33**, and falls back cleanly everywhere else (verified:
`opened=true`, top-level screen, no crash).

Since the user then lands on a screen that does not mention FlowRead anywhere, the fix is to
say what to look for: *"Find FlowRead in your installed apps and switch it on."* The first
attempt drew that as the in-app toast and was **shown to nobody** — the settings activity
covers the WebView instantly — so it is a platform `Toast`, posted after `startActivity` so it
lands on top of Settings. The text comes down from JS, because that is where i18n lives (§17).
Verified on device by screenshot: it renders directly beside the *Installed apps* row the user
needs, and the copy was shortened once because Samsung's toast caps at two lines and truncated
the first version.

New key `settings.nudge.perm_accessibility_path` in both locales. **567 keys each, parity
holds.** Hindi is in the file's existing Hinglish register and wants the same owner sign-off
as the rest (Q10).

*Observed separately:* overlay opens Samsung's full app list rather than FlowRead's own
toggle despite the correctly-scoped intent, so that one is OEM behaviour, not ours. Usage
access opens the list, which is what the checklist expects.

#### N33 — a skipped threshold nudge came back in two minutes ✅ fixed, device-verified

Reported from use 2026-10-29: with both triggers on, a nudge arriving after the chosen time was
followed by another one **two minutes** later instead of after the chosen time again.

Two bugs on adjacent lines in `continueToApp()`. It chose the post-skip grace from
`hasTrigger(MODE_EVERY_OPEN)` — **which toggles are enabled** — rather than which trigger raised
that nudge, so with `every_open` on, a threshold nudge got the 2-minute open-grace. And
`dismissed: !everyOpen` meant the skip was **not counted toward the back-off at all**, silently
disabling that safety valve for anyone running both toggles. The gate already draws the
distinction for its own grace (`overEveryOpen` vs `overMinutes`) and `inSession` travels in the
handoff for exactly this; the JS simply was not reading it.

The deeper cause is that a threshold's condition does not end when the nudge is dismissed — same
sitting, still over the limit — so any fixed suppression only defers the re-fire to the moment it
lapses. A skipped threshold nudge now restarts the sitting and suppresses for the threshold
itself, so neither half can undercut the other. `Claude.md` §9.3b records the rule and separates
it from §9.3a's five-minute *while-showing* grace, which is a different moment.

**Device run, 2026-10-29, threshold set to 3 min so the old and new behaviour differ visibly:**

| | observed |
|---|---|
| Open-nudge, skipped | `suppressUntil +1.9 min`, `dismissals 0`, sitting **not** restarted — unchanged, as required |
| Threshold nudge | `fromTimer=true, inSession=true, minutes=3` — fired from inside the sitting |
| After skipping it | `dismissals 0 → 1`, `sessionStart` −3.7 min → −0.1 min, `suppressUntil +2.9 min` |
| Log | `sitting restarted for com.reddit.frontpage after a skip`, then `suppressed for another 179s` (was 119s) |
| Next nudge | **17:42:37 skip → 17:45:37 nudge, exactly 3:00**, `minutes=3` |

**Noticed while verifying, not fixed, pre-existing:** the hand-off back to the target app counts
as a new open (`opens` 1 → 2), because `lastSeen` has gone stale past `SESSION_GAP_MS` while the
nudge screen was up. Harmless with `every_open` (the return is suppressed), but it inflates the
count the **opens fallback** gates on, so an ungranted setup can reach "Nth open today" slightly
early. Worth a decision: being sent back is arguably not an open the user chose.

#### N32 — counts read "1 pages" ✅ fixed

Found on the nudge screen during item 14: *"Read 1 pages?"*. `t()` has no plural handling, and
the two places that needed it — `dashboard.kpi.streak.value` and `nudge.toast.free_limit` —
had each hand-written a ternary against their own `.one` key. Nothing generalised it, so the
next string that needed it did not get it.

Reachable in production: the unlock-pages slider starts at **1**, so a user who sets one page
sees "1 pages" on the nudge screen, in the unlock modal and in Settings. The minutes slider
starts at 5, so that figure is never 1 — the nudge titles are therefore pluralised on `pages`,
not on minutes, which is why the call sites pass `pages` as the count while `{n}` still
substitutes the minutes.

`tn(key, n, vars)` now formalises the existing convention: picks `key.one` at exactly 1,
`key.other` otherwise, and falls back to the bare key when neither exists — so it is safe on
strings that have not been split. Deliberately English-shaped (one vs many), which is also how
Hindi divides; a language with dual or paucal forms would need more.

**`share-stats.js` needed almost none of it.** Its call sites already guard with `streak >= 2`,
`finished.length > 1` and a dedicated `share.hero.book_one_day`, so those counts cannot reach 1.
An initial pass split them anyway and was reverted — variants nothing can select are noise in a
file the next person has to read. Only `share.*.time` survived, where `totalMinutes >= 60`
genuinely yields `1 hour`.

574 keys each, parity holds. Verified on device across every variant plus the missing-key
fallback.

#### N31 — the usage-access note still describes pre-N26 behaviour ✅ fixed

`settings.nudge.perm_usage_note` reads *"Without it, FlowRead nudges on your third open of
the day instead of after real time spent."* N26/N28 reversed that: the sitting is timed by the
wall clock, so the minutes threshold works **without** usage access. Confirmed on device —
with `GET_USAGE_STATS` revoked, `statusFor()` returned `rawMinutes: -1` (no usage access) and
`minutes: 32` (the sitting, still ticking).

What the grant actually buys, per §9.4a, is *presence* for the timed check plus the day's
total for display. The note tells the user they lose the time trigger entirely, which would
make them grant a permission §9.4a deliberately kept optional for a reason that no longer
applies — a §1.5 violation in the direction that costs the user something.

The sibling string was updated and this one was missed: `status_by_opens` says opens are
counted *"too"*, which is the correct post-N26 framing.

**Fixed 2026-10-13** in both locales: *"Without it, the time trigger only catches you while
you are moving around the app, not sitting still on one feed — so opens are counted too, and
the day's total is not shown. Everything still works."* That now matches both §9.4a and the
sibling string. Hindi likewise wants owner sign-off.

---

## Task R8 — DEX optimization / obfuscation (Play Console notice)

**Status:** ✅ Code complete and device-verified 2026-10-20, in **1.4.9 / versionCode 37** ·
**Deadline:** end of October 2026 (owner-supplied) · **Size:** S to change, M to verify

**Why:** Play Console reports *"DEX code optimization is below our threshold — Obfuscation
(1%)"*, warning that sub-25% figures "may impact your visibility and publishing capabilities".
The cause was one line: `minifyEnabled false`. R8 was off, so the only obfuscated bytes in the
APK were the ones that arrived that way inside third-party AARs. None were ours.

**What changed**
- `minifyEnabled true` on the release build type.
- `proguard-android-optimize.txt` rather than `proguard-android.txt`. The plain file contains
  `-dontoptimize`, which would have cleared the Obfuscation warning while leaving Play's
  **Optimization** category at zero — and the notice says *any* category under 25%.
  `capacitor-android` uses the optimize variant itself, so this matches what we build on.
- `app/proguard-rules.pro` written (it was the untouched Capacitor template, every rule
  commented out): line-number attributes for readable Play vitals traces, generic-signature and
  annotation retention for Gson, and `-keepnames` on `NudgeGate` — the one class whose breakage
  would be silent rather than loud.

**Result: obfuscation went from 1% to 93%** (3,304 of 3,541 classes renamed, per
`mapping/release/mapping.txt`). Release APK 12.5 MB → 6.2 MB. The mapping ships **inside the
AAB** at `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`, so there is no
separate upload step for crash de-obfuscation.

**`shrinkResources` deliberately NOT enabled.** The notice is about DEX, not resources, and
`notifications.js` passes `smallIcon: 'ic_stat_notify'` as a **string** that the
LocalNotifications plugin resolves by name at runtime. No Java code references
`R.drawable.ic_stat_notify`, so the shrinker would judge it unused and strip it, and reading
reminders would lose their icon. Enabling it later needs a `res/raw/keep.xml` naming that
drawable first. Kept out so this commit stays one revertable change (the §16.0a lesson).

### Verification — run against an R8-minified build on the device

R8 breaks reflection, and nothing here is exercised by compilation. The build type was
temporarily minified **in debug** so the R8-processed DEX could be driven through the WebView
debugger with real data, then reverted. Everything below ran against minified code:

- [x] Cold start, no `FATAL` / `ClassNotFoundException` / `NoSuchMethodError` / `NoClassDefFoundError`.
- [x] All **16** Capacitor plugins register. The four custom ones resolve under their
      `@CapacitorPlugin` annotation names (`FlowReadNudge`, `FlowReadIap`, `FlowReadOcr`,
      `FlowReadDeviceSync`) — the keep rule that saves them is `capacitor-android`'s own
      `consumerProguardFiles` (its `build.gradle:50`), which is what makes
      `-keep public class * extends com.getcapacitor.Plugin { *; }` reach this build.
- [x] `@PluginMethod` methods survive and return real data: `getPermissionState`,
      `getNudgeStatus`, `getForegroundMinutesToday`, `listLaunchableApps` (129 apps),
      `peekPendingNudge`, `requestAccess`, `scanFiles`.
- [x] **Play Billing** — `queryProducts` returned live product details from Play. The most
      reflection-heavy path in the app, and the one §3.1 most wanted re-checked.
- [x] **ML Kit OCR, Latin** — real canvas render recognised end to end. Devanagari reached ML
      Kit and reported its own "optional module downloading" state, which is a model-download
      condition, not a missing class.
- [x] **The whole nudge chain** — accessibility service fired on a Reddit open, `NudgeGate`
      decided (`nudging for com.reddit.frontpage (modes=every_open …)`), FlowRead came to the
      front, the screen rendered with the real app name, and the escape hatch was present and
      enabled on first paint.
- [x] Local notifications schedule and cancel; `ic_stat_notify` resolves.
- [x] `Filesystem.writeFile` → `getUri`, the native half of the share path.
- [x] `ShareStats` loads with its full API.

**Two false alarms worth recording, because both will recur.**

*Nudge settings appeared to not persist.* `fr_nudge_min_minutes` and `fr_nudge_trigger_mode`
were written to `localStorage` and gone after a restart, while 25 other keys survived. Not a
bug and not R8: Chromium flushes `localStorage` asynchronously, and `adb shell am force-stop`
is a `SIGKILL` that pre-empts the flush. Backgrounding first (`KEYCODE_HOME`) and then killing
preserves the value — confirmed. Real users background the app, which flushes.

*The accessibility service stopped firing after reinstall.* Android revokes the accessibility
grant on reinstall as a security measure; `enabled_accessibility_services` read `null`.
Re-granting restored it. **Worth knowing for the release:** testers who sideload over an
existing install will silently lose the grant and see the nudge do nothing.

**Still outstanding:** upload 1.4.9 / 37 to Internal testing and confirm Play Console's
Obfuscation figure actually moves off 1% — the number is computed by Play, not by us, so the
local 93% is strong evidence but not the acceptance criterion.

---

## Task 16.3 — Onboarding redesign

**Status:** Not started — unblocked. **Scoped as a design-first task (decided 2026-09-25):** the
onboarding narrative gets designed before it gets built, and **Q3 is answered inside that design**
rather than ahead of it. · **Ref:** §10 · **Blocked by:** 16.2 (needs the nudge flow to hand off
to — satisfied) · **Size:** L

**Why:** Current onboarding is RSVP-calibration-first, built entirely under the pre-pivot speed-reading identity. Full-surface redesign, not a copy tweak.

**Steps**
- [ ] Extract `renderOnboarding()` (currently `views/settings.js:176`) into a new `www/js/views/onboarding.js`; register it in `index.html` and keep the `app.js:91` routing intact.
- [ ] Lead with the **reading-habit** pitch. Engines stay in the app and may still be introduced, but de-emphasized.
- [ ] Explain the nudge concept in plain language **before** any permission ask — the user must understand *why* FlowRead watches for app-opens before being sent to a settings page. Poor framing here tanks grant rates and trust.
- [ ] **Design the flow first, then build it.** Product-owner decision 2026-09-25: this is a
      narrative redesign (§10 calls it a full-surface redesign, not a copy tweak), and the
      permission question below is a consequence of the narrative, not an input to it.
- [ ] **Q3 — inline vs deferred permission ask — is decided as part of that design**, not
      pre-answered. §10.2 still applies: implement it as a configurable/testable point rather
      than a hardcoded assumption, and review before calling the task done.
      **Interim behaviour today:** N14's per-choice ask (each permission requested at the moment
      the setting needing it is switched on) plus N4's one-time home card. Whichever way the
      design goes, that card in `upload.js` should be absorbed or replaced — a comment there
      points here.
- [ ] End on Free Books — the user finishes already reading, or one tap from it. No empty import screen.
- [ ] Keep an honest-limitations screen, repositioned to fit the new narrative rather than removed (§1.5, §10.1).
- [ ] Every string through `t()` into `en.json` + `hi.json` **from day one**, not retrofitted (§17, §10.1).

**Files:** NEW `www/js/views/onboarding.js` · `www/js/views/settings.js` (remove onboarding) · `www/js/app.js` · `www/index.html` · `www/js/storage.js` · `www/i18n/*.json` · `www/css/components.css`

**Done when:** A fresh install reaches "reading something" without touching the import screen, Hindi is complete, and the permission-flow variant is toggleable.

---

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

### Product decisions taken 2026-09-25

| # | Decision | Reasoning |
|---|---|---|
| D1 | **The share card is free for everyone**, not Pro-gated. | §15 puts the Share button on the dashboard, but `dashboard.js` is hard Pro-gated (`openDashboard()` → `showProPaywall`). As literally specified, the one feature prioritized *for distribution* would have been invisible to every free user — who are the bulk of installs and the people whose shares reach non-users. Hence a **second entry point in the home header**, where everyone has it. The dashboard button exists too, for Pro users who are already looking at their stats. |
| D2 | **Hero = finished book + streak**, falling back to streak, then total words. | §15's own example. A named book is the most shareable thing on the card and the most on-brand given the catalog; a bare streak could be any habit app. |
| D3 | **Milestones fire on book completion AND streak milestones (7 / 30 / 100).** | Completion is required by §15 and is the strongest moment. Streak milestones are deliberately sparse — a prompt every streak day is nagging, which §9.1's tone rules out here as much as on the nudge screen. |

**Steps**
- [x] `npm i @capacitor/share` (**approved 2026-09-16**) — **8.0.2**, matching the Capacitor 8 line. `npx cap sync android` run; 8 plugins now detected. **Adds no new permission** to the merged manifest, and reuses the `${applicationId}.fileprovider` already declared in `AndroidManifest.xml` (whose `file_paths.xml` already covers `cache-path`, which is where the PNG is written).
- [x] **Both** entry points: (1) an always-available Share button — on the dashboard *and* in the home header per D1, hidden until there is something worth sharing so a fresh install is never offered an empty card; (2) a milestone prompt on book completion, plus streak milestones per D3.
- [x] Generate the card entirely on-device via Canvas. No server, no upload (§1.4).
- [x] **Hero-metric framing** — one hero, at most three supporting lines, per D2.
- [x] App branding on the image: a hairline accent rule, the wordmark and the tagline at the foot, small (§15 — tasteful, not a loud ad).
- [x] Per-item toggles: a radio list chooses the hero, checkboxes choose the supporting lines, and the preview redraws live on every change.
- [x] Laid out for a future "time reclaimed" stat: the supporting lines are a flat ordered array, so adding §15's "you chose reading over Reddit 14 times this week" is one entry in `_extraOptions()` and nothing in the drawing changes. **Not built in v1**, as specified.
- [x] Share via the native share sheet (`Share.share({files:[…]})`), with a `navigator.share` → download fallback so the feature is testable in a browser.
- [x] Palette/typography exactly per §16 — no new colours. New i18n keys in both languages: **562 each, full parity.** Hindi is in the file's existing Hinglish register and **needs owner sign-off** (Q10).

**Files:** `package.json` · NEW `www/js/features/share-stats.js` · `www/js/views/dashboard.js` · `www/js/views/upload.js` · `www/js/storage.js` · `www/index.html` · `www/css/components.css` · `www/i18n/*.json`

### Notes from the build

- **`computeStreak()` moved from `views/dashboard.js` to `storage.js`**, next to `loadReadingSessions()`. It is a derived stat over the session store, not a view concern, and both the dashboard and the share card need it. One definition, no duplication, no feature→view dependency.
- **Milestones are checked from `renderUpload()` and nowhere else.** Home is the one place the user is between things; a celebration over a reader is an interruption, and position is sacred (§21). A milestone is marked celebrated when the offer is *made*, not when it is accepted — re-offering because the user said no is the nagging §9.1 rules out. On first run everything already achieved is seeded as history so an existing library is not celebrated retroactively.
- **Three defects found and fixed during verification**, all of which would have shipped: the footer tagline was positioned from a width measured in the wrong font and overlapped the wordmark; `_wrap()` could not break a single over-long word, so a spaceless title ran off the edge of the image; and the card's `max-height` let the square preview flex-shrink to a 26px sliver.
- **No analytics event was added.** `analytics-ping.js` has a closed allowlist and §9.6 names a fixed minimum event set that does not include sharing. Widening what we collect is a product decision, not an implementation detail — see Q11.

### Field round — 2026-10-06 (N25)

#### N25 — The card published a filename, and had no cover ✅ fixed

**Reported:** "Shared status should also share the image of the book, we have remove the extension
like .pdf, .txt etc, just the name of the book, and image, if image is not available, 1st page
image of the pdf or whatever user selected."

**Titles.** `_finishedBooks()` used the library `name`, which is the filename the picker handed us
— and free-book imports deliberately append `.pdf`/`.txt` (`free-books.js`). So the most public
surface the app has read "Finished जाति का विनाश.pdf in 4 days". New `displayTitle()` in
`utils/format.js` strips a trailing document extension **for display only**: the stored name is
untouched because `saveFileToLibrary()` de-duplicates on `name` + `kind`, and rewriting it would
split one book into two. Applied on the card, the home library rows, the dashboard and the reader
header — the extension was never part of a title anywhere.

**Covers.** New `www/js/features/book-cover.js`. For a PDF it renders page one from the raw bytes
already in IndexedDB (`loadRawPdf`) through `OCREngine.pdfPageToBase64`, which gained a scale
parameter rather than being duplicated; the result is cached on disk (`flowread/covers/`, flagged
in localStorage like `fr_rawpdf_`) and in memory for the sheet's live redraws.

Everything else — TXT, DOCX, URL — has no page to render, so the card draws a typographic cover:
initials, a short accent rule, the author. **Deliberately not the catalogue's placeholder palette**
(`free-books.js` `_COVER_COLORS`): those greens and purples are outside §16, which §15 says the
card uses exclusively. It varies between `--accent` and `--accent-2` instead. The catalogue's
author is now persisted on free-book imports, and recovered for already-downloaded books by
walking the `fr_freebook_<id>` map backwards rather than asking anyone to re-download.

**Deliberately offline (§1.1).** 65 of the 88 catalogue books have a real cover, but as a remote
Gutenberg URL with no CORS headers — fetching it would taint the canvas and fail the whole export,
and working around that means a network call on a path that has none today. Product decision
2026-10-06: offline-only for v1.

**Also fixed:** the card said "in 1 days" — the single-day case now has its own sentence, and it is
the more impressive one anyway. And `_fitHero()`'s comment promised never to truncate a title
while its fallback did exactly that; beside a cover the column is half as wide, so it now fits on
height rather than line count and ellipses honestly when it genuinely runs out of room.

**Verified** in headless Chrome at 1080×1080 across four heroes (PDF cover, Hindi typographic
cover, an over-long title, and a non-book hero). **The one thing that could not be verified
off-device is the real PDF page-one render** — headless Chrome cannot run pdf.js under virtual
time. It is guarded by a 4-second race that falls back to the typographic cover, so the worst case
is a plain cover rather than a hung share sheet.

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

**Status:** Done (2026-09-16) — catalog confirmed 23 `pdf` + 65 `txt`, zero `html`; `Claude.md` §13.3 updated in H2. · **Ref:** §13.3 · **Size:** XS

Reconnaissance says this is already fixed: `www/data/free-books.json` has 88 books, 23 `pdf` + 65 `txt`, zero `html`.
- [ ] Confirm no catalog entry has `fileType: "html"` and no `sourceUrl` returns HTML despite a pdf/txt type.
- [ ] Spot-check a few downloads end-to-end.
- [ ] If clean, propose deleting §13.3 from `Claude.md` (see H2).

## Task H4 — Pro purchase fails with a generic error ✅ DONE

**Status:** ✅ **Done — verified on a Play-distributed build 2026-09-20** (1.4.7 / versionCode 34, Internal testing) · **Ref:** §1.5 ("never silently fail", "errors explained in plain language"), §3.1 · **Size:** S–M · **Found:** 2026-09-16 from production on 1.4.5 · **Fixed:** 2026-09-16 · **Verified:** 2026-09-20

**Symptom:** Tapping unlock-Pro shows `iap.toast.purchase_failed` — "Purchase could not be completed. Please try again." Purchase does not go through.

**Was the highest-priority open item** — it blocked revenue on the live build with no workaround. Resolved.

### What the evidence already rules out

From device logcat at the time of the failure:
- `com.android.billingclient.api.ProxyBillingActivity` was **created and destroyed** — Play's purchase sheet opened. So `queryProducts` succeeded and `launchBillingFlow` returned OK.
- **Therefore this is not a regression from the Billing 9 migration.** The changed `queryProductDetailsAsync` path ran fine; it also means paywall price rendering works, closing the open question in 16.0b.
- The failure therefore came from `onPurchasesUpdated` receiving a non-OK response code.
- Also seen: `W BillingClient: Billing service disconnected.` and `ActivityManager: Scheduling restart of crashed service com.android.vending/...InAppBillingService` — **Google Play's own billing service crashed** around the same time. May be the cause, may be incidental; the timestamps are about a minute apart.

### Leading hypotheses, most likely first

1. **`ITEM_ALREADY_OWNED`.** Restore purchases was run successfully just before, so the account already owns `pro_lifetime`. Re-purchasing an owned non-consumable returns this code, and `onPurchasesUpdated` collapses it into "Purchase failed. Please try again." **This is the most probable cause and is trivially checkable.**
2. **`SERVICE_DISCONNECTED` / Play service crash.** `onBillingServiceDisconnected` sets `billingClient = null` and relies on JS re-calling `initBilling` — if the service dies mid-flow, `pendingPurchaseCall` may reject or never resolve.
3. **Play Console product/licence-tester configuration** rather than app code.

### The defect to fix regardless of which hypothesis holds

`FlowReadIapPlugin.onPurchasesUpdated` funnels every non-OK code into one string:

```java
if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
    call.reject("Purchase failed. Please try again.");
}
```

and `purchase.js:_handlePurchaseError` falls through to the same generic toast. So `ITEM_ALREADY_OWNED`, `SERVICE_DISCONNECTED`, `BILLING_UNAVAILABLE`, `ITEM_UNAVAILABLE` and `DEVELOPER_ERROR` are **indistinguishable to both the user and the developer** — which is why this needed a logcat session to diagnose at all. That is a §1.5 violation ("errors explained in plain language") and the root reason this is hard to debug.

**Steps**
- [~] Reproduce with `adb logcat` attached and capture the actual `BillingResponseCode`. **Deliberately not gated on** — the fix is correct for every response code, and the app now names the code in plain language itself, so the diagnosis comes from the next user-facing attempt instead of an adb session. Still worth capturing opportunistically.
- [x] Pass the response code through the reject so the JS layer can distinguish cases. `tokenFor(int)` maps every `BillingResponseCode` to a stable token, emitted as the **Capacitor error code** via the two-arg `call.reject(message, code)`. Applied at every reject site in the plugin.
- [x] Handle `ITEM_ALREADY_OWNED` properly. `recoverOwnedPurchase()` re-queries INAPP purchases, acknowledges if Play never got an ack, and **resolves as success** so the entitlement unlocks. If the record can't be read back, JS shows an "you already own this" toast and auto-triggers `restorePurchases()` — never a failure message.
- [x] Handle `SERVICE_DISCONNECTED` / `SERVICE_UNAVAILABLE` distinctly. The plugin now emits a `billingDisconnected` event; JS clears `_iapInitialized` so the next call re-inits instead of dying on `NOT_INITIALIZED` forever.
- [x] Give each case its own plain-language i18n string in `en.json` + `hi.json` (§17). Seven new `iap.toast.*` keys. **Hindi needs product-owner sign-off** — written in the file's existing Hinglish register, not supplied by the owner.
- [x] Re-check the same collapsing in `queryProducts` and `queryPurchases` — both now go through `rejectWith()`.
- [x] Re-test on a Play-distributed build — see the verification results below.

### ✅ Verification results — 2026-09-20, 1.4.7 / versionCode 34, Internal testing

| Test | Result |
|---|---|
| Fresh purchase | ✅ Completes and unlocks (first success since the Billing 9 migration) |
| Restore purchases | ✅ Resolves entitlements |
| Purchase while already owning | ✅ No false failure — shows "You already own this. Restoring it now…" and restores. **See the sub-path note.** |
| Error taxonomy reaches the user | ✅ A declined payment produced its specific message, not the old generic one |
| Cancel mid-flow stays silent | ⬜ Not exercised |
| Airplane mode mid-purchase | ⬜ Not exercised |

**The original bug is fixed.** A customer who owns Pro is no longer told their purchase failed;
they end up unlocked. That was the §1.5 violation and it is closed.

**Sub-path note — follow-up, not a reopen.** The observed toast was `iap.toast.already_owned`
(`purchase.js:346`), which is the **JS fallback**, not the native primary path. Had
`recoverOwnedPurchase()` found the existing purchase it would have resolved as a success and
shown `iap.toast.pro_unlocked` instead. So the plugin's `queryPurchasesAsync` lookup did not
match — worth a look when next in this code (candidates: `pendingProductId` being null, or the
`getProducts().contains(productId)` check). **The user-facing outcome is correct either way**,
since the fallback restores the entitlement, which is why this is a follow-up rather than a
live defect.

**Copy fix applied during verification:** `iap.toast.billing_unavailable` said "unavailable on
this device or account", which pointed users at the wrong thing for a declined payment.
`BILLING_UNAVAILABLE` is Play's "user billing error" in Billing 6+, so it now names the payment
method. **Committed but not yet in a shipped bundle** — fold it into the next build.

**Root cause of the verification delay, for the record:** the first internal-testing install
appeared to contain none of the changes. Play was serving the cached production build; the
`.aab` was verified to contain every change. Then `OR-FGEMF-20` — a genuine Google payments
decline, because the tester account was not under Setup → Licence testing, so Play attempted a
real charge on the developer's own IAP. Both documented in `BILLING_TEST_PLAN.md` §3b and §5b.

**Earlier install gotcha (resolved):** the first internal-testing install appeared to contain
none of the changes. Cause was Play serving the cached production build, not a bad bundle —
the `.aab` was verified to contain every change. Settings → About was also hardcoded to
"Version 1.1.0", so this was undiagnosable from inside the app; it now reports the real
version and build (1.4.7+). See `BILLING_TEST_PLAN.md` §3b.

**Also fixed in the same pass**
- `getUnfetchedProductList()` is now read and returned as `unfetched` (§3.1 flagged it as unused) — a misconfigured Play Console product no longer looks identical to a working one.
- Pending purchases (`PurchaseState != PURCHASED`) **resolve** with `{pending:true}` instead of rejecting — a delayed payment is a legitimate outcome, not a failure.
- `resolveSuccessfulPurchase` no longer hardcodes `acknowledged: true` when the ack actually failed.
- `buyPro`/`buyOcr` no longer dead-end with the unlock button disabled forever when the resolved `productIds` don't contain the requested id.
- `restorePurchases` labels ('Pro' / 'OCR Vision') were hardcoded English — now `t('paywall.*.tier')`.
- `_handlePurchaseError` branched on **substrings of English prose**; it now branches on `err.code`, with message matching kept only as a fallback.
- `SERVICE_TIMEOUT` (-3) is deprecated in Billing 9 and no longer returned — not mapped.

**Verified:** `:app:compileDebugJavaWithJavac` clean, no deprecation warnings; JS syntax clean; en/hi at 445 keys each, full parity.

**Files:** `android/app/src/main/java/com/flowread/app/FlowReadIapPlugin.java` · `www/js/features/purchase.js` (`_handlePurchaseError`, ~L276) · `www/i18n/en.json` + `hi.json`

**Do this together with Task 16.1**, which rewrites the same purchase flow for subscriptions — fixing the error taxonomy first makes 16.1's testing far easier.

---

## Task H3 — Notifications fail silently when exact-alarm permission is denied

**Status:** Code complete (2026-09-16); shipped in 1.4.7. **Scheduling confirmed working; the two denial-path checks are still unexercised.** · **Ref:** §1.5 ("never silently fail"), §11 · **Size:** S · **Found:** 2026-09-16 while device-verifying 16.0a

**Why:** `notifications.js:196` uses `allowWhileIdle: true` (exact alarms). Android denies `SCHEDULE_EXACT_ALARM` by default for apps targeting 33+. Line 221 swallows the resulting failure in `catch (_) {}`, so a user who hasn't granted it gets **no reminders and no indication why**. This directly violates §1.5's "never silently fail" principle. Pre-existing — not introduced by the API 36 bump — but the bump makes it more likely to bite.

### ⚠️ Correction — the diagnosis above was wrong on Capacitor 8

Verified by reading `@capacitor/local-notifications` 8.x sources. `LocalNotificationManager.setExactIfPossible()` **already guards with `canScheduleExactAlarms()`** and degrades to an inexact alarm with a `Logger.warn`, so `schedule()` never threw a `SecurityException` and the `catch (_) {}` was never swallowing *this* failure. The real problems were:

1. `isExactNotification` defaults to **`true`**, so the app asked for an exact alarm on every schedule and depended on the plugin's fallback.
2. `allowWhileIdle: true` was actually the **good** half of that config — with inexact it yields `setAndAllowWhileIdle(RTC_WAKEUP)`, which survives Doze. Plain `set(RTC)` does not, so simply deleting `allowWhileIdle` (the original plan) would have made delivery *worse*.
3. The genuine silent failure is `POST_NOTIFICATIONS` denial: `reschedule()` returned early with no signal, and the settings toggle discarded `requestPermission()`'s boolean — leaving a checked box that promised reminders forever.

**Steps**
- [x] Stop requesting exact alarms: `isExactNotification: false` on both notifications, **keeping `allowWhileIdle: true`**. Result is `setAndAllowWhileIdle(RTC_WAKEUP)` — Doze-tolerant and needs no special permission.
- [x] Stop swallowing the schedule exception — it now logs and records a status.
- [x] `reschedule()` returns `{scheduled, reason}` and persists the reason to `fr_notif_status` (`no_plugin` · `disabled` · `permission_denied` · `schedule_failed`). `lastStatus()` exposes it.
- [x] `_cancelAll()` logs instead of swallowing.
- [x] `_ensureFirstBootDefaults()` no longer discards `requestPermission()`'s result.
- [x] Settings reflects reality: denying the permission **reverts the checkbox** and toasts a plain-language explanation; `#settings-reminder-note` renders the real status via `reminderNoteText()` / `syncReminderNote()`.
- [x] New strings in `en.json` + `hi.json` (§17): `settings.reminder.note_denied`, `settings.reminder.note_failed`, `notif.toast.permission_denied`. **Hindi needs product-owner sign-off.**
- [x] Normal path confirmed on 1.4.7 — notifications schedule and fire on the inexact alarm, evidenced by 16.7's offline nudge working on the same machinery.
- [ ] Revoke "Alarms & reminders" → reminder must still fire. **Not yet exercised** — this is the exact case the fix targets, so it is the one that still matters.
- [ ] Deny the notification permission → toggle must revert with a plain-language explanation. **Not yet exercised.**

### Manifest — `SCHEDULE_EXACT_ALARM` removed ✅ (signed off 2026-09-16)

The permission is denied by default at API 33+ for non-alarm-clock apps, and nothing requests an exact alarm any more, so it is gone. It is **also declared by the plugin's own manifest** (`node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml:29`), so deleting our line alone would not have worked — it needed `xmlns:tools` on `<manifest>` plus `tools:node="remove"`. **Verified absent from both the debug and release merged manifests**, with `RECEIVE_BOOT_COMPLETED` and `LocalNotificationRestoreReceiver` still intact. This also drops a Play Console permission declaration.

### Correction to the §2e reboot-persistence worry

`RECEIVE_BOOT_COMPLETED` **is** present and `LocalNotificationRestoreReceiver` **does** handle `BOOT_COMPLETED` / `LOCKED_BOOT_COMPLETED` / `QUICKBOOT_POWERON` — both arrive via the plugin's manifest merge (confirmed in `app/build/intermediates/merged_manifest/release/AndroidManifest.xml`). Reboot persistence is handled by the plugin; the earlier "no receiver" reading was a grep artifact from multi-line `<receiver>` elements.

**Files:** `www/js/features/notifications.js` · `www/js/views/settings.js` · `www/i18n/*.json`

**Relevant to Task 16.7**, which adds a third notification type on the same machinery — fix this first or inherit the same silent failure.

---

## Task H2 — Correct stale facts in `Claude.md`

**Status:** Done (2026-09-16)

- [x] §22: versionCode → **32**, versionName → **1.4.5**; added minSdk and build-requirement lines.
- [x] §3: rewritten as RESOLVED, with the shipped versions, the fact that the Aug 31 deadline was *missed* and covered by an extension, and a new §3.3 documenting the JDK 21 / Node 22 build requirements.
- [x] §3.2: SDK versions live in `android/variables.gradle`, not `android/app/build.gradle`.
- [x] §2: Capacitor 8, keep-awake 8, Billing 9.1.0; onboarding noted as living in `views/settings.js` until 16.3 extracts it; added a warning that `.gitignore` hides `android/` so new native files must be force-added.
- [x] §13.3: marked resolved, with a note that new catalog entries must be `pdf` or `txt`.
- [x] §19: 16.0a/16.0b ticked, H3 added, and a pointer to `Tasks.md` as the day-to-day tracker.

---

## Summary

| Block | Tasks | State |
|---|---|---|
| **A — Compliance** | ✅ 16.0a, ✅ 16.0b · 16.1 open | Shipped as 1.4.5 / versionCode 32, published 2026-09-16. 16.1 blocked on Q1 to finish, not to start. |
| **B — Pivot core** | ✅ 16.2 (shipped to Internal testing) · 16.3 | **16.2 is on Internal testing as 1.4.8 / 36 (2026-10-13)** — both hard gates cleared, declaration submitted, privacy policy live. N22–N28 moved the threshold onto the current sitting and made the nudge fire *during* one; N29 closed a disclosure gap the declaration form surfaced. Before that: N1–N16 over four device rounds. **Remaining: the device checklist (never run) and production promotion.** 16.3 unblocked but design-first and owner-led. |
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
- **16.1 stays blocked** on Q1 pricing; 16.4/16.5 on Q4/Q5; 16.10 wants 16.3's screenshots.

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
- **16.1 (Subscription IAP)** — still blocked on Q1 pricing, but materially cheaper now that H4 gave the purchase flow a real error taxonomy.

---

## H4 device verification — steps *(completed 2026-09-20; kept as the procedure for future billing work)*

Play Billing only works in a build Play itself delivered, so a sideloaded APK cannot test this. Internal testing is the fastest track (no review wait, up to 100 testers).

1. **Bump the version.** `android/app/build.gradle`: `versionCode` 32 → 33, `versionName` → `1.4.6`. Play rejects a duplicate `versionCode`.
2. **Build a signed release bundle:** `cd android && ./gradlew bundleRelease` (JDK 21 — §3.3). Output: `android/app/build/outputs/bundle/release/app-release.aab`.
3. **Upload:** Play Console → Testing → **Internal testing** → Create new release → upload the `.aab` → add release notes → Save → Review → **Start rollout to Internal testing**.
4. **Add yourself as a tester** (Testers tab → email list), then open the opt-in URL Play gives you and accept. Use the *same Google account* on the device.
5. **Install from Play**, not adb — the opt-in link opens the Play listing; install from there. Availability can lag a few minutes after rollout.
6. **Run the four tests** with `adb logcat -s FlowReadIap:* BillingClient:*` attached:
   - **Already-owned** (the reported bug): the account already owns `pro_lifetime` → tap Unlock Pro → **must unlock with a confirmation**, never "Purchase could not be completed."
   - **Fresh purchase:** use a licence tester account that owns nothing (Play Console → Setup → Licence testing) so it charges nothing → completes and unlocks.
   - **Cancel mid-flow:** open the sheet, back out → **no toast at all** (§3.1 — the easy regression).
   - **Restore purchases:** resolves both `pro_lifetime` and `ocr_vision`.
7. **Network case:** airplane mode mid-purchase → a network-specific message, not the generic one.
8. **Confirm the taxonomy works** — logcat should now show `FlowReadIap: purchase failed: <TOKEN> (code=N)` on any failure. If a generic toast still appears, the token reached JS but `_messageForCode` has no branch for it; the logged token names exactly what to add.
9. **Then promote** the same bundle to production once the four tests pass — no rebuild needed.

> **Two traps this procedure hit in practice, both now in `BILLING_TEST_PLAN.md`:** opting into
> internal testing does **not** switch an existing production install over (uninstall first), and
> a tester account missing from Licence testing gets a real charge attempt that Google declines
> with `OR-FGEMF-20`. The payment sheet is the tell — it must offer "Test card, always approves".

**Prerequisite check:** licence testing must list the test account (Play Console → Setup → Licence testing) for free test purchases, and `pro_lifetime` / `ocr_vision` must both be **Active** under Monetise → Products → In-app products.

**Standing rules that apply to every task above:** every new string through `t()` into both `en.json` and `hi.json` from day one (§17) · no new dependencies without asking (§21) · purchase/subscription state in Capacitor Preferences, never localStorage (§21) · `fr_` prefix on all localStorage keys · palette and typography exactly per §16 · the nudge escape hatch is never removed (§9.1, §21).
