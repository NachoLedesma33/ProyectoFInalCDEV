import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";

export class Cow {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.model = null;
    this.position = position;

    // Generar una pequeña variación de altura para evitar que las vacas se fusionen
    this.heightOffset = (Math.random() - 0.5) * 0.1; // Variación de -0.05 a +0.05

    // Generar una pequeña variación de rotación para orientación diversa
    this.rotationOffset = Math.random() * Math.PI * 2; // Rotación aleatoria completa

    this.init();
  }

  async init() {
    try {
      console.log("Cargando modelo de vaca...");

      // Cargar el modelo FBX de la vaca
      const loader = new FBXLoader();
      this.model = await this.loadModel(
        "src/models/characters/animals/Cow.fbx"
      );

      // Configurar el modelo
      this.setupModel();

      // Agregar a la escena
      this.scene.add(this.model);

      console.log("✅ Vaca cargada exitosamente");
    } catch (error) {
      console.error("Error al cargar el modelo de vaca:", error);
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
          console.log(`Cargando vaca: ${percent.toFixed(2)}%`);
        },
        (error) => {
          console.error("Error al cargar el modelo de vaca:", error);
          reject(error);
        }
      );
    });
  }

  setupModel() {
    if (!this.model) return;

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

    // Aplicar rotación aleatoria para orientación diversa
    this.model.rotation.y = this.rotationOffset;

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

    // Las vacas están quietas, no se reproducen animaciones
    // Eliminamos cualquier animación existente para asegurar que estén estáticas
    if (this.model.animations) {
      this.model.animations = [];
    }
  }

  update(delta) {
    // Las vacas están quietas, no se necesitan actualizaciones de animación
    // Este método se mantiene para compatibilidad con el bucle principal
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
  checkCollision(position, characterSize = new THREE.Vector3(1, 2, 1)) {
    if (!this.model) return false;

    const cowBox = this.getBoundingBox();
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      position,
      characterSize
    );

    return cowBox.intersectsBox(characterBox);
  }
}
