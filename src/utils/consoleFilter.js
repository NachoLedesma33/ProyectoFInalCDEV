// utils/consoleFilter.js

const originalWarn = console.warn;
const originalError = console.error;

console.warn = function (...args) {
    const filteredWarnings = [
        'THREE.FBXLoader',
        'Multiple instances of Three.js',
        'Permissions-Policy',
        'Origin trial controlled feature',
        'T_Stones_Metalic.png',
        'T_Stones_Roughness.png'
    ];
    const argStrs = args.map(a => {
        if (typeof a === 'string') return a;
        try { if (a && typeof a.message === 'string') return a.message; } catch (_) {}
        try { return JSON.stringify(a); } catch (_) { return String(a); }
    });
    if (!filteredWarnings.some(warning => argStrs.some(s => typeof s === 'string' && s.includes(warning)))) {
        originalWarn.apply(console, args);
    }
};

console.error = function (...args) {
    const filteredErrors = [
        'AudioContext',
        'Permissions-Policy',
        'Origin trial controlled feature',
        // Expected 404s from FBX-referenced textures we override later
        'T_Stones_Metalic.png',
        'T_Stones_Roughness.png'
    ];
    const argStrs = args.map(a => {
        if (typeof a === 'string') return a;
        try { if (a && typeof a.message === 'string') return a.message; } catch (_) {}
        try { return JSON.stringify(a); } catch (_) { return String(a); }
    });
    if (!filteredErrors.some(errFrag => argStrs.some(s => typeof s === 'string' && s.includes(errFrag)))) {
        originalError.apply(console, args);
    }
};