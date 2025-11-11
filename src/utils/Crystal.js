import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";

export class Crystal {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.model = null;
    this.position = position;
    this.init();
  }

  async init() {
    try {
      this.model = await this.loadModel("src/models/characters/terrain/crystal_4.fbx");
      this.setupModel();
      this.scene.add(this.model);
    } catch (e) {
      return e;
    }
  }

  loadModel(path) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(path, (model) => resolve(model), undefined, (err) => reject(err));
    });
  }

  setupModel() {
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const targetHeight = 4.5; 
    const scaleFactor = size.y > 0 ? targetHeight / size.y : 1.0;
    this.model.scale.setScalar(scaleFactor);

    box.setFromObject(this.model);
    box.getSize(size);

    this.model.position.set(this.position.x, this.position.y, this.position.z);
    const minY = box.min.y;
    this.model.position.y = this.position.y - minY;

    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m && (m.needsUpdate = true));
          } else {
            child.material.needsUpdate = true;
          }
        }
      }
    });
  }

  getBoundingBox() {
    if (!this.model) return new THREE.Box3();
    return new THREE.Box3().setFromObject(this.model);
  }

  checkCollision(position, characterSize) {
    if (!this.model) return false;

    const crystalBox = this.getBoundingBox();
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      position,
      characterSize || new THREE.Vector3(1, 2, 1)
    );
    return crystalBox.intersectsBox(characterBox);
  }
}
