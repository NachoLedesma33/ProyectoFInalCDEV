import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js";
import { ProgressBar } from "./ProgressBar.js";

export class Cow {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.model = null;
    this.position = position;

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

      this.setupModel();

      // Agregar a la escena
      this.scene.add(this.model);

      // Crear la barra de progreso 3D
      this.progressBar = new ProgressBar(this, this.scene, 75000); // 75 segundos para cargar

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
      this.progressBar = new ProgressBar(this, this.scene, 75000); // 75 segundos para cargar
      
      console.log("🐄 Barra de progreso reiniciada para la vaca");
    }
  }
}
