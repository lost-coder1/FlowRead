/* IAP feature module — Google Play Billing 7 via FlowReadIapPlugin */
/* Purchase state stored exclusively in Capacitor Preferences via storage.js */

const _IapPlugin = (function() {
  function get() {
    return window.Capacitor &&
           window.Capacitor.Plugins &&
           window.Capacitor.Plugins.FlowReadIap || null;
  }
  return { get: get };
})();

/* Store-fetched prices; fallbacks shown if queryProducts hasn't completed yet */
const _prices = {
  pro_lifetime: '$9.99',
  ocr_vision:   '$4.99',
};

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
    const result = await plugin.queryProducts();
    const products = (result && result.products) || [];
    products.forEach(function(p) {
      if (p.id && p.price) _prices[p.id] = p.price;
    });
  } catch (_) {}
}

/* ─── State accessors ──────────────────────────────────────────────────── */
async function hasProAccess() {
  const access = (await loadPurchaseState('pro')) === 'true';
  AppState.isPro = access;
  return access;
}

async function hasOcrAccess() {
  return (await loadPurchaseState('ocr')) === 'true';
}

/* ─── Purchase flows ───────────────────────────────────────────────────── */
async function buyPro() {
  const btn = qs('#btn-modal-unlock');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening store…'; }

  try {
    await _ensureIap();
    const plugin = _IapPlugin.get();
    if (!plugin) throw new Error('no_plugin');

    await plugin.queryProducts();

    const result = await plugin.purchaseProduct({ productId: 'pro_lifetime' });
    const productIds = (result && result.productIds) || [];
    if (productIds.indexOf('pro_lifetime') !== -1) {
      await savePurchaseState('pro', 'true');
      AppState.isPro = true;
      applyTheme(AppState.settings.theme);
      applyTypography(AppState.settings.fontPreset);
      syncThemeChips();
      syncTypographyChips();
      closeActiveModal();
      showToast('Pro unlocked. Thank you!');
    }
  } catch (err) {
    _handlePurchaseError(err, btn, 'Unlock Pro');
  }
}

async function buyOcr() {
  const pro = await hasProAccess();
  if (!pro) {
    closeActiveModal();
    showProPaywall('ocr-gate');
    return;
  }

  const btn = qs('#btn-modal-unlock');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening store…'; }

  try {
    await _ensureIap();
    const plugin = _IapPlugin.get();
    if (!plugin) throw new Error('no_plugin');

    await plugin.queryProducts();

    const result = await plugin.purchaseProduct({ productId: 'ocr_vision' });
    const productIds = (result && result.productIds) || [];
    if (productIds.indexOf('ocr_vision') !== -1) {
      await savePurchaseState('ocr', 'true');
      closeActiveModal();
      showToast('OCR Vision unlocked. Thank you!');
    }
  } catch (err) {
    _handlePurchaseError(err, btn, 'Unlock OCR Vision');
  }
}

/* ─── restorePurchases ─────────────────────────────────────────────────── */
async function restorePurchases() {
  const btn = qs('#btn-modal-restore') || qs('#btn-settings-restore');
  if (btn) { btn.disabled = true; btn.textContent = 'Restoring…'; }

  try {
    await _ensureIap();
    const plugin = _IapPlugin.get();
    if (!plugin) throw new Error('no_plugin');

    const result = await plugin.queryPurchases();
    const purchases = (result && result.purchases) || [];

    let restoredPro = false;
    let restoredOcr = false;

    for (var i = 0; i < purchases.length; i++) {
      const p = purchases[i];
      if (p.productId === 'pro_lifetime') {
        await savePurchaseState('pro', 'true');
        AppState.isPro = true;
        restoredPro = true;
      }
      if (p.productId === 'ocr_vision') {
        await savePurchaseState('ocr', 'true');
        restoredOcr = true;
      }
    }

    if (restoredPro || restoredOcr) {
      const labels = [];
      if (restoredPro) labels.push('Pro');
      if (restoredOcr) labels.push('OCR Vision');
      applyTheme(AppState.settings.theme);
      applyTypography(AppState.settings.fontPreset);
      syncThemeChips();
      syncTypographyChips();
      closeActiveModal();
      showToast(labels.join(' + ') + ' restored successfully.');
    } else {
      showToast('No previous purchases found for this account.');
      if (btn) { btn.disabled = false; btn.textContent = btn.id === 'btn-settings-restore' ? 'Restore Purchases' : 'Restore Purchases'; }
    }
  } catch (err) {
    console.warn('[IAP] restorePurchases error:', err);
    showToast('Could not restore purchases. Please check your connection and try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Restore Purchases'; }
  }
}

/* ─── Paywall modals ───────────────────────────────────────────────────── */
function showProPaywall(source) {
  showPaywall({
    tier: 'Pro',
    productId: 'pro_lifetime',
    title: 'Unlock Pro',
    subtitle: 'DOCX, TXT, URL Reader, dashboard, themes, and future pro tools.',
    source: source || 'unknown',
    features: [
      'URL Reader for compatible articles',
      'DOCX and TXT import',
      'Dashboard, themes, and advanced tools',
      'One-time purchase. No subscription.',
    ],
    onUnlock: buyPro,
  });
}

function showOcrPaywall(source) {
  showPaywall({
    tier: 'OCR Vision',
    productId: 'ocr_vision',
    title: 'Unlock OCR Vision',
    subtitle: 'Read scanned and image-based PDFs on this device.',
    source: source || 'unknown',
    features: [
      'Scanned PDF support (Latin + Hindi/Devanagari)',
      'Fully on-device — no internet required',
      'One-time purchase. No subscription.',
      'Requires Pro (' + _prices['pro_lifetime'] + ') + OCR Vision (' + _prices['ocr_vision'] + ').',
    ],
    onUnlock: buyOcr,
  });
}

function closeActiveModal() {
  const root = qs('#modal-root');
  if (!root) return;
  root.innerHTML = '';
  AppState.activeModal = null;
}

function showPaywall(options) {
  const root = qs('#modal-root');
  if (!root) return;

  closeActiveModal();
  AppState.activeModal = options.tier;

  const price = _prices[options.productId] || '';
  const priceHtml = price
    ? '<p class="modal-price">' + escapeHtml(price) + ' — one-time</p>'
    : '';

  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-card paywall-card" role="dialog" aria-modal="true">
        <p class="modal-kicker">${escapeHtml(options.tier)}</p>
        <h2 class="modal-title">${escapeHtml(options.title)}</h2>
        <p class="modal-body">${escapeHtml(options.subtitle)}</p>
        <ul class="modal-feature-list">
          ${options.features.map(function(f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('')}
        </ul>
        ${priceHtml}
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-modal-close">Not now</button>
          <button class="btn btn-primary" id="btn-modal-unlock">Unlock ${escapeHtml(options.tier)}</button>
        </div>
        <button class="btn btn-link modal-restore-btn" id="btn-modal-restore">Restore Purchases</button>
      </div>
    </div>
  `;

  qs('#btn-modal-close').addEventListener('click', closeActiveModal);
  qs('#btn-modal-unlock').addEventListener('click', options.onUnlock);
  qs('#btn-modal-restore').addEventListener('click', restorePurchases);
  qs('#modal-backdrop').addEventListener('click', function(event) {
    if (event.target.id === 'modal-backdrop') closeActiveModal();
  });
}

/* ─── Internal helpers ─────────────────────────────────────────────────── */
async function _ensureIap() {
  if (_iapInitialized) return;
  const ok = await initIAP();
  if (!ok) throw new Error('billing_unavailable');
}

function _handlePurchaseError(err, btn, btnLabel) {
  const errStr = String(err && (err.message || err));
  if (errStr === 'USER_CANCELED' || errStr.indexOf('USER_CANCELED') !== -1) {
    if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
    return;
  }
  console.warn('[IAP] purchase error:', err);
  if (btn) { btn.disabled = false; btn.textContent = btnLabel; }

  if (errStr === 'billing_unavailable' || errStr === 'no_plugin') {
    showToast('Store is not available. Please check your connection.');
  } else if (errStr.indexOf('not found') !== -1 || errStr.indexOf('queryProducts') !== -1) {
    showToast('Product not found. Please try again later.');
  } else {
    showToast('Purchase could not be completed. Please try again.');
  }
}
