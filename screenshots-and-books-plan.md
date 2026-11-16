# FlowRead — Store Screenshots + Free Books Hosting Plan

> Created 2026-11-02, after **1.5.4 / 42 went to production**. Two unrelated jobs in one file
> because they were asked together: the screenshots now owed for the live listing, and how to
> serve free books from your own WordPress site.
>
> The books half **answers open question Q4** (`Tasks.md`) — *drop count, and bundled vs
> remote-fetched catalog*. It is a proposal, not a decision.

---

# Part 1 — Store screenshots

## The numbers

- **Minimum 2, maximum 8** phone screenshots. Eight is not required; it is free conversion
  surface, so fill it.
- **Also required, and the thing listings actually get rejected for: a feature graphic,
  1024×500.** No text smaller than ~24px in it; Play scales it down hard.
- **1080×1920** (9:16). Capture on a real device, **dark theme** — the app is dark-first (§16).
- **Capture from 1.5.4 or later.** Taglines, the onboarding permission screen and the whole
  Settings surface all changed after 1.5.2. Anything older is already stale.
- Real content throughout — actual catalogue titles, a real streak, a real book. Never Lorem.

## The eight

**Play shows roughly the first three in search results.** Those three carry the pivot alone, so
the nudge leads and the reader does not.

| # | Shot | Caption to burn in | Why it is here |
|---|---|---|---|
| 1 | The nudge screen, **"Continue anyway" clearly in frame** | *A gentle nudge. Never a wall.* | This is the product and the whole differentiator. The escape hatch being *visible in the image* is also what stops hard-blocker users installing and then one-starring you when they find out it is not one (§9.1). |
| 2 | Free Books catalogue, scrolled so several real titles show | *88 free books. Yours offline.* | Answers "what would I even read?" — the objection that kills a reading app at install. |
| 3 | Page mode on a real book | *Read like a book.* | Proves it is a genuine reader, not a blocker with a reader bolted on. |
| 4 | Home: in-progress book at top, streak visible | *The habit, building.* | The retention loop, and the only shot that shows progress over time. |
| 5 | Settings → reading nudge, app picker and the off switch both in frame | *You pick the apps. You can stop any time.* | Pre-empts the trust objection every accessibility-service app has to clear, and shows the control is one tap. |
| 6 | Focus mode mid-paragraph | *Or let it pull your eye along.* | One speed-reading shot earns its place. Four of them was the old listing's mistake. |
| 7 | A user's own PDF, cleaned, bridge button visible | *Your own PDFs, cleaned up.* | Keeps the original power-user audience without leading with it (§0.1). |
| 8 | The app in Hindi | *पूरा ऐप हिंदी में।* | A full Hindi UI is a real differentiator in the target market, not a footnote. Belongs in the **main** listing, not only the India CSL. |

## Craft notes

- **Captions:** short, §16 palette only, large type, placed in dead space — never over the content
  they are describing.
- **No device frames.** They shrink the actual screen, which is the thing being sold.
- **Deliberately not shown: the paywall, the tiers, the dashboard.** A screenshot of a price is a
  reason to close the page.
- Shot 1 is worth re-taking until it is right. It is the single highest-leverage image in the
  listing and it has to communicate "offer" rather than "obstacle" with no words read.


The 8, in order
#	Screen	Caption (on image)	How to capture
1	Nudge screen over Reddit/Instagram, with the “Continue to [App] anyway” button visible	“Opened Reddit? Read 2 pages first.”	Turn on every-open mode, open the target app, screenshot when the nudge lands
2	Unlock modal after reading	“Read a little. Your clock resets.”	Set unlock to 1 page and read it. This is the reward loop, and no competitor shows it
3	App picker, or onboarding screen 2 with one app chosen	“You pick the apps. You stay in control.”	Fresh install or reset onboarding
4	Free Books catalog, mixed English and Hindi titles	“Free books, one tap away.”	Use the All tab so both languages show
5	Page mode mid-read	“Calm reading. Pick up where you left off.”	Use a catalog book, not a copyrighted one
6	Share card in the share sheet preview	“Share what you finished.”	Finish a book, or use the home-header Share button
7	Modes shot (existing)	Recaption to “RSVP. Chunk. Focus. Scroll. Page.”	The old caption lists four modes, and there are five now
8	Bridge shot (existing, SS2)	“Jump back to the original page.”	Reuse as is
---

# Part 2 — Serving free books from your own WordPress

## 🚨 Read this before anything else: §13.2 does not exist

`Claude.md` cites **"the verified-legal sources in Section 13.2"** three times — in §4, in §14's
rejected list, and in **§21's stop-and-ask rule**, which is the rule that governs exactly this
work. **The section is not in the document.** It goes 13.1 → 13.3.

So the single rule that is supposed to constrain book sourcing points at nothing. That has to be
written before the catalogue grows, not after, because the moment books are served from your own
domain **you become the publisher** rather than someone linking to one. Suggested content for a
real §13.2:

- An explicit allowlist of source types: **public domain** (verify by author death date + the
  edition's own status, not by "it's old"), and **works whose licence permits redistribution**
  (CC-BY, CC-BY-SA, explicit publisher grant in writing).
- The distinction that matters most: **"free to read" is not "free to re-host."** A publisher
  putting a PDF on their own site grants you nothing. Re-hosting it is redistribution.
- A per-book provenance field recorded in the catalogue, so any future challenge is answerable.
- Z-Library and equivalents remain non-negotiably out.

**Where you already stand:** 23 of 88 books are served from third-party domains —
`castefreeindia.com` (18), `mkgandhi.org` (3), `tipitaka.org` (1), `archive.org` (1) — and 65
from Gutenberg. Linking is a weaker legal position than hosting only in the sense that it is
someone else's bandwidth; it is a *stronger* one in that you are not the distributor. Moving them
to your own server changes that. Deliberately, with the provenance recorded, is fine. By accident
is not.

## What exists today

- `www/data/free-books.json` — **bundled in the app**, 88 entries, `{ books: [...] }`.
- Fields: `id · title · author · language · category · coverImage · sourceUrl · fileType ·
  approxLength` (plus optional `requiresOcr`).
- `free-books.js::_loadCatalog()` does `fetch('data/free-books.json')` once, caches it in memory,
  and falls back to `{ books: [] }` on any error.
- Download is a plain `fetch(book.sourceUrl)` straight to the device.
- **`fileType` must be `pdf` or `txt` only.** §13.3: an `html` entry hits the PDF parser and
  fails. This one constrains the WordPress design more than anything else — see below.

## ⚠️ The trap that will bite a migration

```js
var fileId = generateFileId('freebook', book.id, book.sourceUrl);
```

**The file's identity is a hash of its `sourceUrl`.** Change where a book is hosted and the app
treats it as a different book: the reader's existing copy is orphaned, their position is lost, and
a duplicate appears in their library.

So "move the 23 off-site books onto my own hosting" is **not** a content-only change. Three ways
out, in order of preference:

1. **Drop `sourceUrl` from the seed** — `generateFileId('freebook', book.id)`. A catalogue `id` is
   already unique and already stable; the URL was never identity, only location. Needs a one-time
   migration that re-keys existing entries, or old copies orphan exactly as described.
2. **Keep the old URLs alive as 301 redirects** to the new home, and never edit `sourceUrl`. Zero
   app change, but you carry those redirects forever and the catalogue lies about where files are.
3. Accept the duplicates. Cheapest, and it silently damages the readers who used the feature most.

**Do (1), and do it before moving any file.** It is a small change that stops being small once
there are users with positions in re-hosted books.

## Recommended architecture

**WordPress as the authoring surface. Not as the app's runtime API.**

```
   You author in WordPress
            │  custom post type "book": title, author, language,
            │  category, cover image, the text itself, provenance
            ▼
   Build step (WP-CLI / a scheduled job / a plugin hook)
            │  • renders each book to .txt (never HTML — §13.3)
            │  • emits catalog.json with a version field
            ▼
   Cloudflare (R2 bucket, or Cloudflare in front of WP)
            │  • catalog.json          ← small, cached, versioned
            │  • books/<id>.txt|.pdf   ← the files themselves
            ▼
   FlowRead
              fetch catalog.json → cache locally → fall back to the
              bundled copy on any failure
```

**Why not point the app at the WP REST API directly:**

- WordPress on shared hosting is the least reliable component in the chain, and a catalogue fetch
  failing is a user staring at an empty library.
- `/wp-json/wp/v2/...` is chatty, uncacheable by default, and shapes its payload around WordPress
  rather than around the app. You would be parsing someone else's schema forever.
- Every plugin update is a potential change to your app's data contract.
- A static `catalog.json` on a CDN is one file, cacheable, versionable, and diffable.

**Bandwidth is the sleeper cost.** A 10 MB PDF × a few thousand downloads will exhaust shared
hosting quickly and the failure mode is your whole site going down, not just the catalogue. Put
the *files* on R2 (egress is free to the internet) or at minimum behind Cloudflare caching. Keep
WordPress for authoring only.

## The §13.3 constraint on "book text in WordPress"

You said you can provide **the book text** plus a cover. That is the right instinct — a `.txt`
book is far better than a PDF here: smaller, reflows properly, works in all five engines, and
needs no OCR. But:

**Do not serve the WordPress post HTML.** An `html` entry hits the PDF parser and fails (§13.3),
and adding an HTML parser is a new file format, which §21 says to ask about first.

So the build step must **render post content to plain text** — strip tags, unwrap entities,
preserve paragraph breaks as blank lines, and keep Devanagari as UTF-8. That is a one-time script,
and it is the whole bridge between "I can author in WordPress" and "the app can read it."

Covers: `coverImage` already exists in the schema. Keep them small (≤100 KB, ~600px wide) and note
that §15's share card does **not** use catalogue covers for its typographic fallback, so a missing
cover degrades gracefully.

## Suggested phasing

**Phase A — provenance and identity (no new app surface).**
Write §13.2. Record provenance per book. Do the `generateFileId` fix (option 1 above) and ship it.
Nothing user-visible; it unblocks everything after it.

**Phase B — self-host what you already serve.**
Move the 23 off-site books to R2/Cloudflare, update `sourceUrl`, keep the catalogue bundled. Fixes
link rot — those 23 depend on servers you do not control, and `dn710700.ca.archive.org` in
particular is a node hostname that will not live forever. Safe only after Phase A.

**Phase C — remote catalogue.**
`_loadCatalog()` tries the remote `catalog.json`, caches the result, falls back to the bundled copy
on failure or timeout. The bundled file stays in the app forever as the floor, so a brand-new
install with no internet still has a library. Version/etag check so it only re-downloads on change.

**Phase D — monthly drops (Task 16.4).**
Now cheap: a `drop` field per book plus `isSubscriber()` gating. §4 says **rotating, not
cumulative**. This is the recurring value the subscription is currently missing, and §4's "known
gap" closes when it ships.

## What this means for the privacy policy

Hosting the books yourself **changes what the policy has to say**, and it is currently accurate
only because the downloads go to third parties:

- Downloads would hit **your** server, so your logs see IP addresses and which books each IP takes.
  That is more than Gutenberg told you and it is a real collection surface.
- A catalogue fetch would be a **new network request**, possibly on every launch.

Both need adding to the *Network requests* section. The honest mitigation, and worth doing: put it
behind Cloudflare, **turn off access logging** or retain for the minimum, and say so in the policy.
A sentence like *"we do not keep logs of which books are downloaded"* is a strong claim and costs
you nothing you actually want.

## Decide these (Q4)

1. **Drop count per month.** 5 is the placeholder in `Tasks.md`. Rotating, not cumulative.
2. **R2 vs Cloudflare-in-front-of-WordPress** for the files. R2 if the catalogue will grow; plain
   caching is fine for 88.
3. **Does Phase B happen at all**, or do you only self-host *new* books and leave the existing 23
   linked? Leaving them is less work and less legal surface; moving them is more reliable and more
   polite to those sites.
