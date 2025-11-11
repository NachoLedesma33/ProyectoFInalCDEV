import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";
import { ProgressBar } from "./ProgressBar.js";
import { safePlaySfx } from './audioHelpers.js';

export class Cow {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.model = null;
    this.position = position;
    this.tag = "Cow";
    this.maxHealth = 40;
    this.hitCount = 0;
    this.isDead = false;
    this.isInvulnerable = false;
    this._lastHitTime = 0;
    this.invulnerabilityFrames = 100; 
    this.heightOffset = (Math.random() - 0.5) * 0.1; 
    this.rotationOffset = 0;
    this.animationTime = Math.random() * Math.PI * 2;
    this.bobAmount = 0.05;
    this.bobSpeed = 1.5;
    this.breatheAmount = 0.02;
    this.breatheSpeed = 2.0;
    this.headBobAmount = 0.03;
    this.moveTimer = 0;
    this.nextMoveTime = Math.random() * 10 + 5;
    this.isMoving = false;
    this.moveDuration = 0;
    this.moveDirection = new THREE.Vector3();
    this.moveSpeed = 0.02;
    this.originalPosition = new THREE.Vector3();
    this.progressBar = null;
    this._nextMooAt = 0;
    this.init();
  }

  async init() {
    try {
      const loader = new FBXLoader();
      this.model = await this.loadModel(
        "src/models/characters/animals/Cow.fbx"
      );

      this.setupModel();
      this.scene.add(this.model);
      this.progressBar = new ProgressBar(this, this.scene, 75000);

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
    this.model.userData.tag = "Cow";
    this.model.userData.cowController = this;
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetHeight = 2;
    const scaleFactor = targetHeight / size.y;
    this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    box.setFromObject(this.model);
    box.getSize(size);
    this.model.position.set(this.position.x, this.position.y, this.position.z);
    const minY = box.min.y;
    this.model.position.y = this.position.y - minY + this.heightOffset;
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
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
    this.originalY = this.model.position.y;
    this.originalScale = this.model.scale.clone();
    this.originalPosition.copy(this.model.position);
    this.headGroup = null;
    this.model.traverse((child) => {
      if (child.isMesh && (child.name.toLowerCase().includes('head') || child.name.toLowerCase().includes('cabeza'))) {
        this.headGroup = child;
      }
    });
    if (!this.headGroup) {
      this.model.traverse((child) => {
        if (child.isMesh && child.position.y > this.model.position.y + 0.5) {
          this.headGroup = child;
        }
      });
    }
  }
  startRandomMovement() {
    this.isMoving = true;
    this.moveDuration = Math.random() * 3 + 1;
    const angle = Math.random() * Math.PI * 2;
    this.moveDirection.set(
      Math.cos(angle),
      0,
      Math.sin(angle)
    );
    this.moveStartPosition = this.model.position.clone();
  }
  stopMovement() {
    this.isMoving = false;
    this.moveTimer = 0;
    this.nextMoveTime = Math.random() * 15 + 10;
    this.model.position.copy(this.originalPosition);
  }

  update(delta) {
    if (!this.model) return;
    this.animationTime += delta;
    this.moveTimer += delta;
    
    if (!this.isMoving) {
      if (this.moveTimer >= this.nextMoveTime) {
        this.startRandomMovement();
      }
    } else {
      if (this.moveTimer >= this.moveDuration) {
        this.stopMovement();
      } else {
        const moveDistance = this.moveSpeed * delta;
        this.model.position.add(
          this.moveDirection.clone().multiplyScalar(moveDistance)
        );
      }
    }
    const bobOffset = Math.sin(this.animationTime * this.bobSpeed) * this.bobAmount;
    this.model.position.y = this.originalY + bobOffset;
    const breatheScale = 1 + Math.sin(this.animationTime * this.breatheSpeed) * this.breatheAmount;
    this.model.scale.copy(this.originalScale).multiplyScalar(breatheScale);
    if (this.headGroup) {
      const headBob = Math.sin(this.animationTime * this.headBobSpeed + Math.PI / 4) * this.headBobAmount;
      this.headGroup.rotation.x = headBob;
      const headSway = Math.sin(this.animationTime * this.headBobSpeed * 0.7) * this.headBobAmount * 0.5;
      this.headGroup.rotation.z = headSway;
    }
    if (this.progressBar) {
      this.progressBar.update();
    }
    try {
      const now = performance.now();
      if (!this._nextMooAt || now >= this._nextMooAt) {
        if (Math.random() < 0.12) {
          try { safePlaySfx('cowMoo', { object3D: this.model, volume: 0.9 }); } catch(_) {}
        }
        this._nextMooAt = now + (20000 + Math.floor(Math.random() * 100000));
      }
    } catch (e) {}
  }
  getModel() {
    return this.model;
  }
  getBoundingBox() {
    if (!this.model) return null;

    const box = new THREE.Box3().setFromObject(this.model);
    return box;
  }
  checkCollision(position, characterSize = new THREE.Vector3(1, -2, 1)) {
    if (!this.model) return false;

    const cowBox = this.getBoundingBox();
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      position,
      characterSize
    );

    return cowBox.intersectsBox(characterBox);
  }
  updateProgressBar() {
    if (this.progressBar) {
      this.progressBar.update();
    }
  }
  hasExclamationMarkVisible() {
    return this.progressBar && this.progressBar.exclamationMark && this.progressBar.exclamationMark.visible;
  }
  resetProgressBar() {
    if (this.progressBar) {
      this.progressBar.dispose();
      this.progressBar = new ProgressBar(this, this.scene, 75000);
    }
  }
  onAlienHit(attackerId) {
    if (this.isDead) return false;
    const now = performance.now();
    if (now - this._lastHitTime < this.invulnerabilityFrames) {
      console.log(`[CowHit] Ignored duplicate hit (debounce) - Cow at (${this.model.position.x.toFixed(1)}, ${this.model.position.z.toFixed(1)})`);
      return false;
    }
    this._lastHitTime = now;
    this.hitCount++;
    const cowId = `Cow_${this.model.position.x.toFixed(0)}_${this.model.position.z.toFixed(0)}`;
    if (this.hitCount >= this.maxHealth) {
      this.playDeathAnimationAndDestroy(attackerId);
      return true;
    }
    return false;
  }
  playDeathAnimationAndDestroy(attackerId) {
    if (this.isDead) return;
    this.isDead = true;
    if (this.model) {
      this.model.userData.isDead = true;
      this.model.userData.isCollidable = false;
    }
    try {
      safePlaySfx('cowDeath', { object3D: this.model, volume: 1.0 });
    } catch (e) {
      console.warn('Could not play cow death sound:', e);
    }
    const deathDuration = 1200; 
    const startTime = performance.now();
    const startY = this.model.position.y;
    const startScale = this.model.scale.clone();
    let smokeEffect = null;
    try {
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
    const animateDeath = () => {
      if (!this.model || !this.scene) return;
      
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / deathDuration, 1.0);
      
      if (progress < 1.0) {
        this.model.rotation.y += 0.3;
        this.model.rotation.x = Math.sin(elapsed * 0.01) * 0.5;
        this.model.rotation.z = Math.cos(elapsed * 0.01) * 0.5;
        
        this.model.position.y = startY - (progress * 2); 
        const scale = 1 - (progress * 0.8); 
        this.model.scale.copy(startScale).multiplyScalar(scale);
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
        this.destroyEntity();
        if (smokeEffect) {
          setTimeout(() => {
            try {
              smokeEffect.remove();
            } catch (e) {}
          }, 3000);
        }
      }
    };
    if (this.progressBar) {
      try {
        this.progressBar.dispose();
        this.progressBar = null;
      } catch (e) {}
    }
    animateDeath();
  }
  destroyEntity() {
    if (!this.model || !this.scene) return;
    try {
      if (this.model.parent) {
        this.model.parent.remove(this.model);
      }
    } catch (e) {
      console.error('Error removing cow from scene:', e);
    }
    try {
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
    if (window.checkAllCowsDead) {
      window.checkAllCowsDead();
    }
  }
  isAlive() {
    return !this.isDead;
  }
}
