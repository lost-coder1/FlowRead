# FlowRead — Build Manual for Claude Code

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> Single source of truth. If something isn't covered here, ask the user before improvising.
> This document was substantially rewritten to reflect a strategic pivot (see Section 0.1) and to capture urgent Play Store compliance requirements (Section 3). Older phase-by-phase implementation notes for already-shipped work have been compressed into Section 18 ("Work Completed So Far") — the code itself is the source of truth for exact implementation details of completed work; this file specifies what's still being built and why.

---

## 0. Project Identity

**Name:** FlowRead
**Pitch (current):** Build a daily reading habit. FlowRead nudges you to read instead of scroll — pick the apps that distract you, get a gentle prompt to read first, you're always in control.
**What:** A reading-habit app for Android. Speed reading (5 engines), a curated free-books library, and a habit-interception system that gently redirects time spent in distracting apps (Instagram, Reddit, etc.) toward reading. Privacy-first — offline reading, no account, files never leave the device.
**Target user:** Anyone who wants to read more and scroll less. Broader than the original target — no longer positioned as a tool specifically for PDF power-readers, though that use case is fully retained.

### 0.1 The Pivot — Why This Changed

FlowRead launched as a speed-reading app for PDFs ("Read everything faster. No subscription, no cloud, no account."). Real-world results after launch showed this positioning had a low ceiling:

**What did NOT change:** the underlying reading engines, the cleaning engine, the bridge feature, the Free Books library, offline-first architecture, no-account principle, and privacy-by-architecture. All of this is retained and remains genuinely differentiated — no direct competitor combines PDF-native reading + a two-way original-document bridge + a habit-interception mechanic.

**What changed:** the headline positioning (habit-building, not speed-reading), the addition of a habit-interception ("nudge") system as a new core mechanic, the onboarding flow (Section 10), and the business model (lifetime purchase retained, but a subscription tier is now also offered — see Section 4).

**Explicit non-goal:** this is not a hard app-blocker. Every nudge must have a visible, one-tap escape hatch. The product philosophy is "gentle redirect," not "forced compliance" — see Section 9 for the full specification and the reasoning behind this distinction.

---

## 1. Core Principles (Non-Negotiable)

### 1.1 Offline-First (not "100% offline" — be precise)
- No backend for reading. No cloud APIs for parsing. No analytics phoning home for reading behavior.
- All parsing client-side (pdf.js, mammoth.js). All reading data stored locally.
- Exceptions requiring internet, all already true pre-pivot: Pro URL reader (single fetch per article, labelled "requires internet"), Free Books library downloads (one-time fetch from source, then offline forever), Google Play/App Store billing (inherent to IAP).
- **New exception from the pivot:** anonymous, non-personal usage pings (app-opened, book-downloaded, purchase events) to a lightweight analytics endpoint — see Section 9.6. This is opt-out-safe-by-design (fails silently with no internet, never blocks any user-facing action) and sends no personal identifiers.

### 1.2 No Accounts, Ever
No sign-up, login, email, password. Fully functional 1 second after first launch. Pro/Subscription verified via App Store / Play Store receipt only.

### 1.3 Payment Model — Lifetime AND Subscription (changed from original "no subscriptions" principle)
Original principle was one-time-payment-only. **This has changed as part of the pivot.** Reasoning: the subscription tier's value (monthly curated book drops, full habit-interception customization) is recurring by nature — new content and ongoing personalization can't honestly be sold as a one-time purchase. See Section 4 for the full tier breakdown.
- The lifetime purchase option (`pro_lifetime`, `ocr_vision`) is retained and must never be removed — it remains the answer for subscription-averse users and is an explicit differentiator against subscription-only competitors (e.g., Lummi, which offers no lifetime option and no free tier).
- No dark patterns: no hidden trial-to-paid auto-conversion tricks, no forced annual-only pricing, cancellation must be genuinely one tap via platform billing settings.

### 1.4 Privacy By Architecture
Files never touch any server. No reading-content tracking. No file uploads. This is architecture, not a marketing claim. (Usage-pattern pings per 1.1 are the one deliberate, minimal, anonymous exception — never extend this to reading content, file names, or any personal identifier.)

### 1.5 Honest Limitations
Every limitation shown upfront in onboarding. Never silently fail. Errors explained in plain language.

### 1.6 The Nudge Is a Nudge, Not a Wall
Every habit-interception moment must have an immediate, visible, one-tap way to proceed to the original app anyway. No dark patterns to make the escape hatch hard to find. No guilt-based copy. No countdown timers designed to create anxiety. See Section 9.

---

## 2. Tech Stack

- **Framework:** Capacitor 6+
- **UI:** Vanilla HTML + CSS + JavaScript. No React, Vue, Svelte, Alpine, or any framework. No build step.
- **PDF parsing:** pdf.js 3.11.174 (legacy UMD build)
- **DOCX parsing:** mammoth.js 1.8.0
- **Storage:** Capacitor Preferences (Keychain/EncryptedSharedPrefs) for purchase/subscription state. Capacitor Filesystem for file data. localStorage for UI state (all keys prefixed `fr_`).
- **Screen wake:** @capacitor-community/keep-awake@5
- **Network detection (NEW):** @capacitor/network — official Capacitor plugin, needed for Section 11's offline-triggered reading notification. Read-only network status listener, no other use.
- **IAP:** Custom native Capacitor plugin `FlowReadIapPlugin` wrapping Google Play Billing Library. **Must be upgraded off the current version — see Section 3, this is time-sensitive.** Must also be extended for subscription products (Section 4). Do NOT use @capacitor/in-app-purchases.
- **Habit interception (Android):** Requires either `UsageStatsManager` (usage-stats permission, simpler, polling-based, lower battery cost) or `AccessibilityService` (real-time app-open detection, higher reliability, more invasive permission ask, higher Play Store review scrutiny). **Default to `UsageStatsManager` first.** Needs a new custom Capacitor plugin — see Section 9.
- **Home screen widget (NEW, Android):** Native `AppWidgetProvider` + `RemoteViews` — see Section 12. Runs outside the WebView/JS process; reads data the JS side writes via a small native bridge whenever reading position changes.
- **Analytics/attribution:** Anonymous event pings via `fetch()` to a Cloudflare Worker endpoint. No SDK dependency — plain fetch, wrapped in try/catch, silent failure.
- **Fonts:** Roboto (free default), Inter · Source Sans 3 · Open Sans · Lato (Pro/Subscriber, bundled), DM Mono (labels/numbers), Noto Sans Devanagari (UI + content, loaded via Google Fonts link).

**Key folder paths:**
```
www/
  index.html
  css/   base.css · components.css · engines.css · themes.css
  i18n/  en.json · hi.json
  js/
    app.js · state.js · storage.js · i18n.js
    parser/  pdf.js · docx.js · txt.js
    engines/ rsvp.js · chunk.js · scroll.js · focusbold.js · page.js
    views/
      upload.js · reader.js · normal.js · dashboard.js · settings.js · free-books.js
      onboarding.js  — exact current location TBD, onboarding logic may currently live
                        inside app.js/upload.js; confirm actual structure before editing,
                        do not assume this file already exists as a standalone module
    features/
      chapter-detection.js · cleaning.js · bridge.js · keep-awake.js
      purchase.js  (upgrade billing library + extend for subscription products — Section 3, 4)
      notifications.js  (extend with offline-triggered type — Section 11)
      word-tap.js
      nudge.js            — NEW, Section 9 core logic
      nudge-apps.js       — NEW, target-app picker UI + storage
      analytics-ping.js   — NEW, Section 9.6 anonymous event pings
      share-stats.js      — NEW, Section 15 shareable stats card
      leaderboard.js      — NEW, Section 14 opt-in leaderboard + badges
      widget-bridge.js    — NEW, Section 12, pushes reading-position data to the native widget
android/
  app/src/main/java/com/flowread/app/
    FlowReadIapPlugin.java        — upgrade billing library version (Section 3), add subscription support (Section 4)
    FlowReadOcrPlugin.java
    FlowReadDeviceSyncPlugin.java
    FlowReadNudgePlugin.java      — NEW, Section 9, wraps UsageStatsManager
    FlowReadWidgetProvider.java   — NEW, Section 12, AppWidgetProvider
  build.gradle — targetSdk/compileSdk must move to API 36 (Section 3)
```

---

## 3. Urgent Store Compliance — Do This First, Before Other Phase 16 Work

Two Play Console notices received. Both carry hard deadlines and both **block all future app updates** if missed — meaning missing these would also block shipping the pivot itself (Section 0.1). Treat this section as higher priority than the feature work in Sections 9–15, though the Billing Library item should be done *together with* Task in Section 4 (subscription IAP) since both touch the same file.

### 3.1 Google Play Billing Library Deprecation
Play Console warning: the currently-integrated Billing Library version will be deprecated; updates will be rejected after **August 31, 2026** unless upgraded.

- Upgrade `FlowReadIapPlugin.java` to the current supported Google Play Billing Library version before that date. Check the latest stable version at implementation time — do not assume a specific version number without verifying against current Play Billing documentation, since this project has already been burned once by a dependency going stale.
- **Do this as one pass together with Section 4's subscription-support work** — both require touching the same purchase flow code, and the newer Billing Library version is what natively supports subscription products alongside the existing one-time products (`pro_lifetime`, `ocr_vision`).
- Regression-test all existing purchase flows after the upgrade: `pro_lifetime` purchase, `ocr_vision` purchase, restore purchases, and the existing silent-cancel handling (USER_CANCELED must still not show an error toast) — all previously working behavior per Section 18's summary of completed work.

### 3.2 Target API Level — Android 16 (API 36)
Play Console requirement: app must target API level 36 or higher. Current `targetSdk`/`compileSdk` is API 35 (bumped there for a prior Play Store requirement per Section 18).

- Bump `targetSdk` and `compileSdk` to API 36 in `build.gradle`.
- **Regression-test every native plugin after the bump**, not just billing: `FlowReadOcrPlugin`, `FlowReadDeviceSyncPlugin`, and especially the new `FlowReadNudgePlugin` (Section 9) — major Android version bumps frequently change permission models and background-execution restrictions, and `UsageStatsManager`/`AccessibilityService` behavior is exactly the kind of surface that tends to shift between API levels. Test nudge detection specifically after this bump, not just assume it still works.
- `MANAGE_EXTERNAL_STORAGE` re-application (Section 18, still open) and any new permission asks (nudge system, widget) should be evaluated against API 36's current policy, not the API 35-era understanding this project was built under.

### 3.3 Sequencing
Both items have the same deadline and touching-adjacent-code overlap with Section 4 and Section 9. Suggested order: (1) API 36 bump first, fix whatever breaks across existing plugins, (2) Billing Library upgrade as part of building subscription support, (3) proceed with the rest of Phase 16 only once both compliance items are confirmed working on a real device.

---

## 4. Business Model

### Tiers

| Tier | Price | What It Unlocks |
|---|---|---|
| **Free** | $0 | Unlimited PDFs, all 5 reading engines, Free Books library (full catalog, all languages/categories), bridge, dictionary, calm mode, basic dashboard, nudge system limited to **1 selected app**, opt-in leaderboard participation (view only, no badges) |
| **Lifetime Pro** | $9.99 one-time (launch price; PPP-adjusted regionally) | DOCX/TXT/URL support, full dashboard, extra themes/fonts, Google Drive sync, device sync, share extension. Does **not** include unlimited nudge-app selection or monthly book drops — those are subscription-exclusive. |
| **OCR Add-on** | $4.99 one-time (Pro required) | On-device OCR, Latin + Devanagari |
| **Subscription** | TBD monthly/annual price (open item — ask product owner, do not hardcode a number) | Everything in Lifetime Pro + OCR, **plus**: unlimited nudge-app selection (vs 1 for free), nudge scheduling (time-of-day rules), nudge "strict mode," monthly curated book drops (5 books/month placeholder, from legal sources only — Section 13.2), opt-in leaderboard badges + monthly recognition |

**Design intent behind the split:** the free tier must remain genuinely generous. Subscription value must be *recurring* value, never a re-labeling of static value. Lifetime Pro exists permanently as the non-recurring option and must never be discontinued or degraded to push subscription uptake.

### Subscription Value Stack (decided; do not add scope beyond this without asking)
1. Unlimited apps selectable for nudge interception (free tier: 1 app only)
2. Nudge scheduling — active only during user-defined hours/days
3. Nudge "strict mode" — longer/harder bypass for users who want more resistance than the default gentle nudge
4. Monthly curated book drops from legal sources (rotating, not cumulative; exact count TBD)
5. Opt-in leaderboard badges + monthly recognition (free users can view/participate in the leaderboard itself, but badges are subscriber-exclusive)

**Explicitly rejected, do not build:** priority book request fulfillment, early access windows to new Free Books catalog additions, in-app advertising of any kind, Z-Library or any non-legal book sourcing (see Section 13.2 — legal exposure, non-negotiable).

### Task — Subscription IAP (Phase 16)
Extend `FlowReadIapPlugin` and `purchase.js` for a subscription product alongside the existing lifetime products, as part of the Section 3.1 billing-library upgrade pass. Requires: new subscription SKU in Play Console, subscription-state checks distinct from lifetime-purchase checks throughout the paywall/gating logic (a user can have Lifetime Pro without a subscription, or a subscription without ever buying Lifetime Pro — independent entitlements, except where this table says subscription includes everything Lifetime Pro includes). **Final subscription price is an open item — ask product owner before hardcoding.**



---

## 5. Reading Engines

Unchanged from pre-pivot. Five engines, all built on the same word-array/`pageWordIndex[]` position system, fully interchangeable mid-read with no position loss.

**RSVP** — one word at a time, fixed centre position. `60000/wpm` ms per word. 1.8× pause on `.!?` and Devanagari danda `।`, 1.6× on `,;:`. ORP at ~33%, amber `#b8995a`. No flash animation. Comfort controls: A−/A+, ORP toggle, Context, Calm mode.

**Chunk Mode** — 2–7 words per flash (default 3). Delay = `(60000/wpm) × chunkSize`. Scans entire chunk for strongest punctuation pause.

**Focus Bold** — full page, first 40% of each word bold, highlight advances word-by-word. Do NOT call it "Bionic Reading" (trademarked).

**Simple Scroll** — CSS `transform: translateY()`, GPU-composited. Speed multiplier 0.25×–4×.

**Page** (added Phase 15) — same word stream/position system, rendered as swipeable, paginated normal-reading pages. DOM-measured pagination, cached per file/font/viewport. **Default landing engine for any read initiated via the nudge system (Section 9)** — RSVP/Chunk are too high-effort for the moment right after someone was redirected from a distracting app.

---

## 6. PDF Cleaning Engine

Unchanged. Extracts text with positions, groups into lines, detects/strips headers/footers/page numbers/ISBN-DOI/bare URLs, converts tables/images/equations to tappable placeholders, builds `pageWordIndex[]`.

---

## 7. Bridge System

Unchanged. Speed→Normal: floating button, reverse-lookup, opens Normal view at nearest page. Normal→Speed: "▶ Read from here" button. Page mode carries its own embedded bridge button.

---

## 8. Screen Wake Lock

Unchanged. Acquire on entering any reading view / on play. Release on exit, 5-min idle pause, background. Never held outside reading views.

---

## 9. Reading Habit Interception System ("Nudge") — Core Pivot Feature

### 9.1 Philosophy — Nudge, Not Block (non-negotiable)
Explicitly not a hard app-blocker. A soft interception with an always-visible, one-tap escape hatch. Closest reference point: One Sec's model — pause and reconsider, never a wall. Every nudge screen must contain, without exception, a clear one-tap "Continue to [App Name] anyway" action, always visible, never hidden behind a timer or multiple taps. No guilt-based, shaming, or anxiety-inducing copy.

### 9.2 Core Flow
1. User selects target app(s) from installed apps (free: 1 app; subscriber: unlimited).
2. `FlowReadNudgePlugin` monitors for target app(s) being opened.
3. Nudge does not fire on every open — see 9.3.
4. On trigger, show a calm nudge screen ("Read a bit before [App]?") with a "Start reading" action into Page mode (resuming current book, or the Free Books library if none in progress) and the always-visible escape hatch.
5. If reading: track against a user-configurable threshold (default TBD — pages or minutes, expose as a setting, don't hardcode).
6. Once met, **only the originally-requested target app opens**, not the user's whole nudge list (scoped unlock, 9.7).
7. Skipping at any point does not fail or penalize the user — no guilt copy, no broken-streak framing.

### 9.3 Dynamic Triggering — Not Every Open
Track cumulative daily time per target app. Trigger only after a threshold (e.g., 15–20 minutes already spent that day, or 3rd+ open). Daily nudge cap per app. Back off for the rest of the day after 3 consecutive dismissals.

### 9.4 Android Implementation Notes
Default to `UsageStatsManager` (special permission via system settings, not a runtime dialog — onboarding must walk the user to the correct settings page, see Section 10). Poll at a battery-conscious interval; do not poll aggressively. `AccessibilityService` is a fallback only, requiring explicit product-owner sign-off before implementing, given this project's Play Store review history (see Section 18's `MANAGE_EXTERNAL_STORAGE` precedent). No iOS implementation planned.

### 9.5 Reading Mode on Nudge-Entry
Lands in Page mode by default (Section 5). Resumes in-progress book, or opens Free Books library if none — avoids the "empty import screen" drop-off.

### 9.6 Anonymous Event Pings
`analytics-ping.js` — `logEvent(eventName, meta)`, fire-and-forget `fetch()` to a Cloudflare Worker. Never includes a user/device identifier, file name, or reading content. Minimum event set: `app_opened`, `nudge_shown`, `nudge_read_started`, `nudge_read_completed`, `nudge_skipped`, `free_book_downloaded`, `pro_purchased`, `subscription_started`, `subscription_cancelled`. Privacy policy must disclose this.

### 9.7 Scoped App Unlock
When the read-threshold is met, only the specific requested app unlocks — other configured target apps remain subject to their own independent thresholds.

---

## 10. Onboarding Redesign — NEW

The current onboarding (RSVP calibration screen, adaptive difficulty text, speed-reading-first framing per Section 18) was built entirely under the pre-pivot identity. It must be redesigned to match Section 0.1's new positioning. This is a full-surface redesign, not a copy tweak.

### 10.1 Requirements
- **Lead with the reading-habit pitch**, not speed reading. RSVP/Chunk/etc. remain in the app and can still be introduced, but de-emphasized relative to the previous version where RSVP calibration was the centerpiece.
- **Explain the nudge system concept early**, in plain language, before any permission ask — the user needs to understand *why* FlowRead wants to watch for app-opens before being sent to a system settings page to grant the Usage Stats permission. Poor framing here will tank permission-grant rates and trust.
- **Defer the actual permission grant + target-app selection to a "set up later" step if it improves conversion** — getting a special settings-page permission during first-run onboarding is high-friction; consider showing value first (the Free Books library, a first successful read) and prompting the nudge setup once, clearly, but not necessarily blocking the rest of onboarding on it. This is a design judgment call for whoever builds it — flag it, don't force a single approach without testing.
- **Free Books library as the "start reading immediately" moment** — onboarding should end with the user either already reading something or one tap away from it, not staring at an empty import screen.
- **Fully localized in Hindi from day one of the rebuild** — every onboarding string goes through `t()` into both `en.json` and `hi.json` from the start, not retrofitted after an English-only build (see Section 17, i18n rules).
- **Retain the honest-limitations principle** (Section 1.5) — a limitations screen still belongs somewhere in or right after onboarding, just repositioned to fit the new narrative rather than removed.

### 10.2 Open Design Question
Whether the nudge permission ask is inline in first-run onboarding or deferred to a later "getting started" prompt is not decided — implement with this as a configurable/testable point, not a hardcoded assumption, and flag for product-owner review before considering this task done.

---

## 11. Offline-Triggered Reading Notification — NEW

Extends the existing notification system (`notifications.js`, already shipping two types: primary daily reminder id `1001`, streak-protection nudge id `1002` — see Section 18). Adds a third trigger type, based on connectivity rather than time-of-day.

### Requirements
- Use `@capacitor/network` (new dependency, Section 2) to listen for a transition to offline status.
- On detecting offline, show a local notification along the lines of "No internet? Good time to read." — exact copy TBD, keep it light, not preachy, consistent with the "nudge not wall" tone (Section 1.6) even though this is a notification rather than the in-app nudge screen.
- **Must not spam.** Apply the same discipline already established for the existing notification types: throttle to a reasonable maximum (e.g., once per few hours, not on every brief connectivity blip), suppress if the user already met their daily reading threshold (reuse the existing suppression logic from the primary daily reminder), and do not fire if the app is currently open/in foreground.
- Use a new notification ID (e.g., `1003`) distinct from the existing two, and follow the same reschedule/cancel patterns already established in `notifications.js`.
- New i18n keys in both `en.json` and `hi.json`.

---

## 12. Home Screen Widget — NEW, Android Only

### Requirements
- Android home-screen widget (`AppWidgetProvider` + `RemoteViews`) showing the user's most recent in-progress book — title, and reasonable progress indication (percentage or similar, keep it simple/legible at widget scale).
- Tapping the widget deep-links directly into the app, opening that specific book at its last saved position, in the user's preferred/last-used reading engine — not just opening the app to the home screen. This needs a deep-link/intent-extra mechanism so `app.js` can detect on cold start "opened from widget with fileId X" and route straight to the reader.
- **Data flow:** the widget process runs outside the WebView/JS context and cannot read app state directly. The JS side (`widget-bridge.js`) pushes the current in-progress book's data to native storage via a small bridge method whenever reading position saves (event-driven, not polled — battery-friendly, consistent with the project's existing performance discipline in Section 17).
- New native component `FlowReadWidgetProvider.java`.
- Android only — no iOS equivalent planned (consistent with the project's current Android-first status, Section 22).

### Open Implementation Decision
Classic `AppWidgetProvider`/`RemoteViews` vs. Jetpack Glance — default to the classic approach for consistency with the project's existing native-plugin style (Java, no additional Jetpack/Compose dependencies introduced elsewhere in the codebase), but flag this as worth a quick evaluation before committing, not a forced decision.

---

## 13. Free Books Library

### 13.1 Status
Implemented (Phase 15). ~90 curated books, region-aware sorting, language tabs, category filters, auto-OCR for catalog entries, full i18n.


### 13.3 Known Issue
Catalog entries with `fileType: "html"` currently fail with a download error — needs review/replacement with direct file URLs. How to fix this?

---

## 14. Leaderboard & Badges — Planned, Not Yet Built

**Opt-in only, never default-shown.** Monthly reset, no permanent ranking. Free users can view/opt into the leaderboard; badges are subscriber-exclusive (Section 4). Explicitly rejected: default-visible leaderboards, permanent rankings, competitive-pressure framing.

Badges tie to the monthly curated book drops — start with 1-2 badge types, expand only if usage data supports it. A Lummi-style mascot/persona-leveling layer was considered and rejected as tonally inconsistent with FlowRead's calmer brand and its more serious catalog content (Ambedkar, Phule, etc.) — if gamified identity is revisited, tie it to *what a user reads*, not a generic unrelated game mechanic. Not scoped for current implementation.

**Needs a lightweight backend beyond the anonymous analytics pings (Section 9.6)** — a leaderboard requires actual opt-in, user-chosen-name records, not just anonymous counts. Clarify with product owner whether this reuses the same Cloudflare Worker infrastructure with a new endpoint, or needs something more structured.

---

## 15. Share Stats Feature — Planned, Not Yet Built

Elevated in priority because it doubles as a distribution mechanic, not just retention — relevant given the product's current distribution-bottleneck stage (Section 22).

### Requirements
- **Two entry points, both required:** (1) a visible "Share" button on the dashboard, always available, not just milestone-triggered; (2) a milestone-triggered prompt (e.g., "You finished [Book] — share it?") for natural completion moments, which convert better than a buried button alone.
- Generate the card entirely on-device (Canvas API) — no server, no upload.
- Must include app name/branding on the image itself, tasteful and small, not a loud ad.
- User-editable before sharing: simple per-item toggle for which books/achievements to include.
- **Hero-metric framing, not a data dump** — one strong stat per share ("Finished Annihilation of Caste in 4 days 🔥 12-day streak") rather than a dense multi-stat screenshot.
- **Design with a future "time reclaimed" stat in mind** once Section 9's nudge system is live (e.g., "You chose reading over Reddit 14 times this week") — not required for v1, but the card layout shouldn't need to be rebuilt to add it later.
- Share via native share sheet (`Capacitor.Share`) — this inherently supports sharing to any installed app the user chooses, no platform-specific restriction needed.
- Design: warm, on-brand, large readable text, one achievement per share image.

---

## 16. UI Design System

```css
:root {
  --bg: #0d0d0d;  --surface: #141414;  --surface-2: #1c1c1c;  --border: #2a2a2a;
  --accent: #e8c547;  --accent-2: #c47a3a;
  --text: #e8e4dc;  --text-muted: #6b6660;  --text-dim: #3a3632;
  --rsvp-stage-bg: #161410;  --page-stage-bg: #161812;  --rsvp-orp: #b8995a;
  --success: #5a9a6a;  --error: #c45a3a;
}
```

No pure black/white anywhere text appears. Border radius 2–4px (max 6px), no pill buttons. Animations 0.12–0.2s hover, 0.3s view transitions, no bounce, no RSVP flash. Fonts per Section 2.

**New surfaces (nudge screen, onboarding, leaderboard, share-card, widget) must follow this system exactly** — no new palette, no new typography scale. The nudge screen especially must feel calm, not alarming — it's interrupting a habitual action; jarring visuals work against the "gentle redirect" philosophy (Section 9.1).

---

## 17. i18n Rules (Permanent — Apply to All Future Work)

Every new UI string uses `t('key')` — never hardcode English. Add keys to both `en.json` and `hi.json` together; product owner supplies Hindi. Dynamic strings use `{placeholder}` syntax. Terms kept in English/Roman regardless of language: WPM, PDF, DOCX, TXT, OCR, RSVP, and all engine mode names (RSVP, Chunk, Focus Bold, Scroll, Page).

**This applies to every new section in this document** — nudge screen, onboarding rebuild, offline notification, widget, leaderboard, badges, and share-card all need `en.json`/`hi.json` keys from day one of implementation.

---

## 18. Work Completed So Far (Summary)

Phases 0–15 are functionally complete and shipped (Android versionCode 24–28, versionName 1.2–1.4.1 as last recorded). This section summarizes what exists; consult the codebase for implementation specifics.

**Core reading product (Phases 0–10):** PDF/DOCX/TXT/URL import, 4 original reading engines, cleaning engine, bi-directional bridge, chapter detection, auto-resume, screen wake lock, RSVP-calibration onboarding (now superseded — see Section 10).

**Phase 11 — Sync & sharing:** Android device file sync (MediaStore-based, after `MANAGE_EXTERNAL_STORAGE` removal per a Play Store policy rejection — re-application strategy documented, still open), share-sheet URL intent, global error boundaries.

**Phase 12 — OCR, dictionary, dashboard:** On-device OCR (ML Kit, Latin + Devanagari, custom plugin), 82k-word offline dictionary, Pro dashboard v1, "Open with PDF" intent, Paste Text reader, camera/gallery import.

**Phase 13 — Store launch polish:** Safe-area insets, wake-lock fix, ORP/ligature fixes, hardware back-button handling, real Google Play Billing integration (now needing the Section 3.1 upgrade), legacy Indic font detection with OCR recovery, Hindi danda pause support, numerous smaller fixes. Android store setup complete; iOS store setup not started.

**Phase 14 — Deferred items, still open:** `MANAGE_EXTERNAL_STORAGE` re-application, background OCR Foreground Service, SAF folder-picker fallback. ("Share reading stats" item here is superseded by Section 15 above.)

**Phase 15 — Feedback-driven UX & India expansion (functionally complete, some device testing still open):** Full Hindi i18n system (~240 keys), settings page restructure, additional reading fonts (Inter, Source Sans 3), word-tap action setting, notification system v1 (daily reminder + streak nudge — now being extended per Section 11), Page mode (fifth engine, device testing pending), Free Books Library (Section 13), India Custom Store Listing plan (not yet executed, messaging needs revision — see below).

**Why Phase 15's India-specific messaging is now superseded:** Phase 15 was built under the original "speed reading + privacy" identity. The Free Books library, Hindi localization, and India CSL plan remain equally or more relevant under the new "reading habit" identity — but the India CSL *copy* originally planned should lead with the habit/nudge angle rather than the original framing, per real-world feedback that the original angle underperformed with a real test audience. Do not treat old India CSL copy drafts as final.

---

## 19. Current Phase — Phase 16: Reading Habit Pivot

All items below are net-new, motivated by Section 0.1. **Tasks 16.0a and 16.0b (Section 3) take priority over everything else in this list** due to their hard deadline and blocking consequences.

- [ ] **Task 16.0a — API 36 target bump** (Section 3.2)
- [ ] **Task 16.0b — Billing Library upgrade** (Section 3.1), combined with:
- [ ] **Task 16.1 — Subscription IAP** (Section 4)
- [ ] **Task 16.2 — Habit Interception System ("Nudge")** (Section 9) — largest single feature item. Suggested build order: target-app picker UI → `FlowReadNudgePlugin` detection → dynamic trigger logic → nudge screen UI → scoped unlock → analytics pings wired throughout. Get product-owner review of nudge screen copy/tone before finalizing.
- [ ] **Task 16.3 — Onboarding Redesign** (Section 10)
- [ ] **Task 16.4 — Monthly Curated Book Drops** (Section 4, Section 13 pipeline) — rotation/update mechanism (bundled vs. remote-fetched catalog) needs product-owner input.
- [ ] **Task 16.5 — Opt-In Leaderboard & Badges** (Section 14)
- [ ] **Task 16.6 — Share Stats Feature** (Section 15)
- [ ] **Task 16.7 — Offline-Triggered Reading Notification** (Section 11)
- [ ] **Task 16.8 — Home Screen Widget** (Section 12)
- [ ] **Task 16.9 — Home Screen Reorder (Friction Fix)** — move active/in-progress files to the top of the home screen, above Free Books and the import grid. Small, self-contained, ship independently and early.
- [ ] **Task 16.10 — India Custom Store Listing (messaging revision)** — Play Console config task, no app code. Revise to lead with the habit/nudge angle. Still needs two missing screenshots (Free Books catalog, Page mode) captured before it can ship.

### Open items requiring product-owner input during Phase 16
- Exact nudge default thresholds (screen-time-before-nudge, pages/minutes-to-unlock)
- Subscription pricing
- Monthly book-drop count and catalog-update mechanism (bundled vs. remote-fetched)
- Leaderboard backend approach
- Whether `AccessibilityService` escalation is ever pursued (explicit sign-off required)
- Whether the nudge permission ask is inline in onboarding or deferred (Section 10.2)
- Exact copy/tone for the offline-triggered notification (Section 11)
- Widget implementation approach — classic AppWidgetProvider vs. Jetpack Glance (Section 12)


## 21. Code Rules

### Architecture
Vanilla JS only. No frameworks, no build step. No external runtime dependencies beyond pdf.js, mammoth.js, and Capacitor plugins listed in Section 2. No npm utility packages. No CSS frameworks.

### Storage
Never localStorage for purchase/subscription state — always Capacitor Preferences. localStorage fine for: position, WPM, theme, UI state, nudge target-app list, nudge thresholds. All keys prefixed `fr_`.

### Performance
No layout thrashing during playback; word stage must repaint at 600+ WPM. Lazy-render PDF canvas pages. `requestAnimationFrame` for scroll/page-transition animation. Build spans once, manipulate classes during playback. **Nudge detection must be battery-conscious** — no tight polling loops, no unnecessary wake locks outside active reading views. **Widget updates must be event-driven** (pushed on position-save), not polled.

### UX
Reading position is sacred — every navigation calls `savePosition()`. Never more than one modal at a time. Always show loading state for operations over 200ms. Never show raw exception text to user. **Nudge screens must always show the escape hatch (Section 9.1)** — this is a product/legal rule, not a style preference; do not let any future task override it without an explicit logged product-owner decision.

### Style
Functions: verbs. State: nouns. Files single-purpose. Comments explain *why* not *what*.

### When to stop and ask
Before any new dependency. Before changing palette or typography. Before adding any new file format. Before changing pricing (including the undetermined subscription price). Before adding features not listed here. Before escalating nudge detection to `AccessibilityService`. Before sourcing any Free Books/book-drop content from anything other than the verified-legal sources in Section 13.2. Before finalizing the onboarding permission-flow design (Section 10.2) without product-owner review.

---

## 22. Project Status

- **Current phase:** Phase 16 — Reading Habit Pivot (Section 19)
- **Immediate priority:** Section 3 compliance items (Billing Library upgrade, API 36 target) — hard deadline August 31, 2026, blocking for all future updates.
- **Android versionCode:** 28 (versionName "1.4.1") as last recorded — verify against actual Play Console/build state before assuming current.
- **Target platforms:** Android first. iOS store setup not started. No iOS path planned for the nudge system or home screen widget specifically.
- **Target launch of pivot:** TBD — quality over speed.
- **Distribution context (for product decisions, not implementation):** the product is currently in a distribution-bottleneck stage, not a retention or monetization-bottleneck stage — this is why the share-stats feature (Section 15) is prioritized partly for distribution value, and why Phase 16 favors mechanics with plausible organic/viral reach alongside pure retention plays.

*This document is the contract. Update it before changing direction, not after.*