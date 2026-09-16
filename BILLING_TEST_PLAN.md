# Billing Test Plan — Task H4 (1.4.6)

> **Why this exists:** Pro purchases failed in production on 1.4.5 with a single generic
> message — "Purchase could not be completed." Every Play failure code was funnelled into
> that one string, so the failure was indistinguishable to both user and developer. The fix
> gives each code its own path and its own plain-language message. This plan verifies it.
>
> **Fill in the Result column as you go.** If anything fails, the token in the logcat line
> is the single most useful thing to send back — see §6.

---

## 1. Prerequisites — check these first

Getting these wrong produces failures that look like app bugs but aren't.

- [ ] **Play Console → Monetise → Products → In-app products:** both `pro_lifetime` and
      `ocr_vision` show status **Active**.
- [ ] **Play Console → Setup → Licence testing:** your test Google account is listed.
      This is what makes test purchases free. Without it, Test 2 charges real money.
- [ ] The device is signed into **that same Google account** (and ideally only that one —
      multiple accounts on a device are a common source of confusing billing results).
- [ ] JDK 21 is active: `java -version` prints 21.x. Capacitor 8 will not build on anything else.

**Play Billing does not work in a sideloaded APK.** A build installed over `adb install`
cannot reach billing at all, so it must come from Play. That's what §2 and §3 are for.

---

## 2. Build the release bundle

1. Bump the version — Play rejects a duplicate `versionCode`:

   In `android/app/build.gradle`:
   ```
   versionCode 33          // was 32
   versionName "1.4.6"     // was "1.4.5"
   ```

2. Build:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

3. Output lands at:
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```

---

## 3. Get it onto the device via Internal testing

Internal testing has no review wait and allows up to 100 testers.

1. **Play Console → Testing → Internal testing → Create new release.**
2. Upload `app-release.aab`, add release notes, **Save → Review → Start rollout to Internal testing**.
3. **Testers tab** → add your Google account to the tester list → **copy the opt-in URL**.
4. Open that URL on the device, accept the invitation.
5. Install **from the Play listing** the link opens — not via adb.

> Availability can lag a few minutes after rollout. If Play shows the old version, wait and
> pull-to-refresh the listing.

---

## 4. Attach logcat before testing

Keep this running in a terminal for the whole session. Every test below should produce a line here.

```bash
adb logcat -c                                   # clear old logs first
adb logcat -s FlowReadIap:* BillingClient:* Capacitor/LocalNotification:*
```

A failure now looks like:
```
W FlowReadIap: purchase failed: ITEM_ALREADY_OWNED (code=7) <debug message from Play>
```
The word after `purchase failed:` is **the token**. That is what to report back.

---

## 5. The tests

### Test 1 — Purchase while already owning Pro 🔴 *this is the reported bug*

| | |
|---|---|
| **Setup** | Use the account that already owns `pro_lifetime`. Run **Restore purchases** first if unsure. |
| **Do** | Open the Pro paywall → tap **Unlock Pro**. |
| **Expect** | Pro unlocks, with a confirmation. Either the normal "Pro unlocked. Thank you!" or "You already own this. Restoring it now…" followed by a successful restore. |
| **Must NOT see** | "Purchase could not be completed." — that was the bug. |
| **Logcat** | Either a clean success, or `ITEM_ALREADY_OWNED recovered for pro_lifetime`. |
| **Result** | |

### Test 2 — Fresh purchase

| | |
|---|---|
| **Setup** | An account that owns nothing, listed under Licence testing so it charges nothing. |
| **Do** | Unlock Pro → complete the Play purchase sheet. |
| **Expect** | Sheet completes → "Pro unlocked. Thank you!" → Pro features available (themes, fonts, dashboard). |
| **Note** | This path has been **unverified since the Billing 9 migration** — it is the second most important test here. |
| **Result** | |

### Test 3 — Cancel mid-flow

| | |
|---|---|
| **Do** | Unlock Pro → when the Play sheet opens, press back / dismiss it. |
| **Expect** | **No toast at all.** Silence. The unlock button returns to its normal label and is tappable again. |
| **Why it matters** | Long-standing shipped behaviour that is easy to regress (§3.1). A toast here is a failure. |
| **Result** | |

### Test 4 — Restore purchases

| | |
|---|---|
| **Do** | Settings (or the paywall) → **Restore purchases**. |
| **Expect** | Owned products restore and the toast names them. On an account owning nothing: "No previous purchases found for this account." — not an error. |
| **Result** | |

### Test 5 — Network failure

| | |
|---|---|
| **Do** | Turn on airplane mode → attempt to unlock Pro. |
| **Expect** | A **network-specific** message: "No connection to the store. Please check your internet and try again." |
| **Must NOT see** | The generic "Purchase could not be completed." |
| **Result** | |

### Test 6 — OCR add-on

| | |
|---|---|
| **Do** | With Pro owned, open the OCR paywall → unlock `ocr_vision`. |
| **Expect** | Unlocks independently of Pro; OCR works on a scanned PDF. |
| **Result** | |

---

## 6. If something fails — what to send back

Send **the token** plus the surrounding logcat lines. The token tells me exactly which
branch is wrong, which is the whole point of the fix.

| Token | What it means | Likely next step |
|---|---|---|
| `ITEM_ALREADY_OWNED` | Account owns it. Should have auto-unlocked. | The recovery path found no matching purchase — check `queryPurchases` output. |
| `NETWORK_ERROR` | No route to Play. | Expected under airplane mode (Test 5). |
| `SERVICE_DISCONNECTED` / `SERVICE_UNAVAILABLE` | Play's billing service died or is unreachable. | App re-inits on next attempt; retry once. Also seen when Play itself crashes. |
| `BILLING_UNAVAILABLE` | Play Billing unsupported for this account/device/country. | Usually account or region, not app code. |
| `ITEM_UNAVAILABLE` | Product not available to this account. | Check the product is Active and the country is supported. |
| `DEVELOPER_ERROR` | Malformed request — wrong product id, wrong signing key, app not published on a track. | Nearly always Play Console config, not runtime code. |
| `NOT_INITIALIZED` | Billing client wasn't ready. | Should now self-heal; if it repeats, the disconnect listener isn't firing. |
| `EMPTY_RESULT` | Play returned OK with no purchase. | Rare; send the full log. |
| `UNKNOWN` | A code with no branch yet. | Send the `(code=N)` number — I'll add the branch. |

**A generic "Purchase could not be completed." still appearing is itself a finding.** It means
a token reached the JS layer that `_messageForCode` has no case for. The logcat line names it.

Also worth capturing if you see them:
- `W BillingClient: Billing service disconnected.`
- `ActivityManager: Scheduling restart of crashed service com.android.vending/...InAppBillingService`

Both appeared around the original 1.4.5 failure and may be incidental — but if they recur
alongside a failure, that's a real signal.

---

## 7. After it passes

Promote the **same bundle** from Internal testing to Production in Play Console — no rebuild
needed. Then tick Task H4 in `Tasks.md` and record the result.

---

## Appendix — what changed in this build

Batched into 1.4.6 alongside H4:

- **H3** — notifications no longer request exact alarms (`isExactNotification:false`, keeping
  `allowWhileIdle` so Doze can't swallow them), no longer fail silently, and denying the
  notification permission now reverts the settings toggle with an explanation.
  `SCHEDULE_EXACT_ALARM` removed from the merged manifest.
- **16.9** — in-progress books moved above the import grid on the home screen.
- **16.7** — new offline-triggered reading nudge (notification id 1003), throttled to once
  per 4h, suppressed when already read today or when the app is foregrounded.

Worth a quick look while you have the build on a device, though not part of billing:
- [ ] Home screen opens with in-progress books first — and looks right with an empty library.
- [ ] Revoke "Alarms & reminders" in system settings → the daily reminder still fires.
- [ ] Deny notification permission → the reminder toggle reverts and explains why.
- [ ] Airplane mode with the app backgrounded → at most one offline nudge.
