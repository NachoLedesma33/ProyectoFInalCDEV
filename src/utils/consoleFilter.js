(function () {
  if (window.__CONSOLE_SILENCED__) return; 
  window.__CONSOLE_SILENCED__ = true;

  const originalConsole = { ...console };
  Object.defineProperty(window, '__ORIGINAL_CONSOLE__', {
    value: originalConsole,
    configurable: false,
    writable: false,
    enumerable: false,
  });

  const noop = function () {};
  const methods = [
    'log', 'info', 'warn', 'error', 'debug', 'trace', 'table',
    'group', 'groupCollapsed', 'groupEnd',
    'time', 'timeEnd', 'timeLog',
    'assert', 'dir', 'dirxml', 'count', 'countReset',
    'clear', 'profile', 'profileEnd'
  ];

  for (const m of methods) {
    try { console[m] = noop; } catch (_) {}
  }
  try {
    window.onerror = function () { return true; };
    window.onunhandledrejection = function () { return true; };
    window.addEventListener('error', function (e) {
      try {
        e.preventDefault();
        e.stopImmediatePropagation();
      } catch (_) {}
      return false;
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
      try {
        e.preventDefault();
        e.stopImmediatePropagation();
      } catch (_) {}
      return false;
    }, true);
    window.addEventListener('securitypolicyviolation', function (e) {
      try {
        e.preventDefault();
        e.stopImmediatePropagation();
      } catch (_) {}
      return false;
    }, true);
  } catch (_) {}
  window.enableConsoleLogs = function () {
    for (const m of methods) {
      try { console[m] = originalConsole[m] || noop; } catch (_) {}
    }
    try {
      window.onerror = null;
      window.onunhandledrejection = null;
    } catch (_) {}
    window.__CONSOLE_SILENCED__ = false;
  };
})();