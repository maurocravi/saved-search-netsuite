// Wrapper para estandarizar las API de WebExtensions en Chrome y Firefox.
// Firefox normalmente soporta "browser.*", Chrome "chrome.*".
window.browser = (function () {
  return window.msBrowser || window.browser || window.chrome;
})();
