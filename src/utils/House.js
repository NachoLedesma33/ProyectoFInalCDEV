import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

import { safePlaySfx } from './audioHelpers.js';


export class House {
  constructor(
    scene,
    position = { x: 0, y: 0, z: 0 },
    size = { width: 8, height: 6, depth: 8 }
  ) {
    this.scene = scene;
    this.position = position;
    this.size = size;
    this.walls = [];
    this.interiorObjects = [];
    this.collisionBoxes = [];
    this.gates = []; 
    this.gateSpeed = 4; 
    this.detectionDistance = 4.0; 
    this.autoCloseDelay = 5000; 
    this.autoCloseTimers = new Map(); 
    
    this.roofMeshes = []; 
    this.isInsideHouse = false; 
    
    this.houseBounds = {
      minX: this.position.x - this.size.width/2 - 1, 
      maxX: this.position.x + this.size.width/2 + 1,
      minZ: this.position.z - this.size.depth/2 - 1,
      maxZ: this.position.z + this.size.depth/2 + 1,
      minY: this.position.y,
      maxY: this.position.y + this.size.height
    };

    this.createHouse();
  }

  addCollision(object, side = 'furniture') {
    try {
      const collisionBox = new THREE.Box3().setFromObject(object);
      this.collisionBoxes.push({ box: collisionBox, side: side, wall: object });
    } catch (e) {
      const collisionBox = new THREE.Box3();
      collisionBox.makeEmpty();
      this.collisionBoxes.push({ box: collisionBox, side: side, wall: object });
    }
  }

  createInteriorDecorations(woodMaterial, metalMaterial) {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    const { width, depth } = this.size;

    const desk = new THREE.Group();
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.7), metalMaterial);
    deskTop.position.set(0, 0.75, 0);
    desk.add(deskTop);
    const deskLegGeom = new THREE.BoxGeometry(0.08, 0.75, 0.08);
    const deskLegs = [
      [-0.75, -0.3],
      [0.75, -0.3],
      [-0.75, 0.3],
      [0.75, 0.3],
    ];
    deskLegs.forEach((l) => {
      const leg = new THREE.Mesh(deskLegGeom, metalMaterial);
      leg.position.set(l[0], 0.375, l[1]);
      desk.add(leg);
    });
    desk.position.set(px - width / 4, py, pz + depth / 4 - 0.5);
    this.scene.add(desk);
    this.interiorObjects.push(desk);
    this.walls.push(desk);
  this.addCollision(desk, 'furniture');

    const bedGroup = new THREE.Group();
  const bedBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.9), metalMaterial);
    bedBase.position.set(0, 0.2, 0);
    bedGroup.add(bedBase);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.25, 0.85), metalMaterial);
    mattress.position.set(0, 0.45, 0);
    bedGroup.add(mattress);
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.12), metalMaterial);
    headboard.position.set(0, 0.65, -0.4);
    bedGroup.add(headboard);
    bedGroup.position.set(px + width / 4 - 1.0, py, pz - depth / 4 + 0.6);
    this.scene.add(bedGroup);
    this.interiorObjects.push(bedGroup);
    this.walls.push(bedGroup);
  this.addCollision(bedGroup, 'furniture');

    const wardrobe = new THREE.Group();
  const wardBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.6), metalMaterial);
    wardBody.position.set(0, 0.9, 0);
    wardrobe.add(wardBody);
    
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.7, 0.02), metalMaterial);
    leftDoor.position.set(-0.25, 0.9, 0.31);
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.7, 0.02), metalMaterial);
    rightDoor.position.set(0.25, 0.9, 0.31);
    wardrobe.add(leftDoor);
    wardrobe.add(rightDoor);
    wardrobe.position.set(px - width / 2 + 0.7, py, pz - depth / 4 + 0.6);
    this.scene.add(wardrobe);
    this.interiorObjects.push(wardrobe);
    this.walls.push(wardrobe);
  this.addCollision(wardrobe, 'furniture');

    const fridge = new THREE.Group();
    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), metalMaterial);
    fridgeBody.position.set(0, 0.8, 0);
    fridge.add(fridgeBody);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), metalMaterial);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.25, 0.9, 0.38);
    fridge.add(handle);
    fridge.position.set(px + width / 2 - 0.9, py, pz + depth / 4 - 0.6);
    this.scene.add(fridge);
    this.interiorObjects.push(fridge);
    this.walls.push(fridge);
  this.addCollision(fridge, 'furniture');

    const stove = new THREE.Group();
    const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.6), metalMaterial);
    stoveBody.position.set(0, 0.4, 0);
    stove.add(stoveBody);
    
    const burnerGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12);
    const burnerPositions = [[-0.25, -0.15], [0.25, -0.15], [-0.25, 0.15], [0.25, 0.15]];
    burnerPositions.forEach((b) => {
      const br = new THREE.Mesh(burnerGeom, metalMaterial);
      br.position.set(b[0], 0.82, b[1]);
      br.rotation.x = Math.PI / 2;
      stove.add(br);
    });
    stove.position.set(px + width / 2 - 1.6, py, pz + depth / 4 - 0.6);
    this.scene.add(stove);
    this.interiorObjects.push(stove);
    this.walls.push(stove);
  this.addCollision(stove, 'furniture');

    const cabinets = new THREE.Group();
  const cab1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.3), metalMaterial);
    cab1.position.set(0, 1.35, 0);
    cabinets.add(cab1);
  const cab2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), metalMaterial);
    cab2.position.set(0.9, 1.35, 0);
    cabinets.add(cab2);
    cabinets.position.set(px + width / 2 - 1.6, py, pz + depth / 4 - 0.6);
    this.scene.add(cabinets);
    this.interiorObjects.push(cabinets);
    this.walls.push(cabinets);
  this.addCollision(cabinets, 'furniture');
  }

  createHouse() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

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

        const brownMaterial = new THREE.MeshStandardMaterial({
          color: 0x8b4513, // Marrón madera
          metalness: 0.1,
          roughness: 0.8,
        });

        const roofMaterial = new THREE.MeshStandardMaterial({
          map: texture.clone(),
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        this.createWalls(stoneMaterial, brownMaterial);

        this.createRoof(roofMaterial);
        let concretePath;
        try {
          concretePath = new URL('../assets/concreteDIFF.png', import.meta.url).href;
        } catch (e) {
          concretePath = '/src/assets/concreteDIFF.png';
        }

        textureLoader.load(
          concretePath,
          (concreteTexture) => {
            concreteTexture.wrapS = THREE.RepeatWrapping;
            concreteTexture.wrapT = THREE.RepeatWrapping;
            concreteTexture.repeat.set(2, 2);

                const floorMaterial = new THREE.MeshStandardMaterial({
                  map: concreteTexture,
                  metalness: 0.02,
                  roughness: 0.9,
                  color: 0xffffff,
                });

                const metalMaterial = new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  metalness: 0.8,
                  roughness: 0.4,
                });

                this.createFloor(floorMaterial);
                this.createFurniture(metalMaterial, floorMaterial);
                this.createInteriorDecorations(brownMaterial, metalMaterial);
          },
          undefined,
          (err) => {
            console.warn(`House: no se pudo cargar la textura ${concretePath}, usando color gris.`, err);
            const floorMaterial = new THREE.MeshStandardMaterial({
              color: 0x666666,
              metalness: 0.02,
              roughness: 0.9,
            });

            const metalMaterial = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              metalness: 0.8,
              roughness: 0.4,
            });

            this.createFloor(floorMaterial);
            this.createFurniture(metalMaterial, floorMaterial);
            this.createInteriorDecorations(brownMaterial, metalMaterial);
          }
        );

        this.createDoor(stoneMaterial);
      },
      undefined,
      (error) => {
        return error;
        this.createHouseWithAlternativeMaterials();
      }
    );
  }

  createFloor(floorMaterial) {
    const { width, depth } = this.size;

    const floorGeometry = new THREE.BoxGeometry(width - 0.6, 0.12, depth - 0.6);
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.set(
      this.position.x,
      this.position.y + 0.06,
      this.position.z
    );
    floorMesh.receiveShadow = true;
    floorMesh.castShadow = false;
    this.scene.add(floorMesh);

    this.interiorObjects.push(floorMesh);
    this.walls.push(floorMesh);
  }

  createFurniture(metalMaterial, floorMaterial) {
    const tableGroup = new THREE.Group();

    const tableTopGeom = new THREE.BoxGeometry(2.0, 0.12, 1.2);
  const tableTop = new THREE.Mesh(tableTopGeom, metalMaterial);
    tableTop.position.set(0, 0.9, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    const legGeom = new THREE.BoxGeometry(0.12, 0.9, 0.12);
    const legOffsets = [
      [-0.9, -0.45],
      [0.9, -0.45],
      [-0.9, 0.45],
      [0.9, 0.45],
    ];

    legOffsets.forEach((off) => {
      const leg = new THREE.Mesh(legGeom, metalMaterial);
      leg.position.set(off[0], 0.45, off[1]);
      leg.castShadow = true;
      leg.receiveShadow = true;
      tableGroup.add(leg);
    });
    tableGroup.position.set(this.position.x, this.position.y, this.position.z - 0.5);
    this.scene.add(tableGroup);
    this.interiorObjects.push(tableGroup);
    this.walls.push(tableGroup);
  this.addCollision(tableGroup, 'furniture');

    const chairGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const backGeom = new THREE.BoxGeometry(0.5, 0.6, 0.12);

    const chair1 = new THREE.Group();
  const seat1 = new THREE.Mesh(chairGeom, metalMaterial);
    seat1.position.set(0, 0.25, 0);
  const back1 = new THREE.Mesh(backGeom, metalMaterial);
    back1.position.set(0, 0.6, -0.2);
    chair1.add(seat1);
    chair1.add(back1);
    chair1.position.set(this.position.x - 0.9, this.position.y, this.position.z - 0.5);
    chair1.rotation.y = Math.PI / 8;
    this.scene.add(chair1);
    this.interiorObjects.push(chair1);
    this.walls.push(chair1);
  this.addCollision(chair1, 'furniture');

    const chair2 = new THREE.Group();
  const seat2 = new THREE.Mesh(chairGeom, metalMaterial);
    seat2.position.set(0, 0.25, 0);
  const back2 = new THREE.Mesh(backGeom, metalMaterial);
    back2.position.set(0, 0.6, 0.2);
    chair2.add(seat2);
    chair2.add(back2);
    chair2.position.set(this.position.x + 0.9, this.position.y, this.position.z - 0.5);
    chair2.rotation.y = -Math.PI / 8;
    this.scene.add(chair2);
    this.interiorObjects.push(chair2);
    this.walls.push(chair2);
  this.addCollision(chair2, 'furniture');
  }

  createHouseWithAlternativeMaterials() {
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      metalness: 0.05,
      roughness: 0.95,
    });

    const brownMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Marrón madera
      metalness: 0.1,
      roughness: 0.8,
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gris piedra (igual que las paredes)
      metalness: 0.05,
      roughness: 0.95,
    });

    this.createWalls(stoneMaterial, brownMaterial);
    this.createRoof(roofMaterial);
    this.createDoor(stoneMaterial);
  }

  createWalls(stoneMaterial, brownMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    const frontWall = new THREE.BoxGeometry(width, height, wallThickness);
    const frontWallMesh = new THREE.Mesh(frontWall, stoneMaterial);
    frontWallMesh.position.set(
      this.position.x,
      this.position.y + height / 2,
      this.position.z - depth / 2
    );
    frontWallMesh.castShadow = true;
    frontWallMesh.receiveShadow = true;
    this.scene.add(frontWallMesh);
    this.walls.push(frontWallMesh);

    const backWall = new THREE.BoxGeometry(width, height, wallThickness);
    const backWallMesh = new THREE.Mesh(backWall, stoneMaterial);
    backWallMesh.position.set(
      this.position.x,
      this.position.y + height / 2,
      this.position.z + depth / 2
    );
    backWallMesh.castShadow = true;
    backWallMesh.receiveShadow = true;
    this.scene.add(backWallMesh);
    this.walls.push(backWallMesh);

    const leftWall = new THREE.BoxGeometry(wallThickness, height, depth);
    const leftWallMesh = new THREE.Mesh(leftWall, stoneMaterial);
    leftWallMesh.position.set(
      this.position.x - width / 2,
      this.position.y + height / 2,
      this.position.z
    );
    leftWallMesh.castShadow = true;
    leftWallMesh.receiveShadow = true;
    this.scene.add(leftWallMesh);
    this.walls.push(leftWallMesh);

    const doorHeight = 4.0;
    const doorWidth = 2.5;

    const rightWallTop = new THREE.BoxGeometry(
      wallThickness,
      height - doorHeight,
      depth
    );
    const rightWallTopMesh = new THREE.Mesh(rightWallTop, stoneMaterial);
    rightWallTopMesh.position.set(
      this.position.x + width / 2,
      this.position.y + height - (height - doorHeight) / 2,
      this.position.z
    );
    rightWallTopMesh.castShadow = true;
    rightWallTopMesh.receiveShadow = true;
    this.scene.add(rightWallTopMesh);
    this.walls.push(rightWallTopMesh);

    const rightWallBottomLeft = new THREE.BoxGeometry(
      wallThickness,
      doorHeight,
      depth / 2 - doorWidth / 2
    );
    const rightWallBottomLeftMesh = new THREE.Mesh(
      rightWallBottomLeft,
      stoneMaterial
    );
    rightWallBottomLeftMesh.position.set(
      this.position.x + width / 2,
      this.position.y + doorHeight / 2,
      this.position.z - depth / 4 - doorWidth / 4
    );
    rightWallBottomLeftMesh.castShadow = true;
    rightWallBottomLeftMesh.receiveShadow = true;
    this.scene.add(rightWallBottomLeftMesh);
    this.walls.push(rightWallBottomLeftMesh);

    const rightWallBottomRight = new THREE.BoxGeometry(
      wallThickness,
      doorHeight,
      depth / 2 - doorWidth / 2
    );
    const rightWallBottomRightMesh = new THREE.Mesh(
      rightWallBottomRight,
      stoneMaterial
    );
    rightWallBottomRightMesh.position.set(
      this.position.x + width / 2,
      this.position.y + doorHeight / 2,
      this.position.z + depth / 4 + doorWidth / 4
    );
    rightWallBottomRightMesh.castShadow = true;
    rightWallBottomRightMesh.receiveShadow = true;
    this.scene.add(rightWallBottomRightMesh);
    this.walls.push(rightWallBottomRightMesh);

    this.walls.forEach((wall) => {
      const collisionBox = new THREE.Box3().setFromObject(wall);
      this.collisionBoxes.push({
        box: collisionBox,
        side: "wall",
        wall: wall,
      });
    });
  }

  createRoof(roofMaterial) {
    const { width, height, depth } = this.size;

    const roofBase = new THREE.BoxGeometry(width + 1.0, 0.2, depth + 1.0);
    const roofBaseMesh = new THREE.Mesh(roofBase, roofMaterial);
    roofBaseMesh.position.set(
      this.position.x,
      this.position.y + height + 0.1,
      this.position.z
    );
    roofBaseMesh.castShadow = true;
    roofBaseMesh.receiveShadow = true;
    this.scene.add(roofBaseMesh);
    this.walls.push(roofBaseMesh);
    this.roofMeshes.push(roofBaseMesh);

    const roofGeometry = new THREE.ConeGeometry((width + 1.0) / 1.4, 2, 4);
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.set(
      this.position.x,
      this.position.y + height + 1.2,
      this.position.z
    );
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    this.scene.add(roofMesh);
    this.walls.push(roofMesh);
    this.roofMeshes.push(roofMesh);
  }

  createDoor(doorMaterial) {
    const { height } = this.size;
    const doorWidth = 2.5;
    const doorHeight = 4.0;
    const doorThickness = 0.2;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      metalness: 0.2,
      roughness: 0.7,
    });

    const frameGroup = new THREE.Group();

    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, doorHeight, 0.2),
      frameMaterial
    );
    leftFrame.position.set(-doorWidth / 2 - 0.1, doorHeight / 2, 0);
    frameGroup.add(leftFrame);

    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, doorHeight, 0.2),
      frameMaterial
    );
    rightFrame.position.set(doorWidth / 2 + 0.1, doorHeight / 2, 0);
    frameGroup.add(rightFrame);

    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth + 0.4, 0.2, 0.2),
      frameMaterial
    );
    topFrame.position.set(0, doorHeight, 0);
    frameGroup.add(topFrame);

    frameGroup.position.set(
      this.position.x + this.size.width / 2,
      this.position.y + doorHeight / 2,
      this.position.z
    );
    frameGroup.rotation.y = Math.PI / 2;
    this.scene.add(frameGroup);
    this.walls.push(frameGroup);

    const doorGroup = new THREE.Group();
    const doorGeometry = new THREE.BoxGeometry(
      doorWidth,
      doorHeight,
      doorThickness
    );
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(0, 0, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    doorGroup.add(doorMesh);

    const handleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2,
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(-doorWidth / 3, 0, doorThickness / 2 + 0.1);
    handle.rotation.z = Math.PI / 2;
    doorGroup.add(handle);

    doorGroup.position.set(
      this.position.x + this.size.width / 2 - doorThickness / 2,
      this.position.y + doorHeight / 2,
      this.position.z
    );

    doorGroup.rotation.y = Math.PI / 2;

    doorGroup.userData.pivotPoint = new THREE.Vector3(0, 0, doorWidth / 2);
    const gateData = {
      mesh: doorGroup,
      open: false,
      targetRotation: 0,
      currentRotation: 0,
      side: "main",
      originalPosition: doorGroup.position.clone(),
      baseRotation: Math.PI / 2,
    };

    this.gates.push(gateData);
    this.scene.add(doorGroup);

    this.updateSingleGateCollisionBox(gateData);
  }

  updateSingleGateCollisionBox(gateData) {
    this.collisionBoxes = this.collisionBoxes.filter(
      (box) => box.side !== `gate-${gateData.side}`
    );

    if (!gateData.open) {
      const gateBox = new THREE.Box3().setFromObject(gateData.mesh);
      this.collisionBoxes.push({
        box: gateBox,
        side: `gate-${gateData.side}`,
        wall: gateData.mesh,
      });
    }
  }
  isFarmerNearGate(farmerPosition, gateData) {
    const distance = farmerPosition.distanceTo(gateData.mesh.position);
    return distance <= this.detectionDistance;
  }

  openSingleGate(gateData) {
    if (gateData.open) return;

    gateData.open = true;
    gateData.targetRotation = Math.PI / 2;

    this.updateSingleGateCollisionBox(gateData);

    try {
      safePlaySfx('openDoor', { object3D: gateData.mesh });
    } catch (e) {
      // No bloquear si falla el audio
    }

    this.scheduleAutoClose(gateData);
  }

  closeSingleGate(gateData) {
    if (!gateData.open) return;

    gateData.open = false;
    gateData.targetRotation = 0;

    try {
      safePlaySfx('closeDoor', { object3D: gateData.mesh });
    } catch (e) {
      // Silenciar errores de audio
    }
  }

  scheduleAutoClose(gateData) {
    if (this.autoCloseTimers.has(gateData.side)) {
      clearTimeout(this.autoCloseTimers.get(gateData.side));
    }

    const timer = setTimeout(() => {
      this.closeSingleGate(gateData);
      this.autoCloseTimers.delete(gateData.side);
    }, this.autoCloseDelay);

    this.autoCloseTimers.set(gateData.side, timer);
  }
  resetAutoClose(gateData) {
    this.scheduleAutoClose(gateData);
  }

  updateGates(delta) {
    this.gates.forEach((gateData) => {
      this.updateSingleGate(gateData, delta);
    });
  }

  updateSingleGate(gateData, delta) {
    if (Math.abs(gateData.currentRotation - gateData.targetRotation) > 0.01) {
      const rotationStep = this.gateSpeed * delta;

      if (gateData.currentRotation < gateData.targetRotation) {
        gateData.currentRotation = Math.min(
          gateData.currentRotation + rotationStep,
          gateData.targetRotation
        );
      } else {
        gateData.currentRotation = Math.max(
          gateData.currentRotation - rotationStep,
          gateData.targetRotation
        );
      }
      this.applyGateRotation(gateData);
    } else if (gateData.currentRotation !== gateData.targetRotation) {
      gateData.currentRotation = gateData.targetRotation;
      this.applyGateRotation(gateData);

      if (!gateData.open) {
        this.updateSingleGateCollisionBox(gateData);
      }
    }
  }

  applyGateRotation(gateData) {
    const gate = gateData.mesh;
    const pivot = gate.userData.pivotPoint;
    const baseRotation = gateData.baseRotation || 0;
    gate.rotation.y = baseRotation + gateData.currentRotation;

    const rotatedPosition = pivot.clone();
    rotatedPosition.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      gateData.currentRotation
    );

    gate.position.copy(gateData.originalPosition);
    gate.position.sub(pivot);
    gate.position.add(rotatedPosition);
  }

  handleFarmerInteraction(farmerPosition) {
    if (this.gates.length === 0) {
      return;
    }

    this.gates.forEach((gateData) => {
      const distance = farmerPosition.distanceTo(gateData.mesh.position);

      if (this.isFarmerNearGate(farmerPosition, gateData)) {
        if (!gateData.open) {
          this.openSingleGate(gateData);
        } else {
          this.resetAutoClose(gateData);
        }
      }
    });
  }

  checkCollision(objectBox) {
    for (let collisionData of this.collisionBoxes) {
      if (objectBox.intersectsBox(collisionData.box)) {
        return collisionData;
      }
    }
    return null;
  }

  getClosestCollisionPoint(position, direction) {
    let closestCollision = null;
    let minDistance = Infinity;

    for (let collisionData of this.collisionBoxes) {
      const collisionPoint = this.getCollisionPoint(
        collisionData.box,
        position,
        direction
      );
      if (collisionPoint) {
        const distance = position.distanceTo(collisionPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestCollision = {
            point: collisionPoint,
            normal: this.getSurfaceNormal(collisionData.side),
            distance: distance,
            side: collisionData.side,
          };
        }
      }
    }

    return closestCollision;
  }

  getCollisionPoint(box, position, direction) {
    const ray = new THREE.Ray(position, direction);
    const intersectionPoint = new THREE.Vector3();

    if (ray.intersectBox(box, intersectionPoint)) {
      return intersectionPoint;
    }
    return null;
  }

  getSurfaceNormal(side) {
    switch (side) {
      case "wall":
        return new THREE.Vector3(0, 1, 0);
      default:
        return new THREE.Vector3(0, 1, 0);
    }
  }

  updateCollisionBoxes() {
    this.collisionBoxes.forEach((collisionData) => {
      collisionData.box.setFromObject(collisionData.wall);
    });
  }

  isPlayerInsideHouse(position) {
    return position.x >= this.houseBounds.minX && 
           position.x <= this.houseBounds.maxX &&
           position.z >= this.houseBounds.minZ && 
           position.z <= this.houseBounds.maxZ;
  }
  
  isAnyDoorOpen() {
    return this.gates.some(gate => gate.isOpen);
  }
  updateRoofVisibility(playerPosition) {
    if (!playerPosition) return;
    
    const wasInside = this.isInsideHouse;
    this.isInsideHouse = this.isPlayerInsideHouse(playerPosition);
    
    // Solo actualizar la visibilidad si el estado cambió
    if (wasInside !== this.isInsideHouse) {
      const shouldHideRoof = this.isInsideHouse;
      this.roofMeshes.forEach(mesh => {
        mesh.visible = !shouldHideRoof;
      });
    }
  }
  
  update(delta, farmerPosition = null) {
    this.updateGates(delta);
    if (farmerPosition) {
      this.handleFarmerInteraction(farmerPosition);
      this.updateRoofVisibility(farmerPosition);
    }
  }

  dispose() {
    
    this.autoCloseTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.autoCloseTimers.clear();
    const disposed = new Set();
    this.interiorObjects.forEach((obj) => {
      try {
        this.scene.remove(obj);
      } catch (e) {
        // ignore
      }
      disposed.add(obj);
      if (obj.traverse) {
        obj.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
      } else {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      }
    });
    this.interiorObjects = [];

    this.walls.forEach((wall) => {
      if (disposed.has(wall)) return;
      try {
        this.scene.remove(wall);
      } catch (e) {
        // ignore
      }
      if (wall.traverse) {
        wall.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
      } else {
        if (wall.geometry) wall.geometry.dispose();
        if (wall.material) {
          if (Array.isArray(wall.material)) wall.material.forEach((m) => m.dispose());
          else wall.material.dispose();
        }
      }
    });
    this.walls = [];
    this.collisionBoxes = [];
    this.gates = [];
  }
}
