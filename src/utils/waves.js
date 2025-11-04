import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { Alien1 } from "./Alien1.js";
import { integrateEntityWithCombat } from "./CombatSystem.js";
import { safePlaySfx } from './audioHelpers.js';

/**
 * WaveManager: controla oleadas de enemigos (Alien1)
 * - spawnea enemigos en posiciones configurables
 * - registra a los enemigos en el CombatSystem
 * - notifica cuando una oleada termina y cuando todas terminan
 */
export class WaveManager {
  constructor(scene, modelLoader, combatSystem, options = {}) {
    this.scene = scene;
    this.modelLoader = modelLoader;
    this.combat = combatSystem;
    
    // Speed control
    this.speedMultiplier = 1;
    this.speedBoostActive = false;
    this.normalSpeed = 1;
    this.boostedSpeed = 10; // 10x speed when spacebar is pressed

    // optional helpers to locate player and cows in the world
    this.getPlayer = options.getPlayer || null;
    this.getCows = options.getCows || null;

  this.spawnPoints = options.spawnPoints || [ { x: 0, y: 0, z: -10 } ];
  // Optional dynamic spawn strategy around corral
  this.getCorral = options.getCorral || null; // function returning corral object with position/size
  this.getStones = options.getStones || null; // function returning array of Stone instances
  this.getMarket = options.getMarket || null; // function returning Market instance
  this.getHouse = options.getHouse || null; // function returning House instance
  this.getShip = options.getShip || options.getSpaceShuttle || null; // function returning SpaceShuttle instance
  this.spawnRingMin = options.spawnRingMin || 28; // min distance from corral center
  this.spawnRingMax = options.spawnRingMax || 65; // max distance from corral center
  this.spawnAvoidMargin = options.spawnAvoidMargin || 1.2; // meters to keep away from obstacles
  this.alienDetectionRange = options.alienDetectionRange || 160; // override for aliens
  this.playerAggroRadius = options.playerAggroRadius || 14; // prefer player if within this radius

    // Infinite waves configuration (cycles 1..5 enemies, with rest every 5 waves)
  this.baseHealth = options.baseHealth || 100;
  this.baseDamage = options.baseDamage || 5; // daño base inicial reducido
    this.spawnInterval = 600; // ms default per enemy spawn
    this.maxPerWave = options.maxPerWave || 5; // cap of enemies per wave pattern
    this.restEvery = options.restEvery || 5; // rest every N waves
    this.restDurationMs = options.restDurationMs || 5 * 60 * 1000; // 5 minutes
  // Progressive difficulty per tier (each tier is a block of maxPerWave waves)
  this.healthTierIncrement = options.healthTierIncrement || 0.5; // +50% vida por tier
  this.damageTierIncrement = options.damageTierIncrement || 0.2; // +20% daño por tier
  this.nextWaveDelayMs = options.nextWaveDelayMs || 3 * 60 * 1000; // 3 minutos entre oleadas normales

    // Internals
    this.currentWaveIndex = -1; // 0-based, waveNumber = currentWaveIndex+1
    this.waveNumber = 0; // 1-based tracker for readability
    this.activeEnemies = new Map(); // id -> { instance, health }
    this._nextId = 1;

    // spawning state
    this.enemiesToSpawn = 0;
    this._lastSpawnAt = 0;

    // callbacks
    this.onWaveStart = options.onWaveStart || function () {};
    this.onWaveComplete = options.onWaveComplete || function () {};
    this.onAllWavesComplete = options.onAllWavesComplete || function () {};

    this._running = false;
    this._resting = false;
    this._restTimeout = null;
    this._restCountdownEl = null;
    this._restCountdownTimer = null;
    // next wave (normal delay) UI
    this._nextCountdownEl = null;
    this._nextCountdownTimer = null;
    this._nextTimeout = null;
    // prevent multiple schedules between waves
    this._waitingNextWave = false;
    // pause/resume helpers
    this._nextEndAt = null; // timestamp ms when next wave should start
    this._restEndAt = null; // timestamp ms when rest ends
    this._nextRemaining = null; // ms remaining while paused
    this._restRemaining = null; // ms remaining while paused
    this._paused = false;
  this._inCombat = false; // flag: true while player is engaged with enemies

    // listen for global pause/resume events
    try {
      window.addEventListener('gamepause', () => this.pause());
      window.addEventListener('gameresume', () => this.resume());
      
      // Add spacebar speed control
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
          this.speedMultiplier = this.boostedSpeed;
          this.speedBoostActive = true;
          this._updateSpeedUI(true);
        }
      });
      
      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          this.speedMultiplier = this.normalSpeed;
          this.speedBoostActive = false;
          this._updateSpeedUI(false);
        }
      });
    } catch (_) {}
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.currentWaveIndex = -1;
    this._startNextWave();
  }

  stop() {
    this._running = false;
    // do not remove active enemies here
  }

  _startNextWave() {
    // clear rest state/UI if any
    this._clearRestUI();
    // clear normal next-wave UI if any
    this._clearNextWaveUI();
    // we are no longer waiting for next wave
    this._waitingNextWave = false;

    this.currentWaveIndex++;
    this.waveNumber = this.currentWaveIndex + 1; // 1-based

    // Compute wave config dynamically (infinite)
    const count = ((this.waveNumber - 1) % this.maxPerWave) + 1; // cycles 1..maxPerWave
    const tier = Math.floor((this.waveNumber - 1) / this.maxPerWave); // 0 for 1..5, 1 for 6..10, etc.
    const healthMultiplier = 1.0 + (tier * this.healthTierIncrement);
    const damageMultiplier = 1.0 + (tier * this.damageTierIncrement);
    const waveCfg = {
      count,
      spawnInterval: this.spawnInterval,
      healthMultiplier,
      damageMultiplier,
    };

    this.enemiesToSpawn = waveCfg.count;
    this._lastSpawnAt = 0;

    // notify
  this.onWaveStart(this.currentWaveIndex, waveCfg);
  // play an alert SFX when a wave starts (aliens spawning)
  try { safePlaySfx('alienSound', { volume: 0.9 }); } catch (_) {}
    this._currentWaveCfg = waveCfg;
  }

  // spawn immediate (used by update loop)
  async _spawnOne() {
    if (!this._running) return;
    if (this.enemiesToSpawn <= 0) return;
    // Reservar un slot inmediatamente para evitar spawns superpuestos si la carga demora
    this.enemiesToSpawn--;

  // pick a valid spawn point (prefer around corral and clear of stones)
  const spawnPoint = this._getValidSpawnPoint();

  const id = `alien1_${this._nextId++}`;

  const pos = { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z };
    const lookAt = { x: 0, y: 0, z: 0 };

    const enemy = new Alien1(this.scene, this.modelLoader, pos, lookAt);
    const loaded = await enemy.load();
    if (!loaded) {
      // Reponer el slot para reintentar en el próximo tick
      this.enemiesToSpawn++;
      return;
    }

    // expose controller on model for callbacks (integrateEntityWithCombat expects model.userData.controller)
    enemy.model.userData = enemy.model.userData || {};
    enemy.model.userData.controller = enemy;

    // integrate with combat system
    const waveCfg = this._currentWaveCfg || { healthMultiplier: 1, damageMultiplier: 1 };
    const maxHealth = Math.round((waveCfg.healthMultiplier || 1) * (this.baseHealth || 100));

    const hc = integrateEntityWithCombat(this.combat, id, enemy.model, maxHealth, {
      team: 'enemy',
      hurtRadius: 0.8,
      disableOnDeath: true,
      onDeath: (killerId) => {
        // remove from active list
        this.activeEnemies.delete(id);
        // Regenerar vida del granjero al matar a un alien
        try {
          const playerModel = (typeof this.getPlayer === 'function') ? this.getPlayer() : (window.farmerController ? window.farmerController.model : null);
          const playerCtrl = playerModel && playerModel.userData ? playerModel.userData.controller : null;
          const ph = playerCtrl && playerCtrl.healthComponent ? playerCtrl.healthComponent : null;
          if (ph && typeof ph.heal === 'function') ph.heal(ph.maxHealth || 9999);
          else if (ph) ph.current = ph.maxHealth;
        } catch (_) {}
        this._checkWaveComplete();
      }
    });

    // attach combat hooks to the enemy so it can use CombatSystem and find targets
    enemy.attachCombat(
      this.combat,
      id,
      hc,
      () => {
        if (typeof this.getPlayer === 'function') return this.getPlayer();
        return window.farmerController ? window.farmerController.model : null;
      },
      () => {
        if (typeof this.getCows === 'function') return this.getCows();
        return window.cows || [];
      }
    );

    // attach world obstacle providers so Alien1 can avoid collisions
    try { if (typeof this.getStones === 'function') enemy.getStones = this.getStones; } catch(_) {}
    try { if (typeof this.getCorral === 'function') enemy.getCorral = this.getCorral; } catch(_) {}
    try { if (typeof this.getHouse === 'function') enemy.getHouse = this.getHouse; } catch(_) {}
    try { if (typeof this.getMarket === 'function') enemy.getMarket = this.getMarket; } catch(_) {}
    try { if (typeof this.getShip === 'function') enemy.getShip = this.getShip; } catch(_) {}

  // Boost enemy damage based on wave and extend detection range to keep them moving toward corral
  try {
    enemy.attackDamage = Math.round((this.baseDamage) * (waveCfg.damageMultiplier || 1));
    if (this.alienDetectionRange) enemy.detectionRange = this.alienDetectionRange;
    if (this.playerAggroRadius) enemy.playerAggroRadius = this.playerAggroRadius;
    // Provide optional corral center fallback for target acquisition
    if (typeof this.getCorral === 'function') {
      enemy.getCorralCenter = () => {
        try {
          const c = this.getCorral();
          if (!c) return null;
          const pos = c.position || (c.model ? c.model.position : null);
          if (!pos) return null;
          // Allow Alien1 to accept plain {x,y,z} too
          return { position: { x: pos.x, y: pos.y || 0, z: pos.z } };
        } catch (_) { return null; }
      };
    }
  } catch (_) {}

  // store
    this.activeEnemies.set(id, { instance: enemy, health: hc });

    // --- Debug globals: expose aliens for console diagnostics ---
    try {
      if (!window.aliens) window.aliens = [];
      window.aliens.push(enemy);
      // keep a convenience alias for first/last spawned
      if (!window.alien1) window.alien1 = enemy; // first one
      window.alienLast = enemy; // last spawned
      // helper to print diagnostics for all
      if (!window.printAllAlienAnims) {
        window.printAllAlienAnims = function () {
          if (!window.aliens || window.aliens.length === 0) {
            return;
          }
          window.aliens.forEach((a, i) => {
            const diag = a.getAnimationDiagnostics ? a.getAnimationDiagnostics() : null;
            console.group(`Alien[${i}]`);
            if (diag) {
              console.table(Object.keys(diag).map(k => ({ name: k, ...diag[k] })));
            }
            console.groupEnd();
          });
        };
      }
    } catch (_) {}

    // Slot ya reservado al comienzo; no modificar enemiesToSpawn aquí
  }

  // --- Spawn helpers ---
  _getValidSpawnPoint() {
    // Try to generate around corral if available
    const maxAttempts = 30;
    const corral = (typeof this.getCorral === 'function') ? this.getCorral() : null;
    const stones = (typeof this.getStones === 'function') ? (this.getStones() || []) : (window.stones || []);

    if (corral && corral.position) {
      const center = corral.position;
      const innerR = this._computeInnerRadius(corral);
      const minR = Math.max(innerR + 4, this.spawnRingMin);
      const maxR = Math.max(minR + 10, this.spawnRingMax);
      for (let i = 0; i < maxAttempts; i++) {
        const theta = Math.random() * Math.PI * 2;
        const r = minR + Math.random() * (maxR - minR);
        const candidate = { x: center.x + Math.cos(theta) * r, y: 0, z: center.z + Math.sin(theta) * r };
        if (this._isSpawnPositionClear(candidate, stones, corral, innerR)) return candidate;
      }
    }

    // Fallback to predefined points with clearance check
    const shuffled = [...this.spawnPoints].sort(() => Math.random() - 0.5);
    for (const sp of shuffled) {
      const candidate = { x: sp.x, y: sp.y || 0, z: sp.z };
      if (this._isSpawnPositionClear(candidate, stones, corral, null)) return candidate;
    }

    // As a last resort, return a random predefined point
    return this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)] || { x: 0, y: 0, z: -10 };
  }

  _computeInnerRadius(corral) {
    try {
      if (corral && corral.size) {
        const w = corral.size.width || 0;
        const d = corral.size.depth || 0;
        return Math.max(w, d) * 0.5; // half-diagonal approximation handled in ring min
      }
    } catch (_) {}
    return this.spawnRingMin;
  }

  _isSpawnPositionClear(pos, stones, corral, innerRadiusMaybe) {
    const margin = this.spawnAvoidMargin || 1.2;
    try {
      // Avoid inside corral area (simple radial check)
      if (corral && corral.position) {
        const cx = corral.position.x, cz = corral.position.z;
        const dx = pos.x - cx, dz = pos.z - cz;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const minR = (innerRadiusMaybe != null ? innerRadiusMaybe : this._computeInnerRadius(corral)) + 2;
        if (dist < minR) return false;
      }
    } catch (_) {}

    // Avoid stones (approximate each stone as a circle on XZ)
    if (stones && stones.length) {
      for (const s of stones) {
        try {
          const mdl = s && (s.model || (typeof s.getModel === 'function' ? s.getModel() : null));
          if (!mdl) continue;
          const center = mdl.position;
          const box = (s.getBoundingBox ? s.getBoundingBox() : null);
          let stoneRadius = 1.5; // default small rock
          if (box && box.min && box.max) {
            const sizeX = Math.abs(box.max.x - box.min.x);
            const sizeZ = Math.abs(box.max.z - box.min.z);
            stoneRadius = Math.max(sizeX, sizeZ) * 0.5;
          }
          const dx = pos.x - center.x, dz = pos.z - center.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          if (dist < (stoneRadius + margin)) return false;
        } catch (_) {}
      }
    }

    // Avoid structures: market, house, ship (SpaceShuttle)
    const structures = [];
    try { if (typeof this.getMarket === 'function') { const m = this.getMarket(); if (m) structures.push({ kind: 'market', ref: m }); } } catch(_) {}
    try { if (typeof this.getHouse === 'function') { const h = this.getHouse(); if (h) structures.push({ kind: 'house', ref: h }); } } catch(_) {}
    try { if (typeof this.getShip === 'function') { const sh = this.getShip(); if (sh) structures.push({ kind: 'ship', ref: sh }); } } catch(_) {}

    for (const s of structures) {
      try {
        // get center position
        let center = null;
        if (s.ref && s.ref.position) center = s.ref.position;
        else if (s.ref && s.ref.model && s.ref.model.position) center = s.ref.model.position;
        else if (s.ref && s.ref.marketGroup && s.ref.marketGroup.position) center = s.ref.marketGroup.position;
        if (!center) continue;

        // compute radius from size or bounding box
        let radius = 4; // default small footprint
        if (s.ref.size && (s.ref.size.width || s.ref.size.depth)) {
          const w = s.ref.size.width || 0;
          const d = s.ref.size.depth || 0;
          // half diagonal approximates circumscribed circle radius
          radius = Math.sqrt((w*w + d*d)) * 0.5;
        } else if (typeof s.ref.getBoundingBox === 'function') {
          const box = s.ref.getBoundingBox();
          if (box && box.min && box.max) {
            const sizeX = Math.abs(box.max.x - box.min.x);
            const sizeZ = Math.abs(box.max.z - box.min.z);
            radius = Math.max(sizeX, sizeZ) * 0.5;
          }
        }

        const dx = pos.x - center.x;
        const dz = pos.z - center.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < (radius + Math.max(margin, 1.8))) return false; // enforce extra margin for buildings
      } catch (_) {}
    }

    return true;
  }

  _checkWaveComplete() {
    if (this.enemiesToSpawn <= 0 && this.activeEnemies.size === 0) {
      // avoid duplicate scheduling
      if (this._resting || this._waitingNextWave) return;
      const finishedWave = this.currentWaveIndex;
      const waveNumber = finishedWave + 1;
      const finishedCfg = this._currentWaveCfg || {};
      this.onWaveComplete(finishedWave, finishedCfg);
      // Force-stop combat music immediately to avoid lingering audio
      try {
        if (window.audio && typeof window.audio.stopCombatMusic === 'function') {
          try { window.audio.stopCombatMusic({ fadeOutMs: 0 }); } catch(_) {}
        }
      } catch(_) {}
      // stop/dilute combat music when wave completes
      try {
        if (window.audio && typeof window.audio.stopCombatMusic === 'function') {
          try { window.audio.stopCombatMusic({ fadeOutMs: 1200 }); } catch(_) {}
        }
      } catch(_) {}
      // every N waves -> rest period
      if (this.restEvery > 0 && waveNumber % this.restEvery === 0) {
        this._scheduleRestThenNext();
      } else {
        // pausa estándar entre oleadas no múltiplos de 5 con contador visible
        this._scheduleNextWaveThenStart(this.nextWaveDelayMs);
      }
    }
  }

  // update should be called from main loop. delta in seconds
  _updateSpeedUI(isFast) {
    try {
      let speedIndicator = document.getElementById('speed-indicator');
      if (!speedIndicator) {
        speedIndicator = document.createElement('div');
        speedIndicator.id = 'speed-indicator';
        speedIndicator.style.position = 'fixed';
        speedIndicator.style.bottom = '20px';
        speedIndicator.style.right = '20px';
        speedIndicator.style.padding = '8px 16px';
        speedIndicator.style.background = 'rgba(0,0,0,0.7)';
        speedIndicator.style.color = '#fff';
        speedIndicator.style.borderRadius = '4px';
        speedIndicator.style.fontFamily = 'Arial, sans-serif';
        speedIndicator.style.fontSize = '14px';
        speedIndicator.style.zIndex = '1000';
        speedIndicator.style.display = 'none';
        document.body.appendChild(speedIndicator);
      }
      
      if (isFast) {
        speedIndicator.textContent = 'Velocidad: RÁPIDA (x' + this.boostedSpeed + ')';
        speedIndicator.style.display = 'block';
        speedIndicator.style.color = '#ffcc00';
      } else {
        speedIndicator.style.display = 'none';
      }
    } catch (e) {
      console.error('Error updating speed UI:', e);
    }
  }

  update(delta) {
    if (!this._running) return;
    if (this._paused) return; // while paused, halt update-driven progress (spawns, enemy updates)
    
    // Apply speed multiplier to delta time
    const adjustedDelta = delta * this.speedMultiplier;
    const now = performance.now();

    // spawn logic: respect spawnInterval (ms) with speed multiplier
    if (this.enemiesToSpawn > 0) {
      const effectiveSpawnInterval = this.spawnInterval / this.speedMultiplier;
      if (!this._lastSpawnAt || now - this._lastSpawnAt >= effectiveSpawnInterval) {
        this._lastSpawnAt = now;
        this._spawnOne();
      }
    } else {
      // no more to spawn, check completion
      this._checkWaveComplete();
    }

    // update active enemies (call their update if present)
    for (const [id, entry] of this.activeEnemies.entries()) {
      try {
        if (entry.instance && typeof entry.instance.update === 'function') entry.instance.update(delta);
      } catch (err) {
        return err;
      }
    }

    // Combat state detection: if any enemy is near player, enter combat (once) and start combat music.
    try {
      if (this.activeEnemies.size > 0 && !this._inCombat && window.audio) {
        const playerModel = (typeof this.getPlayer === 'function') ? this.getPlayer() : (window.farmerController ? window.farmerController.model : null);
        if (playerModel && playerModel.position) {
          const pPos = playerModel.position;
          for (const [id, entry] of this.activeEnemies.entries()) {
            try {
              const mdl = entry.instance && entry.instance.model ? entry.instance.model : (entry.model || null);
              if (!mdl) continue;
              const box = new THREE.Box3().setFromObject(mdl);
              const sph = new THREE.Sphere();
              box.getBoundingSphere(sph);
              const dx = (sph.center.x || 0) - pPos.x;
              const dy = (sph.center.y || 0) - pPos.y;
              const dz = (sph.center.z || 0) - pPos.z;
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              const threshold = (this.playerAggroRadius || 14) + (sph.radius || 1);
              if (dist <= threshold) {
                // enter combat and start combat music (only once per combat)
                this._inCombat = true;
                try {
                  const choice = Math.random() < 0.5 ? 'combat1' : 'combat2';
                  if (typeof window.audio.playCombatMusic === 'function') window.audio.playCombatMusic(choice, { loop: true, volume: 1, fadeInMs: 700 });
                } catch(_) {}
                break;
              }
            } catch(_) {}
          }
        }
      }
    } catch (_) {}

    // If no active enemies remain, exit combat and stop combat music
    try {
      if (this._inCombat && this.enemiesToSpawn <= 0 && this.activeEnemies.size === 0) {
        this._inCombat = false;
        try {
          if (window.audio && typeof window.audio.stopCombatMusic === 'function') window.audio.stopCombatMusic({ fadeOutMs: 800 });
        } catch(_) {}
      }
    } catch(_) {}
  }

  // debug: spawn all remaining immediately
  spawnAllNow() {
    while (this.enemiesToSpawn > 0) {
      this._spawnOne();
    }
  }

  // ---- Rest management (internal) ----
  _scheduleRestThenNext() {
    this._resting = true;
    this._waitingNextWave = true;
    const effectiveRestDuration = this.restDurationMs / this.speedMultiplier;
    const endAt = Date.now() + effectiveRestDuration;
    this._restEndAt = endAt;
    // Create simple countdown UI
    this._ensureRestCountdownEl();
    const tick = () => {
      const remainMs = Math.max(0, this._restEndAt - Date.now());
      const sec = Math.ceil(remainMs / 1000);
      const mins = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, '0');
      if (this._restCountdownEl) this._restCountdownEl.textContent = `Descanso: ${mins}:${s}`;
      if (remainMs <= 0) {
        clearInterval(this._restCountdownTimer);
        this._restCountdownTimer = null;
      }
    };
    tick();
    this._restCountdownTimer = setInterval(tick, 1000);
    this._restTimeout = setTimeout(() => {
      this._resting = false;
      this._restEndAt = null;
      this._clearRestUI();
      this._startNextWave();
    }, this.restDurationMs);
  }

  _ensureRestCountdownEl() {
    if (this._restCountdownEl) return this._restCountdownEl;
    try {
      const el = document.createElement('div');
      el.id = 'rest-countdown';
      el.style.position = 'fixed';
      el.style.top = '12px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '8px 12px';
      el.style.background = 'rgba(0,0,0,0.65)';
      el.style.color = '#fff';
      el.style.fontFamily = 'Arial, sans-serif';
      el.style.fontSize = '18px';
      el.style.borderRadius = '6px';
      el.style.zIndex = '10000';
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.95';
      el.textContent = 'Descanso: 5:00';
      document.body.appendChild(el);
      this._restCountdownEl = el;
      return el;
    } catch (_) { return null; }
  }

  _clearRestUI() {
    try {
      if (this._restCountdownTimer) { clearInterval(this._restCountdownTimer); this._restCountdownTimer = null; }
      if (this._restTimeout) { clearTimeout(this._restTimeout); this._restTimeout = null; }
      if (this._restCountdownEl && this._restCountdownEl.parentElement) {
        this._restCountdownEl.parentElement.removeChild(this._restCountdownEl);
      }
      this._restCountdownEl = null;
    } catch (_) {}
  }

  // ---- Normal next-wave countdown (non-rest) ----
  _scheduleNextWaveThenStart(delayMs) {
    this._waitingNextWave = true;
    const effectiveDelay = delayMs / this.speedMultiplier;
    const endAt = Date.now() + effectiveDelay;
    this._nextEndAt = endAt;
    this._ensureNextWaveCountdownEl();
    const tick = () => {
      const remainMs = Math.max(0, this._nextEndAt - Date.now());
      const sec = Math.ceil(remainMs / 1000);
      const mins = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, '0');
      if (this._nextCountdownEl) this._nextCountdownEl.textContent = `Siguiente oleada: ${mins}:${s}`;
      if (remainMs <= 0) {
        clearInterval(this._nextCountdownTimer);
        this._nextCountdownTimer = null;
      }
    };
    tick();
    this._nextCountdownTimer = setInterval(tick, 1000);
    this._nextTimeout = setTimeout(() => {
      this._nextEndAt = null;
      this._clearNextWaveUI();
      this._startNextWave();
    }, delayMs);
  }

  _ensureNextWaveCountdownEl() {
    if (this._nextCountdownEl) return this._nextCountdownEl;
    try {
      const el = document.createElement('div');
      el.id = 'nextwave-countdown';
      el.style.position = 'fixed';
      el.style.top = '12px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '8px 12px';
      el.style.background = 'rgba(0,0,0,0.65)';
      el.style.color = '#fff';
      el.style.fontFamily = 'Arial, sans-serif';
      el.style.fontSize = '18px';
      el.style.borderRadius = '6px';
      el.style.zIndex = '10000';
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.95';
      el.textContent = 'Siguiente oleada: 3:00';
      document.body.appendChild(el);
      this._nextCountdownEl = el;
      return el;
    } catch (_) { return null; }
  }

  _clearNextWaveUI() {
    try {
      if (this._nextCountdownTimer) { clearInterval(this._nextCountdownTimer); this._nextCountdownTimer = null; }
      if (this._nextTimeout) { clearTimeout(this._nextTimeout); this._nextTimeout = null; }
      if (this._nextCountdownEl && this._nextCountdownEl.parentElement) {
        this._nextCountdownEl.parentElement.removeChild(this._nextCountdownEl);
      }
      this._nextCountdownEl = null;
    } catch (_) {}
  }

  // Pause timers (countdowns) and store remaining time
  pause() {
    if (this._paused) return;
    this._paused = true;
    try {
      // pause rest countdown
      if (this._restEndAt != null) {
        let remaining = Math.max(0, this._restEndAt - Date.now());
        // small grace window to avoid races where pause happens right as timeout fires
        if (remaining < 250) remaining = 250;
        this._restRemaining = remaining;
        if (this._restTimeout) { clearTimeout(this._restTimeout); this._restTimeout = null; }
      }
      if (this._restCountdownTimer) { clearInterval(this._restCountdownTimer); this._restCountdownTimer = null; }

      // pause next wave countdown
      if (this._nextEndAt != null) {
        let remaining = Math.max(0, this._nextEndAt - Date.now());
        // small grace window to avoid races where pause happens right as timeout fires
        if (remaining < 250) remaining = 250;
        this._nextRemaining = remaining;
        if (this._nextTimeout) { clearTimeout(this._nextTimeout); this._nextTimeout = null; }
      }
      if (this._nextCountdownTimer) { clearInterval(this._nextCountdownTimer); this._nextCountdownTimer = null; }
    } catch (_) {}
  }

  // Resume timers from stored remaining values
  resume() {
    if (!this._paused) return;
    this._paused = false;
    try {
      // resume rest countdown
      if (this._restRemaining != null) {
        // if remaining is 0 or negative, immediately finish
        const rem = Math.max(0, this._restRemaining);
        if (rem <= 0) {
          this._restRemaining = null;
          this._restEndAt = null;
          // ensure UI cleared and start next wave
          this._resting = false;
          this._clearRestUI();
          this._startNextWave();
        } else {
          this._restEndAt = Date.now() + rem;
          this._ensureRestCountdownEl();
          const tickRest = () => {
            const remainMs = Math.max(0, this._restEndAt - Date.now());
            const sec = Math.ceil(remainMs / 1000);
            const mins = Math.floor(sec / 60);
            const s = String(sec % 60).padStart(2, '0');
            if (this._restCountdownEl) this._restCountdownEl.textContent = `Descanso: ${mins}:${s}`;
            if (remainMs <= 0) { clearInterval(this._restCountdownTimer); this._restCountdownTimer = null; }
          };
          tickRest();
          this._restCountdownTimer = setInterval(tickRest, 1000);
          this._restTimeout = setTimeout(() => {
            this._resting = false;
            this._restEndAt = null;
            this._restRemaining = null;
            this._clearRestUI();
            this._startNextWave();
          }, rem);
        }
      }

      // resume next wave countdown
      if (this._nextRemaining != null) {
        const rem2 = Math.max(0, this._nextRemaining);
        if (rem2 <= 0) {
          this._nextRemaining = null;
          this._nextEndAt = null;
          this._clearNextWaveUI();
          this._startNextWave();
        } else {
          this._nextEndAt = Date.now() + rem2;
          this._ensureNextWaveCountdownEl();
          const tickNext = () => {
            const remainMs = Math.max(0, this._nextEndAt - Date.now());
            const sec = Math.ceil(remainMs / 1000);
            const mins = Math.floor(sec / 60);
            const s = String(sec % 60).padStart(2, '0');
            if (this._nextCountdownEl) this._nextCountdownEl.textContent = `Siguiente oleada: ${mins}:${s}`;
            if (remainMs <= 0) { clearInterval(this._nextCountdownTimer); this._nextCountdownTimer = null; }
          };
          tickNext();
          this._nextCountdownTimer = setInterval(tickNext, 1000);
          this._nextTimeout = setTimeout(() => {
            this._nextEndAt = null;
            this._nextRemaining = null;
            this._clearNextWaveUI();
            this._startNextWave();
          }, rem2);
        }
      }
    } catch (_) {}
  }
}

window.createWaveManager = function (scene, modelLoader, combatSystem, opts) {
  if (!window.waveManager) window.waveManager = new WaveManager(scene, modelLoader, combatSystem, opts || {});
  return window.waveManager;
};

export default WaveManager;
