import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";

export class Stone {
  constructor(
    scene,
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    modelType = 1
  ) {
    this.scene = scene;
    this.model = null;
    this.position = position;
    this.scale = scale;
    this.modelType = modelType;

    this.init();
  }

  init() {
    const loader = new FBXLoader();

    const modelPath =
      this.modelType === 1
        ? "./src/models/characters/terrain/ST_Stone1.fbx"
        : "./src/models/characters/terrain/ST_Stone2.fbx";

    loader.load(
      modelPath,
      (fbx) => {
        this.model = fbx;

        this.model.scale.setScalar(this.scale);

        this.model.position.set(
          this.position.x,
          this.position.y + 0.1,
          this.position.z
        );

        this.model.rotation.y = Math.random() * Math.PI * 2;
        this.model.rotation.x = (Math.random() - 0.5) * 0.3;
        this.model.rotation.z = (Math.random() - 0.5) * 0.3;

        this.model.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x4a4a4a,
              metalness: 0.1,
              roughness: 0.9,
              emissive: 0x000000,
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/rock_face/rock_face_diff_4k.jpg",
          (texture) => {
            // Ajustes de compatibilidad Three r161
            if (texture.colorSpace !== undefined) {
              texture.colorSpace = THREE.SRGBColorSpace;
            }
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            this.model.traverse((child) => {
              if (child.isMesh) {
                child.material.map = texture;
                child.material.metalness = 0.05;
                child.material.roughness = 0.95;
                child.material.color.setHex(0xffffff);
                child.material.needsUpdate = true;
              }
            });
          },
          undefined,
          (error) => {
            this.model.traverse((child) => {
              if (child.isMesh) {
                const stoneColors = [
                  0x696969, 0x808080, 0xa9a9a9, 0xc0c0c0, 0xd3d3d3,
                ];
                const randomColor =
                  stoneColors[Math.floor(Math.random() * stoneColors.length)];

                child.material.color.setHex(randomColor);
                child.material.metalness = 0.05;
                child.material.roughness = 0.95;
                child.material.needsUpdate = true;
              }
            });
          }
        );

        this.scene.add(this.model);
      },
      undefined,
      (error) => {}
    );
  }

  update(delta) {
    // Las piedras están estáticas
  }

  getModel() {
    return this.model;
  }
  checkCollision(position, characterSize) {
    if (!this.model) return false;

    return this.checkRobustCollision(position, characterSize);
  }
  checkRobustCollision(position, characterSize) {
    const stoneBox = this.getBoundingBox();

    const characterBox = new THREE.Box3();
    const characterMin = position
      .clone()
      .sub(characterSize.clone().multiplyScalar(0.5));
    const characterMax = position
      .clone()
      .add(characterSize.clone().multiplyScalar(0.5));
    characterBox.setFromPoints([characterMin, characterMax]);

    stoneBox.expandByScalar(-0.3);

    const boxCollision = stoneBox.intersectsBox(characterBox);

    const stoneCenter = this.model.position.clone();
    const horizontalDistance = Math.sqrt(
      Math.pow(position.x - stoneCenter.x, 2) +
        Math.pow(position.z - stoneCenter.z, 2)
    );

    const collisionRadius = Math.max(characterSize.x, characterSize.z) * 0.6;

    const distanceCollision = horizontalDistance < collisionRadius;

    const stoneSize = stoneBox.getSize(new THREE.Vector3());
    const stoneRadius = Math.max(stoneSize.x, stoneSize.z) * 0.4;
    const characterRadius = Math.max(characterSize.x, characterSize.z) * 0.5;
    const proximityCollision =
      horizontalDistance < stoneRadius + characterRadius;

    const collisionMethods = [
      boxCollision,
      distanceCollision,
      proximityCollision,
    ];
    const collisionCount = collisionMethods.filter((method) => method).length;
    const collision = collisionCount >= 2;

    return collision;
  }

  getBoundingBox() {
    if (!this.model) {
      return new THREE.Box3();
    }

    const box = new THREE.Box3().setFromObject(this.model);
    return box;
  }
}