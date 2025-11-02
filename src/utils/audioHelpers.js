// src/utils/audioHelpers.js
// Small helper utilities for robust, defensive SFX playback.
// This module now exposes a class `AudioHelpers` while preserving the
// original named helper functions for backward compatibility.

export class AudioHelpers {
  static playSfxWhenReady(key, opts = {}) {
    try {
      if (typeof window !== 'undefined' && window.audio && typeof window.audio.playSFX === 'function') {
        window.audio.playSFX(key, opts);
        return;
      }

      const onReady = () => {
        try {
          if (window.audio && typeof window.audio.playSFX === 'function') window.audio.playSFX(key, opts);
        } catch (_) {}
        try { window.removeEventListener('audioReady', onReady); } catch (_) {}
      };

      try { window.addEventListener('audioReady', onReady); } catch (_) {}
    } catch (_) {}
  }

  // Small convenience wrapper that swallows errors (useful in UI code)
  static safePlaySfx(key, opts = {}) {
    try { AudioHelpers.playSfxWhenReady(key, opts); } catch (_) {}
  }
}

// Keep the original function-style named exports for compatibility
export const playSfxWhenReady = AudioHelpers.playSfxWhenReady.bind(AudioHelpers);
export const safePlaySfx = AudioHelpers.safePlaySfx.bind(AudioHelpers);

export default AudioHelpers;
