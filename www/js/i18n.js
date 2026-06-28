/* Internationalisation — language loader and t() helper.
   Must be loaded before any view script. */

const FlowReadI18n = (() => {
  let strings = {};

  async function loadLanguage(lang) {
    try {
      const res = await fetch('i18n/' + lang + '.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      strings = await res.json();
    } catch (e) {
      console.warn('i18n: could not load', lang, '— falling back to key names', e);
      strings = {};
    }
  }

  /* Resolve language on first launch from navigator.language; respect saved pref. */
  async function init() {
    let lang = localStorage.getItem('fr_app_language');
    if (!lang) {
      const deviceLang = (navigator.language || 'en').toLowerCase();
      lang = deviceLang.startsWith('hi') ? 'hi' : 'en';
      localStorage.setItem('fr_app_language', lang);
    }
    await loadLanguage(lang);
  }

  /* t('key') — returns the localised string, or the key itself if missing.
     t('key', { n: 5 }) — substitutes {n} placeholder in the returned string. */
  function t(key, vars) {
    let str = (strings[key] !== undefined) ? strings[key] : key;
    if (vars) {
      Object.entries(vars).forEach(function([k, v]) {
        str = str.split('{' + k + '}').join(String(v));
      });
    }
    return str;
  }

  function currentLang() {
    return localStorage.getItem('fr_app_language') || 'en';
  }

  return { init, loadLanguage, t, currentLang };
})();

/* Global shorthand so all view files can call t('key') directly. */
function t(key, vars) {
  return FlowReadI18n.t(key, vars);
}
