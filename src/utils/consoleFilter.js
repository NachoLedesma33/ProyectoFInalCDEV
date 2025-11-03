// utils/consoleFilter.js

const originalWarn = console.warn;
const originalError = console.error;

console.warn = function (...args) {
    const filteredWarnings = [
        'THREE.FBXLoader',
        'Multiple instances of Three.js',
        'Permissions-Policy',
        'Origin trial controlled feature'
    ];
    if (!filteredWarnings.some(warning => args[0].includes(warning))) {
        originalWarn.apply(console, args);
    }
};

console.error = function (...args) {
    const filteredErrors = [
        'AudioContext',
        'Permissions-Policy',
        'Origin trial controlled feature'
    ];
    if (!filteredErrors.some(error => args[0].includes(error))) {
        originalError.apply(console, args);
    }
};