# FlowRead — Phase 16 Task Board

> Working document. `Claude.md` is the contract; this file is how we execute it.
> Every task references its governing `Claude.md` section. If the two disagree, `Claude.md` wins — and `Claude.md` gets updated *before* we change direction, not after.

**Layout:** this file is the **live board** — what is open, what it is waiting on, and every
decision taken. Completed work and resolved device findings live in
**[Tasks-archive.md](Tasks-archive.md)**. The split rule: anything that would change a future
decision stays here or in `Claude.md`; a record of an action already taken goes to the archive.

**Last updated:** 2026-11-20 — **16.29 + 16.31: the investment phase, merged to `master`**
(branch `investment-highlights`, two device passes, owner-verified). `features/highlights.js` holds the store, the mode and the range lookup; the engines tint,
the reader owns the chrome and the list. Tap the first word, tap the last — no native selection,
because the gesture conflict is three-way (global `user-select: none`, `word-tap.js` owns
long-press, and in Page mode the horizontal drag *is* the page turn), and the §6 Normal view is
canvas with no text layer at all. Swipe stays live during the mode, so a quote can straddle a page
break. RSVP and Chunk mark the sentence instead. The list shares the index panel rather than taking
a sixth chrome button; the count is on the library row; the share card gains a quote hero ranked
under a named finished book. Three things testing caught: Page's capture listener died with its
shell and had to be cleared in `_createShell`, the promised Undo was only a toast until the bar grew
a second state, and the quote budget had to charge for the book title or a long one pushed the
attribution off the card. **Nothing is browser-verified — device pass owed, plus Hindi sign-off on
20 new keys.**

**Device pass 1, 2026-11-20 — three findings, all fixed.** (1) The highlights section in the index
panel was an uncapped flex item, and a flex item will not shrink below its content, so the search
field and the entire chapter index were pushed past the panel's bottom edge with nothing able to
reach them; it is now capped at a third of the panel and scrolls itself, and `.reader-index-list`
gained the `min-height: 0` its own `overflow-y` needed. (2) The library count was added to the two
*row* render paths and neither *card* path — Pro renders the library as a grid of cards, so the
count was invisible to exactly the users who have Pro; all four paths carry it now. (3) **Owner
reversed "no global highlights screen"**: there is one, grouped by book, reached from its own home
row beside saved words, and tapping a quote opens that book at that word through a new
`startIndex` option on `resumeFromLibrary` which beats the completed-book reset to word zero.
Confirmed working by the owner: the tint in Page/Scroll/Focus Bold, the share card's quote hero,
and (after the fix) the scrollable index panel.

**Device pass 2, 2026-11-20.** The header button was U+25AE, which the owner read as a pipe and not
as anything to do with highlighting — correctly, and the tip copy already said "tap the
highlighter". Replaced with an inline SVG marker over a band, the approach `_searchGlyph()` already
uses. Also added `tip.highlights_screen`, since the `highlights` tip teaches the gesture and had no
destination, so nothing revealed the new screen. **21 Hindi keys now awaiting sign-off.**

Also 2026-11-20 — **16.31: saved words, and the dictionary's real defect**
(branch `investment-highlights`). The Hooked *investment* phase, taken at its cheapest point first:
every word looked up is now kept, grouped by book, on a Words screen reached from the home header
with its count on the button. Chosen over highlights for the first pass because it needs no gesture
decision, no text selection and no new storage model, and it works in RSVP and Chunk where
highlights never will. **The dictionary was never missing vocabulary** — 82,559 entries, all of
WordNet's lemma space; `lookupWord()` did an exact key match, so every inflected form missed
(`books`, `went`, `children`, `cities`, `women`). `features/morphology.js` adds Morphy resolution:
36 → 43 hits on a 46-word sample, the remaining three being function words WordNet has no entry
for. Also fixed: a Devanagari word produced **no response at all** from the long-press (silent
return, §1.5), two dead i18n keys from the removed Pro gate, two hardcoded English strings, and the
orphan `engines/highlight.js` + its `.gh-*` CSS is deleted. `Claude.md` §26 rewritten — §26.1
saved words, §26.2 morphology, §26.3 the highlights decisions. **Device pass owed, and Hindi
sign-off on 15 new keys.**

Also 2026-11-20 — **a 13th discovery tip**: that FlowRead is in the browser's share
sheet (§23). It was the one capability with no surface teaching it at all — the URL card on home
is stumble-on-able, the share-intent route is not. Pro-gated like `scan`, and retired by
`share-handler.js` on a real shared link. Also **16.30 done**: Page leads the engine row, and the seven stale
`|| 'rsvp'` fallbacks that still contradicted the shipped `defaultMode: 'page'` are gone. Also
**16.28 merged to master** (`bbb694e`). One task added and not started:
**16.29**, highlights and notes as the Hooked *investment* phase — a design note only,
with the gesture conflict against `word-tap.js` named as the decision everything else waits on
(`Claude.md` §27).

Also 2026-11-20 — **16.28 reworks the share moments** (branch `share-moments`): the
sheet opens as a composed card with the options behind one tap, a finished book is offered for
sharing *when it is finished* rather than on the next app launch, and three recap windows (last 7
days, last 30 days, this year) give the card something to say on an ordinary week. `Claude.md`
§15 carries the new rule — a completion prompt may interrupt only where the engine can prove the
reading is done.

Also 2026-11-20 — **16.27 gives the unlock modal a variable reward** (branch
`nudge-celebration`): `features/celebration.js` holds the copy pools, an append-only count of
nudge-reads, and the tier decision. Most unlocks stay quiet with a rotating line and a measured
count ("that's 4 times this week you've picked the book first"); milestones — 1/5/10/25/50/100/250
reads, day runs of 3/7/14/30 — fire once ever and carry the only animation. Confetti was rejected
and haptics deliberately stubbed. `Claude.md` §26 has the reasoning.

Also 2026-11-20 — **16.25 reworks paywall placement, and 16.26 adds the debug flag
that makes it testable** (branch
`paywall-placements`, stacked on `feature-discovery-tips`): Settings gains the only deliberate
purchase path in the app, the locked font/theme chips and the device-sync note stop being dead
ends, and the dashboard shows a real preview instead of a modal. The audit's other half — the four
places a paywall must *not* go — is recorded in `Claude.md` §24.

Also 2026-11-20 — **16.24 adds rotating feature-discovery tips** (branch
`feature-discovery-tips`): twelve tips in `features/tips.js`, drawn by two surfaces — a one-line
strip on home and a line in the nudge unlock modal. Deliberately *not* on the nudge screen itself
— see the decisions log. **It also fixed a live §4-vs-code contradiction: the offline dictionary
was Pro-gated in code while §4 lists it as free, and the gate is now removed.** Device run and
Hindi sign-off owed.

Previously, 2026-11-19 — **three unreleased task groups sit on top of 1.5.6 / 44**, on
branches `nudge-book-selection-fix` (16.21, 16.22) and `reader-type-preset` (16.23). All found or
directed from real use: the nudge resumed the wrong book and the gate miscounted a page three ways
(a backward swipe unlocked the app outright); the reading-session recorder discarded a session, and
its streak day, on a backward jump, and reported the WPM slider's position as a reading rate; and
onboarding now asks what kind of reader someone is instead of shipping four presets nobody saw,
offers both nudge triggers, and tells the user which of the day's nudges this is. **None is device
verified, and the Hindi on the onboarding strings is drafted, not signed off.** `Claude.md` gained
§10.3 and §20 for the parts that bind future work.

Previously, 2026-11-02 — **16.2's device checklist is done**: all sixteen items run and
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

**2026-11-16 — Paragraphs restored, and Page mode is now the default (Tasks 16.13, 16.14).**
Page mode was rendering books as one unbroken wall of words with chapter titles run into
the prose. The cause was not Page mode: **every parser found paragraphs and then threw them
away** (`txt.js` flattened its blank-line blocks into lines), so all five engines got a flat
word array. Wealth of Nations: 2,250 paragraphs in the source, **all 2,249 boundaries
discarded**. `rawLines[]` now carries `paraStart` and `features/paragraphs.js` turns it into
word indices; Page mode renders an indent, no blank line. Books already in the library cannot
be re-parsed (only PDFs keep raw bytes) so they get an inferred fallback at 94.6% precision.
**Page mode is now the default engine for new installs** — and could not be chosen at all
before, the Settings dropdown having never listed it. **Chapter detection turns out to be
broken by the same root cause and is now Task 16.14**, **fixed the same day** — 910 detections
across nine real books became 466, with the prose fragments going from 131 to zero and no
`CHAPTER`-opening paragraph missed on *Wealth of Nations*.

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

**2026-11-16 — 1.5.5 / versionCode 43 built, signed, R8 active.** The eight commits that landed
after the 1.5.4 release are now in a build: 16.12 (Page-mode pagination), 16.13 (paragraphs, and
**Page mode becomes the default engine**), 16.14 (chapter detection), 16.15 (styled headings),
16.16 (catalogue covers on the share card), 16.17 (last-page completion), plus 16.4 Phase B's
growth to 150 books and the Gutenberg mirror retry. `release-notes-1.5.5.txt` written, six
locales, all within Play's 500-char limit. **Not uploaded, not promoted — the device checklist
below comes first.** `Claude.md` §22 was corrected in the same sitting: it still claimed
production was 1.4.5 / 32 and the pivot unreleased.

### 1.5.5 device checklist — run before uploading

**Why this build needs one more than most.** 16.13 made Page mode the **default engine**, so
every reader now lands in the surface six of these commits rewrote; §9.5 already sent every
nudged read there. And two changes touch state that outlives a session — see items 1 and 7,
which are the two to run first if time is short.

- [ ] **1. Upgrade path, not a fresh install.** Install over an existing 1.5.4 with books already
      in the library. The persisted layout grid went **v2 → v3**, so every book re-measures once:
      confirm the first open of an existing book is still fast and lands on the saved position,
      not page one.
- [ ] **2. A long book** (Wealth of Nations, 384k words): opens without a wait, paragraphs are
      indented, chapter titles render as headings, no heading sits alone at the foot of a page.
- [ ] **3. The chapter index** finds real chapters, and tapping an entry lands on that heading.
      Check a **PDF**, a **DOCX** and a **Devanagari** book — the three the TXT test corpus
      cannot reach.
- [ ] **4. Devanagari headings** at the largest font scale: Noto Sans Devanagari's taller glyphs
      must not clip at the larger heading sizes.
- [ ] **5. Both font scales and a rotation**: pagination re-derives, position holds, headings
      still sized sensibly.
- [ ] **6. §7 bridge both ways from Page mode**, including from the last page — `_index` stays the
      honest word there, and this is what proves it.
- [ ] **7. Completion.** Read to the last page: the toast appears, and the home screen moves the
      book to **Read** without leaving the reader. Then page back and confirm it returns to
      in-progress. **This is the one that can misfire on existing data** — `_savePos` is what
      decides whether a book counts as read, so watch that no *other* book changes section, and
      that §15's "You finished X — share it?" prompt does not fire for something unread.
- [ ] **8. Share cards.** Download a Free Books **TXT** and a **PDF**, share each, confirm the
      real catalogue cover appears. On a device whose WebView cannot decode AVIF it must fall back
      to the typographic cover rather than showing a gap.
- [ ] **9. The 150-book library opens at all** — never yet exercised in the app, on device or in a
      browser (16.4 Phase B). Check the category chips all carry labels rather than raw slugs, and
      that a book from the new batch downloads and reads.
- [ ] **10. A nudged read** lands in Page mode with no visible wait, and the unlock counter still
      advances (`NudgeFeature.onPageTurn`).
- [ ] **11. Hindi throughout**, including the new `reader.page.finished` toast.

**Then:** upload the AAB, publish `release-notes-1.5.5.txt`, and decide whether to advance
1.5.4's 20% staged rollout or supersede it with 43 at a fresh percentage.

---

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
| 2026-11-20 | **A completion prompt may interrupt only where the engine can prove the reading is done** (16.28), superseding §15's "home screen only". | The old rule produced a share offer on the *next app launch* — moment gone, and reading as a bug. RSVP/Chunk/Scroll/Focus Bold can prove it: `_handleEnd()` means playback ran past the last word, the engine is idle, nothing is left to interrupt. Page mode cannot — arriving on the last page is not reading it, and how long it takes is unknowable — so it offers a tappable line instead of asking. Streak milestones stay on home, which is what the original rule was actually protecting. |
| 2026-11-20 | **Recap windows are offered, never prompted** (16.28). | A recap renews weekly, which no other share occasion here does, and §22 puts the product in a distribution bottleneck. But the owner declined a prompt, and that is the right call: a recap arriving unbidden in a week the user read nothing has no honest phrasing that is not the guilt framing §9.1 rules out. "This year" rather than "last year" for the same reason — last year is empty for every current user and would ship broken until December. |
| 2026-11-20 | **The share sheet opens composed; editing goes behind one tap** (16.28). | It opened as up to seven hero radios and four checkboxes — reported as "too many choices" — which asked the user to decide something §15 already ranks (a named book, then the streak, then the numbers). §15's editability requirement is met by one tap, not by putting the form in front of the card. |
| 2026-11-20 | **The unlock reward varies by *magnitude*, not by decoration** (16.27). | Rotating copy and a choice of animations are skins: if every unlock celebrates equally hard the user calibrates to it inside a week however many skins it has. So most unlocks are quiet and a rare minority carry a real milestone — which is Hooked's variable-ratio mechanic rather than a cosmetic reading of it. Honest because the milestones are measured thresholds granted once ever, not a dice roll: unpredictable to the user, deterministic in the code. |
| 2026-11-20 | **No confetti; three restrained variants instead** (16.27). | The unlock sits two taps from the nudge screen, where §16's brief is explicitly "calm, not alarming", and §16 caps animation character at no-bounce and sub-second. A party-coloured burst is a different product's voice. Bloom/sweep/ring at §700–900ms in accent palette only carry the variability without the register change. |
| 2026-11-20 | **"Invested", never "saved" — and the motivating line is a count, not minutes** (16.27). | "You saved 15 minutes of scrolling" is unmeasurable: nothing knows what the user would have scrolled, so it is the fabricated figure §24 forbids, however well it reads. Minutes *with the book* are measured, and so is how many times the user picked the book — which is the strongest true sentence available here. |
| 2026-11-20 | **Haptics left as an empty function with the call site in place** (16.27). | A haptic is confirmation, not reinforcement — vibration has no perceptible dynamic range, so it cannot carry the variable-magnitude job, and it costs `android.permission.VIBRATE` in the merged manifest permanently. Where it would earn that is punctuation on the milestone alone. Deferred to a device judgement once the milestone visual is real; switching it on is one function body plus the manifest line. |
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
| 2026-11-18 | **Nudge progress is counted as movement, never as distance from an anchor** (16.21). | Both counters asked "where are you now, minus where you started", and a jump looks exactly like a position from there. Swiping *back* on arrival credited a page and unlocked the app; "last page" cleared any threshold in one tap, with `onPageTurn` refusing the jump and the word counter crediting it a line later. Counting turns also needs no anchor, which matters because §5.1 rule 3 renumbers pages under a live read. Page mode is now excluded from `onReadProgress` outright, which is what makes §9.5's "exact page count" true rather than intended. |
| 2026-11-18 | **A nudge resumes the most recently opened unfinished book, not the furthest along** (16.21). | The old rule was borrowed from `notifications.js`, where it is right — a *reminder* asks which book is closest to done. A nudge intercepts a moment, and the moment belongs to whatever the reader has open. `notifications.js` keeps its rule, now with a comment saying it is deliberately not the nudge's. |
| 2026-11-18 | **A reading session records the furthest point reached, with measured WPM and active duration** (16.22, `Claude.md` §20). | Every number was built around RSVP's play/pause and wrong once Page mode became the default (16.13), because Page mode has no pause. Words read was end-minus-start, so a backward jump past the opening position discarded the session *and its streak day*; WPM was the slider setting, making the dashboard an average of a slider position. Measured WPM forced the duration fix too — wall clock would have turned a phone left face-up into a visibly wrong rate. Old sessions keep slider values, so the 7-day average is a blend until they age out. |
| 2026-11-19 | **Onboarding asks what kind of reader you are, and sets the thresholds from it** — light 20 min/2 pages, medium 15/4, heavy 10/7 (16.23, §10.3). | The thresholds were presets nobody saw, and asking directly asks the user to decide what they have no basis for yet. The owner's sketch was 2/5/10 pages; 7 replaced 10 because a ~12–15 min gate is one most people escape, and a gate that is escaped teaches the escape hatch. `dailyCap` and the back-off deliberately do not vary — §1.6 guardrails are not taste. Stored as `fr_reader_profile`, not a nudge key, so 16.18's reading plans seed from the same answer. |
| 2026-11-19 | **Both nudge triggers are offered in onboarding, as peers, added rather than exclusive** (16.23). | They were unreachable from onboarding, so every new user left on threshold-only — which misses the reflexive opener entirely: twenty 30-second opens never accumulate the threshold in one sitting, so that user would never be nudged and would conclude the feature is broken. Peer checkboxes over a secondary opt-in was the owner's call. Keeping both on rather than swapping matters because §9.3a makes them orthogonal, so the profile's minutes still govern long sittings. |
| 2026-11-19 | **The nudge screen states which of the day's nudges it is**, and that the cap is a setting with a Reset (16.23). | The daily cap is §9.3's main guard against the mechanic becoming nagging, and it was invisible — no way to tell a first interruption from a last, nor that the number was the user's. Painted asynchronously and left blank on any failure: `renderNudge` must stay synchronous over another app, and a nudge with a wrong counter is worse than one with none. |
| 2026-11-19 | **Settings' "with both on" note is rewritten, and dropped from onboarding entirely.** | The claim was stale: it said every-open already covers the threshold, which held under §9.3's original framing and stopped being true when §9.3a let the threshold fire mid-session. So it told the user one of their own choices did nothing when it did (§1.5). It now says they get both moments — the open, and again on a long sitting. Dropped from onboarding regardless, where on a first run any note there reads as a correction to a choice just made. The same stale claim was carried in two code comments (`nudge.js`, `settings.js`) and both are corrected. |
| 2026-11-19 | **`_pushSettings()` returns a promise, and anything that reads the nudge state back must await it.** | `getNudgeStatus` is served from the same native prefs `_pushSettings` writes, so Settings was racing its own write: moving the daily-cap slider left the status line below quoting the previous cap until the screen was left and re-entered. Reported from use. Individual key writes still swallow their own failures, so one failing key cannot reject the whole push and strand the caller. |
| 2026-11-20 | **Feature-discovery tips go on the nudge *unlock modal*, never the nudge screen.** | The nudge screen's two actions are deliberate peers and the escape hatch is a product rule (§9.1, §21). A third thing to read makes it one of three. The unlock modal is after the threshold is met: nothing withheld, nothing interrupted, and the user has just succeeded. |
| 2026-11-20 | **A debug-only "simulate the free tier" toggle, gated on `window.Capacitor.DEBUG` rather than on remembering to remove it.** | §24's free-tier surfaces were untestable on a device whose account owns the lifetime purchase, and Play re-grants it every launch. The toggle only ever *withholds* — a "simulate pro" switch would be an unlock vector — and `FLAG_DEBUGGABLE` makes the row impossible to render in a release build, so the release check in `Claude.md` §25 is a backstop rather than the guarantee. §3's missed deadline is why a checklist alone was not considered enough. |
| 2026-11-20 | **Settings gets the one deliberate purchase path**, shown only to a user who has not paid. | Every other paywall is reactive, so someone who simply wanted to pay had nowhere to go — and §1.3's "prominently offered and genuinely purchasable" cannot hold when the only route to the lifetime option is bumping into a locked feature. One section, one screen the user navigated to themselves; explicitly not home and not a banner. |
| 2026-11-20 | **A locked control must do something when tapped** — it opens the paywall rather than being `disabled`. | A dead lock icon is a silent failure (§1.5) and discards the best-timed paywall in the app: the user has just pointed at what they would buy. Applied to the font/theme chips and the device-sync note, and inherited by any future Pro gate. |
| 2026-11-20 | **The dashboard shows itself before it asks**, with the user's real KPIs and the charts behind one named lock card. | A modal in front of a closed door never showed anyone what they would be buying. Nothing is fabricated — invented preview numbers would be §1.5's silent lie — so `paywall_shown` moves to the card's button and keeps meaning "was offered a price". |
| 2026-11-20 | **No paywall at a nudge, a finished book or a streak milestone.** | §9.1: the escape hatch may never share a screen with a price. §15 already owns the completion moment with the share prompt, which is the distribution play §22 prioritises — trading a share for a paywall impression is the wrong trade in a distribution-bound product. |
| 2026-11-20 | **Both surfaces ship: the home strip *and* the unlock-modal line.** | Owner's call, reversing a brief decision to keep only the modal. The modal reaches a user who completed a nudge-read; the strip reaches everyone else, which is most people, and is the only one of the two that can close the loop with a tap. |
| 2026-11-20 | **A tip is never truncated, on either surface.** | A Hindi tip is routinely longer than its English twin, and a slot whose whole job is to explain something cannot clip the explanation. Both wrap; the strip grows to two or three lines. |
| 2026-11-20 | **The offline dictionary is free in code, matching §4** — the Pro gate in `DictionaryFeature.showDictionaryModal()` is removed. | §4 has listed the dictionary under the free tier since the pivot's pricing was settled, while the code sent every free user to a paywall. It had been shipping unnoticed because nothing advertised the feature to the users it was withheld from — writing a tip for it is what exposed it. The gate was the bug, not the table. |
| 2026-11-20 | **No `tip_shown` analytics event.** | §9.6's allowlist is closed on purpose so a caller cannot widen collection quietly, and this is not a core action. Retirement-on-action already shows up in `import_completed` / `book_opened`. Revisit if the pool needs tuning. |
| 2026-11-20 | **Every tip is capped at 3 shows, including ones never acted on.** | Relevance gating answers "is this useful to you"; it cannot answer "you have understood and declined this". Without a cap a tip the user keeps ignoring keeps arriving, which is §1.6's nagging. |
| 2026-09-16 | **Strict `Claude.md` order** — compliance block fully verified on a real device before any feature work starts. No parallel nudge development. | §3.3 sequencing. Avoids re-testing feature work against a shifting toolchain. |

---

## Open questions — product owner

Each is tagged with whether it blocks *starting* the task or only *finishing* it.

| # | Question | Blocks | Start/Finish | Ref |
|---|---|---|---|---|
| ~~Q1~~ | ~~Subscription price (monthly / annual)~~ | — | **Resolved 2026-10-30: ₹149/mo, ₹999/yr as `flowread_plus`; lifetime `pro_lifetime` repriced to ₹2,999 and widened to include OCR; `ocr_vision` retired from sale but honoured forever.** See 16.1. | §4 |
| ~~Q2~~ | ~~Nudge default thresholds~~ | — | **Resolved 2026-09-20: 15 min / 2 pages, both settings** | §9.2, §9.3 |
| ~~Q3~~ | ~~Is the nudge permission ask inline in onboarding or deferred?~~ | — | **Resolved 2026-11-01: inline**, and placed *after* the user names an app so the ask is concrete. Skippable throughout; N4's home card stays as the second chance for skippers. See Task 16.3. | §10.2 |
| ~~Q4~~ | ~~Monthly book-drop count, and bundled vs. remote-fetched catalog~~ | — | **Mechanic revised 2026-11-17 — see Task 16.4 Phase D: ten curated books a month, the subscriber claims one, free users get none.** Original answer, still current for everything else — **Resolved 2026-11-03: 3 books/month, rotating. `catalog.json` hand-edited on a public GitHub repo (raw URL); book files uploaded to the WP media library. The existing 23 off-site books do not move.** No per-book provenance. See Task 16.4. | §4, §13 |
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
- [x] **Cloudflare Worker endpoint — deployed and live 2026-11-17.**
      `https://flowread-analytics.flowread-android.workers.dev/e`, account
      `bdf1a1bc473345a64ce54a543fd2ef49`, D1 `flowread-analytics` in **APAC**. `ENDPOINT` is
      filled, so **the app is no longer inert** — the next build sends pings. Emptying that one
      constant is the kill switch.
      Round trip verified end to end on the live endpoint: four valid pings stored, three bad ones
      (unlisted event carrying a package name, a date 7 years off, malformed JSON) stored nothing,
      the OPTIONS preflight answers 204, `/stats` 404s without the token, two read sessions
      aggregated into one row summing correctly, and both `first_time_*` counters read 1. Test rows
      were sent as `platform='web'` and then deleted, so the table is empty and real data starts
      clean.
      **Three things learned doing it, all in `worker/README.md`:** a new account has no
      workers.dev subdomain and the first deploy simply fails without one; the dashboard link
      Wrangler prints for that **404s**, and there is no CLI command, so it was registered over the
      API with the token Wrangler already holds; and TLS on a fresh subdomain takes a minute or two,
      during which `curl` fails with SSL error 35 — that is propagation, not misconfiguration.
      `preview_urls = false` was set: every deployment otherwise gets a second public URL that
      writes to the same database, and nothing needs it.
      Wrangler is a devDependency of `worker/` alone — the app's `package.json` is untouched (§21).
      **Still owed:** re-file Data safety as *Optional* (below), re-publish the amended privacy
      policy, and move to a custom domain when the domain is bought (a route plus one constant;
      nothing migrates).
      **Design notes on the receiver, written 2026-11-16 and still binding.**
      **D1, not KV, and aggregate-only:** a row is a counter for one
      (day, event, dimensions) tuple, so the store physically cannot hold a sequence of one
      person's actions. That makes the privacy guarantee a property of the storage rather than of
      whoever writes the next query. Numeric meta is summed (`n` + `sum_*`) instead of becoming a
      dimension, which keeps the primary key from exploding on minutes/pages.
      **Four things not to undo:** the client IP is never read, stored or logged, and
      `[observability]` is off for the same reason (a Worker log line carries the IP in its own
      metadata); the event allowlist is enforced *again* server-side, because a client can be
      modified; `/stats` serves a fixed set of named questions behind `STATS_TOKEN` rather than
      arbitrary SQL; and every request answers 204 whether it was stored or dropped, so the
      response cannot be used to probe what the allowlist holds.
- [x] **Phase 1 events — added 2026-11-16, owner-selected.** `read_session_ended`, `book_finished`,
      `book_opened`, `paywall_shown`, `import_completed`, plus `tenure` on `app_opened` and a
      `first` flag. See
      Claude.md §9.6 for why each one is a denominator something already-collected was missing.
      Wiring notes worth keeping, each of which was a way to get the number wrong:
      `read_session_ended` fires from `_flushSessionIfActive()` on the *same* ≥10-word/≥3s
      threshold as the local recorder (so the ping and the dashboard cannot disagree) and reads
      `AppState.readerSource` there, because the back handler resets it one line later and a nudged
      read reported as a chosen one would make the pivot look like it was working when it was not.
      `book_opened` skips `bridgeReturn`, or the §7 round-trip inflates opens. `paywall_shown` is
      logged before `showPaywall()`'s late-price redraw can re-enter it, or a cold start double-counts
      and halves every conversion figure. `import_completed` fires from `saveFileToLibrary()` only
      when the entry is genuinely new and the origin is not `'catalogue'` — a re-open rewrites
      `lastOpened` through the same function, and a Free Books download already has
      `free_book_downloaded`. `book_finished` is gated once per book because §5.2 makes completion
      derived — paging back off the last page un-finishes a book, so an ungated event drifts
      upward on re-crossings; the gate is sticky across Mark unread and re-reads on purpose, and
      the opt-out is checked before it is consumed so opting in later still counts the next
      finish. Both the read-through path and the Mark read button share that gate, so a book read
      to the end and then marked is one event, not two.
- [x] **Privacy policy amended 2026-11-16** for the four events, `tenure`, `first`, the no-IP
      guarantee and the totals-only storage. **Needs publishing to the hosted URL again** — that
      is a manual step and committing the file does not do it.
- [ ] **"How many people have ever shared a card"** — answered without an identifier: the client
      flags a device's *first ever* `stats_shared` (`firstTag`), and `/stats` counts the flagged
      events. Two accepted limits: a reinstall counts as a new sharer, and a first share made
      while opted out is counted at the second instead. **Verify on device** once the endpoint is
      live — the flag is one-shot per install, so a bad first test cannot be repeated without
      clearing `fr_an_first_share`.
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

## Task 16.13 — Paragraph structure end to end  ✅ code complete, device run outstanding

**Governed by `Claude.md` §6.1** (written for this work), §5.1 rule 4, §17.

**Why.** Reported from use: Page mode "just shows all the text, like with just spaces
between words… no paragraphs, nothing", chapter names included. Confirmed against the real
Gutenberg *Wealth of Nations*: the source has **2,250 paragraphs**, hard-wrapped at 74
characters, and the parser kept 32,415 lines while discarding **all 2,249 paragraph
boundaries**. One line did it — `txt.js` split on blank lines to find paragraphs and then
`.flatMap`ped the blocks straight back into lines. **This was never a Page mode bug**; Page
mode is just the only engine that shows a page of prose at once, so it is where it shows.

**What changed.**
1. **Parsers keep it.** `rawLines[]` carries `paraStart` — exact for TXT (the blank-line
   block) and DOCX (mammoth already emits one paragraph per newline), inferred from
   geometry for PDF, for which `finishLine()` now keeps the line's `x0`/`x1`.
2. **`features/paragraphs.js`** turns `rawLines` into a Set of word indices, memoised per
   file.
3. **Page mode renders it** as a zero-height block plus a 1.5em indent on the first word —
   indent, no blank line, per the owner's choice. Costs no vertical space, so the page
   count barely moves.
4. **One renderer.** `_measureSlab` and `_ensureLeaf` both build their markup from
   `_wordsHtml` now. They were separate code paths that happened to agree; adding paragraph
   markers to both would have doubled the chance of them disagreeing, and when they
   disagree pages overflow. Word-tap binding moved to a second pass (`_bindLeaf`) over the
   spans, matched to words by position.
5. **Layout cache bumped to `v: 2`** — paragraphs move every page boundary, so a v1 grid
   describes a layout that no longer exists.

**Already-imported books.** Only PDFs keep their raw bytes (`saveRawPdf`), so a TXT in the
library is stored as parsed data with its source gone and cannot be re-parsed. Those get an
inferred fallback: a line that stops short of the wrap width **and ends a sentence** ended
its paragraph. Against the real book:

| Rule | Precision | Recall |
|---|---|---|
| previous line is short | 80.7% | 74.6% |
| previous line is short **and ends a sentence** | **94.6%** | **86.9%** |

The sentence-ending half is what carries it. A missed break merges two paragraphs, which is
exactly the old behaviour, so the failure mode degrades to today rather than to something
wrong. The danda `।` is in the sentence-ending set (§17). Free Books can be re-downloaded
for an exact result.

**Follow-up, reported from device: the bottom fifth of the page was blank.** Raising the
nav bar before measuring (below) exposed a double reservation that had been there all along.
`.page-engine-nav` is a normal flex item in the `#view-reader` column and already takes its
own ~65px out of the shell — calm mode only fades it, never removes it from layout — but
`.page-leaf` *also* reserved `96px` of bottom padding for the same bar. Measuring against the
unshrunk shell had been hiding half of it by letting the text run into the reserve. With the
measurement corrected, both reservations applied at once and the dead strip went from 31px
to 96px. The leaf's bottom padding is now an ordinary 24px reading margin, matching the top;
the safe-area inset belongs to the nav bar below, which handles its own.

| | usable height | blank below the text | share of the reader |
|---|---|---|---|
| before any of this | 580px (measured against a stage 65px too tall) | 31px + nav | 13.7% |
| nav-first alone | 515px | 96px + nav | 23.0% |
| **now** | **587px** | **29px + nav** | **13.4%** |

So the page holds ~14% more text than the measurement ever intended, and the only blank left
is the reading margin. 235 words on page one at the default scale.

**Fixed in passing — pages were sized for a stage that does not exist.**
`.page-engine-nav` is an ordinary flex item (`flex-shrink: 0`, no positioning), so putting
it up **shrinks the shell by its own height** — but `_ensureNavBar()` ran in
`_finalizeBuild`, *after* measurement. Every page was therefore measured against a stage
~65px taller than the one it would be rendered into, and the text ran about a line closer to
the nav bar than the 96px reserve intends. The bar now goes up before anything is measured,
which also puts the §7 bridge button on screen from the first frame.

**Page mode is now the default engine** for new installs (`settings.js`), and is listed in
the Default Mode dropdown, **which never offered it** — rsvp/chunk/focus/scroll only, so it
could not be chosen even deliberately. `settings.mode.page` added to `en.json` and
`hi.json` as "Page" (engine names stay Roman, §17). Existing users are untouched: their
`defaultMode` is already written into `fr_settings` and `fr_last_engine` overrides it
regardless — nobody's engine changes under them.

**Verified:** 12-assertion headless harness on a synthetic Gutenberg-shaped book (parser
marks exactly the real paragraphs; the fallback scores 100%/89.7% on it; every opener is
*measurably* indented; no blank line appears; no page spills into the nav-bar strip across
60 page turns; one span per word with the right word in it), the full real *Wealth of
Nations* end to end (**2,247 paragraphs recovered, 384,153 words, 2,924 pages**), a unit
test of the PDF geometry (60/60 on an indented book), and the 40-assertion 16.12 suite still
passing.

- [ ] **Device run.** A TXT from Free Books, a PDF, and a DOCX: paragraphs where they
      belong, indent reads right at both font scales, chapter titles no longer run into the
      prose. A book already in the library from before this build, to see the fallback.
      A Devanagari book for the danda. Page mode arriving as the default on a fresh install.
- [ ] **Re-download one Free Book** already in the library and confirm it comes back with
      exact paragraphs rather than inferred ones.

---

## Task 16.14 — Chapter detection is wrong on every file  ✅ code complete, device run owed

**Reported:** "Index of chapters is not detecting chapters correctly. It always mess up for
any file." Confirmed, and the cause is **the same flatten as 16.13**.

`classify ChapterLine` (`features/chapter-detection.js:23`) opens with
`/^(chapter|part)\s+([a-z0-9ivxlcdm]+)/i` — case-insensitive, **no word boundary and no
requirement that the line be standalone**. So *any wrapped line beginning with the word
"part"* is a chapter. On *Wealth of Nations* it returns **207 chapters where the book has
about 65**, and most of the extras are mid-sentence fragments:

```
rule1 chapter/part   part of the produce of his own labour, which is over and above his own
rule1 chapter/part   part of this superfluity. But if this latter should chance to have nothi
rule3 ALL-CAPS       THAT THE DIVISION OF LABOUR IS
```

Breakdown of the 207: 179 from the chapter/part rule, 24 all-caps, 4 title-case. The
all-caps hits are *fragments of wrapped headings* — the heading was hard-wrapped across
several lines and each piece was judged on its own.

**Why it is worth doing after 16.13 rather than before.** Both symptoms come from headings
being split across `rawLines` and prose fragments being indistinguishable from them. With
`paraStart` the detector can finally ask the right question: a heading is a **standalone
short paragraph**, not a line fragment. That one condition should remove most of the 142
false positives on its own, before touching the regexes.

### What was built (2026-11-16)

`detectChapters(file)` now classifies **paragraphs**, not lines — it takes the file rather
than `rawLines` so it can group through `ParagraphStructure`, the same boundaries Page mode
renders. The index therefore agrees with what is on screen. The classifier is the whole
file, rewritten:

- **A heading is a short, standalone paragraph.** Gates on every rule: starts with a capital
  or a Devanagari letter, opens with a word rather than punctuation, does not end
  mid-clause, and contains no sentence boundary. That last one needed care — a sentence
  boundary is *two or more letters* before the stop, so `Chapter I. The Twin-Verses` is a
  heading while `…his own labour. But if…` is prose. Testing the stop alone rejected every
  `CHAPTER I. TITLE` heading in the corpus.
- **The `chapter|part` rule is anchored**: a heading word followed by an ordinal — a numeral,
  a roman numeral, a spelled-out number (`CHAPTER ONE`), or `the First`. This is the single
  fix for the reported bug. It no longer `return null`s when the ordinal is absent but falls
  through to the later rules, which is what let `CHAPTER ONE PLAYING PILGRIMS` be found.
- **Two length gates, not one.** An anchored heading may run to 250 characters, because
  `CHAPTER V. OF THE REAL AND NOMINAL PRICE OF COMMODITIES, OR OF THEIR PRICE IN LABOUR, AND
  THEIR PRICE IN MONEY.` is unambiguous however long it is, and an 18th-century book is full
  of them. Every rule that merely *guesses* from capitalisation keeps the tight 110-character
  bound, where length is most of what separates a heading from a sentence.
- **Shape-based rules are dropped when the numbered structure dominates** (strong ≥ 5 and
  strong > weak). A book that numbers its chapters does not need the guesses, and they only
  add things that look like headings — an all-caps line inside a story, a name centred under
  a poem. *Little Women* has an in-fiction newspaper whose mastheads are all-caps; they go.
  A book of fairy tales or poems has nothing stronger, so there the guesses are the whole
  index and are kept. This single rule is what separates Grimms (78 tales kept) from Little
  Women (32 mastheads dropped).
- **Contents-page duplicates are dropped** when every earlier copy of a title sits in the
  opening tenth of the book — that is the listing, and the last one is the chapter. A title
  repeating deeper in (the roman numerals across a poetry collection) is left alone.
- `Credits:`/`Language:` label lines and `*** START OF THE PROJECT GUTENBERG EBOOK ***`
  markers are rejected.

### Measured over nine real books

Gutenberg TXT, fetched through the mirror `free-books.js` already defines. "junk" is a
detection that is a piece of prose rather than a heading, counted mechanically.

| book | words | before | junk | after | junk | ~real chapters |
|---|---:|---:|---:|---:|---:|---:|
| dhammapada | 15,247 | 60 | 0 | 38 | 0 | 26 |
| grimms | 104,156 | 140 | 3 | 78 | 0 | 62 |
| little women | 189,143 | 190 | 8 | 55 | 0 | 47 |
| looking backward | 80,897 | 45 | 8 | 33 | 0 | 28 |
| lyrical ballads | 31,468 | 19 | 5 | 68 | 0 | — |
| self help | 142,731 | 41 | 5 | 22 | 0 | 13 |
| tale of two cities | 138,931 | 130 | 2 | 55 | 0 | 45 |
| treasure island | 71,668 | 78 | 1 | 50 | 0 | 34 |
| **wealth of nations** | 384,153 | **207** | **99** | **67** | **0** | **65** |
| **total** | | **910** | **131** | **466** | **0** | |

**Zero prose fragments across all nine books**, and on *Wealth of Nations* — the book the
bug was reported on — **not one `CHAPTER`-opening paragraph is missed**. Counts sit above
the chapter count because books, parts and front matter are indexed too, which is what an
index should do.

**Verification.** A 17-assertion fixture suite covers what Gutenberg TXT cannot: Devanagari
(keyword and keyword-less), DOCX, a heading wrapped across two lines arriving as one entry,
the reported `part of the produce…` regression, output shape, empty input and contents-page
duplicates. The Latin corpus was cross-checked title-for-title against an independent Python
port — nine books, exact match — to confirm the port carried no drift.

**One JS-specific defect the port surfaced:** `\b` in a JavaScript regex is ASCII-only and
never matches against a Devanagari letter, so `/^(अध्याय|भाग)\b/` is dead code. Python's
`\b` is Unicode-aware, which is why the two agreed on every Latin book and silently diverged
on Hindi. It is a lookahead now. **Worth remembering for any future Devanagari regex in this
codebase** (§17).

**Device run owed:** a PDF, a DOCX and a Devanagari book — the three the TXT corpus cannot
reach — plus a tap through the index to confirm each entry lands on its heading.

**No longer deferred behind this:** headings styled as headings inside Page mode shipped the
same day, once the detector was quiet enough to style from — Task 16.15 below.

---

## Task 16.15 — Chapter headings styled as headings in Page mode  ✅ code complete, device run owed

**Asked for** after 16.14 landed, having been deliberately held behind it: styling off a
detector that returned 207 chapters for a 65-chapter book would have put headings in the
middle of paragraphs.

Page mode had no notion of a heading — a chapter title was body text with spaces around it,
which is what made *Wealth of Nations* read as an unbroken slab even after paragraphs came
back.

**How it works.** `AppState.chapters` gives a word index per heading and `_paraStarts` gives
where that paragraph ends, so a heading is a word **range**. `_wordsHtml` wraps that range in
a block — and it is the *same* `_wordsHtml` the measurement pass uses (§5.1 rule 4), so the
vertical space a heading takes is space the pagination has already counted. There is no second
markup path, which is the one thing that would let pages overflow.

Sizes are in `em` so the font-scale setting carries them. Depth 1 (a Book or Part) takes
`--accent`; everything below stays body colour, because four tinted sizes would be louder than
the §16 calm this screen holds. A heading takes neither the paragraph break nor the 1.5em
indent — it is already a block, and a printed book does not indent its headings.

**Two things that needed deciding rather than coding:**

- **A heading may not be stranded at the foot of a page.** A heading alone at the bottom with
  the text it introduces overleaf is worse than no styling at all, so a page that would end
  inside a heading — or on its last word with nothing after it — pulls the whole heading to
  the next page. The pullback only ever moves *backwards*, and never past the start of the
  page being closed: that is what keeps a page from coming out empty and what stops the
  measuring loop from re-pulling the same heading forever.
- **The stored page grid is now v3.** Headings move every page boundary in the book exactly as
  paragraphs did, so a v2 grid describes a layout that no longer exists. Bumping the version
  is not optional housekeeping here — without it the first open after this change restores a
  grid measured for unstyled text.

**Verification.** An 11-assertion headless suite over a 44-chapter, 13,764-word synthetic book
whose body lengths creep by chapter, so headings land at essentially every vertical offset a
page has. It checks that headings render as blocks, are never indented, never produce an empty
wrapper, carry the right depth class, that **no page overflows and no heading is orphaned** —
and that **the pullback actually engaged**, since "no orphans" is otherwise true of a rule that
never fires. The 16.12 and 16.13 suites still pass unchanged (40/40, 13/13), and the real
*Wealth of Nations* paginates to 2,498 pages with 67 chapters.

**Cost of the new work, measured:** one `_headingAt` binary search per word is **6.2ms across
all 384,153 words** of *Wealth of Nations*, and `detectChapters` on that book is **91ms**, once
per file open in `renderReader` rather than per page. Both are well inside §21's 200ms
loading-state threshold and neither is in the swipe path.

**Device run owed:** a long book with real chapters, confirming headings look right at both
font scales, that none sits alone at the foot of a page, and that a Devanagari book's headings
render in Noto Sans Devanagari without clipping the taller glyphs at the larger sizes.

---

## Task 16.16 — Free Books titles use their catalogue cover on the share card  ✅ code complete, device run owed

**Asked for:** "if it is from free library, it should show the cover image in the share card, if
their own document, maybe use default we already using."

The catalogue has carried a `coverImage` URL per book all along — the library screen displays
it — but the share card never saw it. It rendered page one of a PDF, or a typographic cover
from the title's initials. For the **101 TXT titles of 150** there is no page one to render, so
every Gutenberg book shared as initials in a box.

**§15 said "never a fetched image", and that clause is now narrower rather than gone.** The
part that mattered was that the card must work offline — it is drawn when someone finishes a
book, not when they have signal. So the cover is fetched at **download** time, when the device
is online by definition, and stored in the on-disk cache `BookCover` already keeps. By the time
a card is drawn the artwork is a data URL on disk and `get()` finds it before it would think
about rendering a PDF page. **`share-stats.js` was not touched at all** — the artwork arrives
through the cache it already reads, which is why this was a small change rather than a new path
through the card.

`BookCover.cacheRemote(fileId, urls)` does the work: fetch → blob → data URL → decode →
downscale to the existing 640px target → JPEG. Reading the bytes into a data URL first is what
keeps the canvas same-origin, so `toDataURL()` cannot be tainted; pointing an `<img>` at the
remote URL would have failed on exactly the hosts that matter. CORS is not an issue because
`CapacitorHttp` is enabled and patches `fetch` through native HTTP.

**It is self-validating.** Unless the bytes decode into an image, nothing is written and the
cover falls back to whatever it would have been — so an old WebView that cannot read AVIF (the
format several catalogue covers use) shows the typographic cover rather than a gap. It takes
the same mirror order the list already works out for a Gutenberg outage, and it is
fire-and-forget: it never delays opening the book and never surfaces an error, because a
missing cover is not worth a word to the reader (§1.5).

**Precedence:** a catalogue cover wins over page one for a Free Books PDF, but an
already-cached page one is never replaced — that is a cover of the real edition, and
re-fetching on every library visit would be churn in exchange for a thumbnail.

**Backfill.** Books downloaded before this change have no cover and the share card cannot go
and get one. The Free Books screen is the one place the reader is both looking at the catalogue
and online, so it fills the gap there, for the titles they actually downloaded rather than all
150.

**One real bug this surfaced**, caught by the test rather than on device: the re-fetch guard
read only the on-disk flag, which is set after `_writeCache` succeeds. On a device with no
writable Filesystem or a full one, every Free Books visit would have re-fetched every cover it
already held in memory. The guard now also honours the in-memory cover and a per-session
attempted set, so it is correct whether or not the write worked.

**Legal note.** These are the same third-party images the library screen already displays,
cached on the user's own device — §13.2's hosting/linking distinction holds and this is not
re-hosting. If a cover's licence is ever challenged the answer is to drop that `coverImage`
from the catalogue, which costs the placeholder and nothing else.

**Verification.** A 15-assertion headless suite: a cover is fetched, downscaled, stored as JPEG
and decodes; aspect ratio survives; a large cover is capped at 640px and stays well under a
megabyte; **non-image bytes and a 404 are both refused and cache nothing**; the mirror fallback
works; and an existing cover is never re-fetched or replaced.

**Device run owed:** download a Free Books TXT and a PDF, share each, and confirm the real
cover appears — and that an AVIF cover either appears or falls back cleanly on the test device.

---

## Task 16.17 — Reaching the last page in Page mode marks the book read  ✅ code complete, device run owed

**Reported:** "In Page mode, if I am at last page, it is not registering that the book is
completed. I have to get out of the page mode to home page and mark that book read manually."

Confirmed. **Completion is derived, not stored:** `isFileFullyRead()` asks
`loadPosition(id) >= item.wordCount`, and the Mark read button just writes `wordCount` as the
position. So "finished" has to be expressed as a position — which RSVP's `_handleEnd` has
always done by saving `_words.length`. Page mode had no equivalent, so the last page saved the
last page's `startIndex` and the book stayed unread forever.

Turning to the last page now saves `_words.length`, the same number RSVP writes. Three things
it had to respect, and they are what took the thought rather than the code:

- **`_index` stays the honest word the reader is on**, because the §7 bridge reads it. The end
  is a *floor* every save is lifted to, not a value forced into `_index`. All three save sites
  in the engine now go through one `_savePos()`, so the floor cannot be undone by whichever of
  pause / seek / turn happens to fire last — which it would have been, since `pause()` ran on
  the way out and wrote the raw `_index`.
- **It has to be the last page of the *book*, not of the grid.** During the background pass
  `_pages` covers one slab and its final entry is nowhere near the end (§5.1 rule 3), so the
  check is gated on `_pagesExact`. Ungated, a long book would be declared finished a few pages
  in. A reader who reaches the end while the grid is still estimating is re-checked the moment
  it becomes exact.
- **Turning away clears the floor**, so the position is the position again (§21).

**The consequence to know about:** a book un-marks itself if the reader pages back from the
end. That is not a workaround, it is forced — completion and position are the same number, so
they cannot be made to disagree. It is also exactly what already happens if you seek backwards
after finishing in RSVP, and Mark read is still there for anyone who wants it to stick. Fixing
it properly means storing completion as its own field, which is a larger change to
`isFileFullyRead` and every caller; **not done, and worth doing if this annoys anyone.**

A fresh open never marks a book, even resuming on the last page — only a deliberate turn
counts, so opening a book does not silently move it to Read. The cost: a book whose whole text
fits on one page can never be completed by reading it, because there is no page to turn. Mark
read covers that.

A toast confirms it (`reader.page.finished`, both languages, §17) so the reader can see it
registered rather than having to go and check.

**Verification.** A 15-assertion headless suite over a 22-page book: not marked on open; marked
on reaching the last page with exactly one toast; survives `pause()` and `destroy()`; paging
back restores the real position and un-marks; returning re-marks without a second toast for the
same page; and reopening resumes on the last page, still marked, with no toast.

**Device run owed:** read to the end of a real book in Page mode and confirm the home screen
moves it to Read without leaving the reader, and that a finished book reopens on its last page.

---

---

## Task 16.24 — Rotating feature-discovery tips  ✅ code complete, device run + Hindi owed

**Asked for (owner, 2026-11-20):** tell the user about features in the nudge — bring your own
PDF, how the dictionary works, the bridge when the last book is a PDF — "and we keep rotating
all such features which we are unable to show anywhere."

The diagnosis is right: onboarding ends in the Free Books library by design (§10.1), so a user
can read for weeks without learning that their own PDFs open, that a long-press looks a word up,
or that a PDF can be read against its real pages. The nudge is the one screen a target user sees
repeatedly.

**Two surfaces, and the one place it deliberately does not go.** Not on the nudge screen itself:
that screen has two actions that are deliberate peers, and a third thing to read — worse, to tap
— makes the escape hatch one of three, which is §9.1's failure mode. So: a line in the **nudge
unlock modal**, where the threshold is already met and the user has just succeeded, and a
**one-line strip on home**, directly above the import grid, which is what most of the tips point
at.

The strip is not a card. `#nudge-setup-prompt` is a card because it is a pending decision; a tip
built the same way sits there looking like an unanswered to-do, which is the §1.6 nagging. A
single `--surface-2` row with a `×` that retires that tip, suppressed while the setup card is
showing and until the library has a book in it.

**What governs which tip:**

| | |
|---|---|
| Relevance | `when()` per tip — import disappears once a non-catalogue book is in the library, bridge needs the last book to be a PDF, scan needs Pro |
| Cap | 3 shows, acted on or not |
| Retire on action | `TipsFeature.markDone()`, called from `dictionary.js` and `bridge.js` — not from the strip |
| Rotation | round-robin from a stored cursor, one tip per calendar day on home, the same one all day |
| Tappable | home only, and the tap does the thing; inert text in the unlock modal |
| Truncation | none, anywhere — both surfaces wrap (owner, 2026-11-20) |

13 tips in `en.json` and `hi.json` (§17). **The import tip names PDF, not DOCX/TXT**, and the
scan tip is gated on Pro: DOCX, TXT and Scan are Pro (§4), and a tip for something the user
cannot do is an advert, which §4 rules out.

**That rule found a real bug, and it is fixed.** `DictionaryFeature.showDictionaryModal()` gated
the lookup on `AppState.isPro` and sent every free user to a paywall, while §4 has listed the
dictionary under the free tier since the pivot's pricing was settled. It had been shipping
unnoticed because nothing in the UI advertised the feature to the users it was withheld from.
**The gate was the bug, not the table** (owner, 2026-11-20): `_showProGate` is gone, the tip
carries no Pro gate, and the limitations copy no longer says "Pro tier dictionary" in either
language (§1.5). The online-lookup fallback that gate offered is still reachable from the
dictionary modal's own button and from the word-tap setting, so nothing was lost with it.

**No analytics event.** `tip_shown` was considered and deliberately not added to §9.6's
allowlist — it is closed so a caller cannot quietly widen collection, and retirement-on-action
already shows in `import_completed` / `book_opened`. Owner's call to revisit.

**Verification.** A 22-assertion headless suite over the selection logic: both surfaces are
exposed; the day's home pick is sticky and counted once rather than per render; a dismissed tip
is retired and no replacement arrives the same day; no tip exceeds three shows across 80
simulated days while the rotation still reaches most of the pool and never repeats on
consecutive days; the pool exhausts rather than looping; the import tip appears when every book
came from the catalogue and vanishes when one did not; bridge is withheld when the last book is a
TXT; scan is withheld from a free user and offered to Pro while **the dictionary tip reaches both
tiers**; `markDone` retires a tip for good; tappable tips expose a callable `go()`; a tip missing
from the active locale is skipped rather than rendered as its key name; a gate that throws takes
out its own tip rather than the pool; and the unlock pick never repeats the day's home tip.

**Device run owed:**
- The strip at Hindi line lengths on a narrow screen — it now wraps, so check two and three
  lines look deliberate rather than broken, and that the `×` divider spans the taller row.
- A tap that actually opens the file picker, and the `×`.
- The unlock-modal line under a real credit sentence: that it does not crowd the two buttons, and
  that a long Hindi tip wrapping does not push them off a short screen.
- **A free account looking a word up** — the Pro gate is gone, so confirm the definition modal
  opens and the 82k dictionary loads without a purchase.

---

---

## Task 16.25 — Paywall placement  ✅ code complete, device run + Hindi owed

**Asked for (owner, 2026-11-20):** "We want to place it the time it need… We do not shy away from
showing off pro benefits, but not do it unnecessarily and certainly not nagging."

**The audit.** Eight placements existed, all routing to the one `showPaywall()` modal with a
`source`: `url-reader`, `docx-import`, `txt-import`, `dashboard`, `image-scan`, `scanned-pdf`,
`share`, `nudge-apps`. **Every one of them was reactive** — fired by bumping into a wall. Four
things came out of that, all shipped on this branch.

**1. There was no way to decide to pay.** Nothing in Settings, home or the dashboard offered an
upgrade; Settings had Restore purchases, which to someone who has never bought reads as a dead
end. So a user who had read four books and wanted to pay could not find the paywall without
triggering a feature they did not want — and §1.3's "prominently offered and genuinely
purchasable" cannot hold when the only route is an accident. Added as **one button at the top of
Settings, only for a user who has not paid** — *Unlock the full power of FlowRead* —
`source: 'settings'`. Not on home, not a banner.

It first shipped with a heading, a benefits line and a price note. **Cut to the button alone on
the owner's call the same day:** all three repeat what the paywall modal says one tap later, on a
screen that is already too long. The keeper is in §24 — a purchase entry point names itself and
gets out of the way; the pitch belongs in the paywall, once.

**2. Locked font and theme chips did nothing when tapped.** They were rendered `disabled` with a
🔒, so a tap on the exact thing the user wanted was a silent failure (§1.5) *and* the
best-timed paywall in the app thrown away. Now tappable, still refuse to apply the setting, and
open the paywall — `source: 'font'` / `'theme'`. The `:disabled` CSS went with it, or a tappable
chip would still show a not-allowed cursor.

**3. The device-sync sheet's "DOCX and TXT require Pro" was inert text** under a list of the
user's own files that would not open. Now a button with a quiet CTA — `source: 'device-sync'` —
and it closes the sheet first, since §21 allows one modal at a time.

**4. The dashboard answered a tap with a modal**, so nobody ever saw what they would be buying.
`renderDashboard({ locked })` now opens the real screen with the user's **own** KPI figures and
one card where the charts would be, naming the four things Pro adds. Nothing is fabricated — a
preview with invented numbers is the silent lie §1.5 forbids, so the tiles are real and the
withheld parts are *named* rather than blurred. `paywall_shown` fires on the card's button, not
on arrival, so the event keeps meaning "was offered a price". `reader.js`'s back-path call passes
`{ locked: !AppState.isPro }` too — reachable by a lapsed subscriber who opened a book from the
dashboard while it was still unlocked.

**Where a paywall deliberately does not go**, and this is the half of the audit worth keeping:
the nudge screen and its unlock modal (§9.1 — the escape hatch may never share a screen with a
price), book completion and streak milestones (§15's share prompt owns that moment, and §22 says
distribution beats monetisation here), the Free Books catalogue (§4 gives it away), and reading
itself. `Claude.md` §24 records all of it.

**Verification.** A 16-assertion headless render of both dashboard states: a free user gets the
KPI grid with real figures, the lock card and the share button, and **no** WPM chart, heatmap,
completion-by-type or library grid; a Pro user gets all four and no lock card; a free user with no
sessions at all still renders rather than throwing. Both locales symmetric at 649 keys.

**Device run owed:**
- Settings as a free user: the Unlock section is there, and **absent** once anything is bought.
- Tap a locked theme and a locked font chip — paywall opens, and the theme does *not* change
  underneath it.
- The dashboard preview on a real account with real history: that the KPI numbers are right and
  the lock card reads as part of the screen rather than an ad.
- The sync sheet note, which needs a device with a non-PDF in a scanned folder.
- Hindi on all four — the Settings body line and `dashboard.locked.*` are the long ones.

---

---

## Task 16.26 — Debug flag: simulate the free tier  ✅ code complete, device run owed

**Why.** §24's free-tier surfaces were untestable on the owner's device: the account owns
`pro_lifetime`, `refreshEntitlements()` asks Play every launch, and a one-time purchase is owned
forever — so clearing app storage re-granted Pro within a second of boot. Desktop browser, a
second Google account, and refunding the order were all ruled out by the owner.

**Settings → Debug → Simulate the free tier.** Every gate (`hasProAccess`, `hasLifetime`,
`hasSubscription`, `hasOcrAccess`) answers free while it is on; toggling re-derives the gate and
redraws Settings, so the §24 Unlock section appears and the appearance chips re-lock in place.

**It cannot ship, and that is structural rather than procedural.** `window.Capacitor.DEBUG` is
injected by Capacitor from `FLAG_DEBUGGABLE` before the page loads, so the section cannot render
in a release build; `debugForcedFree()` checks the build before the key, so a stray
`fr_debug_force_free` is inert in production; and Play refuses a debuggable upload anyway.
**No native change was needed** — the value was already there, which also avoided the
`git add -f` trap on `android/`.

**It can only withhold, never grant** — which is why it is "simulate free" and not "simulate
pro". A granting toggle would be an unlock vector; the developer's real purchase supplies the
other half of the matrix. The worst case if it ever escaped is a paying user whose features are
hidden, which is visible and reversible.

`Claude.md` §25 carries the release check the owner asked for, plus the reasoning for why the
check is the backstop and not the mechanism — §3's missed deadline is the precedent for not
trusting a checklist alone. §21's stop-and-ask list now points at it.

**Verification.** A 16-assertion headless suite over the accessors: with the flag on, all four
gates read free (including OCR for an `ocr_vision` owner) and the `AppState` flags mirror it; with
it off, real entitlements are untouched; in a simulated release build the flag is inert, the
setter writes nothing, and `isDebugBuild()`/`debugForcedFree()` are both false; and a user who
owns nothing stays free either way, so the flag can never grant.

**Device run owed:** install the debug variant (Android Studio ▶ installs `debug` by default —
check the Build Variants panel), confirm the Debug section is present, toggle it and walk the four
§24 surfaces, then toggle back and confirm Pro returns without a restart.

---

## Task 16.30 — Engine order: Page first  ✅ code complete, device run owed

**Why.** RSVP leading the row is a leftover from the pre-pivot identity (§0.1), when speed reading
*was* the product. 16.13 made Page mode the default engine and §9.5 sends every nudged read there,
so the first tab is now the one thing a reader is least likely to want first. Page moves to the
front and the rest shift; nothing else about the engines changes.

**Two sites, both listing Page last:**
- `www/js/views/reader.js:71–75` — the `.engine-tab` buttons.
- `www/js/views/settings.js:349–353` — the default-mode `<select>`.

**Seven stale pre-pivot fallbacks, not the one originally flagged.** `settings.js:73` has
`defaultMode: 'page'`, so every `|| 'rsvp'` downstream contradicts the shipped default and only
fires when settings are missing entirely — a fresh install mid-boot, or a corrupt settings blob.
All now read `page`:
- `reader.js:32` — the saved-engine chain
- `reader.js:131` — `_engineMap[...] || RSVPEngine` → `PageEngine`
- `reader.js:733` — the engine the cancel button returns to
- `app.js:58` — boot
- `share-handler.js:147` — a URL shared in from another app
- `state.js:19`, `state.js:23` — `currentEngine` / `lastReaderEngine` initial values

Fixing one of seven would have been worse than fixing none: they are the same defect, and the
remaining six would each have been found again separately.

**The position check cleared.** Every dispatch is by `dataset.engine`, `qsa('.engine-tab')` is only
ever iterated (no index access anywhere), `.engine-tab` is `flex: 1` so all five share width
equally and the row cannot overflow, and `fr_last_engine` / §9.5's `forceEngine` work by name. No
other file references engine order. Engine names stay Roman in both locales (§17), so no i18n
change.

**Device run owed:** open a book and confirm Page is the leftmost tab and is the active one;
switch to RSVP, leave, reopen, and confirm it resumes in RSVP (the reorder must not disturb
`fr_last_engine`); check Settings' default-mode dropdown lists Page first with the right option
selected.

---

## Task 16.31 — Saved words, and the dictionary's real defect  ✅ merged to master 2026-11-20

The investment phase taken at its cheapest point first. Every word looked up is kept, grouped by
the book it was met in, on a Words screen with its count on a home row. Chosen ahead of highlights
because it needed no gesture decision, no text selection and no new storage model — and because it
works in RSVP and Chunk, where there is nothing on screen to select.

**The dictionary was never missing vocabulary.** Reported as "missing a lot of words, even simple
ones"; the asset holds **82,559 entries**, essentially all of WordNet's lemma space. `lookupWord()`
did an exact key match, so every *inflected* form missed — `books`, `went`, `houses`, `walked`,
`children`, `cities`, `women`, `taught` all reported nothing while `book`, `go` and `child` sat in
the file. Ten of eighteen ordinary words tested. `features/morphology.js` is WordNet's own answer
(Morphy): the word as given, then an irregular table, then suffix rules, first dictionary hit wins.
The same 46-word sample goes 36 → 43; the three that still miss are `the`, `of` and `and`, which
WordNet has no entry for at all.

**Found in testing, and silent:** with the `-es` rule ahead of the bare `-s`, `castes` resolved to
`cast`, `notes` to `not` and `rates` to `rat` — each returning a real definition for the wrong word.
One letter before two. See `Claude.md` §26.2.

**Also fixed:** a Devanagari long-press produced no modal, no message and no response at all, while
§22's tip was telling Hindi readers the feature existed. It now names the limitation and still
offers Google.

**Removed:** the dead `engines/highlight.js` — a 130-line "Guided Highlighting Engine" never loaded
by `index.html` and referenced nowhere, plus its 29 lines of CSS.

---

## Task 16.29 — Highlights: the investment phase  ✅ merged to master 2026-11-20

Built 2026-11-20, two device passes, merged the same day. `Claude.md` §26.3 holds the rules;
`docs/Design-notes.md` §26 holds the reasoning. The four open decisions this entry used to list
were all closed:

1. **The gesture — tap the first word, tap the last.** Native selection is not used. The conflict
   is three-way, not the two-way one first assumed: `user-select: none` is global on `body`,
   `word-tap.js` owns long-press, and **Page mode's horizontal drag is the page turn**, in the
   default engine where every nudged read lands. The §6 Normal view is canvas with no text layer,
   so there is nothing there to select at all.
2. **Highlights, no notes** (owner) — which removes the text input and the keyboard from the
   reader. The data model keeps room for a note field without showing one. §1.5 is satisfied
   without a second model to explain: **in RSVP and Chunk the same button marks the sentence the
   reader is on**, bounded by the punctuation those engines already pause on.
3. **Storage — one `localStorage` key per book**, so a reader with forty books does not parse
   thirty-nine to draw one page. A highlight is **two word indices**, which is what carries it
   across a page turn mid-highlight, §4.1 rule 3's renumber, a font-scale change and a different
   screen. The stored text beside them is a cache for the card and the lists; if the two ever
   disagree, the indices win. **They survive a delete and re-import of the same book** (owner) —
   `generateFileId()` is content-derived, so they return by themselves.
4. **Notifications — not used.** A highlight is the one thing here that gives a notification
   something true and specific to say, which is exactly how it becomes nagging. §10's discipline
   applies if it is ever revisited.

**Three defects testing caught before the first device pass:** Page's capture listener died with
its shell and had to be cleared in `_createShell`; the promised Undo was only a `showToast()`,
which carries no action, until the bar grew a second state; and the share card's quote budget had
to charge for the book title, or a long one pushed the attribution off the card entirely.

**Device pass 1 — three findings.** The index panel's highlights section was an uncapped flex item,
and a flex item will not shrink below its content, so the search field and the whole chapter index
were pushed past the panel's bottom edge where nothing could reach them. The library count went
onto the two *row* render paths and neither *card* path, so it was invisible to exactly the users
who have Pro. And the owner **reversed "no global highlights screen"**: there is one, grouped by
book, and tapping a quote opens that book at that word through a new `startIndex` on
`resumeFromLibrary` that must beat the completed-book reset to word zero.

**Device pass 2 — the button.** U+25AE read as a pipe or a stop button, and the tip copy already
said "tap the highlighter". Unicode has none, so it is drawn — inline SVG, the approach
`_searchGlyph()` already uses. Added `tip.highlights_screen`, because the existing tip teaches the
gesture and has no destination, so nothing revealed the new screen.

**Still owed: Hindi sign-off on 38 keys** across this branch — not 21, which counted only the
later batches and forgot the saved-words, dictionary and debug strings. All 38 are present in both
files, so nothing renders raw today; what is owed is a read of the drafted Hindi, not a repair.

**Caught while listing them:** `highlights.empty.body` told the reader to "tap the ▮ button", in
both languages, and the icon had just stopped being that character. Copy names the control, never
the glyph.

---

## Task 16.28 — Share moments  ✅ code complete, device run + Hindi owed

**Three reports, three separate causes.**

**1. "Too many choices."** The sheet rendered up to **7 hero radios** (`finished.slice(0, 5)` plus
streak plus words) **and 4 checkboxes** — eleven controls to post one image, asking the user to
re-decide what §15 already ranks. It now opens on the composed card with the best hero chosen and
two supporting lines ticked, behind a single **"Change what's on it"** that removes itself once
used. Book heroes capped 5 → 2. A new user sees 3 rows when expanded, someone with real history 6.

**2. "I get the share prompt the next time I open the app."** Two causes.
- `checkMilestones()` is called from `renderUpload()` alone, and a book opened from the **Free
  Books library** returns to *that* screen — so the celebration queued until the user next landed
  on home, i.e. their next launch. **It reproduced on catalogue books and worked correctly on
  imported ones**, which is why it looked arbitrary. Both off-home return paths now check.
- More fundamentally the prompt was in the wrong place. All five engines already mark completion
  (`_handleEnd()` saves `_words.length`; Page mode's `_noteEndReached()` sets the floor), so the
  four playback engines ask *there* now — the end is proven. Page mode gets a tappable offer at the
  foot of the last page instead, per the owner: arriving is not reading, and the time that page
  takes is unknowable. `Claude.md` §15 carries the rule.

**3. Recaps.** Three windows — last 7 days, last 30 days, **this year**. Gated on substance (a
finished book, 3+ days, or an hour), which drops all three for a two-day-old install and keeps them
for anyone with a history. At most two offered, and
**deduped on the figures, not the rendered text**: early on every window holds the same reading, so
a thin-data user was shown "1,200 words in the last 7 days" and "1,200 words this year", one card
with two captions. Books-finished-in-window is inferred from the last session on a finished book,
since §5.2 makes completion a position and there is no finish event to stamp — a re-read moves it,
which is noted in the code rather than papered over.

**4-0. The collage was unreachable, and the editor could not be closed.** Both reported from use
after the first cut.
- Multi-cover only existed on a *recap* hero, and the all-time "4 books finished" figure was a
  supporting line with no hero — so a reader who finished four books saw the sentence in small grey
  type and could only make the card about one of them. There is now an all-time `finished` hero
  with the collage, available the moment two books are done. **One hero per book count, narrowest
  window winning**: my first dedupe kept display order and so dropped "Finished 4 books in the last
  7 days" in favour of "Finished 4 books with FlowRead", which is the weaker sentence — the window
  is the better claim when the counts tie.
- `hero.bookList` is normalised to the top level, because `_coversFor`/`_coverPool` were reaching
  into `hero.recap` and would have broken on the new hero.
- The "Change what's on it" toggle hid itself on open, leaving no way back to the card — and on a
  phone the open editor pushes the preview off screen, which is precisely when collapsing is
  wanted. Two states now, never removed.

**4a. Coverless books, and who actually has them.** The owner's correction: every catalogue entry
has a `coverImage` — **150 of 150, including all 127 TXT titles** — cached at download, so only a
self-imported DOCX or TXT lacks artwork. The comments justifying the collage fallback with "two
thirds of the catalogue is TXT" were repeating §15's pre-catalogue-cover framing and are corrected.
A multi-book card now **prefers books with artwork and drops the rest**, which was asked for as a
toggle and built as a rule: nobody would switch such a toggle *on*, so it was a defect with a
workaround attached. None with artwork → a clean text card. Single-book heroes keep their initials.

**4b. The cover picker, and the bug that paid for it.** `drawCard` drops the supporting lines in
collage mode while `_renderExtras` went on offering them — a §1.5 silent failure introduced two
commits earlier on this branch. That slot was dead in exactly the mode where a picker is wanted, so
the picker replaces it and costs no new group of controls; as a third group it would have been the
"too many choices" problem again. A fifth tick drops the longest-standing choice, visibly, rather
than being ignored or greyed.

**4. Covers for a multi-book card.** One book keeps the existing panel; two or three get a fan in
the same column; four or more get a collage — headline above a row of four tiles, supporting lines
dropped. Capped at four because the 616px band cannot hold two rows at a size where the covers are
recognisable, and gated on at least two real cover images because a grid of typographic initials is
not a collage. All of a card's covers now resolve in parallel against one absolute deadline;
sequentially, four 4-second races would hang the share button for sixteen seconds.

**5. The share text had no link.** `share.sheet.text` named the app and never said where to get it,
so every card reaching a non-user left them nowhere to go — in a feature §15 prioritised for reach,
in a product §22 calls distribution-bound. The Play URL is appended in code, not in the string, so
no translation can drop it. Tagline and share text reworded to first person, which invites a
question where a slogan does not. **The Hindi was drafted with a masculine verb** ("कर रहा हूँ") and
rewritten verbless — it is a sentence a stranger reads *about its author*, so it must not assume one.

**A §17 bug fixed on the way in:** all five engines called `showToast('Finished!')` with a
hardcoded English string, so a Hindi reader got English at the most significant moment the app has.
Now `t('reader.finished')`, and it only fires when the share offer does not.

**Verification.** Two headless harnesses. A recording canvas stub draws all seven cover layouts
and asserts every tile lands inside the panel and clear of the footer rule — **this is what caught
both geometry bugs**: the collage overflowing its band by 384px, and contained artwork shrinking its
own tile so a mixed collage came out with three tile widths and ragged gaps. And one over
`collectStats`/`_heroOptions`/`_extraOptions` across two
profiles (four finished books with sessions spread over 800 days; a two-day-old install) in both
locales. It caught the figure-dedupe problem above, and confirms window arithmetic (a session 800
days old is outside "this year", one 200 days old is inside), recap extras drawing from the same
window rather than lifetime totals, and the hero counts collapsing correctly on thin data.

**Device run owed:**
1. Finish a book in **RSVP** — the prompt must appear at the end of playback, not on the next launch.
2. Finish a book in **Page mode** — no modal; a "Finished it? Share it" line at the foot of the last
   page. Turn back a page and it goes; turn forward again and it returns.
3. Finish a **Free Books** book and back out to the library — the prompt must arrive there, which is
   the exact case that was broken.
4. Open the share sheet — one card, one "Change what's on it", two buttons. Expand it, then
   **collapse it again** and confirm the card is fully visible.
5. Finish four short books and share from home — the sheet must offer a single multi-book hero with
   four covers, phrased as the tightest window that holds them.
6. Pick a recap hero and confirm the supporting lines are window figures, not lifetime ones.
7. Hindi, narrow screen: the recap hero sentences are the longest strings on the card, and
   `.page-finish-share` is a single line with `text-overflow: ellipsis` — check it is not clipped.
8. **Import a DOCX or TXT of your own, finish it, and check the recap card** — that is the only
   way to get a coverless book now, and the drop-the-coverless rule is what needs seeing.
9. Finish 2, then 4 books and share each recap — the fan and then the collage. **Look at a collage
   on a device with a mix of PDF and TXT books**, which is where the tile frames and the
   two-real-images fallback actually get judged.
10. Share to one real app and confirm the Play link arrives with the image, and that the recipient's
   app shows both rather than silently dropping the text.

**Hindi owed:** 44 new strings drafted, same standing as 16.1/16.3/16.27.

---

## Task 16.27 — Variable reward on the unlock  ✅ code complete, device run + Hindi owed

**Why.** The unlock modal is the one moment the whole pivot aims at — the user was on their way
into Instagram and read instead — and it said the same two sentences every time. The nudge *screen*
already rotates six subtitles; the reward surface, which is where reinforcement actually has to
land, was a fixed string.

**`features/celebration.js`** (new) owns the pools, the counters and the tier decision; `nudge.js`
still draws the modal, as it does the §23 tip line. Wired into `index.html` after `tips.js`.

**Three things the modal gained:**
- **Rotating copy** — 8 titles and 8 plain-language benefit lines, plus a small DM Mono **receipt**
  carrying every figure (`4 pages · 6 min read · 15 min before I say anything`). The first cut put
  the figures in the sentence across five variants, and the owner read it straight away as "the
  same thing every time" — correctly: the numbers *are* the shape of that sentence, so rotating the
  words around them changes nothing perceptible. §9.2 wants the reset visible, not headlined. The
  `nudge.unlock.body_credit.*` keys are gone; `nudge.unlock.earned.1–8` and
  `nudge.unlock.receipt.one/.other` replace them, and §9.2's quoted example in `Claude.md` was
  amended to match before the code changed.
- **No pool repeats its previous pick** — random with the last choice excluded, remembered in
  storage. One time in eight is often enough to be noticed when a repeat is the exact complaint,
  and consecutive unlocks are usually separate sessions, so an in-memory guard would miss.
- **A measured count line, rotating across three phrasings** — *"that's 4 times this week you've
  picked the book first."* Withheld at one, where it reads as a system message, and on a milestone,
  whose headline makes a larger version of the same point.
- **A milestone tier** — 1/5/10/25/50/100/250 reads and day runs of 3/7/14/30, each granted once
  ever, carrying the only animation this feature draws.

**The design is variable *magnitude*** and `Claude.md` §26 is the authority on why. The short
version: rotating copy alone is a skin, and a user calibrates to a uniformly-sized reward inside a
week however many skins it has.

**Counters are derived, never stored beside the data.** `fr_nudge_reads` is an append-only list of
dates (capped at 400); total, week and day run are computed from it — the `computeStreak()`
discipline, and for the same reason. The week is **Monday-to-today**, because the copy says "this
week" and a rolling seven days makes that false six days out of seven. `NudgeGate`'s own counters
could not be reused: they are per-day and wipe at local midnight by design (§9.3).

**A bug found on the way in, fixed:** `.nudge-unlock-tip` in `components.css` was missing its
closing brace (from `cce6525`, 16.24), so CSS error recovery swallowed the whole
`.dashboard-locked-list` rule — 16.25's dashboard preview list has been shipping unstyled on this
branch. Braces now balance across the file.

**Verification.** A headless harness over `forUnlock()` against both locales: 12 consecutive
unlocks show the tier sequence (milestone at 1, 5, 10, quiet between), the variant cursor rotating
bloom → sweep → ring, and the count line incrementing; a backfilled two-day history confirms the
day-run milestone fires at 3 and that the count milestone it outranks is left unspent rather than
lost. **This caught a real defect:** the body pool collapsed to a single variant, because its keys
are pluralised (`.2.one`/`.2.other`) and the existence probe tested the bare stem — silently, and
in both locales. `_pool()` now takes the probe suffix. en/hi key sets verified identical (679 each).

**Device run owed:**
1. Complete a nudge-read on a fresh install — first unlock must be the `total.1` milestone, with
   the bloom variant and the accent headline.
2. Complete three more in a day — quiet tier, a different title each time, count line reading 2, 3, 4.
3. Reach 5 — milestone with the **sweep** variant (the cursor advances only on milestones).
4. Check the animation reads as calm at §16's intent, on a real panel rather than a desktop monitor.
5. Read four quiet unlocks in a row and confirm the modal does not read as repetitive — that is
   the whole point of the task, and the only judge is a person seeing it at the real cadence.
6. Switch to Hindi and repeat 1–2 on a narrow screen — the Devanagari lines are longer and the
   count line sits between the body and the tip, so it is the row most likely to crowd.
7. Turn on system "Remove animations" and confirm a milestone still reads as one (headline + colour,
   no motion).

**Hindi owed:** 28 new strings drafted rather than left as key names, same standing as 16.1/16.3 —
`i18n.js` has no English fallback, so a missing key renders the raw key to a Hindi user. Owner
replacements welcome.

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

**D — Monthly drops. Mechanic revised 2026-11-17: a choice of one from ten, subscribers only.**

**What changed and why.** Q4 answered "3 books per month, rotating". The owner's revision is that
a subscriber is shown **ten curated books each month and claims one of them**. Free users get
**nothing new** — they already have the whole 150-book catalogue (§4), and the drops stay the one
thing the subscription buys. Choosing is the point: a book someone picked is a book they meant to
read, where three handed over is a list.

- [ ] `catalog.json` gains **`dropMonth`** (e.g. `"2026-12"`), **`dropChoices`** (ten ids) and
      nothing else. The ten are ordinary `books[]` entries; `dropChoices` only names them.
- [ ] **`dropMonth` is the authority on what month it is — never the device clock.** The claim key
      is `fr_drop_claim_<dropMonth>`. Three things fall out of that and all three matter: rotation
      becomes purely an owner edit, with no scheduler and no calendar in the file; the device clock
      is irrelevant, so there is no clock-change exploit and no timezone edge; and being late with
      an edit breaks nothing — last month's set stays claimable, which is strictly better than a
      month with no drop.
- [ ] **The ten need not all be new.** `books[]` is never pruned, so a month's ten can be the three
      newly added plus seven carried from earlier months that this subscriber did not claim. That
      holds curation at Q4's **three new books a month** instead of ten, which is the difference
      between 36 and 120 sourced-and-licence-checked books a year (§13.2) and is the thing most
      likely to kill this task if got wrong.
- [ ] **A failed download must not burn the claim.** Write the claim only after the parse-and-save
      succeeds. One flaky connection otherwise costs a paying subscriber their month, silently
      (§1.5).
- [ ] **The claim is irreversible, so it has to be informed.** One confirm step naming the book,
      in plain language, before it is spent. Springing "that was your one pick" afterwards is the
      dark pattern §1.3 rules out; the confirm is not friction, it is the honesty.
- [ ] **Never unpublish a hosted file, and never delete from `books[]`.** A claimed book survives
      rotation because it is already on the device, but its library entry still resolves the URL
      for covers and any re-download.
- [ ] Gate on `AppState.isSubscriber` (16.1), **not** `isPro` — drops are the one thing §4 makes
      subscription-only, and `isPro` is true for lifetime owners since the 2026-11-01 decision.
- [ ] Reuses the existing download path wholesale: `_getSavedFileId`/`_setSavedFileId`, the
      pdf/txt branch, `_keepCover`, `free_book_downloaded`.
- [ ] **Decision owed — a `drop_claimed` event.** Adding to §9.6's allowlist is a product decision.
      Without it there is no way to tell whether subscribers claim at all, which is the single
      number that says whether this mechanic works.
- [ ] i18n both languages from day one (§17).

~~`drops` is a **flat array of 3 ids** in `catalog.json`~~ — superseded by the above.
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

## Task 16.18 — Reading plans (light / medium / hard)

**Status:** Open, not started · **Ref:** §1.5, §1.6, §9.5, §17 · **Size:** M
**Added 2026-11-17 (owner).** The user picks a reading plan — *light*, *medium*, *hard* — and the
app turns it into a daily page target (roughly 2 / 10 / 20 pages). Offered in onboarding, and
changeable later in Settings.

**Why it is worth building:** the app currently has no notion of *enough for today*. Streaks count
any reading at all, the daily reminder fires against a fixed internal threshold, and nothing tells
a reader what they were aiming for. A plan gives every other mechanic here — the streak, the
freeze, the reclaim, the reminder — one number to be about.

**Four constraints, each of which is a way to get this wrong:**

- [ ] **Pages are a display unit; the target has to be stored in words.** Every engine but Page
      counts words, and §9.5 already solved exactly this for the nudge unlock by converting at
      ~220 words/page. Reuse that constant rather than introducing a second one — two conversion
      factors that disagree would make the dashboard and the plan contradict each other.
- [ ] **The day's target is the sum of the day's sessions, not one session.** `_hasReadToday()`
      in `notifications.js` today asks whether *any single* session crossed
      `DAILY_WORDS_THRESHOLD`, so six short sessions can add to more than the threshold and still
      read as "has not read". That is tolerable for a reminder and wrong for a plan, where a
      reader who met their target in pieces must be told they met it.
- [ ] **Changing the plan must not rewrite history.** Yesterday was met or not against the plan in
      force then. A reader who moves from light to hard has not retroactively failed a week, and
      showing that they did is the guilt §1.6 rules out. Store the target alongside the day, or
      evaluate days against the plan active on that date.
- [ ] **The streak definition does not change.** It stays "read at all", derived by
      `computeStreak()` (below). Making the streak goal-based would break the streak of every
      existing user who reads a little each day the moment they pick a plan — a punishment for
      upgrading. The plan shows *progress toward today's target*; the streak stays about showing up.

**Open decisions**
- [ ] Exact page numbers per plan (2 / 10 / 20 are the owner's sketch, not signed off).
- [ ] Whether a plan is also offered as *minutes* — some readers think in time, and the session
      store already records `durationMs`. Likely a second plan type rather than a second unit on
      the same one.
- [ ] Where it sits in onboarding. §10.1 wants onboarding to end with the user reading, so a plan
      step must not become another screen between them and a book.
- [ ] A `plan_selected` event needs §9.6 allowlist approval if we want to know which plan people
      pick.

**Files:** `www/js/views/onboarding.js` · `www/js/views/settings.js` · `www/js/views/dashboard.js` ·
`www/js/storage.js` · `www/js/features/notifications.js` · `www/i18n/*.json`

---

## Task 16.19 — Streak freeze

**Status:** Open, not started · **Ref:** §1.6, §4, §14 · **Size:** M
**Added 2026-11-17 (owner).** A freeze protects a streak through a day with no reading. **When a
freeze is granted is the open question and the whole design.**

**The architectural constraint that shapes everything here.** `computeStreak()` is *derived* from
the session store and deliberately not stored — the comment says so: "so it can never drift out of
sync with it". A freeze is by definition a claim that a day counts when no session exists, which
derivation cannot express. Two ways out, and only one is acceptable:

- **Write a synthetic session for the frozen day — do not do this.** It would inflate words,
  minutes and page counts everywhere: the dashboard, the share card (§15), `read_session_ended`
  (§9.6). A freeze would quietly become reading that never happened.
- **Keep a separate set of credited dates** (`fr_streak_credits`) that `computeStreak()` consults
  alongside the session dates. The streak stays derived, nothing else is touched, and the credits
  are inspectable — which matters, because the user has to be able to see that a day was frozen
  rather than read (§1.5).

**Open decisions — the task is mostly these**
- [ ] **How a freeze is earned.** Options: granted on a cadence (one per N days read), banked by
      exceeding the plan (16.18), a fixed small allowance per month, or a subscriber benefit.
- [ ] **Is it a subscription perk?** §4's value stack is closed — "do not add scope beyond this
      without asking" — so this is explicitly a decision, not an assumption. It cuts both ways:
      the subscription needs recurring value (§4's accepted gap), and the free tier is meant to be
      genuinely generous. A middle path: everyone earns a small number by reading, subscribers
      earn them faster or hold more.
- [ ] **Never purchasable on its own.** A freeze bought with money, in the moment of losing a
      streak, is a pressure sale against an anxiety the app created. That is the dark pattern
      §1.3 forbids, whatever the price.
- [ ] **Automatic or manual?** Automatic is kind and invisible; manual respects that some people
      want to spend it deliberately. Automatic risks a user discovering they "had a streak" they
      did not feel they earned.
- [ ] Cap on how many can be held, and whether consecutive days can be frozen (they should not —
      a week of freezes is a fiction).
- [ ] Copy and tone (§1.6): no loss-aversion framing, no countdowns, no "don't lose your streak!".
      Interacts with the existing streak-protection notification (id 1002, §18).

**Files:** `www/js/storage.js` (`computeStreak`) · `www/js/views/dashboard.js` ·
`www/js/features/notifications.js` · `www/i18n/*.json`

---

## Task 16.20 — Reclaim a lost streak by reading more

**Status:** Open, not started · **Ref:** §1.6, §9.2 step 8 · **Size:** M
**Added 2026-11-17 (owner).** A streak broken by a missed day can be won back by reading extra —
the owner's sketch is ~10 pages beyond the plan. Shares `fr_streak_credits` with 16.19: a reclaim
credits the missed date, it does not fabricate a session.

**Why this one fits the product better than the freeze does.** §9.2 step 8 already establishes the
pattern — reading pays the clock back, and the unlock modal names what it cost and what it bought.
Reclaim is the same bargain: the only currency is reading. It is forgiving rather than punitive,
which is what §1.6 asks of every mechanic that touches a habit.

**Decisions owed**
- [ ] **How far back a reclaim reaches.** Recommend **only the single most recent missed day, and
      only on the following day.** Reclaiming a three-week gap makes the streak mean nothing, and
      a number that can be bought back indefinitely is not a record of anything.
- [ ] **The price in pages**, and whether it scales with the plan (16.18) or the streak's length.
      A fixed 10 pages is trivial for a *hard* reader and a fortnight's work for a *light* one, so
      it probably has to be expressed relative to the plan.
- [ ] **Once per missed day, and a limit on how often.** Otherwise a reader alternates miss and
      reclaim indefinitely and the streak is just a reading total with extra steps.
- [ ] **Must be payable only in reading.** Never money, never an ad, never a subscription gate —
      same reasoning as 16.19, and more sharply here because the moment of loss is the moment of
      maximum pressure.
- [ ] **It must be offered, not nagged.** One calm card on the home screen, like §15's milestone
      rule: offered once, marked offered whether or not it is taken, and never re-raised over a
      reader (§21 — position is sacred).
- [ ] Extra pages counted through `savePosition()`, the engine-agnostic seam §9.5 already uses, so
      a reclaim can be earned in any engine.
- [ ] `streak_reclaimed` / `streak_frozen` events need §9.6 allowlist approval.

**Files:** `www/js/storage.js` · `www/js/views/upload.js` (home card) · `www/js/views/dashboard.js` ·
`www/i18n/*.json`

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
