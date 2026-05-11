# FlowRead — Build Manual for Codex

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> This document is the single source of truth for the FlowRead project. Every decision, feature, and architectural choice is documented here. If something isn't covered, ask the user before improvising.

---

## 0. Project Identity

**Name:** FlowRead (working title — final name TBD before store submission)

**One-line pitch:** Read everything faster. No subscription, no cloud, no account.

**What it is:** A privacy-first, fully offline speed reading app that converts any PDF into a high-speed reading experience using multiple scientifically-backed reading engines. Built with Capacitor (HTML/CSS/Vanilla JS wrapped into native Android/iOS).

**Why it exists:** Every speed reading app today either requires a subscription, an account, cloud upload of your files, or some combination of all three. FlowRead does none of that. Your files never leave your device. You pay once. You own it forever.

**Target user:** Adult readers who consume PDFs regularly — students, researchers, professionals, self-learners, non-fiction readers. Global English-speaking market primarily, with non-English support planned for v2.

---

## 1. Core Principles (Non-Negotiable Rules)

These principles override any other instruction. If a feature conflicts with these, the feature must change, not the principles.

### 1.1 100% Offline Everything (except URL fetch in Pro)
- No backend server. No cloud APIs. No analytics that phone home.
- All file parsing happens client-side using pdf.js and mammoth.js.
- All progress, settings, and stats stored locally on device.
- The only network request the free app ever makes is to download Google Fonts on first load (cached forever after). Eventually we'll bundle fonts to remove even this.
- The Pro URL reader feature makes a single fetch per article — explicitly labelled "requires internet" in UI.

### 1.2 No Accounts, Ever
- No sign-up. No login. No email collection. No password.
- The app should be fully functional 1 second after first launch.
- Pro upgrade is verified via App Store / Play Store receipt, not via a server.

### 1.3 No Subscriptions
- One-time payments only. Pro unlock and OCR upgrade are both lifetime.
- If we ever add new paid features, they are new one-time purchases — never recurring.

### 1.4 Privacy By Architecture
- The user's files never touch any server we control.
- We log nothing. We track nothing. We collect nothing.
- This isn't a marketing claim — it's the architecture. There is literally no place for user data to go.

### 1.5 Honest Limitations
- Every limitation is shown upfront in onboarding, not hidden in Terms of Service.
- We never silently fail. Errors are explained in plain language.

---

## 2. Tech Stack

- **Framework:** Capacitor 6+ (latest stable at time of build)
- **UI:** Vanilla HTML + CSS + JavaScript. No React. No Vue. No Svelte. No frameworks.
- **Why vanilla:** Performance on mid-range Android devices, smaller bundle size, fewer dependencies, easier to debug, faster cold start.
- **PDF parsing:** pdf.js (Mozilla)
- **DOCX parsing:** mammoth.js
- **Storage:** Capacitor Preferences plugin (wraps Keychain on iOS, EncryptedSharedPreferences on Android) for settings and small data. Capacitor Filesystem plugin for managing uploaded files.
- **Screen wake:** @capacitor-community/keep-awake plugin
- **In-app purchases:** @capacitor-community/in-app-purchases (or equivalent stable plugin at build time)
- **Fonts:** Playfair Display, DM Mono, Crimson Pro (initially from Google Fonts, bundled before launch)

**Folder structure to maintain:**
```
flowread/
├── android/                    # Capacitor-generated Android project
├── ios/                        # Capacitor-generated iOS project (added later)
├── node_modules/
├── scripts/                    # Build and utility scripts
├── www/                        # ALL APP CODE GOES HERE
│   ├── index.html             # Entry point
│   ├── css/
│   │   ├── base.css           # Reset, variables, typography
│   │   ├── components.css     # Buttons, toolbars, panels
│   │   ├── engines.css        # Per-engine styles
│   │   └── themes.css         # Theme variants
│   ├── js/
│   │   ├── app.js             # App initialization, routing
│   │   ├── state.js           # Global state management
│   │   ├── storage.js         # All localStorage/Preferences calls
│   │   ├── parser/
│   │   │   ├── pdf.js         # PDF extraction + cleaning engine
│   │   │   ├── docx.js        # DOCX extraction (Pro)
│   │   │   └── txt.js         # Plain text handler
│   │   ├── engines/
│   │   │   ├── rsvp.js
│   │   │   ├── chunk.js
│   │   │   ├── scroll.js
│   │   │   ├── highlight.js
│   │   │   └── focusbold.js
│   │   ├── views/
│   │   │   ├── upload.js
│   │   │   ├── reader.js
│   │   │   ├── normal.js      # Embedded PDF view
│   │   │   ├── dashboard.js   # Pro
│   │   │   └── settings.js
│   │   ├── features/
│   │   │   ├── chapter-detection.js
│   │   │   ├── cleaning.js
│   │   │   ├── bridge.js      # Bi-directional sync
│   │   │   ├── keep-awake.js  # Screen wake lock
│   │   │   └── purchase.js    # IAP handling
│   │   └── utils/
│   │       ├── dom.js
│   │       └── format.js
│   └── assets/
│       ├── fonts/
│       └── icons/
├── capacitor.config.ts
├── package.json
└── AGENTS.md                   # THIS FILE
```

---

## 3. Business Model & Pricing

### Pricing tiers
| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | Unlimited PDFs, all 5 reading engines, all core features for PDF |
| **Pro** | $24.99 Android / $39.99 iOS | All file formats + dashboard + dictionary + themes + sync |
| **OCR Vision** | $9.99 (free or Pro user) | Read scanned/image-based PDFs |

### Conversion psychology
- Free tier is genuinely useful so users keep the app installed and build habit.
- The Pro paywall hits naturally when user tries to open a DOCX, paste a URL, or view the dashboard.
- OCR paywall hits when user opens a scanned PDF — a moment of high purchase intent.

### Store fees to remember in calculations
- iOS: 30% (15% if under $1M lifetime revenue via Small Business Program)
- Android: 15% on first $1M lifetime revenue

---

## 4. The 5 Reading Engines (All Free for PDF)

Each engine renders text differently but shares the same underlying word stream and progress tracking.

### 4.1 RSVP (Rapid Serial Visual Presentation)
**What it does:** Flashes one word at a time at a fixed central position. The user's eyes stay still; words come to them.

**Why it works:** Eliminates saccades (eye movements between words), which take ~30% of reading time. Allows 400–700 WPM with practice vs ~250 WPM normal reading.

**Implementation rules:**
- Word displays for `60000 / wpm` milliseconds, with longer pauses on punctuation (1.8× on `.!?`, 1.3× on `,;:`).
- ORP (Optimal Recognition Point) — the visual fixation letter — is at ~33% into the word. Highlighted subtly in warm amber (`#b8995a`), never bright yellow.
- **NO FLASH ANIMATION.** Words swap instantly. Animation causes strobe effect and eye strain.
- Background of word stage is warm dark (`#161410`), not pure black. Reduces contrast shock.
- Word font: Crimson Pro, weight 400 (NOT bold heavy display font — too much visual weight per flash).
- Default font size: 48px, adjustable A−/A+ (24px–80px range).
- Comfort controls visible below stage: A−/A+ buttons, ORP toggle, Context toggle, Calm mode toggle.
- Context line above stage: shows previous 4 words in faded italic when toggled on.
- Calm mode dims header, toolbar, playback bar to 15% opacity. Hover/tap to reveal.

### 4.2 Chunk Mode
**What it does:** Flashes 2–7 words at a time (user-selectable) instead of single words.

**Why it works:** Better comprehension than single-word RSVP. Trains peripheral vision to take in word groups.

**Implementation rules:**
- Chunk size selector: dropdown with 2, 3, 4, 5, 7 word options. Default 3.
- Display delay: `(60000 / wpm) * chunkSize` milliseconds per chunk.
- Punctuation pauses apply to last word in chunk.
- Same warm typography as RSVP but no ORP needed (multiple words don't have a single fixation point).

### 4.3 Focus Bold (Bionic Reading-style)
**What it does:** Renders the full text with the first ~40% of letters in each word bolded. User reads at their own pace; bold letters act as fixation anchors.

**Why it works:** The bold portions create artificial fixation points that guide the eye and reduce subvocalization.

**Implementation rules:**
- Do NOT call it "Bionic Reading" in UI — trademarked. Call it "Focus Bold."
- First `Math.max(1, Math.ceil(word.length * 0.4))` characters bolded.
- Bold portion in normal text colour. Non-bold portion in muted colour. As user "passes" each word during playback, both portions become full colour.
- During playback, a subtle background highlight follows the current word.
- Auto-scrolls to keep current word in view.

### 4.4 Guided Highlighting
**What it does:** Displays the full text page. A "pace car" highlight moves through it word by word at the set WPM.

**Why it works:** Prevents regression (eye skipping back to re-read), enforces consistent pace.

**Implementation rules:**
- Yellow/amber highlight on the current word, no fade animations.
- Previously-read words shown in full text colour.
- Unread words shown muted.
- Auto-scrolls to keep current word centred.
- Recommended in onboarding for multi-column documents where RSVP gets jumbled.

### 4.5 Simple Scroll (Teleprompter)
**What it does:** Full text scrolls upward continuously at speed derived from WPM.

**Why it works:** Most natural feeling, good for long sustained sessions, doesn't fragment text into flashes.

**Implementation rules:**
- Independent scroll speed multiplier (0.25× to 4×) separate from WPM. WPM determines base scroll speed, multiplier adjusts.
- Gradient masks at top and bottom for clean fade.
- Optional centre line indicator.
- Speed multiplier control appears in playback bar ONLY when in scroll mode.

---

## 5. The Cleaning Engine (Critical for PDF Quality)

Raw PDF text extraction is messy. The cleaning engine pre-processes every PDF before feeding text to the reading engines.

### What it does
1. Extracts text page-by-page with full position data (x, y coordinates).
2. Groups text items into lines using y-coordinate tolerance.
3. Sorts lines top-to-bottom; sorts items within each line left-to-right.
4. Detects repeating headers and footers across pages by frequency.
5. Strips standalone page numbers.
6. Removes ISBN, ISSN, DOI lines and bare URLs.
7. Strips null bytes and encoding artifacts.
8. Builds `pageWordIndex[]` map: array indexed by page number, value = word index where that page starts. CRITICAL for bi-directional sync.

### Detection rules
- A line is a header if it sits in top 14% of page AND its normalised text appears on 12%+ of pages.
- Same logic for footers in bottom 14%.
- Normalisation: lowercase, digits replaced with `#`, punctuation stripped, whitespace collapsed.

### What it replaces (does NOT strip)
- Tables → `[Table — Tap to View]` placeholder text in the word stream.
- Images/diagrams → `[Image — Tap to View]` placeholder.
- Math equations → `[Equation — Tap to View]` placeholder.
- Each placeholder is tappable — jumps to Normal PDF View at the page containing the original.

### Implementation file
`www/js/parser/pdf.js` — must export both the cleaned word array and the `pageWordIndex[]` map.

---

## 6. The Embedded Bridge System (The Killer Feature)

Bi-directional sync between speed reading and the original PDF page view.

### Normal → Speed
- User opens Normal View (real PDF pages rendered via pdf.js canvas).
- User navigates to any page.
- User taps "▶ Read from here" button in Normal toolbar.
- App looks up `pageWordIndex[currentPage]` to find exact word index.
- Switches to RSVP (or last-used engine) starting from that word.
- Button briefly shows green checkmark "✓ Jumping..." as confirmation.

### Speed → Normal
- During any speed reading mode, a floating toggle button is visible (bottom right).
- User taps it.
- App does reverse lookup: finds the page whose `pageWordIndex` value is closest to (but not greater than) the current word index.
- Opens Normal View at that page.

### Why it matters
This is what makes the app actually usable for non-fiction. Someone reading a research paper hits a confusing graph in the RSVP stream — they tap, see the original, then tap again to resume reading at the same spot. Without this, speed reading is only useful for novels.

---

## 7. Screen Wake Lock (User Experience Critical)

**The problem:** Default phone behaviour is to dim and lock the screen after 30 seconds of no touch. During RSVP at 300 WPM, the user is not touching the screen — they're just reading. The screen lock would interrupt every reading session.

**The solution:** Use `@capacitor-community/keep-awake` plugin to prevent screen from auto-locking while the user is actively reading.

### Implementation rules
- **Acquire wake lock** when:
  - User opens any reading view (RSVP, Chunk, Focus Bold, Guided Highlight, Scroll, or Normal).
  - User starts playback in any speed engine.
- **Release wake lock** when:
  - User exits to upload screen / dashboard / settings.
  - User pauses playback AND has been idle for 5 minutes (don't drain battery if they walked away).
  - App goes to background.
- **Auto-reacquire** when:
  - User returns from background AND a reading view is still active.

### Important
- Don't keep wake lock active globally — only while reading. Battery drain matters.
- Show a small indicator (subtle, optional) when wake lock is active so user knows.
- Wake lock must be released when app is backgrounded — Capacitor handles this automatically but verify.

### File
`www/js/features/keep-awake.js` — wraps the plugin with the acquisition/release logic.

---

## 8. UI Design System

### Colours (CSS variables)
```css
:root {
  --bg: #0d0d0d;
  --surface: #141414;
  --surface-2: #1c1c1c;
  --border: #2a2a2a;
  --accent: #e8c547;
  --accent-2: #c47a3a;
  --text: #e8e4dc;      /* Warm off-white, NOT pure white */
  --text-muted: #6b6660;
  --text-dim: #3a3632;
  --rsvp-stage-bg: #161410;
  --rsvp-text: #d4cfc5;
  --rsvp-orp: #b8995a;
  --success: #5a9a6a;
  --error: #c45a3a;
}
```

### Typography
- **Headings/display:** Playfair Display (700/900 weight)
- **Body/reading:** Crimson Pro (400 weight)
- **Labels/numbers/code:** DM Mono (300/400/500 weight)

### Rules
- Pure black (#000) is forbidden anywhere text is displayed. Always use the warm dark surfaces.
- Pure white (#fff) is forbidden anywhere text appears. Use `--text` (warm off-white).
- Border radius: 2–4px on small elements, never more than 6px. No fully rounded "iOS pill" buttons.
- Animations: 0.12–0.2s for hovers, 0.3s for view transitions. No bounce easings.
- No flash animations on RSVP word transitions. Instant swap only.

---

## 9. Honest Limitations (Onboarding + Settings)

These must be shown explicitly on first launch and accessible from Settings → "Supported Formats & Known Limitations."

1. **Scanned PDFs** — Free version reads only digital text (PDFs where you can highlight words in any normal viewer). Image-based scans require OCR Vision upgrade.

2. **DRM-protected files** — Kindle (.azw), Adobe Digital Editions, and other DRM-locked files cannot be read. Clear error message shown on import attempt. We do not provide DRM removal advice.

3. **Multi-column documents** — Two-column academic papers (IEEE, ACM format) may have reading-order issues. Recommend Guided Highlighting mode for these.

4. **Tables and images** — Not read word-by-word. Shown as `[Object — Tap to View]` placeholders in the speed reading stream. Tap to view the original in Normal View.

5. **Math equations** — Skipped or shown as `[Equation — Tap to View]` placeholders.

6. **Handwriting** — App is designed for printed text. Cursive or handwritten notes will not parse accurately, even with OCR.

7. **Password-protected PDFs** — Detected at import. Clear error message: "This PDF is password-protected. Please remove the password and re-import."

8. **RTL languages** — Currently optimised for left-to-right languages only. Arabic, Hebrew, Urdu support planned for v2.

9. **Offline dictionary coverage** — Pro tier dictionary contains ~150k common words. Specialised medical, legal, or technical terms may not be found. System dictionary fallback is available on iOS and Android.

10. **URL reader (Pro)** — Requires internet connection for initial article fetch. Parsing happens locally on device. Article content is never transmitted to any server we control.

---

## 10. Build Phases & Tasks

> **For Codex: complete tasks in order. Do not skip ahead. Each phase must work end-to-end before moving to the next.**

### PHASE 0 — Project Scaffolding ✅ COMPLETE

- [x] **Task 0.1:** Initialize Capacitor project with bundle ID `com.flowread.app`.
- [x] **Task 0.2:** Create folder structure as specified in Section 2.
- [x] **Task 0.3:** Install required Capacitor plugins (using v5/v6 compatible with Node 18):
  - `@capacitor/preferences@6`
  - `@capacitor/filesystem@6`
  - `@capacitor/app@6`
  - `@capacitor-community/keep-awake@5` (v5 is the Capacitor 6 compatible release)
- [x] **Task 0.4:** pdf.js 3.11.174 legacy build + mammoth.js 1.8.0 in `www/assets/lib/`. Note: use `legacy/build/` path — pdfjs-dist 4.x removed the UMD build; 3.11 legacy works with plain `<script>` tags. Worker disabled (empty string) for Capacitor WebView compatibility.
- [x] **Task 0.5:** `index.html` with viewport meta, CSP, Google Fonts, four view containers, correct script load order.
- [x] **Task 0.6:** `base.css` with full design token system, CSS reset, loading overlay, toast container.
- [x] **Task 0.7:** Android platform added (`@capacitor/android@6`). Java 17 pinned in `android/gradle.properties`. iOS platform added (CocoaPods not installed — user must run `sudo gem install cocoapods && npx cap sync ios` before iOS testing). App verified running on Android.

### PHASE 1 — Upload & PDF Parsing ✅ COMPLETE

- [x] **Task 1.1:** Upload screen with tap-to-open zone, file picker (`.pdf` only), non-PDF rejection error.
- [x] **Task 1.2:** `parser/pdf.js` — text extraction with x/y coordinates, line grouping, header/footer detection (top/bottom 14%, 12% frequency threshold), noise stripping, `pageWordIndex[]` map, placeholder detection for image gaps.
- [x] **Task 1.3:** Loading overlay with per-page progress ("Processing page X of Y").
- [x] **Task 1.4:** Error handling: password-protected (`PasswordException`), corrupted (`InvalidPDFException`), scanned (avg < 5 words/page → OCR upsell button).
- [x] **Task 1.5:** File metadata saved to localStorage (`fr_library`). Word position saved per file (`fr_pos_<id>`). File ID: `btoa(name+size)`. Note: words array held in memory only (too large for localStorage).

### PHASE 2 — RSVP Engine (First Engine, Most Critical) ✅ COMPLETE

- [x] **Task 2.1:** Build RSVP view with word stage, context line, progress text, and comfort controls row.
- [x] **Task 2.2:** Implement word rendering with ORP highlight at 33% position.
- [x] **Task 2.3:** Playback timer with recursive setTimeout, punctuation pauses (1.8× `.!?`, 1.3× `,;:`).
- [x] **Task 2.4:** Playback controls: play/pause, skip ±10/±50, position display.
- [x] **Task 2.5:** WPM slider (60–800, step 10), +/− buttons, default 260, persisted.
- [x] **Task 2.6:** Comfort controls: A−/A+ (24–80px, targets `.rsvp-word-wrap` not stage), ORP toggle, Context toggle, Calm mode.
- [x] **Task 2.7:** Auto-resume: position saved on pause/skip/every 30 words. Resume toast on open.
- [x] **Task 2.8:** Wake lock via `@capacitor-community/keep-awake@5`. 5-min idle release timer. Released on back navigation.
- [x] **Task 2.9:** 2px accent progress bar fixed at top of reader view.

### PHASE 3 — Additional Engines ✅ COMPLETE

- [x] **Task 3.1:** Chunk mode with size selector (2–7 words). Auto-shrinks font to fit on single line.
- [x] **Task 3.2:** Focus Bold mode — page-mode bionic reading. Fills the visible screen with words, no internal scroll. Highlight progresses through page, then swaps to next page when complete. Calm, book-like UX.
- [x] **Task 3.3:** ~~Guided Highlighting mode~~ — Removed. Replaced by Focus Bold page mode (same effect, simpler UX).
- [x] **Task 3.4:** Simple Scroll mode with independent speed multiplier (0.25×–4×). Transparent amber focus guide line with adjustable thickness (1–10px). Gradient masks at top/bottom.
- [x] **Task 3.5:** Mode tabs (RSVP / Chunk / Focus / Scroll) — engine switch preserves word position via `destroy()`/`init()` lifecycle. WPM changes immediately reschedule the active engine.

#### Sub-tasks added:
- [ ] **Task 3.6:** Test all 4 engines on 5+ diverse PDFs (novel, textbook, technical paper, long doc, edge cases). Verify smooth playback at 600+ WPM, no memory leaks during 10-minute sessions.
- [ ] **Task 3.7:** Profile and optimize virtual windowing in Focus Bold — ensure 200+ page PDFs render sub-50ms per page transition. Verify no layout thrashing during rapid WPM changes.

### PHASE 4 — Normal (Embedded PDF) View ✅ COMPLETE

- [x] **Task 4.1:** Render PDF pages to canvas using pdf.js.
- [x] **Task 4.2:** Page navigation: prev/next buttons, page input field, "go to page" function.
- [x] **Task 4.3:** Zoom controls: +/-, percentage display, Fit Width button.
- [x] **Task 4.4:** Lazy-render pages on scroll (don't render all 500 pages at once for big PDFs).
- [x] **Task 4.5:** Acquire screen wake lock in Normal view too.

### PHASE 5 — The Embedded Bridge (Bi-Directional Sync) ✅ COMPLETE

- [x] **Task 5.1:** Add "▶ Read from here" button in Normal view toolbar. On click, use `pageWordIndex[currentPage]` to switch to RSVP at that word.
- [x] **Task 5.2:** Add floating toggle button in speed engines (bottom right). On tap, reverse-lookup current word index → find nearest page → open Normal view at that page.
- [x] **Task 5.3:** Implement `[Object — Tap to View]` placeholders in cleaned text stream. Each placeholder stores the page it came from. Tapping it opens Normal view at that page.

### PHASE 6 — Index Panel & Chapter Detection ✅ COMPLETE

- [x] **Task 6.1:** Build slide-in panel from right side.
- [x] **Task 6.2:** Position seek slider (0–100%) with Go button — always works regardless of chapter detection.
- [x] **Task 6.3:** Implement chapter detection: scan cleaned lines for heading patterns (Chapter N, Part N, all-caps standalone, numbered sections, Title Case short lines).
- [x] **Task 6.4:** Render chapter list with depth indentation, percentage position, and current-section highlight.
- [x] **Task 6.5:** Search-within-index input to filter chapters.

### PHASE 7 — Onboarding & Limitations

- [ ] **Task 7.1:** First-launch onboarding flow:
  - Welcome screen with one-line pitch.
  - "What this app can read" screen.
  - "What this app can't read" screen (all 10 limitations).
  - "Pick your reading speed" — show a 30-second WPM calibration with sample text in scroll mode at 200 WPM, let user adjust to comfortable speed.
  - Done.
- [ ] **Task 7.2:** Settings screen with "Supported Formats & Known Limitations" section that re-shows all 10 limitations.
- [ ] **Task 7.3:** Detect and clearly message: password-protected PDFs, scanned PDFs (no text layer), corrupted files.

### PHASE 8 — Settings & Polish

- [ ] **Task 8.1:** Settings screen with categories:
  - Reading: default WPM, default chunk size, default mode.
  - Display: font size scale, theme (only OLED Black for free, others greyed out with Pro lock icon).
  - Comfort: ORP default, context default, calm mode default.
  - About: version, limitations, privacy statement, "this app collects no data" note.
- [ ] **Task 8.2:** Free tier file library: list of opened files, % read, last opened. Tap to resume. Option to sync, so users can get all pdfs(free version, for pro, show last used urls, docx, txt files as well.
)
- [ ] **Task 8.3:** Loading states everywhere file operations happen.
- [ ] **Task 8.4:** Error boundaries — never let a parser error crash the whole app.

### PHASE 9 — Pro Paywall Stubs (UI Only for MVP)

- [ ] **Task 9.1:** Pro features show with lock icons in UI (DOCX upload, dashboard, themes, etc.).
- [ ] **Task 9.2:** Tapping any Pro feature shows the paywall screen: feature list, price, "Unlock Pro" button. Button is non-functional in MVP — purchase flow comes in v1.1.
- [ ] **Task 9.3:** "OCR Vision" lock screen for scanned PDFs with same non-functional button.

### PHASE 10 — Pre-Launch Testing

- [ ] **Task 10.1:** Test on at least 10 real-world PDFs of varying types (novels, textbooks, research papers, ebooks, two-column papers).
- [ ] **Task 10.2:** Test on low-end Android device (4GB RAM) — verify no lag during 600 WPM RSVP.
- [ ] **Task 10.3:** Verify wake lock works correctly: acquired on read, released on exit, reacquired on resume.
- [ ] **Task 10.4:** Verify auto-resume works across app kills.
- [ ] **Task 10.5:** Run for 1 hour straight reading — verify no memory leaks, no slowdowns.

---

## 11. Rules for Codex

These rules govern how Codex should approach building this project.

### 11.1 Architecture rules
- **Vanilla JS only.** Do not introduce React, Vue, Svelte, Alpine, or any framework. Do not introduce a build step beyond what Capacitor provides.
- **No external runtime dependencies** beyond pdf.js, mammoth.js, and Capacitor plugins listed in Section 2.
- **No npm packages for utility functions** (no lodash, no moment, no date-fns). Write what you need.
- **No CSS frameworks** (no Tailwind, no Bootstrap). Hand-write CSS using the variables in Section 8.

### 11.2 Storage rules
- **Never use plain `localStorage` for purchase state.** Always use Capacitor Preferences (Keychain on iOS, EncryptedSharedPreferences on Android). localStorage clears on uninstall — purchase records must survive.
- **localStorage IS fine** for: reading position per file, current WPM, theme preference, UI state.
- **All storage keys prefixed** with `fr_` to avoid conflicts. Example: `fr_pos_<filename>`, `fr_settings`, `fr_purchase_pro`.

### 11.3 Performance rules
- **No layout thrashing** during RSVP playback. The word stage must repaint smoothly at 600+ WPM (roughly every 100ms).
- **Lazy-render PDF canvas pages.** Don't render all 500 pages at once for a textbook.
- **Use `requestAnimationFrame`** for scroll mode animation, not `setInterval`.
- **Avoid heavy DOM operations during playback.** Build word spans once during file load, manipulate classes during playback.

### 11.4 Wake lock rules
- Always check if a reading view is genuinely active before acquiring wake lock.
- Always release on view exit, app background, or 5-minute idle pause.
- Never hold wake lock outside of reading views.

### 11.5 User experience rules
- **Reading position is sacred.** Every navigation action must call `savePosition()`.
- **Never show more than one modal at a time.**
- **Always show loading state** for operations over 200ms.
- **Errors are always explained in plain language.** Never show raw exception text to the user.

### 11.6 Code style rules
- Functions named with verbs (`renderRSVP`, `extractPDF`, `acquireWakeLock`).
- State variables named with nouns (`words`, `currentIndex`, `wpm`).
- Files single-purpose: one engine per file, one feature per file.
- Comments explain *why*, not *what*. If the code needs a "what" comment, rewrite it.

### 11.7 When to stop and ask the user
- Before adding any new dependency.
- Before changing the colour palette or typography.
- Before adding any new file format.
- Before changing pricing or business model.
- Before adding any feature not listed in this document.

---

## 12. What Goes Where (Pro vs Free Quick Reference)

| Feature | Free | Pro |
|---|---|---|
| PDF reading (all 5 engines) | ✅ | ✅ |
| Cleaning engine + placeholders | ✅ | ✅ |
| Normal PDF view + sync | ✅ | ✅ |
| Chapter detection + index | ✅ | ✅ |
| Auto-resume | ✅ | ✅ |
| Basic file list | ✅ | ✅ |
| Wake lock during reading | ✅ | ✅ |
| OLED Black theme | ✅ | ✅ |
| Basic tap-to-define (system) | ✅ | ✅ |
| DOCX support | ❌ | ✅ |
| TXT support | ❌ | ✅ |
| URL reader | ❌ | ✅ |
| Share extension | ❌ | ✅ |
| Dashboard + KPIs | ❌ | ✅ |
| Local WordNet dictionary | ❌ | ✅ |
| Sepia + High Contrast themes | ❌ | ✅ |
| OpenDyslexic font | ❌ | ✅ |
| Typography controls | ❌ | ✅ |
| Reading rulers | ❌ | ✅ |
| BYOC sync | ❌ | ✅ |
| WPM calibration | ✅ (basic) | ✅ (full) |
| **OCR Vision** | $9.99 add-on | $9.99 add-on |

---

## 13. Post-MVP Roadmap (Don't Build Yet)

### v1.1 — Pro tier activation (3 months post-launch)
- IAP integration for Pro unlock
- DOCX support
- URL reader (Mozilla Readability)
- Share extension
- Local WordNet dictionary
- Full dashboard
- Themes
- Typography controls

### v1.2 — OCR Vision (6 months post-launch)
- ML Kit (Android) / Vision Framework (iOS)
- IAP integration for OCR upgrade
- On-device model download flow

### v2 — Expansion (12+ months)
- RTL language support
- iPad/tablet optimised layout
- Advanced Stats Pack
- Power Reader Pack
- Possible web version

---

## 14. Communication Protocol with User

When Codex is working on this project, it should:

1. **At session start:** Acknowledge reading AGENTS.md and state which phase/task it's working on.
2. **Before starting a task:** Briefly state the plan.
3. **After completing a task:** Mark it done and ask if user wants to move to the next or test first.
4. **If a task is ambiguous:** Ask, don't guess.
5. **If something breaks:** Show the actual error, not a paraphrase. Explain the cause, then propose the fix.
6. **Never silently introduce features** not listed in this document.

---

## 15. Project Status

- **Current phase:** Phase 7 — Onboarding & Limitations
- **Web prototype:** Exists separately (single-file HTML) for reference. Use as inspiration, not as code to copy directly — we're rewriting properly into the modular structure above.
- **Target platforms:** Android first, iOS second.
- **Target launch:** TBD — focus on quality over speed.

---

*This document is the contract. Update it before changing direction, not after.*
