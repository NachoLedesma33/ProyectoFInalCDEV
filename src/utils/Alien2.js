import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import * as BufferGeometryUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/BufferGeometryUtils.js";
import modelConfig from "../config/modelConfig.js";

export class Alien2 {
  constructor(
    scene,
    modelLoader,
    position = { x: 0, y: 0, z: 0 },
    lookAt = { x: 0, y: 0, z: 0 }
  ) {
    this.scene = scene;
    this.modelLoader = modelLoader;
    this.position = position;
    this.lookAt = lookAt;
    this.model = null;
    this.mixer = null;
    this.currentAction = null;
    this.animations = {};

    // Sistema de movimiento automático
    this.movementSystem = {
      isActive: false,
      currentPathIndex: 0,
      isMoving: false,
      isTurning: false,
      moveSpeed: 0.05, // Velocidad de movimiento
      turnSpeed: 0.02, // Velocidad de giro
      paths: [
        // Ruta 1: Desde posición inicial hasta primera parada
        {
          start: { x: -52.5, y: 0.0, z: -159.7 },
          end: { x: -81.6, y: 0.0, z: -90.0 },
          animation: "walk",
        },
        // Ruta 2: Giro a la derecha (90 grados)
        {
          start: { x: -81.6, y: 0.0, z: -90.0 },
          end: { x: -81.6, y: 0.0, z: -90.0 },
          animation: "turnRight",
          rotation: Math.PI / 2, // 90 grados
          isTurn: true,
        },
        // Ruta 3: Desde segunda parada hasta posición final
        {
          start: { x: -81.6, y: 0.0, z: -90.0 },
          end: { x: -17.8, y: 0.0, z: -45.4 },
          animation: "walk",
        },
      ],
      timer: null,
    };

    // Sistema de interacción
    this.interactionSystem = {
      isAtFinalPosition: false,
      exclamationMark: null,
      collisionRadius: 2.0, // Radio de colisión
      isPlayerNearby: false,
      playerStayTime: 0,
      requiredStayTime: 2.0, // 2 segundos
      dialogueHud: null,
      isDialogueOpen: false,
    };
  }

  async load() {
    try {
      const alien2Config = modelConfig.characters.alien2;
      console.log("Cargando configuración de Alien2:", alien2Config);

      // Cargar el modelo base (sin animaciones)
      const modelPath = modelConfig.getPath(alien2Config.model);
      console.log("Cargando modelo base desde:", modelPath);

      // Cargar modelo base como promesa
      this.model = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          modelPath,
          (fbx) => {
            console.log("Modelo base cargado exitosamente");
            resolve(fbx);
          },
          undefined,
          (error) => {
            console.error("Error cargando el modelo base:", error);
            reject(error);
          }
        );
      });

      // Configurar el modelo
      this.model.scale.set(0.02, 0.02, 0.02);
      this.model.position.copy(this.position);

      // Configurar el mezclador de animaciones
      this.mixer = new THREE.AnimationMixer(this.model);

      // Cargar las animaciones por separado
      const idlePath = modelConfig.getPath(alien2Config.animations.idle);
      const walkPath = modelConfig.getPath(alien2Config.animations.walk);
      const turnRightPath = modelConfig.getPath(
        alien2Config.animations.turnRight
      );

      console.log("Cargando animaciones desde:", {
        idlePath,
        walkPath,
        turnRightPath,
      });

      // Cargar animación idle
      const idleLoaded = await this.loadAnimation("idle", idlePath);
      if (idleLoaded) {
        console.log("Animación idle cargada exitosamente");
      } else {
        console.warn("No se pudo cargar la animación idle");
      }

      // Cargar animación de caminar
      const walkLoaded = await this.loadAnimation("walk", walkPath);
      if (walkLoaded) {
        console.log("✅ Animación walk cargada exitosamente");
        console.log("Detalles de animación walk:", this.animations.walk);
      } else {
        console.warn("❌ No se pudo cargar la animación walk");
      }

      // Cargar animación de giro
      const turnRightLoaded = await this.loadAnimation(
        "turnRight",
        turnRightPath
      );
      if (turnRightLoaded) {
        console.log("✅ Animación turnRight cargada exitosamente");
        console.log(
          "Detalles de animación turnRight:",
          this.animations.turnRight
        );
      } else {
        console.warn("❌ No se pudo cargar la animación turnRight");
      }

      // Reproducir animación idle inicialmente
      setTimeout(() => {
        this.playAnimation("idle");
      }, 100);

      // Verificar si el modelo base tiene animaciones incluidas
      if (this.model.animations && this.model.animations.length > 0) {
        console.log(
          "Modelo base tiene animaciones incluidas:",
          this.model.animations.length
        );
        this.model.animations.forEach((anim, index) => {
          console.log(`  Animación ${index}: ${anim.name} (${anim.duration}s)`);
        });

        // Si hay animaciones en el modelo base, usar la primera como idle
        const baseIdleClip = this.model.animations[0];
        this.animations.baseIdle = baseIdleClip;
        console.log("Usando animación del modelo base como respaldo");

        // Intentar reproducir la animación del modelo base si la externa falla
        setTimeout(() => {
          if (!this.currentAction || !this.currentAction.isRunning()) {
            console.log("Intentando usar animación del modelo base...");
            this.playAnimation("baseIdle");
          }
        }, 500);
      }

      // Hacer que el modelo mire hacia la posición objetivo
      const targetPosition = new THREE.Vector3(
        this.lookAt.x,
        this.model.position.y,
        this.lookAt.z
      );
      this.model.lookAt(targetPosition);

      // Optimizar el modelo para mejor rendimiento
      this.optimizeForPerformance();

      // Agregar el modelo a la escena
      this.scene.add(this.model);

      console.log("Alien2 cargado y configurado correctamente");
      return true;
    } catch (error) {
      console.error("Error al cargar el Alien2:", error);
      return false;
    }
  }

  optimizeForPerformance() {
    if (!this.model) return;

    // Reducir la calidad de sombras
    this.model.traverse((child) => {
      if (child.isMesh) {
        // Optimizar geometrías
        if (child.geometry) {
          child.geometry.computeVertexNormals();

          // Reducir la calidad de las sombras
          child.castShadow = true;
          child.receiveShadow = true;

          // Reducir la calidad de las mallas
          if (
            child.geometry.attributes.position &&
            child.geometry.attributes.position.count > 5000
          ) {
            try {
              const ratio = Math.min(
                1,
                5000 / child.geometry.attributes.position.count
              );
              const simplifiedGeometry = BufferGeometryUtils.mergeVertices(
                child.geometry,
                0.01 * ratio
              );
              child.geometry.dispose(); // Liberar memoria de la geometría anterior
              child.geometry = simplifiedGeometry;
            } catch (error) {
              console.warn("No se pudo simplificar la geometría:", error);
            }
          }
        }

        // Optimizar materiales
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => this.optimizeMaterial(mat));
          } else {
            this.optimizeMaterial(child.material);
          }
        }
      }
    });

    console.log("Optimizaciones de rendimiento aplicadas al modelo Alien2");
  }

  optimizeMaterial(material) {
    // Reducir la calidad de los materiales para mejor rendimiento
    material.precision = "mediump";
    material.shininess = 0;
    material.roughness = 1;
    material.metalness = 0;

    // Desactivar características costosas
    if (material.map) material.map.anisotropy = 1;
    if (material.normalMap) material.normalScale.set(0.5, 0.5);
    if (material.bumpMap) material.bumpScale = 0.5;

    // Usar sombras más simples
    material.shadowSide = THREE.FrontSide;
  }

  async loadAnimation(name, path) {
    try {
      console.log(`🔄 Cargando animación '${name}' desde: ${path}`);

      const anim = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          path,
          (fbx) => {
            console.log(`📁 Archivo FBX cargado para '${name}':`, fbx);
            console.log(`🎬 Animaciones encontradas: ${fbx.animations.length}`);

            if (fbx.animations.length > 0) {
              const animation = fbx.animations[0];
              console.log(`✅ Animación '${name}' cargada:`, {
                name: animation.name,
                duration: animation.duration,
                tracks: animation.tracks.length,
              });
              resolve(animation);
            } else {
              console.warn(`⚠️ No se encontraron animaciones en ${path}`);
              reject(new Error(`No se encontraron animaciones en ${path}`));
            }
          },
          (progress) => {
            console.log(
              `📊 Progreso de carga '${name}':`,
              ((progress.loaded / progress.total) * 100).toFixed(2) + "%"
            );
          },
          (error) => {
            console.error(`❌ Error cargando la animación '${name}':`, error);
            reject(error);
          }
        );
      });

      this.animations[name] = anim;
      console.log(`✅ Animación '${name}' guardada en this.animations`);
      return true;
    } catch (error) {
      console.error(`❌ Error al cargar la animación '${name}':`, error);
      return false;
    }
  }

  playAnimation(name) {
    if (!this.animations[name] || !this.mixer) {
      console.warn(
        `Animación '${name}' no disponible o mezclador no inicializado`
      );
      return false;
    }

    // Verificar si ya está reproduciendo la misma animación
    const isSameAnimation =
      this.currentAction &&
      this.currentAction.getClip()?.name === this.animations[name].name &&
      this.currentAction.isRunning();

    if (isSameAnimation) {
      console.log(`Animación '${name}' ya está reproduciéndose`);
      return true;
    }

    try {
      console.log(`🔄 Cambiando de animación a '${name}'...`);

      // Detener animación actual con fade out suave
      if (this.currentAction) {
        console.log(
          `Deteniendo animación actual: ${this.currentAction.getClip().name}`
        );
        this.currentAction.fadeOut(0.1);
        this.currentAction.stop();
      }

      // Crear y configurar la nueva acción
      const clip = this.animations[name];
      const action = this.mixer.clipAction(clip);

      if (!action) {
        console.error("No se pudo crear la acción para el clip:", clip);
        return false;
      }

      // Configuración óptima para la animación
      action
        .reset()
        .setEffectiveTimeScale(1.0)
        .setEffectiveWeight(1.0)
        .setLoop(THREE.LoopRepeat, Infinity)
        .fadeIn(0.1)
        .play();

      this.currentAction = action;
      console.log(`✅ Animación '${name}' iniciada correctamente`);

      // Forzar la actualización del mixer para aplicar la animación inmediatamente
      if (this.mixer) {
        this.mixer.update(0.016); // Actualizar con un delta pequeño
      }

      // Verificar que la animación se está reproduciendo
      setTimeout(() => {
        if (this.currentAction && this.currentAction.isRunning()) {
          console.log(`✅ Animación '${name}' confirmada como activa`);
        } else {
          console.warn(`⚠️ Animación '${name}' no se está reproduciendo`);
          // Intentar forzar la animación
          if (this.currentAction) {
            this.currentAction.reset().play();
            console.log("Intentando forzar la animación...");
          }
        }
      }, 200);

      return true;
    } catch (error) {
      console.error(`Error al reproducir animación '${name}':`, error);
      return false;
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Actualizar sistema de movimiento si está activo
    if (this.movementSystem.isActive) {
      this.updateMovement(delta);
    }

    // Actualizar sistema de interacción si está activo
    if (this.interactionSystem.isAtFinalPosition) {
      this.updateInteraction(delta);
    }
  }

  // Iniciar el sistema de movimiento automático después de 5 minutos
  startMovementSequence() {
    console.log("Iniciando secuencia de movimiento del Alien2 en 5 minutos...");

    this.movementSystem.timer = setTimeout(() => {
      console.log(
        "¡5 minutos transcurridos! Iniciando movimiento del Alien2..."
      );
      this.activateMovementSystem();
    }, 5 * 60 * 1000); // 5 minutos en milisegundos
  }

  // Activar el sistema de movimiento
  activateMovementSystem() {
    this.movementSystem.isActive = true;
    this.movementSystem.currentPathIndex = 0;

    // Mover el modelo a la posición inicial de la primera ruta
    const firstPath = this.movementSystem.paths[0];
    this.model.position.set(
      firstPath.start.x,
      firstPath.start.y,
      firstPath.start.z
    );

    console.log(
      "Sistema de movimiento activado. Alien2 movido a posición inicial:",
      firstPath.start
    );

    // Iniciar el primer movimiento
    this.startNextPath();
  }

  // Iniciar el siguiente segmento de la ruta
  startNextPath() {
    if (
      this.movementSystem.currentPathIndex >= this.movementSystem.paths.length
    ) {
      console.log(
        "Secuencia de movimiento completada. Alien2 en posición final."
      );

      // Activar sistema de interacción (esto incluye el cambio a idle)
      this.activateInteractionSystem();
      return;
    }

    const currentPath =
      this.movementSystem.paths[this.movementSystem.currentPathIndex];
    console.log(
      `Iniciando ruta ${this.movementSystem.currentPathIndex + 1}:`,
      currentPath
    );

    if (currentPath.isTurn) {
      this.startTurn(currentPath);
    } else {
      this.startMovement(currentPath);
    }
  }

  // Iniciar movimiento hacia un punto
  startMovement(path) {
    this.movementSystem.isMoving = true;

    // Calcular dirección del movimiento
    const direction = new THREE.Vector3(
      path.end.x - path.start.x,
      path.end.y - path.start.y,
      path.end.z - path.start.z
    ).normalize();

    // Hacer que el modelo mire en la dirección del movimiento
    const lookAtPoint = new THREE.Vector3(
      this.model.position.x + direction.x,
      this.model.position.y,
      this.model.position.z + direction.z
    );
    this.model.lookAt(lookAtPoint);

    // Cambiar a la animación de caminar
    console.log("Cambiando a animación de caminar...");
    this.playAnimation(path.animation);

    console.log(
      "Iniciando movimiento hacia:",
      path.end,
      "con animación:",
      path.animation
    );
  }

  // Iniciar giro
  startTurn(path) {
    this.movementSystem.isTurning = true;

    // Calcular la rotación objetivo
    const currentRotation = this.model.rotation.y;
    const targetRotation = currentRotation + path.rotation;

    this.movementSystem.targetRotation = targetRotation;
    this.movementSystem.startRotation = currentRotation;

    // Cambiar a la animación de giro
    console.log("Cambiando a animación de giro...");
    this.playAnimation(path.animation);

    console.log(
      "Iniciando giro de",
      (path.rotation * 180) / Math.PI,
      "grados con animación:",
      path.animation
    );
  }

  // Actualizar el movimiento
  updateMovement(delta) {
    if (!this.movementSystem.isActive) return;

    const currentPath =
      this.movementSystem.paths[this.movementSystem.currentPathIndex];

    if (this.movementSystem.isMoving) {
      this.updateMovementToTarget(currentPath, delta);
    } else if (this.movementSystem.isTurning) {
      this.updateTurn(delta);
    }
  }

  // Actualizar movimiento hacia el objetivo
  updateMovementToTarget(path, delta) {
    const currentPos = this.model.position;
    const targetPos = new THREE.Vector3(path.end.x, path.end.y, path.end.z);

    // Calcular distancia al objetivo
    const distance = currentPos.distanceTo(targetPos);

    if (distance < 0.1) {
      // Llegamos al objetivo
      this.model.position.copy(targetPos);
      this.movementSystem.isMoving = false;
      this.movementSystem.currentPathIndex++;

      console.log("Llegado al objetivo. Iniciando siguiente ruta...");
      setTimeout(() => {
        this.startNextPath();
      }, 500); // Pausa de 0.5 segundos entre rutas
    } else {
      // Continuar moviéndose hacia el objetivo
      const direction = new THREE.Vector3()
        .subVectors(targetPos, currentPos)
        .normalize();

      const moveDistance = this.movementSystem.moveSpeed * delta * 60; // Normalizar por FPS
      this.model.position.add(direction.multiplyScalar(moveDistance));
    }
  }

  // Actualizar giro
  updateTurn(delta) {
    const currentRotation = this.model.rotation.y;
    const targetRotation = this.movementSystem.targetRotation;

    // Calcular diferencia de rotación
    let rotationDiff = targetRotation - currentRotation;

    // Normalizar la diferencia de rotación
    while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
    while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

    if (Math.abs(rotationDiff) < 0.01) {
      // Giro completado
      this.model.rotation.y = targetRotation;
      this.movementSystem.isTurning = false;
      this.movementSystem.currentPathIndex++;

      console.log("Giro completado. Iniciando siguiente ruta...");
      setTimeout(() => {
        this.startNextPath();
      }, 500); // Pausa de 0.5 segundos entre rutas
    } else {
      // Continuar girando
      const turnAmount =
        Math.sign(rotationDiff) * this.movementSystem.turnSpeed * delta * 60;
      this.model.rotation.y += turnAmount;
    }
  }

  // Método para forzar la aplicación de la animación
  forceAnimation() {
    if (this.currentAction && this.mixer) {
      console.log("Forzando aplicación de animación...");
      this.currentAction.reset();
      this.currentAction.play();
      this.mixer.update(0.1);
      console.log("Animación forzada aplicada");
    }
  }

  // Método para verificar el esqueleto del modelo
  checkSkeleton() {
    if (!this.model) {
      console.log("Modelo no cargado");
      return;
    }

    console.log("=== VERIFICACIÓN DEL ESQUELETO ===");
    let skeletonFound = false;

    this.model.traverse((child) => {
      if (child.isBone || child.type === "Bone") {
        skeletonFound = true;
        console.log("Hueso encontrado:", child.name, child.type);
      }
      if (child.isSkinnedMesh) {
        console.log("Malla con esqueleto encontrada:", child.name);
        if (child.skeleton) {
          console.log(
            "Esqueleto de la malla:",
            child.skeleton.bones.length,
            "huesos"
          );
        }
      }
    });

    if (!skeletonFound) {
      console.warn("⚠️ No se encontró esqueleto en el modelo");
    } else {
      console.log("✅ Esqueleto encontrado en el modelo");
    }
    console.log("================================");
  }

  // ==============================================
  // SISTEMA DE INTERACCIÓN
  // ==============================================

  // Forzar cambio a animación idle (método interno)
  forceIdleAnimation() {
    console.log("🔧 Ejecutando forceIdleAnimation()...");

    // Desactivar completamente el sistema de movimiento
    this.movementSystem.isActive = false;
    this.movementSystem.isMoving = false;
    this.movementSystem.isTurning = false;

    console.log("Sistema de movimiento desactivado:", {
      isActive: this.movementSystem.isActive,
      isMoving: this.movementSystem.isMoving,
      isTurning: this.movementSystem.isTurning,
    });

    // Detener cualquier animación actual
    if (this.currentAction) {
      console.log(
        "Deteniendo animación actual:",
        this.currentAction.getClip().name
      );
      this.currentAction.stop();
      this.currentAction = null;
    }

    // Forzar cambio a idle
    console.log("Cambiando a animación idle...");
    const success = this.playAnimation("idle");

    if (success) {
      console.log("✅ Animación idle aplicada correctamente");
    } else {
      console.error("❌ Error al aplicar animación idle");
    }

    return success;
  }

  // Activar sistema de interacción cuando llega a la posición final
  activateInteractionSystem() {
    this.interactionSystem.isAtFinalPosition = true;
    console.log("Sistema de interacción activado para Alien2");

    // FORZAR cambio a animación idle cuando se activa el sistema de interacción
    console.log(
      "🔄 Forzando cambio a animación idle al activar sistema de interacción..."
    );
    this.forceIdleAnimation();

    // Crear símbolo de exclamación
    this.createExclamationMark();

    // Crear círculo verde parpadeante
    this.createBlinkingCircle();

    // Crear HUD de diálogo
    this.createDialogueHud();
  }

  // Crear símbolo de exclamación sobre el Alien2
  createExclamationMark() {
    if (!this.model) return;

    // Crear geometría para el símbolo de exclamación
    const geometry = new THREE.ConeGeometry(0.3, 1.0, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
    });

    this.interactionSystem.exclamationMark = new THREE.Mesh(geometry, material);

    // Posicionar sobre la cabeza del Alien2
    this.interactionSystem.exclamationMark.position.set(0, 3.0, 0);
    this.interactionSystem.exclamationMark.rotation.z = Math.PI;

    // Agregar al modelo
    this.model.add(this.interactionSystem.exclamationMark);

    // Animación de parpadeo
    this.animateExclamationMark();

    console.log("Símbolo de exclamación creado sobre Alien2");
  }

  // Animar el símbolo de exclamación
  animateExclamationMark() {
    if (!this.interactionSystem.exclamationMark) return;

    const animate = () => {
      if (this.interactionSystem.exclamationMark) {
        this.interactionSystem.exclamationMark.rotation.y += 0.1;
        this.interactionSystem.exclamationMark.scale.y =
          1 + Math.sin(Date.now() * 0.01) * 0.2;
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  // Crear círculo verde parpadeante
  createBlinkingCircle() {
    const geometry = new THREE.CircleGeometry(1.0, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    this.interactionSystem.blinkingCircle = new THREE.Mesh(geometry, material);
    this.interactionSystem.blinkingCircle.position.set(-15, 0.1, -44.2);
    this.interactionSystem.blinkingCircle.rotation.x = -Math.PI / 2;

    this.scene.add(this.interactionSystem.blinkingCircle);

    // Animación de parpadeo
    this.animateBlinkingCircle();

    console.log(
      "Círculo verde parpadeante creado en posición:",
      this.interactionSystem.blinkingCircle.position
    );

    // FORZAR cambio a idle cuando se crea el círculo verde
    console.log("🔄 Forzando cambio a idle al crear círculo verde...");
    setTimeout(() => {
      this.forceIdleAnimation();
    }, 100); // Pequeño delay para asegurar que todo esté listo
  }

  // Animar el círculo parpadeante
  animateBlinkingCircle() {
    if (!this.interactionSystem.blinkingCircle) return;

    const animate = () => {
      if (this.interactionSystem.blinkingCircle) {
        this.interactionSystem.blinkingCircle.material.opacity =
          0.3 + Math.sin(Date.now() * 0.005) * 0.3;
        this.interactionSystem.blinkingCircle.scale.setScalar(
          1 + Math.sin(Date.now() * 0.003) * 0.1
        );
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  // Crear HUD de diálogo
  createDialogueHud() {
    // Crear contenedor del HUD
    const hudContainer = document.createElement("div");
    hudContainer.id = "alien2-dialogue-hud";
    hudContainer.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 800px;
    height: 500px;
    background: rgba(44, 62, 80, 0.98);
    border: 4px solid #3498db;
    border-radius: 25px;
    display: none;
    z-index: 999999 !important;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9);
    backdrop-filter: blur(15px);
    overflow: hidden;
    font-family: 'Arial', sans-serif;
    pointer-events: auto;
  `;

    // Crear cabecera
    const header = document.createElement("div");
    header.style.cssText = `
      background: linear-gradient(45deg, #27ae60, #2ecc71);
      color: white;
      padding: 20px 30px;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      border-bottom: 3px solid #3498db;
    `;
    header.innerHTML = "👽 ALIEN COMERCIANTE 👽";
    hudContainer.appendChild(header);

    // Crear contenedor principal
    const mainContainer = document.createElement("div");
    mainContainer.style.cssText = `
      display: flex;
      height: calc(100% - 70px);
    `;
    hudContainer.appendChild(mainContainer);

    // Crear contenedor izquierdo (imagen del alien)
    const leftPanel = document.createElement("div");
    leftPanel.style.cssText = `
      width: 300px;
      background: linear-gradient(135deg, #1a2f3a, #2c3e50);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px;
      border-right: 3px solid #3498db;
    `;

    // Crear imagen del Alien2
    const alienFace = document.createElement("img");
    alienFace.src = "/src/assets/Alien2chat1.png";
    alienFace.alt = "Alien2";
    alienFace.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 0 20px rgba(46, 204, 113, 0.5));
    `;
    leftPanel.appendChild(alienFace);
    mainContainer.appendChild(leftPanel);

    // Crear contenedor derecho (diálogo)
    const rightPanel = document.createElement("div");
    rightPanel.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 30px;
    `;
    mainContainer.appendChild(rightPanel);

    // Crear área de diálogo
    const dialogueArea = document.createElement("div");
    dialogueArea.id = "alien2-dialogue-text";
    dialogueArea.style.cssText = `
      flex: 1;
      background: rgba(0, 0, 0, 0.6);
      border: 2px solid #3498db;
      border-radius: 15px;
      padding: 25px;
      font-size: 20px;
      line-height: 1.6;
      color: #ecf0f1;
      overflow-y: auto;
      margin-bottom: 20px;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
      font-weight: 500;
    `;
    dialogueArea.innerHTML =
      "Hola humano, ¿tienes leche de tus vacas para vender?";
    rightPanel.appendChild(dialogueArea);

    // Crear área de botones de respuesta
    const buttonArea = document.createElement("div");
    buttonArea.id = "alien2-dialogue-buttons";
    buttonArea.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 180px;
      overflow-y: auto;
      padding: 5px;
    `;
    rightPanel.appendChild(buttonArea);

    // Crear botón de cerrar
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "✕ CERRAR";
    closeButton.style.cssText = `
      position: absolute;
      top: 15px;
      right: 20px;
      background: linear-gradient(45deg, #e74c3c, #c0392b);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 12px 20px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
      z-index: 10001;
    `;
    closeButton.onmouseover = () => {
      closeButton.style.background = "linear-gradient(45deg, #c0392b, #a93226)";
      closeButton.style.transform = "scale(1.05)";
      closeButton.style.boxShadow = "0 6px 20px rgba(231, 76, 60, 0.6)";
    };
    closeButton.onmouseout = () => {
      closeButton.style.background = "linear-gradient(45deg, #e74c3c, #c0392b)";
      closeButton.style.transform = "scale(1)";
      closeButton.style.boxShadow = "0 4px 15px rgba(231, 76, 60, 0.4)";
    };
    closeButton.onclick = () => this.closeDialogue();
    hudContainer.appendChild(closeButton);

    // Añadir estilos para la barra de scroll
    const style = document.createElement("style");
    style.textContent = `
      #alien2-dialogue-hud::-webkit-scrollbar {
        width: 8px;
      }
      #alien2-dialogue-hud::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.3);
        border-radius: 4px;
      }
      #alien2-dialogue-hud::-webkit-scrollbar-thumb {
        background: #3498db;
        border-radius: 4px;
      }
      #alien2-dialogue-hud::-webkit-scrollbar-thumb:hover {
        background: #2980b9;
      }
      #alien2-dialogue-text::-webkit-scrollbar {
        width: 6px;
      }
      #alien2-dialogue-text::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.2);
        border-radius: 3px;
      }
      #alien2-dialogue-text::-webkit-scrollbar-thumb {
        background: #27ae60;
        border-radius: 3px;
      }
      #alien2-dialogue-buttons::-webkit-scrollbar {
        width: 6px;
      }
      #alien2-dialogue-buttons::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.2);
        border-radius: 3px;
      }
      #alien2-dialogue-buttons::-webkit-scrollbar-thumb {
        background: #f39c12;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(style);

    // Ensamblar el HUD
    document.body.appendChild(hudContainer);

    this.interactionSystem.dialogueHud = hudContainer;
    this.interactionSystem.buttonArea = buttonArea;
    this.interactionSystem.dialogueArea = dialogueArea;
    console.log("HUD de diálogo mejorado creado");
  }

  // Actualizar sistema de interacción
  updateInteraction(delta) {
    // Verificar si el jugador está cerca
    this.checkPlayerCollision();

    // Si el jugador está cerca, incrementar tiempo de permanencia
    if (this.interactionSystem.isPlayerNearby) {
      this.interactionSystem.playerStayTime += delta;

      // Si ha estado el tiempo suficiente, abrir diálogo
      if (
        this.interactionSystem.playerStayTime >=
          this.interactionSystem.requiredStayTime &&
        !this.interactionSystem.isDialogueOpen
      ) {
        this.openDialogue();
      }
    } else {
      // Resetear tiempo si el jugador se aleja
      this.interactionSystem.playerStayTime = 0;
    }
  }

  // Verificar colisión con el jugador
  checkPlayerCollision() {
    // Si ya estamos en diálogo, no es necesario verificar colisiones
    if (this.interactionSystem.isDialogueOpen) return;

    if (!this.interactionSystem.blinkingCircle || !window.farmerController)
      return;

    const circlePos = this.interactionSystem.blinkingCircle.position;
    const playerPos = window.farmerController.model.position;
    const distance = circlePos.distanceTo(playerPos);
    const wasPlayerNearby = this.interactionSystem.isPlayerNearby;

    this.interactionSystem.isPlayerNearby =
      distance <= this.interactionSystem.collisionRadius;

    // Solo mostrar mensaje cuando cambia el estado de proximidad
    if (this.interactionSystem.isPlayerNearby !== wasPlayerNearby) {
      if (this.interactionSystem.isPlayerNearby) {
        console.log("Jugador entró en el área de interacción");
      } else {
        console.log("Jugador salió del área de interacción");
      }
    }
  }

  // Abrir diálogo
  openDialogue() {
    if (
      this.interactionSystem.dialogueHud &&
      !this.interactionSystem.isDialogueOpen
    ) {
      console.log("Abriendo diálogo con Alien2...");
      this.interactionSystem.dialogueHud.style.display = "block";
      this.interactionSystem.isDialogueOpen = true;

      // Mostrar el diálogo inicial
      this.showInitialDialogue();

      console.log("✅ Diálogo abierto con Alien2");

      // Verificar que el HUD esté visible
      setTimeout(() => {
        const hud = document.getElementById("alien2-dialogue-hud");
        if (hud) {
          console.log("HUD encontrado en DOM:", hud.style.display);
          console.log(
            "HUD visible:",
            hud.offsetWidth > 0 && hud.offsetHeight > 0
          );
          console.log("HUD z-index:", hud.style.zIndex);
        } else {
          console.error("HUD no encontrado en DOM");
        }
      }, 100);
    } else {
      console.warn("No se puede abrir diálogo:", {
        hudExists: !!this.interactionSystem.dialogueHud,
        alreadyOpen: this.interactionSystem.isDialogueOpen,
      });
    }
  }

  // Mostrar diálogo inicial
  showInitialDialogue() {
    if (
      !this.interactionSystem.dialogueArea ||
      !this.interactionSystem.buttonArea
    )
      return;

    // Mostrar mensaje del Alien
    this.interactionSystem.dialogueArea.innerHTML =
      '<div style="text-align: center; margin-bottom: 15px; color: #2ecc71; font-size: 22px;">👽 ALIEN COMERCIANTE 👽</div>' +
      '<div style="text-align: center; font-size: 20px; line-height: 1.5;">Hola humano, ¿tienes leche de tus vacas para vender?</div>';

    // Limpiar botones anteriores
    this.interactionSystem.buttonArea.innerHTML = "";

    // Obtener cantidad de leche del inventario
    const milkAmount = this.getMilkAmount();

    // Crear botón de respuesta del granjero
    const farmerButton = document.createElement("button");
    farmerButton.style.cssText = `
      background: linear-gradient(45deg, #f39c12, #e67e22);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 15px 25px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 6px 20px rgba(243, 156, 18, 0.4);
      margin: 5px 0;
    `;

    if (milkAmount < 1) {
      farmerButton.innerHTML = "🚫 Aún no tengo leche para vender";
      farmerButton.onclick = () => this.handleNoMilkResponse();
    } else {
      farmerButton.innerHTML = `✅ Sí - Tengo ${milkAmount.toFixed(
        1
      )} litros disponibles`;
      farmerButton.onclick = () => this.handleYesMilkResponse();
    }

    farmerButton.onmouseover = () => {
      farmerButton.style.transform = "translateY(-3px)";
      farmerButton.style.boxShadow = "0 8px 25px rgba(243, 156, 18, 0.6)";
    };
    farmerButton.onmouseout = () => {
      farmerButton.style.transform = "translateY(0)";
      farmerButton.style.boxShadow = "0 6px 20px rgba(243, 156, 18, 0.4)";
    };

    this.interactionSystem.buttonArea.appendChild(farmerButton);
  }

  // Obtener cantidad de leche del inventario
  getMilkAmount() {
    if (window.inventory && typeof window.inventory.getState === "function") {
      const state = window.inventory.getState();
      return state.milkLiters || 0;
    }
    return 0;
  }

  // Manejar respuesta cuando no hay leche
  handleNoMilkResponse() {
    if (!this.interactionSystem.dialogueArea) return;

    this.interactionSystem.dialogueArea.innerHTML =
      '<div style="text-align: center; color: #e74c3c; font-size: 22px;">⚠️</div>' +
      '<div style="text-align: center; font-size: 20px; line-height: 1.5;">Vuelve cuando tengas leche, humano</div>';

    // Limpiar botones
    this.interactionSystem.buttonArea.innerHTML = "";

    // Crear botón para cerrar
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "👌 Entendido";
    closeButton.style.cssText = `
      background: linear-gradient(45deg, #95a5a6, #7f8c8d);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 15px 25px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 6px 20px rgba(149, 165, 166, 0.4);
    `;
    closeButton.onclick = () => this.closeDialogue();
    closeButton.onmouseover = () => {
      closeButton.style.transform = "translateY(-2px)";
      closeButton.style.boxShadow = "0 8px 25px rgba(149, 165, 166, 0.6)";
    };
    closeButton.onmouseout = () => {
      closeButton.style.transform = "translateY(0)";
      closeButton.style.boxShadow = "0 6px 20px rgba(149, 165, 166, 0.4)";
    };
    this.interactionSystem.buttonArea.appendChild(closeButton);
  }

  // Manejar respuesta cuando sí hay leche
  handleYesMilkResponse() {
    if (
      !this.interactionSystem.dialogueArea ||
      !this.interactionSystem.buttonArea
    )
      return;

    this.interactionSystem.dialogueArea.innerHTML =
      "Excelente! ¿Cuántos litros quieres vender?";

    // Limpiar botones anteriores
    this.interactionSystem.buttonArea.innerHTML = "";

    // Crear botones de opciones de venta
    const sellOptions = [
      { liters: 1.0, price: 5 },
      { liters: 3.0, price: 10 },
      { liters: 5.0, price: 15 },
      { liters: 10.0, price: 25 },
    ];

    sellOptions.forEach((option) => {
      const button = document.createElement("button");
      button.style.cssText = `
        background: linear-gradient(45deg, #27ae60, #2ecc71);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
        margin-bottom: 8px;
      `;

      button.innerHTML = `${option.liters}lt => ${option.price} 🪙`;
      button.onclick = () => this.handleSellMilk(option.liters, option.price);

      button.onmouseover = () => {
        button.style.transform = "translateY(-3px)";
        button.style.boxShadow = "0 8px 25px rgba(39, 174, 96, 0.6)";
      };
      button.onmouseout = () => {
        button.style.transform = "translateY(0)";
        button.style.boxShadow = "0 6px 20px rgba(39, 174, 96, 0.4)";
      };

      this.interactionSystem.buttonArea.appendChild(button);
    });
  }

  // Manejar venta de leche
  handleSellMilk(liters, price) {
    if (!window.inventory) {
      console.error("Inventario no disponible");
      return;
    }

    const currentMilk = this.getMilkAmount();

    if (currentMilk < liters) {
      this.interactionSystem.dialogueArea.innerHTML = `<div style="text-align: center; color: #e74c3c; font-size: 22px;">❌</div>
         <div style="text-align: center; font-size: 20px; line-height: 1.5;">
           No tienes suficientes litros.<br>
           Solo tienes ${currentMilk.toFixed(1)}L
         </div>`;
      return;
    }

    // Realizar la venta
    this.sellMilkToAlien(liters, price);

    // Mostrar confirmación
    this.interactionSystem.dialogueArea.innerHTML = `<div style="text-align: center; color: #2ecc71; font-size: 22px;">🎉</div>
       <div style="text-align: center; font-size: 20px; line-height: 1.5;">
         ¡Perfecto! Vendiste ${liters}L por ${price} monedas de oro.<br>
         ¡Gracias humano!
       </div>`;

    // Limpiar botones y mostrar botón de cerrar
    this.interactionSystem.buttonArea.innerHTML = "";
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "🤝 De nada, alien";
    closeButton.style.cssText = `
      background: linear-gradient(45deg, #3498db, #2980b9);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 15px 25px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
    `;
    closeButton.onclick = () => this.closeDialogue();
    closeButton.onmouseover = () => {
      closeButton.style.transform = "translateY(-2px)";
      closeButton.style.boxShadow = "0 8px 25px rgba(52, 152, 219, 0.6)";
    };
    closeButton.onmouseout = () => {
      closeButton.style.transform = "translateY(0)";
      closeButton.style.boxShadow = "0 6px 20px rgba(52, 152, 219, 0.4)";
    };
    this.interactionSystem.buttonArea.appendChild(closeButton);
  }

  // Vender leche al alien
  sellMilkToAlien(liters, price) {
    if (!window.inventory) return;

    // Reducir leche del inventario
    if (typeof window.inventory.addMilk === "function") {
      window.inventory.addMilk(-liters); // Restar leche
    }

    // Añadir monedas al inventario
    if (typeof window.inventory.addCoins === "function") {
      window.inventory.addCoins(price);
    } else {
      // Fallback: modificar directamente el estado
      window.inventory.coins += price;
      window.inventory._updateUI();
    }

    // Crear animación de monedas
    this.createCoinAnimation(price);

    console.log(`Vendidos ${liters}L por ${price} monedas`);
  }

  // Crear animación de monedas
  createCoinAnimation(coinCount) {
    // Crear elementos de monedas animadas
    for (let i = 0; i < Math.min(coinCount, 10); i++) {
      setTimeout(() => {
        this.createSingleCoinAnimation();
      }, i * 100);
    }
  }

  // Crear animación de una sola moneda
  createSingleCoinAnimation() {
    const coin = document.createElement("div");
    coin.innerHTML = "🪙";
    coin.style.cssText = `
      position: fixed;
      font-size: 24px;
      z-index: 2000;
      pointer-events: none;
      transition: all 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    // Posición inicial (centro del diálogo)
    const hud = document.getElementById("alien2-dialogue-hud");
    if (hud) {
      const hudRect = hud.getBoundingClientRect();
      coin.style.left = hudRect.left + hudRect.width / 2 + "px";
      coin.style.top = hudRect.top + hudRect.height / 2 + "px";
    } else {
      coin.style.left = "50%";
      coin.style.top = "50%";
    }

    document.body.appendChild(coin);

    // Posición final (inventario)
    const inventory = document.getElementById("inventory-hud");
    if (inventory) {
      const invRect = inventory.getBoundingClientRect();
      const targetX = invRect.right - 30;
      const targetY = invRect.top + 30;

      // Animar hacia el inventario
      setTimeout(() => {
        coin.style.left = targetX + "px";
        coin.style.top = targetY + "px";
        coin.style.transform = "scale(0.5)";
        coin.style.opacity = "0.7";
      }, 50);
    }

    // Remover la moneda después de la animación
    setTimeout(() => {
      if (coin.parentNode) {
        coin.parentNode.removeChild(coin);
      }
    }, 1600);
  }

  // Cerrar diálogo
  closeDialogue() {
    if (
      this.interactionSystem.dialogueHud &&
      this.interactionSystem.isDialogueOpen
    ) {
      this.interactionSystem.dialogueHud.style.display = "none";
      this.interactionSystem.isDialogueOpen = false;
      this.interactionSystem.playerStayTime = 0; // Resetear tiempo
      console.log("Diálogo cerrado con Alien2");
    }
  }

  // Método de depuración para verificar el estado de las animaciones
  logAnimationState() {
    console.log("=== ESTADO DE ANIMACIONES ALIEN2 ===");
    console.log("Modelo cargado:", !!this.model);
    console.log("Mixer inicializado:", !!this.mixer);
    console.log("Animaciones cargadas:", Object.keys(this.animations));

    if (this.currentAction) {
      console.log(
        "Reproduciendo animación:",
        this.currentAction.getClip().name
      );
      console.log("Animación activa:", this.currentAction.isRunning());
      console.log(
        "Peso de la animación:",
        this.currentAction.getEffectiveWeight()
      );
    } else {
      console.log("No hay ninguna animación reproduciéndose actualmente");
    }

    // Verificar si el modelo tiene animaciones incluidas
    if (this.model && this.model.animations) {
      console.log(
        "Animaciones incluidas en el modelo:",
        this.model.animations.length
      );
      this.model.animations.forEach((anim, index) => {
        console.log(`  ${index}: ${anim.name} (${anim.duration}s)`);
      });
    }
    console.log("=====================================");
  }
}

// Hacer las funciones de depuración disponibles globalmente
window.debugAlien2 = function () {
  if (window.alien2) {
    window.alien2.logAnimationState();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.forceAlien2Animation = function () {
  if (window.alien2) {
    window.alien2.forceAnimation();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.checkAlien2Skeleton = function () {
  if (window.alien2) {
    window.alien2.checkSkeleton();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.startAlien2Movement = function () {
  if (window.alien2) {
    window.alien2.startMovementSequence();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.forceAlien2Movement = function () {
  if (window.alien2) {
    console.log("Forzando inicio inmediato del movimiento del Alien2...");
    window.alien2.activateMovementSystem();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.debugAlien2Movement = function () {
  if (window.alien2) {
    console.log("=== ESTADO DEL SISTEMA DE MOVIMIENTO ALIEN2 ===");
    console.log("Sistema activo:", window.alien2.movementSystem.isActive);
    console.log("Ruta actual:", window.alien2.movementSystem.currentPathIndex);
    console.log("Está moviéndose:", window.alien2.movementSystem.isMoving);
    console.log("Está girando:", window.alien2.movementSystem.isTurning);
    console.log("Posición actual:", window.alien2.model.position);
    console.log("Animaciones cargadas:", Object.keys(window.alien2.animations));

    // Verificar detalles de cada animación
    Object.keys(window.alien2.animations).forEach((animName) => {
      const anim = window.alien2.animations[animName];
      console.log(`  ${animName}:`, anim.name, `(${anim.duration}s)`);
    });

    // Verificar animación actual
    if (window.alien2.currentAction) {
      console.log(
        "Animación actual:",
        window.alien2.currentAction.getClip().name
      );
      console.log("¿Está corriendo?:", window.alien2.currentAction.isRunning());
    }

    console.log("================================================");
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.testAlien2Animations = function () {
  if (window.alien2) {
    console.log("=== PROBANDO ANIMACIONES DEL ALIEN2 ===");

    // Probar cada animación por separado
    const animations = ["idle", "walk", "turnRight"];

    animations.forEach((animName, index) => {
      setTimeout(() => {
        console.log(`🎬 Probando animación: ${animName}`);
        const success = window.alien2.playAnimation(animName);
        console.log(`Resultado: ${success ? "✅ Éxito" : "❌ Falló"}`);
      }, index * 2000); // 2 segundos entre cada prueba
    });

    console.log("Las animaciones se probarán en secuencia...");
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.debugAlien2Interaction = function () {
  if (window.alien2) {
    console.log("=== ESTADO DEL SISTEMA DE INTERACCIÓN ALIEN2 ===");
    console.log(
      "En posición final:",
      window.alien2.interactionSystem.isAtFinalPosition
    );
    console.log(
      "Jugador cerca:",
      window.alien2.interactionSystem.isPlayerNearby
    );
    console.log(
      "Tiempo de permanencia:",
      window.alien2.interactionSystem.playerStayTime.toFixed(2),
      "s"
    );
    console.log(
      "Tiempo requerido:",
      window.alien2.interactionSystem.requiredStayTime,
      "s"
    );
    console.log(
      "Diálogo abierto:",
      window.alien2.interactionSystem.isDialogueOpen
    );
    console.log(
      "Radio de colisión:",
      window.alien2.interactionSystem.collisionRadius
    );

    if (window.farmerController && window.farmerController.model) {
      const distance = window.alien2.model.position.distanceTo(
        window.farmerController.model.position
      );
      console.log("Distancia al jugador:", distance.toFixed(2));
    }

    console.log("================================================");
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.forceAlien2Interaction = function () {
  if (window.alien2) {
    console.log("Forzando activación del sistema de interacción...");
    window.alien2.activateInteractionSystem();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.testAlien2Dialogue = function () {
  if (window.alien2) {
    console.log("Probando diálogo del Alien2...");
    window.alien2.openDialogue();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.debugAlien2HUD = function () {
  console.log("=== DEBUGGING HUD DEL ALIEN2 ===");

  // Verificar si el HUD existe en el DOM
  const hud = document.getElementById("alien2-dialogue-hud");
  if (hud) {
    console.log("✅ HUD encontrado en DOM");
    console.log("Display:", hud.style.display);
    console.log("Visible:", hud.offsetWidth > 0 && hud.offsetHeight > 0);
    console.log("Z-index:", hud.style.zIndex);
    console.log("Position:", hud.style.position);
  } else {
    console.log("❌ HUD no encontrado en DOM");
  }

  // Verificar estado del sistema de interacción
  if (window.alien2) {
    console.log(
      "Sistema de interacción activo:",
      window.alien2.interactionSystem.isAtFinalPosition
    );
    console.log("HUD creado:", !!window.alien2.interactionSystem.dialogueHud);
    console.log(
      "Diálogo abierto:",
      window.alien2.interactionSystem.isDialogueOpen
    );
  }

  console.log("=================================");
};

window.forceAlien2HUD = function () {
  if (window.alien2) {
    console.log("Forzando creación y apertura del HUD...");

    // Crear HUD si no existe
    if (!window.alien2.interactionSystem.dialogueHud) {
      window.alien2.createDialogueHud();
    }

    // Abrir HUD
    window.alien2.openDialogue();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.forceAlien2Idle = function () {
  if (window.alien2) {
    console.log("Forzando cambio a animación idle...");

    // Desactivar sistema de movimiento
    window.alien2.movementSystem.isActive = false;
    window.alien2.movementSystem.isMoving = false;
    window.alien2.movementSystem.isTurning = false;

    // Forzar cambio a idle
    const success = window.alien2.playAnimation("idle");
    console.log("Resultado:", success ? "✅ Éxito" : "❌ Falló");

    // Activar sistema de interacción si no está activo
    if (!window.alien2.interactionSystem.isAtFinalPosition) {
      window.alien2.activateInteractionSystem();
    }
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};
