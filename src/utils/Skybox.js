import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}
export class Skybox {
  constructor(scene, imagePath) {
    this.scene = scene;
    this.size = 5000;
    this.groundLevel = 0; 
    this.loadSkybox(imagePath);
  }

  async loadSkybox(imagePath) {
    try {
      const img = await loadImage(imagePath);
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      texture.encoding = THREE.sRGBEncoding;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        fog: false,
      });
      const geometry = new THREE.SphereGeometry(
        this.size,
        32,
        32,
        0,
        Math.PI * 2,
        Math.PI * 0.5,
        Math.PI * 0.5
      );
      this.skybox = new THREE.Mesh(geometry, material);
      this.skybox.renderOrder = -1000;
      this.skybox.position.y = this.size / 2 + this.groundLevel;
      this.scene.add(this.skybox);
      this.scene.background = texture;
    } catch (error) {
      console.error("Error creating skybox:", error);
      this.scene.background = new THREE.Color(0x87ceeb);
      const alternativePaths = [
        `./${imagePath}`,
        `/${imagePath}`,
        imagePath.replace("src/", ""),
      ];

      for (const path of alternativePaths) {
        try {
          const img = await loadImage(path);
          const texture = new THREE.Texture(img);
          texture.needsUpdate = true;
          this.scene.background = texture;
          break;
        } catch (e) {
          console.error(`Failed to load from ${path}:`, e);
        }
      }
    }
  }
  update(cameraPosition) {
    if (this.skybox) {
      this.skybox.position.copy(cameraPosition);
    }
  }
  dispose() {
    if (this.skybox) {
      this.scene.remove(this.skybox);
      this.skybox.material.dispose();
      this.skybox.geometry.dispose();
    }
  }
}

export default Skybox;
