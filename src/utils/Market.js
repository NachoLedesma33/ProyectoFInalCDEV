import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { playSfxWhenReady, safePlaySfx } from "./audioHelpers.js";

export class Market {
  constructor(
    scene,
    position = { x: -155.8, y: 0.0, z: 53.3 },
    size = { width: 18, height: 20, depth: 14 }
  ) {
    this.scene = scene;
    this.position = position;
    this.size = size;
    this.walls = [];
    this.collisionBoxes = [];
    this.isPlayerNearby = false;
    this.isUIOpen = false;
    this.radius = 1.5;
    this.marketItems = [
      {
        id: 1,
        name: "Núcleo de Fusión",
        description:
          "Alimenta el motor principal del transbordador con energía cuántica estable",
        image: "../assets/Núcleo de Fusión.png",
        price: 25,
        owned: false,
      },
      {
        id: 2,
        name: "Membrana de Vacío",
        description:
          "Un panel flexible que se usa para sellar grietas en el casco",
        image: "../assets/Membrana de Vacío.png",
        price: 20,
        owned: false,
      },
      {
        id: 3,
        name: "Chip de Navegación",
        description:
          "Un microprocesador que predice rutas seguras a través del espacio",
        image: "../assets/Chip de Navegación.png",
        price: 30,
        owned: false,
      },
      {
        id: 4,
        name: "Catalizador de Plasma",
        description:
          "Cristal que contiene una sustancia incandescente que reacciona a la electricidad",
        image: "../assets/Catalizador de Plasma.png",
        price: 40,
        owned: false,
      },
      {
        id: 5,
        name: "Llave Multipropósito",
        description:
          "Herramienta avanzada que permite manipular la masa de los objetos",
        image: "../assets/Llave de Ajuste multiproposito.png",
        price: 25,
        owned: false,
      },
      {
        id: 6,
        name: "Cristal de Poder",
        description: "Potencia el motor para volver a casa",
        image: "../assets/Fragmento de Cristal.png",
        price: 10,
        owned: false,
      },
    ];

    this.createMarket();
    this.createInteractionArea();
    this.createCounter();
    this.door = null;
    this.doorPivot = null;
    this.doorOpen = false;
    this.doorOpenProgress = 0;
    this._lastUpdateTime = Date.now();
    this.doorOpenDistance = 3.5;
    this._lastDoorShouldOpen = false;
    this.allowEntry = true;
    this.roofMeshes = [];
    this.isPlayerInside = false;
    this._resolveMarketImage = (p) => {
      try {
        const fname = (p || '').split('/').pop();
        return `/src/assets/${encodeURIComponent(fname || '')}`;
      } catch (_) {
        return p;
      }
    };
    this._getEmojiForItem = (name) => {
      const n = (name || '').toLowerCase();
      if (n.includes('núcleo')) return '⚛️';
      if (n.includes('membrana')) return '🧪';
      if (n.includes('chip')) return '📟';
      if (n.includes('plasma')) return '🔬';
      if (n.includes('llave')) return '🛠️';
      if (n.includes('cristal')) return '🔮';
      return name ? name.charAt(0) : '?';
    };
  }

  createMarket() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;
    this.marketGroup = new THREE.Group();
    this.marketGroup.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );

    const targetPosition = new THREE.Vector3(-140.1, 0.0, 66.4);
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, this.marketGroup.position).normalize();
    this.marketGroup.rotation.y = Math.atan2(direction.x, direction.z);

    this.scene.add(this.marketGroup);

    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/coral_gravel/coral_gravel_diff_4k.jpg",
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        const stoneMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        const roofMaterial = new THREE.MeshStandardMaterial({
          map: texture.clone(),
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        const windowMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x333333,
          metalness: 0.8,
          roughness: 0.1,
          transparent: true,
          opacity: 0.7,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          ior: 1.5,
          transmission: 0.5,
        });

        this.createWalls(stoneMaterial, windowMaterial);
        this.createRoof(roofMaterial);
        this.createAlienSign(width, height, depth, stoneMaterial);
      },
      undefined,
      (error) => {
        const basicMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
        this.createWalls(basicMaterial, basicMaterial);
        this.createRoof(basicMaterial);
      }
    );
  }

  createWalls(stoneMaterial, windowMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;
    const doorWidth = Math.min(3, width * 0.33);
    const sideWidth = (width - doorWidth) / 2;
    const frontLeft = new THREE.Mesh(
      new THREE.BoxGeometry(sideWidth, height, wallThickness),
      stoneMaterial
    );
    frontLeft.position.set(-((width - sideWidth) / 2), height / 2, depth / 2);
    this.marketGroup.add(frontLeft);
    this.walls.push(frontLeft);
    const frontRight = new THREE.Mesh(
      new THREE.BoxGeometry(sideWidth, height, wallThickness),
      stoneMaterial
    );
    frontRight.position.set((width - sideWidth) / 2, height / 2, depth / 2);
    this.marketGroup.add(frontRight);
    this.walls.push(frontRight);
    const doorHeight = height * 0.5;
    const doorThickness = 0.05;
    this.doorPivot = new THREE.Object3D();
    this.doorPivot.position.set(
      -doorWidth / 2,
      doorHeight / 2,
      depth / 2 + 0.01
    );
    this.marketGroup.add(this.doorPivot);

    const doorGeometry = new THREE.BoxGeometry(
      doorWidth,
      doorHeight,
      doorThickness
    );
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.2,
      roughness: 0.6,
    });
    this.door = new THREE.Mesh(doorGeometry, doorMaterial);
    this.door.position.set(doorWidth / 2, 0, 0);
    this.door.castShadow = true;
    this.door.receiveShadow = true;
    this.doorPivot.add(this.door);
    this.doorWidth = doorWidth;
    this.doorHeight = doorHeight;
    const handleGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
    const handle = new THREE.Mesh(
      handleGeo,
      new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    const handleOffsetX = Math.max(doorWidth / 2 - 0.25, 0.3);
    handle.position.set(handleOffsetX, 0, doorThickness / 2 + 0.02);
    this.door.add(handle);
    const topHeight = height - doorHeight;
    if (topHeight > 0.01) {
      const frontTop = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, topHeight, wallThickness),
        stoneMaterial
      );
      const frontTopY = doorHeight + topHeight / 2;
      frontTop.position.set(0, frontTopY, depth / 2);
      this.marketGroup.add(frontTop);
      this.walls.push(frontTop);
    }
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      stoneMaterial
    );
    backWall.position.set(0, height / 2, -depth / 2);
    this.marketGroup.add(backWall);
    this.walls.push(backWall);
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      stoneMaterial
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    this.marketGroup.add(leftWall);
    this.walls.push(leftWall);
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      stoneMaterial
    );
    rightWall.position.set(width / 2, height / 2, 0);
    this.marketGroup.add(rightWall);
    this.walls.push(rightWall);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.1, depth),
      stoneMaterial
    );
    floor.position.set(0, -0.05, 0);
    this.marketGroup.add(floor);
  }

  createRoof(material) {
    const { width, height, depth } = this.size;
    const roofThickness = 0.5;
    const overhang = 1;

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(
        width + overhang * 2,
        roofThickness,
        depth + overhang * 2
      ),
      material
    );
    roof.position.set(0, height, 0);
    this.marketGroup.add(roof);
    this.roofMeshes.push(roof);
    return roof;
  }
  createAlienSign(width, height, depth, material) {
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 2, 8),
      material
    );
    signPost.position.set(0, height + 1, depth / 2 + 0.2);
    this.marketGroup.add(signPost);

    const signWidth = 5;
    const signHeight = 2;
    const signGeometry = new THREE.BoxGeometry(signWidth, signHeight, 0.2);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.3,
      roughness: 0.7,
    });

    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, height + 2.5, depth / 2 + 0.3);
    this.marketGroup.add(sign);

    this.createSignText("MERCADO", sign.position);
  }

  createSignText(text, position) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 256;

    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "Bold 100px Arial";
    context.fillStyle = "#00ff00";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -4;
    const textGeometry = new THREE.PlaneGeometry(4, 1.5);
    const textMesh = new THREE.Mesh(textGeometry, material);
    textMesh.position.set(position.x, position.y, position.z + 0.5);
    textMesh.renderOrder = 9999;
    this.marketGroup.add(textMesh);
  }
  createInteractionArea() {
    const geometry = new THREE.CircleGeometry(this.radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    this.interactionCircle = new THREE.Mesh(geometry, material);
    this.interactionCircle.rotation.x = -Math.PI / 2;
    const { depth } = this.size;
    const insideLocalZ = depth / 2 - 2;
    this.interactionCircle.position.set(0, 0.1, insideLocalZ);
    if (this.marketGroup) {
      this.marketGroup.add(this.interactionCircle);
    } else {
      this.scene.add(this.interactionCircle);
    }
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00aa00,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    });
    const circle = new THREE.LineSegments(edges, lineMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.copy(this.interactionCircle.position);
    circle.position.y = 0.11;
    if (this.marketGroup) {
      this.marketGroup.add(circle);
    } else {
      this.scene.add(circle);
    }
  }
  createCounter() {
    if (!this.marketGroup) return;
    const { width, depth } = this.size;
    const counterWidth = Math.min(6, width * 0.5);
    const counterHeight = 1.0;
    const counterDepth = 1.2;

    const geometry = new THREE.BoxGeometry(
      counterWidth,
      counterHeight,
      counterDepth
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.05,
      roughness: 0.9,
    });

    const counter = new THREE.Mesh(geometry, material);
    counter.castShadow = true;
    counter.receiveShadow = true;
    const circleLocalZ = this.interactionCircle
      ? this.interactionCircle.position.z
      : depth / 2 - 2;
    const behindOffset = 2.2;
    const localZ = circleLocalZ - behindOffset;
    counter.position.set(0, counterHeight / 2, localZ);
    const slabGeo = new THREE.BoxGeometry(
      counterWidth * 0.98,
      0.08,
      counterDepth * 0.98
    );
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x4f4f4f,
      metalness: 0.1,
      roughness: 0.7,
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, counterHeight / 2 + 0.04, 0);
    counter.add(slab);
    const regWidth = counterWidth * 0.25;
    const regDepth = counterDepth * 0.5;
    const regHeight = 0.4;

    const regBaseGeo = new THREE.BoxGeometry(regWidth, regHeight, regDepth);
    const regBaseMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.5,
    });
    const regBase = new THREE.Mesh(regBaseGeo, regBaseMat);
    regBase.castShadow = true;
    regBase.receiveShadow = true;

    // screen
    const screenGeo = new THREE.BoxGeometry(regWidth * 0.9, 0.22, 0.04);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x002200,
      emissive: 0x00ff88,
      emissiveIntensity: 0.9,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, regHeight / 2 + 0.12, regDepth * 0.18);

    // buttons row
    const buttons = new THREE.Group();
    const btnGeo = new THREE.BoxGeometry(
      regWidth * 0.18,
      0.06,
      regDepth * 0.18
    );
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xffcc66,
      metalness: 0.1,
      roughness: 0.7,
    });
    const btnCount = 3;
    const spacing = regWidth * 0.22;
    for (let i = 0; i < btnCount; i++) {
      const b = new THREE.Mesh(btnGeo, btnMat);
      b.position.set(
        (i - (btnCount - 1) / 2) * spacing,
        regHeight / 2 + 0.05,
        -regDepth * 0.18
      );
      buttons.add(b);
    }

    const registerGroup = new THREE.Group();
    registerGroup.add(regBase);
    registerGroup.add(screen);
    registerGroup.add(buttons);
    const regX = counterWidth * 0.3;
    const regZ = -counterDepth * 0.15;
    const regY = counterHeight / 2 + 0.04 + regHeight / 2;
    registerGroup.position.set(regX, regY, regZ);

    counter.add(registerGroup);
    this.cashRegister = registerGroup;
    this.marketGroup.add(counter);
    this.mostrador = counter; 
    try {
      if (
        typeof window !== "undefined" &&
        window.alien2 &&
        window.alien2.model
      ) {
        try {
          if (window.alien2.model.parent)
            window.alien2.model.parent.remove(window.alien2.model);
        } catch (err) {
          // ignore
        }
        this.marketGroup.add(window.alien2.model);
        const alienOffsetBack = 1.0; 
        const alienY = 0; 
        const alienLocalX = counter.position.x;
        const alienLocalZ = counter.position.z - alienOffsetBack;
        window.alien2.model.position.set(alienLocalX, alienY, alienLocalZ);
        try {
          const entranceLocal = new THREE.Vector3(
            0,
            0,
            this.size.depth / 2 + 2
          );
          const entranceWorld = entranceLocal.clone();
          this.marketGroup.localToWorld(entranceWorld);
          window.alien2.model.lookAt(entranceWorld);
        } catch (e) {
          // ignore lookAt errors
        }
        try {
          if (typeof window.alien2.forceIdleAnimation === "function") {
            window.alien2.forceIdleAnimation();
          } else if (typeof window.alien2.playAnimation === "function") {
            window.alien2.playAnimation("idle");
          }
        } catch (e) {
          return e
        }
      }
    } catch (e) {
      return e
    }
  }
  showInteractionChoice() {
    try {
      if (
        typeof window !== "undefined" &&
        window.farmerController &&
        typeof window.farmerController.setInputEnabled === "function"
      )
        window.farmerController.setInputEnabled(false);
    } catch (e) {}
    if (typeof window !== "undefined" && window.alien2) {
      try {
        if (!window.alien2.interactionSystem.dialogueHud) {
          if (typeof window.alien2.createDialogueHud === "function")
            window.alien2.createDialogueHud();
        }
        const dialogArea = window.alien2.interactionSystem.dialogueArea;
        const buttonArea = window.alien2.interactionSystem.buttonArea;
        if (!dialogArea || !buttonArea) {
          return this.showInteractionChoiceFallback();
        }
        dialogArea.innerHTML = `<div style="text-align:center; font-size:22px; color:#2ecc71; margin-bottom:12px;">👽 MERCADO ALIEN 👽</div><div style="text-align:center; font-size:18px; color:#ecf0f1;">¿Qué deseas hacer?</div>`;
        buttonArea.innerHTML = "";
        const buyBtn = document.createElement("button");
        buyBtn.textContent = "Comprar";
        buyBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#27ae60; color:white; border:none; cursor:pointer; margin-bottom:8px; width:100%;`;
        buyBtn.onclick = (e) => {
          e.stopPropagation();
          try {
            const openMarketOnClose = () => {
              setTimeout(
                () => this.showMarketUI({ returnToChooser: true }),
                80
              );
            };
            try {
              window.alien2._onDialogueClose = openMarketOnClose;
            } catch (e) {}
            if (typeof window.alien2.closeDialogue === "function")
              window.alien2.closeDialogue();
          } catch (err) {
            this.showMarketUI({ returnToChooser: true });
          }
        };
        const sellBtn = document.createElement("button");
        sellBtn.textContent = "Vender";
        sellBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#f39c12; color:white; border:none; margin-bottom:8px; width:100%;`;
        sellBtn.onclick = (e) => {
          e.stopPropagation();
          try {
            const onClose = () =>
              setTimeout(() => this.showInteractionChoice(), 120);
            if (typeof window.alien2.openDialogue === "function") {
              window.alien2.openDialogue(onClose, { skipInitial: true });
            }
            try {
              window.alien2._onDialogueClose = onClose;
            } catch (e) {}
            try {
              const milk =
                typeof window.alien2.getMilkAmount === "function"
                  ? window.alien2.getMilkAmount()
                  : 0;
              if (milk >= 1) {
                window.alien2.handleYesMilkResponse();
              } else {
                window.alien2.handleNoMilkResponse();
              }
            } catch (err) {
            }
          } catch (err) {
            this.showMarketUI({ returnToChooser: true });
          }
        };
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Cerrar";
        closeBtn.style.cssText = `padding:10px 14px; font-size:14px; border-radius:6px; background:#c0392b; color:white; border:none; cursor:pointer; width:100%;`;
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          try {
            window.alien2.closeDialogue();
          } catch (err) {}
        };
        buttonArea.appendChild(buyBtn);
        buttonArea.appendChild(sellBtn);
        buttonArea.appendChild(closeBtn);
        try {
          const onChooserClose = () => {
            try {
              try {
                if (
                  typeof window !== "undefined" &&
                  window.farmerController &&
                  typeof window.farmerController.setInputEnabled === "function"
                )
                  window.farmerController.setInputEnabled(true);
              } catch (e) {}
              if (
                typeof window !== "undefined" &&
                window.farmerController &&
                typeof window.farmerController.exitMarket === "function"
              ) {
                window.farmerController.exitMarket(this);
              }
            } catch (err) {
              // ignore exit errors
            }
          };
          window.alien2.openDialogue(onChooserClose, { skipInitial: true });
        } catch (err) {
          return this.showInteractionChoiceFallback();
        }
        return;
      } catch (e) {
        return this.showInteractionChoiceFallback();
      }
    }
    this.showInteractionChoiceFallback();
  }
  showInteractionChoiceFallback() {
    if (this.isUIOpen) return;
    if (this._interactionChoiceHud) return;
    const hud = document.createElement("div");
    hud.id = "market-interaction-choice";
    hud.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: rgba(0,0,0,0.9);
      border: 2px solid #00aa00;
      border-radius: 12px;
      padding: 18px;
      color: white;
      z-index: 999999 !important;
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    `;
    const buyBtn = document.createElement("button");
    buyBtn.textContent = "Comprar";
    buyBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#27ae60; color:white; border:none; cursor:pointer;`;
    const sellBtn = document.createElement("button");
    sellBtn.textContent = "Vender";
    sellBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#f39c12; color:white; border:none; cursor:pointer;`;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.style.cssText = `padding:8px 12px; font-size:14px; border-radius:6px; background:#c0392b; color:white; border:none; cursor:pointer;`;
    hud.appendChild(buyBtn);
    hud.appendChild(sellBtn);
    hud.appendChild(closeBtn);
    document.body.appendChild(hud);
    this._interactionChoiceHud = hud;
    try {
      safePlaySfx("popup", { volume: 0.9 });
    } catch (_) {}
    try {
      if (
        typeof window !== "undefined" &&
        window.farmerController &&
        typeof window.farmerController.setInputEnabled === "function"
      )
        window.farmerController.setInputEnabled(false);
    } catch (e) {}
    const cleanup = () => {
      try {
        if (this._interactionChoiceHud && this._interactionChoiceHud.parentNode)
          this._interactionChoiceHud.parentNode.removeChild(
            this._interactionChoiceHud
          );
      } catch (e) {}
      this._interactionChoiceHud = null;
    };
    buyBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      this.showMarketUI({ returnToChooser: true });
    };
    sellBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      try {
        if (typeof window !== "undefined" && window.alien2) {
          if (!window.alien2.interactionSystem.dialogueHud) {
            if (typeof window.alien2.createDialogueHud === "function")
              window.alien2.createDialogueHud();
          }
          if (typeof window.alien2.forceIdleAnimation === "function")
            window.alien2.forceIdleAnimation();
          if (typeof window.alien2.openDialogue === "function") {
            const onCloseFallback = () => {
              setTimeout(() => this.showInteractionChoice(), 120);
            };
            window.alien2.openDialogue(onCloseFallback);
            try {
              window.alien2._onDialogueClose = onCloseFallback;
            } catch (e) {}
          }
        } else {
          this.showMarketUI({ returnToChooser: true });
        }
      } catch (err) {
        this.showMarketUI({ returnToChooser: true });
      }
    };
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      try {
        if (
          typeof window !== "undefined" &&
          window.farmerController &&
          typeof window.farmerController.setInputEnabled === "function"
        ) {
          window.farmerController.setInputEnabled(true);
        }
        if (
          typeof window !== "undefined" &&
          window.farmerController &&
          typeof window.farmerController.exitMarket === "function"
        ) {
          window.farmerController.exitMarket(this);
        }
      } catch (err) {
        // ignore exit errors
      }
    };
  }
  isPlayerInsideMarket(position) {
    if (!position) return false;
    const marketBounds = {
      minX: this.position.x - this.size.width / 2 - 1,
      maxX: this.position.x + this.size.width / 2 + 1,
      minZ: this.position.z - this.size.depth / 2 - 1,
      maxZ: this.position.z + this.size.depth / 2 + 1,
      minY: this.position.y,
      maxY: this.position.y + this.size.height,
    };
    return (
      position.x >= marketBounds.minX &&
      position.x <= marketBounds.maxX &&
      position.z >= marketBounds.minZ &&
      position.z <= marketBounds.maxZ
    );
  }
  updateRoofVisibility(playerPosition) {
    if (!playerPosition) return;
    const wasInside = this.isPlayerInside;
    this.isPlayerInside = this.isPlayerInsideMarket(playerPosition);
    if (wasInside !== this.isPlayerInside) {
      const shouldHideRoof = this.isPlayerInside;
      this.roofMeshes.forEach((mesh) => {
        if (mesh) mesh.visible = !shouldHideRoof;
      });
    }
  }
  update(playerPosition) {
    if (!playerPosition) return;
    const now = Date.now();
    const dt = (now - this._lastUpdateTime) / 1000;
    this._lastUpdateTime = now;
    this.updateDoorAnimation(playerPosition, dt);
    this.updateRoofVisibility(playerPosition);
    const worldPosition = new THREE.Vector3();
    this.interactionCircle.getWorldPosition(worldPosition);
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - worldPosition.x, 2) +
        Math.pow(playerPosition.z - worldPosition.z, 2)
    );
    if (distance <= this.radius) {
      if (!this.isPlayerNearby) {
        this.isPlayerNearby = true;
        if (this.uiTimer) clearTimeout(this.uiTimer);
        this.uiTimer = setTimeout(() => {
          if (this.isPlayerNearby) {
            this.showInteractionChoice();
          }
        }, 2500);
      }
    } else if (this.isPlayerNearby) {
      this.isPlayerNearby = false;
      if (this.uiTimer) {
        clearTimeout(this.uiTimer);
        this.uiTimer = null;
      }
      this.hideMarketUI();
    }
  }
  updateDoorAnimation(playerPosition, dt) {
    if (!this.door || !this.doorPivot) return;
    const pivotWorld = new THREE.Vector3();
    this.doorPivot.getWorldPosition(pivotWorld);
    const playerPos = playerPosition || new THREE.Vector3(0, 0, 0);
    const distance = Math.sqrt(
      Math.pow(playerPos.x - pivotWorld.x, 2) +
        Math.pow(playerPos.z - pivotWorld.z, 2)
    );
    const approachDistance =
      typeof this.doorOpenDistance === "number" ? this.doorOpenDistance : 3.5;
    const shouldOpen = distance <= approachDistance;
    try {
      if (shouldOpen !== !!this._lastDoorShouldOpen) {
        this._lastDoorShouldOpen = !!shouldOpen;
        if (shouldOpen) {
          try {
            safePlaySfx("openDoor", { object3D: this.door });
          } catch (_) {}
        } else {
          try {
            safePlaySfx("closeDoor", { object3D: this.door });
          } catch (_) {}
        }
      }
    } catch (e) {
    }
    const openSpeed = 2.5;
    if (shouldOpen) {
      this.doorOpenProgress += openSpeed * dt;
    } else {
      this.doorOpenProgress -= openSpeed * dt;
    }
    this.doorOpenProgress = Math.max(0, Math.min(1, this.doorOpenProgress));
    const targetRotation = (-Math.PI / 2) * this.doorOpenProgress;
    this.doorPivot.rotation.y = targetRotation;
  }
  showMarketUI(opts = {}) {
    this._returnToChooser = !!opts.returnToChooser;
    if (this.isUIOpen) return;
    this.isUIOpen = true;
    try {
      if (
        typeof window !== "undefined" &&
        window.farmerController &&
        typeof window.farmerController.setInputEnabled === "function"
      )
        window.farmerController.setInputEnabled(false);
    } catch (e) {}
    this.marketItems = [
      {
        id: 1,
        name: "Núcleo de Fusión",
        description:
          "Alimenta el motor principal del transbordador con energía cuántica estable",
        image: "../assets/Núcleo de Fusión.png",
        price: 25,
        owned: false,
      },
      {
        id: 2,
        name: "Membrana de Vacío",
        description:
          "Un panel flexible que se usa para sellar grietas en el casco",
        image: "../assets/Membrana de Vacío.png",
        price: 20,
        owned: false,
      },
      {
        id: 3,
        name: "Chip de Navegación",
        description:
          "Un microprocesador antiguo que predice rutas seguras a través de tormentas espaciales y campos de asteroides",
        image: "../assets/Chip de Navegación.png",
        price: 30,
        owned: false,
      },
      {
        id: 4,
        name: "Catalizador de Plasma",
        description:
          "Cristal flotante que contiene una sustancia incandescente que reacciona al contacto con la electricidad",
        image: "../assets/Catalizador de Plasma.png",
        price: 40,
        owned: false,
      },
      {
        id: 5,
        name: "Llave Multipropósito",
        description:
          "Herramienta de ingeniería avanzada que permite manipular la masa de los objetos para montarlos",
        image: "../assets/Llave de Ajuste multipropósito.png",
        price: 25,
        owned: false,
      },
      {
        id: 6,
        name: "Cristal de Poder",
        description: "Potencia el poder del motor para volver a casa",
        image: "../assets/Fragmento de Cristal.png",
        price: 10,
        owned: false,
      },
    ];
    this.marketUI = document.createElement("div");
    this.marketUI.id = "market-hud";
    this.marketUI.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00aa00;
      border-radius: 10px;
      padding: 20px;
      color: white;
      z-index: 999999 !important;
      width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: 'Arial', sans-serif;
      box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
      display: block;
      pointer-events: auto;
    `;
    const title = document.createElement("h2");
    title.textContent = "Mercado Alienígena";
    title.style.cssText = `
      text-align: center; 
      margin: 0 0 20px 0; 
      color: #4cff4c; 
      font-size: 28px;
      text-shadow: 0 0 10px rgba(76, 255, 76, 0.7);
      border-bottom: 2px solid #4cff4c;
      padding-bottom: 10px;
    `;
    this.marketUI.appendChild(title);
    const coins = document.createElement("div");
    const coinsDisplay = document.createElement("span");
    coinsDisplay.textContent = `Monedas: ${window.inventory?.coins || 0} `;
    this.coinsDisplay = coinsDisplay;
    coins.style.cssText = `
      position: absolute;
      top: 8px;
      right: 25px;
      font-size: 1.2em;
      color: #ffd700;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 15px;
      border-radius: 20px;
      border: 1px solid #ffd700;
      display: flex;
      align-items: center;
      gap: 5px;
    `;
    const coinIcon = document.createElement("span");
    coinIcon.innerHTML = "🪙";
    coinsDisplay.appendChild(coinIcon);
    coins.appendChild(coinsDisplay);
    this.marketUI.appendChild(coins);
    const itemsContainer = document.createElement("div");
    itemsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 20px 0;
    `;
    this.marketItems.forEach((item, index) => {
      const itemElement = document.createElement("div");
      itemElement.dataset.id = item.id;
      itemElement.style.cssText = `
        background: rgba(30, 30, 40, 0.7);
        border: 1px solid #4cff4c;
        border-radius: 10px;
        padding: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      `;
      itemElement.addEventListener("mouseenter", () => {
        itemElement.style.transform = "translateY(-5px)";
        itemElement.style.boxShadow = "0 5px 15px rgba(76, 255, 76, 0.3)";
        itemElement.style.borderColor = "#7fff7f";
      });
      itemElement.addEventListener("mouseleave", () => {
        itemElement.style.transform = "";
        itemElement.style.boxShadow = "";
        itemElement.style.borderColor = "#4cff4c";
      });
      const itemNumber = document.createElement("div");
      itemNumber.textContent = `${index + 1}`;
      itemNumber.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: #4cff4c;
        color: #000;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
      `;
      itemElement.appendChild(itemNumber);
      const itemImage = document.createElement("div");
      itemImage.style.cssText = `
        width: 80px;
        height: 80px;
        margin: 0 auto 10px;
        background: rgba(100, 100, 100, 0.3) url('${this._resolveMarketImage(item.image)}') no-repeat center center;
        background-size: contain;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      `;
      itemImage.textContent = this._getEmojiForItem(item.name);
      itemElement.appendChild(itemImage);
      const itemName = document.createElement("div");
      itemName.textContent = item.name;
      itemName.style.cssText = `
        font-weight: bold;
        text-align: center;
        margin: 5px 0;
        color: #7fff7f;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      itemElement.appendChild(itemName);
      const itemPrice = document.createElement("div");
      itemPrice.textContent = `$${item.price}`;
      itemPrice.style.cssText = `
        text-align: center;
        color: #ffd700;
        font-size: 16px;
        font-weight: bold;
        margin: 5px 0;
      `;
      itemElement.appendChild(itemPrice);
      itemElement.addEventListener("click", () => this.showItemDetails(item));
      itemsContainer.appendChild(itemElement);
    });
    this.marketUI.appendChild(itemsContainer);
    const closeButton = document.createElement("button");
    closeButton.textContent = "Cerrar";
    closeButton.style.cssText = `
      display: block;
      margin: 20px auto 0;
      padding: 10px 30px;
      background: #d9534f;
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    `;
    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.background = "#c9302c";
      closeButton.style.transform = "scale(1.05)";
    });
    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.background = "#d9534f";
      closeButton.style.transform = "";
    });
    closeButton.onclick = (e) => {
      e.stopPropagation();
      this.hideMarketUI();
    };
    this.marketUI.appendChild(closeButton);
    document.body.appendChild(this.marketUI);
    try {
      safePlaySfx("popup", { volume: 0.9 });
    } catch (_) {}
    this.marketUI.onclick = (e) => e.stopPropagation();
    document.addEventListener("click", this.handleOutsideClick);
  }
  showItemDetails(item) {
    this.marketUI.style.display = "none";
    const detailsView = document.createElement("div");
    detailsView.id = "item-details";
    detailsView.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #4cff4c;
      border-radius: 10px;
      padding: 25px;
      color: white;
      z-index: 1000000;
      width: 700px;
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      font-family: 'Arial', sans-serif;
      box-shadow: 0 0 30px rgba(76, 255, 76, 0.4);
      display: flex;
      flex-direction: column;
    `;
    const backButton = document.createElement("button");
    backButton.innerHTML = "&larr; Volver";
    backButton.style.cssText = `
      align-self: flex-start;
      background: none;
      border: 1px solid #4cff4c;
      color: #4cff4c;
      padding: 5px 15px;
      border-radius: 15px;
      margin-bottom: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;
    backButton.addEventListener("mouseenter", () => {
      backButton.style.background = "rgba(76, 255, 76, 0.2)";
    });
    backButton.addEventListener("mouseleave", () => {
      backButton.style.background = "none";
    });
    backButton.onclick = (e) => {
      e.stopPropagation();
      try {
        document.removeEventListener("click", handleOutsideClick);
      } catch (err) {
        // ignore
      }
      if (detailsView && detailsView.parentNode) {
        detailsView.parentNode.removeChild(detailsView);
      }
      if (this.marketUI) {
        this.marketUI.style.display = "block";
      }
    };
    detailsView.appendChild(backButton);
    const content = document.createElement("div");
    content.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: 25px;
      align-items: flex-start;
      @media (max-width: 768px) {
        flex-direction: column;
        align-items: center;
      }
    `;
    const itemImage = document.createElement("div");
    itemImage.style.cssText = `
      width: 200px;
      height: 200px;
      background: rgba(100, 100, 100, 0.3) url('${this._resolveMarketImage(item.image)}') no-repeat center center;
      background-size: contain;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      flex-shrink: 0;
      border: 2px solid #4cff4c;
    `;
    itemImage.textContent = this._getEmojiForItem(item.name);
    const itemInfo = document.createElement("div");
    itemInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;
    const title = document.createElement("h2");
    title.textContent = item.name;
    title.style.cssText = `
      margin: 0 0 10px 0;
      color: #4cff4c;
      font-size: 24px;
    `;
    const price = document.createElement("div");
    price.textContent = `Precio: $${item.price}`;
    price.style.cssText = `
      font-size: 20px;
      color: #ffd700;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 5px;
    `;
    const coinIcon = document.createElement("span");
    coinIcon.innerHTML = "🪙";
    price.insertBefore(coinIcon, price.firstChild);
    // Descripción
    const description = document.createElement("p");
    description.textContent = item.description;
    description.style.cssText = `
      margin: 0 0 25px 0;
      line-height: 1.6;
      color: #ddd;
      flex: 1;
    `;
    const buyButton = document.createElement("button");
    const updateButtonState = () => {
      const canAfford = window.inventory?.coins >= item.price;
      buyButton.textContent = item.owned
        ? "✓ Ya comprado"
        : canAfford
        ? `Comprar por $${item.price} `
        : `$ ${item.price} (No tienes suficientes monedas)`;
      buyButton.disabled = item.owned;
      buyButton.style.cssText = `
        align-self: flex-start;
        background: ${item.owned ? "#666" : canAfford ? "#4CAF50" : "#d9534f"};
        color: white;
        border: none;
        border-radius: 5px;
        padding: 12px 25px;
        font-size: 14px;
        cursor: ${
          item.owned ? "not-allowed" : canAfford ? "pointer" : "not-allowed"
        };
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      const icon = document.createElement("span");
      icon.innerHTML = item.owned ? "✓" : canAfford ? "🛒" : "❌";
      buyButton.innerHTML = "";
      buyButton.appendChild(icon);
      buyButton.appendChild(
        document.createTextNode(
          item.owned
            ? " Ya comprado"
            : canAfford
            ? ` Comprar por $${item.price}`
            : ` $${item.price} (No tienes suficientes monedas)`
        )
      );
    };
    updateButtonState();
    if (!item.owned) {
      buyButton.addEventListener("mouseenter", () => {
        if (window.inventory?.coins >= item.price) {
          buyButton.style.transform = "scale(1.02)";
          buyButton.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        }
      });
      buyButton.addEventListener("mouseleave", () => {
        buyButton.style.transform = "";
        buyButton.style.boxShadow = "";
      });
      buyButton.onclick = () => {
        if (!window.inventory) {
          return;
        }
        if (window.inventory.coins < item.price) {
          window.inventory?.notify?.(
            `No tienes suficientes monedas. Necesitas $${item.price}`,
            "error"
          );
          return;
        }

        try {
          const toolSlots = {
            "Llave Multipropósito": 0,
            "Membrana de Vacío": 1,
            "Chip de Navegación": 2,
            "Catalizador de Plasma": 3,
            "Núcleo de Fusión": 4,
            "Cristal de Poder": 5,
          };
          const slotIndex = toolSlots[item.name];
          if (slotIndex === undefined) {
            window.inventory?.notify?.(
              `Error: No se pudo encontrar el slot para ${item.name}`,
              "error"
            );
            return;
          }
          while (window.inventory.tools.length <= slotIndex) {
            window.inventory.tools.push(null);
          }
          if (window.inventory.tools[slotIndex] !== null) {
            window.inventory?.notify?.(
              `El slot ${slotIndex + 1} ya está ocupado`,
              "error"
            );
            return;
          }
          const previousTool = window.inventory.tools[slotIndex];
          window.inventory.tools[slotIndex] = item.name;
          if (window.inventory.tools[slotIndex] === item.name) {
            window.inventory.coins -= item.price;
            item.owned = true;
            window.inventory._updateUI?.();
            updateButtonState();
            try {
              if (this.coinsDisplay) {
                this.coinsDisplay.textContent = `Monedas: ${window.inventory.coins} `;
                const coinSpan = document.createElement("span");
                coinSpan.innerHTML = "🪙";
                this.coinsDisplay.appendChild(coinSpan);
              }
            } catch (_) {}
            window.inventory?.notify?.(
              `¡${item.name} comprado por $${item.price}!`,
              "success"
            );
            try {
              playSfxWhenReady("cashRegister", { volume: 0.9 });
            } catch (_) {}
          } else {
            window.inventory.tools[slotIndex] = previousTool;
            throw new Error("No se pudo agregar la herramienta al inventario");
          }
        } catch (error) {
          item.owned = false;
          updateButtonState();
          window.inventory?._updateUI?.();
          window.inventory?.notify?.("Error al procesar la compra", "error");
        }
      };
    }
    if (window.inventory?.coins < item.price) {
      if (window.inventory.notify) {
        window.inventory.notify(
          `No tienes suficientes monedas. Necesitas $${item.price}`,
          "error"
        );
      }
    }
    itemInfo.appendChild(title);
    itemInfo.appendChild(price);
    itemInfo.appendChild(description);
    itemInfo.appendChild(buyButton);

    content.appendChild(itemImage);
    content.appendChild(itemInfo);
    detailsView.appendChild(content);

    document.body.appendChild(detailsView);
    try {
      safePlaySfx("popup", { volume: 0.9 });
    } catch (_) {}
    try {
      document.removeEventListener("click", this.handleOutsideClick);
    } catch (e) {}
    const handleOutsideClick = (e) => {
      if (!detailsView.contains(e.target)) {
        try {
          document.body.removeChild(detailsView);
        } catch (err) {}
        if (this.marketUI) this.marketUI.style.display = "block";
        document.removeEventListener("click", handleOutsideClick);
        try {
          document.addEventListener("click", this.handleOutsideClick);
        } catch (err) {}
      }
    };
    setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 100);
  }
  handleOutsideClick = (e) => {
    if (this.marketUI && !this.marketUI.contains(e.target)) {
      this.hideMarketUI();
    }
  };
  hideMarketUI(returnToChooser) {
    if (!this.isUIOpen) return;
    if (this.marketUI) {
      try {
        document.body.removeChild(this.marketUI);
      } catch (e) {
        // already removed
      }
      this.marketUI = null;
    }
    document.removeEventListener("click", this.handleOutsideClick);
    this.isUIOpen = false;
    const shouldReturnToChooser =
      typeof returnToChooser === "boolean"
        ? returnToChooser
        : !!this._returnToChooser;
    this._returnToChooser = false;

    if (shouldReturnToChooser) {
      setTimeout(() => {
        this.showInteractionChoice();
      }, 50);
      return;
    }
    try {
      try {
        if (
          typeof window !== "undefined" &&
          window.farmerController &&
          typeof window.farmerController.setInputEnabled === "function"
        )
          window.farmerController.setInputEnabled(true);
      } catch (e) {}
      if (
        typeof window !== "undefined" &&
        window.farmerController &&
        typeof window.farmerController.exitMarket === "function"
      ) {
        window.farmerController.exitMarket(this);
      }
    } catch (e) {
      return e
    }
  }
}
