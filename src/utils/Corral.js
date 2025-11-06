import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { safePlaySfx } from './audioHelpers.js';

/**
 * Clase para crear un corral para vacas con sistema de colisiones y puerta interactiva
 */
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
    this.autoCloseDelay = 2000; // 2 segundos para el cierre automático
    this.gateSpeed = 4.0; // Velocidad de apertura/cierre de puertas (más rápida para fluidez)
    this.detectionDistance = 5; // Distancia para detectar al granjero
    
    // Health system - Increased wall health for more gradual damage
    this.maxHealth = 300; // Increased from 100 to 300 for more granular control
    this.health = this.maxHealth;
    this.wallHealth = 100; // Increased from 50 to 100 for more gradual damage
    this.wallSections = new Map(); // Track health of individual wall sections
    this.autoCloseDelay = 4000; // 4 segundos para autocierre
    this.autoCloseTimers = new Map(); // Timers para cada puerta

    this.createCorral();
  }

  // audio helper import is at top via patch below

  /**
   * Crea el corral con sus paredes, sistema de colisiones y puerta interactiva
   */
  createCorral() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;
    const postHeight = height + 0.5;
    const postRadius = 0.15;

    // Material para las tablas de madera con aspecto menos brillante (PBR)
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Color marrón madera
      metalness: 0.03,
      roughness: 0.9,
    });

    // Material para los postes más oscuro
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x654321, // Color marrón oscuro para postes
      metalness: 0.02,
      roughness: 0.92,
    });

    // Crear las cuatro paredes del corral como vallas de madera (con espacio para la puerta)
    this.createFenceWalls(woodMaterial, postMaterial);

    // Añadir postes en las esquinas y a lo largo de las paredes
    this.createAllPosts(postHeight, postRadius, postMaterial);

  }

  /**
   * Crea las paredes del corral como vallas de madera con espacio para la puerta
   */
  createFenceWalls(woodMaterial, postMaterial) {
    const { width, height, depth } = this.size;
    const gateWidth = 2.5; // Ancho de cada puerta
    const plankThickness = 0.1;
    const plankHeight = 0.3;
    const spacing = 0.15; // Espacio entre tablas

    // Crear valla frontal central (entre las dos puertas)
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

    // Valla trasera completa
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

    // Valla izquierda completa
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

    // Valla derecha completa
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

    // Crear puertas en las esquinas
    this.createCornerGate(woodMaterial, gateWidth, "left");
    this.createCornerGate(woodMaterial, gateWidth, "right");
  }

  /**
   * Crea una puerta en la esquina del corral
   */
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

  /**
     * Crea una puerta individual
{{ ... }}
     */
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

  // Material para los marcos y bisagras (PBR para menos brillo)
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.05, roughness: 0.85 });

    // Crear tablas verticales de la puerta
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

    // Añadir marcos horizontales (superior e inferior)
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

    // Añadir marco vertical central
    const centerFrameGeometry = new THREE.BoxGeometry(
      0.06,
      gateHeight - 0.16,
      gateThickness * 1.5
    );
    const centerFrame = new THREE.Mesh(centerFrameGeometry, frameMaterial);
    centerFrame.position.set(0, 0, 0);
    gateGroup.add(centerFrame);

    // Añadir bisagras visibles
  const hingeGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8);
  const hingeMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, metalness: 0.15, roughness: 0.6 });

    // Bisagras en el lado de la puerta
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

    // Posicionar la puerta en la esquina correspondiente
    let gateX, gateZ;
    if (side === "left") {
      // Esquina izquierda frontal
      gateX = this.position.x - width / 2 + gateWidth / 2;
      gateZ = this.position.z - depth / 2 - gateThickness / 2;
    } else {
      // Esquina derecha frontal
      gateX = this.position.x + width / 2 - gateWidth / 2;
      gateZ = this.position.z - depth / 2 - gateThickness / 2;
    }
    gateGroup.position.set(gateX, this.position.y + 1, gateZ);

    // Configurar el punto de rotación (bisagras)
    const pivotX = side === "left" ? gateWidth / 2 : -gateWidth / 2;
    gateGroup.userData.pivotPoint = new THREE.Vector3(pivotX, 0, 0);
    gateGroup.userData.side = side;

    // Estado de la puerta
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


    // Añadir caja de colisión inicial
    this.updateSingleGateCollisionBox(gateData);
  }

  /**
   * Actualiza la caja de colisión de una puerta individual según su estado
   * @param {Object} gateData - Datos de la puerta
   */
  updateSingleGateCollisionBox(gateData) {
    // Eliminar la caja de colisión anterior de esta puerta si existe
    this.collisionBoxes = this.collisionBoxes.filter(
      (box) => box.side !== `gate-${gateData.side}`
    );

    if (!gateData.open) {
      // Añadir caja de colisión para la puerta cerrada
      const gateBox = new THREE.Box3().setFromObject(gateData.mesh);
      this.collisionBoxes.push({
        box: gateBox,
        side: `gate-${gateData.side}`,
        wall: gateData.mesh,
      });
    }
  }

  /**
   * Crea una sección de valla con tablas individuales
   */
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

    // Crear tablas verticales
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

    // Añadir travesaños horizontales para mayor realismo
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

    // Crear caja de colisión para esta sección de valla
    const collisionBox = new THREE.Box3().setFromObject(fenceGroup);
    this.collisionBoxes.push({
      box: collisionBox,
      side: side,
      wall: fenceGroup,
    });
  }

  /**
   * Crea una pared individual con su caja de colisión (método de compatibilidad)
   */
  createWall(position, width, height, depth, material, side) {
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.copy(position);
    wall.castShadow = true;
    wall.receiveShadow = true;

    this.scene.add(wall);
    this.walls.push(wall);

    // Crear caja de colisión para esta pared
    const collisionBox = new THREE.Box3().setFromObject(wall);
    this.collisionBoxes.push({
      box: collisionBox,
      side: side,
      wall: wall,
    });
  }

  /**
   * Crea postes en las esquinas y a lo largo de las paredes del corral
   */
  createAllPosts(height, radius, material) {
    const { width, depth } = this.size;
    const postSpacing = 3; // Espacio entre postes
    const gateWidth = 4;

    // Postes de esquina
    const cornerPositions = [
      { x: this.position.x - width / 2, z: this.position.z - depth / 2 },
      { x: this.position.x + width / 2, z: this.position.z - depth / 2 },
      { x: this.position.x - width / 2, z: this.position.z + depth / 2 },
      { x: this.position.x + width / 2, z: this.position.z + depth / 2 },
    ];

    // Crear postes de esquina
    cornerPositions.forEach((pos) => {
      this.createPost(pos.x, pos.z, height, radius, material, "corner-post");
    });

    // Postes a lo largo de las paredes

    // Pared trasera
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

    // Pared izquierda
    for (let z = -depth / 2 + postSpacing; z < depth / 2; z += postSpacing) {
      if (Math.abs(z) > 0.1) {
        // Evitar duplicar el poste central
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

    // Pared derecha
    for (let z = -depth / 2 + postSpacing; z < depth / 2; z += postSpacing) {
      if (Math.abs(z) > 0.1) {
        // Evitar duplicar el poste central
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

    // Pared frontal (con espacio para la puerta)
    // Postes a la izquierda de la puerta
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

    // Postes a la derecha de la puerta
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

    // Postes especiales para la puerta
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

  /**
   * Crea un poste individual
   */
  createPost(x, z, height, radius, material, side) {
    const postGeometry = new THREE.CylinderGeometry(radius, radius, height, 8);
    const post = new THREE.Mesh(postGeometry, material);
    post.position.set(x, this.position.y + height / 2 - 0.25, z);
    post.castShadow = true;
    post.receiveShadow = true;

    this.scene.add(post);
    this.walls.push(post);

    // Añadir caja de colisión para el poste
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

  /**
   * Abre una puerta individual
   * @param {Object} gateData - Datos de la puerta
   */
  openSingleGate(gateData) {
    if (gateData.open) return;

    gateData.open = true;
    // Abrir 90 grados hacia afuera (dirección depende del lado)
    const direction = gateData.side === "left" ? 1 : -1;
    gateData.targetRotation = (Math.PI / 2) * direction;

    // Eliminar la colisión de la puerta
    this.updateSingleGateCollisionBox(gateData);

    // play open SFX positional on the gate mesh
    try {
      if (gateData && gateData.mesh) {
        try { safePlaySfx('corralOpen', { object3D: gateData.mesh, volume: 0.95 }); } catch(_) {}
      }
    } catch(_) {}
    // Configurar autocierre
    this.scheduleAutoClose(gateData);
  }

  /**
   * Cierra una puerta individual
   * @param {Object} gateData - Datos de la puerta
   */
  closeSingleGate(gateData) {
    if (!gateData.open) return;

    gateData.open = false;
    gateData.targetRotation = 0;

    // play close SFX positional on the gate mesh
    try {
      if (gateData && gateData.mesh) {
        try { safePlaySfx('corralClose', { object3D: gateData.mesh, volume: 0.95 }); } catch(_) {}
      }
    } catch(_) {}

  }

  /**
   * Programa el autocierre de una puerta
   * @param {Object} gateData - Datos de la puerta
   */
  scheduleAutoClose(gateData) {
    // Cancelar timer existente para esta puerta
    if (this.autoCloseTimers.has(gateData.side)) {
      clearTimeout(this.autoCloseTimers.get(gateData.side));
    }

    const timer = setTimeout(() => {
      this.closeSingleGate(gateData);
      this.autoCloseTimers.delete(gateData.side);
    }, this.autoCloseDelay);

    this.autoCloseTimers.set(gateData.side, timer);
  }

  /**
   * Reinicia el autocierre de una puerta
   * @param {Object} gateData - Datos de la puerta
   */
  resetAutoClose(gateData) {
    this.scheduleAutoClose(gateData);
  }

  /**
   * Actualiza el estado de todas las puertas (animación de apertura/cierre)
   * @param {number} delta - Tiempo transcurrido
   */
  updateGates(delta) {
    this.gates.forEach((gateData) => {
      this.updateSingleGate(gateData, delta);
    });
  }

  /**
   * Actualiza el estado de una puerta individual
   * @param {Object} gateData - Datos de la puerta
   * @param {number} delta - Tiempo transcurrido
   */
  updateSingleGate(gateData, delta) {
    // Animación de apertura/cierre
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

      // Aplicar rotación a la puerta alrededor del punto de pivote
      this.applyGateRotation(gateData);
    } else if (gateData.currentRotation !== gateData.targetRotation) {
      // La animación ha terminado
      gateData.currentRotation = gateData.targetRotation;
      this.applyGateRotation(gateData);

      // Si la puerta se cerró, actualizar la caja de colisión
      if (!gateData.open) {
        this.updateSingleGateCollisionBox(gateData);
      }
    }
  }

  /**
   * Aplica rotación a una puerta alrededor de su punto de pivote
   * @param {Object} gateData - Datos de la puerta
   */
  applyGateRotation(gateData) {
    const gate = gateData.mesh;
    const pivot = gate.userData.pivotPoint;

    // Rotar la puerta
    gate.rotation.y = gateData.currentRotation;

    // Ajustar la posición para que gire alrededor del punto de pivote
    const rotatedPosition = pivot.clone();
    rotatedPosition.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      gateData.currentRotation
    );

    gate.position.copy(gateData.originalPosition);
    gate.position.sub(pivot);
    gate.position.add(rotatedPosition);
  }

  /**
   * Maneja la interacción con el farmer
   * @param {THREE.Vector3} farmerPosition - Posición del farmer
   */
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
          // Si el farmer está cerca y la puerta está abierta, reiniciar autocierre
          this.resetAutoClose(gateData);
        }
      }
    });
  }

  checkCollision(objectBox) {
    for (let collisionData of this.collisionBoxes) {
      if (objectBox.intersectsBox(collisionData.box)) {
        // Initialize health for this wall section if it doesn't exist
        if (!this.wallSections.has(collisionData.side)) {
          this.wallSections.set(collisionData.side, this.wallHealth);
        }
        return collisionData;
      }
    }
    return null;
  }

  /**
   * Apply damage to a specific wall section
   * @param {string} wallSection - The section identifier (e.g., 'left', 'right', 'front', 'back')
   * @param {number} damage - Amount of damage to apply
   * @returns {boolean} - Returns true if the wall was destroyed
   */
  damageWall(wallSection, damage = 10) { // Default damage is now 10 as per requirement
    if (!this.wallSections.has(wallSection)) {
      this.wallSections.set(wallSection, this.wallHealth);
    }
    
    // Only track wall section health for reference, but don't destroy based on it
    const currentHealth = this.wallSections.get(wallSection);
    const newHealth = Math.max(0, currentHealth - damage);
    this.wallSections.set(wallSection, newHealth);
    
    // Reduce main corral health by the full damage amount
    this.health = Math.max(0, this.health - damage);
    
    // Update the health component if it exists
    if (this.healthComponent) {
      this.healthComponent.current = Math.max(0, this.health);
      // Trigger health update in the UI
      if (this.healthComponent.onDamage) {
        this.healthComponent.onDamage(damage, { type: 'wall' });
      }
    }
    
    console.log(`Wall ${wallSection} section health: ${newHealth}/${this.wallHealth}, Corral total health: ${this.health}/${this.maxHealth}`);
    
    // Only destroy walls when the entire corral's health reaches zero
    if (this.health <= 0) {
      console.log('Corral health reached zero, destroying wall section:', wallSection);
      this.destroyWall(wallSection);
      return true;
    }
    
    return false;
  }
  
  /**
   * Remove a wall section when its health reaches zero
   * @param {string} wallSection - The section identifier to remove
   */
  destroyWall(wallSection) {
    console.log(`Destroying wall section: ${wallSection}`);
    
    // Find and remove all walls with this section identifier
    const wallsToRemove = this.collisionBoxes.filter(collisionData => 
      collisionData.side === wallSection || 
      collisionData.side.startsWith(wallSection + '-')
    );
    
    wallsToRemove.forEach(collisionData => {
      // Remove from scene
      if (collisionData.wall) {
        this.scene.remove(collisionData.wall);
        
        // Dispose of geometry and materials if they exist
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
    
    // Remove from collision boxes
    this.collisionBoxes = this.collisionBoxes.filter(collisionData => 
      collisionData.side !== wallSection && 
      !collisionData.side.startsWith(wallSection + '-')
    );
    
    // Remove from walls array
    this.walls = this.walls.filter(wall => {
      const isInRemoved = wallsToRemove.some(removed => removed.wall === wall);
      return !isInRemoved;
    });
    
    // Remove from wall sections tracking
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

  /**
   * Obtiene la normal de la superficie según el lado del corral
   */
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

  /**
   * Actualiza las cajas de colisión (útil si el corral se mueve)
   */
  updateCollisionBoxes() {
    this.collisionBoxes.forEach((collisionData) => {
      collisionData.box.setFromObject(collisionData.wall);
    });
  }


  update(delta, farmerPosition = null) {
    // Actualizar animaciones de las puertas
    this.updateGates(delta);

    // Manejar interacción con el farmer
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
