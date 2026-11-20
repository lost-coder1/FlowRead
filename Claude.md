# FlowRead — Build Manual for Claude Code

> **Read this whole file before writing code.** It is the contract: the rules that bind future
> work, stated once. It is kept short on purpose — it loads into every session.
>
> **Four documents:**
> - **`CLAUDE.md`** (this file) — the rules. No status, no post-mortems.
> - **`docs/Design-notes.md`** — the long-form *why* behind every rule here: what was tried, what
>   broke, what the field found. **Same section numbers.** Read the matching section there before
>   changing a rule, and before "fixing" one that looks arbitrary — most of them were got wrong
>   once already, and the note says how.
> - **`Tasks.md`** — the live board: what is open, what it waits on, every decision taken.
> - **`Tasks-archive.md`** — completed work and resolved device findings. Nothing in it is current.
>
> **The split rule:** a constraint that binds future work goes here; its reasoning goes in the
> notes; status and per-task detail go in `Tasks.md`; a record of an action already taken goes in
> the archive. **Do not grow narrative in this file** — that is what made it unreadable before.

---

## 0. Identity

**FlowRead** — a reading-habit app for Android. Speed reading (5 engines), a curated free-books
library, and a habit-interception system that gently redirects time in distracting apps toward
reading. Privacy-first: offline reading, no account, files never leave the device.

**Pitch:** build a daily reading habit. FlowRead nudges you to read instead of scroll — pick the
apps that distract you, get a gentle prompt to read first, you're always in control.

**The pivot (notes §0.1).** FlowRead launched as a speed-reading app for PDFs; that had a low
ceiling in the field. Unchanged: the engines, cleaning engine, bridge, library, offline-first
architecture, no accounts, privacy by architecture. Changed: habit-first positioning, the nudge
system as a core mechanic (§8), onboarding (§9), and the business model (§3). **Explicit non-goal:
this is not a hard app-blocker.**

---

## 1. Core Principles (non-negotiable)

1. **Offline-first, stated precisely.** No backend for reading, no cloud parsing, no analytics on
   reading behaviour. Internet is needed only for: the Pro URL reader (one labelled fetch), Free
   Books downloads (one fetch, then offline forever), store billing, and §8.6's anonymous pings
   (silent failure, never blocking).
2. **No accounts, ever.** Fully functional one second after first launch. Entitlements come from a
   store receipt only.
3. **Lifetime *and* subscription** (§3). The lifetime product must never be removed or degraded to
   push subscriptions. No dark patterns: no hidden trial conversion, no forced annual pricing,
   cancellation is one tap through platform billing.
4. **Privacy by architecture.** Files never touch a server. No reading-content tracking, no uploads.
   §8.6's pings are the one deliberate, minimal, anonymous exception — never extend them to reading
   content, file names, or any identifier.
5. **Honest limitations.** Shown upfront. Never silently fail. Plain-language errors, never raw
   exception text. A confident wrong number is a silent failure.
6. **The nudge is a nudge, not a wall.** Every interception carries an immediate, visible, one-tap
   way to continue to the original app. No hidden escape hatch, no guilt copy, no anxiety timers.

---

## 2. Tech Stack

- **Capacitor 8** (8.5.2) — keep every `@capacitor/*` on the same major; mixed majors do not work.
- **Vanilla HTML/CSS/JS.** No framework, no build step.
- **Parsing:** pdf.js 3.11.174 (legacy UMD), mammoth.js 1.8.0.
- **Storage:** Capacitor Preferences for purchase/subscription state. Filesystem for file data.
  localStorage for UI state, keys prefixed `fr_`.
- **Plugins:** keep-awake@8 · @capacitor/share 8.0.2 (outbound only, reuses the existing
  `${applicationId}.fileprovider`) · @capacitor/network 8.0.1 (read-only status listener).
- **IAP:** custom `FlowReadIapPlugin` over Play Billing **9.1.0**. Not @capacitor/in-app-purchases.
- **Habit interception:** `AccessibilityService` (§8.4, signed off 2026-09-20). `UsageStatsManager`
  is optional and supplementary.
- **Analytics:** plain `fetch()` to a Cloudflare Worker. No SDK, try/catch, silent failure.
- **Fonts:** Roboto (free default); Inter · Source Sans 3 · Open Sans · Lato (paid, bundled);
  DM Mono (labels/numbers); Noto Sans Devanagari (UI + content, via Google Fonts).

```
www/
  index.html
  css/   base.css · components.css · engines.css · themes.css
  i18n/  en.json · hi.json
  js/
    app.js · state.js · storage.js · i18n.js
    parser/  pdf.js · docx.js · txt.js
    engines/ page.js · rsvp.js · chunk.js · scroll.js · focusbold.js
    views/   upload.js · reader.js · normal.js · dashboard.js · settings.js
             free-books.js · onboarding.js
    features/ chapter-detection.js · cleaning.js · bridge.js · keep-awake.js
             paragraphs.js · purchase.js · notifications.js · word-tap.js
             nudge.js · nudge-apps.js · book-cover.js · analytics-ping.js
             share-stats.js · leaderboard.js · widget-bridge.js · tips.js
             celebration.js · dictionary.js · morphology.js · saved-words.js
             highlights.js · share-handler.js
worker/            — §8.6's receiver (Worker + D1 + wrangler.toml). Not in the app bundle.
android/app/src/main/java/com/flowread/app/
  FlowReadIapPlugin.java · FlowReadOcrPlugin.java · FlowReadDeviceSyncPlugin.java
  MainActivity.java · FlowReadNudgePlugin.java · FlowReadWidgetProvider.java
android/variables.gradle   — compileSdk/targetSdk/minSdk live HERE, not in app/build.gradle
android/app/build.gradle   — versionCode/versionName, ML Kit + Billing deps
android/gradle.properties  — UNTRACKED; pins org.gradle.java.home to JDK 21
```

**`.gitignore` ignores `android/` wholesale.** Hand-edited native files are force-added
individually (`git add -f`); a new one that is not will silently never be committed.

### 2.1 Build environment (required to build at all)

- **JDK 21** — `capacitor-android` sets `sourceCompatibility 21` with no toolchain, so Gradle must
  genuinely run on 21. **Node ≥22** for the CLI.
- **Two separate JDK pins, and the second wins in Android Studio:** `android/gradle.properties`
  (`org.gradle.java.home`, untracked) and `android/.gradle/config.properties` (`java.home`, which
  Studio reads when `gradleJvm` is `#GRADLE_LOCAL_JAVA_HOME`). A stale pin there gives
  `invalid source release: 21` in Studio while the terminal build succeeds. **Both must name JDK
  21.** Homebrew's is keg-only and will not appear in Studio's dropdown — add by path:
  `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`. AGP 8.13 needs Studio 2025.1.3+.
- **targetSdk/compileSdk 36, minSdk 24.** minSdk is forced by Cordova framework 14 via Capacitor 8;
  an override silently reverts on `npx cap sync`. It dropped ~1,641 device models — a cost paid, not
  a decision to revisit.
- `MANAGE_EXTERNAL_STORAGE` re-application is open; evaluate against API 36 policy.
- **A dated compliance item in this document needs acting on well before the date** — the Aug 2026
  deadline was missed and blocked every release for six weeks (notes §3).

---

## 3. Business Model

Prices decided 2026-10-30.

| Tier | Price | Unlocks |
|---|---|---|
| **Free** | ₹0 | Unlimited PDFs, all 5 engines, the **entire** library, bridge, dictionary, calm mode, basic dashboard, nudge on **1** app, leaderboard view-only |
| **Lifetime** (`pro_lifetime`) | **₹2,999** once | Everything today: Pro *and* OCR *and* unlimited nudge apps. **Not** future book drops. |
| **Subscription** (`flowread_plus`) | **₹149/mo · ₹999/yr** | Everything lifetime has, **plus** what is recurring: monthly curated drops, nudge scheduling, strict mode, leaderboard badges |
| **OCR add-on** (`ocr_vision`) | retired from sale | Folded into lifetime. **Must keep resolving forever** for anyone who bought it (§1.3). |

- `hasOcrAccess()` answers `ocr_vision` first, then either paid tier. `buyOcr()` is gone. Existing
  lifetime owners gained OCR free — deliberate goodwill.
- **Trajectory:** lifetime rises to ₹4,999 once sales justify it. Not scheduled.
- **Monthly book drops are the only thing separating the two paid tiers.** Lifetime buys the product
  as it stands, not a perpetual content feed; without that line ₹2,999 dominates ₹999/yr outright.
- **The subscription is a price anchor for lifetime** (owner). Ordinary pricing, but it puts weight
  on §1.3: lifetime stays prominently offered and genuinely purchasable, cancellation stays one tap,
  store copy describes what a subscriber actually receives.
- **⚠️ Accepted gap:** until the drops ship the subscription carries **no recurring value** — a
  subscriber pays monthly for what ₹2,999 buys outright. Drives month-two cancellation.
  **Revisit when the drops ship.**

**Subscription value stack (closed — do not add scope without asking):** unlimited nudge apps ·
nudge scheduling · nudge strict mode · **monthly drops: ten curated books, of which the subscriber
claims one** (rotating, not cumulative; `books[]` is never pruned, so a month can be three new plus
seven carried, holding curation at ~3/month and ~36 §12.1 licence checks a year rather than 120) ·
leaderboard badges. **Design intent:** the free tier stays genuinely generous, and subscription
value must be *recurring* value, never a relabeling of static value.

**Explicitly rejected, do not build:** priority book-request fulfilment, early access to catalogue
additions, in-app advertising of any kind, Z-Library or any non-legal sourcing (§12.1).

**`FREE_APP_LIMIT` is 1.** `syncToNative()`'s truncation is not silent — it names the dropped app
once, keyed to the dropped packages so it cannot re-fire every launch (§1.5).

---

## 4. Reading Engines

Five engines on one word-array / `pageWordIndex[]` position system, interchangeable mid-read with no
position loss.

- **Page** — the word stream as swipeable paginated pages. **The default engine, listed first
  everywhere, and the fallback every engine lookup lands on.** §8.5 sends every nudged read here.
  Carries its own embedded bridge button. Display order is cosmetic; dispatch is by engine name.
- **RSVP** — one word at a time, fixed centre. `60000/wpm` per word; 1.8× pause on `.!?` and
  Devanagari danda `।`, 1.6× on `,;:`. ORP ~33%, amber `#b8995a`. No flash animation.
- **Chunk** — 2–7 words per flash (default 3). Delay = `(60000/wpm) × chunkSize`; scans the whole
  chunk for the strongest pause.
- **Focus Bold** — full page, first 40% of each word bold, highlight advances word-by-word. Do NOT
  call it "Bionic Reading" (trademarked).
- **Simple Scroll** — `transform: translateY()`, GPU-composited, 0.25×–4×.

### 4.1 Page-mode pagination (notes §5.1 — read before touching this)

1. **Measure in slabs, never per word.** ~3000 words into the measure leaf in one assignment, laid
   out once, read with `offsetTop`. Reading a geometry property after every DOM write is what made
   opening a book cost 16s, and it is easy to reintroduce.
2. **Only the slide window exists as DOM** — built on entering prev/current/next, released on an LRU
   of five. A page boundary is two integers; the spans are not.
3. **First paint must not depend on book length.** One slab is measured at the reader's position and
   painted while the full grid measures behind it. Until then page numbers are estimates and **say so
   with a tilde** (§1.5).
4. **Paragraph structure comes from the parsers, not the engine.** `rawLines[].paraStart` →
   `features/paragraphs.js` → a zero-height block plus a 1.5em indent on the first word —
   **indent, no blank line** (owner), like a printed book. The measurement and the visible leaves
   must keep building markup from the *same* `_wordsHtml`; built separately they can disagree about
   where a page ends.
5. **Chapter headings are styled from the detector's ranges, through that same `_wordsHtml`** — a
   word *range* in a block, sized in `em` so font-scale carries it, never indented, never its own
   palette (only depth 1 takes `--accent`). **A heading may never be stranded at the foot of a page**
   (`_pullBackOrphanHeading` moves it whole, only ever *backwards* and never past the start of the
   page being closed, which is what stops it looping), and **a range may open or close mid-slab**, so
   `_wordsHtml` reopens the wrapper on the far side.

The grid caches under `fr_page_layout_*` — **boundaries only, integers, never content** (§1.4) —
keyed by file + font + scale + viewport, LRU at ten. **Bump the stored version whenever anything
changes what occupies vertical space** (v2 = paragraphs, v3 = headings) or a stale grid describes a
layout that no longer exists. Page mode deliberately exposes no `hasCache()`.

### 4.2 Reaching the end marks a book read

**Completion is derived, not stored:** `isFileFullyRead()` asks `loadPosition(id) >= wordCount`, and
Mark read writes `wordCount`. So "finished" must be expressed *as a position*.

- **`_index` stays the honest word the reader is on** (the §6 bridge reads it). The end is a *floor*
  every save is lifted to in `_savePos`, never written into `_index`.
- **It must be the last page of the book, not of the grid** — gated on `_pagesExact`, or a long book
  is declared finished a few pages in (§4.1 rule 3). Re-checked once the grid becomes exact.
- **Turning away from the last page clears the floor**, so a book un-marks itself if the reader pages
  back — completion and position are the same number and cannot be made to disagree. Mark read
  remains for anyone who wants it to stick.
- **A fresh open never marks a book.** Cost, accepted: a book whose text fits on one page can only be
  completed with Mark read.

---

## 5. Parsing & Structure

The cleaning engine extracts text with positions, groups lines, strips
headers/footers/page-numbers/ISBN-DOI/bare URLs, converts tables/images/equations to tappable
placeholders, builds `pageWordIndex[]`.

**Paragraph structure must survive parsing** (notes §6.1). `rawLines[]` carries **`paraStart`**, and
every parser owes it: **TXT** the blank-line boundary (exact) · **DOCX** every line, since
`extractRawText` emits one paragraph per newline (exact) · **PDF** inferred from geometry — a line
indented past the body's left margin, or one following a line that stopped short of the right margin
(`finishLine()` keeps `x0`/`x1`). **Books imported before this cannot be re-parsed** (only PDFs keep
raw bytes), so `paragraphs.js` infers from stored line lengths: short of the wrap width *and* ending
a sentence ended the paragraph — 94.6% precision / 86.9% recall, carried by the sentence half (81%
without). A missed break merges two paragraphs, no worse than before.

**Chapter detection classifies paragraphs, not lines** (notes §6.2). `detectChapters` groups through
`ParagraphStructure`, so the index is built from the same boundaries Page mode renders. Four rules:
1. **A heading is a short, standalone paragraph** — not a line, not a fragment. Every rule passes
   that gate before any pattern is tried.
2. **Anchored rules may be long; guessed ones may not.** Heading word *plus* an ordinal: up to 250
   chars (18th-century titles are sentence-length). Inferred from capitalisation alone: 110.
3. **A sentence boundary needs two or more letters before the stop.** `Chapter I. The Twin-Verses`
   numbers itself. Testing the stop alone rejects nearly every numbered heading there is.
4. **Shape-based rules are dropped when numbered structure dominates** — but a book of tales or poems
   has nothing stronger and they are its whole index. Do not make either half unconditional.

**The detector has a second consumer:** Page mode styles headings from these ranges (§4.1 rule 5), so
a false positive puts a heading mid-paragraph, not merely a bad index entry.

**`\b` is ASCII-only in JavaScript** and never matches a Devanagari letter, so `/^(अध्याय|भाग)\b/` is
dead code — use a lookahead. Holds for every Devanagari regex here, and it is invisible until a
Hindi book is opened.

## 6. Bridge · 7. Wake Lock

**Bridge.** Speed→Normal: floating button, reverse-lookup, opens Normal view at the nearest page.
Normal→Speed: "▶ Read from here". Page mode carries its own embedded button.

**Wake lock.** Acquire on entering any reading view / on play. Release on exit, 5-min idle pause and
background. Never held outside reading views.

---

## 8. Nudge — the habit-interception system

> **The field findings behind every threshold and grace period here are in notes §9. Read them
> before changing any number.**

### 8.1 Philosophy (non-negotiable)
Not an app-blocker. A soft interception with an always-visible one-tap escape hatch. **Every nudge
screen contains, without exception, a clear one-tap "Continue to [App] anyway"** — always visible,
never behind a timer or a second tap. No guilt, shaming or anxiety copy.

### 8.2 Flow
1. The user picks target app(s) — free: 1, paid: unlimited.
2. `FlowReadNudgePlugin` watches for those apps opening **and for time accumulating inside one**.
3. The nudge does not fire on every open (§8.3).
4. On trigger: a calm screen with **Start reading** into Page mode and the escape hatch as
   deliberate peers.
   - **"Current book" is the most recently opened unfinished one**, never the furthest along. (The
     *reminder* in `notifications.js` correctly picks by highest percentage — a reminder asks which
     book is closest to done; a nudge intercepts a moment, and the moment belongs to whatever the
     reader actually has open.)
   - **The screen states which of the day's nudges this is**, and that the cap is a setting with a
     Reset — two quiet lines below the actions, never competing with the escape hatch. Blank rather
     than wrong if the figure cannot be read.
5. **Defaults, signed off 2026-09-20:** nudge after 15 min in the app (3rd open where usage access is
   denied) · unlock after 2 Page-mode pages · cap 3 nudges per app per day · back off for the rest of
   the day after 3 consecutive dismissals. All are settings; none hardcoded. The
   `fr_nudge_trigger_mode` "every open" option skips the threshold but **still honours the daily cap
   and the back-off**, without which it is the wall §8.1 forbids.
6. **Scoped unlock:** only the requested app opens, never the whole list. Other targets keep their
   own independent thresholds.
7. Skipping never fails or penalises the user. No guilt copy, no broken-streak framing.
8. **Reading pays the clock back.** Meeting the threshold restarts that app's sitting from zero,
   zeroes its open count, clears the dismissal streak, and **refunds one nudge against the daily
   cap** — without the refund the reset is hollow. The cap still holds between reads, so the only way
   past it is to have read. Leaving a nudged read early credits nothing.

### 8.3 Triggering
**The minutes threshold counts the current sitting, not the day** — delimited by the same
`SESSION_GAP_MS` heuristic that defines an "open" and **timed by the wall clock, never by a
usage-stats delta** (`getTotalTimeInForeground()` does not tick while you are in the app, so timing a
live sitting against it is timing it against a standing-still number).

**The two toggles are orthogonal:** `every_open` is about the moment of opening, the threshold about
the stretch. A threshold nudge therefore never fires at the moment an app opens — at that instant the
sitting is zero minutes old. The **"Nth open today" fallback is retained** for the ungranted case:
nothing can confirm presence when the user is not navigating, so a denied grant still needs a trigger
that fires on an open.

**All counters reset at local midnight with no scheduler** — the boundary is re-derived from
`Calendar` on every query and `loadState()` discards the day blob on a date-key change. Lazy rollover
is safe because nothing reads a counter before rewriting it. Two things survive it deliberately:
`suppressUntil` (absolute — an unlock granted at 23:50 must hold at 00:10) and `lastSeen` (a session
in progress at midnight is the same session). The read credit does **not**.

**Interception happens *during*, not after.** The threshold must be able to fire from inside a
session, by two mechanisms because neither covers the other: **navigation events** (a same-session
window change re-tests the threshold — free, they were already arriving) and **one pending timed
check** (a single feed produces no window changes, so the service keeps exactly one `Handler` message
pending, clamped 30s–10min, re-arming only while the app is still in front — **never a poll loop**,
§20). **The timed check requires usage access**, because `isForeground()` is the only proof the user
has not already left and a timer that nudges without it is an ambush.

**Three grace periods that are three different moments. They do not overlap, and changing one does
not change the others:**
- **A threshold-raised nudge takes a 5-minute breather when shown**, because its condition does not
  go away once crossed and a shorter one would spend the whole daily cap inside two minutes of
  scrolling. Set by the gate, spent whether or not the user answers.
- **`every_open` wins when both triggers are satisfied at once** and keeps its 2-minute grace.
  Applying the breather to an *open* would swallow the next open for five minutes, which is exactly
  what "every time I open it" promises not to do.
- **A skipped threshold nudge restarts the sitting** (`sessionStart` → now) and suppresses for the
  threshold itself, so the next is due after the interval the user chose, counted from the skip. A
  threshold's condition does not end when the nudge is dismissed, so any fixed suppression only
  defers the re-fire. **An open-raised nudge restarts nothing**; the opens fallback keeps the
  ordinary 10-minute dismissal grace.

**Which trigger raised the nudge — `inSession` in the handoff, not which toggles are enabled — is
what decides the grace and whether the skip counts toward the back-off.** The gate distinguishes
`overEveryOpen` from `overMinutes` correctly; use it. None of this dodges the gate: the dismissal
still counts toward the back-off and the nudge has already come off the cap.

### 8.4 Detection — `AccessibilityService` (signed off 2026-09-20)
`UsageStatsManager` alone cannot do this: nothing keeps the app alive to notice an app-open, and
polling needs a foreground service whose notification Android 8+ makes undismissable — ruled out by
the owner. Three binding constraints:

1. **Minimum possible scope.** `canRetrieveWindowContent="false"`, `typeWindowStateChanged` only, so
   the service is *structurally* incapable of reading screen content. `packageNames` is narrowed at
   runtime via `setServiceInfo()` to exactly the user's picks. **Do not widen either without a logged
   decision** — this is both the §1.4 guarantee and the Play Console API justification.
2. **`SYSTEM_ALERT_WINDOW` is required**, not optional: from Android 10 the background activity start
   that raises the nudge is dropped without it.
3. **`PACKAGE_USAGE_STATS` is optional and must stay so.** What it buys is **presence** —
   `isForeground()` — plus the day's total for display. It explicitly does **not** time the sitting.
   Denied, the threshold fires on navigation events and "Nth open" covers the moment of opening;
   Settings says which is which in plain language (§1.5).

**Scope note:** `isForeground()` reads the most recent resume from `queryEvents`, which can name an
app the user never selected. It is compared to the target and discarded — never stored, logged or
sent (§1.4) — and the accessibility filter is untouched. A use of a separately-granted permission,
not a widening of accessibility scope, but it *is* a widening of what usage access is used for.

**Never use `QUERY_ALL_PACKAGES`** — Play-policy-sensitive, needs a declaration form. A `<queries>`
element filtering `MAIN`/`LAUNCHER` gives the same list for free.

**A prominent disclosure must precede *every* route to the grant.** The guarantee lives at the choke
point — `openAccessibilitySettings()` guards itself — because call sites get added and forgotten. And
**"enabled by default" is not "set up"**: `fr_nudge_enabled` is absent on a fresh install and reads
as on, so UI gating on it alone exposes permission controls to a user told nothing.

**Declared to Play as: App functionality only, no sensitive data collected, `isAccessibilityTool`
unset.** That last is the honest answer; claiming otherwise is a fast rejection. "No sensitive data"
rests on §8.6's allowlist keeping target package names out of analytics — **an event that ever
carried one would make the filed declaration false.** No iOS implementation planned.

### 8.5 Reading mode on nudge-entry
**Page mode** — `forceEngine: 'page'` for that read only, never writing `fr_last_engine`. Resumes the
in-progress book, or opens Free Books if none, avoiding the empty-import drop-off.

**Unlock progress is engine-agnostic** — the threshold is in pages but counted through
`savePosition()`, the seam every engine goes through, at ~220 words/page. Page mode keeps its exact
count. Counting only Page-mode turns left readers in other engines waiting for an unlock that could
never arrive (§1.5).

**Progress is counted as movement, never as distance from an anchor** (notes §9.5 — three ways of
miscounting a page were found in use):
- **One page forward is one page.** `onPageTurn` takes the page turned *from* as well as to. A
  backward turn earns nothing and is not a penalty — the ground can be re-earned by reading forward.
  A multi-page jump earns nothing; it is navigation.
- **A jump is refused by both counters.** **Page mode is excluded from `onReadProgress` entirely**,
  or "last page" in the nav bar clears any gate in one tap. Elsewhere a step over ~100 words is a
  seek, chapter tap or bridge jump and earns nothing — the widest legitimate step is the ±50 buttons.
  The position always stands; only the credit is refused.
- **Counting turns needs no anchor**, which matters because §4.1 rule 3 renumbers pages under a live
  read: an anchor taken early stops meaning the same thing later.

### 8.6 Anonymous event pings
`analytics-ping.js` — `logEvent(name, meta)`, fire-and-forget to the Worker in `worker/`. **Never a
user/device identifier, file name, or reading content.**

Allowlist: `app_opened` · `nudge_shown` · `nudge_read_started` · `nudge_read_completed` ·
`nudge_skipped` · `free_book_downloaded` · `pro_purchased` · `subscription_started` ·
`subscription_cancelled` · `stats_shared` (entry point only — `home`/`dashboard`/`milestone`, never
the book, stat or destination app) · `read_session_ended` · `book_finished` · `book_opened` ·
`paywall_shown` · `import_completed` · `onboarding_completed` · `nudge_permission_granted`.

**Adding an event is a product decision, not an implementation detail** — the allowlist exists so a
future caller cannot quietly widen collection; ask first. **It is enforced a second time in the
Worker**, because a closed list that only exists on the client is not closed. The two copies and the
published privacy policy's event list must change together, or the policy becomes false.

**Three load-bearing properties of the receiver** (stated atop `worker/src/index.js`):
1. **The request IP is never read, stored or logged.** Cloudflare offers it, the country and the ASN
   for free; taking any turns an anonymous count into personal data with nothing in the client to
   connect the change to the policy. Worker request logs carry the IP in their own metadata, so
   observability is **off** in `wrangler.toml` — on only for a deliberate debug session.
2. **Nothing is stored per event.** A row is a counter for a (day, event, dimensions) tuple, so the
   database physically cannot hold one person's sequence of actions. The property does not depend on
   anyone remembering not to run the wrong query later.
3. **No dimension may carry a package name**, which is what keeps §8.4's filed declaration true.

**`book_finished` is fired from `savePosition()`, gated once per book** — §4.2 makes completion
derived, so paging back un-finishes a book and an ungated event would drift upward with nobody
reading. The gate is deliberately sticky across Mark unread and re-reads: the question is how many
books were *ever* finished. It is **not** fired from `checkMilestones()`, which runs only on home,
bails on an open modal and returns after the first new book — a prompt mechanism, not a counter.
`source` separates `read` from `marked`.

Two meta keys get a per-*person* figure without storing anything identifying: **`tenure`** on
`app_opened` (days since first launch, bucketed `0`/`1`/`2-3`/`4-7`/`8-30`/`31+` — a retention curve
while no row is linkable to another; **a persistent install id is refused**, it is the identifier this
section rules out and would flip the Play declaration) and **`first`** (true on a device's first ever
event of that name, from a `firstTag` resolved *after* the opt-out gate so a flag is never spent on an
unsent ping; a reinstall counts as a new person, accepted).

---

## 9. Onboarding

**Requirements.** Lead with the habit pitch, not speed reading — the engines may still be introduced,
de-emphasised. **Explain the nudge concept in plain language before any permission ask** (poor framing
tanks grant rates and trust). **End with the user reading or one tap from it** — the library, never an
empty import screen. **Fully localised in Hindi from day one** (§16). **Retain the
honest-limitations screen** (§1.5), repositioned rather than removed.

**The permission ask is inline** (owner) — the higher-conversion, higher-friction option, because the
nudge *is* the pivot and a user who never sets it up has a plain reader. Three things carry it:
- **The ask comes after the user has named an app**, never before, so the screen can say "FlowRead
  needs to notice when you open Instagram" — and the service does nothing without a target anyway.
- **Every route past it is skippable without dead-ending.** The forward button reads *Not now* until
  the grants are in; backing out of the disclosure or settings returns to the same screen.
- **Usage access is offered, never required** (§8.4) — an explicitly optional third row that must
  never gate the forward button, shown only when a trigger that uses it is on.

**Onboarding does not restate the prominent disclosure** — it calls `openAccessibilitySettings()`,
which carries the guarantee at the choke point. One copy of that text in one place is the point.

**The home setup card is kept, not absorbed.** `shouldPromptSetup()` is false once any app is chosen,
so it reaches only someone who skipped the step — the inline ask buys grant rate at the cost of a
harder refusal, and without the card a user who declined would never be offered the pivot again.

**The intro screen asks what kind of reader you are**, below the language choice. `nudge.js`'s
`PROFILES` turns the answer into §8.2's thresholds — asking about thresholds directly asks someone to
decide what they have no basis for yet:

| Profile | Nudge after | Unlock after |
|---|---|---|
| Here and there (`light`) | 20 min | 2 pages |
| Most days (`medium`) | 15 min | 4 pages |
| Every day (`heavy`) | 10 min | 7 pages |

- **The options are frequencies, not commitments**, and none implies a correct top rung.
- **Below the language row, never above** — the language buttons label themselves and can be read
  before a language is chosen; this question cannot.
- **`dailyCap` and `backoffDismissals` do not vary, and the trigger mode is not set from it** — those
  are §1.6 guardrails rather than taste.
- **It writes the same keys the Settings sliders read**, inside their existing ranges: a starting
  point, not a mode. Skipping it leaves §8.2's signed-off defaults, which must keep standing alone.
- Stored as **`fr_reader_profile`**, deliberately not nudge-scoped: reading plans (Task 16.18) use the
  same light/medium/hard taxonomy and should seed from one answer. It is a *self-description*;
  hand-tuning a slider afterwards does not make it wrong.

**The nudge screen offers both triggers as peers**, either or both, once an app is named. Without this
every new user was left on threshold-only, which misses the reflexive opener entirely — someone who
opens an app twenty times a day for half a minute never accumulates the threshold in one sitting, and
would conclude the feature does not work. Added *alongside* the threshold, since §8.3 makes the two
orthogonal. Settings' "with both on" note is **not** repeated here: on a first run it reads as a
correction to a choice just made.

---

## 10. Notifications · 11. Widget · 12. Free Books · 13. Leaderboard

**Notifications** (`notifications.js`): daily reminder `1001`, streak nudge `1002`, and the
offline-triggered type `1003` built on `@capacitor/network`. Copy stays light, not preachy (§1.6).
**Must not spam:** throttle to once per few hours, suppress when the daily reading threshold is
already met (reuse the daily reminder's suppression), never fire with the app in the foreground.

**Widget — not built, Android only.** Shows the most recent in-progress book, title and simple
progress. Tapping deep-links **into that book at its last position in the user's preferred engine**,
not to the home screen — needs an intent-extra so `app.js` can route on cold start. The widget process
runs outside the WebView and cannot read app state: `widget-bridge.js` pushes the book's data to
native storage on every position save — **event-driven, never polled** (§20). Open decision (Q7):
classic `AppWidgetProvider`/`RemoteViews` vs Jetpack Glance — default classic for consistency with the
existing Java plugin style and no new Compose dependency, but worth a quick evaluation first.

**Free Books.** 150 curated books in `www/data/free-books.json`, region-aware sorting, language tabs,
category filters, auto-OCR, full i18n. **Entries must be `pdf` or `txt`** — `free-books.js` branches
on exactly those two, and an `html` entry would hit the PDF parser and fail.

### 12.1 Legal sourcing — what may enter the catalogue
**Two source types, nothing else:** (1) **public domain**, verified by the *edition's* status, not the
work's age — a 1890 text in a 2015 translation is a 2015 copyright, so check the author's death date
against the term in the country of publication *and* the specific edition linked; (2) **a licence that
permits redistribution** — CC-BY, CC-BY-SA, or an explicit written grant. A no-derivatives licence is
fine; the app redistributes the text unchanged.

**"Free to read" is not "free to re-host."** A publisher putting a PDF on their own site grants no
redistribution right whatsoever. The absence of a paywall is not a licence.

**Linking and hosting are different legal positions.** The 23 off-site entries (`castefreeindia.com`,
`mkgandhi.org`, `tipitaka.org`, `archive.org`) are references to someone else's server — FlowRead is
not the distributor. Serving the same file from a domain this project controls makes it the publisher.
Both are acceptable; **they are not interchangeable**, and moving a book between them is a legal
change, not a hosting change.

**Non-negotiable regardless of convenience:** Z-Library, Library Genesis, Anna's Archive and any
equivalent shadow library. Not as a source, not a mirror, not a fallback, not "just for the ones we
cannot find elsewhere."

**Per-book provenance is deliberately not recorded** (owner). Consequence, accepted knowingly: a
future challenge must be answered by re-deriving why that edition was clear. The mitigation is that
this allowlist is narrow enough that a book outside it should never have been added.

**Monthly drops are bound by this exactly as the bundled catalogue is** — a drop is new content on
infrastructure this project controls, so the question is not "may I read this" but "may I serve
this," every time.

**Leaderboard — planned, not built.** **Opt-in only, never default-shown.** Monthly reset, no
permanent ranking. Free users may view and opt in; badges are subscriber-exclusive. Badges tie to the
monthly drops — start with 1–2 types, expand only if data supports it. **Rejected:** default-visible
leaderboards, permanent rankings, competitive-pressure framing, and a mascot/persona-leveling layer
(tonally wrong against a catalogue holding Ambedkar and Phule) — if gamified identity is revisited,
tie it to *what a user reads*. **Needs a backend beyond §8.6's anonymous counters** (Q5: reuse the
Worker with a new endpoint, or something more structured?).

---

## 14. Share Stats Card

Generated entirely on-device (Canvas), 1080×1080, §15 palette only, app branding on the image —
tasteful and small, never a loud ad. Shared via `Capacitor.Share`. **Free for everyone, not
Pro-gated** — it is prioritised for *distribution* (§21), and the dashboard it nominally lives on is
Pro. **The card fetches nothing** (§1.1). Full layout reasoning in notes §15.

**Entry points, both required:** a visible Share button in the **home header** and on the dashboard;
plus milestone prompts at natural completion moments (book completion, 7/30/100-day streaks), kept
sparse. **A milestone is marked celebrated when the offer is *made*, not accepted** — re-offering
because the user declined is the nagging §8.1 rules out.

**A completion prompt may interrupt only where the engine can prove the reading is done.** RSVP,
Chunk, Scroll and Focus Bold ask at `_handleEnd()` — playback ran past the last word, the engine is
idle, nothing is left to interrupt. **Page mode offers instead of asking**, with a tappable line at
the foot of the final page (owner): arriving on the last page is not reading it. The §4.2 marking is
unchanged; only the offer waits for a deliberate tap, and **it is positioned absolutely over the
stage, never in the flow** — anything occupying vertical space changes what fits on a page (§4.1).
**Streak milestones stay on home**, which also remains the backstop for a book marked read from the
library or finished in a session the engine did not end.

**Content:**
- **Hero-metric framing, not a data dump** — one strong stat, at most three supporting lines. Hero
  priority: a finished book, then the streak, then total words. A named book is the most shareable and
  most on-brand thing on the card; a bare streak could be any habit app.
- **One hero per distinct book count, and the survivor is the narrowest window** — four books in the
  last 7 days says more than four books ever. The all-time hero is the fallback for when no window
  qualifies or counts genuinely differ, never the preferred phrasing.
- **Any multi-book hero carries its books as `hero.bookList`**, normalised — `_coversFor` and
  `_coverPool` must not have to know which kind of hero they were handed.
- **Covers scale with the count:** one gets the cover panel · two or three a **fan** (overlapped in
  the same column, back to front, most recent on top) · four or more a **collage** (headline above a
  single row of four tiles, supporting lines dropped). **One row of four, not two of three** — the
  band is 616px and a cover is 1.375× as tall as wide, so two rows only fit at ~132px tiles where
  nobody can tell which books they are; `_collageFootprint` clamps to height as well as width. **A
  fifth book is not drawn** — the headline states the real number, so the grid is a sampler. **In a
  grid the frame is the tile with artwork centred inside**, the opposite of `_drawCover`'s
  contain-and-shrink; mixing them made every tile a different width.
- **A multi-book card prefers books with real artwork and drops the rest** (owner) — asked for as an
  option, built as a rule, because nobody would ever switch it *on*. Two or more real covers give a
  fan or collage, exactly one gives the single-cover layout, none gives a clean text card. **A
  single-book hero is untouched:** initials work as *that book's* identity and fail as a grid.
- **Only a self-imported DOCX or TXT has no cover.** All 150 catalogue entries carry a `coverImage`
  and `BookCover.cacheRemote()` stores it at download time; a self-imported PDF has its page one. Do
  not reason from the old "two thirds of the catalogue is TXT with no page one" — false now.
- A catalogue cover takes precedence over page one, but **an already-cached page one is never
  replaced** — that is the real edition. The cache is self-validating: unless the bytes decode nothing
  is written, so an old WebView falls back to the typographic cover rather than showing a gap.
  Everything else gets a typographic cover from the title's initials and author, in §15 colours only,
  never the catalogue's placeholder palette.
- Covers are the same third-party artwork the library already displays, cached on the user's own
  device — §12.1 holds, this is not re-hosting. If a licence is challenged, drop that `coverImage`.
- Titles go through `displayTitle()`, which strips the extension everywhere. The stored name stays a
  filename because de-duplication keys on it, but "Finished जाति का विनाश.pdf" must never leave the
  device.
- **The share text carries the Play link**, appended in code rather than embedded in the string so no
  translation can drop or mistype it. §14's "tasteful, not a loud ad" governs the *image*; a card
  reaching a non-user with nowhere to go stops the mechanic one step short of what §21 wants it for.
- **Design with a future "time reclaimed" stat in mind** — supporting lines are a flat ordered array
  in `_extraOptions()`, so adding it is one entry. `NudgeGate` already holds the counters.
- **The covers of one card resolve in parallel against one deadline.** `_coverOf` takes an absolute
  timestamp, not a duration — four four-second races in sequence is a share button that hangs for
  sixteen. Whatever has arrived when the budget expires is drawn.

**Recap windows — offered, never prompted** (owner). Three exist: last 7 days, last 30 days, **this
year** (not "last year", empty for every current user). **At most two offered at once, deduped on the
figures rather than the sentence.** **A window is offered only when it holds substance:** a finished
book, 3+ days read, or an hour of reading. Nothing goes looking for the user — a recap arriving
unbidden in a week they read nothing has no honest phrasing that is not guilt framing. Deliberately
*not* hung on the milestone mechanism, which is celebrate-once with spent flags where a recap is
always available. Those three numbers are the lever if it needs tightening.

**The sheet opens composed, not as a form** (owner) — editable behind one "Change what's on it" tap,
book heroes capped at 2. **The toggle has two states and is never removed**: it first shipped deleting
itself on open, which left no way back, and on a phone an open editor pushes the preview off screen.
**In collage mode the second editor section is the cover picker, not the stat toggles** — `drawCard`
drops the supporting lines there, so offering those toggles was the silent failure §1.5 forbids. At
capacity a fifth tick drops the longest-standing choice rather than being ignored, so the trade is
visible.

**A successful share emits `stats_shared`** with the entry point and nothing else (§8.6).

---

## 15. UI Design System

```css
:root {
  --bg: #0d0d0d;  --surface: #141414;  --surface-2: #1c1c1c;  --border: #2a2a2a;
  --accent: #e8c547;  --accent-2: #c47a3a;
  --text: #e8e4dc;  --text-muted: #6b6660;  --text-dim: #3a3632;
  --rsvp-stage-bg: #161410;  --page-stage-bg: #161812;  --rsvp-orp: #b8995a;
  --success: #5a9a6a;  --error: #c45a3a;
}
```

No pure black/white anywhere text appears. Radius 2–4px (max 6px), no pill buttons. Animations
0.12–0.2s hover, 0.3s view transitions, no bounce, no RSVP flash. Fonts per §2. **Every new surface
follows this exactly** — no new palette, no new typography scale. The nudge screen especially must
feel calm, not alarming: jarring visuals work against §8.1.

## 16. i18n (permanent)

Every UI string uses `t('key')` — never hardcoded English. Add keys to `en.json` and `hi.json`
**together**; the owner supplies Hindi. **`i18n.js` has no English fallback**, so a missing key
renders the raw key to a Hindi user. Dynamic strings use `{placeholder}`. Kept in English/Roman
regardless of language: WPM, PDF, DOCX, TXT, OCR, RSVP, and all engine names (RSVP, Chunk, Focus
Bold, Scroll, Page).

---

## 17. What Already Exists

Phases 0–15 are shipped; the code is the authority on details. In brief: PDF/DOCX/TXT/URL import, the
five engines, cleaning engine, bidirectional bridge, chapter detection, auto-resume, wake lock ·
Android device file sync (MediaStore, after a Play rejection over `MANAGE_EXTERNAL_STORAGE`),
share-sheet URL intent, error boundaries · on-device OCR (ML Kit, Latin + Devanagari), 82k-word
offline dictionary, Pro dashboard, "Open with PDF", Paste Text, camera/gallery import · store-launch
polish, real Play Billing, legacy Indic font detection, danda pause, hardware back handling · Hindi
i18n (~240 keys), settings restructure, extra fonts, word-tap setting, notifications v1, Page mode,
Free Books.

**Still open from Phase 14:** `MANAGE_EXTERNAL_STORAGE` re-application, background-OCR foreground
service, SAF folder-picker fallback.

**Phase 15's India CSL copy is superseded** — written under the speed-reading identity. The library,
Hindi localisation and CSL plan all remain relevant; the *copy* must lead with the habit angle. Do not
treat old CSL drafts as final.

**Two notes that outlived their tasks:**
- **H4's real defect was the error taxonomy**, not the symptom: every non-OK `BillingResponseCode`
  collapsed into one string, so a customer who *owned* Pro was told their purchase failed. The
  subscription work is built on the taxonomy that replaced it — keep it.
- **H3's original diagnosis was wrong.** Capacitor 8's LocalNotifications degrades exact → inexact on
  its own, so `SCHEDULE_EXACT_ALARM` was *removed* rather than requested. **Don't re-add it.**

---

## 18. Phase 16 — Reading Habit Pivot

**This table is the authoritative list of *what* Phase 16 contains. `Tasks.md` tracks *where each item
stands***; completed detail is in `Tasks-archive.md`.

| Task | What it is | § |
|---|---|---|
| 16.0a/b | API 36 bump + toolchain; Billing 7.1.1 → 9.1.0 | 2.1 |
| 16.1 | Subscription IAP (`flowread_plus`) + repriced lifetime | 3 |
| 16.2 | Habit interception — the pivot mechanic | 8 |
| 16.3 | Onboarding redesign onto the habit pitch | 9 |
| 16.4 | Monthly curated book drops | 3, 12 |
| 16.5 | Opt-in leaderboard & badges | 13 |
| 16.6 | Share stats card | 14 |
| 16.7 | Offline-triggered reading notification | 10 |
| 16.8 | Home screen widget | 11 |
| 16.9 | Home screen reorder (in-progress first) | — |
| 16.10 | Store listing rewrite onto the habit framing | 0 |
| 16.12–16.17 | Page-mode pagination rewrite · paragraph structure + Page as default · chapter detection · styled headings · catalogue covers on the card · last-page completion | 4.1, 5, 14 |
| 16.18–16.20 | Reading plans (daily page target) · streak freeze · reclaim a lost streak | 3 |
| 16.21–16.22 | Nudge opened the wrong book + three miscounted pages · reading stats | 8.2, 8.5, 19 |
| 16.23–16.28 | Reader profile + peer triggers in onboarding · discovery tips · paywall placement · debug free-tier flag · unlock celebration · share moments | 9, 22–25, 14 |
| 16.29 | Highlights — the investment phase | 26.3 |
| 16.30 | Engine order — Page first | 4 |
| 16.31 | Saved words + dictionary morphology; the dead `HighlightEngine` removed | 26.1, 26.2 |

**Open items needing product-owner input:**
- **Streak freeze — when is it granted, and is it a subscription perk?** (16.19.) §3's value stack is
  closed, so adding it there is a decision. Either way **a freeze is never purchasable on its own**:
  sold in the moment of losing a streak it is a pressure sale against an anxiety the app created
  (§1.3).
- **Reading-plan page targets** — 2 / 10 / 20 is the owner's sketch, not signed off (16.18).
- Leaderboard backend (Q5) · widget classic vs Glance (Q7) · exact copy for the offline notification.
- **Hindi copy sign-off** for the 16.1 and 16.3 strings — drafted rather than left as key names, since
  §16 means a missing key renders raw.

---

## 19. Reading Stats — what a session records

One recorder, `_flushSessionIfActive()` in `views/reader.js`, writing
`{ date, wordsRead, durationMs, wpm, fileId }`. Built around RSVP's play/pause, and all three numbers
were wrong once Page mode became the default, because Page mode has no pause.

1. **Words read is the furthest point reached, not where they stopped.** End-minus-start meant paging
   back subtracted what had been read, and a backward jump past the opening position clamped to zero
   and fell under the 10-word floor — discarding the session outright, including **the streak day**.
   Tracked from `_syncReaderPosition`, the seam every engine calls.
2. **Duration is time spent moving through the book** — per gap between position changes, each capped
   at 3 minutes, not wall clock from open to close. A phone put down otherwise banked the absence.
3. **WPM is measured** (`wordsRead / durationMs`), never stamped from the slider — the dashboard was
   averaging a *slider position*, and in Page mode the bar is hidden. An impossible implied rate
   stores `0`, which `last7DaysAvgWpm` filters, so a forward jump cannot own the average.

**Duration and WPM must keep using the same figure**, or `wpm × time ≠ words`. **Sessions recorded
before this hold slider values**, so the 7-day average is a blend until they age out. **A forward seek
still credits the distance as words read** — pre-existing; the *rate* is dropped but the count is not.

---

## 20. Code Rules

**Architecture.** Vanilla JS only. No frameworks, no build step. No runtime dependencies beyond
pdf.js, mammoth.js and the §2 Capacitor plugins. No npm utility packages. No CSS frameworks.

**Storage.** Never localStorage for purchase/subscription state — always Capacitor Preferences.
localStorage is fine for position, WPM, theme, UI state, nudge target list, nudge thresholds. All keys
prefixed `fr_`.

**Performance.** No layout thrashing during playback; the word stage must repaint at 600+ WPM. Lazy
PDF canvas pages. `requestAnimationFrame` for scroll/page animation. Build spans once, manipulate
classes during playback. **Nudge detection must be battery-conscious** — no tight polling, no wake
locks outside reading views. **Widget updates are event-driven**, pushed on position-save.

**UX.** Reading position is sacred — every navigation calls `savePosition()`. Never more than one
modal at a time. Always show a loading state over 200ms. Never show raw exception text. **Nudge
screens always show the escape hatch (§8.1)** — a product/legal rule, not a style preference; no
future task overrides it without an explicit logged owner decision.

**Style.** Functions are verbs, state are nouns, files single-purpose. Comments explain *why*.

**Stop and ask before:** uploading any release build (run §24's check) · any new dependency ·
changing palette or typography · adding a file format · changing pricing · adding a feature not
listed here · extending §8.6's event allowlist · sourcing book content from outside §12.1 · widening
the §8.4 accessibility scope.

---

## 21. Project Status

**Day-to-day tracking is in `Tasks.md`. Verify anything here against Play Console before assuming it
is current.**

- **The pivot is released.** 1.5.4 / versionCode 42 went to production 2026-11-02 at a **20% staged
  rollout**, clearing builds 33–42. Privacy policy rewritten, version-controlled as
  `privacy_policy.html`, published. **Check whether the rollout has advanced past 20%.**
- **Latest build: 1.5.6 / 44** (2026-11-17). **The first build in which §8.6's pings actually send**
  (`ENDPOINT` is filled). **Two compliance items are owed before promotion:** re-file Play Data safety
  as *Optional* (the standing filing says required, untrue since the opt-out shipped), and re-publish
  the amended `privacy_policy.html` to its hosted URL — committing the file does not publish it, and
  the live event list is now incomplete.
- **1.5.5 / 43** carried the Page-mode rewrite, paragraph structure with **Page as the default
  engine**, chapter detection, styled headings, catalogue covers, last-page completion, and the
  catalogue's growth to 150 books. **This is the build to watch, because Page mode stopped being
  optional** — and two of those changes touch state that outlives a session: the layout grid went
  v2 → v3 (every book re-measures once), and `_savePos` decides whether a book counts as **read**, so
  a defect there moves books into the library's Read section and fires §14's completion milestone.
  **Device-verify both before advancing the rollout.**
- **Unreleased on top of 44:** tasks 16.21–16.30 (branches `nudge-book-selection-fix`,
  `reader-type-preset`, `feature-discovery-tips`, `paywall-placements`). A device run should look
  directly at the nudge gate's page counting (a backward swipe used to unlock the app outright) and
  the session recorder (a backward jump used to discard a streak day), plus the onboarding Hindi on a
  narrow screen.
- **Still owed on the listing:** 8 screenshots and the 1024×500 feature graphic (16.10). Never a
  release gate, and they can only honestly be captured from the build being shipped.
- **Immediate priority:** device-verify 1.5.5/43, then **16.4 Phase C → D** (remote catalogue, then
  the drops), which closes §3's stated gap. **16.8 (widget) is deferred by the owner** until there is
  traction; **16.5 (leaderboard)** needs Q5 and a backend.
- **Platforms:** Android first. iOS store setup not started; no iOS path planned for the nudge system
  or the widget.
- **Distribution context (for product decisions):** the bottleneck is **distribution**, not retention
  or monetisation. That is why the share card is prioritised partly for reach, and why Phase 16
  favours mechanics with plausible organic spread.

---

## 22. Feature Discovery — Rotating Tips

A user can read for weeks without learning that their own PDFs work, that long-pressing a word looks
it up, or that a PDF can be read against its original pages. None of those earns a permanent place in
the UI, and nobody opens a help screen. `features/tips.js` owns the pool, the cursor and the
bookkeeping. Two surfaces: the **nudge unlock modal** (after every completed nudge-read, inert text)
and the **home strip** (one a day, tappable when the tip has a destination).

1. **Nothing goes on the nudge screen itself.** That screen has two deliberate peers — Start reading
   and the escape hatch §8.1 and §20 make a product rule. A third thing to tap makes the escape hatch
   one of three, which is how a nudge starts reading as a wall. **The unlock modal is the nudge path's
   slot:** the threshold is met, nothing is withheld or interrupted, the user has just succeeded, and
   it needs no throttle because a completed nudge-read is rare and earned. Weighed and rejected, not
   overlooked; re-adding needs a logged decision.
2. **Relevance is a gate, and it is not a cap.** `when()` asks whether *this user* has any use for the
   tip. Separately **every tip is spent after three shows**, acted on or not, because a tip that keeps
   arriving after being understood and declined is the nagging §1.6 rules out. Capability tips also
   retire the first time the user does the thing — `TipsFeature.markDone()`, called from the feature
   itself (`dictionary.js`, `bridge.js`, `share-handler.js`), never from the strip.
3. **Tappable only where nothing else is pending.** On the strip a tap does the thing the sentence
   describes. In the unlock modal it is inert: that modal exists for the choice between the book and
   the app just earned, and navigating off it would discard what they read for.
4. **A tip is never truncated** (owner) — not on the strip, not in the modal. A Hindi tip is routinely
   longer than its English twin, and a slot whose whole job is to explain something cannot clip the
   explanation. Both wrap to as many lines as needed.
5. **A tip must never teach a locked feature.** DOCX/TXT import and Scan are Pro, so the import tip
   names PDF and the scan tip is gated on Pro; the `url` tip is gated the same way. A tip for
   something the user cannot do is an advert, and §3 rules those out. (The `url` tip covers the least
   discoverable thing the app does — **that FlowRead appears in the browser's own share sheet** — so
   its `go` focuses the URL card, since no in-app tap can open another app's share menu.)
6. **Rotation is round-robin from a stored cursor, not random.** Random is right for the nudge's six
   interchangeable subtitles and wrong for a dozen distinct tips: it repeats one three times before
   another is seen. One tip per calendar day, the same one all day — picking per render reshuffles it
   every time the user backs out of a reader, which reads as a glitch and spends the cap in an
   afternoon.

**No analytics event** — `tip_shown` is not in §8.6's allowlist and was deliberately not added;
retirement-on-action already shows up in `import_completed` and `book_opened`.

**The dictionary is free in code, as §3 has always said.** `showDictionaryModal()` gated the lookup on
`AppState.isPro` and sent every free user to a paywall — a contradiction that shipped unnoticed
because nothing advertised the feature to the users it was withheld from. **The gate was the bug, not
the table.**

---

## 23. Paywall Placement

One modal — `showPaywall()` in `features/purchase.js` — lifetime row first and preselected (§1.3).
`showOcrPaywall()` is an alias, since §3 folded OCR into lifetime. Every call site passes a `source`,
carried by `paywall_shown`, so placements are rankable rather than argued about.

**The stance (owner):** show what Pro adds without apology, but never unnecessarily and never
repeatedly. **The test is whether the user is, at that moment, looking at the thing they would be
buying.** If they are, naming the price is service. If not, it is an advert, and §3 rules those out.

Sources: `url-reader` · `docx-import` · `txt-import` · `image-scan` · `scanned-pdf` · `share` ·
`nudge-apps` · `font` · `theme` · `device-sync` · `dashboard` · `settings`. `source` is free-text in
both client and Worker, so a new placement needs no allowlist change — but it must stay a *feature*
name, and §8.6's third receiver rule holds: **no dimension may ever carry a package name.**

**Settings → Unlock FlowRead is the only non-reactive placement.** Every other fires because the user
hit a wall; without it there is no way to *decide* to pay, and §1.3 requires lifetime stay
"prominently offered and genuinely purchasable". Shown only to a non-purchaser, on a screen they
navigated to themselves. **Not on home, not a banner, nothing that follows them.** **It is one button
— "Unlock the full power of FlowRead" — and nothing else** (owner): **a purchase entry point names
itself and gets out of the way. The pitch belongs in the paywall, once.**

**Two rules that produced the rest of this work:**
1. **A locked control must do something when tapped.** A `disabled` lock icon is a silent failure
   (§1.5) *and* the best-timed paywall in the app discarded — the user has just pointed at exactly
   what they would buy. **Any future Pro gate inherits this:** mark it, let it be tapped, say what it
   costs.
2. **A gated screen should show itself before it asks.** The dashboard opens for real with the user's
   **own** top-line figures and one card naming what Pro adds. **Nothing may be fabricated** — the KPI
   tiles are the real ones and the withheld parts are *named* rather than blurred. `paywall_shown`
   fires when the user taps the card's button, not on arriving, so the event keeps meaning "was
   offered a price".

**Where a paywall must not go:**
- **The nudge screen and the unlock modal** (§8.1, §22). A sales pitch at an interception is the dark
  pattern §1.3 forbids, and the escape hatch may never share a screen with a price. §22's tip slot is
  not a loophole: a tip names a feature, never a price.
- **Book completion and streak milestones** — the emotional peak, and §14 already owns it with the
  share prompt, the distribution play in a distribution-bound product. Do not trade a share for a
  paywall impression.
- **The Free Books library** — §3 gives the whole catalogue away, and the drops are unbuilt.
- **Reading itself** — engines, Page mode, the bridge, the dictionary, own-PDF import. Free by §3, and
  not to be gated later.

**Sequencing:** new placements come from `paywall_shown` data, not guesses. One caution that is not
optional: §3 records that the **subscription carries no recurring value** until the drops ship, so
every new surface sells that harder. New copy leads with the one-time purchase, as the modal does.

---

## 24. The Debug Flag — and the release check it needs

**Settings → Debug → "Simulate the free tier"** makes every entitlement gate answer *free*, so §23's
free-tier surfaces can be checked on a device whose account owns `pro_lifetime` — without it they
cannot be, since `refreshEntitlements()` queries Play every launch and a one-time purchase is owned
forever.

**Second action in the same section: "Reset share prompts"** (added 2026-11-20), which forgets
which books and streaks have been celebrated. §14 makes a completion prompt one-shot — an offer is
spent when it is *shown*, and first-run seeding marks every already-finished book as history rather
than news — so finishing one book across five engines spends the offer on whichever engine reached
the end first, and a book finished before the build was installed never offers at all. Both are
correct in production and make the feature impossible to re-check on a device, which is this
section's whole reason to exist. Two details that are not optional: **`fr_share_seeded` is left
set**, because clearing it makes the next home render re-seed everything straight back in; and the
reset arms a **one-render skip** of `checkMilestones()`, because home is §14's backstop and the walk
from Settings to a book goes through it, which would otherwise spend the offer before the reader
could raise it. It clears only this bookkeeping — no position, no library, no session — so the worst
it can do is re-offer a share.

**Before building any release: confirm the Debug section is absent from Settings.** If it is visible
that build is debuggable and must not be uploaded — for reasons unrelated to this flag.

**That check is the backstop, not the mechanism**, because a release checklist is the weakest
guarantee available and this project has already been burned by one (§2.1). The flag is
*structurally* unshippable: **the row cannot render in a release build** (`window.Capacitor.DEBUG` is
injected from `FLAG_DEBUGGABLE` before `index.html` loads, and `minifyEnabled true` means a release
build is not debuggable; `isDebugBuild()` reads it, the section is gated on it, and
`setDebugForcedFree()` refuses to write without it) · **the flag is inert in release even if the key
is set** (`debugForcedFree()` checks the build before the key) · and Play refuses an upload marked
`android:debuggable="true"` regardless.

**Two properties that must not be weakened:**
- **It can only withhold, never grant.** Every gate returns `false` under the flag; nothing reads it
  to turn anything *on*. Worst case if it escaped is a paying user whose features are hidden —
  visible and instantly reversible. **A "simulate Pro" toggle would be an unlock vector and must not
  be added**; a developer's own purchase supplies that half of the matrix.
- **The key lives in `localStorage`, not Preferences.** §20 forbids localStorage for *purchase state*;
  this is a dev-only lens that cannot carry an entitlement, and in Preferences it would survive an
  app-data clear. **Do not "correct" it.**

`hasOcrAccess()` checks the flag before the `ocr_vision` purchase, or a legacy owner would keep OCR
while simulating free. `refreshEntitlements()` still writes the real entitlements (they are true — the
flag is a lens, not a revocation) and resets the in-memory flags afterwards, since `hasProAccess()`
short-circuits before `hasSubscription()`.

**A debug build is not a release rehearsal.** R8 is off (`minifyEnabled` applies to `release` only),
so anything verified this way still needs a pass on a release build. Debug and release share
`applicationId com.flowread.app` with different keys, so swapping requires an uninstall, which wipes
the library, positions and streak. The purchase comes back; the reading history does not.

---

## 25. The Unlock Celebration — variable reward

The unlock modal is the only moment where the user has unambiguously done the thing this product
exists for: they were on their way into Instagram and read instead. `features/celebration.js` owns the
pools, counters and tier decision; `nudge.js` draws the modal.

**The mechanic is variable *magnitude*, not variable decoration.** If every unlock celebrates equally
hard the user calibrates inside a week however many skins it has. So the great majority are quiet (a
rotating line, the credit, the count) and a small minority are genuinely bigger, carrying a real
milestone and the only animation this feature draws. **What makes that honest rather than a dice
roll:** milestones fire on measured thresholds the user actually crossed — 1, 5, 10, 25, 50, 100, 250
nudge-reads, and day runs of 3, 7, 14, 30 — each **once ever**. Unpredictable to the user,
deterministic in code. A day run beats a count when both cross on the same read, because a run cannot
be caught up on; the count milestone is left unspent rather than stacked.

**The modal is four lines:** a rotating title, a rotating plain-language sentence carrying the benefit,
one small DM Mono **receipt** carrying every figure, and the rotating count line. The figures were
originally *in* the sentence, and five variants of a number-dump is still a number-dump, because the
numbers are the shape of the sentence and the wording around them is noise. **§8.2 asks for the reset
to be visible, never for it to be the headline. Do not put them back.**

1. **Nothing may be invented.** §23's bar on fabricated figures applies here. *"You saved 15 minutes
   of scrolling"* is unmeasurable and therefore unsayable, however motivating it reads. What **is**
   measured is how many times they chose the book. **"Invested", never "saved".**
2. **Counters are derived from an append-only list, never stored beside it.** `fr_nudge_reads` is
   dates; total, week and day run are computed — the same discipline as `computeStreak()`, because a
   stored total and a stored list drift and then the modal congratulates the user on a number nothing
   can substantiate. The week is **Monday-to-today, not a rolling seven days**, because the copy says
   "this week".
3. **The visual stays inside §15:** three variants (bloom, sweep, ring), under a second, ease-out,
   accent palette only, no bounce, one pseudo-element, no extra DOM. Confetti was **rejected** — this
   screen is two taps from the nudge, where the brief is explicitly calm, not alarming. Copy rotation
   is random; the **visual** is round-robin, because a milestone is rare enough that a random pick
   would plausibly repeat, and at that frequency the repeat is what gets noticed.
4. **A pool never repeats its previous pick** — excluded, not merely made unlikely, and remembered in
   storage rather than memory, because consecutive unlocks are usually separate app sessions.
5. **Reduced motion is honoured in both layers** — the JS withholds the variant class and the CSS
   hides the pseudo-element. The first rule in the stylesheet to respect the preference; anything
   animated added later should.

**Haptics are deliberately an empty function with the call site in place** (owner). A haptic is
confirmation, not reinforcement: vibration has no perceptible dynamic range, so it cannot carry the
variable-magnitude job, and turning it on costs `android.permission.VIBRATE` permanently. Where it
would earn that is as punctuation on the milestone alone — **judge it on a device once the milestone
visual is real.**

**No analytics event** — `nudge_read_completed` already fires at this moment and §8.6's allowlist
stays closed. `CelebrationFeature.stats()` is exposed for the dashboard and §14's future "time
reclaimed" line, which these are the only honest figures for.

---

## 26. Investment — saved words (built), highlights (next)

§25 gave the loop its variable reward; this is the fourth phase of the same model — the user puts
something *in*, which makes the app better for them than it was yesterday and loads the next trigger
without the app having to nag.

**Why an investment of this kind at all:** it is the only candidate that creates **content the user
made** — it accrues, it is theirs, it exists nowhere else — and the only one that makes a *finished*
book worth reopening, where §4.2 otherwise treats finishing as the end of a book's life.

### 26.1 Saved words — built 2026-11-20

Every word looked up is kept, grouped by the book it was met in, on a Words screen reached from the
home header with its count on the button. Taken first because it is the same investment at a
fraction of the cost: the dictionary already exists, is already free, is already bound in all five
engines, and lookups were already happening — the app simply discarded the result. No new gesture,
no text selection, no new storage model, and **unlike highlights it works in RSVP and Chunk**, where
there is nothing on screen to select.

- **A word is kept only when the lookup was worth something** — a definition was found, or the user
  chose Google. The list therefore cannot fill with OCR noise or "no definition found" rows, so it is
  honest by construction rather than filtered at render time (§1.5).
- **Identity is the resolved base form** (§26.2), so `books`, `book` and `book's` are one entry, not
  three. **First save wins:** a word met again in a second book stays attributed to where it was
  first met, which is the read the reader will remember.
- **The count is on the home screen, not just inside the words screen.** An investment nobody can
  watch accumulating is not felt — that is the whole mechanic, not decoration. It is **its own row
  below the library, not a header button**: that row is navigation, is built for three buttons each
  at `flex: 1`, and a fourth wrapped and split its own label on a phone. A word collection is
  *content*, so it sits with the books. Full width also shows the count better than a badge in a
  crowded row, and unlike a chip inside the library section it does not vanish when the library is
  empty. **A row, never a card** — a card here reads as an unanswered to-do, which is why §22's tip
  is one line too.
- **`localStorage` under `fr_saved_words`**, consistent with `fr_library` and for the same reason:
  small records, not file data, and §20 reserves Preferences for purchase state alone. Capped at
  1,000 (~100 KB) dropping the oldest, as a quota guard rather than a product limit.
- **Free, never Pro** — §23 puts reading on the never-gate list, and this is reading.

### 26.2 The dictionary was not missing words — it was missing morphology

Reported as "missing a lot of words, even simple ones". The asset was never the problem: **82,559
entries**, essentially all of WordNet's lemma space. `lookupWord()` did an exact key match, so every
*inflected* form missed — `books`, `went`, `houses`, `walked`, `children`, `cities`, `women`,
`taught` all reported no definition while `book`, `go` and `child` sat in the file. Ten of eighteen
ordinary words tested. That is also why it felt arbitrary: whether a word worked depended on an
invisible property of the data.

`features/morphology.js` is WordNet's own answer (Morphy) — try the word as given, then an
irregular-forms table, then suffix rules, first dictionary hit wins. The same 46-word sample goes
from 36 hits to 43; the three that still miss are `the`, `of` and `and`, function words WordNet has
no entry for at all. Three rules on it:

1. **The word as typed is always tried first.** `bus` must not become `bu`, and `better` must keep
   its own entry rather than being redirected to `good`. Order is the entire guarantee — a rule can
   only ever apply to a word the dictionary does not already hold.
2. **One letter before two.** The bare `-s` rule runs *before* `-es`, because when both stems are
   real words whichever is tried first wins — with `-es` ahead, `castes` resolved to `cast`, `notes`
   to `not` and `rates` to `rat`. Found in testing, and it is silent: every one of those returns a
   real definition for the wrong word.
3. **A rule may only shorten, never guess at meaning.** Everything is orthographic; the irregular
   table is the one place a word maps to a different stem, and it is a fixed list.

**When the entry shown is not the word tapped, the modal says so** (`shown for: book`). Without it a
dictionary that resolves inflections looks like one answering a different question (§1.5).

**Known and accepted:** a few plurals are their own WordNet entries with their own meanings —
`names` is "verbal abuse", `rates` is "a local tax". A direct hit wins, so that is what shows. Fixing
it would mean overriding a direct hit with a guess, which is what rule 1 forbids.

**A non-Latin word now fails honestly.** The lookup key strips to ASCII, so a Devanagari word
produced an empty string and `showDictionaryModal()` returned *before showing anything* — no modal,
no message, no response to the long-press, while §22's tip told Hindi readers the feature existed.
It now names the limitation and still offers Google, which handles Devanagari fine.

### 26.3 Highlights — built 2026-11-20

`features/highlights.js` owns the store, the mode and the range lookup. The engines own the tint,
the reader owns the chrome and the list — those surfaces have nothing in common beyond asking this
module a question.

**No notes, highlights only** (owner, 2026-11-20) — which removes the text input and the keyboard in
the reader. The data model keeps room for a note field without showing one.

**Native text selection is not used, and that is the decision everything else rests on.** The
gesture conflict is three-way, not the two-way one first assumed: `user-select: none` is global on
`body`, `word-tap.js` owns long-press for the dictionary, and **Page mode's horizontal drag is the
page turn — drag-to-select and swipe-to-turn are the same gesture**, in the default engine where
every nudged read lands (§8.5). Also, the §6 Normal view renders PDF pages to `<canvas>` with no
text layer, so there is no text there to select at all.

**So: tap the first word, tap the last word.** Entered from a glyph button in the reader header —
that row does not wrap and its filename truncates, so one compact button costs filename width rather
than breaking the layout the way a fourth home-header button did (§26.1). The bar under the header
carries the instruction, the second tap commits, and the mode exits itself, so there is never a mode
left on and never a mode plus a modal (§20). Same word twice is a one-word highlight; a backwards
second tap normalises, because catching the start of a sentence often means swiping back first.

**The commit is the second tap, so Undo has to be real.** There is no confirm step — that is what
keeps a highlight at two taps instead of four — so a mis-tap must cost one action. The bar stays for
five seconds as "Highlighted · Undo" rather than firing a toast, because `showToast()` carries no
action and an Undo nobody can press is not one.

**In RSVP and Chunk the same button marks the sentence the reader is on** — one tap, no selection,
the same word-range model, bounded by the punctuation those engines already pause on (§4). One
feature to explain rather than two, and §1.5 is satisfied without introducing notes. Neither engine
tints, since neither shows the surrounding text; the mark appears in the panel list and on the
library row.

**Tap handling is one capture listener per surface, never per word.** It has to beat both the
word-tap dictionary binding and the chrome toggle underneath, and a leaf released by Page mode's LRU
must not take the handler with it. Page matches a span to a word by position (the one-span-per-word
correspondence `_bindLeaf` already relies on); Focus Bold and Scroll carry `data-index` already, so
one delegated listener on the reader serves both. **Page's handler is cleared in `_createShell`** —
the listener dies with its shell, and the attach guard would otherwise keep the next shell from ever
getting one.

**A highlight is two word indices**, which is what makes it survive a page turn mid-highlight (a
quote routinely straddles a break, so swipe stays live during the mode), the §4.1 rule 3 renumber, a
font-scale change and a different device width. Each leaf tints whichever of its own words fall in
the range, so neither page knows the other exists.

**A highlight is a background tint on existing spans and nothing structural.** Anything occupying
vertical space reflows pagination and forces a `fr_page_layout` v3 → v4 bump, re-measuring every
book on upgrade (§4.1 rule 4).

**Highlights survive a delete and re-import of the same book** (owner, 2026-11-20). `generateFileId()`
is content-derived, so they return by themselves — intended, not incidental.

**Three places, three reasons:** in the reader as a list **inside the index panel**, which jumps to
the word index (the seam the §6 bridge and chapter nav already use) — it shares that panel rather
than earning a sixth chrome button, because it is the same kind of thing and the panel exists for
exactly that; above the chapter search, or a book with 65 chapters buries it · **on the home library row as a
count**, which cannot be skipped, because an investment that is not *visible* is not felt · **on the
share card**, second in hero priority under a named finished book — a quoted line is the strongest
share material this app could have, and §21 puts it in a distribution bottleneck. Two rules on the
quote: **length is capped at share time, not at highlight time** (people highlight paragraphs, and
§14 forbids truncating the thing a slot exists to show, so long highlights are left out of the picker
rather than ellipsised), and **the card must name the book**, which doubles as attribution for
quoting copyrighted text.

**The quote's budget covers the attribution, not just the quote** (`QUOTE_BUDGET_CHARS`, 150). A
quote hero always carries its book's cover, so it wraps into a 496px column at six lines, and
`_fitHero` ellipsises the **last** line when even 30px overflows — which in this hero is the
attribution. Testing caught it: 140 characters plus "Hind Swaraj" fits, the same quote plus "The
Wealth of Nations, Volume One" runs to seven lines and loses the credit. So a long title means a
shorter quote qualifies, and an unattributed quotation is unreachable rather than unlikely.
`_wrap()` also learned to honour `\n`, because canvas `fillText` does not and the attribution would
otherwise have drawn as a stray glyph mid-sentence.

**No global all-books highlights screen** — highlights are per book, and a stream of quotes from six
books is a feed, not a collection. Saved words get the single growing list (§26.1) because a
vocabulary genuinely is one. **Free, never Pro** — §23 puts reading itself on the never-gate list and
a highlight is reading; gating it later would be the dictionary mistake again.

**Discoverability is §22's job, not a help screen.** And a highlight is the one thing here that gives a
notification something true and specific to say, which is exactly how it becomes nagging: §10's
discipline applies, and "revisit your highlights" must never fire on a book touched an hour ago.

---

*This document is the contract. Update it before changing direction, not after.*
