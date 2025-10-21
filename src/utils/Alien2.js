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

    this.movementSystem = {
      isActive: false,
      currentPathIndex: 0,
      isMoving: false,
      isTurning: false,
      moveSpeed: 0.05,
      turnSpeed: 0.02,
      paths: [
        {
          start: { x: -52.5, y: 0.0, z: -159.7 },
          end: { x: -81.6, y: 0.0, z: -90.0 },
          animation: "walk",
        },
        {
          start: { x: -81.6, y: 0.0, z: -90.0 },
          end: { x: -81.6, y: 0.0, z: -90.0 },
          animation: "turnRight",
          rotation: Math.PI / 2,
          isTurn: true,
        },
        {
          start: { x: -81.6, y: 0.0, z: -90.0 },
          end: { x: -17.8, y: 0.0, z: -45.4 },
          animation: "walk",
        },
      ],
      timer: null,
    };

    this.interactionSystem = {
      isAtFinalPosition: false,
      exclamationMark: null,
      collisionRadius: 2.0,
      isPlayerNearby: false,
      playerStayTime: 0,
      requiredStayTime: 2.0,
      dialogueHud: null,
      isDialogueOpen: false,
    };
  }

  async load() {
    try {
      const alien2Config = modelConfig.characters.alien2;
      const modelPath = modelConfig.getPath(alien2Config.model);

      this.model = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          modelPath,
          (fbx) => resolve(fbx),
          undefined,
          (error) => reject(error)
        );
      });

      this.model.scale.set(0.02, 0.02, 0.02);
      this.model.position.copy(this.position);
      this.mixer = new THREE.AnimationMixer(this.model);

      const idlePath = modelConfig.getPath(alien2Config.animations.idle);
      const walkPath = modelConfig.getPath(alien2Config.animations.walk);
      const turnRightPath = modelConfig.getPath(
        alien2Config.animations.turnRight
      );

      await this.loadAnimation("idle", idlePath);
      await this.loadAnimation("walk", walkPath);
      await this.loadAnimation("turnRight", turnRightPath);

      setTimeout(() => {
        this.playAnimation("idle");
      }, 100);

      if (this.model.animations && this.model.animations.length > 0) {
        const baseIdleClip = this.model.animations[0];
        this.animations.baseIdle = baseIdleClip;

        setTimeout(() => {
          if (!this.currentAction || !this.currentAction.isRunning()) {
            this.playAnimation("baseIdle");
          }
        }, 500);
      }

      const targetPosition = new THREE.Vector3(
        this.lookAt.x,
        this.model.position.y,
        this.lookAt.z
      );
      this.model.lookAt(targetPosition);

      this.optimizeForPerformance();
      this.scene.add(this.model);

      return true;
    } catch (error) {
      console.error("Error al cargar el Alien2:", error);
      return false;
    }
  }

  optimizeForPerformance() {
    if (!this.model) return;

    this.model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.computeVertexNormals();
          child.castShadow = true;
          child.receiveShadow = true;

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
              child.geometry.dispose();
              child.geometry = simplifiedGeometry;
            } catch (error) {}
          }
        }

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
    material.precision = "mediump";
    material.shininess = 0;
    material.roughness = 1;
    material.metalness = 0;

    if (material.map) material.map.anisotropy = 1;
    if (material.normalMap) material.normalScale.set(0.5, 0.5);
    if (material.bumpMap) material.bumpScale = 0.5;

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
              resolve(fbx.animations[0]);
            } else {
              reject(new Error(`No se encontraron animaciones en ${path}`));
            }
          },
          undefined,
          (error) => reject(error)
        );
      });

      this.animations[name] = anim;
      return true;
    } catch (error) {
      return false;
    }
  }

  playAnimation(name) {
    if (!this.animations[name] || !this.mixer) {
      return false;
    }

    const isSameAnimation =
      this.currentAction &&
      this.currentAction.getClip()?.name === this.animations[name].name &&
      this.currentAction.isRunning();

    if (isSameAnimation) {
      return true;
    }

    try {
      if (this.currentAction) {
        this.currentAction.fadeOut(0.1);
        this.currentAction.stop();
      }

      const clip = this.animations[name];
      const action = this.mixer.clipAction(clip);

      if (!action) {
        return false;
      }

      action
        .reset()
        .setEffectiveTimeScale(1.0)
        .setEffectiveWeight(1.0)
        .setLoop(THREE.LoopRepeat, Infinity)
        .fadeIn(0.1)
        .play();

      this.currentAction = action;

      if (this.mixer) {
        this.mixer.update(0.016);
      }

      setTimeout(() => {
        if (this.currentAction && !this.currentAction.isRunning()) {
          if (this.currentAction) {
            this.currentAction.reset().play();
          }
        }
      }, 200);

      return true;
    } catch (error) {
      return false;
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    if (this.movementSystem.isActive) {
      this.updateMovement(delta);
    }

    if (this.interactionSystem.isAtFinalPosition) {
      this.updateInteraction(delta);
    }
  }

  startMovementSequence() {
    this.movementSystem.timer = setTimeout(() => {
      this.activateMovementSystem();
    }, 5 * 60 * 1000);
  }

  activateMovementSystem() {
    this.movementSystem.isActive = true;
    this.movementSystem.currentPathIndex = 0;

    const firstPath = this.movementSystem.paths[0];
    this.model.position.set(
      firstPath.start.x,
      firstPath.start.y,
      firstPath.start.z
    );

    this.startNextPath();
  }

  startNextPath() {
    if (
      this.movementSystem.currentPathIndex >= this.movementSystem.paths.length
    ) {
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

  startMovement(path) {
    this.movementSystem.isMoving = true;

    const direction = new THREE.Vector3(
      path.end.x - path.start.x,
      path.end.y - path.start.y,
      path.end.z - path.start.z
    ).normalize();

    const lookAtPoint = new THREE.Vector3(
      this.model.position.x + direction.x,
      this.model.position.y,
      this.model.position.z + direction.z
    );
    this.model.lookAt(lookAtPoint);

    this.playAnimation(path.animation);
  }

  startTurn(path) {
    this.movementSystem.isTurning = true;

    const currentRotation = this.model.rotation.y;
    const targetRotation = currentRotation + path.rotation;

    this.movementSystem.targetRotation = targetRotation;
    this.movementSystem.startRotation = currentRotation;

    this.playAnimation(path.animation);
  }

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

  updateMovementToTarget(path, delta) {
    const currentPos = this.model.position;
    const targetPos = new THREE.Vector3(path.end.x, path.end.y, path.end.z);

    const distance = currentPos.distanceTo(targetPos);

    if (distance < 0.1) {
      this.model.position.copy(targetPos);
      this.movementSystem.isMoving = false;
      this.movementSystem.currentPathIndex++;

      setTimeout(() => {
        this.startNextPath();
      }, 500);
    } else {
      const direction = new THREE.Vector3()
        .subVectors(targetPos, currentPos)
        .normalize();

      const moveDistance = this.movementSystem.moveSpeed * delta * 60;
      this.model.position.add(direction.multiplyScalar(moveDistance));
    }
  }

  updateTurn(delta) {
    const currentRotation = this.model.rotation.y;
    const targetRotation = this.movementSystem.targetRotation;

    let rotationDiff = targetRotation - currentRotation;

    while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
    while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

    if (Math.abs(rotationDiff) < 0.01) {
      this.model.rotation.y = targetRotation;
      this.movementSystem.isTurning = false;
      this.movementSystem.currentPathIndex++;

      setTimeout(() => {
        this.startNextPath();
      }, 500);
    } else {
      const turnAmount =
        Math.sign(rotationDiff) * this.movementSystem.turnSpeed * delta * 60;
      this.model.rotation.y += turnAmount;
    }
  }

  forceIdleAnimation() {
    this.movementSystem.isActive = false;
    this.movementSystem.isMoving = false;
    this.movementSystem.isTurning = false;

    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }

    const success = this.playAnimation("idle");
    return success;
  }

  activateInteractionSystem() {
    this.interactionSystem.isAtFinalPosition = true;
    this.forceIdleAnimation();
    this.createExclamationMark();
    this.createBlinkingCircle();
    this.createDialogueHud();
  }

  createExclamationMark() {
    if (!this.model) return;

    const geometry = new THREE.ConeGeometry(0.3, 1.0, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
    });

    this.interactionSystem.exclamationMark = new THREE.Mesh(geometry, material);
    this.interactionSystem.exclamationMark.position.set(0, 3.0, 0);
    this.interactionSystem.exclamationMark.rotation.z = Math.PI;

    this.model.add(this.interactionSystem.exclamationMark);
    this.animateExclamationMark();
  }

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
    this.animateBlinkingCircle();

    setTimeout(() => {
      this.forceIdleAnimation();
    }, 100);
  }

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

  createDialogueHud() {
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

    const mainContainer = document.createElement("div");
    mainContainer.style.cssText = `
      display: flex;
      height: calc(100% - 70px);
    `;
    hudContainer.appendChild(mainContainer);

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

    const rightPanel = document.createElement("div");
    rightPanel.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 30px;
    `;
    mainContainer.appendChild(rightPanel);

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

    document.body.appendChild(hudContainer);

    this.interactionSystem.dialogueHud = hudContainer;
    this.interactionSystem.buttonArea = buttonArea;
    this.interactionSystem.dialogueArea = dialogueArea;
  }

  updateInteraction(delta) {
    this.checkPlayerCollision();

    if (this.interactionSystem.isPlayerNearby) {
      this.interactionSystem.playerStayTime += delta;

      if (
        this.interactionSystem.playerStayTime >=
          this.interactionSystem.requiredStayTime &&
        !this.interactionSystem.isDialogueOpen
      ) {
        this.openDialogue();
      }
    } else {
      this.interactionSystem.playerStayTime = 0;
    }
  }

  checkPlayerCollision() {
    if (this.interactionSystem.isDialogueOpen) return;

    if (!this.interactionSystem.blinkingCircle || !window.farmerController)
      return;

    const circlePos = this.interactionSystem.blinkingCircle.position;
    const playerPos = window.farmerController.model.position;
    const distance = circlePos.distanceTo(playerPos);

    this.interactionSystem.isPlayerNearby =
      distance <= this.interactionSystem.collisionRadius;
  }

  openDialogue() {
    if (
      this.interactionSystem.dialogueHud &&
      !this.interactionSystem.isDialogueOpen
    ) {
      this.interactionSystem.dialogueHud.style.display = "block";
      this.interactionSystem.isDialogueOpen = true;
      this.showInitialDialogue();
    }
  }

  showInitialDialogue() {
    if (
      !this.interactionSystem.dialogueArea ||
      !this.interactionSystem.buttonArea
    )
      return;

    this.interactionSystem.dialogueArea.innerHTML =
      '<div style="text-align: center; margin-bottom: 15px; color: #2ecc71; font-size: 22px;">👽 ALIEN COMERCIANTE 👽</div>' +
      '<div style="text-align: center; font-size: 20px; line-height: 1.5;">Hola humano, ¿tienes leche de tus vacas para vender?</div>';

    this.interactionSystem.buttonArea.innerHTML = "";

    const milkAmount = this.getMilkAmount();

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

  getMilkAmount() {
    if (window.inventory && typeof window.inventory.getState === "function") {
      const state = window.inventory.getState();
      return state.milkLiters || 0;
    }
    return 0;
  }

  handleNoMilkResponse() {
    if (!this.interactionSystem.dialogueArea) return;

    this.interactionSystem.dialogueArea.innerHTML =
      '<div style="text-align: center; color: #e74c3c; font-size: 22px;">⚠️</div>' +
      '<div style="text-align: center; font-size: 20px; line-height: 1.5;">Vuelve cuando tengas leche, humano</div>';

    this.interactionSystem.buttonArea.innerHTML = "";

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

  handleYesMilkResponse() {
    if (
      !this.interactionSystem.dialogueArea ||
      !this.interactionSystem.buttonArea
    )
      return;

    this.interactionSystem.dialogueArea.innerHTML =
      "Excelente! ¿Cuántos litros quieres vender?";

    this.interactionSystem.buttonArea.innerHTML = "";

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

  handleSellMilk(liters, price) {
    if (!window.inventory) {
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

    this.sellMilkToAlien(liters, price);

    this.interactionSystem.dialogueArea.innerHTML = `<div style="text-align: center; color: #2ecc71; font-size: 22px;">🎉</div>
       <div style="text-align: center; font-size: 20px; line-height: 1.5;">
         ¡Perfecto! Vendiste ${liters}L por ${price} monedas de oro.<br>
         ¡Gracias humano!
       </div>`;

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

  sellMilkToAlien(liters, price) {
    if (!window.inventory) {
      return;
    }

    const currentMilk = this.getMilkAmount();
    
    if (currentMilk < liters) {
      return;
    }

    if (window.inventory.milkLiters !== undefined) {
      window.inventory.milkLiters = Math.max(0, window.inventory.milkLiters - liters);
      
      if (window.inventory._updateUI) {
        window.inventory._updateUI();
      }
      
      if (window.inventory._flash) {
        window.inventory._flash(`Vendiste ${liters.toFixed(1)}L por ${price} monedas`);
      }
    } else {
      return;
    }

    if (typeof window.inventory.addCoins === "function") {
      window.inventory.addCoins(price);
    } else if (window.inventory.coins !== undefined) {
      window.inventory.coins += price;
      if (window.inventory._updateUI) {
        window.inventory._updateUI();
      }
    }

    this.createCoinAnimation(price);
  }

  createCoinAnimation(coinCount) {
    for (let i = 0; i < Math.min(coinCount, 10); i++) {
      setTimeout(() => {
        this.createSingleCoinAnimation();
      }, i * 100);
    }
  }

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

    const inventory = document.getElementById("inventory-hud");
    if (inventory) {
      const invRect = inventory.getBoundingClientRect();
      const targetX = invRect.right - 30;
      const targetY = invRect.top + 30;

      setTimeout(() => {
        coin.style.left = targetX + "px";
        coin.style.top = targetY + "px";
        coin.style.transform = "scale(0.5)";
        coin.style.opacity = "0.7";
      }, 50);
    }

    setTimeout(() => {
      if (coin.parentNode) {
        coin.parentNode.removeChild(coin);
      }
    }, 1600);
  }

  closeDialogue() {
    if (
      this.interactionSystem.dialogueHud &&
      this.interactionSystem.isDialogueOpen
    ) {
      this.interactionSystem.dialogueHud.style.display = "none";
      this.interactionSystem.isDialogueOpen = false;
      this.interactionSystem.playerStayTime = 0;
    }
  }
}