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
      title: 'OCR accuracy (Image / Scan)',
      body: 'On-device OCR works best on flat, well-lit printed text photographed straight-on. Accuracy drops significantly with low light, skewed angles, small font sizes, or decorative fonts. Take a clear photo in good lighting for best results.',
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
      body: 'Requires internet for the initial article fetch. Parsing happens locally on device. Article content is never transmitted to any server we control. Even with internet, some sites cannot be imported because of paywalls, login walls, bot protection, blocked fetching, or unsupported page structure.',
    },
  ],
  calibrationSample: [
    'FlowRead is built for readers who want less friction and more momentum.',
    'The goal of this calibration is not to impress you with a big number.',
    'It is to help you find a pace that feels steady, legible, and calm.',
    'Raise the speed until comprehension starts to slip, then back off slightly.',
    'That number is a better starting point than chasing an arbitrary target.',
    'You can change it anytime later from Settings.',
  ].join(' '),
  calibrationTiers: {
    slow: 'You are reading this at a comfortable pace. Every word lands clearly. You have time to build a mental picture as you go. This is a great starting point for longer reading sessions where you want full comprehension. Books, articles, research papers — at this speed nothing slips past you. You will finish more than you think. The goal is not to rush. The goal is to keep moving without losing the thread. Comfortable and steady wins.',
    medium: 'You are tracking this at a solid reading pace. Most trained readers live here. You are picking up meaning word by word without effort. This is the zone where reading feels effortless and comprehension stays high. You can push slightly faster and still follow everything. Try it. If you feel yourself re-reading words mentally, back off ten notches. If everything lands on the first pass, you may have room to go faster. Trust your instincts.',
    fast: 'You are moving quickly now. This is the zone where practice separates good readers from great ones. Your eyes are locked on the centre. Your brain is processing before the next word arrives. Comprehension is still there but it takes focus. You cannot let your mind drift. Distractions cost you more at this speed. If you felt you missed a word just now, you probably did. That is normal here. With practice this speed starts to feel easy.',
    veryFast: 'This is pushing the upper edge of comfortable reading for most people. Words are arriving fast. Your brain is making predictions and filling gaps rather than reading every single word deliberately. Some readers train to this level over months. If you are comprehending everything here, this is your zone. If words are blurring together or meaning is slipping, drop back twenty notches. Speed without comprehension is just watching words go by. Find the edge where you are still in control.',
  },
};

const FlowReadThemes = [
  { key: 'oled-black',    label: 'OLED Black',    labelKey: 'theme.oled_black',    proOnly: false },
  { key: 'sepia',         label: 'Sepia',          labelKey: 'theme.sepia',          proOnly: true  },
  { key: 'high-contrast', label: 'High Contrast',  labelKey: 'theme.high_contrast',  proOnly: true  },
];

const FlowReadTypographyPresets = [
  { key: 'roboto',       label: 'Roboto',        labelKey: 'font.roboto',       proOnly: false },
  { key: 'inter',        label: 'Inter',          labelKey: 'font.inter',        proOnly: true  },
  { key: 'source-sans',  label: 'Sans Serif',     labelKey: 'font.source_sans',  proOnly: true  },
  { key: 'open-sans',    label: 'Open Sans',      labelKey: 'font.open_sans',    proOnly: true  },
  { key: 'lato',         label: 'Lato',           labelKey: 'font.lato',         proOnly: true  },
];

function getDefaultSettings() {
  return {
    defaultWpm: 260,
    defaultChunkSize: 3,
    defaultMode: 'rsvp',
    fontScale: 1,
    fontPreset: 'roboto',
    theme: 'oled-black',
    orpDefault: true,
    contextDefault: false,
    calmModeDefault: false,
    reminderEnabled: true,
    reminderTime: '21:00',
    streakNudgeEnabled: true,
    wordTapAction: 'none',
    wordTapLongpress: true,
  };
}

function getSettings() {
  return Object.assign({}, getDefaultSettings(), loadSettings());
}

function updateSetting(key, value) {
  AppState.settings[key] = value;
  saveSettings(AppState.settings);
}

function isThemeUnlocked(themeKey, hasPro) {
  const theme = FlowReadThemes.find(function(item) {
    return item.key === themeKey;
  }) || FlowReadThemes[0];
  return !theme.proOnly || hasPro === true;
}

function getEffectiveTheme(themeKey, hasPro) {
  if (isThemeUnlocked(themeKey, hasPro)) return themeKey;
  return 'oled-black';
}

function isTypographyPresetUnlocked(fontKey, hasPro) {
  const preset = FlowReadTypographyPresets.find(function(item) {
    return item.key === fontKey;
  }) || FlowReadTypographyPresets[0];
  return !preset.proOnly || hasPro === true;
}

function getEffectiveFontPreset(fontKey, hasPro) {
  if (isTypographyPresetUnlocked(fontKey, hasPro)) return fontKey;
  return 'roboto';
}

function applyTheme(themeKey) {
  const theme = getEffectiveTheme(themeKey, AppState.isPro);
  document.body.setAttribute('data-theme', theme);
  return theme;
}

function applyTypography(fontKey) {
  const preset = getEffectiveFontPreset(fontKey, AppState.isPro);
  document.body.setAttribute('data-font', preset);
  return preset;
}

function syncThemeChips() {
  const activeTheme = getEffectiveTheme(AppState.settings.theme, AppState.isPro);
  qsa('[data-theme-value]').forEach(function(button) {
    const themeKey = button.dataset.themeValue;
    const locked = !isThemeUnlocked(themeKey, AppState.isPro);
    const isActive = themeKey === activeTheme;

    button.classList.toggle('active', isActive);
    button.classList.toggle('locked', locked);
    button.disabled = locked;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('aria-disabled', locked ? 'true' : 'false');
    const themeItem = FlowReadThemes.find(function(item) { return item.key === themeKey; });
    button.textContent = t(themeItem.labelKey) + (locked ? ' 🔒' : '');
  });
}

function syncTypographyChips() {
  const activePreset = getEffectiveFontPreset(AppState.settings.fontPreset, AppState.isPro);
  qsa('[data-font-value]').forEach(function(button) {
    const fontKey = button.dataset.fontValue;
    const locked = !isTypographyPresetUnlocked(fontKey, AppState.isPro);
    const isActive = fontKey === activePreset;

    button.classList.toggle('active', isActive);
    button.classList.toggle('locked', locked);
    button.disabled = locked;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('aria-disabled', locked ? 'true' : 'false');
    const fontItem = FlowReadTypographyPresets.find(function(item) { return item.key === fontKey; });
    button.textContent = t(fontItem.labelKey) + (locked ? ' 🔒' : '');
  });
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
          <p class="onboarding-kicker">${t('onboarding.step0.kicker')}</p>
          <h1 class="onboarding-title">${t('onboarding.step0.title')}</h1>
          <p class="onboarding-body">${t('onboarding.step0.body')}</p>
          <div class="onboarding-actions">
            <button class="btn btn-primary" id="btn-onboarding-next">${t('btn.continue')}</button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 1) {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">${t('onboarding.step1.kicker')}</p>
          <h1 class="onboarding-title">${t('onboarding.step1.title')}</h1>
          <ul class="onboarding-list">
            <li><strong>PDF</strong> — ${escapeHtml(t('onboarding.step1.pdf').replace(/^PDF — /, ''))}</li>
            <li><strong>Paste Text</strong> — ${escapeHtml(t('onboarding.step1.paste').replace(/^Paste Text — /, ''))}</li>
            <li><strong>URL Reader</strong> — ${escapeHtml(t('onboarding.step1.url').replace(/^URL Reader — /, ''))}</li>
            <li><strong>DOCX</strong> — ${escapeHtml(t('onboarding.step1.docx').replace(/^DOCX — /, ''))}</li>
            <li><strong>TXT</strong> — ${escapeHtml(t('onboarding.step1.txt').replace(/^TXT — /, ''))}</li>
            <li><strong>Image / Scan</strong> — ${escapeHtml(t('onboarding.step1.image').replace(/^Image \/ Scan — /, ''))}</li>
            <li>${escapeHtml(t('onboarding.step1.engines'))}</li>
            <li>${escapeHtml(t('onboarding.step1.features'))}</li>
          </ul>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onboarding-back">${t('btn.back')}</button>
            <button class="btn btn-primary" id="btn-onboarding-next">${t('btn.continue')}</button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 2) {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card onboarding-card-wide">
          <p class="onboarding-kicker">${t('onboarding.step2.kicker')}</p>
          <h1 class="onboarding-title">${t('onboarding.step2.title')}</h1>
          <ol class="limitations-list">
            ${FlowReadContent.limitations.map(function(item, i) {
              const bodyKey = 'limitations.' + (i+1) + '.body';
              const bodyText = t(bodyKey);
              return `<li><strong>${escapeHtml(t('limitations.' + (i+1) + '.title'))}</strong> — ${escapeHtml(bodyText === bodyKey ? item.body : bodyText)}</li>`;
            }).join('')}
          </ol>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onboarding-back">${t('btn.back')}</button>
            <button class="btn btn-primary" id="btn-onboarding-next">${t('btn.continue')}</button>
          </div>
        </div>
      </div>
    `;
  } else {
    view.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-card onboarding-card-wide">
          <p class="onboarding-kicker">${t('onboarding.step3.kicker')}</p>
          <h1 class="onboarding-title">${t('onboarding.step3.title')}</h1>
          <p class="onboarding-body">${t('onboarding.step3.body')}</p>
          <div class="calibration-rsvp-container">
            <div class="calibration-rsvp-stage" id="calibration-rsvp-stage">
              <span class="calibration-rsvp-word" id="calibration-rsvp-word">—</span>
            </div>
          </div>
          <div class="calibration-controls">
            <button class="btn btn-ghost" id="btn-calibration-dec">−</button>
            <input type="range" id="calibration-slider" min="120" max="600" step="10" value="${AppState.onboardingCalibrationWpm}" />
            <button class="btn btn-ghost" id="btn-calibration-inc">+</button>
            <span class="wpm-display" id="calibration-display">${formatWPM(AppState.onboardingCalibrationWpm)}</span>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onboarding-back">${t('btn.back')}</button>
            <button class="btn btn-primary" id="btn-onboarding-finish">${t('btn.finish')}</button>
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
      /* Restart RSVP preview with new speed and text tier */
      startCalibrationPreview();
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

function _getCalibrationText(wpm) {
  if (wpm < 200) return FlowReadContent.calibrationTiers.slow;
  if (wpm < 300) return FlowReadContent.calibrationTiers.medium;
  if (wpm < 450) return FlowReadContent.calibrationTiers.fast;
  return FlowReadContent.calibrationTiers.veryFast;
}

function startCalibrationPreview() {
  stopCalibrationPreview();
  const wordEl = qs('#calibration-rsvp-word');
  if (!wordEl) return;

  const text = _getCalibrationText(AppState.onboardingCalibrationWpm);
  const words = text.split(/\s+/);
  let wordIdx = 0;

  function updateWord() {
    if (!qs('#view-onboarding') || AppState.currentView !== 'view-onboarding') return;
    const w = words[wordIdx % words.length];
    wordIdx++;

    /* Scale font down for long words so they stay in the box */
    const len = w.length;
    wordEl.style.fontSize = len > 10 ? Math.max(28, 48 - (len - 10) * 2) + 'px' : '';

    /* Highlight the ORP letter at ~33% into the word */
    const orpIdx = Math.max(0, Math.floor(len * 0.33));
    const before = escapeHtml(w.slice(0, orpIdx));
    const orp = escapeHtml(w[orpIdx] || '');
    const after = escapeHtml(w.slice(orpIdx + 1));
    wordEl.innerHTML = before + '<span class="calibration-orp-letter">' + orp + '</span>' + after;

    const delayMs = 60000 / AppState.onboardingCalibrationWpm;
    window._calibrationTimer = setTimeout(updateWord, delayMs);
  }

  updateWord();
}

function stopCalibrationPreview() {
  if (window._calibrationTimer) {
    clearTimeout(window._calibrationTimer);
    window._calibrationTimer = null;
  }
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
  const activeTheme = getEffectiveTheme(AppState.settings.theme, AppState.isPro);
  const activeFont = getEffectiveFontPreset(AppState.settings.fontPreset, AppState.isPro);
  applyTheme(AppState.settings.theme);
  applyTypography(AppState.settings.fontPreset);

  view.innerHTML = `
    <div class="settings-screen">
      <div class="settings-header">
        <button class="btn btn-ghost btn-settings-back" id="btn-settings-back">←</button>
        <div>
          <p class="settings-kicker">${t('settings.kicker')}</p>
          <h1 class="settings-title">${t('settings.title')}</h1>
        </div>
      </div>

      <!-- APPEARANCE -->
      <section class="settings-section">
        <h2>${t('settings.section.appearance')}</h2>

        <div class="settings-row">
          <span class="settings-row-label">${t('settings.field.language')}</span>
          <select id="settings-language" class="settings-select">
            <option value="en" ${FlowReadI18n.currentLang() === 'en' ? 'selected' : ''}>${t('settings.language.en')}</option>
            <option value="hi" ${FlowReadI18n.currentLang() === 'hi' ? 'selected' : ''}>${t('settings.language.hi')}</option>
          </select>
        </div>

        <div class="settings-row">
          <span class="settings-row-label">${t('settings.field.font_scale')}</span>
          <strong id="settings-font-scale-value" class="settings-row-value">${Math.round(AppState.settings.fontScale * 100)}%</strong>
        </div>
        <input type="range" class="settings-slider" id="settings-font-scale" min="0.85" max="1.25" step="0.05" value="${AppState.settings.fontScale}" />

        <span class="settings-chip-label">${t('settings.field.font')}</span>
        <div class="settings-font-list">
          ${FlowReadTypographyPresets.map(function(font) {
            const locked = !isTypographyPresetUnlocked(font.key, AppState.isPro);
            const active = font.key === activeFont;
            return `<button class="settings-font-chip${active ? ' active' : ''}${locked ? ' locked' : ''}" type="button" data-font-value="${font.key}" aria-pressed="${active ? 'true' : 'false'}" ${locked ? 'disabled aria-disabled="true"' : ''}>${t(font.labelKey)}${locked ? ' 🔒' : ''}</button>`;
          }).join('')}
        </div>

        <span class="settings-chip-label">${t('settings.field.theme')}</span>
        <div class="settings-theme-list">
          ${FlowReadThemes.map(function(theme) {
            const locked = !isThemeUnlocked(theme.key, AppState.isPro);
            const active = theme.key === activeTheme;
            return `<button class="settings-theme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}" type="button" data-theme-value="${theme.key}" aria-pressed="${active ? 'true' : 'false'}" ${locked ? 'disabled aria-disabled="true"' : ''}>${t(theme.labelKey)}${locked ? ' 🔒' : ''}</button>`;
          }).join('')}
        </div>
      </section>

      <!-- READING -->
      <section class="settings-section">
        <h2>${t('settings.section.reading')}</h2>

        <div class="settings-row">
          <span class="settings-row-label">${t('settings.field.default_wpm')}</span>
          <strong id="settings-wpm-value" class="settings-row-value">${formatWPM(AppState.settings.defaultWpm)}</strong>
        </div>
        <input type="range" class="settings-slider" id="settings-wpm" min="120" max="800" step="10" value="${AppState.settings.defaultWpm}" />

        <div class="settings-row">
          <span class="settings-row-label">${t('settings.field.default_mode')}</span>
          <select id="settings-default-mode" class="settings-select">
            <option value="rsvp" ${AppState.settings.defaultMode === 'rsvp' ? 'selected' : ''}>${t('settings.mode.rsvp')}</option>
            <option value="chunk" ${AppState.settings.defaultMode === 'chunk' ? 'selected' : ''}>${t('settings.mode.chunk')}</option>
            <option value="focus" ${AppState.settings.defaultMode === 'focus' ? 'selected' : ''}>${t('settings.mode.focus')}</option>
            <option value="scroll" ${AppState.settings.defaultMode === 'scroll' ? 'selected' : ''}>${t('settings.mode.scroll')}</option>
          </select>
        </div>

        <div class="settings-row">
          <span class="settings-row-label">${t('settings.field.chunk_size')}</span>
          <select id="settings-chunk-size" class="settings-select">
            ${[2, 3, 4, 5, 7].map(function(size) {
              return `<option value="${size}" ${AppState.settings.defaultChunkSize === size ? 'selected' : ''}>${t('settings.chunk_size.option', {n: size})}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="settings-divider"></div>

        <label class="settings-toggle">
          <span>${t('settings.toggle.orp')}</span>
          <input type="checkbox" id="settings-orp" ${AppState.settings.orpDefault ? 'checked' : ''} />
        </label>
        <label class="settings-toggle">
          <span>${t('settings.toggle.context')}</span>
          <input type="checkbox" id="settings-context" ${AppState.settings.contextDefault ? 'checked' : ''} />
        </label>
        <label class="settings-toggle">
          <span>${t('settings.toggle.calm')}</span>
          <input type="checkbox" id="settings-calm" ${AppState.settings.calmModeDefault ? 'checked' : ''} />
        </label>

        <div class="settings-divider"></div>

        <label class="settings-toggle">
          <span>${t('settings.toggle.word_tap_longpress')}</span>
          <input type="checkbox" id="settings-word-tap-longpress" ${AppState.settings.wordTapLongpress ? 'checked' : ''} />
        </label>
        <div class="settings-row${AppState.settings.wordTapLongpress ? ' hidden' : ''}" id="settings-word-tap-action-row">
          <span class="settings-row-label">${t('settings.field.word_tap_action')}</span>
          <select id="settings-word-tap-action" class="settings-select">
            <option value="none" ${AppState.settings.wordTapAction === 'none' ? 'selected' : ''}>${t('settings.word_tap.none')}</option>
            <option value="dictionary" ${AppState.settings.wordTapAction === 'dictionary' ? 'selected' : ''}>${t('settings.word_tap.dictionary')}</option>
            <option value="lookup_online" ${AppState.settings.wordTapAction === 'lookup_online' ? 'selected' : ''}>${t('settings.word_tap.lookup_online')}</option>
          </select>
        </div>
      </section>

      <!-- NOTIFICATIONS -->
      <section class="settings-section">
        <h2>${t('settings.section.notifications')}</h2>
        <label class="settings-toggle">
          <span>${t('settings.toggle.reminder')}</span>
          <input type="checkbox" id="settings-reminder-enabled" ${AppState.settings.reminderEnabled ? 'checked' : ''} />
        </label>
        <div class="settings-row${AppState.settings.reminderEnabled ? '' : ' hidden'}" id="settings-reminder-time-row">
          <span class="settings-row-label">${t('settings.reminder.time_label')}</span>
          <input type="time" id="settings-reminder-time" class="settings-time-input" value="${escapeHtml(AppState.settings.reminderTime || '21:00')}" />
        </div>
        <label class="settings-toggle${AppState.settings.reminderEnabled ? '' : ' hidden'}" id="settings-streak-nudge-row">
          <span>${t('settings.toggle.streak_nudge')}</span>
          <input type="checkbox" id="settings-streak-nudge-enabled" ${AppState.settings.streakNudgeEnabled !== false ? 'checked' : ''} />
        </label>
        <p class="settings-copy text-muted" id="settings-reminder-note" style="${AppState.settings.reminderEnabled ? '' : 'display:none'}">
          ${t('settings.reminder.note')}
        </p>
      </section>

      <!-- LIBRARY -->
      <section class="settings-section">
        <h2>${t('settings.section.library')}</h2>
        <p class="settings-copy">${t('settings.library.local_only')}</p>
        <button class="btn btn-ghost settings-restore-btn" id="btn-settings-restore">${t('settings.btn.restore')}</button>
      </section>

      <!-- ABOUT & HELP -->
      <section class="settings-section">
        <h2>${t('settings.section.about_help')}</h2>
        <p class="settings-copy">${t('settings.about.version')}</p>
        <p class="settings-copy">${t('settings.about.privacy')}</p>
        <p class="settings-copy">${t('settings.about.url_note')}</p>

        <div class="settings-accordion">
          <button class="settings-accordion-header" id="btn-limitations-toggle" aria-expanded="false">
            <span>${t('settings.section.limitations')}</span>
            <span class="settings-accordion-chevron">›</span>
          </button>
          <div class="settings-accordion-body hidden" id="settings-limitations-body">
            ${FlowReadContent.limitations.map(function(item, i) {
              const titleKey = 'limitations.' + (i + 1) + '.title';
              const bodyKey = 'limitations.' + (i + 1) + '.body';
              const bodyText = t(bodyKey);
              return `
                <div class="settings-limitation-item">
                  <button class="settings-limitation-header" data-lim="${i}" aria-expanded="false">
                    <span>${escapeHtml(t(titleKey))}</span>
                    <span class="settings-accordion-chevron">›</span>
                  </button>
                  <p class="settings-limitation-body hidden">${escapeHtml(bodyText === bodyKey ? item.body : bodyText)}</p>
                </div>`;
            }).join('')}
          </div>
        </div>
      </section>

    </div>
  `;

  syncThemeChips();
  syncTypographyChips();

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

  qsa('[data-font-value]').forEach(function(button) {
    button.addEventListener('click', function() {
      if (this.disabled) return;
      const fontPreset = this.dataset.fontValue;
      updateSetting('fontPreset', fontPreset);
      applyTypography(fontPreset);
      syncTypographyChips();
    });
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

  qsa('[data-theme-value]').forEach(function(button) {
    button.addEventListener('click', function() {
      if (this.disabled) return;
      const theme = this.dataset.themeValue;
      updateSetting('theme', theme);
      applyTheme(theme);
      syncThemeChips();
    });
  });

  const restoreBtn = qs('#btn-settings-restore');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', function() {
      if (typeof restorePurchases === 'function') restorePurchases();
    });
  }

  const reminderToggle = qs('#settings-reminder-enabled');
  if (reminderToggle) {
    reminderToggle.addEventListener('change', async function() {
      const enabled = this.checked;
      updateSetting('reminderEnabled', enabled);
      localStorage.setItem('fr_reminder_enabled', enabled);
      const timeRow = qs('#settings-reminder-time-row');
      const note = qs('#settings-reminder-note');
      const nudgeRow = qs('#settings-streak-nudge-row');
      if (timeRow) timeRow.classList.toggle('hidden', !enabled);
      if (note) note.style.display = enabled ? '' : 'none';
      if (nudgeRow) nudgeRow.classList.toggle('hidden', !enabled);
      if (typeof NotificationsFeature !== 'undefined') {
        if (enabled) {
          await NotificationsFeature.requestPermission();
          NotificationsFeature.reschedule();
        } else {
          NotificationsFeature.cancelAll();
        }
      }
    });
  }

  const reminderTime = qs('#settings-reminder-time');
  if (reminderTime) {
    reminderTime.addEventListener('change', function() {
      const value = /^\d{2}:\d{2}$/.test(this.value) ? this.value : '21:00';
      updateSetting('reminderTime', value);
      localStorage.setItem('fr_reminder_time', value);
      if (typeof NotificationsFeature !== 'undefined') NotificationsFeature.reschedule();
    });
  }

  const streakNudgeToggle = qs('#settings-streak-nudge-enabled');
  if (streakNudgeToggle) {
    streakNudgeToggle.addEventListener('change', function() {
      const enabled = this.checked;
      updateSetting('streakNudgeEnabled', enabled);
      localStorage.setItem('fr_notif_streak_nudge', enabled);
      if (typeof NotificationsFeature !== 'undefined') NotificationsFeature.reschedule();
    });
  }

  const langSelect = qs('#settings-language');
  if (langSelect) {
    langSelect.addEventListener('change', async function() {
      const lang = this.value;
      localStorage.setItem('fr_app_language', lang);
      await FlowReadI18n.loadLanguage(lang);
      renderSettings();
    });
  }

  /* Word tap settings */
  const wordTapLongpress = qs('#settings-word-tap-longpress');
  const wordTapActionRow = qs('#settings-word-tap-action-row');
  if (wordTapLongpress) {
    wordTapLongpress.addEventListener('change', function() {
      const enabled = this.checked;
      updateSetting('wordTapLongpress', enabled);
      localStorage.setItem('fr_word_tap_longpress', enabled);
      if (wordTapActionRow) wordTapActionRow.classList.toggle('hidden', enabled);
    });
  }
  const wordTapAction = qs('#settings-word-tap-action');
  if (wordTapAction) {
    wordTapAction.addEventListener('change', function() {
      updateSetting('wordTapAction', this.value);
      localStorage.setItem('fr_word_tap_action', this.value);
    });
  }

  /* Limitations top-level accordion */
  const limToggle = qs('#btn-limitations-toggle');
  const limBody = qs('#settings-limitations-body');
  if (limToggle && limBody) {
    limToggle.addEventListener('click', function() {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      limBody.classList.toggle('hidden', expanded);
    });
  }

  /* Individual limitation items */
  qsa('[data-lim]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      const body = this.nextElementSibling;
      if (body) body.classList.toggle('hidden', expanded);
    });
  });
}
