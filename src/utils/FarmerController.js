import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import modelConfig from "../config/modelConfig.js";
import CombatSystem, { integrateEntityWithCombat } from "./CombatSystem.js";
import HealthBar from "./Healthbar.js";
import { safePlaySfx } from './audioHelpers.js';

/**
 * Controlador para manejar el movimiento y animaciones del granjero
 */
export class FarmerController {
  /**
   * Crea una instancia de FarmerController
   * @param {Object} config - Configuración del controlador
   * @param {THREE.Object3D} model - Modelo 3D del granjero
   * @param {Object} modelLoader - Instancia del cargador de modelos
   */
  constructor(model, modelLoader, camera, config = {}) {
    this.model = model;
    this.modelLoader = modelLoader;
    this.camera = camera;
    this.config = {
      moveSpeed: 0.3, // Aumentado para mayor velocidad base
      rotationSpeed: 0.1, // Rotación más rápida
      runMultiplier: 5.5, // Mayor multiplicador al correr
      // Límites del terreno (ajustar según el tamaño real del terreno)
      bounds: {
        minX: -250, // -size/2
        maxX: 250, // size/2
        minZ: -250, // -size/2
        maxZ: 250, // size/2
      },
      ...config,
    };
    // Referencia a las vacas para detección de colisiones
    this.cows = null;

    // Referencia al mercado para detección de colisiones
    this.market = null;

    // Referencia al inventario (se puede inyectar desde main.js)
    this.inventory = null;

    // Referencia al arma equipada
    this.equippedWeapon = null;
    this.isEquipped = false;

  // Flag de estado para muerte: evita que otras animaciones sobreescriban 'death'
  this._isDead = false;

    // Estado de las teclas
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
      e: false, // tecla E para rotar a la DERECHA
      q: false, // tecla Q para rotar a la IZQUIERDA
      1: false, // tecla 1 para equipar/descartar arma
    };

    // Estado de rotación
    this.isRotating = false;
    this.targetRotation = null;
    this.rotationSpeed = Math.PI; // 180 grados por segundo

    // Estado de rotación para tecla S (caminar hacia atrás)
    this.isRotatedForBackward = false;
    this.originalRotation = 0;

    // Estado de animación de colisión con vacas
    this.isCollidingWithCow = false;
    this.cowCollisionState = "none"; // none, kneelingDown, kneeling
    this.cowCollisionStartTime = 0;
    this.currentCollidedCow = null; // Vaca con la que se colisionó actualmente
    this.kneelingDownDuration = 2000; // 2 segundos para la animación de transición
    this.kneelingDuration = 15000; // 15 segundos para la animación final agachada

    // Tamaño unificado del bounding box del personaje para todas las colisiones
    this.characterSize = new THREE.Vector3(1, 1, 1);

    // Tamaño específico para colisiones con piedras (más pequeño para permitir acercarse más)
    this.stoneCollisionSize = new THREE.Vector3(0.5, 0.5, 0.5);

    // Inicializar el controlador
    this.setupEventListeners();

    // Mecánica de melee / golpes con click izquierdo
    // Estado relacionado a ataques: si el jugador mantiene click izquierdo
    this.isAttacking = false; // true mientras mantiene pulsado el botón izquierdo
    this._nextAttackSide = null; // 'left' o 'right'
    this._isInMeleeSequence = false; // true mientras estamos en secuencia punch->combat_idle
    this._nextPunchTimeout = null; // id del timeout para encadenar golpes
  this._combatExitTimer = null; // timer de 1.5s para volver a idle
  this._combatIdleUntil = 0; // timestamp until which combat_idle should be held
    this._mixerFinishedListener = null; // referencia al listener del mixer
    
      // Mouse handlers for melee (left click)
      // Store references so we can remove them in dispose
      // Single-click melee: play one punch per click (no hold-to-repeat)
      this._onMouseDown = (event) => {
        if (event.button !== 0) return; // left button
        if (!this.inputEnabled || this._isDead) return;

        // Cancel any pending exit-to-idle timer so we stay in combat state briefly
        this._clearCombatExitTimer();

        // Determine which side to use: alternate each click, start random
        if (!this._nextAttackSide) this._nextAttackSide = Math.random() < 0.5 ? "left" : "right";
        const side = this._nextAttackSide;

        // Apply damage instantly on click, before playing the animation
        try {
          try {
            this.attack();
          } catch (e) {
            return e;
          }

          // Play the punch animation (or fallback) and enter melee sequence
          const actionName = side === "left" ? "punch_left" : "punch_right";
          const action = this.modelLoader?.actions?.[actionName];
          if (action) {
            // entering melee sequence: prevent updateAnimationState from overriding until punch finishes
            this._isInMeleeSequence = true;
            // cancel any combat idle window so punch appears immediately
            this._combatIdleUntil = 0;
            this._clearCombatExitTimer();
            // ensure one-shot
            try { action.setLoop(THREE.LoopOnce, 0); action.clampWhenFinished = true; } catch (e) {}
            // play via modelLoader (handles crossfade)
            this.modelLoader.play(actionName, 0.06);

            // Play punch SFX (positional)
            try { safePlaySfx('punch', { object3D: this.model, volume: 0.9 }); } catch (_) {}

            // No direct scheduling here: the mixer 'finished' handler will play `combat_idle`
            // when the punch action completes. This avoids duplicate timers and ensures
            // the idle starts exactly when the clip finishes.
          } else {
            // fallback: if punch action missing, play combat_idle briefly and enforce 1s combat window
            try {
              this._isInMeleeSequence = true;
              this._clearCombatExitTimer();
              this._combatIdleUntil = Date.now() + 1000;
              this.modelLoader.play("combat_idle", 0.08);
              this._combatExitTimer = setTimeout(() => {
                // only exit if the combat idle window has passed
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

        // Alternate for next click
        this._nextAttackSide = side === "left" ? "right" : "left";
      };

      this._onMouseUp = (event) => {
        if (event.button !== 0) return;
        // For single-click behavior we don't trigger combat_idle on mouseup.
        // Just clear any transient attacking flag.
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
          // Death (opcional)
          death: modelConfig.getPath(
            (modelConfig.characters?.farmer2?.animations?.death) || "characters/farmer/Granjero2_Death.fbx"
          ),
      };

      // Cargar animaciones de forma asíncrona (no bloqueante)
      if (this.modelLoader && typeof this.modelLoader.loadAnimations === "function") {
        this.modelLoader
          .loadAnimations(anims)
          .then(async () => {
            // Configurar acciones para que los punches se reproduzcan una sola vez
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
                // combat_idle normalmente debe loopear
                actions.combat_idle.setLoop(THREE.LoopRepeat, Infinity);
              }
              if (actions.death) {
                try { actions.death.setLoop(THREE.LoopOnce, 0); actions.death.clampWhenFinished = true; } catch (e) {}
              }

              // Añadir listener al mixer para detectar cuando una acción finaliza
              if (this.modelLoader.mixer && !this._mixerFinishedListener) {
                this._mixerFinishedListener = (e) => this._onMixerFinished(e);
                this.modelLoader.mixer.addEventListener(
                  "finished",
                  this._mixerFinishedListener
                );
              }
              // If punch actions are missing, try to auto-map available actions
              try {
                const available = Object.keys(this.modelLoader.actions || {});
                const actionsObj = this.modelLoader.actions || {};
                // helper to find candidate by substrings
                const findBy = (subs) => available.find((k) => subs.some(s => k.toLowerCase().includes(s)));

                if (!actionsObj.punch_left || !actionsObj.punch_right) {
                  // Prefer explicit punch names
                  const leftCandidate = findBy(['punch', 'left', 'punch_left', 'punching']) || findBy(['hit', 'attack', 'melee']);
                  const rightCandidate = findBy(['punch_right','right']) || leftCandidate;

                  if (leftCandidate && !actionsObj.punch_left) {
                    actionsObj.punch_left = actionsObj[leftCandidate];
                  }
                  if (rightCandidate && !actionsObj.punch_right) {
                    actionsObj.punch_right = actionsObj[rightCandidate];
                  }

                  // Ensure they are configured as one-shot
                  try {
                    if (actionsObj.punch_left) { actionsObj.punch_left.setLoop(THREE.LoopOnce, 0); actionsObj.punch_left.clampWhenFinished = true; }
                    if (actionsObj.punch_right) { actionsObj.punch_right.setLoop(THREE.LoopOnce, 0); actionsObj.punch_right.clampWhenFinished = true; }
                  } catch (e) {}
                }
              } catch (e) {
                return e;
              }
              // Si no se cargó punch_right (404 por nombre con typo), intentar una ruta alternativa común
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

  // Input enabled flag: when false, keyboard movement input is ignored
  this.inputEnabled = true;

    // referencia al bone de la mano (si se encuentra) para seguirla
    this._handBone = null;

    // vector y quaternion temporales para cálculos
    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();

  // auto-exit state used when leaving market after HUD closes
  this._autoExitActive = false;
  this._autoExitTarget = new THREE.Vector3();
  this._autoExitMarket = null;
  this._autoExitSpeed = 3.0; // units per second
  this._autoExitPhase = null; // 'turn' | 'walk'
  this._autoExitRunPlaying = false;
  this._runAudio = null; // reference (Promise or Audio instance) for looping run SFX
  this._milkingAudio = null; // reference (Promise or Audio instance) for milking loop SFX

    // Crear HUD de coordenadas
    this.createCoordinateDisplay();

    // Integrar con el sistema de combate y crear HUD de vida del jugador
    try {
      // Exponer controlador en model.userData para callbacks (integración con integrateEntityWithCombat)
      this.model.userData = this.model.userData || {};
      this.model.userData.controller = this;

      // Obtener o crear el sistema de combate global
      this.combat = window.createCombatSystem ? window.createCombatSystem() : new CombatSystem();

      // Identificador de entidad (configurable)
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
            // Mostrar pantalla de muerte tras la animación
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

      // Crear HUD de vida del jugador solo cuando el juego realmente inicia (tras pantalla de controles)
      const spawnPlayerHealthbar = () => {
        try {
          if (window.playerHealthBar) return; // evitar duplicados
          if (window.createPlayerHealthBar) {
            window.createPlayerHealthBar(this.healthComponent, { position: 'bottom-center', y: 28, width: 320 });
          } else {
            // Fallback: crear directamente la HealthBar si el helper no está registrado
            try {
              const hb = new HealthBar({ position: 'bottom-center', y: 28, width: 320 });
              hb.attachTo(this.healthComponent, { position: 'bottom-center', y: 28 });
              window.playerHealthBar = hb;
            } catch (e) {
              return e;
            }
          }
        } catch (e) { return e; }
      };

      // Gate por señal global de inicio de gameplay
      try {
        if (window.__gameplayStarted) {
          spawnPlayerHealthbar();
        } else {
          // una sola vez cuando empiece el gameplay
          const onStart = () => {
            window.removeEventListener('gameplaystart', onStart);
            spawnPlayerHealthbar();
          };
          window.addEventListener('gameplaystart', onStart, { once: true });
        }
      } catch (_) { spawnPlayerHealthbar(); }

      // Exponer referencia global para depuración rápida
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
      // Si no existe la animación específica, reproducir combat_idle temporalmente
      try {
        this.modelLoader.play("combat_idle", 0.12);
      } catch (e) {}
      return;
    }

    // Ajustar un poco la velocidad de los puñetazos (ambos un poco más lentos)
    try {
      if (side === 'right') {
        if (typeof action.setEffectiveTimeScale === 'function') action.setEffectiveTimeScale(0.85);
        else action.timeScale = 0.85;
      } else {
        // Izquierdo un poquito más lento
        if (typeof action.setEffectiveTimeScale === 'function') action.setEffectiveTimeScale(0.9);
        else action.timeScale = 0.9;
      }
    } catch (e) {}

    // Marcar que estamos en secuencia (evita que updateAnimationState la sobreescriba)
    this._isInMeleeSequence = true;

    // Asegurar que el action esté en modo una sola reproducción
    try {
      action.setLoop(THREE.LoopOnce, 0);
      action.clampWhenFinished = true;
    } catch (e) {}

    // Reproducir el golpe con un pequeño crossfade
    try {
      this.modelLoader.play(actionName, 0.08);
    } catch (e) {}
  }

  _onMixerFinished(event) {
    try {
      // Si está muerto, no encadenar más animaciones ni sobrescribir 'death'
      if (this._isDead) return;
      if (!event || !event.action) return;

      const actions = this.modelLoader.actions || {};
      const isPunchAction =
        event.action === actions.punch_left ||
        event.action === actions.punch_right;

      if (!isPunchAction) return;

      // Reproducir combat_idle inmediatamente al terminar el punch
      try {
        this.modelLoader.play("combat_idle", 0.08);
        // mark combat idle window (1 second)
        this._combatIdleUntil = Date.now() + 1000;
        // schedule exit to normal idle after 1s unless cancelled by movement or another punch
        this._clearCombatExitTimer();
        this._combatExitTimer = setTimeout(() => {
          // only exit if the combat idle window has passed
          if (!this._combatIdleUntil || Date.now() < this._combatIdleUntil) return;
          try { if (this.modelLoader) this.modelLoader.play("idle", 0.15); } catch (e) {}
          this._combatExitTimer = null;
          this._combatIdleUntil = 0;
          this._nextAttackSide = null;
          try { this.updateAnimationState(); } catch (e) {}
        }, 1000);
      } catch (e) {}

      // Si el jugador sigue manteniendo el click, programar el siguiente golpe alternado
      if (this.isAttacking) {
        // Alternar el lado
        this._nextAttackSide = this._nextAttackSide === "left" ? "right" : "left";

        // pequeño delay para que el combat_idle tenga tiempo de mezclarse
        this._clearNextPunchTimeout();
        this._nextPunchTimeout = setTimeout(() => {
          this._playPunch(this._nextAttackSide);
        }, 120);
      } else {
        // Si no está atacando, terminar la secuencia (combat_idle window/timer already set above)
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

  /**
   * Crea un HUD rectangular HTML para mostrar coordenadas del farmer
   */
  createCoordinateDisplay() {
    // Crear elemento HTML para el HUD
    this.coordinateHUD = document.createElement("div");
    this.coordinateHUD.id = "farmer-coordinate-hud";

    // Estilo del HUD tipo D2 rectangular
    this.coordinateHUD.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      min-width: 250px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ff00;
      border-radius: 8px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
      text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
    `;

    // Contenido inicial del HUD
    this.coordinateHUD.innerHTML = `
      <div style="margin-bottom: 8px; color: #ffffff; font-size: 12px;">FARMER COORDINATES</div>
      <div id="coord-values">X: 0.0  Y: 0.0  Z: 0.0</div>
    `;

    // Añadir el HUD al documento
    document.body.appendChild(this.coordinateHUD);

    // Guardar referencia al elemento de valores
    this.coordValuesElement = document.getElementById("coord-values");

    // Actualizar coordenadas inicialmente
    this.updateCoordinateDisplay();
  }

  /**
   * Actualiza el texto del HUD de coordenadas
   */
  updateCoordinateDisplay() {
    if (!this.coordValuesElement || !this.model) return;

    const position = this.model.position;
    const text = `X: ${position.x.toFixed(1)}  Y: ${position.y.toFixed(
      1
    )}  Z: ${position.z.toFixed(1)}`;

    // Actualizar el contenido del HUD
    this.coordValuesElement.textContent = text;
  }

  /**
   * Establece la referencia al corral para detección de colisiones
   * @param {Corral} corral - Instancia del corral
   */
  setCorral(corral) {
    this.corral = corral;
  }

  /**
   * Establece la referencia al Space Shuttle para detección de colisiones
   * @param {SpaceShuttle} spaceShuttle - Instancia del Space Shuttle
   */
  setSpaceShuttle(spaceShuttle) {
    this.spaceShuttle = spaceShuttle;
  }

  setStones(stones) {
    if (!stones || stones.length === 0) {
      return;
    }

    this.stones = stones;

    // Verificar que las piedras tengan el método de colisión
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

    // Verificar que la casa tenga el método de colisión
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

    // Verificar que las vacas tengan el método de colisión
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

    // Crear una caja de colisión temporal para el personaje en la nueva posición
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
    );

    // Verificar colisión con el corral
    const collision = this.corral.checkCollision(characterBox);
    return collision !== null;
  }

  checkSpaceShuttleCollision(newPosition) {
    if (!this.spaceShuttle || !this.model) return false;

    // Verificar colisión con el Space Shuttle
    return this.spaceShuttle.checkCollision(newPosition, this.characterSize);
  }

  checkStonesCollision(position) {
    if (!this.stones || !this.model) return false;

    // Usar el tamaño específico para colisiones con piedras (más pequeño)
    const stoneCharacterSize = this.stoneCollisionSize;
    
    // Verificar colisión con cada piedra
    for (const stone of this.stones) {
      if (stone.checkCollision(position, stoneCharacterSize)) {
        return true; // Hay colisión con al menos una piedra
      }
    }
    return false; // No hay colisión con ninguna piedra
  }

  /**
   * Verifica si el personaje colisiona con alguna vaca
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si hay colisión con alguna vaca
   */
  checkCowsCollision(position) {
    if (!this.cows || !this.model) return false;
    
    // Verificar colisión con cada vaca
    for (const cow of this.cows) {
      if (cow.checkCollision(position, this.characterSize)) {
        // Activar animación de colisión con vaca si es necesario
        if (cow.hasExclamationMarkVisible()) {
          this.handleCowCollisionAnimation(cow);
        }
        return true; // Hay colisión con al menos una vaca
      }
    }
    return false; // No hay colisión con ninguna vaca
  }

  handleCowCollisionAnimation(cow) {
    if (!this.isCollidingWithCow) {
      this.isCollidingWithCow = true;
      this.cowCollisionState = "kneelingDown";
      this.cowCollisionStartTime = Date.now();
      this.currentCollidedCow = cow; // Almacenar la vaca con la que se colisionó

      // Stop run audio immediately when starting cow interaction so it doesn't bleed into milking
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

      // Actualizar el estado de animación inmediatamente
      this.updateAnimationState();
    }
  }
  updateCowCollisionAnimation(currentTime) {
    if (this.isCollidingWithCow) {
      const elapsedTime = currentTime - this.cowCollisionStartTime;

      if (this.cowCollisionState === "kneelingDown") {
        // Si ha pasado el tiempo de la animación de transición, cambiar al estado final agachado
        if (elapsedTime >= this.kneelingDownDuration) {
          this.cowCollisionState = "kneeling";
          this.cowCollisionStartTime = Date.now();

            // Start milking loop SFX (positional if available)
            try {
              if (window.audio && typeof window.audio.playSFX === 'function' && this.model) {
                const p = window.audio.playSFX('milking', { loop: true, object3D: this.model, volume: 0.9 });
                this._milkingAudio = p;
                if (p && typeof p.then === 'function') {
                  p.then((inst) => { this._milkingAudio = inst; }).catch(() => { this._milkingAudio = null; });
                }
              } else {
                // fallback to one-shot while we don't have positional audio
                try { safePlaySfx('milking', { volume: 0.9 }); } catch(_) {}
              }
            } catch (e) { /* ignore milking start errors */ }

          // Actualizar el estado de animación para reproducir la animación final
          this.updateAnimationState();
        }
      } else if (this.cowCollisionState === "kneeling") {
        // Si ha pasado el tiempo de la animación final, terminar la secuencia y reiniciar la barra de progreso
        if (elapsedTime >= this.kneelingDuration) {

          // Reiniciar la barra de progreso de la vaca con la que se colisionó
          if (this.currentCollidedCow) {
            this.currentCollidedCow.resetProgressBar();
          }

          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;

          // Stop milking loop SFX now that milking is finished
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
          // Al finalizar el kneeling, otorgar leche al inventario si está conectado
          try {
            // Generar cantidad aleatoria entre 1.2 y 2.5 litros
            const min = 1.2;
            const max = 2.5;
            const milkAmount =
              Math.round((Math.random() * (max - min) + min) * 100) / 100; // 2 decimales

            const addAndNotify = (inv) => {
              inv.addMilk(milkAmount);
              // Calcular posición en pantalla encima del personaje si es posible
              let screenPos = null;
              try {
                if (
                  this.camera &&
                  this.model &&
                  typeof window !== "undefined"
                ) {
                  // proyectar la posición del modelo al espacio de pantalla (NDC)
                  const vector = this.model.position.clone();
                  // ajustar altura para mostrar arriba de la cabeza
                  vector.y += 1.6;
                  vector.project(this.camera);

                  // Normalized device coords (NDC) -> pixel coords relative to renderer canvas
                  const ndcX = vector.x;
                  const ndcY = vector.y;

                  // Preferir calcular respecto al canvas del renderer si está disponible
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
                    // Fallback a viewport completo
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

              // Intentar usar popup si existe, si no usar notify
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

          this.currentCollidedCow = null; // Limpiar la referencia a la vaca

          // Actualizar el estado de animación para volver al estado normal
          this.updateAnimationState();
        }
      }
    }
  }

  getStoneAdjustedMovement(currentPosition, movementVector) {
    // Primero verificar si hay colisión con el movimiento completo
    const newPosition = currentPosition.clone().add(movementVector);

    if (!this.checkStonesCollision(newPosition)) {
      return movementVector; // No hay colisión, permitir movimiento completo
    }

    // Si hay colisión, intentar deslizamiento suave
    // Intentar movimiento solo en X
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (!this.checkStonesCollision(xPosition)) {
      return xMovement; // Permitir movimiento solo en X
    }

    // Intentar movimiento solo en Z
    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (!this.checkStonesCollision(zPosition)) {
      return zMovement; // Permitir movimiento solo en Z
    }

    // Si tampoco funciona, intentar movimiento reducido
    const reducedMovement = movementVector.clone().multiplyScalar(0.5);
    const reducedPosition = currentPosition.clone().add(reducedMovement);

    if (!this.checkStonesCollision(reducedPosition)) {
      return reducedMovement; // Permitir movimiento reducido
    }

    // Si todo falla, detener movimiento completamente
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Verifica si el personaje colisiona con la casa
   * @param {THREE.Vector3} newPosition - Nueva posición a verificar
   * @returns {boolean} - True si hay colisión con la casa
   */
  checkHouseCollision(newPosition) {
    if (!this.house || !this.model) return false;

    // Crear una caja de colisión temporal para el personaje en la nueva posición
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
    );

    // Verificar colisión con la casa
    const collision = this.house.checkCollision(characterBox);
    if (collision) {
      return true;
    }

    return false;
  }


  getAdjustedMovement(currentPosition, movementVector) {
    // Si está en animación de colisión con vaca, detener movimiento completamente
    if (this.isCollidingWithCow) {
      return new THREE.Vector3(0, 0, 0);
    }

    // Probar la nueva posición
    const newPosition = currentPosition.clone().add(movementVector);

    // Verificar colisión con el mercado (antes que otras colisiones)
    if (this.market && this.checkMarketCollision(newPosition)) {
      // Intentar deslizamiento suave contra el mercado
      const slidingMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );
      // Si el deslizamiento resulta en movimiento, usarlo, de lo contrario detenerse
      return slidingMovement.length() > 0
        ? slidingMovement
        : new THREE.Vector3(0, 0, 0);
    }

    // Verificar colisión con el corral
    if (this.corral && this.checkCorralCollision(newPosition)) {
      // Hay colisión con el corral, intentar deslizamiento suave
      const adjustedMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );

      // Si el deslizamiento no funciona, detener el movimiento completamente
      if (adjustedMovement.length() === 0) {
        return new THREE.Vector3(0, 0, 0);
      }

      return adjustedMovement;
    }

    // Verificar colisión con el Space Shuttle
    if (this.spaceShuttle && this.checkSpaceShuttleCollision(newPosition)) {
      // Hay colisión con el Space Shuttle, intentar deslizamiento suave
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    // Verificar colisión con las piedras
    if (this.stones && this.checkStonesCollision(newPosition)) {
      // Hay colisión con las piedras, usar el método específico para piedras
      // que permite acercamiento más cercano y deslizamiento suave
      const stoneAdjustedMovement = this.getStoneAdjustedMovement(
        currentPosition,
        movementVector
      );

      // Si el ajuste específico para piedras no funciona, intentar deslizamiento general
      if (stoneAdjustedMovement.length() === 0) {
        return this.getSlidingMovement(currentPosition, movementVector);
      }

      return stoneAdjustedMovement;
    }

    // Verificar colisión con la casa
    if (this.house && this.checkHouseCollision(newPosition)) {
      // Hay colisión con la casa, intentar deslizamiento suave
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    // Verificar colisión con las vacas
    if (this.cows && this.checkCowsCollision(newPosition)) {
      // Hay colisión con las vacas, detener movimiento completamente
      return new THREE.Vector3(0, 0, 0); // Detener movimiento
    }

    // Si no hay colisiones, permitir el movimiento
    return movementVector;
  }

  getSlidingMovement(currentPosition, movementVector) {
    // Intentar movimiento solo en el eje X
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (this.isPositionValid(xPosition)) {
      return xMovement;
    }

    // Intentar movimiento solo en el eje Z
    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (this.isPositionValid(zPosition)) {
      return zMovement;
    }

    // Si ambos ejes tienen colisión, detener el movimiento
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Verifica si una posición es válida (sin colisiones)
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si la posición es válida
   */
  isPositionValid(position) {
    // Verificar colisión con el corral
    if (this.corral && this.checkCorralCollision(position)) {
      return false;
    }

    // Verificar colisión con el Space Shuttle
    if (this.spaceShuttle && this.checkSpaceShuttleCollision(position)) {
      return false;
    }

    // Verificar colisión con las piedras
    if (this.stones && this.checkStonesCollision(position)) {
      return false;
    }

    // Verificar colisión con la casa
    if (this.house && this.checkHouseCollision(position)) {
      return false;
    }

    // Verificar colisión con el mercado
    if (this.market && this.checkMarketCollision(position)) {
      return false;
    }

    // Si no hay colisiones, la posición es válida
    return true;
  }

  checkMarketCollision(position) {
    if (!this.market || !this.market.marketGroup) {
      return false;
    }

    // Allow passing through the doorway only: when the point is inside the market polygon
    // we still treat it as collision unless it lies within the door opening area.

    // Coordenadas exactas del polígono del mercado (ajustadas manualmente)
    // Basadas en las coordenadas que proporcionaste
    const marketPolygon = [
      new THREE.Vector2(-148.7, 51.5), // Punto 1
      new THREE.Vector2(-154.7, 46.2), // Punto 2
      new THREE.Vector2(-162.7, 55.3), // Punto 3
      new THREE.Vector2(-156.5, 60.4), // Punto 4
      new THREE.Vector2(-148.7, 51.5), // Cierra el polígono
    ];

    // Punto a verificar (posición del personaje)
    const point = new THREE.Vector2(position.x, position.z);

    // Algoritmo de punto en polígono (ray casting)
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

      // Asegurarse de que no haya divisiones por cero
      if (yj === yi) continue;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    // If inside polygon, check if position is within the door opening (in market local coords)
    if (inside) {
      try {
        if (
          this.market &&
          typeof this.market.doorWidth === "number" &&
          typeof this.market.doorHeight === "number" &&
          this.market.marketGroup
        ) {
          // Convert world point to market local space to test against door rect
          const localPoint = new THREE.Vector3(position.x, position.y, position.z);
          this.market.marketGroup.worldToLocal(localPoint);

          const halfDoor = this.market.doorWidth / 2;
          const depthFront = this.market.size.depth / 2;
          const entryDepth = 1.5; // how far inside the doorway is considered "entry"
          const margin = 0.2; // small tolerance

          const withinX = localPoint.x >= -halfDoor - margin && localPoint.x <= halfDoor + margin;
          const withinZ = localPoint.z <= depthFront + 0.5 && localPoint.z >= depthFront - entryDepth;

          if (withinX && withinZ) {
            // point is within door opening -> allow movement (no collision)
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

  isFacingCamera() {
    if (!this.camera || !this.model) return false;

    // Obtener la dirección del personaje (hacia adelante)
    const characterDirection = new THREE.Vector3(
      Math.sin(this.model.rotation.y),
      0,
      Math.cos(this.model.rotation.y)
    );

    // Obtener la dirección de la cámara al personaje
    const cameraToCharacter = new THREE.Vector3()
      .subVectors(this.model.position, this.camera.position)
      .normalize();
    cameraToCharacter.y = 0; // Ignorar la altura

    // Calcular el producto punto para determinar si están mirando en direcciones similares
    const dotProduct = characterDirection.dot(cameraToCharacter);

    // Si el producto punto es positivo, el personaje está de frente a la cámara
    return dotProduct <= 0;
  }

  /**
   * Configura los event listeners para el control del teclado
   */
  setupEventListeners() {
    // Evento cuando se presiona una tecla
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        // If input is disabled, ignore movement/interaction keys
        if (!this.inputEnabled) return;
        // Detectar si se presiona S o flecha abajo por primera vez
        if ((key === "s" || key === "arrowdown") && !this.keys[key]) {
          // Guardar rotación original y rotar 180°
          this.originalRotation = this.model.rotation.y;
          this.model.rotation.y += Math.PI;
          this.isRotatedForBackward = true;
        }

        // Si es una tecla de movimiento, cancelar timers de combat_idle para que el movimiento interrumpa
        const movementKeys = ["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"];
        if (movementKeys.includes(key)) {
          try { this._clearCombatExitTimer(); } catch (e) {}
          this._isInMeleeSequence = false;
        }

        this.keys[key] = true;
        this.updateAnimationState();

        // Manejar tecla '1' para equipar/desequipar arma
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

    // Evento cuando se suelta una tecla
    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        // Always clear keys on keyup to avoid sticky inputs even when input is disabled
        // Detectar si se suelta S o flecha abajo
        if ((key === "s" || key === "arrowdown") && this.isRotatedForBackward) {
          // Restaurar rotación original
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

  /**
   * Enable or disable player input (keyboard).
   * When disabling input we also clear any pressed key flags to avoid sticky movement.
   * @param {boolean} enabled
   */
  setInputEnabled(enabled) {
    this.inputEnabled = !!enabled;
    if (!this.inputEnabled) {
      // clear movement keys to avoid stuck movement
      for (const k in this.keys) this.keys[k] = false;
      // update animation state to reflect idle
      try { this.updateAnimationState(); } catch (e) {}
    }
  }

  isInputEnabled() { return !!this.inputEnabled; }

  findRightHandBone(object) {
    if (!object) return null;

    // Debug: Log the bone hierarchy
    if (object.isBone && object.parent) {
      console.log(`Bone found: ${object.name} (parent: ${object.parent.name})`);
    }

    if (object.isBone) {
      const name = object.name.toLowerCase();

      // Buscar específicamente el hueso de la mano izquierda (left hand)
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

        // Agregar una esfera de depuración en la posición del hueso
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        debugSphere.name = "leftHandDebug";
        object.add(debugSphere);

        return object;
      }

      // Si no se encuentra la mano izquierda, buscar la derecha como respaldo
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
        // Agregar una esfera de depuración en la posición del hueso
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        debugSphere.name = "rightHandDebug";
        object.add(debugSphere);

        return object;
      }
    }

    // Búsqueda recursiva en los hijos
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

      // Asegurarse de que el modelo esté completamente cargado
      this.model.updateMatrixWorld(true);

      // Encontrar el hueso de la mano izquierda
      this._handBone = this.findRightHandBone(this.model);

      if (!this._handBone) {
        // Posición por defecto si no se encuentra el hueso
        this._weaponPivot = new THREE.Group();
        this.model.add(this._weaponPivot);
      } else {
        // Crear un pivote para el arma
        this._weaponPivot = new THREE.Group();

        // Asegurarse de que el pivote esté en la jerarquía correcta
        if (this._handBone) {
          // Si ya tiene un padre, quitarlo primero
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);

          // Asegurar que el pivote herede la rotación del personaje
          this._weaponPivot.matrixAutoUpdate = true;
        }
      }

      // Limpiar cualquier arma anterior
      while (this._weaponPivot.children.length) {
        this._weaponPivot.remove(this._weaponPivot.children[0]);
      }

      // Si ya hay un arma cargada, úsala
      if (window.loadedAxe) {
        // Clonar el modelo del arma para evitar problemas de referencia
        this.equippedWeapon = window.loadedAxe.clone();

        // Ajustar escala del arma para que sea visible
        this.equippedWeapon.scale.set(0.5, 0.5, 0.5);

        // Asegurar que el arma sea visible
        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            // Hacer el mesh visible
            child.visible = true;
            child.frustumCulled = false; // Desactivar frustum culling

            // Configurar materiales para que sean visibles
            if (Array.isArray(child.material)) {
              console.log(`  - Materiales (${child.material.length}):`);
              child.material.forEach((mat, i) => {
                console.log(`    [${i}]`, mat);
                mat.visible = true;
                mat.transparent = false;
                mat.opacity = 1;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });
            } else if (child.material) {
              console.log("  - Material:", child.material);
              child.material.visible = true;
              child.material.transparent = false;
              child.material.opacity = 1;
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }

            // Configurar sombras
            child.castShadow = true;
            child.receiveShadow = true;

            // Forzar actualización de la matriz
            child.updateMatrix();

            // Eliminado el recuadro verde de depuración
          }
        });

        // Añadir el arma al pivote
        this._weaponPivot.add(this.equippedWeapon);

        // Ajustes de posición y rotación relativos al hueso de la mano
        // Posición del arma (ajustar según sea necesario)
        this._weaponPivot.position.set(0.1, 0.1, 0); // Ajuste fino de posición
        this._weaponPivot.rotation.set(0, 0, 0); // Rotación inicial

        // Asegurar que el pivote esté en la jerarquía correcta
        if (this._handBone) {
          // Si ya tiene un padre, quitarlo primero
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);
        }

        // Ajustar la escala del arma (aumentada para mejor visibilidad)
        this.equippedWeapon.scale.set(10, 10, 10);

        // Posición relativa al pivote (ajustar según sea necesario)
        this.equippedWeapon.position.set(0.1, 0.1, 0);

        // Rotación inicial del hacha para que apunte hacia adelante
        this.equippedWeapon.rotation.set(
          -Math.PI / 2, // Apuntar hacia adelante
          0, // Sin rotación en Y
          Math.PI / 4 // Inclinación de 45 grados para mejor agarre
        );

        // Ajustar la posición del pivote para que el arma esté en la mano
        // Valores ajustados para la mano izquierda
        this._weaponPivot.position.set(
          0.2, // Ajuste lateral (positivo para derecha, negativo para izquierda)
          0.2, // Ajuste vertical (arriba/abajo)
          0.1 // Ajuste hacia adelante/atrás
        );

        // Asegurar que el arma esté orientada correctamente
        this.equippedWeapon.updateMatrix();

        // Punto de referencia visual (temporalmente visible para depuración)
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        marker.name = "weaponMarker";
        marker.visible = true; // Temporalmente visible para depuración
        this.equippedWeapon.add(marker);

        // Asegurar que el arma sea visible
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

        // Asegurarse de que el arma esté orientada correctamente
        this.equippedWeapon.updateMatrix();

        // Actualizar las matrices de toda la jerarquía
        this.model.updateMatrixWorld(true);
        if (this._handBone) this._handBone.updateMatrixWorld(true);
        this._weaponPivot.updateMatrixWorld(true);
        this.equippedWeapon.updateMatrixWorld(true);

        // Forzar actualización de todas las matrices
        this.model.traverse((obj) => {
          if (obj.updateMatrix) obj.updateMatrix();
          if (obj.updateMatrixWorld) obj.updateMatrixWorld(true);
        });

        // Forzar renderizado
        if (this._renderer && this._scene && this._camera) {
          this._renderer.render(this._scene, this._camera);

          // Añadir un temporizador para forzar actualizaciones
          if (!this._debugInterval) {
            this._debugInterval = setInterval(() => {
              this.equippedWeapon.updateMatrix();
              this.equippedWeapon.updateMatrixWorld(true);
              this._renderer.render(this._scene, this._camera);
            }, 1000);
          }
        }

        // Depuración: Mostrar un punto en la posición del arma
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

        // Depuración: Mostrar ejes en el pivote del arma
        const axesHelper = new THREE.AxesHelper(0.5);
        axesHelper.name = "weaponAxes";
        this._weaponPivot.add(axesHelper);

        // Depuración: Mostrar ejes en el hueso de la mano
        if (this._handBone) {
          const handAxes = new THREE.AxesHelper(0.3);
          handAxes.name = "handAxes";
          this._handBone.add(handAxes);
        }

        // Forzar actualización de la matriz del mundo
        this.equippedWeapon.updateMatrixWorld(true);

        // Forzar actualización de la escena
        this.equippedWeapon.updateMatrixWorld(true);

        // Verificar si el arma tiene geometría
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

      // Crear un grupo para el hacha
      const axe = new THREE.Group();

      // Crear el mango del hacha (más grueso y largo)
      const handleGeometry = new THREE.BoxGeometry(0.2, 1.0, 0.2);
      const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 }); // Marrón madera
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);

      // Crear la cabeza del hacha (más grande)
      const headGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.8);
      const headMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc }); // Gris metal
      const head = new THREE.Mesh(headGeometry, headMaterial);

      // Posicionar la cabeza en la parte superior del mango
      head.position.y = 0.5;
      head.rotation.z = Math.PI / 4; // Inclinar la cabeza del hacha

      // Añadir las partes al hacha
      axe.add(handle);
      axe.add(head);

      // Hacer el hacha más grande
      axe.scale.set(2, 2, 2);

      // Añadir el hacha a la escena (directamente al modelo por ahora)
      this.model.add(axe);
      this.equippedWeapon = axe;

      // Encontrar el hueso de la mano
      this._handBone = this.findRightHandBone(this.model);

      if (this._handBone) {

        // Obtener la posición y rotación del hueso
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        // Aplicar la posición y rotación al arma
        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        // Ajustes de posición (más pronunciados para mejor visibilidad)
        this.equippedWeapon.translateX(0.5); // Mover más a la derecha
        this.equippedWeapon.translateY(0.5); // Mover más arriba
        this.equippedWeapon.translateZ(0.5); // Mover más al frente

        // Rotación para mejor visibilidad
        this.equippedWeapon.rotation.x = Math.PI / 2; // Apuntar hacia adelante
        this.equippedWeapon.rotation.y = Math.PI / 4; // Girar 45 grados

        // Actualizar la matriz del mundo del arma
        this.equippedWeapon.updateMatrixWorld(true);
      } else {
        // Posición por defecto si no se encuentra el hueso
        this.equippedWeapon.position.copy(this.model.position);
        this.equippedWeapon.position.y += 2.0; // Ajustar altura (más alto)
        this.equippedWeapon.position.z += 1.0; // Mover hacia adelante
        this.equippedWeapon.rotation.set(Math.PI / 2, 0, 0); // Rotar para mejor visibilidad
      }

      this.isEquipped = true;

      // Función para mostrar información de depuración
      const logDebugInfo = () => {
        const worldPos = new THREE.Vector3();
        axe.getWorldPosition(worldPos);
      };

      // Mostrar información de depuración
      logDebugInfo();

      // Mostrar información periódicamente (útil para depuración)
      this.debugInterval = setInterval(logDebugInfo, 2000);

      // Forzar actualización
      axe.updateMatrixWorld(true);
    } catch (error) {
      return console.error();
      ;
    }
  }

  attack() {
    // cooldown simple
    const now = Date.now();
    const cooldown = this.attackCooldown || 400; // ms
    if (this._lastAttackTime && now - this._lastAttackTime < cooldown) return null;
    this._lastAttackTime = now;

    try {
      // reproducir animación de ataque si existe
      try {
        if (this.modelLoader && typeof this.modelLoader.play === "function") {
          this.modelLoader.play("meleeAttack", 0.08);
        }
      } catch (e) {}

      // aplicar hitbox frontal mediante el CombatSystem
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

  /**
   * Actualiza el estado de las animaciones según la entrada del usuario
   */
  updateAnimationState() {
    if (!this.modelLoader || !this.modelLoader.model) {
      return;
    }

    // Si el personaje está muerto, mantener la animación de muerte
    if (this._isDead) {
      try { this.modelLoader.play("death", 0.0); } catch (e) {}
      return;
    }

    // Obtener el multiplicador de velocidad para las animaciones
    const speedMultiplier = this.getSpeedMultiplier();
    const animationSpeed = 0.2 * speedMultiplier; // Ajustar velocidad de animación basada en el speed boost

    // Si está rotando, no cambiar la animación
    if (this.isRotating) {
      return;
    }

    // Si está colisionando con una vaca, reproducir la animación correspondiente según el estado
    // pero permitir interrupción si el jugador intenta moverse después de un breve momento
    if (this.isCollidingWithCow) {
      // Solo permitir interrupción después de 0.5 segundos de la colisión para evitar interrupciones inmediatas
      const timeSinceCollision = Date.now() - this.cowCollisionStartTime;
      const canInterrupt = timeSinceCollision > 500; // 0.5 segundos

      if (canInterrupt) {
        // Verificar si el jugador intenta moverse (interrupción)
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
          // El jugador quiere interrumpir la animación
          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;

          // Stop milking audio if player interrupts milking
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

          // No hacer return aquí, dejar que continúe con la lógica normal de movimiento
        } else {
          // Reproducir la animación correspondiente según el estado
          if (this.cowCollisionState === "kneelingDown") {
            this.modelLoader.play("Kneel_Granjero2", animationSpeed); // Kneeling Down
          } else if (this.cowCollisionState === "kneeling") {
            this.modelLoader.play("Kneeling", animationSpeed); // Kneeling (estado final)
          }
          return;
        }
      } else {
        // Durante los primeros 0.5 segundos, siempre reproducir la animación sin permitir interrupción
        if (this.cowCollisionState === "kneelingDown") {
          this.modelLoader.play("Kneel_Granjero2", 0.2); // Kneeling Down
        } else if (this.cowCollisionState === "kneeling") {
          this.modelLoader.play("Kneeling", 0.2); // Kneeling (estado final)
        }
        return;
      }
    }

    // Determinar el estado actual del movimiento
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

    // Manage looping run SFX: start when moving, stop when not
    try {
      const shouldPlayRunSfx = !!isMoving;
      if (shouldPlayRunSfx && !this._runAudio) {
        // start positional looping run sound tied to the model
        try {
          if (window.audio && typeof window.audio.playSFX === 'function' && this.model) {
            const p = window.audio.playSFX('run', { loop: true, object3D: this.model, volume: 0.6 });
            // store promise/instance; resolve to instance when ready
            this._runAudio = p;
            if (p && typeof p.then === 'function') {
              p.then((inst) => { this._runAudio = inst; }).catch(() => { this._runAudio = null; });
            }
          } else {
            // fallback: play one-shot footsteps (non-positional)
            try { safePlaySfx('run', { volume: 0.6 }); } catch(_) {}
          }
        } catch (e) { /* ignore run SFX start errors */ }
      } else if (!shouldPlayRunSfx && this._runAudio) {
        // stop run audio whether it's a promise or an instance
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

    // Si estamos en la ventana de combat_idle (después de golpear), mantener esa animación
    // a menos que el jugador intente moverse, lo que la cancela inmediatamente.
    if (this._combatIdleUntil && Date.now() < this._combatIdleUntil) {
      if (isMoving) {
        // Movimiento interrumpe el combat_idle
        this._clearCombatExitTimer();
        this._combatIdleUntil = 0;
        // dejar que la lógica normal de movimiento continúe
      } else {
        // Mantener combat_idle
        try { this.modelLoader.play("combat_idle", 0.08); } catch (e) {}
        return;
      }
    }

    // Si estamos ejecutando la secuencia de melee (punch -> combat_idle -> punch)
    // o el jugador está manteniendo el clic izquierdo, no sobreescribir esas animaciones
    if (this._isInMeleeSequence || this.isAttacking) {
      return;
    }
    // Deshabilitar temporalmente el sistema de melee
    const usingMelee = false; // Siempre falso para deshabilitar las animaciones de melee

    if (!isMoving) {
      // Siempre usar animación de reposo normal
      this.modelLoader.play("idle", 0.15);
      return;
    }

    // Determinar la animación basada en la dirección del movimiento

    // Movimiento diagonal adelante-izquierda (W + A)
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
    // Movimiento diagonal adelante-derecha (W + D)
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
    // Movimiento hacia adelante
    else if (this.keys.w || this.keys.ArrowUp) {
     
      // Definir velocidades de animación
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
    // Movimiento hacia atrás - Como el personaje está rotado 180°, usa animación normal
    else if (this.keys.s || this.keys.ArrowDown) {
      // El personaje está rotado 180°, así que usa la animación de correr normal
      this.modelLoader.play("run", isRunning ? 0.25 : 0.15);
    }
    // Movimiento lateral - invertir animaciones según orientación a la cámara
    else {
      const shouldInvertControls = this.isFacingCamera();

      if (
        (this.keys.a || this.keys.ArrowLeft) &&
        !(this.keys.d || this.keys.ArrowRight)
      ) {
        // Si está de frente a la cámara, A/D se invierten, así que A muestra animación de derecha
        const animation = shouldInvertControls ? "strafeRight" : "strafeLeft";
        this.modelLoader.play(animation, 0.15);
      } else if (
        (this.keys.d || this.keys.ArrowRight) &&
        !(this.keys.a || this.keys.ArrowLeft)
      ) {
        // Si está de frente a la cámara, A/D se invierten, así que D muestra animación de izquierda
        const animation = shouldInvertControls ? "strafeLeft" : "strafeRight";
        this.modelLoader.play(animation, 0.15);
      }
    }
  }

  /**
   * Inicia la rotación de 180 grados
   */
  start180Rotation() {
    if (this.isRotating) return;

    this.isRotating = true;
    // Calcular el objetivo de rotación (180 grados desde la rotación actual)
    this.targetRotation = this.model.rotation.y + Math.PI;

    // Reproducir animación de giro
    this.modelLoader.play("turn180", 0.2);
  }

  /**
   * Inicia la secuencia automática para salir de un mercado: gira 180° y camina hacia
   * un punto fuera del mercado. El parámetro `market` puede ser la instancia Market.
   * @param {Object} market
   */
  exitMarket(market) {
    if (!market || !market.marketGroup) {
      return;
    }

    // Compute a world target point a few units outside the front of the market
    try {
      const frontLocal = new THREE.Vector3(0, 0, market.size.depth / 2 + 2.0);
      const targetWorld = frontLocal.clone();
      market.marketGroup.localToWorld(targetWorld);

      this._autoExitTarget.copy(targetWorld);
      // keep a reference to the market so we can query door pivot/detection while exiting
      this._autoExitMarket = market;
      this._autoExitActive = true;
      this._autoExitPhase = 'turn';

      // Start the 180 rotation; update() will detect when rotation completes
      this.start180Rotation();
    } catch (e) {
      return e;
    }
  }

  updateRotation(delta) {
    if (!this.isRotating || this.targetRotation === null) return;

    const rotationStep = this.rotationSpeed * delta;
    const currentRotation = this.model.rotation.y;

    // Calcular la diferencia más corta al objetivo
    let diff = this.targetRotation - currentRotation;

    // Normalizar la diferencia al rango [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) <= rotationStep) {
      // Llegamos al objetivo
      this.model.rotation.y = this.targetRotation;
      this.isRotating = false;
      this.targetRotation = null;

      // Después de rotar, verificar si todavía se presiona alguna tecla de movimiento
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
        // Actualizar el estado de animación según la tecla presionada
        this.updateAnimationState();
      } else {
        // Si no se presiona ninguna tecla de movimiento, volver a animación idle
        this.modelLoader.play("idle", 0.15);
      }
    } else {
      // Continuar rotando
      this.model.rotation.y += Math.sign(diff) * rotationStep;
    }
  }

  /**
   * Obtiene el multiplicador de velocidad actual
   * @returns {number} - Multiplicador de velocities
   */
  getSpeedMultiplier() {
    let multiplier = 1.0;

    // Aplicar multiplicador de correr
    if (this.keys.shift) {
      multiplier *= this.config.runMultiplier;
    }

    return multiplier;
  }

  update(delta) {
    if (!this.model || !this.modelLoader?.model) {
      return;
    }

    // Actualizar estado de animación de colisión con vacas
    this.updateCowCollisionAnimation(Date.now());

    // Actualizar rotación primero
    this.updateRotation(delta);

    // If an auto-exit sequence is active, handle it here (turn then walk out)
    if (this._autoExitActive) {
      // If we're in 'turn' phase, wait for rotation to finish
      if (this._autoExitPhase === 'turn') {
        if (!this.isRotating) {
          // rotation finished, switch to walking
          this._autoExitPhase = 'walk';
          // start run animation when entering walk phase
          try {
            if (this.modelLoader && typeof this.modelLoader.play === 'function') {
              // pick a reasonable animation speed (tweakable)
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
        // Move outward until the farmer is outside the market door detection area
        // (so the door can fully close). Prefer using the market's doorPivot world
        // position and market.doorOpenDistance. If those aren't available, fall back
        // to the original target-distance check.
        const pos = this.model.position;

        let detectionCleared = false;
        try {
          const marketRef = this._autoExitMarket || this.market;
          if (marketRef && marketRef.doorPivot && typeof marketRef.doorOpenDistance === 'number') {
            const pivotWorld = new THREE.Vector3();
            marketRef.doorPivot.getWorldPosition(pivotWorld);
            // distance in XZ plane between farmer and pivot
            const dx = pos.x - pivotWorld.x;
            const dz = pos.z - pivotWorld.z;
            const distXZ = Math.sqrt(dx * dx + dz * dz);

            // Prefer to wait until the door animation has progressed back toward closed
            const progress = typeof marketRef.doorOpenProgress === 'number' ? marketRef.doorOpenProgress : null;

            if (progress !== null) {
              // Require the farmer to be beyond a larger margin AND the door progress to be nearly closed
              const margin = 3.0; // bumped margin so farmer goes a bit further out
              const threshold = marketRef.doorOpenDistance + margin;
              if (distXZ > threshold && progress <= 0.05) {
                detectionCleared = true;
              }
            } else {
              // fallback: door progress not available, use a slightly larger margin
              const margin = 4.0;
              const threshold = marketRef.doorOpenDistance + margin;
              if (distXZ > threshold) detectionCleared = true;
            }
          }
        } catch (e) {
          return e;
        }

        if (detectionCleared) {
          // Stop auto-exit when detection cleared
          this._autoExitActive = false;
          this._autoExitPhase = null;
          this._autoExitMarket = null;
          // stop run animation
          try {
            if (this._autoExitRunPlaying && this.modelLoader && typeof this.modelLoader.play === 'function') {
              this.modelLoader.play('idle', 0.15);
            }
          } catch (e) {
            return e;
          }
          this._autoExitRunPlaying = false;
        } else {
          // Continue moving toward the target (ignore collisions during auto-exit)
          const dir = this._autoExitTarget.clone().sub(pos);
          const distance = dir.length();
          if (distance < 0.3) {
            // fallback: if we reached the computed target, stop
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
            // Avoid overshoot
            if (moveStep.length() > distance) moveStep.setLength(distance);

            // Rotate model to face movement direction for a natural run
            try {
              const desiredY = Math.atan2(dir.x, dir.z);
              this.model.rotation.y = desiredY;
            } catch (e) {
              // ignore rotation errors
            }

            this.model.position.add(moveStep);
          }
        }

        // Skip the rest of the normal update while auto-exiting
        return;
      }
    }

    // Actualizar posición del arma si está equipada
    if (this.isEquipped && this.equippedWeapon) {
      if (!this._handBone) {
        // Intentar encontrar el hueso de la mano si no se ha encontrado
        this._handBone = this.findRightHandBone(this.model);
      }

      if (this._handBone) {
        // Obtener la posición y rotación del hueso
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        // Aplicar la posición y rotación al arma
        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        // Ajustes de posición (los mismos que en equipWeapon)
        this.equippedWeapon.translateX(0.1);
        this.equippedWeapon.translateZ(0.1);
        this.equippedWeapon.rotation.x += Math.PI / 4;

        // Actualizar la matriz del mundo del arma
        this.equippedWeapon.updateMatrixWorld(true);
      }
    }

    // Si está rotando, no permitir movimiento
    if (this.isRotating) {
      return;
    }

    // Calcular la velocidad base
    const baseSpeed = this.config.moveSpeed * 60 * delta;
    // Aplicar todos los multiplicadores (correr y speed boost)
    const speedMultiplier = this.getSpeedMultiplier();
    const currentMoveSpeed = baseSpeed * speedMultiplier;

    let moveX = 0;
    let moveZ = 0;
    let moved = false;

    // Movimiento hacia adelante (W y flecha arriba)
    if (this.keys.w || this.keys.ArrowUp) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    // Movimiento hacia atrás (S y flecha abajo)
    // Como el personaje ya está rotado 180°, solo necesita moverse hacia adelante
    if (this.keys.s || this.keys.ArrowDown) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    // Movimiento lateral (A/D y flechas laterales)
    // Invertir controles si el personaje está de frente a la cámara
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

    // Normalizar el vector de movimiento para movimiento diagonal
    if (moved) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (length > 0) {
        moveX = (moveX / length) * currentMoveSpeed;
        moveZ = (moveZ / length) * currentMoveSpeed;
      }

      // Crear vector de movimiento
      const movementVector = new THREE.Vector3(moveX, 0, moveZ);

      // Ajustar movimiento según colisiones con el corral
      const adjustedMovement = this.getAdjustedMovement(
        this.model.position,
        movementVector
      );

      // Calcular nueva posición con límites y colisiones
      let newX = this.model.position.x + adjustedMovement.x;
      let newZ = this.model.position.z + adjustedMovement.z;

      // Aplicar límites del terreno
      newX = Math.max(
        this.config.bounds.minX,
        Math.min(newX, this.config.bounds.maxX)
      );
      newZ = Math.max(
        this.config.bounds.minZ,
        Math.min(newZ, this.config.bounds.maxZ)
      );

      // Verificación final de colisiones antes de aplicar el movimiento
      const finalPosition = new THREE.Vector3(
        newX,
        this.model.position.y,
        newZ
      );
      if (!this.checkCorralCollision(finalPosition)) {
        // Aplicar la nueva posición solo si no hay colisión
        this.model.position.setX(newX);
        this.model.position.setZ(newZ);
      }

      // Si hay colisión, detener el movimiento y mostrar advertencia
      if (this.checkCorralCollision(finalPosition)) {
        // Detener animación de movimiento
        this.modelLoader.play("idle", 0.15);
      }
    }

    // Rotación manual del personaje:
    // - Q: Rota a la izquierda
    // - E: Rota a la derecha
    // (solo si no está rotando automáticamente)
    if (!this.isRotating) {
      if (this.keys.q) {
        this.model.rotation.y += this.config.rotationSpeed * 2;
      }
      if (this.keys.e) {
        this.model.rotation.y -= this.config.rotationSpeed * 2;
      }
    }

    // Actualizar el cartel de coordenadas
    this.updateCoordinateDisplay();

    // Si hay arma equipada, actualizar su posición para seguir la mano
    if (this.equippedWeapon) {
      try {
        // Si no se encontró el hueso de la mano, intentar encontrarlo de nuevo
        if (!this._handBone) {
          this._handBone = this.findRightHandBone(this.model);
          if (this._handBone) {
            pass
          }
        }

        if (this._handBone) {
          // Obtener la posición y rotación mundial del hueso
          this._handBone.getWorldPosition(this._tmpVec);
          this._handBone.getWorldQuaternion(this._tmpQuat);

          // Aplicar la posición y rotación al arma
          this.equippedWeapon.position.copy(this._tmpVec);
          this.equippedWeapon.quaternion.copy(this._tmpQuat);

          // Ajustes de posición (ajustar según sea necesario)
          this.equippedWeapon.translateX(0.1); // Ajustar posición X
          this.equippedWeapon.translateY(-0.1); // Ajustar posición Y
          this.equippedWeapon.translateZ(0.05); // Ajustar posición Z

          // Actualizar la matriz del mundo del arma
          this.equippedWeapon.updateMatrixWorld(true);
        } else {
          // Si no se encuentra el hueso, posicionar el arma en una posición relativa al modelo
          this.equippedWeapon.position.copy(this.model.position);
          this.equippedWeapon.position.y += 1.0; // Ajustar altura
          this.equippedWeapon.rotation.copy(this.model.rotation);
        }
      } catch (e) {
        return e;
      }
    }
  }

  dispose() {
    // Limpiar event listeners
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    // Limpiar mouse handlers si existen
    try {
      if (this._onMouseDown) document.removeEventListener("mousedown", this._onMouseDown);
      if (this._onMouseUp) document.removeEventListener("mouseup", this._onMouseUp);
    } catch (e) {}

    // Remover listener del mixer
    try {
      if (this._mixerFinishedListener && this.modelLoader && this.modelLoader.mixer) {
        this.modelLoader.mixer.removeEventListener("finished", this._mixerFinishedListener);
        this._mixerFinishedListener = null;
      }
    } catch (e) {}

    // Limpiar timers pendientes
    try { this._clearNextPunchTimeout(); } catch (e) {}
    try { this._clearCombatExitTimer(); } catch (e) {}

    // Limpiar el HUD de coordenadas
    if (this.coordinateHUD && this.coordinateHUD.parentNode) {
      this.coordinateHUD.parentNode.removeChild(this.coordinateHUD);
    }

    // Limpiar el arma equipada si existe
    if (this.equippedWeapon && this.equippedWeapon.parent) {
      this.equippedWeapon.parent.remove(this.equippedWeapon);
      this.equippedWeapon = null;
    }

    // Limpiar referencias
    this._handBone = null;
    this.isEquipped = false;
    // Ensure any looping audios are stopped
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
