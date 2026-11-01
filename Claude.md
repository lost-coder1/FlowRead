# FlowRead — Build Manual for Claude Code

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> The contract. If something isn't covered here, ask the user before improvising.
>
> **Three documents, one rule for which is which:**
> - **`Claude.md`** (this file) — what the product *is* and the constraints that bind it. Spec and
>   reasoning, not status. Rewritten for the pivot (§0.1); §18 summarises shipped phases, and the
>   code is the authority on their details.
> - **`Tasks.md`** — the live board. What is open, what it waits on, and every decision taken.
> - **`Tasks-archive.md`** — completed work and resolved device findings. Nothing in it is current.
>
> **The split rule:** anything that would change a future decision belongs here or in `Tasks.md`;
> a record of an action already taken belongs in the archive. Status narrative does not belong in
> this file.

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

- **Framework:** Capacitor 8 (8.5.2 as of 1.4.5). Keep every `@capacitor/*` package on the same major — mixed majors do not work. Requires JDK 21 and Node ≥22 (Section 3.3).
- **UI:** Vanilla HTML + CSS + JavaScript. No React, Vue, Svelte, Alpine, or any framework. No build step.
- **PDF parsing:** pdf.js 3.11.174 (legacy UMD build)
- **DOCX parsing:** mammoth.js 1.8.0
- **Storage:** Capacitor Preferences (Keychain/EncryptedSharedPrefs) for purchase/subscription state. Capacitor Filesystem for file data. localStorage for UI state (all keys prefixed `fr_`).
- **Screen wake:** @capacitor-community/keep-awake@8
- **Native share sheet:** @capacitor/share 8.0.2 — installed 2026-09-25 for Section 15. Outbound share only. Adds no permission to the merged manifest and reuses the `${applicationId}.fileprovider` already declared in `AndroidManifest.xml`.
- **Network detection:** @capacitor/network 8.0.1 — installed 2026-09-16 for Section 11's offline-triggered reading notification. Read-only network status listener, no other use. Adds only `ACCESS_NETWORK_STATE` to the merged manifest.
- **IAP:** Custom native Capacitor plugin `FlowReadIapPlugin` wrapping Google Play Billing Library **9.1.0** (upgraded from 7.1.1 in 1.4.5, Section 3.1). Still needs extending for subscription products (Section 4). Do NOT use @capacitor/in-app-purchases.
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
      onboarding.js  — Section 10's rebuild (Task 16.3, 2026-11-01). Extracted out of
                        views/settings.js, which no longer contains any onboarding code.
                        Still flagged by fr_onboarding_complete (storage.js) and routed
                        from app.js via the same renderOnboarding() entry point.
    features/
      chapter-detection.js · cleaning.js · bridge.js · keep-awake.js
      purchase.js  (extend for subscription products — Section 4; billing library upgrade done)
      notifications.js  (extend with offline-triggered type — Section 11)
      word-tap.js
      nudge.js            — Section 9 core logic
      book-cover.js       — NEW, Section 15 cover thumbnails (PDF page one, offline)
      nudge-apps.js       — NEW, target-app picker UI + storage
      analytics-ping.js   — NEW, Section 9.6 anonymous event pings
      share-stats.js      — Section 15 shareable stats card (built 2026-09-25)
      leaderboard.js      — NEW, Section 14 opt-in leaderboard + badges
      widget-bridge.js    — NEW, Section 12, pushes reading-position data to the native widget
android/
  app/src/main/java/com/flowread/app/
    FlowReadIapPlugin.java        — on Billing 9.1.0; add subscription support (Section 4)
    FlowReadOcrPlugin.java
    FlowReadDeviceSyncPlugin.java
    MainActivity.java
    FlowReadNudgePlugin.java      — NEW, Section 9, wraps UsageStatsManager
    FlowReadWidgetProvider.java   — NEW, Section 12, AppWidgetProvider
  variables.gradle — compileSdk/targetSdk/minSdk live HERE, not in app/build.gradle
  app/build.gradle — versionCode/versionName, ML Kit + Billing deps
  gradle.properties — UNTRACKED, pins org.gradle.java.home to JDK 21 (Section 3.3)

NOTE: .gitignore ignores android/ wholesale; hand-edited files are force-added
individually (git add -f). If you create a new native source file, force-add it or
it will silently never be committed.
```

---

## 3. Store Compliance — RESOLVED, shipped in 1.4.5 (versionCode 32), 2026-09-16

Both Play Console notices are cleared. Retained as a record of what was done and why, not as outstanding work. **Historical note worth keeping:** the Aug 31 2026 deadline was *missed* — it had already passed when this work began on 2026-09-16, leaving the app unable to publish any update. A Play Console extension (Policy status → extension form, available until Nov 1 2026) covered the gap. The lesson is that a dated compliance item in this document needs acting on well before the date, not at it.

### 3.1 Billing Library 7.1.1 → 9.1.0 — done

Went past the required v8 minimum because v8 carries all the breaking changes and v9 removed no
APIs, so the migration cost was identical and the runway longer. One source change was needed:
`queryProductDetailsAsync` now returns `QueryProductDetailsResult` — call `getProductDetailsList()`,
and products Play cannot fetch come back separately via `getUnfetchedProductList()` rather than
being silently absent. **Surface those rather than letting a missing product fail silently** (16.1
now does).

### 3.2 Target API 36 — done

`compileSdk`/`targetSdk` 35 → 36, verified on a real Android 16 device.

- **These live in `android/variables.gradle`, not `android/app/build.gradle`.** The earlier text
  here was wrong and cost time.
- **Not a one-line bump, and budget the same next time.** compileSdk 36 needs AGP ≥8.9, which
  Capacitor 6 does not ship, so it required Capacitor 6.2.1 → 8.5.2 across every `@capacitor/*`
  package plus keep-awake, AGP 8.2.1 → 8.13.0, Gradle 8.2.1 → 8.13, and Java 17 → 21.
- **`minSdk` 22 → 24** is forced by `org.apache.cordova:framework:14.0.1`, which Capacitor 8 pulls
  in. Dropped ~1,641 device models. The Cordova bridge is an empty shell here (zero Cordova
  plugins), but Capacitor 8 officially requires 24 and `npx cap sync` regenerates the module, so
  an override would silently revert.
- `MANAGE_EXTERNAL_STORAGE` re-application (§18) is still open and should be evaluated against
  API 36 policy.

### 3.3 Build environment (required to build this project at all)
- **JDK 21.** Capacitor 8's `capacitor-android` sets `sourceCompatibility 21` *without* a toolchain, so Gradle must genuinely run on 21 — toolchain config alone will not do it.
- **Node ≥22** for the Capacitor 8 CLI.
- `android/gradle.properties` pins `org.gradle.java.home` and is **untracked** (machine-specific path), so every new machine and any CI must set it. Android Studio overrides it with its own Gradle JDK setting and must be pointed at JDK 21 separately; AGP 8.13 also needs Android Studio 2025.1.3 or newer.
- **`android/.gradle/config.properties` is a second, separate JDK pin — and it wins in Android Studio.** When Studio's `gradleJvm` is `#GRADLE_LOCAL_JAVA_HOME` (the default, in `android/.idea/gradle.xml`), it reads `java.home` from that file and **ignores `org.gradle.java.home`**. A stale pin there produces `Cause: error: invalid source release: 21` on a Studio build while the identical terminal build succeeds — which is exactly how it presents, and why it looks like a code error rather than a toolchain one. Hit on 2026-09-16: the file still pointed at JBR 17 from before the Capacitor 8 upgrade. Both files must name JDK 21. Homebrew installs JDK 21 keg-only, so `/usr/libexec/java_home` cannot see it and Studio's JDK dropdown will not list it — add it by path: `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

---

## 4. Business Model

### Tiers

**Prices decided 2026-10-30.** The earlier split — Pro at $9.99, OCR as a $4.99 add-on, and a
subscription holding the only unlimited nudge access — is superseded.

| Tier | Price | What It Unlocks |
|---|---|---|
| **Free** | ₹0 | Unlimited PDFs, all 5 reading engines, Free Books library (full catalog, all languages/categories), bridge, dictionary, calm mode, basic dashboard, nudge system limited to **1 selected app**, opt-in leaderboard participation (view only, no badges) |
| **Lifetime** | **₹2,999** one-time — the existing `pro_lifetime`, **repriced and widened**, not a new product | Everything that exists today: Pro *and* OCR *and* unlimited nudge-app selection. Does **not** include future monthly book drops. |
| **Subscription** `flowread_plus` | **₹149/month** or **₹999/year** | Everything the lifetime tier unlocks, **plus** what is recurring by nature: monthly curated book drops (from legal sources only — Section 13.2), nudge scheduling, nudge "strict mode," leaderboard badges + monthly recognition |
| **OCR Add-on** (`ocr_vision`) | **Retired from sale** | Folded into the lifetime tier. Deactivated for new purchases, but **must keep resolving forever** for anyone who bought it — Play will not delete a product with purchases, and §1.3 forbids withdrawing what someone paid for. |

**Implemented 2026-11-01:** `hasOcrAccess()` answers yes to an `ocr_vision` purchase first, then to either paid tier — so a legacy add-on owner keeps OCR even with no other purchase, and `buyOcr()` no longer exists.

Existing `pro_lifetime` owners gain OCR at no charge. That is deliberate goodwill, not an
oversight — one product is simpler to reason about than three, and it costs nothing we were
otherwise collecting.

**Intended trajectory:** lifetime rises to **₹4,999** once sales justify it. Not scheduled.

**Monthly book drops are the boundary that makes the two paid tiers distinct**, and the reason
they are subscription-only. Lifetime buys the product as it stands, not a perpetual content
feed; without that line ₹2,999 strictly dominates ₹999/year and the subscription has no reason
to exist.

**The subscription is positioned as a price anchor for the lifetime deal** (owner's framing,
2026-10-30). Ordinary pricing, not a dark pattern in itself — but it puts weight on §1.3. The
lifetime option stays prominently offered and genuinely purchasable, cancellation stays one tap,
and the store copy describes what a subscriber actually receives. An anchor that misdescribes
itself is where this would become one.

**⚠️ Known gap, accepted 2026-10-30:** at launch the subscription carries **no recurring value**
— the drops, badges, scheduling and strict mode are all unbuilt, so a subscriber pays monthly
for what ₹2,999 buys outright. This is the thing the design intent below explicitly warns
against, and it is what drives month-two cancellation. Accepted for now given the anchor
strategy; **revisit when the drops ship.**

**Design intent behind the split:** the free tier must remain genuinely generous. Subscription value must be *recurring* value, never a re-labeling of static value. Lifetime Pro exists permanently as the non-recurring option and must never be discontinued or degraded to push subscription uptake.

### Subscription Value Stack (decided; do not add scope beyond this without asking)
1. Unlimited apps selectable for nudge interception (free tier: 1 app only)
2. Nudge scheduling — active only during user-defined hours/days
3. Nudge "strict mode" — longer/harder bypass for users who want more resistance than the default gentle nudge
4. Monthly curated book drops from legal sources (rotating, not cumulative; exact count TBD)
5. Opt-in leaderboard badges + monthly recognition (free users can view/participate in the leaderboard itself, but badges are subscriber-exclusive)

**Explicitly rejected, do not build:** priority book request fulfillment, early access windows to new Free Books catalog additions, in-app advertising of any kind, Z-Library or any non-legal book sourcing (see Section 13.2 — legal exposure, non-negotiable).

**~~Temporary deviation — free nudge-app limit is 2, not 1~~ — resolved 2026-11-01.** `FREE_APP_LIMIT` is back to 1 in `nudge-apps.js`, as Task 16.1 required. It was 2 from 2026-09-25 only because `hasSubscription()` was hardcoded false and nothing on sale could lift the gate, so at a limit of 1 *no user could ever select a second app* — making Section 9.7's scoped unlock unreachable in production and untestable on device. Lowering it takes an app away from existing two-app free users, so `syncToNative()`'s truncation is no longer silent: it names the dropped app once (Section 1.5), keyed to the packages dropped so it cannot re-fire every launch.

### Task — Subscription IAP (Phase 16)

Shipped 2026-11-01. See above for what it settled, and `Tasks.md` 16.1 for what the device still
owes.

---

## 5. Reading Engines

Unchanged from pre-pivot. Five engines, all built on the same word-array/`pageWordIndex[]` position system, fully interchangeable mid-read with no position loss.

**RSVP** — one word at a time, fixed centre position. `60000/wpm` ms per word. 1.8× pause on `.!?` and Devanagari danda `।`, 1.6× on `,;:`. ORP at ~33%, amber `#b8995a`. No flash animation. Comfort controls: A−/A+, ORP toggle, Context, Calm mode.

**Chunk Mode** — 2–7 words per flash (default 3). Delay = `(60000/wpm) × chunkSize`. Scans entire chunk for strongest punctuation pause.

**Focus Bold** — full page, first 40% of each word bold, highlight advances word-by-word. Do NOT call it "Bionic Reading" (trademarked).

**Simple Scroll** — CSS `transform: translateY()`, GPU-composited. Speed multiplier 0.25×–4×.

**Page** (added Phase 15) — same word stream/position system, rendered as swipeable, paginated normal-reading pages. DOM-measured pagination, cached per file/font/viewport. **Was the default landing engine for any read initiated via the nudge system (Section 9)** — RSVP/Chunk are too high-effort for the moment right after someone was redirected from a distracting app. **Temporarily overridden 2026-09-21 (device testing):** Page mode's first paint on a cold cache is slow enough that the user waits at exactly the moment the nudge is trying to be frictionless, so a nudged read now lands in the user's own engine. Restore this rule once Page-mode load time is addressed.

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
2. `FlowReadNudgePlugin` monitors for target app(s) being opened **and for time accumulating while the user is inside one** — see 9.3a.
3. Nudge does not fire on every open — see 9.3.
4. On trigger, show a calm nudge screen ("Read a bit before [App]?") with a "Start reading" action into Page mode (resuming current book, or the Free Books library if none in progress) and the always-visible escape hatch.
5. If reading: track against a user-configurable threshold. **Q2 defaults, signed off 2026-09-20: nudge after 15 minutes in that app (3rd open when usage access is denied); unlock after 2 Page-mode pages; cap 3 nudges per app per day; back off for the rest of the day after 3 consecutive dismissals.** All are settings, none hardcoded. An "on every open" trigger mode (`fr_nudge_trigger_mode`) was added 2026-09-21 — it skips the minutes/opens threshold but **still honours the daily cap and the dismissal back-off**, without which it would be the wall 9.1 forbids; the daily cap is exposed as a visible setting so the mode's name matches its behaviour (1.5).
6. Once met, **only the originally-requested target app opens**, not the user's whole nudge list (scoped unlock, 9.7).
7. Skipping at any point does not fail or penalize the user — no guilt copy, no broken-streak framing.
8. **Reading pays the clock back (added 2026-10-06).** Meeting the read threshold restarts that app's sitting from zero, zeroes its open count, clears the dismissal streak, and **refunds one nudge against the daily cap**. The unlock modal names what it cost and what it bought ("3 pages in 6 min — your Instagram clock is back to zero, so that's 15 fresh minutes"). Without the refund the reset is hollow: a user who read three times would have reset a clock the gate had no nudges left to act on. The cap still holds between reads, so the only way past it is to have read. Leaving a nudged read early credits nothing.

### 9.3 Dynamic Triggering — Not Every Open
Trigger only after a threshold, with a daily nudge cap per app and a back-off for the rest of the day after 3 consecutive dismissals.

**The minutes threshold counts the current sitting, not the day (changed 2026-10-06).** This section previously specified cumulative time since midnight ("15–20 minutes already spent that day"). That was wrong three times over, and the field found all three:

- The setting is labelled *"After a while in the app"*, which every reader takes to mean this sitting.
- At small thresholds it degenerates. Past 5 minutes anywhere in the day you are permanently over, so the threshold trigger silently becomes "every time I open it" — the mode the user deliberately did not pick.
- A daily total belongs to Android and nothing the user does can clear it, so Reset announced "Today's counters cleared" and the gate immediately said "you have been on Reddit for 120 minutes". It also left the §9.2 step 8 read credit with nothing it could honestly reset.

A sitting is delimited by the same `SESSION_GAP_MS` quiet heuristic that already defines an "open", and is **timed by the wall clock** — never by a usage-stats delta. `getTotalTimeInForeground()` does not tick while you are in the app: the figure comes from the daily interval buckets and the current session is only added once it ends, so it reads flat for the whole sitting and jumps when the user leaves. Timing a live sitting against it means timing it against a standing-still number, which produces exactly the symptom this was meant to cure — nothing fires while you are inside, and the nudge lands on your next open. Usage stats are accurate for sessions that are over and useless for the one in progress. **The two toggles are therefore orthogonal:** `every_open` is about the moment of opening, the threshold is about the stretch, and neither has anything to say about the other's moment. A threshold nudge consequently never fires at the moment an app is opened — at that instant the sitting is zero minutes old.

The **"Nth open today" fallback is retained** for the ungranted case, as the open-time half of the same toggle: the wall clock can time a sitting the user is navigating around in, but nothing can confirm they are still present when they are not, so a denied grant still needs a trigger that fires on an open.

**All counters reset at local midnight** and this needs no scheduler: `foregroundMinutesToday` re-derives the midnight boundary from `Calendar` on every query, and `NudgeGate.loadState()` discards the day blob when the date key changes. The rollover is lazy — it happens on the first event after midnight — which is safe because nothing reads a counter before rewriting it. Two things deliberately survive it: `suppressUntil`, which is an absolute timestamp (an unlock granted at 23:50 must still hold at 00:10), and `lastSeen`, because a session in progress at midnight is still the same session. The read credit does **not** survive it, since the raw minutes it offsets reset too.

### 9.3a Interception Happens *During*, Not After (added 2026-10-06)

Field testing found the minutes threshold firing on the wrong side of the event. The gate only ran at the start of a session, so a user who opened Reddit and scrolled for an hour was evaluated once — at minute zero, before the time existed — and then nudged on their *next* open with "you've been on Reddit for 47 minutes". That is a report on time already spent, not an interception of it.

The minutes threshold must therefore be allowed to fire from inside a session. Two mechanisms, because neither covers the other:

1. **Navigation events.** A same-session window change is no longer an automatic "no" — the threshold is re-tested on it. Costs nothing: the events were already arriving.
2. **One pending timed check.** Scrolling a single feed produces no window changes at all, so the service keeps exactly one `Handler` message pending, aimed at the moment the threshold could next be met and clamped to 30s–10min. It re-arms itself only while the app is still in front, so the chain ends on its own when the user leaves. **Never a poll loop** (§21). **The timer requires usage access**, because `isForeground()` is the only thing that can prove the user has not already left and a timer that nudges without that proof is the ambush N19 was about. Ungranted, the threshold still fires on navigation events, which are proof of presence in themselves.

Two rules on it. `every_open` fires only on an actual open — firing it mid-session would make it the wall §9.1 forbids — and **it wins the grace when both triggers are satisfied at once**: a threshold-raised nudge takes a 5-minute breather, because its condition does not go away once crossed and a shorter one would spend the whole daily cap inside two minutes of scrolling, but applying that breather to an *open* swallows the next open for five minutes, which is exactly what "Every time I open it" promises not to do and what Settings tells the user it does not do.

### 9.3b Skipping a Threshold Nudge Restarts the Stretch (added 2026-10-29)

Reported from use: with both triggers on, a nudge arriving after the chosen time was followed
by another **two minutes** after it was dismissed, instead of after the chosen time again.

Two causes, one line apart. `continueToApp()` picked the post-skip grace from **which toggles
were enabled** rather than **which trigger raised that nudge**, so with `every_open` on, a
threshold nudge was handed the 2-minute open-grace — and `dismissed: !everyOpen` meant the
skip was not counted toward the back-off either. The gate already makes this distinction
correctly for its own grace (`overEveryOpen` vs `overMinutes`); the JS simply was not using
it. `inSession` travels in the handoff for exactly this and is now what decides.

The deeper cause is that **a threshold's condition does not end when the nudge is dismissed.**
The user is still in the same sitting and still past the limit, so any fixed suppression only
defers the re-fire to the moment it lapses. A skipped threshold nudge therefore **restarts the
sitting** (`sessionStart` → now) and suppresses for the threshold itself, so both halves agree
and neither can undercut the other. The next one is due after the interval the user chose,
counted from the skip — which is what *"After a while in the app"* says.

This is not a way to dodge the gate: the dismissal still counts toward the back-off, and the
nudge has already come off the daily cap. Reading still buys strictly more (§9.2 step 8) — it
also zeroes the open count, clears the dismissal streak and refunds a nudge against the cap.

**An open-raised nudge is unchanged** and must stay so: it keeps the 2-minute grace and does
not restart anything, because "Every time I open it" means the next open is still nudged
(§9.3a). The opens fallback keeps the ordinary 10-minute dismissal grace — restarting a clock
that was not what gated it would do nothing.

**Not to be confused with §9.3a's five-minute breather, which is a different moment.** That
one stops the gate re-raising a nudge that is *already on screen*, while the target app keeps
emitting window changes underneath it; it is set by the gate when the nudge is shown and is
spent whether or not the user ever answers. This one is the gap *after* the user has answered
by skipping. Both exist, they do not overlap, and changing either does not change the other.

### 9.4 Android Implementation Notes — SUPERSEDED, see 9.4a

*Original text, kept because it explains what was tried and why it does not work:*
Default to `UsageStatsManager` (special permission via system settings, not a runtime dialog — onboarding must walk the user to the correct settings page, see Section 10). Poll at a battery-conscious interval; do not poll aggressively. `AccessibilityService` is a fallback only, requiring explicit product-owner sign-off before implementing, given this project's Play Store review history (see Section 18's `MANAGE_EXTERNAL_STORAGE` precedent). No iOS implementation planned.

### 9.4a Detection — `AccessibilityService`, signed off 2026-09-20 (Q8)

**`UsageStatsManager` alone cannot do this, and 9.4 was wrong to assume it could.** It answers *how long* an app has been used, but nothing keeps the app alive to notice an app-open: a plain background thread is killed, and WorkManager's 15-minute floor is useless against "the user just opened Instagram." Polling requires a **foreground service**, whose notification Android 8+ makes undismissable by the app. The product owner ruled that out — a permanent notification is not acceptable for this product.

`AccessibilityService` is therefore the only mechanism that meets the requirement, and it is what comparable apps (One Sec, Opal, ScreenZen) use. **Signed off 2026-09-20.** Three constraints on it are binding:

1. **Minimum possible scope.** `canRetrieveWindowContent="false"` and `typeWindowStateChanged` only, so the service is *structurally* incapable of reading screen content. `packageNames` is narrowed at runtime via `setServiceInfo()` to exactly the user's chosen apps, so the system delivers nothing about any other app. Do not widen either without a logged decision — this configuration is both the privacy guarantee (§1.4) and the Play Console Accessibility API justification.
2. **`SYSTEM_ALERT_WINDOW` is required**, not optional. From Android 10 the background activity start that raises the nudge is dropped without it.
3. **`PACKAGE_USAGE_STATS` is optional** and must stay that way. Requiring three settings-page grants before the feature does anything would be unacceptable onboarding friction. **What it buys changed on 2026-10-06** (§9.3): the minutes threshold no longer depends on it, because a sitting is timed by the wall clock. What the grant buys is **presence** — `isForeground()`, which the timed check needs to prove the user has not already left before it interrupts them — plus the day's total for display. It explicitly does **not** time the sitting. Denied, the threshold still fires on navigation events (which are proof of presence in themselves) and "Nth open today" covers the moment of opening; Settings says which is which in plain language (§1.5).

**Scope note, logged 2026-10-06.** §9.3a's timed check must confirm the user is still in the app before interrupting them, and the accessibility service cannot tell it — it is narrowed to the user's own picks and so never hears that they left. `NudgeGate.isForeground()` therefore reads the most recent resume from `UsageStatsManager.queryEvents`, which can name an app the user never selected. It is compared to the target and discarded: never stored, never logged, never sent (§1.4), and the accessibility service's own `packageNames` filter is untouched. This is a use of a permission the user granted separately and explicitly, not a widening of the accessibility scope — but it is a widening of what usage access is used for, which is why it is written down here. Without usage access the timed check does not run at all, and the feature falls back to the opens trigger exactly as before.

**Never use `QUERY_ALL_PACKAGES`** to list installed apps — it is Play-policy-sensitive and needs a declaration form. A `<queries>` element filtering on `MAIN`/`LAUNCHER` gives the same list with no declaration.

A prominent disclosure screen must precede the accessibility grant. That is Play policy and also §10.1.

**It must precede *every* route to the grant, not the obvious one (N29, 2026-10-13).** The disclosure originally guarded only the master toggle in Settings, while the permission row's Grant button and the trigger toggles reached the system settings page without it. That gap was invisible to anyone who had used the app — the disclosure is shown once — and reachable only by a brand-new user, which is to say precisely the Play reviewer. Two rules follow: the guarantee lives at the choke point (`openAccessibilitySettings()` guards itself) rather than at each call site, since call sites get added and forgotten; and **"enabled by default" is not "set up"** — `fr_nudge_enabled` is absent on a fresh install and reads as on, so UI that gates on it alone will expose permission controls to a user who has been told nothing.

**Declared to Play as: App functionality only, no sensitive data collected, `isAccessibilityTool` unset (false).** The last of those is the honest answer — this is not an assistive tool, and claiming otherwise is a fast rejection. "No sensitive data" rests on the §9.6 allowlist keeping target package names out of analytics: **an event that ever carried one would make the filed declaration false.**

No iOS implementation planned.

### 9.5 Reading Mode on Nudge-Entry
Lands in the user's own reading engine. Resumes in-progress book, or opens Free Books library if none — avoids the "empty import screen" drop-off.

**Was Page mode by default; overridden 2026-09-21 pending Page-mode load-time work** (Section 5). The reasoning for Page mode still stands and should be restored once opening it is fast; the reason for the override is that a slow first paint costs more here than the engine choice gains.

**Unlock progress is engine-agnostic.** The threshold is expressed in pages, but it is counted through `savePosition()` — the seam every engine already goes through — so a nudged read counts in RSVP, Chunk, Scroll and Focus Bold too, converting pages to words (~220 words/page). Page mode keeps its exact page count. Counting only Page-mode turns meant a user reading in any other engine waited for an unlock that could never arrive (Section 1.5).

### 9.6 Anonymous Event Pings
`analytics-ping.js` — `logEvent(eventName, meta)`, fire-and-forget `fetch()` to a Cloudflare Worker. Never includes a user/device identifier, file name, or reading content. Minimum event set: `app_opened`, `nudge_shown`, `nudge_read_started`, `nudge_read_completed`, `nudge_skipped`, `free_book_downloaded`, `pro_purchased`, `subscription_started`, `subscription_cancelled`, and `stats_shared` (added 2026-09-25 with product-owner approval; carries the share entry point only — `home` / `dashboard` / `milestone` — never the book, the stat, or the destination app). Privacy policy must disclose this.

**Adding an event to this list is a product decision, not an implementation detail.** The allowlist in `analytics-ping.js` drops anything unlisted precisely so a future caller cannot quietly widen what is collected — ask before extending it (§21).
**Allowlist additions 2026-11-01 (Task 16.3, product-owner approved):** `onboarding_completed` and `nudge_permission_granted`. §10.2's inline permission ask was chosen *to maximise grant rates*, and a grant rate needs a denominator — without these two there is no way to tell whether that choice was right, which is what §10.1 asks to be testable rather than assumed. A decline needs no event of its own: it is completed minus granted. Neither carries any parameter.


### 9.7 Scoped App Unlock
When the read-threshold is met, only the specific requested app unlocks — other configured target apps remain subject to their own independent thresholds.

---

## 10. Onboarding — rebuilt for the pivot (Task 16.3, 2026-11-01)

The current onboarding (RSVP calibration screen, adaptive difficulty text, speed-reading-first framing per Section 18) was built entirely under the pre-pivot identity. It must be redesigned to match Section 0.1's new positioning. This is a full-surface redesign, not a copy tweak.

### 10.1 Requirements
- **Lead with the reading-habit pitch**, not speed reading. RSVP/Chunk/etc. remain in the app and can still be introduced, but de-emphasized relative to the previous version where RSVP calibration was the centerpiece.
- **Explain the nudge system concept early**, in plain language, before any permission ask — the user needs to understand *why* FlowRead wants to watch for app-opens before being sent to a system settings page to grant the Usage Stats permission. Poor framing here will tank permission-grant rates and trust.
- **Defer the actual permission grant + target-app selection to a "set up later" step if it improves conversion** — getting a special settings-page permission during first-run onboarding is high-friction; consider showing value first (the Free Books library, a first successful read) and prompting the nudge setup once, clearly, but not necessarily blocking the rest of onboarding on it. This is a design judgment call for whoever builds it — flag it, don't force a single approach without testing.
- **Free Books library as the "start reading immediately" moment** — onboarding should end with the user either already reading something or one tap away from it, not staring at an empty import screen.
- **Fully localized in Hindi from day one of the rebuild** — every onboarding string goes through `t()` into both `en.json` and `hi.json` from the start, not retrofitted after an English-only build (see Section 17, i18n rules).
- **Retain the honest-limitations principle** (Section 1.5) — a limitations screen still belongs somewhere in or right after onboarding, just repositioned to fit the new narrative rather than removed.

### 10.2 Permission Placement — RESOLVED

**The ask is inline** (owner, 2026-11-01), taking the higher-conversion and higher-friction option
over deferral, because the nudge is the pivot and a user who never sets it up has a plain reader.
Three things carry that choice and must not be weakened:

- **The ask comes after the user has named an app**, never before. The permission screen can then say "FlowRead needs to notice when you open Instagram" instead of something abstract, and the accessibility service does nothing without a target anyway, since `packageNames` is narrowed to the user's own picks (§9.4a).
- **Every route past it is skippable without dead-ending.** Declining must not cost the user the rest of the app. The forward button reads *Not now* until the grants are in, and backing out of the disclosure or the settings screen returns to the same screen rather than stalling.

- **Usage access is offered, never required** (§9.4a). It is a third, explicitly optional row and
  must never gate the forward button. It is shown only when a trigger that uses it is on —
  `triggers()` defaults to the threshold, and without the grant §9.3a's timed check cannot run at
  all, so a new user would otherwise land in the degraded mode having never been asked.

**Onboarding does not restate the prominent disclosure.** It calls `openAccessibilitySettings()`,
which carries N29's guarantee at the choke point — one copy of that text, in one place, is the
whole point of N29. The onboarding screen motivates and defers to it.

**N4's home card is kept, not absorbed.** `shouldPromptSetup()` is false once any app is chosen,
so it now reaches only someone who skipped the onboarding step — the inline ask buys grant rate
at the cost of a harder refusal, and without the card a user who declined would never be offered
the pivot feature again.

---

## 11. Offline-Triggered Reading Notification — built (1.4.7)

Extends the existing notification system (`notifications.js`, already shipping two types: primary daily reminder id `1001`, streak-protection nudge id `1002` — see Section 18). Adds a third trigger type, based on connectivity rather than time-of-day.

### Requirements
- Use `@capacitor/network` (new dependency, Section 2) to listen for a transition to offline status.
- On detecting offline, show a local notification along the lines of "No internet? Good time to read." — exact copy TBD, keep it light, not preachy, consistent with the "nudge not wall" tone (Section 1.6) even though this is a notification rather than the in-app nudge screen.
- **Must not spam.** Apply the same discipline already established for the existing notification types: throttle to a reasonable maximum (e.g., once per few hours, not on every brief connectivity blip), suppress if the user already met their daily reading threshold (reuse the existing suppression logic from the primary daily reminder), and do not fire if the app is currently open/in foreground.
- Use a new notification ID (e.g., `1003`) distinct from the existing two, and follow the same reschedule/cancel patterns already established in `notifications.js`.
- New i18n keys in both `en.json` and `hi.json`.

---

## 12. Home Screen Widget — not built yet, Android only

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
Implemented (Phase 15). 88 curated books in `www/data/free-books.json`, region-aware sorting, language tabs, category filters, auto-OCR for catalog entries, full i18n.

### 13.3 Known Issue — RESOLVED
Previously: catalog entries with `fileType: "html"` failed with a download error. The catalog now holds only `pdf` (23) and `txt` (65) entries and `free-books.js` branches on exactly those two, so there is nothing left to fix. **If you add a catalog entry, it must be `pdf` or `txt`** — an `html` entry would hit the PDF parser and fail.

---

## 14. Leaderboard & Badges — Planned, Not Yet Built

**Opt-in only, never default-shown.** Monthly reset, no permanent ranking. Free users can view/opt into the leaderboard; badges are subscriber-exclusive (Section 4). Explicitly rejected: default-visible leaderboards, permanent rankings, competitive-pressure framing.

Badges tie to the monthly curated book drops — start with 1-2 badge types, expand only if usage data supports it. A Lummi-style mascot/persona-leveling layer was considered and rejected as tonally inconsistent with FlowRead's calmer brand and its more serious catalog content (Ambedkar, Phule, etc.) — if gamified identity is revisited, tie it to *what a user reads*, not a generic unrelated game mechanic. Not scoped for current implementation.

**Needs a lightweight backend beyond the anonymous analytics pings (Section 9.6)** — a leaderboard requires actual opt-in, user-chosen-name records, not just anonymous counts. Clarify with product owner whether this reuses the same Cloudflare Worker infrastructure with a new endpoint, or needs something more structured.

---

## 15. Share Stats Feature — built; device test outstanding

Elevated in priority because it doubles as a distribution mechanic, not just retention — relevant given the product's current distribution-bottleneck stage (Section 22).

### Requirements
- **Free for everyone — not Pro-gated** (decided 2026-09-25). The dashboard this feature nominally lives on is Pro-gated, which would have hidden the one feature prioritized *for distribution* from the users whose shares actually reach non-users. The free tier is also meant to be genuinely generous (§4).
- **Two entry points, both required:** (1) a visible "Share" button, always available, not just milestone-triggered — in the **home header** (where every user has it) and on the dashboard; (2) a milestone-triggered prompt for natural completion moments, which convert better than a buried button alone: **book completion** ("You finished [Book] — share it?") and **7 / 30 / 100-day streaks**, kept sparse so the prompt never becomes nagging. A milestone is marked celebrated when the offer is *made*, not when it is accepted — re-offering because the user declined is the nagging §9.1 rules out.
- **Milestone prompts fire from the home screen only**, never over a reader: position is sacred (§21) and a celebration mid-read is an interruption.
- Generate the card entirely on-device (Canvas API) — no server, no upload.
- Must include app name/branding on the image itself, tasteful and small, not a loud ad.
- User-editable before sharing: simple per-item toggle for which books/achievements to include.
- **The book's cover and its real title (added 2026-10-06).** A book hero carries a cover panel beside the headline. Offline by construction (§1.1): for a PDF it is page one, rendered from the raw bytes already in IndexedDB; everything else gets a typographic cover drawn from the title's initials and the author, in §16 colours only — never a fetched image, and never the catalogue's own placeholder palette, which is outside §16. Titles go through `displayTitle()`, which strips the file extension for display everywhere in the app: the stored name stays a filename because library de-duplication keys on it, but "Finished जाति का विनाश.pdf" must never leave the device.
- **Hero-metric framing, not a data dump** — one strong stat per share ("Finished Annihilation of Caste in 4 days"), with at most three supporting lines under it. Hero priority: a finished book, then the streak, then total words — a named book is the most shareable thing on the card and the most on-brand; a bare streak could be any habit app.
- **Design with a future "time reclaimed" stat in mind** once Section 9's nudge system is live (e.g., "You chose reading over Reddit 14 times this week") — not required for v1, but the card layout shouldn't need to be rebuilt to add it later. **Honoured:** the supporting lines are a flat ordered array in `_extraOptions()`, so adding the stat is one entry and no change to the drawing code. `NudgeGate` already holds the counters it would need.
- Share via native share sheet (`Capacitor.Share`) — this inherently supports sharing to any installed app the user chooses, no platform-specific restriction needed.
- Design: warm, on-brand, large readable text, one achievement per share image. 1080×1080, §16 palette only.
- **A successful share emits `stats_shared`** (approved 2026-09-25), carrying the entry point and nothing else — no book, no stat, no destination app. Fired after the share completes, fire-and-forget, and inert until the Worker endpoint exists. See §9.6.

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

All items are net-new, motivated by §0.1.

**This section is the authoritative list of *what* Phase 16 contains. `Tasks.md` tracks *where
each item stands*** — status, blockers, per-task steps, the decisions log and the open-questions
table. Completed detail and resolved device findings are in `Tasks-archive.md`. Keep the three
consistent, and do not grow status narrative here: that is `Tasks.md`'s job.

| Task | What it is | § | Status |
|---|---|---|---|
| **16.0a** | API 36 target bump + the toolchain upgrade it forced | 3.2 | ✅ 1.4.5 / 32 |
| **16.0b** | Play Billing 7.1.1 → 9.1.0 | 3.1 | ✅ 1.4.5 / 32 |
| **16.1** | Subscription IAP (`flowread_plus`) alongside the repriced lifetime product | 4 | ✅ code complete; device test, Hindi and store/privacy copy outstanding |
| **16.2** | Habit interception — the pivot mechanic | 9 | ✅ code complete, on Internal testing; **checklist never run**, not promoted |
| **16.3** | Onboarding redesign onto the habit pitch | 10 | ✅ code complete; device run and Hindi outstanding |
| **16.4** | Monthly curated book drops | 4, 13 | ⬜ needs Q4 (count; bundled vs remote catalog) |
| **16.5** | Opt-in leaderboard & badges | 14 | ⬜ needs Q5 (backend approach) |
| **16.6** | Share stats card | 15 | ✅ code complete, on Internal testing; device test of the native share path + PDF cover outstanding |
| **16.7** | Offline-triggered reading notification | 11 | ✅ 1.4.7, device-verified; Q6 copy outstanding |
| **16.8** | Home screen widget | 12 | ⬜ **next engineering task**; needs Q7 (classic vs Glance) |
| **16.9** | Home screen reorder (in-progress books first) | — | ✅ 1.4.7 |
| **16.10** | Store listing rewrite onto the habit framing | 0.1 | ⬜ **next product task**; now the main listing, not just the India CSL |
| **H3** | Notifications failed silently without exact-alarm permission | 1.5 | ✅ 1.4.7 |
| **H4** | Pro purchase failed with a generic error | 1.5 | ✅ verified on a Play build; revenue blocker closed |
| **R8** | DEX optimization / obfuscation | — | ✅ done locally (1% → 93%); Play-side figure unconfirmed |

**Two notes that outlived their tasks and still constrain work:**

- **H4's real defect was the error taxonomy**, not the symptom: every non-OK
  `BillingResponseCode` collapsed into one string, so a customer who *owned* Pro was told their
  purchase failed. 16.1 is built on the taxonomy that replaced it — keep it.
- **H3's original diagnosis was wrong.** Capacitor 8's LocalNotifications plugin already degrades
  exact → inexact on its own, so `SCHEDULE_EXACT_ALARM` was *removed* rather than requested.
  Don't re-add it.

### Open items requiring product-owner input during Phase 16
- ~~Exact nudge default thresholds~~ — **resolved 2026-09-20: 15 min / 2 pages. See 9.2.**
- ~~Subscription pricing~~ — **resolved 2026-10-30; 16.1 shipped 2026-11-01. See Section 4.**
- Monthly book-drop count and catalog-update mechanism (bundled vs. remote-fetched)
- Leaderboard backend approach
- ~~Whether `AccessibilityService` escalation is ever pursued~~ — **resolved 2026-09-20: yes, signed off. See 9.4a.**
- ~~Whether the nudge permission ask is inline in onboarding or deferred~~ — **resolved 2026-11-01: inline, after the user has named an app. See 10.2.**
- Exact copy/tone for the offline-triggered notification (Section 11)
- **Hindi copy sign-off for the Task 16.1 and 16.3 strings** (subscription paywall, onboarding) — drafted 2026-11-01 rather than left as key names, since `i18n.js` has no English fallback and a missing key renders the raw key to a Hindi user. Owner-written replacements welcome, same standing as Q10.
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

- **Current phase:** Phase 16 — Reading Habit Pivot (§19). Day-to-day tracking in `Tasks.md`;
  completed detail in `Tasks-archive.md`.
- **Latest build:** **1.5.2 / versionCode 40** (2026-11-02), carrying 16.1 (subscription IAP) and
  16.3 (onboarding redesign). A subscription purchase has completed on a clean license-tester
  account. **Verify against actual Play Console state before assuming current.**
- **Production is still 1.4.5 / 32.** Builds 33, 34, 36, 37, 38, 39 and 40 have never left
  Internal testing — which means the entire pivot is unreleased.
- **The three things between here and production, none of them engineering:** the 16.2 device
  checklist (items 1–16, never run end to end, deferred four times — battery has no data behind
  it at all); privacy policy and store listing describing a subscription and the habit framing
  (Task 16.10); and the promotion itself. 1.5.x is also the first build where **R8 actually runs
  on a device**.
- **Immediate priority:** **16.8 (home screen widget)** for engineering, **16.10** for product.
- **Toolchain:** targetSdk 36, minSdk 24 (7.0, raised from 5.1 in 1.4.5 — dropped ~1,641 device
  models), Capacitor 8.5.2, Billing 9.1.0, `@capacitor/network` 8.0.1, `@capacitor/share` 8.0.2.
  **JDK 21 and Node ≥22 required** — read §3.3 before building on a new machine.
- **Target platforms:** Android first. iOS store setup not started, and no iOS path is planned for
  the nudge system or the widget.
- **Target launch of pivot:** TBD — quality over speed.
- **Distribution context (for product decisions, not implementation):** the product is in a
  **distribution** bottleneck, not a retention or monetization one. That is why the share card
  (§15) is prioritized partly for reach, and why Phase 16 favours mechanics with plausible
  organic spread alongside pure retention plays.

*This document is the contract. Update it before changing direction, not after.*