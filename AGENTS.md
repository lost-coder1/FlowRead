# FlowRead — Build Manual for Codex

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> Single source of truth. If something isn't covered here, ask the user before improvising.

---

## 0. Project Identity

**Name:** FlowRead (final name TBD before store submission)
**Pitch:** Read everything faster. No subscription, no cloud, no account.
**What:** Privacy-first, fully offline speed reading app. PDF → high-speed reading via 4 engines. Built with Capacitor (HTML/CSS/Vanilla JS → native Android/iOS).
**Target user:** Adult readers who consume PDFs — students, researchers, professionals, self-learners.

---

## 1. Core Principles (Non-Negotiable)

### 1.1 100% Offline (except URL fetch in Pro)
- No backend. No cloud APIs. No analytics phoning home.
- All parsing client-side (pdf.js, mammoth.js). All data stored locally.
- Only network request in free app: Google Fonts on first load (cached forever). Will bundle fonts before launch.
- Pro URL reader: single fetch per article — labelled "requires internet" in UI.

### 1.2 No Accounts, Ever
No sign-up, login, email, password. Fully functional 1 second after first launch. Pro verified via App Store / Play Store receipt only.

### 1.3 No Subscriptions
One-time payments only. Pro and OCR Vision are lifetime. New paid features = new one-time purchases, never recurring.

### 1.4 Privacy By Architecture
Files never touch any server. We log nothing, track nothing, collect nothing. This is architecture, not a marketing claim.

### 1.5 Honest Limitations
Every limitation shown upfront in onboarding. Never silently fail. Errors explained in plain language.

---

## 2. Tech Stack

- **Framework:** Capacitor 6+
- **UI:** Vanilla HTML + CSS + JavaScript. No React, Vue, Svelte, Alpine, or any framework. No build step.
- **PDF parsing:** pdf.js 3.11.174 (legacy UMD build — pdfjs-dist 4.x removed UMD)
- **DOCX parsing:** mammoth.js 1.8.0
- **Storage:** Capacitor Preferences (Keychain/EncryptedSharedPrefs) for purchase state. Capacitor Filesystem for file data. localStorage for UI state (all keys prefixed `fr_`).
- **Screen wake:** @capacitor-community/keep-awake@5
- **IAP:** @capacitor-community/in-app-purchases (v1.1+)
- **Fonts:** Roboto, Open Sans, Lato, DM Mono

**Key folder paths:**
```
www/
  index.html
  css/   base.css · components.css · engines.css · themes.css
  js/
    app.js · state.js · storage.js
    parser/  pdf.js · docx.js · txt.js
    engines/ rsvp.js · chunk.js · scroll.js · focusbold.js
    views/   upload.js · reader.js · normal.js · dashboard.js · settings.js
    features/ chapter-detection.js · cleaning.js · bridge.js · keep-awake.js · purchase.js
    utils/   dom.js · format.js
  assets/ fonts/ · icons/
```

---

## 3. Business Model

| Tier | US Launch Price | Notes |
|---|---|---|
| **Free** | $0 | Unlimited PDFs, all 4 engines, all core features |
| **Pro** | $9.99 Android / $14.99 iOS intro | Intro price is time-based, not user-count-based. Move to a higher anchor after launch if needed. |
| **OCR Vision** | $4.99 Android / $7.99 iOS intro | Separate one-time add-on. Keep it available only to Pro users. |

PPP structure:
- Tier A: US, Canada, UK, Australia, Western Europe at 100% of launch price.
- Tier B: LATAM, Eastern Europe, Southeast Asia at roughly 50% to 70%.
- Tier C: India, Indonesia, Philippines, Vietnam, Pakistan, Egypt at roughly 25% to 45%.

Implementation:
- Use App Store Connect and Google Play Console regional pricing rather than hardcoding local prices in the app.
- Keep `pro_lifetime` and `ocr_vision` as fixed product IDs across all regions.
- Show the store-returned localized price in the paywall UI.
- Avoid pricing by number of users; use launch windows and regional pricing instead.

Store fees: iOS 30% (15% under $1M via SBP). Android 15% on first $1M.

---

## 4. Reading Engines

### RSVP
- One word at a time, fixed centre position.
- `60000/wpm` ms per word. 1.8× pause on `.!?`, 1.3× on `,;:`.
- ORP (fixation letter) at ~33%, amber `#b8995a`. **No flash animation — instant swap only.**
- Warm dark stage `#161410`. Crimson Pro 400, default 48px (24–80px range).
- Comfort controls: A−/A+, ORP toggle, Context (prev 4 words), Calm mode (dims chrome to 15%).

### Chunk Mode
- 2–7 words per flash (user-selectable, default 3). Delay = `(60000/wpm) × chunkSize`.

### Focus Bold (page-mode bionic)
- Full page of text. First 40% of each word bold. Highlight advances word-by-word at WPM.
- Pages pre-built on init (DOM measurement + word-count fallback). Playback = pure class-toggle, no DOM writes.
- Page crossfade 0.15s on page boundary. Do NOT call it "Bionic Reading" (trademarked).

### Simple Scroll (teleprompter)
- CSS `transform: translateY()` — GPU-composited, no layout reflow.
- Independent speed multiplier 0.25×–4×. Amber centre line, adjustable 1–10px.
- `pxPerMs = (wpm / 60000) × 28 / 8 × multiplier`. Delta capped 50ms.

---

## 5. PDF Cleaning Engine (`www/js/parser/pdf.js`)

1. Extract text with x/y positions page-by-page.
2. Group into lines by y-coordinate tolerance. Sort top→bottom, left→right.
3. Detect headers (top 14% of page, appears on 12%+ of pages) and footers (bottom 14%).
4. Strip page numbers, ISBN/ISSN/DOI lines, bare URLs, null bytes.
5. Tables → `[Table — Tap to View]` placeholder. Images → `[Image — Tap to View]`. Equations → `[Equation — Tap to View]`. Each stores its source page for Normal View jump.
6. Build `pageWordIndex[]` — array indexed by page, value = word index where page starts. Critical for bi-directional sync.

---

## 6. Bridge System

**Speed → Normal:** Floating button (bottom right) → reverse-lookup `pageWordIndex` → open Normal view at nearest page.
**Normal → Speed:** "▶ Read from here" button → `pageWordIndex[currentPage]` → switch to RSVP at that word.

---

## 7. Screen Wake Lock (`www/js/features/keep-awake.js`)

Acquire: on entering any reading view, on play. Release: on exit to home/dashboard/settings, on 5-min idle pause, on background. Never hold outside reading views.

---

## 8. UI Design System

```css
:root {
  --bg: #0d0d0d;  --surface: #141414;  --surface-2: #1c1c1c;  --border: #2a2a2a;
  --accent: #e8c547;  --accent-2: #c47a3a;
  --text: #e8e4dc;  --text-muted: #6b6660;  --text-dim: #3a3632;
  --rsvp-stage-bg: #161410;  --rsvp-orp: #b8995a;
  --success: #5a9a6a;  --error: #c45a3a;
}
```

- **No pure black (#000) or pure white (#fff) anywhere text appears.**
- Border radius 2–4px on small elements, max 6px. No pill buttons.
- Animations: 0.12–0.2s hover, 0.3s view transitions. No bounce. No RSVP flash.
- Fonts: Roboto (default UI/reading), Open Sans (alternate reading), Lato (alternate reading), DM Mono (labels/numbers).

---

## 9. Known Limitations (shown in Onboarding + Settings)

1. Scanned PDFs require OCR Vision upgrade.
2. DRM-protected files (Kindle .azw, Adobe DRM) cannot be read.
3. Multi-column PDFs (IEEE/ACM format) may have reading-order issues.
4. Tables/images shown as `[Object — Tap to View]` placeholders; some wide tables not detected.
5. Math equations skipped or shown as `[Equation — Tap to View]`.
6. Handwriting not accurately parsed even with OCR.
7. Password-protected PDFs rejected with clear error.
8. RTL languages (Arabic, Hebrew, Urdu) not supported in v1.
9. Pro dictionary: ~150k words; specialised terms may not be found.
10. URL reader requires internet; some sites blocked by paywalls/bot protection.

---

## 10. Pro vs Free Reference

| Feature | Free | Pro |
|---|---|---|
| PDF reading (all 4 engines) | ✅ | ✅ |
| Cleaning, placeholders, bridge, chapters | ✅ | ✅ |
| Auto-resume, wake lock, progress tracking | ✅ | ✅ |
| OLED Black theme | ✅ | ✅ |
| DOCX / TXT support | ❌ | ✅ |
| URL reader | ❌ | ✅ |
| Share extension (receive URL from browser) | ❌ | ✅ |
| Dashboard + reading KPIs | ❌ | ✅ |
| Device file sync | ❌ | ✅ |
| Sepia + High Contrast themes | ❌ | ✅ |
| OpenDyslexic font / Typography controls | ❌ | ✅ |
| Local WordNet dictionary | ❌ | ✅ |
| **OCR Vision** | $9.99 add-on | $9.99 add-on |

---

## 12. Active Phase

Phases 0–10 are complete. Phase 11 is complete. Current work is Phase 12.

### PHASE 11 — Share Extension & Deeper Sync (Completed)

- [x] **Important intermittent next task**
  - Going from any mode to `Scroll` now shows a loading spinner and progress overlay while the rebuild or cache restore completes.



### PHASE 12 — Engagement, Navigation, OCR Vision

Next task to handle: **Task 12.1 — Daily reminder notifications**

- [ ] **Task 12.1 — Daily reminder notifications**
  - Free: remind once daily about unread PDFs only.
  - Pro: remind once daily about unread items across all readable sections (PDF, URL, DOCX, TXT, synced device files in library).
  - Fully local scheduling and state tracking (no backend, no analytics).


- [x] **Task 12.3 — On-device OCR Vision (Android complete)**
  - ✅ Custom `FlowReadOcr` Capacitor plugin (`android/app/src/main/java/com/flowread/app/FlowReadOcrPlugin.java`) wraps ML Kit Text Recognition v2 with an explicit `script` parameter (`'latin'` | `'devanagari'`). Replaces the published `@pantrist/capacitor-plugin-ml-kit-text-recognition` (which hardcoded Latin and silently dropped Hindi).
  - ✅ Gradle: `play-services-mlkit-text-recognition:19.0.1` + `play-services-mlkit-text-recognition-devanagari:16.0.1` bundled into the APK — fully offline.
  - ✅ JS OCR engine tries Latin first, falls back to Devanagari, and merges results for mixed Hindi+English pages.
  - ✅ Scanned-PDF detection now uses three signals: word-count threshold, scanner watermark regex (CamScanner, OKEN Scanner, etc.), and a junk-text ratio. Scanner apps' bad embedded text layers no longer bypass our recognizer.
  - ✅ Image OCR uses `FileReader.readAsDataURL()` (no canvas) — avoids WebView OOM on 12MP+ photos.
  - ✅ PDF OCR renders at 3× scale with white-fill background; falls back to extracting the largest embedded image XObject directly when full-page render returns nothing (handles JBIG2/JPEG2000).
  - ✅ "Image / Scan" import card on home screen — gallery multi-select.
  - ✅ Free/Pro-only users see upgrade prompt. Dev bypass in Settings > Developer.
  - ✅ OCR imports persist locally; no reprocessing on launch.
  - ⏳ **iOS implementation pending** — use Apple Vision Framework (`VNRecognizeTextRequest`), NOT ML Kit. Apple Vision auto-detects script across most languages, so a single recognizer call typically covers Latin + Devanagari + CJK + Cyrillic without separate models. Must be wired through an equivalent custom Capacitor plugin in `ios/App/App/` when iOS work begins.

### Language coverage notes (added during 12.3)

**Normal (text-layer) PDFs — no extra plugin needed:**
- ✅ Latin + diacritics (English, French, Spanish, German, Italian, Portuguese, Dutch, Polish, Turkish, Vietnamese, etc.) — bundled fonts already cover.
- ✅ Cyrillic (Russian, Ukrainian, Bulgarian, Serbian) and Greek — Roboto/Open Sans already include these glyphs.
- ❌ Devanagari (Hindi, Marathi, Nepali) — need Noto Sans Devanagari bundled.
- ❌ CJK — need CJK font (~5–15 MB/script) and word-segmentation (no spaces between words).
- ❌ Thai, Khmer, Lao — word-segmentation issue.
- ❌ Arabic, Hebrew, Urdu — already excluded in v1 (RTL).

**On-device OCR (ML Kit script models, Android):**
- ✅ Latin (~30 languages) and Devanagari (Hindi/Marathi/Nepali) shipping today.
- Available but not yet added (each ~3–5 MB APK overhead): Chinese, Japanese, Korean.
- ❌ ML Kit does NOT support: Cyrillic, Arabic, Hebrew, Thai, Tamil, Bengali — would need Tesseract.js or cloud OCR for those.

**Suggested market-entry order after Latin + Devanagari:**
1. Japanese + Korean — high spending power, premium app market, easy bilingual handling via our existing script-merge logic. ~7–10 MB additional.
2. Chinese — biggest TAM but no Google Play in mainland China; revisit when iOS launches or alt-stores are in scope.
3. Cyrillic markets — would require Tesseract.js fallback; defer.


- [x] **Task 12.5 — Internal Dictionary** (Completed)
  - ✅ 82,559-word local offline dictionary from WordNet 3.1 (Pro feature)
  - ✅ Single tap on any word in RSVP/Chunk/Scroll/FocusBold → shows definition modal
  - ✅ Free users see Pro upgrade prompt with "Look up online" fallback
  - ✅ Dictionary auto-loads in background on reader open (zero delay on first tap)
  - ✅ Playback auto-pauses when dictionary opens
  - ✅ Definitions capped at 2 per word, max 120 chars (7.98 MB file, compresses further in APK/IPA)

- [x] **Task 12.6 — Improve Pro Dashboard** (Completed)
  - ✅ WPM Progress Chart — SVG line graph showing last 7 sessions with trend badge (↑ Improving / ↓ Declining / → Steady)
  - ✅ Files Completed — counter + stacked bar chart by type (PDF/DOCX/TXT/URL/OCR). Now tracks image/OCR files.
  - ✅ Per-card time-to-complete estimates — shows inline in active library cards (e.g., "~3h 22m left")
  - ✅ Reading Streak Heatmap — 91-day GitHub-style calendar with intensity levels (0–3) based on daily word count
  - ✅ Library split into "Your Library" (active files) + collapsible "Read" section (100% complete)
  - ✅ OCR/image files now visible in completion stats with green segment + "OCR" legend
  - ✅ Smart back navigation — reader returns to Dashboard when file was opened from there (via AppState.readerSource)
  - ✅ Homepage card reorder — Image/Scan moved above Dashboard; Dashboard given full-width (import-card-featured)
  - ✅ 2-column import grid on mobile — removed single-column breakpoint so cards lay out as intended

- [x] **Task 12.6 — Clean Up Tasks** (Completed)
  - ✅ App loading splash screen — clean "FlowRead / Read everything faster" splash shown before JS boot, fades out after init
  - ✅ Screen going off during reading — re-acquire wake lock on app foreground via Capacitor App.appStateChange listener
  - ✅ WPM timer accumulation in RSVP/Chunk — generation counter prevents stale setTimeout chains from doubling speed
  - ✅ Home stats bar (streak, words today, avg WPM) now refreshes on every return to home screen
  - ✅ 100% read items auto-move to Read section — engines save wordCount position on finish; re-open resets to 0
  - ✅ PDF Normal View button hidden for URL/DOCX/TXT files — kind property added to AppState.currentFile
  - ⏳ Disable Pro feature test button in settings — deferred to PRE-LAUNCH

### PRE-LAUNCH — Store Setup & In-App Purchase

- [ ] **Store account setup (calendar-blocking)**
  - [ ] Google Play Console account ($25 one-time) — create app, upload signed APK/AAB, publish to internal testing
  - [ ] Create two one-time IAP products: `pro_lifetime` ($9.99) and `ocr_vision` ($4.99) with regional PPP pricing (Tier A/B/C per Section 3)
  - [ ] App Store Connect account ($99/year) — create app, add store listing
  - [ ] Create two non-consumable IAPs: `pro_lifetime` (Tier 15, ~$14.99) and `ocr_vision` (Tier 8, ~$7.99)
  - [ ] Submit app + IAPs to App Store review

- [ ] **Real in-app purchase flow** (code, ~1–2 days after store products are live)
  - [ ] Initialize IAP plugin on boot (`app.js`) — call `initIAP()` which registers products and restores prior purchases
  - [ ] Implement purchase.js: `buyPro()`, `buyOcr()`, `restorePurchases()` — wire to Capacitor InAppPurchases plugin
  - [ ] Show store-localized prices in paywall modal (read from `product.price` after `getProducts()`)
  - [ ] Wire "Unlock" buttons in paywall to `buyPro()` / `buyOcr()` — add loading state + error handling
  - [ ] Add "Restore purchases" link to paywall (App Store requirement)
  - [ ] Hide dev Pro/OCR test toggles in Settings before launch (or guard behind secret tap sequence)
  - [ ] Test full purchase flow on real devices with sandbox accounts (Android + iOS)
  - [ ] Test re-install: `restorePurchases()` should rehydrate entitlements from receipt

---


## 12. Code Rules

### Architecture
- **Vanilla JS only.** No React, Vue, Svelte, Alpine, no build step.
- **No external runtime dependencies** beyond pdf.js, mammoth.js, and Capacitor plugins in Section 2.
- **No npm utility packages** (no lodash, moment, date-fns). Write what you need.
- **No CSS frameworks** (no Tailwind, Bootstrap).

### Storage
- **Never localStorage for purchase state.** Always Capacitor Preferences.
- localStorage fine for: position, WPM, theme, UI state.
- All keys prefixed `fr_`.

### Performance
- No layout thrashing during playback. Word stage must repaint at 600+ WPM (~100ms).
- Lazy-render PDF canvas pages.
- Use `requestAnimationFrame` for scroll animation.
- Build spans once; manipulate classes during playback.

### UX
- **Reading position is sacred.** Every navigation must call `savePosition()`.
- Never more than one modal at a time.
- Always show loading state for operations over 200ms.
- Never show raw exception text to user.

### Style
- Functions: verbs (`renderUpload`, `acquireWakeLock`). State: nouns (`words`, `index`).
- Files single-purpose. Comments explain *why* not *what*.

### When to stop and ask
- Before any new dependency.
- Before changing palette or typography.
- Before adding any new file format.
- Before changing pricing.
- Before adding features not listed here.

---

## 13. Communication Protocol

At session start: acknowledge reading AGENTS.md and state the current task. Before starting: briefly state the plan. After completing: mark done, ask if user wants to test or move on. If ambiguous: ask, don't guess. If something breaks: show the actual error, explain the cause, propose the fix. Never silently introduce features not listed here.

---

## 14. Project Status

- **Current phase:** Phase 12 — Engagement, Navigation, OCR Vision
- **Target platforms:** Android first, iOS second.
- **Target launch:** TBD — quality over speed.

*This document is the contract. Update it before changing direction, not after.*
