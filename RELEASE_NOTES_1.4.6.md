# FlowRead 1.4.6 — versionCode 33

**Built:** 2026-09-16 · **Bundle:** `android/app/build/outputs/bundle/release/app-release.aab`
**targetSdk** 36 · **minSdk** 24 · Capacitor 8.5.2 · Play Billing 9.1.0

> **Do not promote straight to production.** This release contains the fix for a
> revenue-blocking purchase bug that cannot be verified outside a Play-distributed build.
> Ship to **Internal testing** first and work through `BILLING_TEST_PLAN.md`, then promote
> the same bundle.

---

## Play Console "What's new" copy

Play caps this at 500 characters per language. Both are within it.

### en-US

```
Fixed: unlocking Pro could show "Purchase could not be completed" even when it
worked — if you already owned Pro, it now unlocks properly instead of showing an
error. Purchase problems now explain what actually went wrong.

Fixed: reading reminders could silently never arrive. They now work without extra
permissions, and if notifications are switched off, FlowRead tells you.

New: an optional nudge to read when your device goes offline.

Your books now sit at the top of the home screen.
```

### hi-IN

```
ठीक किया: Pro unlock करने पर काम हो जाने के बाद भी "Purchase could not be completed"
दिख सकता था — अगर Pro पहले से आपका है, तो अब error की जगह वह ठीक से unlock होता है।
Purchase की समस्याएँ अब साफ़ बताती हैं कि असल में क्या हुआ।

ठीक किया: reading reminders चुपचाप कभी नहीं आते थे। अब वे बिना किसी extra permission
के काम करते हैं, और notifications बंद हों तो FlowRead आपको बता देता है।

नया: device offline होने पर पढ़ने का optional nudge।

आपकी books अब home screen में सबसे ऊपर।
```

> **Hindi copy needs product-owner sign-off** before rollout (§17 — the owner supplies
> Hindi). Written in the register the existing `hi.json` strings use.

---

## What actually changed

### 🔴 H4 — Pro purchases failing in production *(revenue-blocking)*

Tapping "Unlock Pro" on 1.4.5 could show "Purchase could not be completed." even when the
account already owned Pro — telling a paying customer their purchase failed, and leaving
them locked out.

**Root cause:** every non-OK `BillingResponseCode` funnelled into a single string in
`FlowReadIapPlugin.onPurchasesUpdated`, and again in `purchase.js:_handlePurchaseError`.
`ITEM_ALREADY_OWNED`, `NETWORK_ERROR`, `SERVICE_DISCONNECTED`, `DEVELOPER_ERROR` and the
rest were indistinguishable to user and developer alike — which is why diagnosing it needed
a logcat session. That is a §1.5 violation, so the fix is the error taxonomy, not the symptom.

- Each Play response code maps to a stable token, emitted as the Capacitor error *code*.
  JS branches on `err.code` instead of pattern-matching English prose.
- **`ITEM_ALREADY_OWNED` now resolves as a success:** re-queries purchases, acknowledges if
  Play never received an ack, and unlocks. If the record can't be read back, it triggers a
  restore rather than reporting failure.
- **Pending payments resolve** with `{pending:true}` instead of rejecting — a delayed
  payment is a legitimate outcome, not an error.
- `resolveSuccessfulPurchase` no longer claims `acknowledged: true` when the ack failed.
- `getUnfetchedProductList()` is now read, so a misconfigured Play Console product no longer
  looks identical to a working one (§3.1 flagged this as unused).
- `onBillingServiceDisconnected` emits `billingDisconnected`; JS clears its cached init flag.
  Previously the native client was torn down while JS still believed it was ready, so
  **every** subsequent call failed permanently until app restart.
- The unlock button no longer dead-ends disabled-forever when the resolved `productIds`
  don't contain the requested product.
- `USER_CANCELED` remains completely silent (§3.1).

### H3 — Reading reminders failing silently

**The recorded diagnosis was wrong, and worth correcting.** `Tasks.md` held that
`allowWhileIdle: true` caused a `SecurityException` swallowed by a bare `catch`. Reading the
Capacitor 8 plugin sources shows `setExactIfPossible()` already guards with
`canScheduleExactAlarms()` and degrades to inexact with a warning — so `schedule()` never
threw. Worse, the planned fix (deleting `allowWhileIdle`) would have made delivery *worse*:
paired with an inexact alarm it yields `setAndAllowWhileIdle(RTC_WAKEUP)`, which survives
Doze, where plain `set(RTC)` does not.

- `isExactNotification: false` while **keeping** `allowWhileIdle` — no special permission,
  still Doze-tolerant.
- `SCHEDULE_EXACT_ALARM` removed from the merged manifest. It needed `tools:node="remove"`,
  since `@capacitor/local-notifications` declares it too and deleting our line alone would
  not have worked. **This drops a Play Console permission declaration.**
- The real silent failure was `POST_NOTIFICATIONS` denial: `reschedule()` returned early with
  no signal and the settings toggle discarded `requestPermission()`'s result, leaving a
  checked box that promised reminders forever. It now reverts, explains, and records status.

### 16.9 — In-progress books moved to the top of the home screen

Resuming a read is the most common action on that screen and required scrolling past the
import grid. The section is hidden when empty — `.upload-screen` is a flex column with a gap,
so an empty-but-present div would have added a second gap under the header on a fresh install.

### 16.7 — Offline-triggered reading nudge *(new, notification id 1003)*

Going offline is a natural reading moment. Uses `@capacitor/network` (adds only
`ACCESS_NETWORK_STATE`). Anti-spam: 4h throttle, suppressed when already read today,
suppressed while the app is foregrounded, and a 30s confirm window so connectivity blips
don't fire. Off-switchable in Settings.

**Honest limitation:** the listener only runs while the app process is alive, so it catches
going offline with FlowRead backgrounded — not after Android reclaims the process. A bonus
trigger, not a guarantee.

**Copy is draft** pending Q6 sign-off.

---

## Risk notes for this rollout

| Area | Risk | Mitigation |
|---|---|---|
| Purchases | Highest. The whole point of the release, and untestable outside Play. | Internal testing track first; `BILLING_TEST_PLAN.md` §5 Tests 1–6. |
| Notifications | Alarm scheduling changed from exact to inexact. Delivery may drift by minutes. | Intended — a reading reminder doesn't need to-the-minute precision. Verify one actually fires. |
| Manifest | `SCHEDULE_EXACT_ALARM` removed. | Verified absent from debug + release merged manifests; `RECEIVE_BOOT_COMPLETED` and the boot-restore receiver intact. |
| i18n | 10 new keys × 2 locales. | en/hi both at 451 keys, full parity checked. Hindi needs sign-off. |
| minSdk | Unchanged at 24. | No new device exclusions in this release. |

## Still open after this release

- **Q1** subscription pricing → blocks Task 16.1 finishing
- **Q6** offline-notification copy → this release ships draft copy
- Hindi sign-off on all new strings
- H4's own verification — the reason this goes to Internal testing first
