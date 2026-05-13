async function hasProAccess() {
  const access = (await loadPurchaseState('pro')) === 'true';
  AppState.isPro = access;
  return access;
}

async function hasOcrAccess() {
  return (await loadPurchaseState('ocr')) === 'true';
}

function closeActiveModal() {
  const root = qs('#modal-root');
  if (!root) return;
  root.innerHTML = '';
  AppState.activeModal = null;
}

function showProPaywall(source) {
  showPaywall({
    tier: 'Pro',
    title: 'Unlock Pro',
    subtitle: 'DOCX, TXT, URL Reader, dashboard, themes, and future pro tools.',
    price: 'Android $24.99 · iOS $39.99',
    source: source || 'unknown',
    features: [
      'URL Reader for compatible articles',
      'DOCX and TXT import',
      'Dashboard, themes, and advanced tools',
      'One-time purchase. No subscription.',
    ],
  });
}

function showOcrPaywall(source) {
  showPaywall({
    tier: 'OCR Vision',
    title: 'Unlock OCR Vision',
    subtitle: 'Read scanned and image-based PDFs on this device.',
    price: '$9.99 lifetime add-on',
    source: source || 'unknown',
    features: [
      'Scanned PDF support',
      'On-device OCR processing',
      'One-time purchase. No subscription.',
    ],
  });
}

function showPaywall(options) {
  const root = qs('#modal-root');
  if (!root) return;

  closeActiveModal();
  AppState.activeModal = options.tier;

  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-card paywall-card" role="dialog" aria-modal="true">
        <p class="modal-kicker">${escapeHtml(options.tier)}</p>
        <h2 class="modal-title">${escapeHtml(options.title)}</h2>
        <p class="modal-body">${escapeHtml(options.subtitle)}</p>
        <ul class="modal-feature-list">
          ${options.features.map(function(feature) {
            return `<li>${escapeHtml(feature)}</li>`;
          }).join('')}
        </ul>
        <p class="modal-price">${escapeHtml(options.price)}</p>
        <p class="modal-note">Opened from: ${escapeHtml(options.source)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-modal-close">Not now</button>
          <button class="btn btn-primary" id="btn-modal-unlock">Unlock ${escapeHtml(options.tier)}</button>
        </div>
      </div>
    </div>
  `;

  qs('#btn-modal-close').addEventListener('click', closeActiveModal);
  qs('#btn-modal-unlock').addEventListener('click', function() {
    showToast(options.tier + ' purchase flow arrives in v1.1.');
  });
  qs('#modal-backdrop').addEventListener('click', function(event) {
    if (event.target.id === 'modal-backdrop') closeActiveModal();
  });
}
