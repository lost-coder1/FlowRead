const FlowReadContent = {
  limitations: [
    {
      title: 'Scanned PDFs',
      body: 'Free version reads only digital text (PDFs where you can highlight words in any normal viewer). Image-based scans require OCR Vision upgrade.',
    },
    {
      title: 'DRM-protected files',
      body: 'Kindle (.azw), Adobe Digital Editions, and other DRM-locked files cannot be read. Clear error message shown on import attempt. We do not provide DRM removal advice.',
    },
    {
      title: 'Multi-column documents',
      body: 'Two-column academic papers (IEEE, ACM format) may have reading-order issues. Recommend Focus Bold mode for these.',
    },
    {
      title: 'Tables and images',
      body: 'Not read word-by-word. Shown as [Object — Tap to View] placeholders in the speed reading stream when detected. Some uncommon table designs, especially wide horizontal layouts, may not be detected correctly. Tap to view the original in Normal View.',
    },
    {
      title: 'Math equations',
      body: 'Skipped or shown as [Equation — Tap to View] placeholders.',
    },
    {
      title: 'Handwriting',
      body: 'App is designed for printed text. Cursive or handwritten notes will not parse accurately, even with OCR.',
    },
    {
      title: 'Password-protected PDFs',
      body: 'Detected at import. Clear error message: "This PDF is password-protected. Please remove the password and re-import."',
    },
    {
      title: 'RTL languages',
      body: 'Currently optimised for left-to-right languages only. Arabic, Hebrew, Urdu support planned for v2.',
    },
    {
      title: 'Offline dictionary coverage',
      body: 'Pro tier dictionary contains ~150k common words. Specialised medical, legal, or technical terms may not be found. System dictionary fallback is available on iOS and Android.',
    },
    {
      title: 'URL reader (Pro)',
      body: 'Requires internet for the initial article fetch. Parsing happens locally on device. Article content is never transmitted to any server we control. Even with internet, some sites cannot be imported because of paywalls, login walls, bot protection, blocked fetching, or unsupported page structure. URL import errors must say which failure category occurred in plain language.',
    },
  ],
  urlFailurePolicy: 'URL import errors must state the real failure category in plain language: invalid URL, no internet, timed out, blocked by site, paywalled article, login required, unsupported page structure, or no readable article text found.',
  calibrationSample: [
    'FlowRead is built for readers who want less friction and more momentum.',
    'The goal of this calibration is not to impress you with a big number.',
    'It is to help you find a pace that feels steady, legible, and calm.',
    'Raise the speed until comprehension starts to slip, then back off slightly.',
    'That number is a better starting point than chasing an arbitrary target.',
    'You can change it anytime later from Settings.',
  ].join(' '),
};

function getDefaultSettings() {
  return {
    defaultWpm: 260,
    defaultChunkSize: 3,
    defaultMode: 'rsvp',
    fontScale: 1,
    theme: 'oled-black',
    orpDefault: true,
    contextDefault: false,
    calmModeDefault: false,
  };
}

function getSettings() {
  return Object.assign({}, getDefaultSettings(), loadSettings());
}

function updateSetting(key, value) {
  AppState.settings[key] = value;
  saveSettings(AppState.settings);
}

function renderOnboarding(stepIndex) {
  closeActiveModal();
  const view = qs('#view-onboarding');
  if (!view) return;

  const settings = getSettings();
  AppState.settings = settings;
  AppState.onboardingCalibrationWpm = 200;
  const step = Math.max(0, Math.min(3, stepIndex || 0));

  if (step === 0) {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">First Launch</p>
          <h1 class="onboarding-title">Read everything faster.</h1>
          <p class="onboarding-body">No subscription. No cloud. No account. Your files stay on this device.</p>
          <div class="onboarding-actions">
            <button class="btn btn-primary" id="btn-onboarding-next">Continue</button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 1) {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">What It Can Read</p>
          <h1 class="onboarding-title">Fast reading for digital PDFs.</h1>
          <ul class="onboarding-list">
            <li>PDFs with selectable text in all 4 reading engines.</li>
            <li>Normal PDF view with jump-to-reader sync.</li>
            <li>Chapter detection, resume position, and local progress.</li>
            <li>URL Reader is available in Pro and requires internet for the initial fetch.</li>
          </ul>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onboarding-back">Back</button>
            <button class="btn btn-primary" id="btn-onboarding-next">Continue</button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 2) {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card onboarding-card-wide">
          <p class="onboarding-kicker">Known Limitations</p>
          <h1 class="onboarding-title">What this app cannot do yet.</h1>
          <ol class="limitations-list">
            ${FlowReadContent.limitations.map(function(item) {
              return `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.body)}</li>`;
            }).join('')}
          </ol>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onboarding-back">Back</button>
            <button class="btn btn-primary" id="btn-onboarding-next">Continue</button>
          </div>
        </div>
      </div>
    `;
  } else {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card onboarding-card-wide">
          <p class="onboarding-kicker">Reading Speed</p>
          <h1 class="onboarding-title">Pick a comfortable starting pace.</h1>
          <p class="onboarding-body">Watch the sample text move for about 30 seconds, then adjust until it feels sustainable.</p>
          <div class="calibration-stage">
            <div class="calibration-viewport">
              <div class="calibration-track" id="calibration-track">
                <p>${escapeHtml(FlowReadContent.calibrationSample)}</p>
                <p>${escapeHtml(FlowReadContent.calibrationSample)}</p>
              </div>
            </div>
            <div class="calibration-controls">
              <button class="btn btn-ghost" id="btn-calibration-dec">−</button>
              <input type="range" id="calibration-slider" min="120" max="600" step="10" value="${AppState.onboardingCalibrationWpm}" />
              <button class="btn btn-ghost" id="btn-calibration-inc">+</button>
              <span class="wpm-display" id="calibration-display">${formatWPM(AppState.onboardingCalibrationWpm)}</span>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onboarding-back">Back</button>
            <button class="btn btn-primary" id="btn-onboarding-finish">Finish</button>
          </div>
        </div>
      </div>
    `;
  }

  switchView('view-onboarding');
  bindOnboarding(step);
}

function bindOnboarding(step) {
  const next = qs('#btn-onboarding-next');
  const back = qs('#btn-onboarding-back');
  const finish = qs('#btn-onboarding-finish');

  if (next) next.addEventListener('click', function() { renderOnboarding(step + 1); });
  if (back) back.addEventListener('click', function() { renderOnboarding(step - 1); });
  if (finish) {
    finish.addEventListener('click', function() {
      updateSetting('defaultWpm', AppState.onboardingCalibrationWpm);
      saveWPM(AppState.onboardingCalibrationWpm);
      AppState.wpm = AppState.onboardingCalibrationWpm;
      saveOnboardingComplete();
      renderUpload();
      switchView('view-upload');
    });
  }

  if (step === 3) {
    startCalibrationPreview();
    const slider = qs('#calibration-slider');
    const display = qs('#calibration-display');

    function applyCalibration(value) {
      AppState.onboardingCalibrationWpm = value;
      if (slider) slider.value = value;
      if (display) display.textContent = formatWPM(value);
    }

    slider.addEventListener('input', function() {
      applyCalibration(parseInt(this.value, 10));
    });
    qs('#btn-calibration-dec').addEventListener('click', function() {
      applyCalibration(Math.max(120, AppState.onboardingCalibrationWpm - 10));
    });
    qs('#btn-calibration-inc').addEventListener('click', function() {
      applyCalibration(Math.min(600, AppState.onboardingCalibrationWpm + 10));
    });
  } else {
    stopCalibrationPreview();
  }
}

function startCalibrationPreview() {
  stopCalibrationPreview();
  const track = qs('#calibration-track');
  if (!track) return;

  let offset = 0;
  let last = 0;

  function step(now) {
    if (!qs('#view-onboarding') || AppState.currentView !== 'view-onboarding') return;
    if (!last) last = now;
    const elapsed = now - last;
    last = now;

    const pxPerSecond = Math.max(14, AppState.onboardingCalibrationWpm * 0.12);
    offset += (elapsed / 1000) * pxPerSecond;
    track.style.transform = 'translateY(-' + offset.toFixed(2) + 'px)';

    const resetPoint = track.scrollHeight / 2;
    if (offset >= resetPoint) {
      offset = 0;
      track.style.transform = 'translateY(0)';
    }

    window._calibrationRaf = requestAnimationFrame(step);
  }

  window._calibrationRaf = requestAnimationFrame(step);
}

function stopCalibrationPreview() {
  if (window._calibrationRaf) {
    cancelAnimationFrame(window._calibrationRaf);
    window._calibrationRaf = null;
  }
}

function renderSettings() {
  closeActiveModal();
  const view = qs('#view-settings');
  if (!view) return;

  AppState.settings = getSettings();

  view.innerHTML = `
    <div class="settings-screen">
      <div class="settings-header">
        <button class="btn btn-ghost" id="btn-settings-back">←</button>
        <div>
          <p class="settings-kicker">Settings</p>
          <h1 class="settings-title">Preferences</h1>
        </div>
      </div>

      <section class="settings-section">
        <h2>Reading</h2>
        <label class="settings-field">
          <span>Default WPM</span>
          <input type="range" id="settings-wpm" min="120" max="800" step="10" value="${AppState.settings.defaultWpm}" />
          <strong id="settings-wpm-value">${formatWPM(AppState.settings.defaultWpm)}</strong>
        </label>
        <label class="settings-field">
          <span>Default chunk size</span>
          <select id="settings-chunk-size">
            ${[2, 3, 4, 5, 7].map(function(size) {
              return `<option value="${size}" ${AppState.settings.defaultChunkSize === size ? 'selected' : ''}>${size} words</option>`;
            }).join('')}
          </select>
        </label>
        <label class="settings-field">
          <span>Default mode</span>
          <select id="settings-default-mode">
            <option value="rsvp" ${AppState.settings.defaultMode === 'rsvp' ? 'selected' : ''}>RSVP</option>
            <option value="chunk" ${AppState.settings.defaultMode === 'chunk' ? 'selected' : ''}>Chunk</option>
            <option value="focus" ${AppState.settings.defaultMode === 'focus' ? 'selected' : ''}>Focus Bold</option>
            <option value="scroll" ${AppState.settings.defaultMode === 'scroll' ? 'selected' : ''}>Simple Scroll</option>
          </select>
        </label>
      </section>

      <section class="settings-section">
        <h2>Display</h2>
        <label class="settings-field">
          <span>Font scale</span>
          <input type="range" id="settings-font-scale" min="0.85" max="1.25" step="0.05" value="${AppState.settings.fontScale}" />
          <strong id="settings-font-scale-value">${Math.round(AppState.settings.fontScale * 100)}%</strong>
        </label>
        <div class="settings-theme-list">
          <button class="settings-theme-chip active" type="button">OLED Black</button>
          <button class="settings-theme-chip locked" type="button" data-pro-source="theme-sepia">Sepia 🔒</button>
          <button class="settings-theme-chip locked" type="button" data-pro-source="theme-contrast">High Contrast 🔒</button>
        </div>
      </section>

      <section class="settings-section">
        <h2>Comfort</h2>
        <label class="settings-toggle">
          <span>ORP highlight on by default</span>
          <input type="checkbox" id="settings-orp" ${AppState.settings.orpDefault ? 'checked' : ''} />
        </label>
        <label class="settings-toggle">
          <span>Context line on by default</span>
          <input type="checkbox" id="settings-context" ${AppState.settings.contextDefault ? 'checked' : ''} />
        </label>
        <label class="settings-toggle">
          <span>Calm mode on by default</span>
          <input type="checkbox" id="settings-calm" ${AppState.settings.calmModeDefault ? 'checked' : ''} />
        </label>
      </section>

      <section class="settings-section">
        <h2>Supported Formats & Known Limitations</h2>
        <ol class="limitations-list settings-limitations">
          ${FlowReadContent.limitations.map(function(item) {
            return `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.body)}</li>`;
          }).join('')}
        </ol>
        <p class="settings-note">${escapeHtml(FlowReadContent.urlFailurePolicy)}</p>
      </section>

      <section class="settings-section">
        <h2>About</h2>
        <p class="settings-copy">Version 1.0.0 MVP</p>
        <p class="settings-copy">This app collects no data. There is no account, no analytics backend, and no file upload to any server we control.</p>
        <p class="settings-copy">URL Reader is Pro-only and clearly marked when it requires internet.</p>
      </section>

      <section class="settings-section">
        <h2>Developer</h2>
        <p class="settings-copy text-muted">Test mode only. Not a real purchase. Toggle resets if app data is cleared.</p>
        <label class="settings-toggle">
          <span>Unlock Pro (Test mode — not a real purchase)</span>
          <input type="checkbox" id="settings-dev-pro" />
        </label>
      </section>
    </div>
  `;

  const devProEl = qs('#settings-dev-pro');
  if (devProEl) devProEl.checked = loadDevProBypass();

  switchView('view-settings');
  bindSettings();
}

function bindSettings() {
  qs('#btn-settings-back').addEventListener('click', function() {
    renderUpload();
    switchView('view-upload');
  });

  const wpm = qs('#settings-wpm');
  const wpmValue = qs('#settings-wpm-value');
  wpm.addEventListener('input', function() {
    const value = parseInt(this.value, 10);
    wpmValue.textContent = formatWPM(value);
    updateSetting('defaultWpm', value);
    saveWPM(value);
    AppState.wpm = value;
  });

  const fontScale = qs('#settings-font-scale');
  const fontScaleValue = qs('#settings-font-scale-value');
  fontScale.addEventListener('input', function() {
    const value = parseFloat(this.value);
    fontScaleValue.textContent = Math.round(value * 100) + '%';
    updateSetting('fontScale', value);
  });

  qs('#settings-chunk-size').addEventListener('change', function() {
    updateSetting('defaultChunkSize', parseInt(this.value, 10));
  });

  qs('#settings-default-mode').addEventListener('change', function() {
    updateSetting('defaultMode', this.value);
  });

  qs('#settings-orp').addEventListener('change', function() {
    updateSetting('orpDefault', this.checked);
  });

  qs('#settings-context').addEventListener('change', function() {
    updateSetting('contextDefault', this.checked);
  });

  qs('#settings-calm').addEventListener('change', function() {
    updateSetting('calmModeDefault', this.checked);
  });

  qsa('[data-pro-source]').forEach(function(button) {
    button.addEventListener('click', function() {
      showProPaywall(this.dataset.proSource);
    });
  });

  const devPro = qs('#settings-dev-pro');
  if (devPro) {
    devPro.addEventListener('change', function() {
      saveDevProBypass(this.checked);
      showToast(this.checked
        ? 'Pro test mode ON — go back to home to see unlocked features.'
        : 'Pro test mode OFF.');
    });
  }
}
