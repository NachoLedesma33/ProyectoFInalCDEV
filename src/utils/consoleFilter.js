// utils/consoleFilter.js — silenciar absolutamente toda la consola y errores del navegador

(function () {
  if (window.__CONSOLE_SILENCED__) return; // evitar doble aplicación
  window.__CONSOLE_SILENCED__ = true;

  // Guardar métodos originales por si se quiere reactivar
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

  // Silenciar errores globales (incluye muchos 404/GET y runtime errors)
  try {
    window.onerror = function () { return true; };
    window.onunhandledrejection = function () { return true; };

    // Captura en fase de captura para recursos (<img>, loaders, etc.)
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

    // Silenciar violaciones de políticas (CSP, Permissions-Policy, etc.) si el navegador las emite como evento
    window.addEventListener('securitypolicyviolation', function (e) {
      try {
        e.preventDefault();
        e.stopImmediatePropagation();
      } catch (_) {}
      return false;
    }, true);
  } catch (_) {}

  // API para reactivar (opcional)
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