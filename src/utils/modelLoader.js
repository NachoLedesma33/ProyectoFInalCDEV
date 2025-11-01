import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/SkeletonUtils.js";

export class ModelLoader {
  constructor(scene) {
    this.scene = scene;
    this.mixer = null;
    this.model = null;
    this.animations = [];
    this.actions = {};
    this.activeAction = null;
    this.animationLoader = new FBXLoader();
    this.modelLoader = new FBXLoader();
    this.config = null;
  }

  async load(modelPath, animationConfig = {}, onLoad, config = null) {
    try {
      this.config = config;

      const model = await this.loadModel(modelPath);
      this.model = model;

      // Normalize skin weights to ensure sum==1 and avoid deformation artifacts
      // when FBXLoader has to drop influences > 4 (three.js supports max 4).
      // This is a lightweight runtime mitigation; asset fix (re-export with
      // max 4 influences) is still recommended for best deformation.
      try {
        this.normalizeSkinWeightsInModel(this.model);
      } catch (e) {
        // non-critical
        console.warn('ModelLoader: error normalizing skin weights', e);
      }

      this.setupModel();

      this.mixer = new THREE.AnimationMixer(this.model);

      if (Object.keys(animationConfig).length > 0) {
        await this.loadAnimations(animationConfig);
      } else if (model.animations && model.animations.length > 0) {
        this.setupDefaultAnimations(model.animations);
      }

      this.play("idle");

      this.scene.add(this.model);

      if (onLoad) onLoad(this);
      return this;
    } catch (error) {
      console.error("Error loading model:", error);
      throw error;
    }
  }

  // Normalize skin weights helpers
  normalizeSkinWeightsForSkinnedMesh(skinnedMesh) {
    if (!skinnedMesh || !skinnedMesh.geometry) return;
    const geom = skinnedMesh.geometry;
    const sw = geom.attributes && geom.attributes.skinWeight;
    if (!sw) return;
    const arr = sw.array;
    for (let i = 0; i < arr.length; i += 4) {
      const x = arr[i] || 0;
      const y = arr[i + 1] || 0;
      const z = arr[i + 2] || 0;
      const w = arr[i + 3] || 0;
      const sum = x + y + z + w;
      if (sum === 0) continue;
      if (Math.abs(sum - 1) > 1e-6) {
        arr[i] = x / sum;
        arr[i + 1] = y / sum;
        arr[i + 2] = z / sum;
        arr[i + 3] = w / sum;
      }
    }
    sw.needsUpdate = true;
  }

  normalizeSkinWeightsInModel(root) {
    if (!root || !root.traverse) return;
    root.traverse((o) => {
      if (o.isSkinnedMesh) {
        this.normalizeSkinWeightsForSkinnedMesh(o);
      }
    });
  }

  async loadModel(path) {
    return new Promise((resolve, reject) => {
      this.modelLoader.load(
        path,
        (model) => resolve(model),
        undefined,
        (error) => reject(error)
      );
    });
  }

  setConfig(config) {
    this.config = config;
  }

  setupModel() {
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    let targetHeight = 1.8;
    let customScale = 1.0;

    if (this.config && this.config.settings) {
      targetHeight = this.config.settings.height || 1.8;
    }

    if (this.config && this.config.scale) {
      customScale = this.config.scale;
    }

    const scaleFactor = (targetHeight / size.y) * customScale;
    this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);

    box.setFromObject(this.model);
    box.getSize(size);

    const minY = box.min.y;
    this.model.position.y = -minY;

    this.model.rotation.set(0, 0, 0);

    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

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
  }

  async loadAnimations(animationConfig) {
    const animationPromises = [];

    const collectBoneNames = (obj) => {
      const names = new Set();
      obj.traverse((c) => {
        if (c.isBone) names.add((c.name || "").toLowerCase());
        if (c.skeleton && c.skeleton.bones) {
          c.skeleton.bones.forEach((b) =>
            names.add((b.name || "").toLowerCase())
          );
        }
      });
      return names;
    };

    const modelBoneNames = this.model
      ? collectBoneNames(this.model)
      : new Set();

    for (const [name, path] of Object.entries(animationConfig)) {
      if (!path) continue;

      const promise = new Promise((resolve) => {
        this.animationLoader.load(
          path,
          (animModel) => {
            if (animModel.animations && animModel.animations.length > 0) {
              const animBoneNames = collectBoneNames(animModel);

              let common = 0;
              animBoneNames.forEach((n) => {
                if (modelBoneNames.has(n)) common++;
              });

              if (modelBoneNames.size > 0 && common === 0) {
                console.warn(`ModelLoader: skipping animation '${name}' loaded from '${path}' because no common bone names were found between animation and model.`);
                resolve();
                return;
              }

              const clip = animModel.animations[0];

              const newClip = clip.clone();
              newClip.name = name;
              this.animations.push(newClip);

              const action = this.mixer.clipAction(newClip, this.model);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.clampWhenFinished = true;
              this.actions[name] = action;
              console.log(`ModelLoader: registered animation action '${name}' from '${path}'`);
            }
            resolve();
          },
          undefined,
          (error) => {
            console.warn(`ModelLoader: failed to load animation '${name}' from '${path}':`, error);
            resolve();
          }
        );
      });

      animationPromises.push(promise);
    }

    await Promise.all(animationPromises);

    if (
      this.animations.length === 0 &&
      this.model.animations &&
      this.model.animations.length > 0
    ) {
      this.setupDefaultAnimations(this.model.animations);
    }
  }

  setupDefaultAnimations(animations) {
    animations.forEach((clip, index) => {
      let animName = clip.name.toLowerCase();
      let actionName = "idle";

      if (animName.includes("idle")) {
        actionName = "idle";
      } else if (animName.includes("walk") || animName.includes("caminar")) {
        actionName = "walk";
      } else if (animName.includes("run") || animName.includes("correr")) {
        actionName = "run";
      } else if (animName.includes("jump") || animName.includes("saltar")) {
        actionName = "jump";
      } else if (index === 0) {
        actionName = "idle";
      }

      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = true;
      this.actions[actionName] = action;
    });
  }

  play(name, transitionTime = 0.2) {
    if (!this.actions[name]) {
      const fallbackName = name === "run" ? "walk" : "idle";
      if (this.actions[fallbackName] && name !== fallbackName) {
        return this.play(fallbackName, transitionTime);
      }
      return false;
    }

    if (this.activeAction === this.actions[name]) {
      return false;
    }

    const oldAction = this.activeAction;
    const newAction = this.actions[name];

    let actualTransitionTime = transitionTime;
    const isToIdle = name === "idle";
    const isFromIdle = oldAction === this.actions["idle"];

    if (
      (name === "walk" || name === "run") &&
      (oldAction === this.actions["walk"] || oldAction === this.actions["run"])
    ) {
      actualTransitionTime = 0.1;
    } else if (isToIdle) {
      actualTransitionTime = 0.15;
    } else if (isFromIdle) {
      actualTransitionTime = 0.15;
    }

    newAction.reset();
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1);
    newAction.clampWhenFinished = true;
    newAction.enabled = true;

    newAction.play();

    if (oldAction) {
      oldAction.crossFadeTo(newAction, actualTransitionTime, true);

      setTimeout(() => {
        if (oldAction !== this.activeAction) {
          oldAction.stop();
        }
      }, actualTransitionTime * 1000);
    }

    this.activeAction = newAction;
    return true;
  }

  stop() {
    if (this.activeAction) {
      this.activeAction.stop();
      this.activeAction = null;
    }
  }

  setPaused(paused) {
    if (this.mixer) {
      this.mixer.timeScale = paused ? 0 : 1;
    }
  }

  update(delta) {
    if (this.mixer) {
      const cappedDelta = Math.min(delta, 0.033);
      this.mixer.update(cappedDelta);
    }
  }
}