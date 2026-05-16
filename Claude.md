# FlowRead — Build Manual for Claude Code

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

## 11. Active Phase

Phases 0–10 are complete. Phase 11 is complete. Current work is Phase 12.

### PHASE 11 — Share Extension & Deeper Sync (Completed)

- [x] **Task 11.1 — Widen device sync search**
  - Implemented native Android storage scan via custom Capacitor plugin.
  - Scans external storage recursively (depth-limited), free/pro extension gating (`.pdf` for free, `.pdf/.docx/.txt` for pro), and shows source paths.
  - Results persist on home screen under **Readable files on device**.

- [x] **Task 11.2 — Android Share Extension (receive URL from browser)**
  - Added Android share-sheet intent support.
  - Share payload bridged to JS, Pro gate enforced, article fetched/saved locally, and opened in reader using default mode.
  - Shared URL items appear in library/dashboard and support progress tracking.

- [x] **Task 11.3 — Error boundary**
  - Global error boundaries in `app.js` now surface plain-language fallback card and return user safely to home.

- [x] **Phase 11 UX follow-ups**
  - Home library split into `Recent` and collapsible `Read` (100% complete only).
  - `Readable files on device` section is collapsible and defaults collapsed after each sync.
  - Top Settings entry point added in upload header for quick access.

- [x] **Important intermittent next task**
  - Going from any mode to `Scroll` now shows a loading spinner and progress overlay while the rebuild or cache restore completes.


### PHASE 12 — Engagement, Navigation, OCR Vision



- [x] **Task 12.3 — On-device OCR Vision (Android complete)**
  - ✅ Scope shipped: scanned (image-only) PDFs + standalone image import (JPG/PNG/WEBP). Mixed PDFs deferred.
  - ✅ Android: custom `FlowReadOcr` Capacitor plugin in `android/app/src/main/java/com/flowread/app/FlowReadOcrPlugin.java`. Wraps ML Kit Text Recognition v2 with explicit `script` parameter (`'latin'` | `'devanagari'`). Replaces the published `@pantrist/capacitor-plugin-ml-kit-text-recognition` package, which hardcoded Latin-only and silently dropped Hindi (Devanagari) characters.
  - ✅ Gradle deps: `play-services-mlkit-text-recognition:19.0.1` (Latin) + `play-services-mlkit-text-recognition-devanagari:16.0.1` — both bundled into the APK, fully offline.
  - ✅ JS OCR engine (`www/js/parser/ocr.js`) auto-tries Latin first, falls back to Devanagari if results are thin, and merges both for mixed Hindi+English pages.
  - ✅ Scanned-PDF detection (`www/js/parser/pdf.js`) now uses three signals: word-count threshold (≥30/page), scanner-app watermark regex (CamScanner, OKEN Scanner, etc.), and garbage-text heuristic — so scanner apps' bad embedded OCR layers no longer bypass our recognizer.
  - ✅ Image OCR pipeline uses `FileReader.readAsDataURL()` instead of canvas — avoids WebView OOM on 12MP+ phone photos.
  - ✅ PDF OCR pipeline: 3× scale, max 3000px side, white-fill background, plus fallback that extracts the largest embedded image XObject directly when full-page render returns nothing (handles JBIG2/JPEG2000 scanner outputs).
  - ✅ "Image / Scan" import card on home screen — multi-select gallery support.
  - ✅ Gate: Pro + OCR Vision add-on ($4.99 one-time). Free/Pro-only users see upgrade prompt. Dev bypass available in Settings > Developer.
  - ✅ OCR imports persist locally so files are not reprocessed on every launch.
  - ⏳ **iOS implementation still required** — use Apple Vision Framework (`VNRecognizeTextRequest`), NOT ML Kit. Apple Vision supports script auto-detection across most languages natively, so a single recognizer call typically covers Latin + Devanagari + CJK + Cyrillic without separate models. Must be wired through an equivalent custom Capacitor plugin in `ios/App/App/`.

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

### Language support reference (added during 12.3)

**Normal (text-layer) PDFs:**
- ✅ Latin + diacritics (English, French, Spanish, German, Italian, Portuguese, Dutch, Polish, Turkish, Vietnamese, etc.) — works out of the box; bundled fonts cover the glyphs.
- ✅ Cyrillic (Russian, Ukrainian, Bulgarian, Serbian) and Greek — Roboto/Open Sans already include these glyphs.
- ❌ Devanagari (Hindi, Marathi, Nepali, Sanskrit) — would need to bundle a Devanagari font (Noto Sans Devanagari) for correct rendering; ASCII fallback otherwise.
- ❌ CJK (Chinese/Japanese/Korean) — needs CJK font (~5–15 MB per script) AND word-segmentation logic (no spaces between words; `split(/\s+/)` produces one giant token per line).
- ❌ Thai, Khmer, Lao — same word-segmentation issue.
- ❌ Arabic, Hebrew, Urdu — already excluded in v1 (Section 9, item 8) due to RTL layout work.

**On-device OCR (ML Kit script models, Android):**
- ✅ Latin — covers ~30 European + SE Asian Latin-script languages (already included).
- ✅ Devanagari — covers Hindi, Marathi, Nepali, Sanskrit (already included).
- Available but not yet added (each ~3–5 MB APK overhead):
  - `play-services-mlkit-text-recognition-chinese` (Simplified + Traditional)
  - `play-services-mlkit-text-recognition-japanese`
  - `play-services-mlkit-text-recognition-korean`
- ❌ ML Kit does NOT support: Cyrillic, Arabic, Hebrew, Thai, Tamil, Bengali. Tesseract.js or a cloud OCR fallback would be required for those markets.




- [x] **Task 12.5 — Internal Dictionary** (Completed)
  - ✅ 82,559-word local offline dictionary from WordNet 3.1 (Pro feature)
  - ✅ Single tap on any word in RSVP/Chunk/Scroll/FocusBold → shows definition modal
  - ✅ Free users see Pro upgrade prompt with "Look up online" fallback
  - ✅ Dictionary auto-loads in background on reader open (zero delay on first tap)
  - ✅ Playback auto-pauses when dictionary opens
  - ✅ Definitions capped at 2 per word, max 120 chars (7.98 MB file, compresses further in APK/IPA)

- [x] **Task 12.6 — Clean Up Tasks** (Completed)
  - ✅ **Task 1:** URL button in reader — opens source article in system browser
  - ✅ **Task 2:** IMG button in reader — fullscreen gallery modal for viewing original OCR source images
  - ✅ **Task 3:** Updated OCR accuracy limitation — notes best practices (flat, well-lit, straight-on); accuracy drops with poor conditions
  - ✅ **Task 4:** Paste Text reader — free feature, card + modal, saves to library, 10-char minimum
  - ✅ **Task 5:** Camera + Gallery action sheet — Image/Scan card now shows Take Photo / Choose from Gallery; camera integration via @capacitor/camera
  - ✅ **Task 6:** RSVP onboarding calibration — live word-flashing at chosen WPM with adaptive tier texts; slider/buttons update speed and restart preview; added Reset Onboarding toggle in Settings > Developer

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

## 13. Project Status

- **Current phase:** Phase 12 — Engagement, Navigation, OCR Vision
- **Target platforms:** Android first, iOS second.
- **Target launch:** TBD — quality over speed.

*This document is the contract. Update it before changing direction, not after.*
