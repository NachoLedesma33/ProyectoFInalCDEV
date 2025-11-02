import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { AUDIO, AUDIO_DEFAULTS } from "../config/audioConfig.js";

/**
 * AudioManager
 * - Gestiona música y efectos (SFX) usando THREE.Audio / THREE.PositionalAudio
 * - Cachea buffers, controla volúmenes y mute global
 * - Reanuda el AudioContext tras el primer gesto del usuario si es necesario
 */
export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    if (camera && typeof camera.add === "function") {
      camera.add(this.listener);
    }

    this.loader = new THREE.AudioLoader();
    this.bufferCache = new Map();

    // Canales principales
    this.music = new THREE.Audio(this.listener); // no-posicional
    this.ambientMusic = new THREE.Audio(this.listener); // ambient musical cues (occasional tracks)
    this.combatMusic = new THREE.Audio(this.listener); // looped combat music channel
  this.ambience = new THREE.Audio(this.listener); // canal de ambience (fondo)
    this.activeSfx = new Set(); // llevar control para limpiar

    // Random ambient scheduler state
    this._randomAmbientTimer = null;
    this._randomAmbientOptions = null;
  this._randomAmbientScheduledAt = null;
  this._randomAmbientDelayMs = null;
  this._randomAmbientRemainingMs = null;
  this._randomAmbientPaused = false;

    // Estado
    this.masterVolume = AUDIO_DEFAULTS.masterVolume;
    this.musicVolume = AUDIO_DEFAULTS.musicVolume;
  this.ambienceVolume = AUDIO_DEFAULTS.ambienceVolume ?? 0.6;
    this.sfxVolume = AUDIO_DEFAULTS.sfxVolume;
    this.muted = !!AUDIO_DEFAULTS.muted;

    // Intento de desbloqueo por gesto del usuario
    this._ensureUnlockedOnInteraction();
    this._applyVolumes();

    // Notify UI that audio manager exists and can be used. Some UI (soundHUD)
    // listens for this event to apply settings when audio becomes available.
    try {
      // dispatch asynchronously to allow callers to finish initializing
      setTimeout(() => {
        try { window.dispatchEvent(new Event('audioReady')); } catch(_) {}
      }, 0);
    } catch (_) {}

    // Pause/resume hooks for the random ambient scheduler
    try {
      // Listeners may receive CustomEvent with detail.pauseAudio === false when
      // the pause was triggered from UI (Esc) and audio should keep playing.
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

  // ========================
  // Infraestructura básica
  // ========================
  _getContext() {
    // AudioListener crea internamente un AudioContext
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
    // Gesto de usuario comunes
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
    // Música
    try { this.music.setVolume(master * this.musicVolume); } catch (_) {}
    // Ambient musical cues
    try { this.ambientMusic.setVolume(master * this.musicVolume * (this.ambientMusic.userData?.baseVolume ?? 1)); } catch (_) {}
    // Combat music
    try { this.combatMusic.setVolume(master * this.musicVolume * (this.combatMusic.userData?.baseVolume ?? 1)); } catch (_) {}
    // Ambience
    try { this.ambience.setVolume(master * this.ambienceVolume); } catch (_) {}
    // SFX activos
    for (const a of this.activeSfx) {
      try { a.setVolume(master * this.sfxVolume * (a.userData?.baseVolume ?? 1)); } catch (_) {}
    }
  }

  setMasterVolume(v) { this.masterVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }
  setMusicVolume(v) { this.musicVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }
  setSfxVolume(v) { this.sfxVolume = THREE.MathUtils.clamp(v, 0, 1); this._applyVolumes(); }
  setMuted(m) { this.muted = !!m; this._applyVolumes(); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  // ========================
  // Música
  // ========================
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

  // ========================
  // Ambience (background noise)
  // ========================
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

  // ========================
  // Ambient musical cues (occasionales)
  // ========================
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

  // ========================
  // Combat music (looped)
  // ========================
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

      // play and then attempt to fade in; if playback is blocked try a resume and retry once
      try {
        this.combatMusic.play();
      } catch (e) {
        try {
          const ctx = this._getContext();
          if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {});
          this.combatMusic.play();
        } catch(_) {}
      }
      // if after attempts not playing, still schedule fade (setVolume will still apply when it starts)
      this._fadeAudio(this.combatMusic, 1.0, fadeInMs);
      this._combatCurrentKey = key;
      this._combatWasPlayingOnPause = false;
      // Stop ambience channels so combat music is exclusive
      try {
        this._wasAmbiencePlayingOnCombatStart = !!(this.ambience && this.ambience.isPlaying);
      } catch(_) { this._wasAmbiencePlayingOnCombatStart = false; }
      try {
        // capture whether random ambient scheduler was active and its options
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
      // Always attempt to stop combat music and restore ambience state even if isPlaying is false
      if (!this.combatMusic) {
        // nothing to stop, but restore ambience if needed
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

      // fade to 0 then stop
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
        // store current key (if any) and stop immediately without fade to avoid long waits
        // we keep _combatCurrentKey to allow resuming the same track
        try { this.combatMusic.stop(); } catch(_) {}
      } else {
        this._combatWasPlayingOnPause = false;
      }
    } catch(_) { this._combatWasPlayingOnPause = false; }
  }

  _resumeCombatMusic() {
    try {
      if (this._combatWasPlayingOnPause && this._combatCurrentKey) {
        // replay the same combat key with a short fade-in
        try { this.playCombatMusic(this._combatCurrentKey, { loop: true, volume: this.combatMusic.userData?.baseVolume ?? 1, fadeInMs: 400 }); } catch(_) {}
        this._combatWasPlayingOnPause = false;
      }
    } catch(_) {}
  }

  // Generic fade helper: targetFactor between 0..1 multiplies the effective base volume
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
    // minDelay/maxDelay in seconds
    this.stopRandomAmbient();
    this._randomAmbientOptions = { minDelay, maxDelay, playProbability, volume };
    // schedule first event
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
    // store scheduling metadata so we can pause/resume
    this._randomAmbientDelayMs = delayMs;
    this._randomAmbientScheduledAt = Date.now();
    this._randomAmbientRemainingMs = null;
    this._randomAmbientPaused = false;
    this._randomAmbientTimer = setTimeout(async () => {
      // clear scheduling metadata for this attempt
      this._randomAmbientScheduledAt = null;
      this._randomAmbientDelayMs = null;
      // If options were cleared while waiting
      const opts = this._randomAmbientOptions;
      if (!opts) return;
      const { playProbability, volume } = opts;
      if (Math.random() <= (playProbability ?? 0.6)) {
        // pick one of the ambient tracks at random
        const key = Math.random() < 0.5 ? 'ambient1' : 'ambient2';
        try {
          const audio = await this.playAmbientMusic(key, { loop: false, volume });
          if (audio) {
            // when it ends, schedule next
            try {
              audio.onEnded = () => { this._scheduleNextRandomAmbient(); };
            } catch (_) {
              // fallback: if onEnded not available, schedule after buffer duration
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
      // If we didn't play, schedule the next attempt
      this._scheduleNextRandomAmbient();
    }, delayMs);
  }

  _pauseRandomAmbient() {
    // If there's a scheduled attempt, compute remaining and clear it
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
      // Stop any ambientMusic playing (we'll not try to resume the exact offset)
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
    // If we had a remaining ms, schedule with that; otherwise schedule normally
    if (this._randomAmbientRemainingMs != null) {
      const remaining = Math.max(0, this._randomAmbientRemainingMs);
      this._randomAmbientRemainingMs = null;
      // schedule the next attempt after remaining
      this._randomAmbientDelayMs = remaining;
      this._randomAmbientScheduledAt = Date.now();
      this._randomAmbientTimer = setTimeout(() => { try { this._scheduleNextRandomAmbient(); } catch(_) {} }, remaining);
    } else {
      // normal schedule
      try { this._scheduleNextRandomAmbient(); } catch(_) {}
    }
    // We don't automatically restart the exact ambientMusic that was playing before pause
    this._randomAmbientPaused = false;
  }

  // ========================
  // Efectos (SFX)
  // ========================
  async playSFX(key, { object3D = null, position = null, volume = 1, loop = false } = {}) {
    const url = AUDIO.sfx[key];
    if (!url) return null;
    try {
      const buffer = await this._loadBuffer(url);
      if (!buffer) return null;

      const isPositional = !!(object3D || position);
      const audio = isPositional ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      audio.setLoop(loop);
      audio.userData = audio.userData || {};
      audio.userData.baseVolume = volume;
      // Volumen final con master y sfxVolume
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
