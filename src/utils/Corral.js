import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { safePlaySfx } from './audioHelpers.js';


export class Corral {
  constructor(
    scene,
    position = { x: 0, y: 0, z: 0 },
    size = { width: 20, height: 2, depth: 20 }
  ) {
    this.scene = scene;
    this.position = new THREE.Vector3().copy(position);
    this.size = size || { width: 20, height: 2, depth: 20 };
    this.walls = [];
    this.gates = [];
    this.collisionBoxes = [];
    this.autoCloseTimers = new Map();
    this.autoCloseDelay = 2000; 
    this.gateSpeed = 4.0; 
    this.detectionDistance = 5; 
    this.maxHealth = 300; 
    this.health = this.maxHealth;
    this.wallHealth = 100; 
    this.wallSections = new Map(); 
    this.autoCloseDelay = 4000;
    this.autoCloseTimers = new Map(); 

    this.createCorral();
  }

  createCorral() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;
    const postHeight = height + 0.5;
    const postRadius = 0.15;

    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      metalness: 0.03,
      roughness: 0.9,
    });
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x654321,
      metalness: 0.02,
      roughness: 0.92,
    });
    this.createFenceWalls(woodMaterial, postMaterial);
    this.createAllPosts(postHeight, postRadius, postMaterial);

  }
  createFenceWalls(woodMaterial, postMaterial) {
    const { width, height, depth } = this.size;
    const gateWidth = 2.5;
    const plankThickness = 0.1;
    const plankHeight = 0.3;
    const spacing = 0.15;
    const centerWallWidth = width - gateWidth * 2;
    if (centerWallWidth > 0) {
      this.createFenceSection(
        new THREE.Vector3(
          this.position.x,
          this.position.y + height / 2,
          this.position.z - depth / 2
        ),
        centerWallWidth,
        height,
        plankThickness,
        plankHeight,
        spacing,
        woodMaterial,
        "front-center"
      );
    }
    this.createFenceSection(
      new THREE.Vector3(
        this.position.x,
        this.position.y + height / 2,
        this.position.z + depth / 2
      ),
      width,
      height,
      plankThickness,
      plankHeight,
      spacing,
      woodMaterial,
      "back"
    );

    this.createFenceSection(
      new THREE.Vector3(
        this.position.x - width / 2,
        this.position.y + height / 2,
        this.position.z
      ),
      plankThickness,
      height,
      depth,
      plankHeight,
      spacing,
      woodMaterial,
      "left"
    );
    this.createFenceSection(
      new THREE.Vector3(
        this.position.x + width / 2,
        this.position.y + height / 2,
        this.position.z
      ),
      plankThickness,
      height,
      depth,
      plankHeight,
      spacing,
      woodMaterial,
      "right"
    );

    this.createCornerGate(woodMaterial, gateWidth, "left");
    this.createCornerGate(woodMaterial, gateWidth, "right");
    }
  createCornerGate(woodMaterial, gateWidth, side) {
    const { height, width, depth } = this.size;
    const gateHeight = height - 0.2;
    const gateThickness = 0.08;
    const plankHeight = 0.2;
    const spacing = 0.1;


    this.createSingleGate(
      woodMaterial,
      gateWidth,
      gateHeight,
      gateThickness,
      plankHeight,
      spacing,
      side
    );
  }

  createSingleGate(
    woodMaterial,
    gateWidth,
    gateHeight,
    gateThickness,
    plankHeight,
    spacing,
    side
  ) {
    const { width, depth } = this.size;
    const gateGroup = new THREE.Group();
    const numPlanks = Math.floor(gateHeight / (plankHeight + spacing));
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.05, roughness: 0.85 });

    for (let i = 0; i < numPlanks; i++) {
      const plankGeometry = new THREE.BoxGeometry(
        gateWidth - 0.1,
        plankHeight,
        gateThickness
      );
      const plank = new THREE.Mesh(plankGeometry, woodMaterial);
      plank.position.set(
        0,
        i * (plankHeight + spacing) - gateHeight / 2 + plankHeight / 2,
        0
      );
      plank.castShadow = true;
      plank.receiveShadow = true;
      gateGroup.add(plank);
    }
    const frameGeometry = new THREE.BoxGeometry(
      gateWidth,
      0.08,
      gateThickness * 1.5
    );
    const topFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    topFrame.position.set(0, gateHeight / 2 - 0.04, 0);
    gateGroup.add(topFrame);

    const bottomFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    bottomFrame.position.set(0, -gateHeight / 2 + 0.04, 0);
    gateGroup.add(bottomFrame);
    const centerFrameGeometry = new THREE.BoxGeometry(
      0.06,
      gateHeight - 0.16,
      gateThickness * 1.5
    );
    const centerFrame = new THREE.Mesh(centerFrameGeometry, frameMaterial);
    centerFrame.position.set(0, 0, 0);
    gateGroup.add(centerFrame);
  const hingeGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8);
  const hingeMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, metalness: 0.15, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const hinge = new THREE.Mesh(hingeGeometry, hingeMaterial);
      const hingeY = (i - 1) * (gateHeight / 3);
      hinge.position.set(
        side === "left" ? -gateWidth / 2 + 0.05 : gateWidth / 2 - 0.05,
        hingeY,
        0
      );
      hinge.rotation.z = Math.PI / 2;
      gateGroup.add(hinge);
    }
    let gateX, gateZ;
    if (side === "left") {
      gateX = this.position.x - width / 2 + gateWidth / 2;
      gateZ = this.position.z - depth / 2 - gateThickness / 2;
    } else {
      gateX = this.position.x + width / 2 - gateWidth / 2;
      gateZ = this.position.z - depth / 2 - gateThickness / 2;
    }
    gateGroup.position.set(gateX, this.position.y + 1, gateZ);
    const pivotX = side === "left" ? gateWidth / 2 : -gateWidth / 2;
    gateGroup.userData.pivotPoint = new THREE.Vector3(pivotX, 0, 0);
    gateGroup.userData.side = side;
    const gateData = {
      mesh: gateGroup,
      open: false,
      targetRotation: 0,
      currentRotation: 0,
      side: side,
      originalPosition: gateGroup.position.clone(),
    };

    this.gates.push(gateData);
    this.scene.add(gateGroup);
    this.walls.push(gateGroup);
    this.updateSingleGateCollisionBox(gateData);
  }
  updateSingleGateCollisionBox(gateData) {
    // Eliminar la caja de colisión anterior de esta puerta si existe
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
  createFenceSection(
    position,
    width,
    height,
    thickness,
    plankHeight,
    spacing,
    material,
    side
  ) {
    const fenceGroup = new THREE.Group();
    const numPlanks = Math.floor(height / (plankHeight + spacing));
    for (let i = 0; i < numPlanks; i++) {
      const plankGeometry = new THREE.BoxGeometry(
        width,
        plankHeight,
        thickness
      );
      const plank = new THREE.Mesh(plankGeometry, material);
      plank.position.set(
        0,
        i * (plankHeight + spacing) - height / 2 + plankHeight / 2,
        0
      );
      plank.castShadow = true;
      plank.receiveShadow = true;
      fenceGroup.add(plank);
    }
  const railGeometry = new THREE.BoxGeometry(width, 0.05, thickness * 1.2);
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, metalness: 0.02, roughness: 0.9 });

    const rail1 = new THREE.Mesh(railGeometry, railMaterial);
    rail1.position.set(0, -height / 3, 0);
    fenceGroup.add(rail1);

    const rail2 = new THREE.Mesh(railGeometry, railMaterial);
    rail2.position.set(0, height / 3, 0);
    fenceGroup.add(rail2);

    fenceGroup.position.copy(position);
    this.scene.add(fenceGroup);
    this.walls.push(fenceGroup);
    const collisionBox = new THREE.Box3().setFromObject(fenceGroup);
    this.collisionBoxes.push({
      box: collisionBox,
      side: side,
      wall: fenceGroup,
    });
  }
  createWall(position, width, height, depth, material, side) {
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.copy(position);
    wall.castShadow = true;
    wall.receiveShadow = true;

    this.scene.add(wall);
    this.walls.push(wall);
    const collisionBox = new THREE.Box3().setFromObject(wall);
    this.collisionBoxes.push({
      box: collisionBox,
      side: side,
      wall: wall,
    });
  }
  createAllPosts(height, radius, material) {
    const { width, depth } = this.size;
    const postSpacing = 3;
    const gateWidth = 4;
    const cornerPositions = [
      { x: this.position.x - width / 2, z: this.position.z - depth / 2 },
      { x: this.position.x + width / 2, z: this.position.z - depth / 2 },
      { x: this.position.x - width / 2, z: this.position.z + depth / 2 },
      { x: this.position.x + width / 2, z: this.position.z + depth / 2 },
    ];
    cornerPositions.forEach((pos) => {
      this.createPost(pos.x, pos.z, height, radius, material, "corner-post");
    });
    for (let x = -width / 2 + postSpacing; x < width / 2; x += postSpacing) {
      if (Math.abs(x) > 0.1) {
        // Evitar duplicar el poste central
        this.createPost(
          this.position.x + x,
          this.position.z + depth / 2,
          height,
          radius,
          material,
          "back-post"
        );
      }
    }
    for (let z = -depth / 2 + postSpacing; z < depth / 2; z += postSpacing) {
      if (Math.abs(z) > 0.1) {
        this.createPost(
          this.position.x - width / 2,
          this.position.z + z,
          height,
          radius,
          material,
          "left-post"
        );
      }
    }
    for (let z = -depth / 2 + postSpacing; z < depth / 2; z += postSpacing) {
      if (Math.abs(z) > 0.1) {
        this.createPost(
          this.position.x + width / 2,
          this.position.z + z,
          height,
          radius,
          material,
          "right-post"
        );
      }
    }
    for (
      let x = -width / 2 + postSpacing;
      x < -(gateWidth / 2);
      x += postSpacing
    ) {
      this.createPost(
        this.position.x + x,
        this.position.z - depth / 2,
        height,
        radius,
        material,
        "front-left-post"
      );
    }
    for (let x = gateWidth / 2 + postSpacing; x < width / 2; x += postSpacing) {
      this.createPost(
        this.position.x + x,
        this.position.z - depth / 2,
        height,
        radius,
        material,
        "front-right-post"
      );
    }
    this.createPost(
      this.position.x - gateWidth / 2,
      this.position.z - depth / 2,
      height,
      radius * 1.2,
      material,
      "gate-post"
    );
    this.createPost(
      this.position.x + gateWidth / 2,
      this.position.z - depth / 2,
      height,
      radius * 1.2,
      material,
      "gate-post"
    );
  }
  createPost(x, z, height, radius, material, side) {
    const postGeometry = new THREE.CylinderGeometry(radius, radius, height, 8);
    const post = new THREE.Mesh(postGeometry, material);
    post.position.set(x, this.position.y + height / 2 - 0.25, z);
    post.castShadow = true;
    post.receiveShadow = true;

    this.scene.add(post);
    this.walls.push(post);
    const collisionBox = new THREE.Box3().setFromObject(post);
    this.collisionBoxes.push({
      box: collisionBox,
      side: side,
      wall: post,
    });
  }

  isFarmerNearGate(farmerPosition, gateData) {
    const distance = farmerPosition.distanceTo(gateData.mesh.position);
    return distance <= this.detectionDistance;
  }
  openSingleGate(gateData) {
    if (gateData.open) return;

    gateData.open = true;
    const direction = gateData.side === "left" ? 1 : -1;
    gateData.targetRotation = (Math.PI / 2) * direction;
    this.updateSingleGateCollisionBox(gateData);
    try {
      if (gateData && gateData.mesh) {
        try { safePlaySfx('corralOpen', { object3D: gateData.mesh, volume: 0.95 }); } catch(_) {}
      }
    } catch(_) {}
    this.scheduleAutoClose(gateData);
  }
  closeSingleGate(gateData) {
    if (!gateData.open) return;

    gateData.open = false;
    gateData.targetRotation = 0;
    try {
      if (gateData && gateData.mesh) {
        try { safePlaySfx('corralClose', { object3D: gateData.mesh, volume: 0.95 }); } catch(_) {}
      }
    } catch(_) {}

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
    gate.rotation.y = gateData.currentRotation;
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
        if (!this.wallSections.has(collisionData.side)) {
          this.wallSections.set(collisionData.side, this.wallHealth);
        }
        return collisionData;
      }
    }
    return null;
  }

  damageWall(wallSection, damage = 10) { 
    if (!this.wallSections.has(wallSection)) {
      this.wallSections.set(wallSection, this.wallHealth);
    }
    const currentHealth = this.wallSections.get(wallSection);
    const newHealth = Math.max(0, currentHealth - damage);
    this.wallSections.set(wallSection, newHealth);
    this.health = Math.max(0, this.health - damage);
    if (this.healthComponent) {
      this.healthComponent.current = Math.max(0, this.health);
      if (this.healthComponent.onDamage) {
        this.healthComponent.onDamage(damage, { type: 'wall' });
      }
    }
    if (this.health <= 0) {
      this.destroyWall(wallSection);
      return true;
    }
    return false;
  }
  destroyWall(wallSection) {
    const wallsToRemove = this.collisionBoxes.filter(collisionData => 
      collisionData.side === wallSection || 
      collisionData.side.startsWith(wallSection + '-')
    );
    
    wallsToRemove.forEach(collisionData => {
      if (collisionData.wall) {
        this.scene.remove(collisionData.wall);
        if (collisionData.wall.geometry) {
          collisionData.wall.geometry.dispose();
        }
        if (collisionData.wall.material) {
          if (Array.isArray(collisionData.wall.material)) {
            collisionData.wall.material.forEach(mat => mat.dispose());
          } else {
            collisionData.wall.material.dispose();
          }
        }
      }
    });
    this.collisionBoxes = this.collisionBoxes.filter(collisionData => 
      collisionData.side !== wallSection && 
      !collisionData.side.startsWith(wallSection + '-')
    );
    this.walls = this.walls.filter(wall => {
      const isInRemoved = wallsToRemove.some(removed => removed.wall === wall);
      return !isInRemoved;
    });
    this.wallSections.delete(wallSection);
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
      case "front-left":
      case "front-right":
        return new THREE.Vector3(0, 0, 1);
      case "back":
        return new THREE.Vector3(0, 0, -1);
      case "left":
        return new THREE.Vector3(1, 0, 0);
      case "right":
        return new THREE.Vector3(-1, 0, 0);
      case "post":
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


  update(delta, farmerPosition = null) {
    this.updateGates(delta);
    if (farmerPosition) {
      this.handleFarmerInteraction(farmerPosition);
    }
  }

  dispose() {
    this.cancelAutoClose();

    this.walls.forEach((wall) => {
      this.scene.remove(wall);
      if (wall.geometry) wall.geometry.dispose();
      if (wall.material) wall.material.dispose();
    });
    this.walls = [];
    this.collisionBoxes = [];
    this.gate = null;
  }
}
