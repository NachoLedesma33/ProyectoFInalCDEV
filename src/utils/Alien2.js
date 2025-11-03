import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { safePlaySfx } from './audioHelpers.js';
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

    // Schedule for random laugh SFX (timestamp in ms)
    this._nextLaughAt = 0;
  }

  async load() {
    try {
      const alien2Config = modelConfig.characters.alien2;

      // Cargar el modelo base (sin animaciones)
      const modelPath = modelConfig.getPath(alien2Config.model);

      // Cargar modelo base como promesa
      this.model = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          modelPath,
          (fbx) => {
            resolve(fbx);
          },
          undefined,
          (error) => {
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

      // Cargar animación idle
      const idleLoaded = await this.loadAnimation("idle", idlePath);

      // Cargar animación de caminar
      const walkLoaded = await this.loadAnimation("walk", walkPath);

      // Cargar animación de giro
      const turnRightLoaded = await this.loadAnimation(
        "turnRight",
        turnRightPath
      );

      // Reproducir animación idle inicialmente
      setTimeout(() => {
        this.playAnimation("idle");
      }, 100);

      // Verificar si el modelo base tiene animaciones incluidas
      if (this.model.animations && this.model.animations.length > 0) {


        // Si hay animaciones en el modelo base, usar la primera como idle
        const baseIdleClip = this.model.animations[0];
        this.animations.baseIdle = baseIdleClip;

        // Intentar reproducir la animación del modelo base si la externa falla
        setTimeout(() => {
          if (!this.currentAction || !this.currentAction.isRunning()) {
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
      return true;
    } catch (error) {  
      return error;
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
              return error;
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

      const anim = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          path,
          (fbx) => {
            if (fbx.animations.length > 0) {
              const animation = fbx.animations[0];
              resolve(animation);
            } else {
              reject(new Error(`No se encontraron animaciones en ${path}`));
            }
          },
          (error) => {
            reject(error);
          }
        );
      });

      this.animations[name] = anim;
      return true;
    } catch (error) {
      return error;
    }
  }

  playAnimation(name) {
    if (!this.animations[name] || !this.mixer) {
      return false;
    }

    // Verificar si ya está reproduciendo la misma animación
    const isSameAnimation =
      this.currentAction &&
      this.currentAction.getClip()?.name === this.animations[name].name &&
      this.currentAction.isRunning();

    if (isSameAnimation) {
      return true;
    }

    try {

      // Detener animación actual con fade out suave
      if (this.currentAction) {
        this.currentAction.fadeOut(0.1);
        this.currentAction.stop();
      }

      // Crear y configurar la nueva acción
      const clip = this.animations[name];
      const action = this.mixer.clipAction(clip);

      if (!action) {
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

      // Forzar la actualización del mixer para aplicar la animación inmediatamente
      if (this.mixer) {
        this.mixer.update(0.016); // Actualizar con un delta pequeño
      }

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

    // Random positional laugh occasionally when idle/interaction active
    try {
      // only attempt if model is loaded and helper exists
      if (this.model && typeof safePlaySfx === 'function') {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (!this._nextLaughAt || now >= this._nextLaughAt) {
          // Chance to laugh each attempt (12% per attempt)
          if (Math.random() < 0.12) {
            try {
              // debug trace to help confirm behaviour during testing
              try { console.debug && console.debug('Alien2: attempting alienLaugh'); } catch (_) {}
              safePlaySfx('alienLaugh', { object3D: this.model, volume: 0.95 });
            } catch (_) {}
          }
          // schedule next attempt in 15-90s
          this._nextLaughAt = now + (15000 + Math.floor(Math.random() * 75000));
        }
      }
    } catch (e) {}
  }

  // Iniciar el sistema de movimiento automático después de 5 minutos
  startMovementSequence() {
    // Auto-movimiento deshabilitado para evitar que el alien se vaya del mercado.
    // Antes esta función programaba un setTimeout de 5 minutos que llamaba a
    // activateMovementSystem(). Lo dejamos como no-op para que el Alien2
    // permanezca en el mercado.
    // Si existiera un timer previo, limpiarlo para evitar ejecuciones pendientes.
    if (this.movementSystem.timer) {
      clearTimeout(this.movementSystem.timer);
      this.movementSystem.timer = null;
    }
    return;
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
    // Iniciar el primer movimiento
    this.startNextPath();
  }

  // Iniciar el siguiente segmento de la ruta
  startNextPath() {
    if (
      this.movementSystem.currentPathIndex >= this.movementSystem.paths.length
    ) {
      // Activar sistema de interacción (esto incluye el cambio a idle)
      this.activateInteractionSystem();
      return;
    }

    const currentPath =
      this.movementSystem.paths[this.movementSystem.currentPathIndex];

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

    this.playAnimation(path.animation);
  }

  // Iniciar giro
  startTurn(path) {
    this.movementSystem.isTurning = true;

    // Calcular la rotación objetivo
    const currentRotation = this.model.rotation.y;
    const targetRotation = currentRotation + path.rotation;

    this.movementSystem.targetRotation = targetRotation;
    this.movementSystem.startRotation = currentRotation;
    this.playAnimation(path.animation);
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
      this.currentAction.reset();
      this.currentAction.play();
      this.mixer.update(0.1);
    }
  }

  // Método para verificar el esqueleto del modelo
  checkSkeleton() {
    if (!this.model) {
      return;
    }
    let skeletonFound = false;

    this.model.traverse((child) => {
      if (child.isBone || child.type === "Bone") {
        skeletonFound = true;
      }
    });

    return skeletonFound;
  }

  // Forzar cambio a animación idle (método interno)
  forceIdleAnimation() {

    // Desactivar completamente el sistema de movimiento
    this.movementSystem.isActive = false;
    this.movementSystem.isMoving = false;
    this.movementSystem.isTurning = false;

    // Detener cualquier animación actual
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
    const success = this.playAnimation("idle");

    return success;
  }

  // Activar sistema de interacción cuando llega a la posición final
  activateInteractionSystem() {
    this.interactionSystem.isAtFinalPosition = true;
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

  // play popup sound when alien dialogue HUD is created
  try { safePlaySfx('popup', { volume: 0.9 }); } catch (_) {}

    this.interactionSystem.dialogueHud = hudContainer;
    this.interactionSystem.buttonArea = buttonArea;
    this.interactionSystem.dialogueArea = dialogueArea;
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
    if (this.interactionSystem.isPlayerNearby !== wasPlayerNearby) { }
  }

  // Abrir diálogo. Acepta un callback opcional que se ejecuta al cerrarse el diálogo.
  openDialogue(onClose, opts = {}) {
    // Guardar callback opcional para ejecutar cuando se cierre el diálogo
    this._onDialogueClose = typeof onClose === 'function' ? onClose : null;

    if (
      this.interactionSystem.dialogueHud &&
      !this.interactionSystem.isDialogueOpen
    ) {
      this.interactionSystem.dialogueHud.style.display = "block";
      this.interactionSystem.isDialogueOpen = true;

  // play popup sound when dialogue is shown
  try { safePlaySfx('popup', { volume: 0.9 }); } catch (_) {}

      // Mostrar el diálogo inicial a menos que opts.skipInitial sea true
      if (!opts || !opts.skipInitial) {
        this.showInitialDialogue();
      }
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

  // Animar la reducción de leche en el contador
  animateMilkReduction(liters) {
    if (!window.inventory || !window.inventory.milkElement) return;

    const milkElement = window.inventory.milkElement;
    const startValue = parseFloat(milkElement.textContent);
    const endValue = Math.max(0, startValue - liters);
    const duration = 1000; // 1 segundo de animación
    const startTime = performance.now();

    // Función de animación
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Interpolación suave
      const currentValue = startValue - (startValue - endValue) * progress;
      milkElement.textContent = currentValue.toFixed(1);

      // Continuar la animación si no ha terminado
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Asegurarse de que el valor final sea exacto
        milkElement.textContent = endValue.toFixed(1);
        // Actualizar el valor real en el inventario
        if (window.inventory.milk !== undefined) {
          window.inventory.milk = endValue;
        }
      }
    };

    // Iniciar la animación
    requestAnimationFrame(animate);
  }

  // Vender leche al alien
  sellMilkToAlien(liters, price) {
    if (!window.inventory) {;
      return;
    }

    // Obtener la cantidad actual de leche
    const currentMilk = this.getMilkAmount();

    // Verificar que haya suficiente leche
    if (currentMilk < liters) {
      return;
    }

    // Actualizar la cantidad de leche en el inventario
    if (window.inventory.milkLiters !== undefined) {
      // Restar la leche directamente
      window.inventory.milkLiters = Math.max(
        0,
        window.inventory.milkLiters - liters
      );

      // Forzar la actualización de la UI
      if (window.inventory._updateUI) {
        window.inventory._updateUI();
      }

      // Mostrar notificación de venta
      if (window.inventory._flash) {
        window.inventory._flash(
          `Vendiste ${liters.toFixed(1)}L por ${price} monedas`
        );
      }
    } else {
      return;
    }

    // Añadir monedas al inventario
    if (typeof window.inventory.addCoins === "function") {
      window.inventory.addCoins(price);
    } else if (window.inventory.coins !== undefined) {
      window.inventory.coins += price;
      if (window.inventory._updateUI) {
        window.inventory._updateUI();
      }
    }

    // Crear animación de monedas
    this.createCoinAnimation(price);

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

      // Ejecutar callback opcional registrado en openDialogue()
      try {
        if (this._onDialogueClose && typeof this._onDialogueClose === 'function') {
          this._onDialogueClose();
        }
      } catch (err) {
        console.warn('Error ejecutando onDialogueClose callback:', err);
      }

      // Limpiar el callback para evitar llamadas repetidas
      this._onDialogueClose = null;
    }
  }

  
}

// Hacer las funciones de depuración disponibles globalmente
window.debugAlien2 = function () {
  if (window.alien2) {
    window.alien2.logAnimationState();
  }
};

window.forceAlien2Animation = function () {
  if (window.alien2) {
    window.alien2.forceAnimation();
  }
};

window.checkAlien2Skeleton = function () {
  if (window.alien2) {
    window.alien2.checkSkeleton();
  }
};

window.startAlien2Movement = function () {
  if (window.alien2) {
    window.alien2.startMovementSequence();
  }
};

window.forceAlien2Movement = function () {
  if (window.alien2) {
    window.alien2.activateMovementSystem();
  }
};

window.debugAlien2Movement = function () {
  if (window.alien2) {
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
  };

  window.testAlien2Animations = function () {
    if (window.alien2) {

      // Probar cada animación por separado
      const animations = ["idle", "walk", "turnRight"];

      animations.forEach((animName, index) => {
        setTimeout(() => {
          const success = window.alien2.playAnimation(animName);
        }, index * 2000); // 2 segundos entre cada prueba
      });
    }
  };

  window.debugAlien2Interaction = function () {
    if (window.alien2) {
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
    }
  };

  window.forceAlien2Interaction = function () {
    if (window.alien2) {
      window.alien2.activateInteractionSystem();
    }
  };

  window.testAlien2Dialogue = function () {
    if (window.alien2) {
      window.alien2.openDialogue();
  
    };

    window.debugAlien2HUD = function () {
      // Verificar si el HUD existe en el DOM
      const hud = document.getElementById("alien2-dialogue-hud");
      if (hud) {
        console.log("✅ HUD encontrado en DOM");
        console.log("Display:", hud.style.display);
        console.log("Visible:", hud.offsetWidth > 0 && hud.offsetHeight > 0);
        console.log("Z-index:", hud.style.zIndex);
        console.log("Position:", hud.style.position);
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
    };

    window.forceAlien2HUD = function () {
      if (window.alien2) {

        // Crear HUD si no existe
        if (!window.alien2.interactionSystem.dialogueHud) {
          window.alien2.createDialogueHud();
        }
        // Abrir HUD
        window.alien2.openDialogue();
      }
    };

    window.forceAlien2Idle = function () {
      if (window.alien2) {

        // Desactivar sistema de movimiento
        window.alien2.movementSystem.isActive = false;
        window.alien2.movementSystem.isMoving = false;
        window.alien2.movementSystem.isTurning = false;

        // Forzar cambio a idle
        const success = window.alien2.playAnimation("idle");

        // Activar sistema de interacción si no está activo
        if (!window.alien2.interactionSystem.isAtFinalPosition) {
          window.alien2.activateInteractionSystem();
        }
      }
    };
  }
}
