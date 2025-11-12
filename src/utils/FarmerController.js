import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import modelConfig from "../config/modelConfig.js";
import CombatSystem, { integrateEntityWithCombat } from "./CombatSystem.js";
import HealthBar from "./Healthbar.js";
import { safePlaySfx } from './audioHelpers.js';


export class FarmerController {
  constructor(model, modelLoader, camera, config = {}) {
    this.model = model;
    this.modelLoader = modelLoader;
    this.camera = camera;
    this.config = {
      moveSpeed: 0.3,
      rotationSpeed: 0.1, 
      runMultiplier: 5.5, 
      bounds: {
        minX: -250, 
        maxX: 250, 
        minZ: -250, 
        maxZ: 250,
      },
      ...config,
    };
    this.cows = null;
    this.market = null;
    this.inventory = null;
    this.equippedWeapon = null;
    this.isEquipped = false;
  this._isDead = false;

    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      shift: false,
      e: false, 
      q: false, 
      1: false, 
    };
    this.isRotating = false;
    this.targetRotation = null;
    this.rotationSpeed = Math.PI; 
    this.isRotatedForBackward = false;
    this.originalRotation = 0;
    this.isCollidingWithCow = false;
    this.cowCollisionState = "none"; 
    this.cowCollisionStartTime = 0;
    this.currentCollidedCow = null;
    this.kneelingDownDuration = 2000; 
    this.kneelingDuration = 8000; 

    this.characterSize = new THREE.Vector3(1, 1, 1);
    this.stoneCollisionSize = new THREE.Vector3(0.5, 0.5, 0.5);
    this.setupEventListeners();
    this.isAttacking = false; 
    this._nextAttackSide = null; 
    this._isInMeleeSequence = false; 
    this._nextPunchTimeout = null;
    this._combatExitTimer = null; 
    this._combatIdleUntil = 0; 
    this._mixerFinishedListener = null; 
    
    this._onMouseDown = (event) => {
        if (event.button !== 0) return;
        try {
          const canvas = (window && window.renderer && window.renderer.domElement) || null;
          if (canvas) {
            if (!canvas.contains(event.target)) return;
          } else {
            let el = event.target;
            while (el) {
              if (el.id) {
                const blockedIds = [
                  'inventory-hud', 'minimap-hud', 'objectives-hud', 'sound-hud',
                  'pause-overlay', 'main-menu', 'difficulty-menu', 'story-carousel',
                  'controls-hud', 'hud-buttons-container', 'farmer-coordinate-hud',
                  'inventory-container', 'minimap-container', 'objectives-container', 'ship-popup'
                ];
                if (blockedIds.includes(el.id)) return;
              }
              if (el.classList) {
                if (
                  el.classList.contains('menu-button') ||
                  el.classList.contains('inventory-expanded') ||
                  el.classList.contains('inventory-collapsed') ||
                  el.classList.contains('minimap-expanded') ||
                  el.classList.contains('minimap-collapsed') ||
                  el.classList.contains('hud-button-container')
                ) return;
              }
              el = el.parentElement;
            }
          }
        } catch (e) {
          // If anything goes wrong while detecting UI, be conservative and ignore the click
          return;
        }

        if (!this.inputEnabled || this._isDead) return;

        this._clearCombatExitTimer();

        if (!this._nextAttackSide) this._nextAttackSide = Math.random() < 0.5 ? "left" : "right";
        const side = this._nextAttackSide;
        try {
          try {
            this.attack();
          } catch (e) {
            return e;
          }

          const actionName = side === "left" ? "punch_left" : "punch_right";
          const action = this.modelLoader?.actions?.[actionName];
          if (action) {
            this._isInMeleeSequence = true;
            this._combatIdleUntil = 0;
            this._clearCombatExitTimer();
            try { action.setLoop(THREE.LoopOnce, 0); action.clampWhenFinished = true; } catch (e) {}
            this.modelLoader.play(actionName, 0.06);

            try { safePlaySfx('punch', { object3D: this.model, volume: 0.9 }); } catch (_) {}

          } else {
            try {
              this._isInMeleeSequence = true;
              this._clearCombatExitTimer();
              this._combatIdleUntil = Date.now() + 1000;
              this.modelLoader.play("combat_idle", 0.08);              
              this._combatExitTimer = setTimeout(() => {
                if (!this._combatIdleUntil || Date.now() < this._combatIdleUntil) return;
                try { if (this.modelLoader) this.modelLoader.play("idle", 0.15); } catch (e) {}
                this._combatExitTimer = null;
                this._combatIdleUntil = 0;
                this._nextAttackSide = null;
                this._isInMeleeSequence = false;
                try { this.updateAnimationState(); } catch (e) {}
              }, 1000);
            } catch (e) {
              return e;
            }
          }
        } catch (e) {
          return e;
        }

        this._nextAttackSide = side === "left" ? "right" : "left";
      };

      this._onMouseUp = (event) => {
        if (event.button !== 0) return;
        this.isAttacking = false;
      };

      document.addEventListener("mousedown", this._onMouseDown);
      document.addEventListener("mouseup", this._onMouseUp);

      // Intentar cargar/registrar las animaciones de combate y muerte si existen en modelConfig
    try {
      // Rutas esperadas (si los archivos están en src/models/...)
      const anims = {
        combat_idle: modelConfig.getPath(
          "characters/farmer/Granjero2_combat_idle.fbx"
        ),
        punch_left: modelConfig.getPath(
          "characters/farmer/Granjero2_Punching_Left.fbx"
        ),
            punch_right: modelConfig.getPath(
              "characters/farmer/Granjero2_Punching_Right.fbx"
            ),
          death: modelConfig.getPath(
            (modelConfig.characters?.farmer2?.animations?.death) || "characters/farmer/Granjero2_Death.fbx"
          ),
      };

      if (this.modelLoader && typeof this.modelLoader.loadAnimations === "function") {
        this.modelLoader
          .loadAnimations(anims)
          .then(async () => {
            try {
              const actions = this.modelLoader.actions || {};
              if (actions.punch_left) {
                actions.punch_left.setLoop(THREE.LoopOnce, 0);
                actions.punch_left.clampWhenFinished = true;
              }
              if (actions.punch_right) {
                actions.punch_right.setLoop(THREE.LoopOnce, 0);
                actions.punch_right.clampWhenFinished = true;
              }
              if (actions.combat_idle) {
                actions.combat_idle.setLoop(THREE.LoopRepeat, Infinity);
              }
              if (actions.death) {
                try { actions.death.setLoop(THREE.LoopOnce, 0); actions.death.clampWhenFinished = true; } catch (e) {}
              }
              if (this.modelLoader.mixer && !this._mixerFinishedListener) {
                this._mixerFinishedListener = (e) => this._onMixerFinished(e);
                this.modelLoader.mixer.addEventListener(
                  "finished",
                  this._mixerFinishedListener
                );
              }
              try {
                const available = Object.keys(this.modelLoader.actions || {});
                const actionsObj = this.modelLoader.actions || {};
                const findBy = (subs) => available.find((k) => subs.some(s => k.toLowerCase().includes(s)));

                if (!actionsObj.punch_left || !actionsObj.punch_right) {
                  const leftCandidate = findBy(['punch', 'left', 'punch_left', 'punching']) || findBy(['hit', 'attack', 'melee']);
                  const rightCandidate = findBy(['punch_right','right']) || leftCandidate;

                  if (leftCandidate && !actionsObj.punch_left) {
                    actionsObj.punch_left = actionsObj[leftCandidate];
                  }
                  if (rightCandidate && !actionsObj.punch_right) {
                    actionsObj.punch_right = actionsObj[rightCandidate];
                  }

                  try {
                    if (actionsObj.punch_left) { actionsObj.punch_left.setLoop(THREE.LoopOnce, 0); actionsObj.punch_left.clampWhenFinished = true; }
                    if (actionsObj.punch_right) { actionsObj.punch_right.setLoop(THREE.LoopOnce, 0); actionsObj.punch_right.clampWhenFinished = true; }
                  } catch (e) {}
                }
              } catch (e) {
                return e;
              }
              if (!actions.punch_right) {
                try {
                  const altPath = modelConfig.getPath(
                    "characters/farmer/Granjero2_Punching_Right.fbx"
                  );
                  await this.modelLoader.loadAnimations({ punch_right: altPath });
                  const refreshed = this.modelLoader.actions || {};
                  if (refreshed.punch_right) {
                    refreshed.punch_right.setLoop(THREE.LoopOnce, 0);
                    refreshed.punch_right.clampWhenFinished = true;
                  }
                } catch (e) {
                  // ignorar
                }
              }
            } catch (e) {
              return e;
            }
          })
          .catch((e) => {
            return e;
          });
      }
    } catch (e) {
      // no bloquear si algo falla
      return e;
    }

  this.inputEnabled = true;

    this._handBone = null;

    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpMovementVec = new THREE.Vector3();
    this._tmpFinalPos = new THREE.Vector3();

  this._autoExitActive = false;
  this._autoExitTarget = new THREE.Vector3();
  this._autoExitMarket = null;
  this._autoExitSpeed = 3.0; 
  this._autoExitPhase = null; 
  this._autoExitRunPlaying = false;
  this._runAudio = null; 
  this._milkingAudio = null; 

    try {
      this.model.userData = this.model.userData || {};
      this.model.userData.controller = this;

      this.combat = window.createCombatSystem ? window.createCombatSystem() : new CombatSystem();

      this.entityId = this.config.id || "farmer";

      // Registrar entidad en el CombatSystem
      this.healthComponent = integrateEntityWithCombat(
        this.combat,
        this.entityId,
        this.model,
        this.config.maxHealth || 100,
        {
          team: "player",
          disableOnDeath: true,
          hideDelayMs: 1500,
          onDeath: () => {
            try {
              try { safePlaySfx('farmerDeath', { object3D: this.model, volume: 0.95 }); } catch(_) {}
              if (this.modelLoader && typeof this.modelLoader.play === "function") {
                this.modelLoader.play("death", 0.15);
              }
            } catch (e) {}
            try {
              let delay = 1200;
              const deathAction = this.modelLoader?.actions?.death;
              if (deathAction && typeof deathAction.getClip === 'function') {
                const clip = deathAction.getClip();
                if (clip && clip.duration) delay = Math.max(800, clip.duration * 1000);
              }
              setTimeout(() => {
                try { if (window && typeof window.showDeathScreen === 'function') window.showDeathScreen(); }
                catch (e) { /* fallback: reload */ try { window.location.reload(); } catch (e2) {} }
              }, delay);
            } catch (e) {}
          },
          onDamage: (amount, source) => {
            try { safePlaySfx('hit', { object3D: this.model, volume: 0.9 }); } catch(_) {}
          }
        }
      );

      const spawnPlayerHealthbar = () => {
        try {
          if (window.playerHealthBar) return; 
          if (window.createPlayerHealthBar) {
            window.createPlayerHealthBar(this.healthComponent, { position: 'top-left', x: 20, y: 20, width: 320, label: 'KAEL' });
          } else {
            try {
              const hb = new HealthBar({ position: 'top-left', x: 20, y: 20, width: 320, label: 'KAEL' });
              hb.attachTo(this.healthComponent, { position: 'top-left', x: 20, y: 20, label: 'KAEL' });
              window.playerHealthBar = hb;
            } catch (e) {
              return e;
            }
          }
        } catch (e) { return e; }
      };

      try {
        if (window.__gameplayStarted) {
          spawnPlayerHealthbar();
        } else {
          const onStart = () => {
            window.removeEventListener('gameplaystart', onStart);
            spawnPlayerHealthbar();
          };
          window.addEventListener('gameplaystart', onStart, { once: true });
        }
      } catch (_) { spawnPlayerHealthbar(); }

      try { window.farmerController = this; } catch (e) {}

    } catch (e) {
      return e;
    }
  }

  _playPunch(side) {
    if (!this.modelLoader) return;

    const actionName = side === "left" ? "punch_left" : "punch_right";

    const action = this.modelLoader.actions?.[actionName];
    if (!action) {
      try {
        this.modelLoader.play("combat_idle", 0.12);
      } catch (e) {}
      return;
    }

    try {
      if (side === 'right') {
        if (typeof action.setEffectiveTimeScale === 'function') action.setEffectiveTimeScale(0.85);
        else action.timeScale = 0.85;
      } else {
        if (typeof action.setEffectiveTimeScale === 'function') action.setEffectiveTimeScale(0.9);
        else action.timeScale = 0.9;
      }
    } catch (e) {}

    this._isInMeleeSequence = true;

    try {
      action.setLoop(THREE.LoopOnce, 0);
      action.clampWhenFinished = true;
    } catch (e) {}

    try {
      this.modelLoader.play(actionName, 0.08);
    } catch (e) {}
  }

  _onMixerFinished(event) {
    try {
      if (this._isDead) return;
      if (!event || !event.action) return;

      const actions = this.modelLoader.actions || {};
      const isPunchAction =
        event.action === actions.punch_left ||
        event.action === actions.punch_right;

      if (!isPunchAction) return;

      try {
        this.modelLoader.play("combat_idle", 0.08);
        this._combatIdleUntil = Date.now() + 1000;
        
        this._clearCombatExitTimer();
        this._combatExitTimer = setTimeout(() => {
          if (!this._combatIdleUntil || Date.now() < this._combatIdleUntil) return;
          try { if (this.modelLoader) this.modelLoader.play("idle", 0.15); } catch (e) {}
          this._combatExitTimer = null;
          this._combatIdleUntil = 0;
          this._nextAttackSide = null;
          try { this.updateAnimationState(); } catch (e) {}
        }, 1000);
      } catch (e) {}

      if (this.isAttacking) {
        this._nextAttackSide = this._nextAttackSide === "left" ? "right" : "left";
        this._clearNextPunchTimeout();
        this._nextPunchTimeout = setTimeout(() => {
          this._playPunch(this._nextAttackSide);
        }, 120);
      } else {
        this._isInMeleeSequence = false;
        try { this.updateAnimationState(); } catch (e) {}
      }
    } catch (e) {
      return e;
    }
  }

  _clearNextPunchTimeout() {
    if (this._nextPunchTimeout) {
      clearTimeout(this._nextPunchTimeout);
      this._nextPunchTimeout = null;
    }
  }

  _clearCombatExitTimer() {
    if (this._combatExitTimer) {
      clearTimeout(this._combatExitTimer);
      this._combatExitTimer = null;
    }
  }

  setInventory(inventory) {
    this.inventory = inventory;
  }

  setCorral(corral) {
    this.corral = corral;
  }

  setSpaceShuttle(spaceShuttle) {
    this.spaceShuttle = spaceShuttle;
  }

  setStones(stones) {
    if (!stones || stones.length === 0) {
      return;
    }

    this.stones = stones;
    const validStones = stones.filter((stone) => {
      const hasCheckCollision = typeof stone.checkCollision === "function";
      if (!hasCheckCollision) {
        console.warn("⚠️ Piedra sin método checkCollision:", stone);
      }
      return hasCheckCollision;
    });

    if (validStones.length === 0) {
      this.stones = null;
      return;
    }

    this.stones = validStones;
  }
  setHouse(house) {
    if (!house) {
      return;
    }
    this.house = house;
    const hasCheckCollision = typeof house.checkCollision === "function";
    if (!hasCheckCollision) {
      this.house = null;
      return;
    }

  }
  setCows(cows) {
    if (!cows || cows.length === 0) {
      return;
    }

    this.cows = cows;
    const validCows = cows.filter((cow) => {
      const hasCheckCollision = typeof cow.checkCollision === "function";
      return hasCheckCollision;
    });

    if (validCows.length === 0) {
      this.cows = null;
      return;
    }

    this.cows = validCows;
  }


  checkCorralCollision(newPosition) {
    if (!this.corral || !this.model) return false;

    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
    );

    const collision = this.corral.checkCollision(characterBox);
    return collision !== null;
  }

  checkSpaceShuttleCollision(newPosition) {
    if (!this.spaceShuttle || !this.model) return false;

    return this.spaceShuttle.checkCollision(newPosition, this.characterSize);
  }

  checkStonesCollision(position) {
    if (!this.stones || !this.model) return false;

    const stoneCharacterSize = this.stoneCollisionSize;
    
    for (const stone of this.stones) {
      if (stone.checkCollision(position, stoneCharacterSize)) {
        return true;
      }
    }
    return false;
  }

  checkCowsCollision(position) {
    if (!this.cows || !this.model) return false;
    for (const cow of this.cows) {
      if (cow.checkCollision(position, this.characterSize)) {
        if (cow.hasExclamationMarkVisible()) {
          this.handleCowCollisionAnimation(cow);
        }
        return true; 
      }
    }
    return false;
  }

  handleCowCollisionAnimation(cow) {
    if (!this.isCollidingWithCow) {
      this.isCollidingWithCow = true;
      this.cowCollisionState = "kneelingDown";
      this.cowCollisionStartTime = Date.now();
      this.currentCollidedCow = cow; 

      try {
        if (this._runAudio) {
          const ra = this._runAudio;
          if (ra && typeof ra.then === 'function') {
            ra.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
          } else if (ra && typeof ra.stop === 'function') {
            try { ra.stop(); } catch(e) {}
          }
        }
      } catch (e) {}
      this._runAudio = null;
      this.updateAnimationState();
    }
  }
  updateCowCollisionAnimation(currentTime) {
    if (this.isCollidingWithCow) {
      const elapsedTime = currentTime - this.cowCollisionStartTime;

      if (this.cowCollisionState === "kneelingDown") {
        if (elapsedTime >= this.kneelingDownDuration) {
          this.cowCollisionState = "kneeling";
          this.cowCollisionStartTime = Date.now();
            try {
              if (window.audio && typeof window.audio.playSFX === 'function' && this.model) {
                const p = window.audio.playSFX('milking', { loop: true, object3D: this.model, volume: 0.9 });
                this._milkingAudio = p;
                if (p && typeof p.then === 'function') {
                  p.then((inst) => { this._milkingAudio = inst; }).catch(() => { this._milkingAudio = null; });
                }
              } else {
                try { safePlaySfx('milking', { volume: 0.9 }); } catch(_) {}
              }
            } catch (e) { /* ignore milking start errors */ }
          this.updateAnimationState();
        }
      } else if (this.cowCollisionState === "kneeling") {
        if (elapsedTime >= this.kneelingDuration) {

          if (this.currentCollidedCow) {
            this.currentCollidedCow.resetProgressBar();
          }

          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;

          try {
            if (this._milkingAudio) {
              const ma = this._milkingAudio;
              if (ma && typeof ma.then === 'function') {
                ma.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
              } else if (ma && typeof ma.stop === 'function') {
                try { ma.stop(); } catch(e) {}
              }
            }
          } catch (e) {}
          this._milkingAudio = null;
          try {
            const min = 1.2;
            const max = 2.5;
            const milkAmount =
              Math.round((Math.random() * (max - min) + min) * 100) / 100;

            const addAndNotify = (inv) => {
              inv.addMilk(milkAmount);
              let screenPos = null;
              try {
                if (
                  this.camera &&
                  this.model &&
                  typeof window !== "undefined"
                ) {
                  const vector = this.model.position.clone();
                  vector.y += 1.6;
                  vector.project(this.camera);
                  const ndcX = vector.x;
                  const ndcY = vector.y;
                  const rendererEl =
                    typeof window !== "undefined" &&
                    window.renderer &&
                    window.renderer.domElement
                      ? window.renderer.domElement
                      : null;
                  if (rendererEl) {
                    const rect = rendererEl.getBoundingClientRect();
                    screenPos = {
                      x: rect.left + ((ndcX + 1) / 2) * rect.width,
                      y: rect.top + ((1 - ndcY) / 2) * rect.height,
                    };
                  } else {
                    const halfWidth = window.innerWidth / 2;
                    const halfHeight = window.innerHeight / 2;
                    screenPos = {
                      x: ndcX * halfWidth + halfWidth,
                      y: -ndcY * halfHeight + halfHeight,
                    };
                  }
                }
              } catch (e) {;
                screenPos = null;
              }
              if (typeof inv.popup === "function")
                inv.popup(
                  `+${milkAmount.toFixed(2)} L de leche obtenidos`,
                  2800,
                  { screenPos }
                );
              else if (typeof inv.notify === "function")
                inv.notify(`+${milkAmount.toFixed(2)} L de leche obtenidos`);
            };

            if (
              this.inventory &&
              typeof this.inventory.addMilk === "function"
            ) {
              addAndNotify(this.inventory);;
            } else if (
              window &&
              window.inventory &&
              typeof window.inventory.addMilk === "function"
            ) {
              // Fallback a window.inventory
              addAndNotify(window.inventory);
            }
          } catch (err) {
            return e;
          }

          this.currentCollidedCow = null; 
          this.updateAnimationState();
        }
      }
    }
  }

  getStoneAdjustedMovement(currentPosition, movementVector) {
    const newPosition = currentPosition.clone().add(movementVector);

    if (!this.checkStonesCollision(newPosition)) {
      return movementVector;
    }
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (!this.checkStonesCollision(xPosition)) {
      return xMovement; 
    }
    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (!this.checkStonesCollision(zPosition)) {
      return zMovement; 
    }

    const reducedMovement = movementVector.clone().multiplyScalar(0.5);
    const reducedPosition = currentPosition.clone().add(reducedMovement);

    if (!this.checkStonesCollision(reducedPosition)) {
      return reducedMovement; 
    }
    return new THREE.Vector3(0, 0, 0);
  }

  checkHouseCollision(newPosition) {
    if (!this.house || !this.model) return false;
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
    );
    const collision = this.house.checkCollision(characterBox);
    if (collision) {
      return true;
    }
    return false;
  }


  getAdjustedMovement(currentPosition, movementVector) {
    if (this.isCollidingWithCow) {
      return new THREE.Vector3(0, 0, 0);
    }

    if (this.crystals) {
      const newPosition = currentPosition.clone().add(movementVector);
      if (this.checkCrystalsCollision(newPosition)) {
        const slidingMovement = this.getSlidingMovement(
          currentPosition,
          movementVector
        );
        return slidingMovement.length() > 0
          ? slidingMovement
          : new THREE.Vector3(0, 0, 0);
      }
    }

    const newPosition = currentPosition.clone().add(movementVector);

    if (this.market && this.checkMarketCollision(newPosition)) {
      const slidingMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );
      return slidingMovement.length() > 0
        ? slidingMovement
        : new THREE.Vector3(0, 0, 0);
    }
    if (this.corral && this.checkCorralCollision(newPosition)) {
      const adjustedMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );
      if (adjustedMovement.length() === 0) {
        return new THREE.Vector3(0, 0, 0);
      }

      return adjustedMovement;
    }

    if (this.spaceShuttle && this.checkSpaceShuttleCollision(newPosition)) {
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    if (this.stones && this.checkStonesCollision(newPosition)) {
      const stoneAdjustedMovement = this.getStoneAdjustedMovement(
        currentPosition,
        movementVector
      );
      if (stoneAdjustedMovement.length() === 0) {
        return this.getSlidingMovement(currentPosition, movementVector);
      }

      return stoneAdjustedMovement;
    }
    if (this.house && this.checkHouseCollision(newPosition)) {
      return this.getSlidingMovement(currentPosition, movementVector);
    }
    if (this.buildings && this.checkBuildingsCollision(newPosition)) {
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    if (this.cows && this.checkCowsCollision(newPosition)) {
      return new THREE.Vector3(0, 0, 0); 
    }

    return movementVector;
  }

  getSlidingMovement(currentPosition, movementVector) {
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (this.isPositionValid(xPosition)) {
      return xMovement;
    }
    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (this.isPositionValid(zPosition)) {
      return zMovement;
    }

    return new THREE.Vector3(0, 0, 0);
  }

  isPositionValid(position) {
    if (this.corral && this.checkCorralCollision(position)) {
      return false;
    }
    if (this.spaceShuttle && this.checkSpaceShuttleCollision(position)) {
      return false;
    }
    if (this.stones && this.checkStonesCollision(position)) {
      return false;
    }
    if (this.house && this.checkHouseCollision(position)) {
      return false;
    }
    if (this.buildings && this.checkBuildingsCollision(position)) {
      return false;
    }
    if (this.market && this.checkMarketCollision(position)) {
      return false;
    }
    return true;
  }

  checkMarketCollision(position) {
    if (!this.market || !this.market.marketGroup) {
      return false;
    }
    const marketPolygon = [
      new THREE.Vector2(-148.7, 51.5),
      new THREE.Vector2(-154.7, 46.2),
      new THREE.Vector2(-162.7, 55.3),
      new THREE.Vector2(-156.5, 60.4),
      new THREE.Vector2(-148.7, 51.5), 
    ];
    const point = new THREE.Vector2(position.x, position.z);
    let inside = false;
    for (
      let i = 0, j = marketPolygon.length - 1;
      i < marketPolygon.length;
      j = i++
    ) {
      const xi = marketPolygon[i].x,
        yi = marketPolygon[i].y;
      const xj = marketPolygon[j].x,
        yj = marketPolygon[j].y;
      if (yj === yi) continue;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
    if (inside) {
      try {
        if (
          this.market &&
          typeof this.market.doorWidth === "number" &&
          typeof this.market.doorHeight === "number" &&
          this.market.marketGroup
        ) {
          const localPoint = new THREE.Vector3(position.x, position.y, position.z);
          this.market.marketGroup.worldToLocal(localPoint);

          const halfDoor = this.market.doorWidth / 2;
          const depthFront = this.market.size.depth / 2;
          const entryDepth = 1.5;
          const margin = 0.2;

          const withinX = localPoint.x >= -halfDoor - margin && localPoint.x <= halfDoor + margin;
          const withinZ = localPoint.z <= depthFront + 0.5 && localPoint.z >= depthFront - entryDepth;

          if (withinX && withinZ) {
            return false;
          }
        }
      } catch (e) {
        return e;
      }
      return true;
    }

    return false;
  }


  setMarket(market) {
    this.market = market;
  }

  setBuildings(buildings) {
    if (!buildings || buildings.length === 0) {
      this.buildings = null;
      return;
    }
    const wrapped = [];
    for (const b of buildings) {
      if (!b) continue;
      if (typeof b.checkCollision === 'function') {
        wrapped.push(b);
        continue;
      }
      const bbox = b.bbox || (b.object ? new THREE.Box3().setFromObject(b.object) : null);
      wrapped.push({
        id: b.id || null,
        type: b.type || 'building',
        bbox,
        object: b.object || null,
        checkCollision: (pos, size) => {
          try {
            if (!bbox) return false;
            const charSize = size || new THREE.Vector3(1,1,1);
            const characterBox = new THREE.Box3().setFromCenterAndSize(pos.clone(), charSize.clone());
            return bbox.clone().expandByScalar(0.01).intersectsBox(characterBox);
          } catch (e) { return false; }
        }
      });
    }
    this.buildings = wrapped;
    try {
      return
    } catch (e) {}
  }
  setCrystals(crystals) {
    if (!crystals || crystals.length === 0) {
      this.crystals = null;
      return;
    }

    const validCrystals = crystals.filter(crystal => {
      const hasCheckCollision = typeof crystal.checkCollision === 'function';
      if (!hasCheckCollision) {
        console.warn("⚠️ Crystal sin método checkCollision:", crystal);
      }
      return hasCheckCollision;
    });

    if (validCrystals.length === 0) {
      this.crystals = null;
      return;
    }

    this.crystals = validCrystals;
  }
  checkCrystalsCollision(position) {
    if (!this.crystals || !this.model) return false;
    const crystalCollisionSize = this.characterSize.clone().multiplyScalar(0.9);
    for (const crystal of this.crystals) {
      if (crystal.checkCollision(position, crystalCollisionSize)) {
        return true; 
      }
    }
    return false; 
  }

  checkBuildingsCollision(position) {
    if (!this.buildings || !this.model) return false;
    for (const b of this.buildings) {
      try {
        if (typeof b.checkCollision === 'function') {
          const hit = b.checkCollision(position, this.characterSize);
          if (hit) {
            return true;
          }
        }
      } catch (e) { return e; }
    }
    return false;
  }

  isFacingCamera() {
    if (!this.camera || !this.model) return false;
    const characterDirection = new THREE.Vector3(
      Math.sin(this.model.rotation.y),
      0,
      Math.cos(this.model.rotation.y)
    );
    const cameraToCharacter = new THREE.Vector3()
      .subVectors(this.model.position, this.camera.position)
      .normalize();
    cameraToCharacter.y = 0;
    const dotProduct = characterDirection.dot(cameraToCharacter);
    return dotProduct <= 0;
  }

  setupEventListeners() {
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        if (!this.inputEnabled) return;
        if ((key === "s" || key === "arrowdown") && !this.keys[key]) {
          this.originalRotation = this.model.rotation.y;
          this.model.rotation.y += Math.PI;
          this.isRotatedForBackward = true;
        }

        const movementKeys = ["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"];
        if (movementKeys.includes(key)) {
          try { this._clearCombatExitTimer(); } catch (e) {}
          this._isInMeleeSequence = false;
        }

        this.keys[key] = true;
        this.updateAnimationState();
        if (key === "1") {
          if (this.isEquipped) {
            this.attack();
          } else {
            this.equipWeapon();
          }
        }
      } else if (key === "shift") {
        this.keys.shift = true;
        this.updateAnimationState();
      }
    });
    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        if ((key === "s" || key === "arrowdown") && this.isRotatedForBackward) {
          this.model.rotation.y = this.originalRotation;
          this.isRotatedForBackward = false;
        }

        this.keys[key] = false;
        this.updateAnimationState();
      } else if (key === "shift") {
        this.keys.shift = false;
        this.updateAnimationState();
      }
    });
  }

  setInputEnabled(enabled) {
    this.inputEnabled = !!enabled;
    if (!this.inputEnabled) {
      for (const k in this.keys) this.keys[k] = false;
      try { this.updateAnimationState(); } catch (e) {}
    }
  }

  isInputEnabled() { return !!this.inputEnabled; }

  findRightHandBone(object) {
    if (!object) return null;
    if (object.isBone && object.parent) {
      console.log(`Bone found: ${object.name} (parent: ${object.parent.name})`);
    }

    if (object.isBone) {
      const name = object.name.toLowerCase();
      const isLeftHand =
        name.includes("lefthand") ||
        name.includes("left_hand") ||
        name.includes("hand_l") ||
        name.includes("hand.left") ||
        name.includes("mixamorighandl") ||
        name.includes("mixamorig_lefthand") ||
        name === "mixamoriglefthand" ||
        name === "mixamorigLeftHand";

      if (isLeftHand) {
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        debugSphere.name = "leftHandDebug";
        object.add(debugSphere);

        return object;
      }
      const isRightHand =
        name.includes("righthand") ||
        name.includes("right_hand") ||
        name.includes("hand_r") ||
        name.includes("hand.right") ||
        name.includes("mixamorighandr") ||
        name.includes("mixamorig_righthand") ||
        name === "mixamorigrighthand" ||
        name === "mixamorigRightHand";

      if (isRightHand) {
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        debugSphere.name = "rightHandDebug";
        object.add(debugSphere);

        return object;
      }
    }
    if (object.children) {
      for (const child of object.children) {
        const result = this.findRightHandBone(child);
        if (result) return result;
      }
    }

    return null;
  }

  async equipWeapon() {
    try {
      if (this.isEquipped) {
        return;
      }

      this.model.updateMatrixWorld(true);

      this._handBone = this.findRightHandBone(this.model);

      if (!this._handBone) {
        this._weaponPivot = new THREE.Group();
        this.model.add(this._weaponPivot);
      } else {
        this._weaponPivot = new THREE.Group();

        if (this._handBone) {
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);

          this._weaponPivot.matrixAutoUpdate = true;
        }
      }

      while (this._weaponPivot.children.length) {
        this._weaponPivot.remove(this._weaponPivot.children[0]);
      }

      if (window.loadedAxe) {
        this.equippedWeapon = window.loadedAxe.clone();
        this.equippedWeapon.scale.set(0.5, 0.5, 0.5);

        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
            child.frustumCulled = false;
            if (Array.isArray(child.material)) {
              child.material.forEach((mat, i) => {
                mat.visible = true;
                mat.transparent = false;
                mat.opacity = 1;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });
            } else if (child.material) {
              child.material.visible = true;
              child.material.transparent = false;
              child.material.opacity = 1;
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }

            child.castShadow = true;
            child.receiveShadow = true;

            child.updateMatrix();
          }
        });

        this._weaponPivot.add(this.equippedWeapon);

        this._weaponPivot.position.set(0.1, 0.1, 0); 
        this._weaponPivot.rotation.set(0, 0, 0); 
        if (this._handBone) {
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);
        }

        this.equippedWeapon.scale.set(10, 10, 10);

        this.equippedWeapon.position.set(0.1, 0.1, 0);
        this.equippedWeapon.rotation.set(
          -Math.PI / 2,
          0, 
          Math.PI / 4
        );
        this._weaponPivot.position.set(
          0.2, 
          0.2, 
          0.1 
        );

        this.equippedWeapon.updateMatrix();

        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        marker.name = "weaponMarker";
        marker.visible = true; 
        this.equippedWeapon.add(marker);

        this.equippedWeapon.visible = true;
        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
            if (child.material) {
              child.material.visible = true;
              child.material.needsUpdate = true;
            }
          }
        });
        this.equippedWeapon.updateMatrix();

        this.model.updateMatrixWorld(true);
        if (this._handBone) this._handBone.updateMatrixWorld(true);
        this._weaponPivot.updateMatrixWorld(true);
        this.equippedWeapon.updateMatrixWorld(true);
        this.model.traverse((obj) => {
          if (obj.updateMatrix) obj.updateMatrix();
          if (obj.updateMatrixWorld) obj.updateMatrixWorld(true);
        });

        if (this._renderer && this._scene && this._camera) {
          this._renderer.render(this._scene, this._camera);

          if (!this._debugInterval) {
            this._debugInterval = setInterval(() => {
              this.equippedWeapon.updateMatrix();
              this.equippedWeapon.updateMatrixWorld(true);
              this._renderer.render(this._scene, this._camera);
            }, 1000);
          }
        }

        let debugSphere = this._weaponPivot.getObjectByName("weaponDebug");
        if (!debugSphere) {
          debugSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({
              color: 0xff0000,
              wireframe: true,
              transparent: true,
              opacity: 0.8,
            })
          );
          debugSphere.name = "weaponDebug";
          this._weaponPivot.add(debugSphere);
        }

        const axesHelper = new THREE.AxesHelper(0.5);
        axesHelper.name = "weaponAxes";
        this._weaponPivot.add(axesHelper);

        if (this._handBone) {
          const handAxes = new THREE.AxesHelper(0.3);
          handAxes.name = "handAxes";
          this._handBone.add(handAxes);
        }

        this.equippedWeapon.updateMatrixWorld(true);
        this.equippedWeapon.updateMatrixWorld(true);

        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            console.log("Mesh encontrado en el arma:", child);
            console.log("Geometría del mesh:", child.geometry);
            console.log("Material del mesh:", child.material);
          }
        });

        console.log("Posición del arma (local):", this.equippedWeapon.position);
        console.log(
          "Posición del arma (mundo):",
          this.equippedWeapon.getWorldPosition(new THREE.Vector3())
        );

        this.isEquipped = true;
        return;
      }

      const axe = new THREE.Group();

      const handleGeometry = new THREE.BoxGeometry(0.2, 1.0, 0.2);
      const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);

      const headGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.8);
      const headMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
      const head = new THREE.Mesh(headGeometry, headMaterial);

      head.position.y = 0.5;
      head.rotation.z = Math.PI / 4;

      axe.add(handle);
      axe.add(head);

      axe.scale.set(2, 2, 2);

      this.model.add(axe);
      this.equippedWeapon = axe;
      this._handBone = this.findRightHandBone(this.model);

      if (this._handBone) {

        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        this.equippedWeapon.translateX(0.5); 
        this.equippedWeapon.translateY(0.5); 
        this.equippedWeapon.translateZ(0.5); 
        this.equippedWeapon.rotation.x = Math.PI / 2; 
        this.equippedWeapon.rotation.y = Math.PI / 4;

        this.equippedWeapon.updateMatrixWorld(true);
      } else {
        this.equippedWeapon.position.copy(this.model.position);
        this.equippedWeapon.position.y += 2.0;
        this.equippedWeapon.position.z += 1.0; 
        this.equippedWeapon.rotation.set(Math.PI / 2, 0, 0); 
      }

      this.isEquipped = true;

      const logDebugInfo = () => {
        const worldPos = new THREE.Vector3();
        axe.getWorldPosition(worldPos);
      };
      logDebugInfo();

      this.debugInterval = setInterval(logDebugInfo, 2000);

      axe.updateMatrixWorld(true);
    } catch (error) {
      return console.error();
      ;
    }
  }

  attack() {
    const now = Date.now();
    const cooldown = this.attackCooldown || 400; // ms
    if (this._lastAttackTime && now - this._lastAttackTime < cooldown) return null;
    this._lastAttackTime = now;

    try {
      try {
        if (this.modelLoader && typeof this.modelLoader.play === "function") {
          this.modelLoader.play("meleeAttack", 0.08);
        }
      } catch (e) {}

      if (!this.combat) this.combat = window.createCombatSystem ? window.createCombatSystem() : new CombatSystem();
      const damage = this.config.attackDamage || 15;
      const hb = this.combat.applyFrontalAttack(this.entityId || "farmer", {
        damage,
        range: 1.6,
        radius: 0.9,
        duration: 0.18,
        offsetHeight: 1.0,
        friendlyFire: false,
      });

      return hb;
    } catch (err) {
      return err;
    }
  }

  updateAnimationState() {
    if (!this.modelLoader || !this.modelLoader.model) {
      return;
    }
    if (this._isDead) {
      try { this.modelLoader.play("death", 0.0); } catch (e) {}
      return;
    }
    const speedMultiplier = this.getSpeedMultiplier();
    const animationSpeed = 0.2 * speedMultiplier;
    if (this.isRotating) {
      return;
    }

    if (this.isCollidingWithCow) {
      const timeSinceCollision = Date.now() - this.cowCollisionStartTime;
      const canInterrupt = timeSinceCollision > 500;

      if (canInterrupt) {
        const isTryingToMove =
          this.keys.w ||
          this.keys.a ||
          this.keys.s ||
          this.keys.d ||
          this.keys.ArrowUp ||
          this.keys.ArrowDown ||
          this.keys.ArrowLeft ||
          this.keys.ArrowRight;

        if (isTryingToMove) {
          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;
          try {
            if (this._milkingAudio) {
              const ma = this._milkingAudio;
              if (ma && typeof ma.then === 'function') {
                ma.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
              } else if (ma && typeof ma.stop === 'function') {
                try { ma.stop(); } catch(e) {}
              }
            }
          } catch (e) {}
          this._milkingAudio = null;

        } else {
          if (this.cowCollisionState === "kneelingDown") {
            this.modelLoader.play("Kneel_Granjero2", animationSpeed);
          } else if (this.cowCollisionState === "kneeling") {
            this.modelLoader.play("Kneeling", animationSpeed); 
          }
          return;
        }
      } else {
        if (this.cowCollisionState === "kneelingDown") {
          this.modelLoader.play("Kneel_Granjero2", 0.2); 
        } else if (this.cowCollisionState === "kneeling") {
          this.modelLoader.play("Kneeling", 0.2); 
        }
        return;
      }
    }
    const isMoving =
      this.keys.w ||
      this.keys.a ||
      this.keys.s ||
      this.keys.d ||
      this.keys.ArrowUp ||
      this.keys.ArrowDown ||
      this.keys.ArrowLeft ||
      this.keys.ArrowRight;
    const isRunning = this.keys.shift;
    try {
      const shouldPlayRunSfx = !!isMoving;
      if (shouldPlayRunSfx && !this._runAudio) {
        try {
          if (window.audio && typeof window.audio.playSFX === 'function' && this.model) {
            const p = window.audio.playSFX('run', { loop: true, object3D: this.model, volume: 0.6 });
            this._runAudio = p;
            if (p && typeof p.then === 'function') {
              p.then((inst) => { this._runAudio = inst; }).catch(() => { this._runAudio = null; });
            }
          } else {
            try { safePlaySfx('run', { volume: 0.6 }); } catch(_) {}
          }
        } catch (e) { /* ignore run SFX start errors */ }
      } else if (!shouldPlayRunSfx && this._runAudio) {
        try {
          const ra = this._runAudio;
          if (ra && typeof ra.then === 'function') {
            ra.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; this._runAudio = null; }).catch(() => { this._runAudio = null; });
          } else if (ra && typeof ra.stop === 'function') {
            try { ra.stop(); } catch(e) {}
            this._runAudio = null;
          } else {
            this._runAudio = null;
          }
        } catch (e) { this._runAudio = null; }
      }
    } catch (e) {}

    if (this._combatIdleUntil && Date.now() < this._combatIdleUntil) {
      if (isMoving) {
        this._clearCombatExitTimer();
        this._combatIdleUntil = 0;
      } else {
        try { this.modelLoader.play("combat_idle", 0.08); } catch (e) {}
        return;
      }
    }
    if (this._isInMeleeSequence || this.isAttacking) {
      return;
    }
    const usingMelee = false; 

    if (!isMoving) {
      this.modelLoader.play("idle", 0.15);
      return;
    }
    if (
      (this.keys.w || this.keys.ArrowUp) &&
      (this.keys.a || this.keys.ArrowLeft)
    ) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls
        ? "diagonalForwardRight"
        : "diagonalForwardLeft";
      this.modelLoader.play(animation, 0.1);
    }
    else if (
      (this.keys.w || this.keys.ArrowUp) &&
      (this.keys.d || this.keys.ArrowRight)
    ) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls
        ? "diagonalForwardLeft"
        : "diagonalForwardRight";
      this.modelLoader.play(animation, 0.1);
    }
    else if (this.keys.w || this.keys.ArrowUp) {
      const walkSpeed = 0.15;
      const runSpeed = 0.25;

      if (usingMelee) {
        if (isRunning && hasMeleeRun) {
          this.modelLoader.play("meleeRun", runSpeed);
        } else if (hasMeleeIdle) {
          this.modelLoader.play("meleeIdle", walkSpeed);
        } else {
          this.modelLoader.play("run", isRunning ? runSpeed : walkSpeed);
        }
      } else {
        this.modelLoader.play("run", isRunning ? runSpeed : walkSpeed);
      }
    }
    else if (this.keys.s || this.keys.ArrowDown) {
      this.modelLoader.play("run", isRunning ? 0.25 : 0.15);
    }
    else {
      const shouldInvertControls = this.isFacingCamera();

      if (
        (this.keys.a || this.keys.ArrowLeft) &&
        !(this.keys.d || this.keys.ArrowRight)
      ) {
        const animation = shouldInvertControls ? "strafeRight" : "strafeLeft";
        this.modelLoader.play(animation, 0.15);
      } else if (
        (this.keys.d || this.keys.ArrowRight) &&
        !(this.keys.a || this.keys.ArrowLeft)
      ) {
        const animation = shouldInvertControls ? "strafeLeft" : "strafeRight";
        this.modelLoader.play(animation, 0.15);
      }
    }
  }
  start180Rotation() {
    if (this.isRotating) return;
    this.isRotating = true;
    this.targetRotation = this.model.rotation.y + Math.PI;

    this.modelLoader.play("turn180", 0.2);
  }

  exitMarket(market) {
    if (!market || !market.marketGroup) {
      return;
    }

    try {
      const frontLocal = new THREE.Vector3(0, 0, market.size.depth / 2 + 2.0);
      const targetWorld = frontLocal.clone();
      market.marketGroup.localToWorld(targetWorld);

      this._autoExitTarget.copy(targetWorld);
      this._autoExitMarket = market;
      this._autoExitActive = true;
      this._autoExitPhase = 'turn';
      this.start180Rotation();
    } catch (e) {
      return e;
    }
  }

  updateRotation(delta) {
    if (!this.isRotating || this.targetRotation === null) return;
    const rotationStep = this.rotationSpeed * delta;
    const currentRotation = this.model.rotation.y;
    let diff = this.targetRotation - currentRotation;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) <= rotationStep) {
      this.model.rotation.y = this.targetRotation;
      this.isRotating = false;
      this.targetRotation = null;
      const isMoving =
        this.keys.w ||
        this.keys.a ||
        this.keys.s ||
        this.keys.d ||
        this.keys.ArrowUp ||
        this.keys.ArrowDown ||
        this.keys.ArrowLeft ||
        this.keys.ArrowRight;

      if (isMoving) {
        this.updateAnimationState();
      } else {
        this.modelLoader.play("idle", 0.15);
      }
    } else {
      this.model.rotation.y += Math.sign(diff) * rotationStep;
    }
  }
  getSpeedMultiplier() {
    let multiplier = 1.0;
    if (this.keys.shift) {
      multiplier *= this.config.runMultiplier;
    }

    return multiplier;
  }

  update(delta) {
    if (!this.model || !this.modelLoader?.model) {
      return;
    }
    this.updateCowCollisionAnimation(Date.now());
    this.updateRotation(delta);
    if (this._autoExitActive) {
      if (this._autoExitPhase === 'turn') {
        if (!this.isRotating) {
          this._autoExitPhase = 'walk';
          try {
            if (this.modelLoader && typeof this.modelLoader.play === 'function') {
              this.modelLoader.play('run', 0.25);
              this._autoExitRunPlaying = true;
            }
          } catch (e) {
            return e;
          }
        } else {
          // still rotating: skip normal movement
          return;
        }
      }

      if (this._autoExitPhase === 'walk') {
        const pos = this.model.position;
        let detectionCleared = false;
        try {
          const marketRef = this._autoExitMarket || this.market;
          if (marketRef && marketRef.doorPivot && typeof marketRef.doorOpenDistance === 'number') {
            const pivotWorld = new THREE.Vector3();
            marketRef.doorPivot.getWorldPosition(pivotWorld);
            const dx = pos.x - pivotWorld.x;
            const dz = pos.z - pivotWorld.z;
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            const progress = typeof marketRef.doorOpenProgress === 'number' ? marketRef.doorOpenProgress : null;
            if (progress !== null) {
              const margin = 3.0;
              const threshold = marketRef.doorOpenDistance + margin;
              if (distXZ > threshold && progress <= 0.05) {
                detectionCleared = true;
              }
            } else {
              const margin = 4.0;
              const threshold = marketRef.doorOpenDistance + margin;
              if (distXZ > threshold) detectionCleared = true;
            }
          }
        } catch (e) {
          return e;
        }

        if (detectionCleared) {
          this._autoExitActive = false;
          this._autoExitPhase = null;
          this._autoExitMarket = null;
          try {
            if (this._autoExitRunPlaying && this.modelLoader && typeof this.modelLoader.play === 'function') {
              this.modelLoader.play('idle', 0.15);
            }
          } catch (e) {
            return e;
          }
          this._autoExitRunPlaying = false;
        } else {
          const dir = this._autoExitTarget.clone().sub(pos);
          const distance = dir.length();
          if (distance < 0.3) {
            this._autoExitActive = false;
            this._autoExitPhase = null;
            this._autoExitMarket = null;
            try {
              if (this._autoExitRunPlaying && this.modelLoader && typeof this.modelLoader.play === 'function') {
                this.modelLoader.play('idle', 0.15);
              }
            } catch (e) {
              return e;
            }
            this._autoExitRunPlaying = false;
          } else {
            dir.normalize();
            const moveStep = dir.multiplyScalar(this._autoExitSpeed * delta);
            if (moveStep.length() > distance) moveStep.setLength(distance);
            try {
              const desiredY = Math.atan2(dir.x, dir.z);
              this.model.rotation.y = desiredY;
            } catch (e) {
              // ignore rotation errors
            }

            this.model.position.add(moveStep);
          }
        }
        return;
      }
    }
    if (this.isEquipped && this.equippedWeapon) {
      if (!this._handBone) {
        this._handBone = this.findRightHandBone(this.model);
      }

      if (this._handBone) {
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);
        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);
        this.equippedWeapon.translateX(0.1);
        this.equippedWeapon.translateZ(0.1);
        this.equippedWeapon.rotation.x += Math.PI / 4;
        this.equippedWeapon.updateMatrixWorld(true);
      }
    }
    if (this.isRotating) {
      return;
    }
    const baseSpeed = this.config.moveSpeed * 60 * delta;
    const speedMultiplier = this.getSpeedMultiplier();
    const currentMoveSpeed = baseSpeed * speedMultiplier;

    let moveX = 0;
    let moveZ = 0;
    let moved = false;

    if (this.keys.w || this.keys.ArrowUp) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    if (this.keys.s || this.keys.ArrowDown) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    const shouldInvertControls = this.isFacingCamera();

    if (this.keys.a || this.keys.ArrowLeft) {
      const directionMultiplier = shouldInvertControls ? -1 : 1;
      moveX += Math.cos(this.model.rotation.y) * directionMultiplier;
      moveZ -= Math.sin(this.model.rotation.y) * directionMultiplier;
      moved = true;
    }
    if (this.keys.d || this.keys.ArrowRight) {
      const directionMultiplier = shouldInvertControls ? -1 : 1;
      moveX -= Math.cos(this.model.rotation.y) * directionMultiplier;
      moveZ += Math.sin(this.model.rotation.y) * directionMultiplier;
      moved = true;
    }
    if (moved) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (length > 0) {
        moveX = (moveX / length) * currentMoveSpeed;
        moveZ = (moveZ / length) * currentMoveSpeed;
      }
      this._tmpMovementVec.set(moveX, 0, moveZ);
      const adjustedMovement = this.getAdjustedMovement(
        this.model.position,
        this._tmpMovementVec
      );
      let newX = this.model.position.x + adjustedMovement.x;
      let newZ = this.model.position.z + adjustedMovement.z;
      newX = Math.max(
        this.config.bounds.minX,
        Math.min(newX, this.config.bounds.maxX)
      );
      newZ = Math.max(
        this.config.bounds.minZ,
        Math.min(newZ, this.config.bounds.maxZ)
      );
      this._tmpFinalPos.set(newX, this.model.position.y, newZ);
      if (!this.checkCorralCollision(this._tmpFinalPos)) {
        this.model.position.setX(newX);
        this.model.position.setZ(newZ);
      }
      if (this.checkCorralCollision(this._tmpFinalPos)) {
        this.modelLoader.play("idle", 0.15);
      }
    }
    if (!this.isRotating) {
      if (this.keys.q) {
        this.model.rotation.y += this.config.rotationSpeed * 2;
      }
      if (this.keys.e) {
        this.model.rotation.y -= this.config.rotationSpeed * 2;
      }
    }
    if (this.equippedWeapon) {
      try {
        if (!this._handBone) {
          this._handBone = this.findRightHandBone(this.model);
          if (this._handBone) {
            pass
          }
        }

        if (this._handBone) {
          this._handBone.getWorldPosition(this._tmpVec);
          this._handBone.getWorldQuaternion(this._tmpQuat);
          this.equippedWeapon.position.copy(this._tmpVec);
          this.equippedWeapon.quaternion.copy(this._tmpQuat);
          this.equippedWeapon.translateX(0.1); 
          this.equippedWeapon.translateY(-0.1); 
          this.equippedWeapon.translateZ(0.05); 
          this.equippedWeapon.updateMatrixWorld(true);
        } else {
          this.equippedWeapon.position.copy(this.model.position);
          this.equippedWeapon.position.y += 1.0; 
          this.equippedWeapon.rotation.copy(this.model.rotation);
        }
      } catch (e) {
        return e;
      }
    }
  }

  dispose() {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    try {
      if (this._onMouseDown) document.removeEventListener("mousedown", this._onMouseDown);
      if (this._onMouseUp) document.removeEventListener("mouseup", this._onMouseUp);
    } catch (e) {}

    try {
      if (this._mixerFinishedListener && this.modelLoader && this.modelLoader.mixer) {
        this.modelLoader.mixer.removeEventListener("finished", this._mixerFinishedListener);
        this._mixerFinishedListener = null;
      }
    } catch (e) {}

    try { this._clearNextPunchTimeout(); } catch (e) {}
    try { this._clearCombatExitTimer(); } catch (e) {}
    if (this.equippedWeapon && this.equippedWeapon.parent) {
      this.equippedWeapon.parent.remove(this.equippedWeapon);
      this.equippedWeapon = null;
    }

    this._handBone = null;
    this.isEquipped = false;
    try {
      if (this._runAudio) {
        const ra = this._runAudio;
        if (ra && typeof ra.then === 'function') {
          ra.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
        } else if (ra && typeof ra.stop === 'function') {
          try { ra.stop(); } catch(e) {}
        }
      }
    } catch (e) {}
    this._runAudio = null;
    try {
      if (this._milkingAudio) {
        const ma = this._milkingAudio;
        if (ma && typeof ma.then === 'function') {
          ma.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
        } else if (ma && typeof ma.stop === 'function') {
          try { ma.stop(); } catch(e) {}
        }
      }
    } catch (e) {}
    this._milkingAudio = null;
  }
}

export default FarmerController;
