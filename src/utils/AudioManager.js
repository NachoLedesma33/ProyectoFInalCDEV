import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { AUDIO, AUDIO_DEFAULTS } from "../config/audioConfig.js";

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    if (camera && typeof camera.add === "function") {
      camera.add(this.listener);
    }

    this.loader = new THREE.AudioLoader();
    this.bufferCache = new Map();

    this.music = new THREE.Audio(this.listener); 
    this.ambientMusic = new THREE.Audio(this.listener); 
    this.combatMusic = new THREE.Audio(this.listener); 
  this.ambience = new THREE.Audio(this.listener); 
    this.activeSfx = new Set(); 
    this._randomAmbientTimer = null;
    this._randomAmbientOptions = null;
  this._randomAmbientScheduledAt = null;
  this._randomAmbientDelayMs = null;
  this._randomAmbientRemainingMs = null;
  this._randomAmbientPaused = false;
    this.masterVolume = AUDIO_DEFAULTS.masterVolume;
    this.musicVolume = AUDIO_DEFAULTS.musicVolume;
  this.ambienceVolume = AUDIO_DEFAULTS.ambienceVolume ?? 0.6;
    this.sfxVolume = AUDIO_DEFAULTS.sfxVolume;
    this.muted = !!AUDIO_DEFAULTS.muted;
    this._ensureUnlockedOnInteraction();
    this._applyVolumes();
    try {
      setTimeout(() => {
        try { window.dispatchEvent(new Event('audioReady')); } catch(_) {}
      }, 0);
    } catch (_) {}
    try {
      window.addEventListener('gamepause', (ev) => {
        try { if (ev && ev.detail && ev.detail.pauseAudio === false) return; } catch(_) {}
        try { this._pauseRandomAmbient(); } catch(_) {}
      });
      window.addEventListener('gameresume', (ev) => {
        try { if (ev && ev.detail && ev.detail.pauseAudio === false) return; } catch(_) {}
        try { this._resumeRandomAmbient(); } catch(_) {}
      });
    } catch(_) {}
    // Pause/resume hooks for combat music
    try {
      window.addEventListener('gamepause', (ev) => {
        try { if (ev && ev.detail && ev.detail.pauseAudio === false) return; } catch(_) {}
        try { this._pauseCombatMusic(); } catch(_) {}
      });
      window.addEventListener('gameresume', (ev) => {
        try { if (ev && ev.detail && ev.detail.pauseAudio === false) return; } catch(_) {}
        try { this._resumeCombatMusic(); } catch(_) {}
      });
    } catch(_) {}
  }
  _getContext() {
    return this.listener.context || (this.listener.context = THREE.AudioContext.getContext());
  }

  _ensureUnlockedOnInteraction() {
    const tryResume = () => {
      try {
        const ctx = this._getContext();
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      } catch (_) {}
    };
    const events = ["click", "pointerdown", "touchstart", "keydown"]; 
    const handler = () => {
      tryResume();
      events.forEach((ev) => window.removeEventListener(ev, handler, true));
    };
    events.forEach((ev) => window.addEventListener(ev, handler, true));
  }

  async _loadBuffer(url) {
    if (!url) return null;
    if (this.bufferCache.has(url)) return this.bufferCache.get(url);
    const buffer = await new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
    this.bufferCache.set(url, buffer);
    return buffer;
  }
  _applyVolumes() {
    const master = this.muted ? 0 : this.masterVolume;
    try { this.music.setVolume(master * this.musicVolume); } catch (_) {}
    try { this.ambientMusic.setVolume(master * this.musicVolume * (this.ambientMusic.userData?.baseVolume ?? 1)); } catch (_) {}
    try { this.combatMusic.setVolume(master * this.musicVolume * (this.combatMusic.userData?.baseVolume ?? 1)); } catch (_) {}
    try { this.ambience.setVolume(master * this.ambienceVolume); } catch (_) {}
    for (const a of this.activeSfx) {
      try { a.setVolume(master * this.sfxVolume * (a.userData?.baseVolume ?? 1)); } catch (_) {}
    }
  }
  setMasterVolume(v) { this.masterVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }
  setMusicVolume(v) { this.musicVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }
  setSfxVolume(v) { this.sfxVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }
  setMuted(m) { this.muted = !!m; this._applyVolumes(); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  async playMusic(key = "main", { loop = true } = {}) {
    const url = AUDIO.music[key];
    if (!url) return null;
    try {
      const buffer = await this._loadBuffer(url);
      if (!buffer) return null;

      if (this.music.isPlaying) this.music.stop();
      this.music.setBuffer(buffer);
      this.music.setLoop(loop);
      this._applyVolumes();
      this.music.play();
      return this.music;
    } catch (e) {
      console.warn("No se pudo reproducir música:", key, e);
      return null;
    }
  }

  stopMusic() {
    try { if (this.music.isPlaying) this.music.stop(); } catch (_) {}
  }

  async playAmbience(key = 'noise', { loop = true, volume = 1 } = {}) {
    const url = AUDIO.ambience && AUDIO.ambience[key];
    if (!url) return null;
    try {
      const buffer = await this._loadBuffer(url);
      if (!buffer) return null;
      if (this.ambience.isPlaying) this.ambience.stop();
      this.ambience.setBuffer(buffer);
      this.ambience.setLoop(loop);
      this.ambience.userData = this.ambience.userData || {};
      this.ambience.userData.baseVolume = volume;
      this._applyVolumes();
      this.ambience.play();
      return this.ambience;
    } catch (e) {
      console.warn('No se pudo reproducir ambience:', key, e);
      return null;
    }
  }

  stopAmbience() {
    try { if (this.ambience.isPlaying) this.ambience.stop(); } catch (_) {}
  }

  setAmbienceVolume(v) { this.ambienceVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }

  async playAmbientMusic(key = 'ambient1', { loop = false, volume = 1 } = {}) {
    const url = AUDIO.music && AUDIO.music[key];
    if (!url) return null;
    try {
      const buffer = await this._loadBuffer(url);
      if (!buffer) return null;
      if (this.ambientMusic.isPlaying) this.ambientMusic.stop();
      this.ambientMusic.setBuffer(buffer);
      this.ambientMusic.setLoop(loop);
      this.ambientMusic.userData = this.ambientMusic.userData || {};
      this.ambientMusic.userData.baseVolume = volume;
      this._applyVolumes();
      // Attach onEnded handler to allow scheduler to continue
      try { this.ambientMusic.onEnded = () => {}; } catch(_) {}
      this.ambientMusic.play();
      return this.ambientMusic;
    } catch (e) {
      console.warn('No se pudo reproducir ambient music:', key, e);
      return null;
    }
  }

  stopAmbientMusic() {
    try { if (this.ambientMusic.isPlaying) this.ambientMusic.stop(); } catch (_) {}
  }

  async playCombatMusic(key = 'combat1', { loop = true, volume = 1, fadeInMs = 600 } = {}) {
    const url = AUDIO.music && AUDIO.music[key];
    if (!url) return null;
    try {
      const buffer = await this._loadBuffer(url);
      if (!buffer) return null;
      if (this.combatMusic.isPlaying) this.combatMusic.stop();
      this.combatMusic.setBuffer(buffer);
      this.combatMusic.setLoop(loop);
      this.combatMusic.userData = this.combatMusic.userData || {};
      this.combatMusic.userData.baseVolume = volume;
      // start silent and fade in to effective volume
      try { this.combatMusic.setVolume(0); } catch(_) {}
      // Try to ensure AudioContext is running before play
      try {
        const ctx = this._getContext();
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
      } catch(_) {}
      try {
        this.combatMusic.play();
      } catch (e) {
        try {
          const ctx = this._getContext();
          if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {});
          this.combatMusic.play();
        } catch(_) {}
      }
      this._fadeAudio(this.combatMusic, 1.0, fadeInMs);
      this._combatCurrentKey = key;
      this._combatWasPlayingOnPause = false;
      try {
        this._wasAmbiencePlayingOnCombatStart = !!(this.ambience && this.ambience.isPlaying);
      } catch(_) { this._wasAmbiencePlayingOnCombatStart = false; }
      try {
        this._wasRandomAmbientRunningOnCombatStart = !!this._randomAmbientOptions;
        this._savedRandomAmbientOptions = this._randomAmbientOptions ? { ...this._randomAmbientOptions } : null;
      } catch(_) { this._wasRandomAmbientRunningOnCombatStart = false; this._savedRandomAmbientOptions = null; }
      try { if (this._wasAmbiencePlayingOnCombatStart) this.stopAmbience(); } catch(_) {}
      try { if (this._wasRandomAmbientRunningOnCombatStart) this.stopRandomAmbient(); } catch(_) {}
      return this.combatMusic;
    } catch (e) {
      console.warn('No se pudo reproducir combat music:', key, e);
      return null;
    }
  }

  stopCombatMusic({ fadeOutMs = 800 } = {}) {
    try {
      if (!this.combatMusic) {
        try {
          if (this._wasAmbiencePlayingOnCombatStart) { try { this.playAmbience('noise', { loop: true, volume: this.ambience.userData?.baseVolume ?? this.ambienceVolume }); } catch(_) {} }
        } catch(_) {}
        try { if (this._wasRandomAmbientRunningOnCombatStart && this._savedRandomAmbientOptions) { try { this.startRandomAmbient(this._savedRandomAmbientOptions); } catch(_) {} } } catch(_) {}
        try { this._wasAmbiencePlayingOnCombatStart = false; this._wasRandomAmbientRunningOnCombatStart = false; this._savedRandomAmbientOptions = null; } catch(_) {}
        this._combatCurrentKey = null; this._combatWasPlayingOnPause = false;
        return;
      }

      if (!fadeOutMs || fadeOutMs <= 0) {
        try { if (this.combatMusic.isPlaying) this.combatMusic.stop(); } catch(_) {}
        this._combatCurrentKey = null;
        this._combatWasPlayingOnPause = false;
        // restore ambience/random ambient state if they were active before combat
        try { if (this._wasAmbiencePlayingOnCombatStart) { try { this.playAmbience('noise', { loop: true, volume: this.ambience.userData?.baseVolume ?? this.ambienceVolume }); } catch(_) {} } } catch(_) {}
        try { if (this._wasRandomAmbientRunningOnCombatStart && this._savedRandomAmbientOptions) { try { this.startRandomAmbient(this._savedRandomAmbientOptions); } catch(_) {} } } catch(_) {}
        try { this._wasAmbiencePlayingOnCombatStart = false; this._wasRandomAmbientRunningOnCombatStart = false; this._savedRandomAmbientOptions = null; } catch(_) {}
        return;
      }

      this._fadeAudio(this.combatMusic, 0.0, fadeOutMs, () => {
        try { if (this.combatMusic.isPlaying) this.combatMusic.stop(); } catch(_) {}
        try { this._combatCurrentKey = null; this._combatWasPlayingOnPause = false; } catch(_) {}
        // restore ambience/random ambient state if they were active before combat
        try { if (this._wasAmbiencePlayingOnCombatStart) { try { this.playAmbience('noise', { loop: true, volume: this.ambience.userData?.baseVolume ?? this.ambienceVolume }); } catch(_) {} } } catch(_) {}
        try { if (this._wasRandomAmbientRunningOnCombatStart && this._savedRandomAmbientOptions) { try { this.startRandomAmbient(this._savedRandomAmbientOptions); } catch(_) {} } } catch(_) {}
        // clear saved flags
        try { this._wasAmbiencePlayingOnCombatStart = false; this._wasRandomAmbientRunningOnCombatStart = false; this._savedRandomAmbientOptions = null; } catch(_) {}
      });
    } catch (_) {}
  }

  _pauseCombatMusic() {
    try {
      if (this.combatMusic && this.combatMusic.isPlaying) {
        this._combatWasPlayingOnPause = true;
        try { this.combatMusic.stop(); } catch(_) {}
      } else {
        this._combatWasPlayingOnPause = false;
      }
    } catch(_) { this._combatWasPlayingOnPause = false; }
  }

  _resumeCombatMusic() {
    try {
      if (this._combatWasPlayingOnPause && this._combatCurrentKey) {
        try { this.playCombatMusic(this._combatCurrentKey, { loop: true, volume: this.combatMusic.userData?.baseVolume ?? 1, fadeInMs: 400 }); } catch(_) {}
        this._combatWasPlayingOnPause = false;
      }
    } catch(_) {}
  }

  _fadeAudio(audio, targetFactor, durationMs = 600, onComplete) {
    try {
      if (!audio) { if (typeof onComplete === 'function') onComplete(); return; }
      // clear any existing fade timer
      try { if (audio.userData && audio.userData._fadeTimer) { clearInterval(audio.userData._fadeTimer); audio.userData._fadeTimer = null; } } catch(_) {}
      const master = this.muted ? 0 : this.masterVolume;
      const base = (audio.userData?.baseVolume != null) ? audio.userData.baseVolume : 1;
      const effectiveTarget = master * this.musicVolume * base * targetFactor;
      // Determine start volume (best-effort)
      let startVol = 0;
      try { if (typeof audio.getVolume === 'function') startVol = audio.getVolume(); else startVol = master * this.musicVolume * base; } catch(_) { startVol = master * this.musicVolume * base; }
      const start = Date.now();
      const end = start + Math.max(0, durationMs);
      const step = 80; // ms
      audio.userData = audio.userData || {};
      audio.userData._fadeTimer = setInterval(() => {
        const now = Date.now();
        const t = Math.min(1, (now - start) / Math.max(1, durationMs));
        const current = startVol + (effectiveTarget - startVol) * t;
        try { audio.setVolume(Math.max(0, Math.min(1, current))); } catch(_) {}
        if (now >= end) {
          try { clearInterval(audio.userData._fadeTimer); } catch(_) {}
          audio.userData._fadeTimer = null;
          // ensure final volume
          try { audio.setVolume(Math.max(0, Math.min(1, effectiveTarget))); } catch(_) {}
          if (typeof onComplete === 'function') onComplete();
        }
      }, step);
    } catch (e) { try { if (typeof onComplete === 'function') onComplete(); } catch(_) {} }
  }

    startRandomAmbient({ minDelay = 30, maxDelay = 180, playProbability = 0.6, volume = 0.8 } = {}) {
    this.stopRandomAmbient();
    this._randomAmbientOptions = { minDelay, maxDelay, playProbability, volume };
    this._scheduleNextRandomAmbient();
  }

  stopRandomAmbient() {
    this._randomAmbientOptions = null;
    if (this._randomAmbientTimer) {
      try { clearTimeout(this._randomAmbientTimer); } catch(_) {}
      this._randomAmbientTimer = null;
    }
    this.stopAmbientMusic();
  }

  _scheduleNextRandomAmbient() {
    if (!this._randomAmbientOptions) return;
    const { minDelay, maxDelay } = this._randomAmbientOptions;
    const delaySec = minDelay + Math.random() * Math.max(0, maxDelay - minDelay);
    const delayMs = Math.round(delaySec * 1000);
    this._randomAmbientDelayMs = delayMs;
    this._randomAmbientScheduledAt = Date.now();
    this._randomAmbientRemainingMs = null;
    this._randomAmbientPaused = false;
    this._randomAmbientTimer = setTimeout(async () => {
      this._randomAmbientScheduledAt = null;
      this._randomAmbientDelayMs = null;
      const opts = this._randomAmbientOptions;
      if (!opts) return;
      const { playProbability, volume } = opts;
      if (Math.random() <= (playProbability ?? 0.6)) {
        const key = Math.random() < 0.5 ? 'ambient1' : 'ambient2';
        try {
          const audio = await this.playAmbientMusic(key, { loop: false, volume });
          if (audio) {
            try {
              audio.onEnded = () => { this._scheduleNextRandomAmbient(); };
            } catch (_) {
              try {
                const buffer = audio?.buffer;
                const dur = buffer ? Math.max(1000, Math.round((buffer.duration || 0) * 1000)) : 30000;
                this._randomAmbientTimer = setTimeout(() => this._scheduleNextRandomAmbient(), dur + 1000);
              } catch(_) { this._scheduleNextRandomAmbient(); }
            }
            return;
          }
        } catch (_) {}
      }
      this._scheduleNextRandomAmbient();
    }, delayMs);
  }

  _pauseRandomAmbient() {
    try {
      if (this._randomAmbientTimer && this._randomAmbientScheduledAt && this._randomAmbientDelayMs) {
        const elapsed = Date.now() - this._randomAmbientScheduledAt;
        const remaining = Math.max(0, this._randomAmbientDelayMs - elapsed);
        this._randomAmbientRemainingMs = remaining;
        try { clearTimeout(this._randomAmbientTimer); } catch(_) {}
        this._randomAmbientTimer = null;
        this._randomAmbientScheduledAt = null;
        this._randomAmbientDelayMs = null;
      }
      try {
        if (this.ambientMusic && this.ambientMusic.isPlaying) {
          this._wasPlayingAmbientOnPause = true;
          this.stopAmbientMusic();
        } else {
          this._wasPlayingAmbientOnPause = false;
        }
      } catch(_) { this._wasPlayingAmbientOnPause = false; }
      this._randomAmbientPaused = true;
    } catch(_) {}
  }

  _resumeRandomAmbient() {
    if (!this._randomAmbientOptions) { this._randomAmbientPaused = false; return; }
    if (this._randomAmbientRemainingMs != null) {
      const remaining = Math.max(0, this._randomAmbientRemainingMs);
      this._randomAmbientRemainingMs = null;
      this._randomAmbientDelayMs = remaining;
      this._randomAmbientScheduledAt = Date.now();
      this._randomAmbientTimer = setTimeout(() => { try { this._scheduleNextRandomAmbient(); } catch(_) {} }, remaining);
    } else {
      try { this._scheduleNextRandomAmbient(); } catch(_) {}
    }
    this._randomAmbientPaused = false;
  }
  async playSFX(key, { object3D = null, position = null, volume = 1, loop = false } = {}) {
    const src = AUDIO.sfx[key];
    if (!src) return null;
    try {
      const urls = Array.isArray(src) ? src : [src];
      let buffer = null;
      let pickedUrl = null;
      for (const u of urls) {
        try {
          buffer = await this._loadBuffer(u);
          pickedUrl = u;
          if (buffer) break;
        } catch (_) {
          // intenta siguiente URL
        }
      }
      if (!buffer) return null;

      const isPositional = !!(object3D || position);
      const audio = isPositional ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      audio.setLoop(loop);
      audio.userData = audio.userData || {};
      audio.userData.baseVolume = volume;
      this._applyVolumes();

      if (isPositional) {
        try { audio.setRefDistance(4); audio.setDistanceModel("exponential"); } catch (_) {}
        if (object3D && typeof object3D.add === "function") {
          object3D.add(audio);
        } else if (position) {
          const temp = new THREE.Object3D();
          temp.position.copy(position);
          temp.add(audio);
        }
      }

      audio.onEnded = () => { try { this.activeSfx.delete(audio); } catch (_) {} };
      this.activeSfx.add(audio);
      audio.play();
      return audio;
    } catch (e) {
      console.warn("No se pudo reproducir SFX:", key, e);
      return null;
    }
  }

  async preloadSfx(keyOrKeys) {
    try {
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      for (const k of keys) {
        const src = AUDIO.sfx[k];
        if (!src) continue;
        const urls = Array.isArray(src) ? src : [src];
        for (const u of urls) {
          try { await this._loadBuffer(u); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  stopAllSfx() {
    for (const a of this.activeSfx) {
      try { if (a.isPlaying) a.stop(); } catch (_) {}
    }
    this.activeSfx.clear();
  }

  dispose() {
    try { this.stopMusic(); } catch (_) {}
    this.stopAllSfx();
    try { this.bufferCache.clear(); } catch (_) {}
  }
}

export default AudioManager;
