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
      console.log("Cargando Space Shuttle Orbiter...");
      
      // Cargar el modelo FBX del Space Shuttle Orbiter
      const loader = new FBXLoader();
      this.model = await this.loadModel("src/models/characters/starship/Space Shuttle Orbiter.fbx");
      
      // Configurar el modelo
      this.setupModel();
      
      // Agregar a la escena
      this.scene.add(this.model);
      
      console.log("✅ Space Shuttle Orbiter cargado exitosamente");
      
      // Hacer accesible para depuración
      window.spaceShuttle = this;
      console.log("Space Shuttle disponible como 'window.spaceShuttle' para depuración");
      
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
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`Cargando Space Shuttle: ${percent.toFixed(2)}%`);
        },
        (error) => {
          console.error("Error al cargar el modelo:", error);
          reject(error);
        }
      );
    });
  }

  setupModel() {
    if (!this.model) return;

    // Calcular el bounding box para obtener las dimensiones
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    console.log("Dimensiones originales del Space Shuttle:", size);

    // Aplicar escala
    this.model.scale.set(this.scale, this.scale, this.scale);

    // Recalcular el bounding box después de escalar
    box.setFromObject(this.model);
    box.getSize(size);

    // Posicionar el modelo horizontalmente y por encima del plano
    // Las alas deben estar paralelas al suelo
    this.model.rotation.set(Math.PI / 2, 0, 0); // Rotación de 90° en X para que las alas sean paralelas al suelo
    
    // Posicionar el Space Shuttle más bajo
    const minY = box.min.y;
    const shuttleHeight = -5.5; // Valor negativo para bajar más la posición
    this.model.position.set(this.position.x, shuttleHeight - minY, this.position.z);
    
    // Primero, eliminar luces no deseadas de forma segura
    const lightsToRemove = [];
    this.model.traverse((child) => {
      if (child.isLight) {
        lightsToRemove.push(child);
      }
    });
    
    // Eliminar las luces encontradas
    lightsToRemove.forEach(light => {
      this.model.remove(light);
      console.log("Luz eliminada del modelo Space Shuttle");
    });
    
    // Configurar sombras
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Optimizar materiales
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
    // Método mantenido para compatibilidad con el bucle de animación
  }

  // Métodos para controlar la posición
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

  // Obtener referencia al modelo
  getModel() {
    return this.model;
  }

  // Obtener el bounding box del Space Shuttle para detección de colisiones
  getBoundingBox() {
    if (!this.model) return null;
    
    const box = new THREE.Box3().setFromObject(this.model);
    return box;
  }

  // Verificar si una posición está en colisión con el Space Shuttle
  checkCollision(position, characterSize = new THREE.Vector3(1, -2, -1)) {
    if (!this.model) return false;
    
    const shuttleBox = this.getBoundingBox();
    const characterBox = new THREE.Box3().setFromCenterAndSize(position, characterSize);
    
    return shuttleBox.intersectsBox(characterBox);
  }

  // Obtener el punto de colisión más cercano y ajustar el movimiento
  getAdjustedMovement(currentPosition, movementVector, characterSize = new THREE.Vector3(1, -2, -2)) {
    if (!this.model) return movementVector;
    
    // Probar la nueva posición
    const newPosition = currentPosition.clone().add(movementVector);
    
    if (this.checkCollision(newPosition, characterSize)) {
      // Hay colisión, intentar ajustar el movimiento
      // Simplificado: devolver un vector nulo para detener el movimiento
      return new THREE.Vector3(0, 0, 0);
    }
    
    return movementVector;
  }
}
