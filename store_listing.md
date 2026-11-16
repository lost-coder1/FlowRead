# FlowRead — Play Store Listing (Task 16.10)

> **Status:** draft, 2026-11-02. English copy ready for review. **Hindi not written** — owner
> supplies per `Claude.md` §17.
>
> Written on the **habit framing** (§0.1). The Phase 15 speed-reading drafts underperformed with a
> real test audience and must not be reused (§18).
>
> **Character limits are hard.** Play rejects over-length fields silently in the editor.
> Title ≤ 30 · Short description ≤ 80 · Full description ≤ 4000.
>
> **Measured, not estimated:** title 28/30, short 71/80, full **3891/4000** (109 characters of
> headroom, after the book-drops line was cut on 2026-11-02).

---

## App title (≤ 30 characters)

**Recommended:**

```
FlowRead: Read, Don't Scroll
```
`28 characters`

Alternates, same framing, if the apostrophe reads badly in search results:

| Option | Chars |
|---|---|
| `FlowRead — Reading Habit` | 24 |
| `FlowRead: Read More Daily` | 25 |
| `FlowRead: Books, Not Feeds` | 26 |

**Do not use** the old `FlowRead — Speed Reader` or any title leading with speed/PDF. That is the
positioning the pivot moved away from, and the title is the single strongest ranking signal for
what the app is taken to be.

---

## Short description (≤ 80 characters)

**Recommended:**

```
Build a reading habit. A gentle nudge to read before you open the feed.
```
`71 characters`

Alternates:

| Option | Chars |
|---|---|
| `Read more, scroll less. Free books, gentle nudges, no account needed.` | 69 |
| `Pick the apps that eat your time. FlowRead offers you a page first.` | 67 |
| `A calmer way to read more and scroll less. Offline, private, no account.` | 72 |

---

## Full description (≤ 4000 characters)

```
You already want to read more. The problem is never the wanting — it's that the feed is one tap
closer than the book.

FlowRead sits in that gap. You pick the apps that tend to eat your time. When you open one,
FlowRead offers you a page or two first. Read them and the app opens. Don't want to? Tap
"Continue anyway" and it opens immediately.

That escape hatch is on every single nudge, always visible, never behind a timer. FlowRead is not
an app blocker and will never pretend to be one. Nothing is locked, nothing is punished, and
skipping costs you nothing — no broken streak, no guilt screen.


SOMETHING TO READ, ALREADY ON YOUR PHONE

88 complete books, free and legal — public domain and officially free titles, including Hindi
ones. Ambedkar, Phule, Tagore, Austen, Tolstoy, Marcus Aurelius. Download once and the book is
yours offline forever.

So the nudge never drops you on an empty import screen. There is always something to read.


READ THE WAY THAT SUITS YOU

Five reading modes, switch between them mid-book without losing your place:

• Page — clean, swipeable pages, like a normal book
• Focus — the first part of each word bolded to pull your eye along
• Scroll — a steady, hands-free crawl at your own speed
• RSVP — one word at a time, in a fixed spot, so your eyes never move
• Chunk — a few words at a time, for when one at a time is too slow

Reading faster is there if you want it. It is no longer the point.


YOUR OWN FILES TOO

Open PDF, DOCX and TXT files from your device. FlowRead strips out the page numbers, headers and
footers so you read the text, not the furniture. Tables, images and equations become tappable
placeholders instead of garbled lines.

Jump between speed reading and the original page at any point and keep your exact position. Tap
any word for a definition from an offline dictionary. Scanned pages can be read on-device with
OCR, in English and Hindi.

Full Hindi interface, not just Hindi books.


PRIVATE BECAUSE OF HOW IT IS BUILT

No account. No sign-up. No email. Open the app and start reading.

Your files are opened and processed on your phone. They are never uploaded, never sent to us, and
never seen by anyone else. That is not a promise about our intentions — there is simply no server
for them to go to.

FlowRead sends a small number of anonymous counts so we know which features are used. No
identifier of any kind, nothing about what you read, and you can turn it off in Settings.


WHAT IT COSTS

Free, with no ads and no time limit: every reading mode, the whole book library, your own files,
the dictionary, and reading nudges for one app.

A one-time purchase unlocks everything in the app, permanently, with no subscription. It is a
real option and it is not going away.

FlowRead Plus, monthly or yearly, adds nudge scheduling and stricter nudges if the gentle one
isn't enough. Cancel any time in Google Play — one tap, no retention screen.


ABOUT THE PERMISSIONS

Reading nudges need Android's accessibility service to notice when one of your chosen apps opens.
FlowRead asks for the narrowest form of it: it cannot read your screen — that ability is switched
off in the service's own configuration, not just unused — and Android only tells it about the apps
you picked yourself. Nothing it sees is stored, logged or sent anywhere.

Usage access is optional and makes the timing more accurate. Declining it keeps nudges working.

Nudges are entirely optional. Skip the setup and FlowRead is simply a good offline reader.


HONESTLY, THE LIMITS

• Downloading a book needs internet once. Reading never does.
• DRM-locked files (Kindle, Adobe Digital Editions) cannot be opened. No app can.
• Two-column academic papers can read out of order in the word-by-word modes.
• Handwriting is not reliably recognised.
• Reading nudges are Android-only and need permissions you grant yourself.


Read more. Scroll less.
```

---

## Required alongside the listing

- [x] **Data safety** — re-filed with collection **Optional**, 2026-11-02.
- [ ] **Privacy policy URL** must point at the rewritten `privacy_policy.html`, published.
- [ ] **Subscription terms** — Play requires price, period and renewal to be clear. Covered by the
      *What it costs* block; verify the in-app paywall says the same thing.
- [ ] **Accessibility declaration** stays as filed: App functionality, no sensitive data,
      `isAccessibilityTool` false (§9.4a).

## Screenshots

**Play needs a minimum of 2 and allows a maximum of 8.** Eight is not a requirement — but it is
free conversion surface, so fill it. Also **required and easy to forget: a feature graphic,
1024×500.** Listings are rejected for a missing one more often than for weak screenshots.

**Capture from 1.5.4 or later, on a real device, in the dark theme.** Taglines, the onboarding
permission screen and the whole Settings surface changed after 1.5.2, so anything older is stale.
1080×1920 (9:16). Real content — actual catalogue titles, a real streak, a real book — never
placeholder text.

**Play shows roughly the first three in search results.** Those three have to carry the pivot on
their own, so the nudge is first and the reader is not.

| # | Shot | Caption to burn in | Why here |
|---|---|---|---|
| 1 | The nudge screen, with **"Continue anyway" clearly visible** | *A gentle nudge. Never a wall.* | This is the product and the differentiator. The escape hatch being visible in the screenshot is also what stops hard-blocker users installing and one-starring (§9.1). |
| 2 | Free Books catalogue, scrolled to show real titles | *88 free books. Yours offline.* | Answers "what would I even read?" immediately — the objection that kills a reading app at install. |
| 3 | Page mode reading a real book | *Read like a book.* | Proves it is a genuine reader, not a utility wrapped around a blocker. |
| 4 | Home screen: in-progress book on top, streak visible | *The habit, building.* | The retention loop, and the only shot that shows progress over time. |
| 5 | Settings → reading nudge, app picker and the off switch in frame | *You pick the apps. You can stop any time.* | Pre-empts the trust objection an accessibility-service app has to clear, and shows the control is one tap. |
| 6 | Focus mode mid-paragraph | *Or let it pull your eye along.* | One speed-reading shot earns its place; four do not. |
| 7 | A user's own PDF, cleaned, with the bridge button | *Your own PDFs, cleaned up.* | Retains the original power-user audience without leading with it (§0.1). |
| 8 | The app in Hindi | *पूरा ऐप हिंदी में।* | Full Hindi UI is a real differentiator in the target market, not a footnote. Belongs in the main listing, not only the India CSL. |

**Captions:** short, §16 palette only, large type, placed in dead space rather than over the
content. No device frames — they shrink the actual screen.

**Deliberately not shown:** the paywall, the dashboard, the subscription tiers. A screenshot of a
price is a reason to close the page.

## Deliberate choices

**No prices in the copy.** Play shows them per region, and the lifetime price is expected to rise
to ₹4,999 (§4) — hardcoding it means a listing edit later.

**The escape hatch is in paragraph three, not the fine print.** It is the thing that makes this not
an app blocker, and burying it would attract exactly the users who want a blocker and will leave a
one-star review when they find out it isn't.

**"No analytics" is not claimed anywhere.** It was in the old policy and it stopped being true.

**The monthly book drops are not mentioned** — **cut 2026-11-02**, because 16.4 is not built and
§4 already records that the subscription carries no recurring value at launch. In the app that is
an accepted gap; in a listing it is a promise made to someone before they pay, which is a
different thing. **Put the line back when 16.4 ships, not before.**

## Hindi (§17)

Owner-supplied. Needs: title, short description, full description. The Hindi listing is the India
CSL and should lead with the same habit framing, not a translation of the old speed-reading copy.
