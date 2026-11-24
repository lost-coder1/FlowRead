/* IAP feature module — Google Play Billing 9 via FlowReadIapPlugin */
/* Purchase state stored exclusively in Capacitor Preferences via storage.js */

const _IapPlugin = (function() {
  function get() {
    return window.Capacitor &&
           window.Capacitor.Plugins &&
           window.Capacitor.Plugins.FlowReadIap || null;
  }
  return { get: get };
})();

const PRODUCT_LIFETIME = 'pro_lifetime';
const PRODUCT_OCR      = 'ocr_vision';
const PRODUCT_SUB      = 'flowread_plus';

/* Prices as Play formatted them, keyed by product id. Deliberately starts EMPTY
   and has no hardcoded fallback: only Play knows what it is about to charge.
   A figure from §4 is wrong in every market but India, and wrong in India too the
   moment Play's price rounding or a Play Console edit moves it — which is exactly
   what happened on 2026-11-01, when ₹2,999/₹999/₹149 came back as ₹3,000/₹1,000/
   ₹150. A paywall that names one price while Play charges another is the §1.5
   failure in its least forgivable form, so a row with no price yet renders
   without one and the modal re-renders when the real figure arrives. */
const _prices = {};

/* Subscription base plans as Play reported them this run: one entry per plan,
   each with the offer token purchase requires. Not persisted — a token is valid
   only for the query that produced it (§ FlowReadIapPlugin.appendSubscriptionOffers). */
let _subOffers = [];

let _iapInitialized = false;
let _iapInitializing = false;

/* ─── initIAP ──────────────────────────────────────────────────────────── */
/* Called once at boot from app.js (non-blocking). Also called lazily before
   any purchase via _ensureIap() so the billing client is always warm. */
async function initIAP() {
  if (_iapInitialized) return true;
  if (_iapInitializing) return false;

  const plugin = _IapPlugin.get();
  if (!plugin) return false;

  _iapInitializing = true;
  try {
    await plugin.initBilling();
    _iapInitialized = true;
    _listenForDisconnect(plugin);
    _fetchPrices().catch(function() {});
    return true;
  } catch (err) {
    console.warn('[IAP] initBilling failed:', err);
    _iapInitialized = false;
    return false;
  } finally {
    _iapInitializing = false;
  }
}

async function _fetchPrices() {
  const plugin = _IapPlugin.get();
  if (!plugin) return;
  try {
    await _queryCatalog(plugin);
  } catch (_) {}
}

/* Single place that reads the store catalogue, so the price map and the offer
   tokens can never fall out of step with each other. */
async function _queryCatalog(plugin) {
  const result = await plugin.queryProducts();
  const products = (result && result.products) || [];

  const offers = [];
  products.forEach(function(p) {
    if (!p || !p.id) return;
    if (p.productType === 'subs') {
      if (p.offerToken) offers.push(p);
    } else if (p.price) {
      _prices[p.id] = p.price;
    }
  });
  _subOffers = offers;

  /* A product Play could not fetch is a Play Console configuration problem, and
     it looks identical to a working one unless it is said out loud (§1.5). */
  const unfetched = (result && result.unfetched) || [];
  if (unfetched.length) console.warn('[IAP] products Play could not fetch:', unfetched);
  const errors = (result && result.errors) || [];
  if (errors.length) console.warn('[IAP] product query errors:', errors);

  return result;
}

/* Which base plan is which, from the ISO-8601 billing period Play returns. The
   base plan *ids* are whatever Play Console calls them, so matching on the period
   is what keeps a renamed plan working (§ the native resolveOfferToken). */
function _planKind(offer) {
  const period = (offer && offer.billingPeriod) || '';
  if (period === 'P1Y' || period === 'P12M') return 'year';
  if (period === 'P1M') return 'month';
  return null;
}

function _offerFor(kind) {
  for (var i = 0; i < _subOffers.length; i++) {
    if (_planKind(_subOffers[i]) === kind) return _subOffers[i];
  }
  return null;
}

/* ─── Debug: simulate the free tier ────────────────────────────────────── */
/* A developer who owns `pro_lifetime` cannot see any free-tier surface on their
   own device, and no amount of clearing storage helps: refreshEntitlements()
   asks Play on every launch and a one-time purchase is owned by that Google
   account forever, so the entitlement is re-granted a second after boot. That
   made §24's work — the Unlock section, the locked chips, the dashboard preview
   — untestable on the device it ships to.

   Two properties make this safe to have in the source at all:

   1. **It can only ever withhold, never grant.** Every gate below returns false
      when it is on; nothing anywhere reads it to turn something *on*. So the
      worst case if it ever escaped is a paying user whose features are hidden
      — bad, visible, and instantly reversible — rather than an unlock vector.
      A toggle that granted Pro would be one, which is why this is "simulate
      free" and not "simulate pro". The developer's real entitlement supplies
      the other half of the matrix.
   2. **It cannot exist in a release build.** `window.Capacitor.DEBUG` is
      injected by Capacitor from the app's FLAG_DEBUGGABLE before the page
      loads (JSExport.getGlobalJS), so it is false in anything built as
      release — and Play refuses an upload marked debuggable regardless. The
      flag is therefore inert in production even if the localStorage key is
      somehow set, and the Settings row that writes it is never rendered.
      This is the guarantee; §25's release check is the backstop, not the
      mechanism.

   The key lives in localStorage, not Capacitor Preferences. §21 forbids
   localStorage for *purchase state*, and this is not purchase state — it is a
   dev-only simulation switch that cannot carry an entitlement. Do not "fix" it
   into Preferences, where it would outlive an app-data clear and be harder to
   get rid of. */
function isDebugBuild() {
  return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.DEBUG === true);
}

function debugForcedFree() {
  if (!isDebugBuild()) return false;
  try { return localStorage.getItem('fr_debug_force_free') === '1'; } catch (_) { return false; }
}

function setDebugForcedFree(on) {
  if (!isDebugBuild()) return;
  try {
    if (on) localStorage.setItem('fr_debug_force_free', '1');
    else localStorage.removeItem('fr_debug_force_free');
  } catch (_) {}
}

/* ─── State accessors ──────────────────────────────────────────────────── */
/* Two stored entitlements, read and written independently (§4): a user may hold
   the lifetime purchase, a subscription, both, or neither. They stay separate
   because the monthly book drops will have to tell them apart — lifetime buys
   the product as it stands, not a perpetual content feed.

   What a *gate* asks is a third, derived thing: "has this user paid for anything
   that is still good." As of the 2026-10-30 pricing either tier alone unlocks
   everything that exists today, so that is the only question every Pro feature
   in the app needs answered, and hasProAccess() is where it is answered. Gating
   a Pro feature on the lifetime purchase alone would lock out a subscriber who
   had just paid for exactly that feature. */
async function hasLifetime() {
  if (debugForcedFree()) { AppState.ownsLifetime = false; return false; }
  const owns = (await loadPurchaseState('pro')) === 'true';
  AppState.ownsLifetime = owns;
  return owns;
}

/* The single Pro gate. `AppState.isPro` therefore means "paid", not "bought the
   lifetime product" — ownsLifetime is the flag for that. */
async function hasProAccess() {
  if (debugForcedFree()) { AppState.isPro = false; return false; }
  const lifetime = await hasLifetime();
  const sub = await hasSubscription();
  const access = lifetime || sub;
  AppState.isPro = access;
  return access;
}

/* OCR is no longer a thing to buy: §4 folded it into the lifetime product and
   retired `ocr_vision` from sale. Three ways to have it, in this order:

   1. an `ocr_vision` purchase, honoured forever for whoever bought one — Play
      will not delete a product with purchases and §1.3 forbids withdrawing what
      someone paid for;
   2. the lifetime purchase, which now includes it (existing owners gain it at no
      charge — deliberate goodwill, not an oversight);
   3. an active subscription. */
async function hasOcrAccess() {
  /* Before the ocr_vision check, not after: a legacy add-on owner would
     otherwise keep OCR while simulating the free tier, and OCR is one of the
     gates §24 asks to be testable. */
  if (debugForcedFree()) return false;
  if ((await loadPurchaseState('ocr')) === 'true') return true;
  return await hasProAccess();
}

async function hasSubscription() {
  if (debugForcedFree()) { AppState.isSubscriber = false; return false; }
  const active = (await loadPurchaseState('subscription')) === 'true';
  AppState.isSubscriber = active;
  return active;
}

/* ─── Entitlement refresh ──────────────────────────────────────────────── */
/* A subscription is the first entitlement in this app that can *stop* being
   true, which the original sticky-true storage had no way to express. The rule:
   the subscription flag is only ever rewritten from a query Play actually
   answered. A failed or offline query leaves the last known value alone, so
   nobody loses the thing they paid for on a plane or in a dead zone.
   `checkedTypes` from the plugin is what distinguishes "Play says no
   subscription" from "we could not ask".

   One-time entitlements are granted here but never revoked, which is the
   behaviour this app has always had. A refund is rare, and wrongly cutting off
   someone who paid once is worse than briefly honouring a refunded purchase. */
async function refreshEntitlements() {
  const plugin = _IapPlugin.get();
  if (!plugin) return null;

  let result;
  try {
    await _ensureIap();
    result = await plugin.queryPurchases();
  } catch (err) {
    console.warn('[IAP] entitlement refresh failed:', _errorCode(err));
    _resetIfDisconnected(_errorCode(err));
    return null;
  }

  const purchases    = (result && result.purchases) || [];
  const checkedTypes = (result && result.checkedTypes) || [];

  const found = { pro: false, ocr: false, sub: false };
  let autoRenewing = false;

  for (var i = 0; i < purchases.length; i++) {
    const p = purchases[i];
    if (p.productId === PRODUCT_LIFETIME) found.pro = true;
    if (p.productId === PRODUCT_OCR)      found.ocr = true;
    if (p.productId === PRODUCT_SUB) {
      found.sub = true;
      if (p.autoRenewing) autoRenewing = true;
    }
  }

  if (found.pro) {
    await savePurchaseState('pro', 'true');
    AppState.ownsLifetime = true;
    AppState.isPro = true;
  }
  if (found.ocr) { await savePurchaseState('ocr', 'true'); }

  const wasSubscriber = (await loadPurchaseState('subscription')) === 'true';
  let subChange = null;

  if (checkedTypes.indexOf('subs') !== -1) {
    await savePurchaseState('subscription', found.sub ? 'true' : 'false');
    AppState.isSubscriber = found.sub;
    /* Play has no "it was cancelled" callback, so a true→false transition on a
       query it did answer is the only honest moment to report one (§9.6). */
    if (found.sub && !wasSubscriber) subChange = 'started';
    if (!found.sub && wasSubscriber) subChange = 'cancelled';
  }

  /* A cancelled-but-not-yet-expired subscription still entitles the user for the
     period they paid for, so nothing is revoked — but the offer should not be
     made again as though they had never subscribed. */
  AppState.subscriptionRenewing = found.sub ? autoRenewing : false;

  /* Recompute the gate from whatever the flags now say, rather than only ever
     raising it. A lapsed subscription with no lifetime purchase has to close the
     Pro gate again, and the surfaces rendered from it have to be re-rendered —
     a lock the user can still click past is not a gate (§1.5). */
  /* The stored entitlements above are still written while simulating the free
     tier — they are true, and the flag is a lens rather than a revocation — but
     the in-memory flags set directly in those branches have to be put back,
     since hasProAccess() short-circuits before it would reach hasSubscription()
     and so cannot correct them itself. */
  if (debugForcedFree()) {
    AppState.ownsLifetime = false;
    AppState.isSubscriber = false;
  }

  const hadAccess = AppState.isPro;
  await hasProAccess();

  if (subChange === 'started')   logEvent('subscription_started');
  if (subChange === 'cancelled') logEvent('subscription_cancelled');

  if (hadAccess !== AppState.isPro) _rerenderAfterEntitlementChange();

  return { pro: found.pro, ocr: found.ocr, sub: found.sub, subChange: subChange,
           checkedSubs: checkedTypes.indexOf('subs') !== -1 };
}

/* ─── Purchase flows ───────────────────────────────────────────────────── */
/* The lifetime purchase. Still `pro_lifetime` — repriced and widened to include
   OCR and unlimited nudge apps, never replaced (§4): the product must keep
   resolving for everyone who already owns it. */
async function buyLifetime() {
  const btn = qs('#btn-paywall-continue');
  if (btn) { btn.disabled = true; btn.textContent = t('iap.btn.opening_store'); }

  try {
    const plugin = await _readyPlugin();
    await _queryCatalog(plugin);

    const result = await plugin.purchaseProduct({ productId: PRODUCT_LIFETIME });
    if (result && result.pending) {
      closeActiveModal();
      showToast(t('iap.toast.pending'));
      return;
    }
    const productIds = (result && result.productIds) || [];
    if (productIds.indexOf(PRODUCT_LIFETIME) === -1) {
      // Resolved without the product we asked for — never leave the button
      // spinning with no explanation (§1.5).
      throw new Error('EMPTY_RESULT');
    }

    await savePurchaseState('pro', 'true');
    AppState.ownsLifetime = true;
    AppState.isPro = true;
    logEvent('pro_purchased', { tier: 'lifetime' });
    _afterUnlock(t('iap.toast.pro_unlocked'));
  } catch (err) {
    _handlePurchaseError(err, btn, t('btn.continue'));
  }
}

/* `kind` is 'month' or 'year'. The offer token comes from the catalogue query
   immediately before the purchase, never from storage — Play only honours a
   token from the query that produced it. */
async function buySubscription(kind) {
  const btn = qs('#btn-paywall-continue');
  if (btn) { btn.disabled = true; btn.textContent = t('iap.btn.opening_store'); }

  try {
    const plugin = await _readyPlugin();
    await _queryCatalog(plugin);

    const offer = _offerFor(kind);
    if (!offer) {
      /* No offer for the plan the user picked. Almost always a base plan that is
         not active in Play Console — an inactive plan is invisible to the app. */
      throw new Error('OFFER_NOT_LOADED');
    }

    const result = await plugin.purchaseProduct({
      productId:  PRODUCT_SUB,
      basePlanId: offer.basePlanId,
      offerToken: offer.offerToken,
    });

    if (result && result.pending) {
      closeActiveModal();
      showToast(t('iap.toast.pending'));
      return;
    }
    const productIds = (result && result.productIds) || [];
    if (productIds.indexOf(PRODUCT_SUB) === -1) throw new Error('EMPTY_RESULT');

    await savePurchaseState('subscription', 'true');
    AppState.isSubscriber = true;
    AppState.isPro = true;
    AppState.subscriptionRenewing = true;
    logEvent('subscription_started', { tier: kind === 'year' ? 'annual' : 'monthly' });
    _afterUnlock(t('iap.toast.subscription_started'));
  } catch (err) {
    _handlePurchaseError(err, btn, t('btn.continue'));
  }
}

/* Pro-gated surfaces are rendered from entitlement state, so they have to be
   re-run the moment it changes or the user is left looking at a lock they have
   just paid to remove. Deliberately does not touch the reader: a refresh can
   land mid-read, and reading position is sacred (§21). */
function _rerenderAfterEntitlementChange() {
  applyTheme(AppState.settings.theme);
  applyTypography(AppState.settings.fontPreset);
  if (typeof syncThemeChips === 'function') syncThemeChips();
  if (typeof syncTypographyChips === 'function') syncTypographyChips();
  if (typeof hydrateUploadSurface === 'function' && AppState.currentView === 'view-upload') {
    hydrateUploadSurface();
  }
}

function _afterUnlock(message) {
  applyTheme(AppState.settings.theme);
  applyTypography(AppState.settings.fontPreset);
  syncThemeChips();
  syncTypographyChips();
  closeActiveModal();
  showToast(message);
  if (typeof hydrateUploadSurface === 'function' && AppState.currentView === 'view-upload') {
    hydrateUploadSurface();
  }
}

/* ─── restorePurchases ─────────────────────────────────────────────────── */
async function restorePurchases() {
  const btn = qs('#btn-modal-restore') || qs('#btn-settings-restore');
  if (btn) { btn.disabled = true; btn.textContent = t('iap.btn.restoring'); }

  try {
    await _ensureIap();
    if (!_IapPlugin.get()) throw new Error('no_plugin');

    const found = await refreshEntitlements();
    if (!found) throw new Error('billing_unavailable');

    const labels = [];
    if (found.pro) labels.push(t('paywall.plan.lifetime.label'));
    if (found.sub) labels.push(t('paywall.plan.sub.label'));
    /* Only named separately for someone who owns the retired add-on without the
       lifetime product — otherwise it is already covered by what is listed. */
    if (found.ocr && !found.pro && !found.sub) labels.push(t('paywall.ocr.tier'));

    if (labels.length) {
      _afterUnlock(t('iap.toast.restored', {labels: labels.join(' + ')}));
    } else {
      showToast(t('iap.toast.no_purchases'));
      if (btn) { btn.disabled = false; btn.textContent = t('btn.restore_purchases'); }
    }
  } catch (err) {
    const code = _errorCode(err);
    console.warn('[IAP] restorePurchases error:', code, err);
    _resetIfDisconnected(code);
    showToast(_messageForCode(code, 'iap.toast.restore_failed'));
    if (btn) { btn.disabled = false; btn.textContent = t('btn.restore_purchases'); }
  }
}

/* ─── Paywall ──────────────────────────────────────────────────────────── */
/* One paywall, not three. Both paid tiers now unlock everything that exists
   (§4), so splitting them across separate modals would ask the user to compare
   two things they cannot see at once. The lifetime option is listed first and
   preselected: §1.3 requires it stay prominently offered and genuinely
   purchasable, and the subscription is explicitly a price anchor for it — an
   anchor that buries what it is anchoring is where this would become a dark
   pattern. */
function showProPaywall(source) {
  showPaywall(source);
}

/* OCR has no paywall of its own any more — it is part of the lifetime product
   (§4) — so every former OCR gate lands on the same screen. */
function showOcrPaywall(source) {
  showPaywall(source);
}

function closeActiveModal() {
  const root = qs('#modal-root');
  if (!root) return;
  root.innerHTML = '';
  AppState.activeModal = null;
}

function _planRow(id, label, price, note, selected) {
  return '' +
    '<button class="paywall-plan' + (selected ? ' paywall-plan-selected' : '') + '" ' +
            'data-plan="' + id + '" role="radio" aria-checked="' + (selected ? 'true' : 'false') + '">' +
      '<span class="paywall-plan-main">' +
        '<span class="paywall-plan-label">' + escapeHtml(label) + '</span>' +
        '<span class="paywall-plan-price">' + escapeHtml(price) + '</span>' +
      '</span>' +
      '<span class="paywall-plan-note">' + escapeHtml(note) + '</span>' +
    '</button>';
}

function showPaywall(source) {
  const root = qs('#modal-root');
  if (!root) return;

  /* §9.6. pro_purchased had no denominator, so conversion was not merely
     unknown but unknowable. Logged before the redraw below can re-enter this
     function with the same paywall already on screen — otherwise a cold start
     whose prices arrive late would count the same impression twice and halve
     every conversion figure. */
  if (AppState.activeModal !== 'paywall' && typeof logEvent === 'function') {
    logEvent('paywall_shown', { source: source || 'unknown' });
  }

  closeActiveModal();
  AppState.activeModal = 'paywall';

  /* Plans are built from what the store actually offered this run. A base plan
     that is inactive in Play Console simply is not here — far better than a row
     that opens a sheet and fails (§1.5). Lifetime is always present: it is a
     one-time product whose price we can fall back on. */
  const annual  = _offerFor('year');
  const monthly = _offerFor('month');
  /* Snapshot before the re-query below, so a redraw only happens when something
     actually arrived — otherwise a store that never answers redraws forever. */
  const _prices_had_lifetime = !!_prices[PRODUCT_LIFETIME];

  /* §12's drops are the one thing a lifetime purchase does not include, so
     this is the one paywall where the lifetime row is wrong. Offering it to
     someone who already owns it — preselected, at the top, as §23 asks
     everywhere else — answers a tap on a drop card with the product that
     cannot unlock it. That is a confident wrong offer (§1.5) and reads as not
     knowing what they already paid for.

     `AppState.ownsLifetime`, not `isPro`: a subscriber is `isPro` too and must
     never land here at all. `debugForcedFree()` first, because §24's flag can
     only ever withhold — simulating the free tier must show the ordinary
     paywall, or the free-tier surfaces it exists to test cannot be seen. */
  const fromDrop = source === 'book-drop';
  const ownsLifetime = !debugForcedFree() && AppState.ownsLifetime;

  const defaultPlan = !ownsLifetime ? 'lifetime'
                    : annual ? 'year'
                    : monthly ? 'month' : null;

  let plans = '';
  if (!ownsLifetime) {
    plans += _planRow('lifetime', t('paywall.plan.lifetime.label'),
                      _prices[PRODUCT_LIFETIME] || '',
                      t('paywall.plan.lifetime.note'), defaultPlan === 'lifetime');
  }
  if (annual) {
    plans += _planRow('year', t('paywall.plan.annual.label'),
                      t('paywall.period.year', { price: annual.price }),
                      t('paywall.plan.annual.note'), defaultPlan === 'year');
  }
  if (monthly) {
    plans += _planRow('month', t('paywall.plan.monthly.label'),
                      t('paywall.period.month', { price: monthly.price }),
                      t('paywall.plan.monthly.note'), defaultPlan === 'month');
  }

  /* Said only when there is a subscription row to say it about, and it names
     the one thing the subscription actually adds over lifetime (§3).

     It used to read "the monthly and annual plans unlock the same tools" —
     true when written, false from the moment the drops existed, and the
     comment above it claimed the opposite of what the string said. Withheld
     from a lifetime owner, for whom the comparison is no longer a choice. */
  const subNote = (annual || monthly) && !ownsLifetime
    ? '<p class="paywall-sub-note">' + escapeHtml(t('paywall.plan.sub_extra')) + '</p>'
    : '';

  /* §23: name the thing the user is looking at. Arriving from a drop card and
     being sold "DOCX import" answers a different question than the one they
     asked. A lifetime owner is shown only the drops line, because the other
     four are things they bought long ago. */
  const features = ownsLifetime
    ? [t('paywall.drops.feature')]
    : (fromDrop ? [t('paywall.drops.feature')] : []).concat([
        t('paywall.unified.feature1'),
        t('paywall.unified.feature2'),
        t('paywall.unified.feature3'),
        t('paywall.unified.feature4'),
      ]);

  const title = fromDrop ? t('paywall.drops.title') : t('paywall.unified.title');
  const subtitle = ownsLifetime ? t('paywall.drops.owned_subtitle')
                 : fromDrop    ? t('paywall.drops.subtitle')
                 : t('paywall.unified.subtitle');

  /* Nothing to sell: Play returned no subscription offer at all. Said plainly
     rather than drawing an empty radio group with a live Continue (§1.5). */
  const nothingToSell = !plans;

  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-card paywall-card" role="dialog" aria-modal="true">
        <p class="modal-kicker">${escapeHtml(t('paywall.unified.kicker'))}</p>
        <h2 class="modal-title">${escapeHtml(title)}</h2>
        <p class="modal-body">${escapeHtml(subtitle)}</p>
        <ul class="modal-feature-list">
          ${features.map(function(f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('')}
        </ul>
        <div class="paywall-plans" role="radiogroup"
             aria-label="${escapeHtml(t('paywall.unified.plans_label'))}">${plans}</div>
        ${nothingToSell ? '<p class="paywall-sub-note">' + escapeHtml(t('paywall.drops.unavailable')) + '</p>' : subNote}
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-modal-close">${t('btn.not_now')}</button>
          ${nothingToSell ? '' : `<button class="btn btn-primary" id="btn-paywall-continue">${t('btn.continue')}</button>`}
        </div>
        <button class="btn btn-link modal-restore-btn" id="btn-modal-restore">${t('btn.restore_purchases')}</button>
      </div>
    </div>
  `;

  let selected = defaultPlan;

  qsa('.paywall-plan', root).forEach(function(row) {
    row.addEventListener('click', function() {
      selected = row.getAttribute('data-plan');
      qsa('.paywall-plan', root).forEach(function(other) {
        const on = other === row;
        other.classList.toggle('paywall-plan-selected', on);
        other.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    });
  });

  qs('#btn-modal-close').addEventListener('click', closeActiveModal);
  qs('#btn-modal-restore').addEventListener('click', restorePurchases);
  /* Absent when there is nothing to sell — a lifetime owner on a drop card
     while Play returns no subscription offer. */
  const continueBtn = qs('#btn-paywall-continue');
  if (continueBtn) {
    continueBtn.addEventListener('click', function() {
      if (!selected) return;
      if (selected === 'lifetime') buyLifetime();
      else buySubscription(selected);
    });
  }
  qs('#modal-backdrop').addEventListener('click', function(event) {
    if (event.target.id === 'modal-backdrop') closeActiveModal();
  });

  /* Prices may still be in flight on a cold start, and with no fallback a row can
     render bare. Re-query and redraw once anything is missing, so the figure
     someone decides on is always Play's own. */
  if (!_prices[PRODUCT_LIFETIME] || (!annual && !monthly)) {
    _fetchPrices().then(function() {
      if (AppState.activeModal !== 'paywall') return;
      const gained = (_prices[PRODUCT_LIFETIME] && !_prices_had_lifetime) ||
                     ((_offerFor('year') || _offerFor('month')) && !annual && !monthly);
      if (gained) showPaywall(source);
    }).catch(function() {});
  }
}

/* ─── Managing an existing subscription ────────────────────────────────── */
/* §1.3: cancellation must be genuinely one tap. Play's own subscription screen
   is where that happens — we deep-link straight to this product's entry rather
   than making the user go looking for it. */
function openSubscriptionManagement() {
  const url = 'https://play.google.com/store/account/subscriptions' +
              '?sku=' + PRODUCT_SUB + '&package=com.flowread.app';
  try {
    window.open(url, '_blank');
  } catch (_) {
    showToast(t('iap.toast.manage_sub_failed'));
  }
}

/* ─── Internal helpers ─────────────────────────────────────────────────── */
async function _ensureIap() {
  if (_iapInitialized) return;
  const ok = await initIAP();
  if (!ok) throw new Error('billing_unavailable');
}

async function _readyPlugin() {
  await _ensureIap();
  const plugin = _IapPlugin.get();
  if (!plugin) throw new Error('no_plugin');
  return plugin;
}

/* The native plugin rejects with a stable token in err.code (see
   FlowReadIapPlugin.tokenFor). Older payloads and our own local throws only
   carry a message, so fall back to that — but never to prose matching. */
function _errorCode(err) {
  if (err && typeof err.code === 'string' && err.code) return err.code;
  const msg = String((err && (err.message || err)) || '');
  if (msg.indexOf('USER_CANCELED') !== -1) return 'USER_CANCELED';
  if (msg === 'billing_unavailable' || msg === 'no_plugin') return 'NO_BILLING';
  if (msg === 'EMPTY_RESULT') return 'EMPTY_RESULT';
  if (msg === 'OFFER_NOT_LOADED') return 'OFFER_NOT_LOADED';
  return 'UNKNOWN';
}

/* Play's service can die mid-flow. The client is torn down natively, so the
   cached "initialized" flag has to go too or every later call fails. */
function _resetIfDisconnected(code) {
  if (code === 'SERVICE_DISCONNECTED' || code === 'SERVICE_UNAVAILABLE' ||
      code === 'NOT_INITIALIZED') {
    _iapInitialized = false;
  }
}

function _messageForCode(code, fallbackKey) {
  switch (code) {
    case 'ITEM_ALREADY_OWNED':   return t('iap.toast.already_owned');
    case 'NETWORK_ERROR':        return t('iap.toast.network_error');
    case 'SERVICE_DISCONNECTED':
    case 'SERVICE_UNAVAILABLE':  return t('iap.toast.service_disconnected');
    case 'BILLING_UNAVAILABLE':  return t('iap.toast.billing_unavailable');
    case 'ITEM_UNAVAILABLE':     return t('iap.toast.item_unavailable');
    case 'DEVELOPER_ERROR':
    case 'FEATURE_NOT_SUPPORTED':return t('iap.toast.config_error');
    case 'NO_BILLING':
    case 'NOT_INITIALIZED':      return t('iap.toast.store_unavailable');
    case 'PRODUCT_NOT_LOADED':   return t('iap.toast.product_not_found');
    /* The plan exists in our UI but Play has no active offer for it — nearly
       always a base plan that was never activated in Play Console. */
    case 'OFFER_NOT_LOADED':     return t('iap.toast.plan_unavailable');
    default:                     return t(fallbackKey);
  }
}

function _handlePurchaseError(err, btn, btnLabel) {
  const code = _errorCode(err);
  if (btn) { btn.disabled = false; btn.textContent = btnLabel; }

  /* Cancelling is a choice, not a failure — stays silent (§3.1). */
  if (code === 'USER_CANCELED') return;

  console.warn('[IAP] purchase error:', code, err);
  _resetIfDisconnected(code);

  if (code === 'ITEM_ALREADY_OWNED') {
    // Play says this account owns the product but we could not read the record
    // back. Restoring is the actual remedy — don't tell an owner they failed.
    showToast(t('iap.toast.already_owned'));
    restorePurchases();
    return;
  }

  showToast(_messageForCode(code, 'iap.toast.purchase_failed'));
}

let _disconnectListenerBound = false;
function _listenForDisconnect(plugin) {
  if (_disconnectListenerBound || !plugin || typeof plugin.addListener !== 'function') return;
  _disconnectListenerBound = true;
  try {
    plugin.addListener('billingDisconnected', function() {
      console.warn('[IAP] billing service disconnected — will re-init on next use');
      _iapInitialized = false;
    });
  } catch (_) {
    _disconnectListenerBound = false;
  }
}
