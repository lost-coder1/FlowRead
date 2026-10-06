# FlowRead 1.4.8 — versionCode 35

**targetSdk** 36 · **minSdk** 24 · Capacitor 8.5.2 · Play Billing 9.1.0
**Bundle:** `android/app/build/outputs/bundle/release/app-release.aab`

> ## 🚨 Two hard gates before this can be published
>
> **1. Play Console Accessibility API declaration.** This is the first release that ships
> `FlowReadNudgeService`. A build carrying an `AccessibilityService` is **rejected** without the
> declaration — it is not a warning. Text to paste is in the "Accessibility declaration" section
> below.
>
> **2. Privacy policy.** Must disclose the accessibility use and the anonymous analytics pings
> before rollout, not after.
>
> Neither is code. Both are yours. Everything else below is done.

> **Production is on 1.4.5 / versionCode 32.** 1.4.6 (33) and 1.4.7 (34) never went past Internal
> testing, so this release carries their content too — the user-facing notes cover everything since
> 1.4.5, not just what changed this week.

---

## Play Console "What's new"

Play caps this at 500 characters per language. Both are inside it.

### en-US  *(433 characters)*

```
New: FlowRead can nudge you to read when you've been a while in an app you chose — Instagram, Reddit, whatever pulls you in. Always one tap to carry on anyway, and entirely optional.

New: share what you've read as a card, with the book's cover on it.

Fixed: unlocking Pro could wrongly report failure. Reading reminders could silently never arrive. Free Books covers were cropped.

Your books now sit at the top of the home screen.
```

### hi-IN  *(needs your sign-off — §17 says Hindi comes from you)*

```
नया: जिस app में आप अटक जाते हैं — Instagram, Reddit, कोई भी — उसमें थोड़ी देर बिताने पर FlowRead आपको पढ़ने के लिए याद दिला सकता है। आगे बढ़ना हो तो हमेशा एक tap, और यह पूरी तरह optional है।

नया: आपने जो पढ़ा उसे book के cover के साथ एक card में share करें।

ठीक किया: Pro unlock गलत तरीके से fail दिखा सकता था। Reading reminders चुपचाप कभी नहीं आते थे। Free Books के covers कटे हुए दिख रहे थे।

आपकी books अब home screen में सबसे ऊपर।
```

Written in the register the existing `hi.json` strings use. Replace it if you'd rather.

---

## Accessibility declaration — text to paste

Play asks what the service does and why no other API would do. The answer is §9.4a:

> FlowRead is a reading-habit app. The user chooses one or more apps they want to be gently
> prompted to read before using. The accessibility service exists solely to notice when one of
> those user-chosen apps comes to the foreground, so the app can show a reading prompt that always
> carries a one-tap "continue anyway" action.
>
> The service is configured with `canRetrieveWindowContent="false"` and receives only
> `typeWindowStateChanged` events, so it is structurally incapable of reading any screen content.
> Its `packageNames` filter is narrowed at runtime to exactly the apps the user selected, so the
> system delivers no events about any other app. The only information it receives is a package
> name the user has explicitly chosen.
>
> No other API can do this. `UsageStatsManager` reports how long an app has been used but cannot
> notify on app launch, and polling it requires a foreground service whose permanent notification
> would be unacceptable in this product.

Also expect to confirm: a prominent disclosure screen precedes the grant (it does — `nudge.js`
`showDisclosure()`), and the feature is optional and off until the user turns it on.

## Privacy policy — what has to be added

1. **Accessibility service.** What it observes (that a user-chosen app came to the front), what it
   cannot observe (screen content), that the list is user-chosen, and that nothing leaves the device.
2. **Usage access**, if granted — used to confirm the chosen app is still in the foreground and to
   show the day's total. Read and discarded, never stored or transmitted.
3. **Anonymous analytics pings** (§9.6) — event names only, no identifier, no file name, no reading
   content. Current event list: `app_opened`, `nudge_shown`, `nudge_read_started`,
   `nudge_read_completed`, `nudge_skipped`, `free_book_downloaded`, `pro_purchased`,
   `subscription_started`, `subscription_cancelled`, `stats_shared`. **These are inert in this
   build** — the endpoint is empty — but the policy should describe what ships.

---

## What actually changed since 1.4.5

### Reading-habit nudge (Task 16.2) — the pivot mechanic, first release

Choose apps that pull you in; FlowRead offers a short read before you dive in. Every prompt carries
a visible one-tap "Continue to <app> anyway" — this is a nudge, not a blocker (§9.1).

Built on `AccessibilityService` (Q8, signed off 2026-09-20) at the narrowest scope that works.
Hardened over five device rounds (N1–N21) and a field round after several weeks of real use
(N22–N28), the last of which changed what the trigger means:

- **It fires while you are in the app**, not on your next open. Previously the gate only ran at the
  start of a session, so it reported time already spent instead of interrupting it.
- **It counts the current sitting, not the day.** A daily total degenerated into "every open" at
  small thresholds and could not be reset by anything the user did.
- **Timed by the wall clock**, because `getTotalTimeInForeground()` does not tick while you are
  inside an app — it only updates once the session ends.
- **Reading pays the clock back** and refunds a nudge against the daily cap.
- Daily cap, dismissal back-off, and scoped unlock (reading unlocks only the app you asked for).

### Share stats (Task 16.6) — free for everyone

A 1080×1080 card generated entirely on-device. Carries the book's cover — page one for a PDF,
a typographic cover otherwise — and the book's real title with the file extension stripped.
Home-header and dashboard buttons, plus sparse milestone prompts on book completion and 7/30/100-day
streaks.

### From 1.4.6 / 1.4.7, never released to production

- **H4** — unlocking Pro could show "Purchase could not be completed" when it had actually
  succeeded. Error taxonomy rebuilt; `ITEM_ALREADY_OWNED` now resolves as success.
- **H3** — reading reminders could silently never arrive.
- **16.7** — optional notification when the device goes offline.
- **16.9** — in-progress books moved to the top of the home screen.

### Smaller

- Free Books covers were cropped to a horizontal band through their middle (3:2 landscape box,
  `object-fit: cover`, on portrait artwork). Now 2:3 and contained.
- A suppression earned before midnight no longer evaporates at 00:01.
- Book names lose their file extension everywhere they are displayed.

---

## Pre-flight checklist

**Device test pass** — `Tasks.md` "Device test checklist", items 1–16.
Never exercised end-to-end on one build: **5** (scoped unlock with two targets), **6** (cold start),
**9** (battery), **10** (Hindi), **11** (Page mode regression). All of **12–16** are new.

**Item 9 is the one I most want a result on.** The timed in-session check is new and unmeasured:
one `Handler` message per ≤10 minutes while you are inside a target app, each running a 6-hour
`queryEvents`. Leave a target app selected and the phone idle for a few hours and compare battery
against a day without it.

**Also worth capturing during the pass:** screenshots of the Free Books catalogue and Page mode.
They are the only thing blocking Task 16.10 (India custom store listing).

**Known-inert in this build:** `analytics-ping.js` has no endpoint, so no events are sent. Safe and
intended.

**Not in this release:** subscriptions (Task 16.1, blocked on pricing). If you create the SKU in
Play Console now it sits unreferenced, which is harmless — but note that 16.1 must also restore
`FREE_APP_LIMIT` to 1 in `nudge-apps.js`, which is temporarily 2.
