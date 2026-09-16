# FlowRead — Phase 16 Task Board

> Working document. `Claude.md` is the contract; this file is how we execute it.
> Every task references its governing `Claude.md` section. If the two disagree, `Claude.md` wins — and `Claude.md` gets updated *before* we change direction, not after.

**Last updated:** 2026-09-16 — Block A compliance shipped as **1.4.5 (versionCode 32)** and published.
**Status legend:** `Not started` · `In progress` · `Blocked` · `Done`

---

## Decisions log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-09-16 | **API 36 via full Capacitor 6 → 8 upgrade**, not a hand-bump of AGP/Gradle on Capacitor 6. | compileSdk 36 needs AGP ≥8.9 + Gradle ≥8.11; Capacitor 6.2.1 ships AGP 8.2.1. The hand-bump is a smaller diff but an unsupported combination we'd own the breakage for, and it has to be redone at the next Capacitor upgrade anyway. The deadline blocks *all* releases, so we take the supported path once. |
| 2026-09-16 | **`@capacitor/network` approved** as a new dependency (Task 16.7). | Official Capacitor plugin, read-only connectivity listener. The only alternative is writing a native plugin for something Capacitor already ships. Satisfies the §21 new-dependency gate. |
| 2026-09-16 | **`@capacitor/share` approved** as a new dependency (Task 16.6). | Official Capacitor plugin for the native share sheet. `Claude.md` §15 assumes it exists; it was never installed. Satisfies the §21 gate. |
| 2026-09-16 | **Strict `Claude.md` order** — compliance block fully verified on a real device before any feature work starts. No parallel nudge development. | §3.3 sequencing. Avoids re-testing feature work against a shifting toolchain. |

---

## Open questions — product owner

Each is tagged with whether it blocks *starting* the task or only *finishing* it.

| # | Question | Blocks | Start/Finish | Ref |
|---|---|---|---|---|
| Q1 | Subscription price (monthly / annual) | 16.1 | Finish — plumbing can be built first | §4 |
| Q2 | Nudge default thresholds: screen-time-before-nudge, and pages-or-minutes to unlock | 16.2 | Finish — expose as settings, don't hardcode | §9.2, §9.3 |
| Q3 | Is the nudge permission ask inline in onboarding or deferred? | 16.3 | Finish — build as a config flag, review before calling it done | §10.2 |
| Q4 | Monthly book-drop count, and bundled vs. remote-fetched catalog | 16.4 | **Start** | §4, §13 |
| Q5 | Leaderboard backend — reuse the analytics Worker with a new endpoint, or something more structured? | 16.5 | **Start** | §14 |
| Q6 | Exact copy/tone for the offline-triggered notification | 16.7 | Finish | §11 |
| Q7 | Widget: classic `AppWidgetProvider` vs. Jetpack Glance | 16.8 | Finish — default to classic, evaluate briefly first | §12 |
| Q8 | Is `AccessibilityService` escalation ever pursued? | 16.2 | Finish — only if `UsageStatsManager` proves insufficient; explicit sign-off required | §9.4 |
| Q9 | Nudge screen copy/tone sign-off | 16.2 | Finish | §19 |

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

**Still unverified (carry into 16.1's testing):** paywall price rendering — the path that actually exercises the changed `queryProductDetailsAsync` — plus a fresh purchase of `pro_lifetime` / `ocr_vision` and silent `USER_CANCELED` handling. Restore purchases exercises `queryPurchasesAsync`, which did **not** change in v9, so it is weaker evidence than it appears.

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

**Status:** Not started — unblocked; Q2/Q8/Q9 needed to finish · **Ref:** §9, §1.6 · **Size:** XL — largest single feature in Phase 16

**Why:** The core mechanic of the pivot (§0.1). Redirects time in distracting apps toward reading.

**🚨 Non-negotiable:** Every nudge screen shows a one-tap "Continue to [App] anyway", always visible, never behind a timer or a second tap. §21 calls this a product/legal rule, not a style preference — no future task overrides it without a logged product-owner decision.

**Build order** (per §19; each sub-step is independently reviewable)
- [ ] **B1 — Target-app picker.** `nudge-apps.js`: list installed apps, select targets, persist to localStorage (`fr_` prefix, §21). Free = 1 app; subscriber = unlimited (gate on `isSubscriber` from 16.1).
- [ ] **B2 — Detection plugin.** `FlowReadNudgePlugin.java` wrapping `UsageStatsManager`. Battery-conscious polling interval — **no tight loops** (§21). `AccessibilityService` is fallback-only and needs Q8 sign-off first.
- [ ] **B3 — Trigger logic.** `nudge.js`: cumulative daily time per target app; fire only past a threshold (Q2); daily cap per app; back off for the rest of the day after 3 consecutive dismissals (§9.3).
- [ ] **B4 — Nudge screen.** New `#view-nudge` in `www/index.html`. Calm, not alarming (§16). "Start reading" → **Page mode** (§5, §9.5), resuming the in-progress book, or Free Books if none — never an empty import screen.
- [ ] **B5 — Scoped unlock.** Meeting the threshold unlocks **only the originally-requested app**; other targets keep their own independent thresholds (§9.7).
- [ ] **B6 — Analytics.** `analytics-ping.js`: `logEvent(name, meta)`, fire-and-forget `fetch()` to a Cloudflare Worker, wrapped in try/catch, silent failure, **never blocks a user action**. No device/user ID, no filename, no reading content (§1.4, §9.6). Minimum events: `app_opened`, `nudge_shown`, `nudge_read_started`, `nudge_read_completed`, `nudge_skipped`, `free_book_downloaded`, `pro_purchased`, `subscription_started`, `subscription_cancelled`.
- [ ] Onboarding must walk the user to the correct system settings page for the Usage Stats permission — it's a special permission, not a runtime dialog (§9.4). Coordinate with 16.3.
- [ ] Skipping never penalizes: no guilt copy, no broken-streak framing, no anxiety timers (§9.1, §9.2.7).
- [ ] Privacy policy updated to disclose the analytics pings (§9.6).
- [ ] All strings via `t()` into `en.json` + `hi.json` from day one (§17).
- [ ] **Product-owner review of nudge copy/tone before finalizing** (Q9).

**Files:** NEW `android/app/src/main/java/com/flowread/app/FlowReadNudgePlugin.java` · NEW `www/js/features/nudge.js`, `nudge-apps.js`, `analytics-ping.js` · `www/index.html` (feature scripts ~L86–94, views ~L38–56) · `www/js/views/settings.js` · `www/i18n/*.json` · `AndroidManifest.xml` (`PACKAGE_USAGE_STATS`)

**Done when:** Selecting a target app, exceeding its daily threshold, and reopening it produces a calm nudge with a working escape hatch; reading to threshold unlocks that app only; all events fire; works offline (pings fail silently).

**Re-test note:** §3.2 warns `UsageStatsManager` behavior shifts between API levels. Since this is built *after* the API 36 bump, test against 36 directly — but re-verify on any future SDK bump.

---

## Task 16.3 — Onboarding redesign

**Status:** Not started — unblocked; Q3 needed to finish · **Ref:** §10 · **Blocked by:** 16.2 (needs the nudge flow to hand off to) · **Size:** L

**Why:** Current onboarding is RSVP-calibration-first, built entirely under the pre-pivot speed-reading identity. Full-surface redesign, not a copy tweak.

**Steps**
- [ ] Extract `renderOnboarding()` (currently `views/settings.js:176`) into a new `www/js/views/onboarding.js`; register it in `index.html` and keep the `app.js:91` routing intact.
- [ ] Lead with the **reading-habit** pitch. Engines stay in the app and may still be introduced, but de-emphasized.
- [ ] Explain the nudge concept in plain language **before** any permission ask — the user must understand *why* FlowRead watches for app-opens before being sent to a settings page. Poor framing here tanks grant rates and trust.
- [ ] Build the inline-vs-deferred permission ask as a **config flag** (Q3), not a hardcoded choice. Flag for product-owner review before calling this done (§10.2).
- [ ] End on Free Books — the user finishes already reading, or one tap from it. No empty import screen.
- [ ] Keep an honest-limitations screen, repositioned to fit the new narrative rather than removed (§1.5, §10.1).
- [ ] Every string through `t()` into `en.json` + `hi.json` **from day one**, not retrofitted (§17, §10.1).

**Files:** NEW `www/js/views/onboarding.js` · `www/js/views/settings.js` (remove onboarding) · `www/js/app.js` · `www/index.html` · `www/js/storage.js` · `www/i18n/*.json` · `www/css/components.css`

**Done when:** A fresh install reaches "reading something" without touching the import screen, Hindi is complete, and the permission-flow variant is toggleable.

---

# Block C — Independent features (any order after Block A)

## Task 16.9 — Home screen reorder (friction fix)

**Status:** Not started — unblocked · **Ref:** §19 · **Size:** S — **ship this first in Block C**

**Why:** In-progress books sit below the import grid; resuming a read is the most common action and currently requires scrolling past import options.

**Steps**
- [ ] In `renderUpload()` (`www/js/views/upload.js:3`), move `#library-section` (currently ~L105) above `.import-grid` (~L19) — and above the Free Books featured card (`#btn-free-books`, ~L21).
- [ ] Verify `renderLibrary()` (`upload.js:1553`) and the re-render call sites (`upload.js:158`, `:232`) still resolve.
- [ ] Check spacing/safe-area on a small device; empty-library state must still look intentional.

**Files:** `www/js/views/upload.js` · `www/css/components.css`
**Done when:** Home opens with in-progress books first, both with and without a library, on a real device.

---

## Task 16.7 — Offline-triggered reading notification

**Status:** Not started — unblocked; Q6 needed to finish · **Ref:** §11 · **Size:** S–M

**Why:** Going offline is a natural reading moment. Third notification type, connectivity-triggered rather than time-of-day.

**Steps**
- [ ] `npm i @capacitor/network` (**approved 2026-09-16**) — match the major to whatever 16.0a lands on.
- [ ] Listen for the online→offline transition. Read-only status listener, no other use (§2).
- [ ] Add `NOTIF_OFFLINE = 1003` alongside the existing `NOTIF_PRIMARY = 1001` / `NOTIF_STREAK = 1002` (`notifications.js:11`).
- [ ] **Reuse** the existing helpers rather than writing new logic: `_hasReadToday()` for suppression, `_activeProgressFile()`, `_isSameDay()`, and the established `reschedule()` / `_cancelAll()` patterns.
- [ ] Anti-spam (§11): throttle to once per few hours, suppress if the daily reading threshold is already met, never fire while the app is foregrounded, ignore brief connectivity blips.
- [ ] Copy is Q6 — light, not preachy, consistent with "nudge not wall" (§1.6).
- [ ] New keys in `en.json` + `hi.json`.

**Files:** `package.json` · `www/js/features/notifications.js` · `www/js/views/settings.js` (toggle) · `www/i18n/*.json`
**Done when:** Airplane-mode toggling fires at most one notification per throttle window, never when already read today, never in foreground.

---

## Task 16.6 — Share stats feature

**Status:** Not started — unblocked · **Ref:** §15 · **Size:** M
Prioritized partly as a **distribution** mechanic — the product's current bottleneck is distribution, not retention (§22).

**Steps**
- [ ] `npm i @capacitor/share` (**approved 2026-09-16**).
- [ ] **Both** entry points required: (1) an always-available Share button on the dashboard; (2) a milestone-triggered prompt on book completion ("You finished [Book] — share it?").
- [ ] Generate the card entirely on-device via Canvas. No server, no upload (§1.4).
- [ ] **Hero-metric framing**, one strong stat per card — not a dense multi-stat dump.
- [ ] App branding on the image: tasteful and small, not a loud ad.
- [ ] Per-item toggles so the user edits what's included before sharing.
- [ ] Lay out with a future "time reclaimed" stat in mind (e.g. "You chose reading over Reddit 14 times this week") — not in v1, but the layout shouldn't need rebuilding to add it once 16.2 ships.
- [ ] Share via the native share sheet — inherently supports any installed app.
- [ ] Palette/typography exactly per §16. New i18n keys both languages.

**Files:** `package.json` · NEW `www/js/features/share-stats.js` · `www/js/views/dashboard.js` · `www/index.html` · `www/i18n/*.json`
**Done when:** Both entry points produce a shareable image through the native sheet, on-brand, with working toggles.

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

## Task H3 — Notifications fail silently when exact-alarm permission is denied

**Status:** Not started · **Ref:** §1.5 ("never silently fail"), §11 · **Size:** S · **Found:** 2026-09-16 while device-verifying 16.0a

**Why:** `notifications.js:196` uses `allowWhileIdle: true` (exact alarms). Android denies `SCHEDULE_EXACT_ALARM` by default for apps targeting 33+. Line 221 swallows the resulting failure in `catch (_) {}`, so a user who hasn't granted it gets **no reminders and no indication why**. This directly violates §1.5's "never silently fail" principle. Pre-existing — not introduced by the API 36 bump — but the bump makes it more likely to bite.

**Steps**
- [ ] Detect whether exact alarms are permitted (`AlarmManager.canScheduleExactAlarms()` on API 31+) before scheduling.
- [ ] If denied, either fall back to inexact scheduling (a reading reminder does not need to-the-minute precision — this is likely the right answer) or surface a plain-language prompt to the settings page.
- [ ] Stop swallowing the exception at line 221 — at minimum log it, and reflect the real state in the settings toggle.
- [ ] Reconsider whether `allowWhileIdle`/exact alarms are warranted at all here. Inexact alarms need no special permission and suit a daily reading nudge.
- [ ] Any new user-facing string goes into `en.json` + `hi.json` (§17).

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
| **B — Pivot core** | 16.2, 16.3 | Unblocked. 16.2 is the largest item in Phase 16; 16.3 depends on it. |
| **C — Features** | 16.9, 16.7, 16.6, 16.8, 16.4, 16.5, 16.10 | Unblocked. 16.9 smallest, ship first. 16.4/16.5 need Q4/Q5 answered before starting. |
| **D — Housekeeping** | ✅ H1, ✅ H2 · H3 open | H3 is a live bug shipping to users and blocks 16.7 cleanly. |

**Suggested next:** H3 (small, fixes a shipping §1.5 violation, unblocks 16.7) or 16.9 (smallest user-visible win), then 16.1 once pricing lands, then 16.2 as the main pivot effort.

**Standing rules that apply to every task above:** every new string through `t()` into both `en.json` and `hi.json` from day one (§17) · no new dependencies without asking (§21) · purchase/subscription state in Capacitor Preferences, never localStorage (§21) · `fr_` prefix on all localStorage keys · palette and typography exactly per §16 · the nudge escape hatch is never removed (§9.1, §21).
