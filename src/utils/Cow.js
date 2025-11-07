import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";
import { ProgressBar } from "./ProgressBar.js";
import { safePlaySfx } from './audioHelpers.js';

export class Cow {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.model = null;
    this.position = position;
    
    // Tag for identification (for alien targeting)
    this.tag = "Cow";
    
    // Health and hit tracking
    this.maxHealth = 40; // 40 hits to die
    this.hitCount = 0; // Current hits taken
    this.isDead = false; // Death state
    this.isInvulnerable = false; // Prevent duplicate hits in same frame
    this._lastHitTime = 0; // Timestamp of last hit for debounce
    this.invulnerabilityFrames = 100; // ms between hits (debounce)

    // Generar una pequeña variación de altura para evitar que las vacas se fusionen
    this.heightOffset = (Math.random() - 0.5) * 0.1; // Variación de -0.05 a +0.05

    // Sin rotación aleatoria inicial - se orientará desde el código principal
    this.rotationOffset = 0; // Sin rotación inicial

    // Propiedades para animación
    this.animationTime = Math.random() * Math.PI * 2; // Tiempo de animación aleatorio para desincronizar
    this.bobAmount = 0.05; // Cantidad de balanceo vertical
    this.bobSpeed = 1.5; // Velocidad de balanceo
    this.breatheAmount = 0.02; // Cantidad de respiración (escala)
    this.breatheSpeed = 2.0; // Velocidad de respiración
    this.headBobAmount = 0.03; // Balanceo de cabeza
    this.headBobSpeed = 1.8; // Velocidad de balanceo de cabeza
    
    // Propiedades para movimiento aleatorio
    this.moveTimer = 0; // Tiempo acumulado para el movimiento
    this.nextMoveTime = Math.random() * 10 + 5; // Próximo movimiento en 5-15 segundos
    this.isMoving = false; // Si está en movimiento actualmente
    this.moveDuration = 0; // Duración del movimiento actual
    this.moveDirection = new THREE.Vector3(); // Dirección del movimiento
    this.moveSpeed = 0.02; // Velocidad de movimiento (centímetros por segundo)
    this.originalPosition = new THREE.Vector3(); // Posición original antes del movimiento
    
    // Barra de progreso 3D
    this.progressBar = null;

  // Audio: schedule rare moos
  this._nextMooAt = 0; // timestamp ms for next allowed moo attempt

    this.init();
  }

  async init() {
    try {

      // Cargar el modelo FBX de la vaca
      const loader = new FBXLoader();
      this.model = await this.loadModel(
        "src/models/characters/animals/Cow.fbx"
      );

      this.setupModel();

      // Agregar a la escena
      this.scene.add(this.model);

      // Crear la barra de progreso 3D
      this.progressBar = new ProgressBar(this, this.scene, 75000); // 75 segundos para cargar

    } catch (error) {
      return error;
    }
  }

  loadModel(path) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(
        path,
        (model) => {
          resolve(model);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  setupModel() {
    if (!this.model) return;
    
    // Add tag to model userData for identification
    this.model.userData.tag = "Cow";
    this.model.userData.cowController = this; // Reference back to this Cow instance

    // Escalar el modelo para que tenga la misma altura que el farmer (2 unidades)
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Calcular el factor de escala para que la vaca tenga altura 2 (como el farmer)
    const targetHeight = 2;
    const scaleFactor = targetHeight / size.y;
    this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);

    box.setFromObject(this.model);
    box.getSize(size);

    // Posicionar el modelo
    this.model.position.set(this.position.x, this.position.y, this.position.z);

    // Obtener el punto más bajo del modelo y posicionarlo sobre el terreno
    const minY = box.min.y;
    // Aplicar la variación de altura para evitar fusión con otras vacas
    this.model.position.y = this.position.y - minY + this.heightOffset;

    // Sin rotación inicial - se orientará desde el código principal
    // this.model.rotation.y = this.rotationOffset; // Comentado para evitar rotación inicial

    // Configurar sombras
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;

        // Optimizar materiales
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat) {
                mat.needsUpdate = true;
              }
            });
          } else {
            child.material.needsUpdate = true;
          }
        }
      }
    });

    // Guardar la posición original para las animaciones
    this.originalY = this.model.position.y;
    this.originalScale = this.model.scale.clone();
    this.originalPosition.copy(this.model.position);
    
    // Buscar el grupo de cabeza para animación específica
    this.headGroup = null;
    this.model.traverse((child) => {
      if (child.isMesh && (child.name.toLowerCase().includes('head') || child.name.toLowerCase().includes('cabeza'))) {
        this.headGroup = child;
      }
    });
    
    // Si no se encuentra la cabeza por nombre, usar el primer mesh que podría ser la cabeza
    if (!this.headGroup) {
      this.model.traverse((child) => {
        if (child.isMesh && child.position.y > this.model.position.y + 0.5) {
          this.headGroup = child;
        }
      });
    }
  }
  
  // Iniciar un movimiento aleatorio
  startRandomMovement() {
    this.isMoving = true;
    this.moveDuration = Math.random() * 3 + 1; // Mover durante 1-4 segundos
    
    // Generar dirección aleatoria en el plano XZ
    const angle = Math.random() * Math.PI * 2;
    this.moveDirection.set(
      Math.cos(angle),
      0,
      Math.sin(angle)
    );
    
    // Guardar la posición actual como punto de inicio del movimiento
    this.moveStartPosition = this.model.position.clone();
  }
  
  // Detener el movimiento y regresar a la posición original
  stopMovement() {
    this.isMoving = false;
    this.moveTimer = 0;
    this.nextMoveTime = Math.random() * 15 + 10; // Próximo movimiento en 10-25 segundos
    
    // Regresar suavemente a la posición original
    this.model.position.copy(this.originalPosition);
  }

  update(delta) {
    if (!this.model) return;
    
    // Actualizar el tiempo de animación
    this.animationTime += delta;
    
    // Lógica de movimiento aleatorio
    this.moveTimer += delta;
    
    if (!this.isMoving) {
      // Esperar el tiempo aleatorio para el próximo movimiento
      if (this.moveTimer >= this.nextMoveTime) {
        this.startRandomMovement();
      }
    } else {
      // Realizar movimiento durante la duración especificada
      if (this.moveTimer >= this.moveDuration) {
        this.stopMovement();
      } else {
        // Mover centímetros en la dirección aleatoria
        const moveDistance = this.moveSpeed * delta;
        this.model.position.add(
          this.moveDirection.clone().multiplyScalar(moveDistance)
        );
      }
    }
    
    // Animación de balanceo vertical (simulando movimiento natural)
    const bobOffset = Math.sin(this.animationTime * this.bobSpeed) * this.bobAmount;
    this.model.position.y = this.originalY + bobOffset;
    
    // Animación de respiración (cambio sutil de escala)
    const breatheScale = 1 + Math.sin(this.animationTime * this.breatheSpeed) * this.breatheAmount;
    this.model.scale.copy(this.originalScale).multiplyScalar(breatheScale);
    
    // Animación de cabeza (si se encontró el grupo de cabeza)
    if (this.headGroup) {
      const headBob = Math.sin(this.animationTime * this.headBobSpeed + Math.PI / 4) * this.headBobAmount;
      this.headGroup.rotation.x = headBob;
      
      // Pequeño movimiento de cabeza de lado a lado
      const headSway = Math.sin(this.animationTime * this.headBobSpeed * 0.7) * this.headBobAmount * 0.5;
      this.headGroup.rotation.z = headSway;
    }
    
    // Actualizar la barra de progreso
    if (this.progressBar) {
      this.progressBar.update();
    }

    // Very occasional cow moo (positional)
    try {
      const now = performance.now();
      if (!this._nextMooAt || now >= this._nextMooAt) {
        // Small chance to moo when idle or moving
        if (Math.random() < 0.12) {
          try { safePlaySfx('cowMoo', { object3D: this.model, volume: 0.9 }); } catch(_) {}
        }
        // schedule next attempt in 20-120s
        this._nextMooAt = now + (20000 + Math.floor(Math.random() * 100000));
      }
    } catch (e) {}
  }

  // Obtener referencia al modelo
  getModel() {
    return this.model;
  }

  // Obtener el bounding box de la vaca para detección de colisiones
  getBoundingBox() {
    if (!this.model) return null;

    const box = new THREE.Box3().setFromObject(this.model);
    return box;
  }

  // Verificar si una posición está en colisión con la vaca
  checkCollision(position, characterSize = new THREE.Vector3(1, -2, 1)) {
    if (!this.model) return false;

    const cowBox = this.getBoundingBox();
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      position,
      characterSize
    );

    return cowBox.intersectsBox(characterBox);
  }
  
  // Método para actualizar la barra de progreso (mantenido por compatibilidad)
  updateProgressBar() {
    if (this.progressBar) {
      this.progressBar.update();
    }
  }
  
  // Verificar si el signo de exclamación está visible
  hasExclamationMarkVisible() {
    return this.progressBar && this.progressBar.exclamationMark && this.progressBar.exclamationMark.visible;
  }
  
  // Reiniciar la barra de progreso
  resetProgressBar() {
    if (this.progressBar) {
      // Eliminar la barra de progreso actual
      this.progressBar.dispose();
      
      // Crear una nueva barra de progreso
      this.progressBar = new ProgressBar(this, this.scene, 75000);
    }
  }
  
  /**
   * Register a hit from an alien
   * @param {string} attackerId - ID of the attacking entity
   * @returns {boolean} - true if cow died from this hit
   */
  onAlienHit(attackerId) {
    // Ignore hits if dead
    if (this.isDead) return false;
    
    // Debounce: prevent multiple hits in quick succession from same collision
    const now = performance.now();
    if (now - this._lastHitTime < this.invulnerabilityFrames) {
      console.log(`[CowHit] Ignored duplicate hit (debounce) - Cow at (${this.model.position.x.toFixed(1)}, ${this.model.position.z.toFixed(1)})`);
      return false;
    }
    
    this._lastHitTime = now;
    this.hitCount++;
    
    // Log the hit
    const cowId = `Cow_${this.model.position.x.toFixed(0)}_${this.model.position.z.toFixed(0)}`;
    console.log(`[CowHit] ${cowId} hit by ${attackerId} - Hits: ${this.hitCount}/${this.maxHealth}`);
    
    // Check if cow should die
    if (this.hitCount >= this.maxHealth) {
      console.log(`[CowDied] ${cowId} killed by ${attackerId} at ${new Date().toISOString()}`);
      this.playDeathAnimationAndDestroy(attackerId);
      return true;
    }
    
    return false;
  }
  
  /**
   * Play Minecraft-style death animation and destroy the cow
   * Uses the same destruction logic as corral walls
   */
  playDeathAnimationAndDestroy(attackerId) {
    if (this.isDead) return;
    this.isDead = true;
    
    // Immediately disable collisions and AI
    if (this.model) {
      this.model.userData.isDead = true;
      this.model.userData.isCollidable = false;
    }
    
    // Play death sound
    try {
      safePlaySfx('cowDeath', { object3D: this.model, volume: 1.0 });
    } catch (e) {
      console.warn('Could not play cow death sound:', e);
    }
    
    // Create Minecraft-style death animation:
    // 1. Rapid rotation and falling
    // 2. Scale reduction
    // 3. Fragmentation effect (particles)
    const deathDuration = 1200; // 1.2 seconds total animation
    const startTime = performance.now();
    const startY = this.model.position.y;
    const startScale = this.model.scale.clone();
    
    // Create particle effect (using smoke effect as base, customized for death)
    let smokeEffect = null;
    try {
      // Import SmokeEffect dynamically
      import('../effects/smokeEffect.js').then(({ SmokeEffect }) => {
        smokeEffect = new SmokeEffect(this.scene, {
          x: this.model.position.x,
          y: this.model.position.y + 0.5,
          z: this.model.position.z
        });
      }).catch(err => console.warn('Could not load SmokeEffect:', err));
    } catch (e) {
      console.warn('Could not create smoke effect:', e);
    }
    
    // Animation loop
    const animateDeath = () => {
      if (!this.model || !this.scene) return;
      
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / deathDuration, 1.0);
      
      if (progress < 1.0) {
        // Rotation (spin wildly like Minecraft)
        this.model.rotation.y += 0.3;
        this.model.rotation.x = Math.sin(elapsed * 0.01) * 0.5;
        this.model.rotation.z = Math.cos(elapsed * 0.01) * 0.5;
        
        // Fall and shrink
        this.model.position.y = startY - (progress * 2); // Fall down
        const scale = 1 - (progress * 0.8); // Shrink to 20% size
        this.model.scale.copy(startScale).multiplyScalar(scale);
        
        // Fade opacity
        this.model.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.transparent = true;
                mat.opacity = 1 - progress;
              });
            } else {
              child.material.transparent = true;
              child.material.opacity = 1 - progress;
            }
          }
        });
        
        requestAnimationFrame(animateDeath);
      } else {
        // Animation complete - remove from scene
        this.destroyEntity();
        
        // Clean up smoke effect after a delay
        if (smokeEffect) {
          setTimeout(() => {
            try {
              smokeEffect.remove();
            } catch (e) {}
          }, 3000);
        }
      }
    };
    
    // Hide progress bar immediately
    if (this.progressBar) {
      try {
        this.progressBar.dispose();
        this.progressBar = null;
      } catch (e) {}
    }
    
    // Start death animation
    animateDeath();
  }
  
  /**
   * Destroy the cow entity (called at end of death animation)
   * Matches the destroyWall logic from Corral
   */
  destroyEntity() {
    if (!this.model || !this.scene) return;

    // Remove from scene
    try {
      if (this.model.parent) {
        this.model.parent.remove(this.model);
      }
    } catch (e) {
      console.error('Error removing cow from scene:', e);
    }

    // Clean up resources
    try {
      // Dispose of geometry and materials
      this.model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                if (material && material.map) material.map.dispose();
                if (material) material.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });
    } catch (e) {
      console.error('Error cleaning up cow resources:', e);
    }

    // Check if all cows are dead
    if (window.checkAllCowsDead) {
      window.checkAllCowsDead();
    }
  }

  /**
   * Check if this cow is alive
   */
  isAlive() {
    return !this.isDead;
  }
}
