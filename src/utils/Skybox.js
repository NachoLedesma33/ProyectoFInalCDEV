import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

// Preload the image to ensure it's loaded before creating the skybox
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
    this.groundLevel = 0; // Nivel del suelo
    this.loadSkybox(imagePath);
  }

  async loadSkybox(imagePath) {
    try {
      // First try to load the image
      const img = await loadImage(imagePath);
      console.log("Image loaded successfully:", img.src);

      // Create texture from the loaded image
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      texture.encoding = THREE.sRGBEncoding;

      // Create skybox material
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        fog: false,
      });

      // Crear geometría de esfera para el skybox
      const geometry = new THREE.SphereGeometry(this.size, 32, 32, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
      
      // Crear y añadir skybox a la escena
      this.skybox = new THREE.Mesh(geometry, material);
      this.skybox.renderOrder = -1000;
      
      // Posicionar el skybox para que comience desde el nivel del suelo
      this.skybox.position.y = this.size / 2 + this.groundLevel;
      this.scene.add(this.skybox);

      // Also set as scene background
      this.scene.background = texture;

      console.log("Skybox created successfully");
    } catch (error) {
      console.error("Error creating skybox:", error);
      // Fallback to a solid color
      this.scene.background = new THREE.Color(0x87ceeb);

      // Try alternative paths
      const alternativePaths = [
        `./${imagePath}`,
        `/${imagePath}`,
        imagePath.replace("src/", ""),
      ];

      for (const path of alternativePaths) {
        try {
          console.log("Trying alternative path:", path);
          const img = await loadImage(path);
          const texture = new THREE.Texture(img);
          texture.needsUpdate = true;
          this.scene.background = texture;
          console.log("Successfully loaded from alternative path:", path);
          break;
        } catch (e) {
          console.error(`Failed to load from ${path}:`, e);
        }
      }
    }
  }

  // Actualizar la posición del skybox para que siga a la cámara
  update(cameraPosition) {
    if (this.skybox) {
      this.skybox.position.copy(cameraPosition);
    }
  }

  // Limpiar recursos
  dispose() {
    if (this.skybox) {
      this.scene.remove(this.skybox);
      this.skybox.material.dispose();
      this.skybox.geometry.dispose();
    }
  }
}

export default Skybox;
