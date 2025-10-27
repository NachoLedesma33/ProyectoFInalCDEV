// src/utils/Market.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

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
        description: "Alimenta el motor principal del transbordador con energía cuántica estable",
        image: "../assets/Núcleo de Fusión.png",
        price: 500,
        owned: false
      },
      {
        id: 2,
        name: "Membrana de Vacío",
        description: "Un panel flexible que se usa para sellar grietas en el casco",
        image: "../assets/Membrana de Vacío.png",
        price: 300,
        owned: false
      },
      {
        id: 3,
        name: "Chip de Navegación",
        description: "Un microprocesador que predice rutas seguras a través del espacio",
        image: "../assets/Chip de Navegación.png",
        price: 400,
        owned: false
      },
      {
        id: 4,
        name: "Catalizador de Plasma",
        description: "Cristal que contiene una sustancia incandescente que reacciona a la electricidad",
        image: "../assets/Catalizador de Plasma.png",
        price: 450,
        owned: false
      },
      {
        id: 5,
        name: "Llave Multipropósito",
        description: "Herramienta avanzada que permite manipular la masa de los objetos",
        image: "../assets/Llave de Ajuste multiproposito.png",
        price: 350,
        owned: false
      },
      {
        id: 6,
        name: "Cristal de Poder",
        description: "Potencia el motor para volver a casa",
        image: "../assets/Fragmento de Cristal.png",
        price: 600,
        owned: false
      }
    ];

    this.createMarket();
    this.createInteractionArea();
  // create a small stone counter inside the market behind the interaction circle
  this.createCounter();
    // Door state
    this.door = null;
    this.doorPivot = null;
    this.doorOpen = false;
    this.doorOpenProgress = 0; // 0 closed, 1 open
    this._lastUpdateTime = Date.now();
  // how close the player must be to start opening the door (units)
  this.doorOpenDistance = 3.5;
    // Allow entry flag - FarmerController will check this to allow entering the market
    this.allowEntry = true;
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
        console.error("Error cargando textura:", error);
        const basicMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
        this.createWalls(basicMaterial, basicMaterial);
        this.createRoof(basicMaterial);
      }
    );
  }

  createWalls(stoneMaterial, windowMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

  // Create front wall with a central door opening
  // Narrow the door and clamp to a smaller maximum for a less tall/narrow entrance
  const doorWidth = Math.min(3, width * 0.33); // narrower door
    const sideWidth = (width - doorWidth) / 2;

    // Left front segment
    const frontLeft = new THREE.Mesh(
      new THREE.BoxGeometry(sideWidth, height, wallThickness),
      stoneMaterial
    );
    frontLeft.position.set(-((width - sideWidth) / 2), height / 2, depth / 2);
    this.marketGroup.add(frontLeft);
    this.walls.push(frontLeft);

    // Right front segment
    const frontRight = new THREE.Mesh(
      new THREE.BoxGeometry(sideWidth, height, wallThickness),
      stoneMaterial
    );
    frontRight.position.set((width - sideWidth) / 2, height / 2, depth / 2);
    this.marketGroup.add(frontRight);
    this.walls.push(frontRight);

  // Create a simple door that will be attached to a pivot so it can swing
  // Lower the door height further so it doesn't reach the roof; fill the space above later
  const doorHeight = height * 0.5;
    const doorThickness = 0.05;

    // Pivot for the door (hinge on the left side of the opening)
    this.doorPivot = new THREE.Object3D();
    // pivot origin placed at the hinge position in local marketGroup coords
    this.doorPivot.position.set(-doorWidth / 2, doorHeight / 2, depth / 2 + 0.01);
    this.marketGroup.add(this.doorPivot);

    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.6 });
    this.door = new THREE.Mesh(doorGeometry, doorMaterial);
    // offset door so hinge aligns with pivot (hinge on left edge)
    this.door.position.set(doorWidth / 2, 0, 0);
    this.door.castShadow = true;
    this.door.receiveShadow = true;
    this.doorPivot.add(this.door);

  // expose door dimensions for external collision checks
  this.doorWidth = doorWidth;
  this.doorHeight = doorHeight;

    // Make a small handle for the door for visual clarity
    const handleGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
    const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
    // place the handle near the outer edge of the door but inside the face
    // door geometry is centered, so use doorWidth/2 - offset to position close to edge
    const handleOffsetX = Math.max(doorWidth / 2 - 0.25, 0.3);
    handle.position.set(handleOffsetX, 0, doorThickness / 2 + 0.02);
    this.door.add(handle);

    // Fill the wall above the door so there's no gap up to the roof
    const topHeight = height - doorHeight;
    if (topHeight > 0.01) {
      const frontTop = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, topHeight, wallThickness),
        stoneMaterial
      );
      // center the top piece above the door opening
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

    // Front decorative window removed to avoid blocking the entrance
    // If you want a window, add it above the door or offset so it doesn't block the doorway.
    
    // Alien window image removed per request (no extra decorative texture)
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
    // Reduce z-fighting with nearby geometry by using polygonOffset and a later render order
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1; // push polygon slightly forward
    material.polygonOffsetUnits = -4;

    const textGeometry = new THREE.PlaneGeometry(4, 1.5);
    const textMesh = new THREE.Mesh(textGeometry, material);

  // Move the text slightly forward from the sign plane to avoid z-fighting
  textMesh.position.set(position.x, position.y, position.z + 0.5);
  // Ensure the text renders after most geometry
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
    // Place the interaction circle as a child of the marketGroup so it follows rotation
    // Position it a couple units inside the entrance (depth/2 - 2)
    const { depth } = this.size;
    const insideLocalZ = depth / 2 - 2; // 2 units inside the front wall
    this.interactionCircle.position.set(0, 0.1, insideLocalZ);
    // attach to marketGroup so rotation and position are consistent
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

  // Create a simple stone counter (mostrador) inside the market behind the interaction circle
  createCounter() {
    if (!this.marketGroup) return;

    const { width, depth } = this.size;

    // Counter dimensions
    const counterWidth = Math.min(6, width * 0.5);
    const counterHeight = 1.0;
    const counterDepth = 1.2;

    const geometry = new THREE.BoxGeometry(counterWidth, counterHeight, counterDepth);
    const material = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.05, roughness: 0.9 });

    const counter = new THREE.Mesh(geometry, material);
    counter.castShadow = true;
    counter.receiveShadow = true;

    // Place it a bit further inside than the interaction circle
    const circleLocalZ = this.interactionCircle ? this.interactionCircle.position.z : (depth / 2 - 2);
    const behindOffset = 2.2; // units behind the circle
    const localZ = circleLocalZ - behindOffset;

    // Center on X and set Y so it sits on the floor
    counter.position.set(0, counterHeight / 2, localZ);

    // Add a small decoration slab on top to make it read like a counter
    const slabGeo = new THREE.BoxGeometry(counterWidth * 0.98, 0.08, counterDepth * 0.98);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x4f4f4f, metalness: 0.1, roughness: 0.7 });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, counterHeight / 2 + 0.04, 0);
    counter.add(slab);

    // Add a simple cash register on top of the slab
    const regWidth = counterWidth * 0.25;
    const regDepth = counterDepth * 0.5;
    const regHeight = 0.4;

    const regBaseGeo = new THREE.BoxGeometry(regWidth, regHeight, regDepth);
    const regBaseMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.3, roughness: 0.5 });
    const regBase = new THREE.Mesh(regBaseGeo, regBaseMat);
    regBase.castShadow = true;
    regBase.receiveShadow = true;

    // screen
    const screenGeo = new THREE.BoxGeometry(regWidth * 0.9, 0.22, 0.04);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x00ff88, emissiveIntensity: 0.9 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, regHeight / 2 + 0.12, regDepth * 0.18);

    // buttons row
    const buttons = new THREE.Group();
    const btnGeo = new THREE.BoxGeometry(regWidth * 0.18, 0.06, regDepth * 0.18);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xffcc66, metalness: 0.1, roughness: 0.7 });
    const btnCount = 3;
    const spacing = regWidth * 0.22;
    for (let i = 0; i < btnCount; i++) {
      const b = new THREE.Mesh(btnGeo, btnMat);
      b.position.set((i - (btnCount - 1) / 2) * spacing, regHeight / 2 + 0.05, -regDepth * 0.18);
      buttons.add(b);
    }

    const registerGroup = new THREE.Group();
    registerGroup.add(regBase);
    registerGroup.add(screen);
    registerGroup.add(buttons);

    // place the register toward the front-right of the counter (local counter coords)
    const regX = counterWidth * 0.3;
    const regZ = -counterDepth * 0.15;
    const regY = counterHeight / 2 + 0.04 + regHeight / 2; // sit on top of slab
    registerGroup.position.set(regX, regY, regZ);

    counter.add(registerGroup);
    this.cashRegister = registerGroup;

    this.marketGroup.add(counter);
    this.mostrador = counter; // expose for later tweaks

    // If an Alien2 instance exists globally, place it behind the counter and force idle
    try {
      if (typeof window !== 'undefined' && window.alien2 && window.alien2.model) {
        // Remove from previous parent if necessary
        try {
          if (window.alien2.model.parent) window.alien2.model.parent.remove(window.alien2.model);
        } catch (err) {
          // ignore
        }

        // Add alien model as child of marketGroup so it follows rotation/position
        this.marketGroup.add(window.alien2.model);

        // Position the alien a bit behind the counter (local coords)
        const alienOffsetBack = 1.0; // how far behind the counter the alien stands
        const alienY = 0; // ground
        const alienLocalX = counter.position.x;
        const alienLocalZ = counter.position.z - alienOffsetBack;
        window.alien2.model.position.set(alienLocalX, alienY, alienLocalZ);

        // Make the alien face the market entrance (a point in front of the market)
        try {
          const entranceLocal = new THREE.Vector3(0, 0, this.size.depth / 2 + 2);
          const entranceWorld = entranceLocal.clone();
          this.marketGroup.localToWorld(entranceWorld);
          window.alien2.model.lookAt(entranceWorld);
        } catch (e) {
          // ignore lookAt errors
        }

        // Force idle and stop movement so alien stays behind the counter
        try {
          if (typeof window.alien2.forceIdleAnimation === 'function') {
            window.alien2.forceIdleAnimation();
          } else if (typeof window.alien2.playAnimation === 'function') {
            window.alien2.playAnimation('idle');
          }
        } catch (e) {
          console.warn('Error forzando idle en alien2:', e);
        }
      }
    } catch (e) {
      // ignore positioning failure
    }
  }

  // Show a small choice HUD when player enters the interaction circle: Comprar / Vender
  showInteractionChoice() {
    // Disable player input while the chooser/dialog is visible
    try { if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.setInputEnabled === 'function') window.farmerController.setInputEnabled(false); } catch (e) {}

    // If an Alien2 instance exists, use its dialog as the chooser (Comprar / Vender)
    if (typeof window !== 'undefined' && window.alien2) {
      try {
        if (!window.alien2.interactionSystem.dialogueHud) {
          if (typeof window.alien2.createDialogueHud === 'function') window.alien2.createDialogueHud();
        }

        // Prepare chooser content inside the alien HUD
        const dialogArea = window.alien2.interactionSystem.dialogueArea;
        const buttonArea = window.alien2.interactionSystem.buttonArea;
        if (!dialogArea || !buttonArea) {
          // Fallback to simple chooser if alien HUD not ready
          return this.showInteractionChoiceFallback();
        }

        dialogArea.innerHTML = `<div style="text-align:center; font-size:22px; color:#2ecc71; margin-bottom:12px;">👽 MERCADO ALIEN 👽</div><div style="text-align:center; font-size:18px; color:#ecf0f1;">¿Qué deseas hacer?</div>`;
        buttonArea.innerHTML = '';

        // Comprar button
        const buyBtn = document.createElement('button');
        buyBtn.textContent = 'Comprar';
        buyBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#27ae60; color:white; border:none; cursor:pointer; margin-bottom:8px; width:100%;`;
        buyBtn.onclick = (e) => {
          e.stopPropagation();
          // Instead of closing the chooser which currently has an onClose that exits,
          // set the alien's onClose callback to open the market UI as a sub-dialog.
          try {
            const openMarketOnClose = () => {
              // small delay to avoid DOM race
              setTimeout(() => this.showMarketUI({ returnToChooser: true }), 80);
            };
            // set the callback that will be called by alien2.closeDialogue()
            try { window.alien2._onDialogueClose = openMarketOnClose; } catch (e) {}
            // now close the alien HUD so its onClose fires (and opens market)
            if (typeof window.alien2.closeDialogue === 'function') window.alien2.closeDialogue();
          } catch (err) {
            console.warn('Error while trying to open market from alien chooser:', err);
            // fallback: directly open market UI
            this.showMarketUI({ returnToChooser: true });
          }
        };

        // Vender button
        const sellBtn = document.createElement('button');
        sellBtn.textContent = 'Vender';
        sellBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#f39c12; color:white; border:none; margin-bottom:8px; width:100%;`;
        sellBtn.onclick = (e) => {
          e.stopPropagation();
          // Open the alien dialog (skip initial) and jump into sell flow; when it's closed, reopen chooser
          try {
            const onClose = () => setTimeout(() => this.showInteractionChoice(), 120);
            if (typeof window.alien2.openDialogue === 'function') {
              window.alien2.openDialogue(onClose, { skipInitial: true });
            }
            // Ensure callback is set even if openDialogue didn't replace it (guard against errors)
            try { window.alien2._onDialogueClose = onClose; } catch (e) {}
            // Determine if player has milk and show the appropriate sell UI
            try {
              const milk = typeof window.alien2.getMilkAmount === 'function' ? window.alien2.getMilkAmount() : 0;
              if (milk >= 1) {
                window.alien2.handleYesMilkResponse();
              } else {
                window.alien2.handleNoMilkResponse();
              }
            } catch (err) {
              console.warn('Error starting sell flow on alien dialog:', err);
            }
          } catch (err) {
            console.warn('Error opening alien sell flow:', err);
            // Fallback: open market UI
            this.showMarketUI({ returnToChooser: true });
          }
        };

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cerrar';
        closeBtn.style.cssText = `padding:10px 14px; font-size:14px; border-radius:6px; background:#c0392b; color:white; border:none; cursor:pointer; width:100%;`;
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          try { window.alien2.closeDialogue(); } catch (err) {}
        };

        buttonArea.appendChild(buyBtn);
        buttonArea.appendChild(sellBtn);
        buttonArea.appendChild(closeBtn);

        // Show the alien HUD as chooser (skip the alien initial message)
        try {
          // when the alien HUD is closed from the chooser, make the farmer exit the market (run out)
          const onChooserClose = () => {
            try {
              // Re-enable input when the chooser closes
              try { if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.setInputEnabled === 'function') window.farmerController.setInputEnabled(true); } catch(e) {}
              if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.exitMarket === 'function') {
                window.farmerController.exitMarket(this);
              }
            } catch (err) {
              console.warn('Error exiting market on chooser close:', err);
            }
          };
          // Ensure we pass the proper handler
          window.alien2.openDialogue(onChooserClose, { skipInitial: true });
        } catch (err) {
          console.warn('Error showing alien dialog chooser:', err);
        }

        return;
      } catch (e) {
        console.warn('Error using alien dialog as chooser:', e);
        // fallback to simple chooser UI
        return this.showInteractionChoiceFallback();
      }
    }

    // If no alien present, show the simple chooser fallback
    this.showInteractionChoiceFallback();
  }

  // Fallback: the old simple chooser UI when alien dialog is not available
  showInteractionChoiceFallback() {
    if (this.isUIOpen) return;

    // Prevent multiple choosers
    if (this._interactionChoiceHud) return;

    const hud = document.createElement('div');
    hud.id = 'market-interaction-choice';
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

    const buyBtn = document.createElement('button');
    buyBtn.textContent = 'Comprar';
    buyBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#27ae60; color:white; border:none; cursor:pointer;`;

    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Vender';
    sellBtn.style.cssText = `padding:12px 20px; font-size:18px; border-radius:8px; background:#f39c12; color:white; border:none; cursor:pointer;`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `padding:8px 12px; font-size:14px; border-radius:6px; background:#c0392b; color:white; border:none; cursor:pointer;`;

    hud.appendChild(buyBtn);
    hud.appendChild(sellBtn);
    hud.appendChild(closeBtn);

    document.body.appendChild(hud);
    this._interactionChoiceHud = hud;

  // Disable player input while the chooser fallback is visible
  try { if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.setInputEnabled === 'function') window.farmerController.setInputEnabled(false); } catch (e) {}

    const cleanup = () => {
      try {
        if (this._interactionChoiceHud && this._interactionChoiceHud.parentNode) this._interactionChoiceHud.parentNode.removeChild(this._interactionChoiceHud);
      } catch (e) {}
      this._interactionChoiceHud = null;
    };

    buyBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      // Open market as a sub-dialog. When it closes we want to return to the chooser.
      this.showMarketUI({ returnToChooser: true });
    };

    sellBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      // Ensure alien HUD exists, then open alien dialogue and return to chooser when it closes
      try {
        if (typeof window !== 'undefined' && window.alien2) {
          if (!window.alien2.interactionSystem.dialogueHud) {
            if (typeof window.alien2.createDialogueHud === 'function') window.alien2.createDialogueHud();
          }
          if (typeof window.alien2.forceIdleAnimation === 'function') window.alien2.forceIdleAnimation();
          if (typeof window.alien2.openDialogue === 'function') {
            // pass onClose callback so alien dialog can return to chooser
            const onCloseFallback = () => { setTimeout(() => this.showInteractionChoice(), 120); };
            window.alien2.openDialogue(onCloseFallback);
            try { window.alien2._onDialogueClose = onCloseFallback; } catch (e) {}
          }
        } else {
          // fallback: open market if alien not present
          this.showMarketUI({ returnToChooser: true });
        }
      } catch (err) {
        console.warn('Error opening alien dialogue:', err);
        this.showMarketUI({ returnToChooser: true });
      }
    };

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      // after closing the chooser fallback, re-enable input then make the farmer exit the market (run out)
      try {
        if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.setInputEnabled === 'function') {
          window.farmerController.setInputEnabled(true);
        }
        if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.exitMarket === 'function') {
          window.farmerController.exitMarket(this);
        }
      } catch (err) {
        console.warn('Error exiting market on chooser close (fallback):', err);
      }
    };
  }

  // Animate door open/close smoothly based on player distance
  updateDoorAnimation(playerPosition, dt) {
    if (!this.door || !this.doorPivot) return;

    // Determine distance from player to door pivot (world position)
    const pivotWorld = new THREE.Vector3();
    this.doorPivot.getWorldPosition(pivotWorld);

    const playerPos = playerPosition || new THREE.Vector3(0, 0, 0);
    const distance = Math.sqrt(
      Math.pow(playerPos.x - pivotWorld.x, 2) +
        Math.pow(playerPos.z - pivotWorld.z, 2)
    );

  // If player is within approach distance, request door open
  const approachDistance = typeof this.doorOpenDistance === 'number' ? this.doorOpenDistance : 3.5;
  const shouldOpen = distance <= approachDistance;

    // Adjust target progress
    const openSpeed = 2.5; // progress units per second
    if (shouldOpen) {
      this.doorOpenProgress += openSpeed * dt;
    } else {
      this.doorOpenProgress -= openSpeed * dt;
    }

    // clamp
    this.doorOpenProgress = Math.max(0, Math.min(1, this.doorOpenProgress));

    // Map progress to rotation: 0 -> closed (0), 1 -> open (-90deg)
    const targetRotation = -Math.PI / 2 * this.doorOpenProgress;
    // Smoothly set rotation
    this.doorPivot.rotation.y = targetRotation;
  }

  update(playerPosition) {
    // Compute delta time for smooth door animation
    const now = Date.now();
    const dt = (now - (this._lastUpdateTime || now)) / 1000;
    this._lastUpdateTime = now;

    // Update door animation based on player position and dt
    this.updateDoorAnimation(playerPosition, dt);

    if (playerPosition) {
      this.checkPlayerPosition(playerPosition);
    }
  }

  checkPlayerPosition(playerPosition) {
    if (!playerPosition) return;

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
            // Show unified interaction choice (Comprar / Vender) which will
            // open the market UI or the alien sell dialog accordingly.
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

  showMarketUI(opts = {}) {
    // opts.returnToChooser: if true, closing this UI should reopen the interaction chooser
    this._returnToChooser = !!opts.returnToChooser;
    if (this.isUIOpen) return;
    this.isUIOpen = true;

  // Disable player input while market UI is visible
  try { if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.setInputEnabled === 'function') window.farmerController.setInputEnabled(false); } catch (e) {}

    // Define los ítems del mercado
    this.marketItems = [
      {
        id: 1,
        name: "Núcleo de Fusión",
        description: "Alimenta el motor principal del transbordador con energía cuántica estable",
        image: "../assets/Núcleo de Fusión.png",
        price: 50,
        owned: false
      },
      {
        id: 2,
        name: "Membrana de Vacío",
        description: "Un panel flexible que se usa para sellar grietas en el casco",
        image: "../assets/Membrana de Vacío.png",
        price: 30,
        owned: false
      },
      {
        id: 3,
        name: "Chip de Navegación",
        description: "Un microprocesador antiguo que predice rutas seguras a través de tormentas espaciales y campos de asteroides",
        image: "../assets/Chip de Navegación.png",
        price: 40,
        owned: false
      },
      {
        id: 4,
        name: "Catalizador de Plasma",
        description: "Cristal flotante que contiene una sustancia incandescente que reacciona al contacto con la electricidad",
        image: "../assets/Catalizador de Plasma.png",
        price: 45,
        owned: false
      },
      {
        id: 5,
        name: "Llave Multipropósito",
        description: "Herramienta de ingeniería avanzada que permite manipular la masa de los objetos para montarlos",
        image: "../assets/Llave de Ajuste multipropósito.png",
        price: 35,
        owned: false
      },
      {
        id: 6,
        name: "Cristal de Poder",
        description: "Potencia el poder del motor para volver a casa",
        image: "../assets/Fragmento de Cristal.png",
        price: 60,
        owned: false
      }
    ];

    // Crear el contenedor principal del HUD
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

    // Título del mercado
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

    // Mostrar monedas disponibles
    const coins = document.createElement("div");
    const coinsDisplay = document.createElement("span");
    coinsDisplay.textContent = `Monedas: ${window.inventory?.coins || 0} `;
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
    
    // Añadir icono de moneda
    const coinIcon = document.createElement("span");
    coinIcon.innerHTML = '🪙';
    coinsDisplay.appendChild(coinIcon);
    coins.appendChild(coinsDisplay);
    this.marketUI.appendChild(coins);

    // Contenedor de los ítems
    const itemsContainer = document.createElement("div");
    itemsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 20px 0;
    `;

    // Crear un ítem para cada elemento del mercado
    this.marketItems.forEach((item, index) => {
      const itemElement = document.createElement("div");
      itemElement.dataset.id = item.id;
      // Apply base styles
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
      
      // Add hover effect with event listeners
      itemElement.addEventListener('mouseenter', () => {
        itemElement.style.transform = 'translateY(-5px)';
        itemElement.style.boxShadow = '0 5px 15px rgba(76, 255, 76, 0.3)';
        itemElement.style.borderColor = '#7fff7f';
      });
      
      itemElement.addEventListener('mouseleave', () => {
        itemElement.style.transform = '';
        itemElement.style.boxShadow = '';
        itemElement.style.borderColor = '#4cff4c';
      });

      // Número del ítem
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

      // Imagen del ítem
      const itemImage = document.createElement("div");
      itemImage.style.cssText = `
        width: 80px;
        height: 80px;
        margin: 0 auto 10px;
        background: rgba(100, 100, 100, 0.3) url('${item.image}') no-repeat center center;
        background-size: contain;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      `;
      itemImage.textContent = item.name.charAt(0); // Placeholder
      
      itemElement.appendChild(itemImage);

      // Nombre del ítem
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

      // Precio
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

      // Evento de clic para mostrar detalles
      itemElement.addEventListener("click", () => this.showItemDetails(item));
      
      itemsContainer.appendChild(itemElement);
    });

    // Añadir contenedor de ítems al HUD
    this.marketUI.appendChild(itemsContainer);

    // Botón de cerrar
    const closeButton = document.createElement("button");
    closeButton.textContent = "Cerrar";
    // Base styles for close button
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
    
    // Add hover effect with event listeners
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#c9302c';
      closeButton.style.transform = 'scale(1.05)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#d9534f';
      closeButton.style.transform = '';
    });
    closeButton.onclick = (e) => {
      e.stopPropagation();
      this.hideMarketUI();
    };
    this.marketUI.appendChild(closeButton);

    // Añadir al documento
    document.body.appendChild(this.marketUI);
    this.marketUI.onclick = (e) => e.stopPropagation();
    document.addEventListener("click", this.handleOutsideClick);
  }

  // Mostrar detalles del ítem seleccionado
  showItemDetails(item) {
    // Ocultar la vista principal
    this.marketUI.style.display = 'none';
    
    // Crear contenedor de detalles
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

    // Botón de volver
    const backButton = document.createElement("button");
    backButton.innerHTML = '&larr; Volver';
    // Base styles for back button
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
    
    // Add hover effect with event listeners
    backButton.addEventListener('mouseenter', () => {
      backButton.style.background = 'rgba(76, 255, 76, 0.2)';
    });
    
    backButton.addEventListener('mouseleave', () => {
      backButton.style.background = 'none';
    });
    backButton.onclick = (e) => {
      // Prevent this click from bubbling to the document-level outside click handlers
      e.stopPropagation();
      // Remove the details view outside-click listener if present
      try {
        document.removeEventListener('click', handleOutsideClick);
      } catch (err) {
        // ignore
      }
      // Remove the details view and restore the main market UI
      if (detailsView && detailsView.parentNode) {
        detailsView.parentNode.removeChild(detailsView);
      }
      if (this.marketUI) {
        this.marketUI.style.display = 'block';
      }
    };
    detailsView.appendChild(backButton);

    // Contenido de detalles
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

    // Imagen del ítem
    const itemImage = document.createElement("div");
    itemImage.style.cssText = `
      width: 200px;
      height: 200px;
      background: rgba(100, 100, 100, 0.3) url('${item.image}') no-repeat center center;
      background-size: contain;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      flex-shrink: 0;
      border: 2px solid #4cff4c;
    `;
    itemImage.textContent = item.name.charAt(0); // Placeholder
    
    // Información del ítem
    const itemInfo = document.createElement("div");
    itemInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;

    // Título
    const title = document.createElement("h2");
    title.textContent = item.name;
    title.style.cssText = `
      margin: 0 0 10px 0;
      color: #4cff4c;
      font-size: 24px;
    `;
    
    // Precio
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
    
    // Añadir icono de moneda
    const coinIcon = document.createElement("span");
    coinIcon.innerHTML = '🪙';
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

    // Botón de compra
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
        background: ${item.owned ? '#666' : canAfford ? '#4CAF50' : '#d9534f'};
        color: white;
        border: none;
        border-radius: 5px;
        padding: 12px 25px;
        font-size: 14px;
        cursor: ${item.owned ? 'not-allowed' : canAfford ? 'pointer' : 'not-allowed'};
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      
      // Añadir icono
      const icon = document.createElement('span');
      icon.innerHTML = item.owned ? '✓' : canAfford ? '🛒' : '❌';
      buyButton.innerHTML = '';
      buyButton.appendChild(icon);
      buyButton.appendChild(document.createTextNode(
        item.owned 
          ? ' Ya comprado' 
          : canAfford 
            ? ` Comprar por $${item.price}` 
            : ` $${item.price} (No tienes suficientes monedas)`
      ));
    };
    
    updateButtonState();
    
    // Add hover effect if item is not owned and can be afforded
    if (!item.owned) {
      buyButton.addEventListener('mouseenter', () => {
        if (window.inventory?.coins >= item.price) {
          buyButton.style.transform = 'scale(1.02)';
          buyButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        }
      });
      
      buyButton.addEventListener('mouseleave', () => {
        buyButton.style.transform = '';
        buyButton.style.boxShadow = '';
      });
      
      buyButton.onclick = () => {
        if (!window.inventory) {
          console.error('No se encontró el inventario');
          return;
        }

        // 1. Verificar si el jugador tiene suficientes monedas
        if (window.inventory.coins < item.price) {
          window.inventory?.notify?.(`No tienes suficientes monedas. Necesitas $${item.price}`, 'error');
          return;
        }

        try {
          // 2. Mapa de herramientas a sus respectivos slots (0-based)
          const toolSlots = {
            'Llave Multipropósito': 0,  // Slot 1
            'Membrana de Vacío': 1,     // Slot 2
            'Chip de Navegación': 2,    // Slot 3
            'Catalizador de Plasma': 3, // Slot 4
            'Núcleo de Fusión': 4,      // Slot 5
            'Cristal de Poder': 5       // Slot 6
          };
          
          // 3. Obtener el índice del slot para esta herramienta
          const slotIndex = toolSlots[item.name];
          if (slotIndex === undefined) {
            console.warn(`No se encontró un slot definido para: ${item.name}`);
            window.inventory?.notify?.(`Error: No se pudo encontrar el slot para ${item.name}`, 'error');
            return;
          }

          // 4. Asegurarse de que el array de herramientas tenga el tamaño correcto
          while (window.inventory.tools.length <= slotIndex) {
            window.inventory.tools.push(null);
          }

          // 5. Verificar si el slot ya está ocupado
          if (window.inventory.tools[slotIndex] !== null) {
            window.inventory?.notify?.(`El slot ${slotIndex + 1} ya está ocupado`, 'error');
            return;
          }

          // 6. Primero intentamos agregar la herramienta al inventario
          const previousTool = window.inventory.tools[slotIndex];
          window.inventory.tools[slotIndex] = item.name;
          
          // 7. Verificar si se agregó correctamente
          if (window.inventory.tools[slotIndex] === item.name) {
            // 8. Si se agregó correctamente, restar las monedas
            window.inventory.coins -= item.price;
            item.owned = true;
            
            // 9. Actualizar la UI
            window.inventory._updateUI?.();
            updateButtonState();
            
            // 10. Actualizar el contador de monedas
            if (coinsDisplay) {
              coinsDisplay.textContent = `Monedas: ${window.inventory.coins} `;
              coinsDisplay.appendChild(coinIcon);
            }
            
            // 11. Notificar éxito
            window.inventory?.notify?.(`¡${item.name} comprado por $${item.price}!`, 'success');
            console.log(`Herramienta "${item.name}" agregada al inventario en el slot ${slotIndex + 1}`);
          } else {
            // Revertir si no se pudo agregar
            window.inventory.tools[slotIndex] = previousTool;
            throw new Error('No se pudo agregar la herramienta al inventario');
          }
          
        } catch (error) {
          console.error('Error al procesar la compra:', error);
          // Revertir cambios en caso de error
          item.owned = false;
          updateButtonState();
          window.inventory?._updateUI?.();
          window.inventory?.notify?.('Error al procesar la compra', 'error');
        }
      }
    };
    
    // No hay suficientes monedas (moved outside the click handler)
    if (window.inventory?.coins < item.price) {
      if (window.inventory.notify) {
        window.inventory.notify(`No tienes suficientes monedas. Necesitas $${item.price}`, 'error');
      }
    }

    // Ensamblar la vista de detalles
    itemInfo.appendChild(title);
    itemInfo.appendChild(price);
    itemInfo.appendChild(description);
    itemInfo.appendChild(buyButton);
    
    content.appendChild(itemImage);
    content.appendChild(itemInfo);
    detailsView.appendChild(content);
    
    // Añadir al documento
    document.body.appendChild(detailsView);
    
    // While the details view is open we must suppress the market-level outside click
    // handler (this.handleOutsideClick) because clicks inside the detailsView are
    // outside the marketUI and would otherwise close the market and re-open the chooser.
    try {
      document.removeEventListener('click', this.handleOutsideClick);
    } catch (e) {}

    // Manejar clic fuera para cerrar el panel de detalles
    const handleOutsideClick = (e) => {
      if (!detailsView.contains(e.target)) {
        // remove details view and restore main market UI
        try { document.body.removeChild(detailsView); } catch (err) {}
        if (this.marketUI) this.marketUI.style.display = 'block';
        // remove this temporary listener
        document.removeEventListener('click', handleOutsideClick);
        // re-enable the market-level outside click handler
        try { document.addEventListener('click', this.handleOutsideClick); } catch (err) {}
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
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

    // Determine desired behavior: explicit param overrides internal flag
    const shouldReturnToChooser = typeof returnToChooser === 'boolean' ? returnToChooser : !!this._returnToChooser;
    // reset flag
    this._returnToChooser = false;

    if (shouldReturnToChooser) {
      // Reopen the simple chooser menu after a short delay to avoid event conflicts
      setTimeout(() => {
        this.showInteractionChoice();
      }, 50);
      return;
    }

    // Otherwise, exit market as before
    try {
      // Re-enable player input because menus are now closed
      try { if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.setInputEnabled === 'function') window.farmerController.setInputEnabled(true); } catch(e) {}
      if (typeof window !== 'undefined' && window.farmerController && typeof window.farmerController.exitMarket === 'function') {
        window.farmerController.exitMarket(this);
      }
    } catch (e) {
      console.warn('Error al pedir al farmer que salga del mercado:', e);
    }
  }
}