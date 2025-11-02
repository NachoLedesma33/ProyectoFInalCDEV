import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";

export class SpaceShuttle {
  constructor(scene, position = { x: 0, y: 0, z: 0 }, scale = 2) {
    this.scene = scene;
    this.model = null;
    this.position = position;
    this.scale = scale;
    
    this.init();
  }

  async init() {
    try {
      const loader = new FBXLoader();
      this.model = await this.loadModel("src/models/characters/starship/Space Shuttle Orbiter.fbx");
      
      this.setupModel();
      this.scene.add(this.model);
      
      window.spaceShuttle = this;
      // start a positional ambient SFX around the shuttle (broken spaceship hum)
      // Play only when gameplay actually starts to avoid loud audio during menu/load.
      this._brokenAudio = null;
      const _startBroken = () => {
        try {
          if (window.audio && typeof window.audio.playSFX === 'function' && this.model) {
            const p = window.audio.playSFX('brokenSpaceship', { object3D: this.model, loop: true, volume: 0.6 });
            this._brokenAudio = p;
            try { if (p && typeof p.then === 'function') p.then(a => { this._brokenAudio = a; }).catch(() => { this._brokenAudio = null; }); } catch(_) {}
          }
        } catch (_) { this._brokenAudio = null; }
      };
      try {
        if (window.__gameplayStarted) {
          _startBroken();
        } else {
          window.addEventListener('gameplaystart', _startBroken, { once: true });
        }
      } catch (_) {
        try { _startBroken(); } catch(_) {}
      }
      
    } catch (error) {
      console.error("Error al cargar el Space Shuttle Orbiter:", error);
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
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  setupModel() {
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    this.model.scale.set(this.scale, this.scale, this.scale);

    box.setFromObject(this.model);
    box.getSize(size);

    this.model.rotation.set(Math.PI / 2, 0, 0);
    
    const minY = box.min.y;
    const shuttleHeight = -5.5;
    this.model.position.set(this.position.x, shuttleHeight - minY, this.position.z);
    
    const lightsToRemove = [];
    this.model.traverse((child) => {
      if (child.isLight) {
        lightsToRemove.push(child);
      }
    });
    
    lightsToRemove.forEach(light => {
      this.model.remove(light);
    });
    
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
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
  }

  update(delta) {
    // La nave es estática, no necesita actualizaciones
  }

  setPosition(x, y, z) {
    if (this.model) {
      this.model.position.set(x, y, z);
    }
  }

  setRotation(x, y, z) {
    if (this.model) {
      this.model.rotation.set(x, y, z);
    }
  }

  setScale(scale) {
    if (this.model) {
      this.model.scale.set(scale, scale, scale);
    }
  }

  getModel() {
    return this.model;
  }

  getBoundingBox() {
    if (!this.model) return null;
    
    const box = new THREE.Box3().setFromObject(this.model);
    return box;
  }

  checkCollision(position, characterSize = new THREE.Vector3(1, -2, -1)) {
    if (!this.model) return false;
    
    const shuttleBox = this.getBoundingBox();
    const characterBox = new THREE.Box3().setFromCenterAndSize(position, characterSize);
    
    return shuttleBox.intersectsBox(characterBox);
  }

  getAdjustedMovement(currentPosition, movementVector, characterSize = new THREE.Vector3(1, -2, -2)) {
    if (!this.model) return movementVector;
    
    const newPosition = currentPosition.clone().add(movementVector);
    
    if (this.checkCollision(newPosition, characterSize)) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    return movementVector;
  }
}