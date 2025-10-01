import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

/**
 * Clase para crear una casa con textura de piedra y puerta interactiva
 */
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
    this.collisionBoxes = [];
    this.gates = []; // Array para puertas
    this.gateSpeed = 2; // Velocidad de apertura/cierre de la puerta
    this.detectionDistance = 4.0; // Distancia de detección del farmer (aumentada)
    this.autoCloseDelay = 5000; // 5 segundos para autocierre
    this.autoCloseTimers = new Map(); // Timers para cada puerta
    
    // Propiedades para optimización de rendimiento
    this.lastFarmerPosition = null;
    this.lastInteractionCheck = 0;

    this.createHouse();
  }

  /**
   * Crea la casa con sus paredes, techo, puerta y sistema de colisiones
   */
  createHouse() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;
    
    // Cargar la textura de piedra
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/coral_gravel/coral_gravel_diff_4k.jpg",
      (texture) => {
        console.log("✅ Textura de grava de coral cargada para la casa");
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Repetir la textura para mejor cobertura
        
        // Material principal de piedra
        const stoneMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff
        });

        // Material secundario marrón para detalles
        const brownMaterial = new THREE.MeshStandardMaterial({
          color: 0x8B4513, // Marrón madera
          metalness: 0.1,
          roughness: 0.8
        });

        // Material para el techo (misma textura de grava de coral)
        const roofMaterial = new THREE.MeshStandardMaterial({
          map: texture.clone(),
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff
        });

        // Crear las paredes de la casa
        this.createWalls(stoneMaterial, brownMaterial);
        
        // Crear el techo
        this.createRoof(roofMaterial);
        
        // Crear la puerta principal con la misma textura de piedra
        this.createDoor(stoneMaterial);
        
        console.log("Casa creada con sistema de colisiones y puerta interactiva");
      },
      undefined,
      (error) => {
        console.warn("No se pudo cargar la textura de grava de coral, usando materiales alternativos:", error);
        // Usar materiales alternativos si la textura no carga
        this.createHouseWithAlternativeMaterials();
      }
    );
  }

  /**
   * Crea la casa con materiales alternativos si la textura no carga
   */
  createHouseWithAlternativeMaterials() {
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gris piedra
      metalness: 0.05,
      roughness: 0.95
    });

    const brownMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // Marrón madera
      metalness: 0.1,
      roughness: 0.8
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gris piedra (igual que las paredes)
      metalness: 0.05,
      roughness: 0.95
    });

    this.createWalls(stoneMaterial, brownMaterial);
    this.createRoof(roofMaterial);
    this.createDoor(stoneMaterial);
    
    console.log("Casa creada con materiales alternativos");
  }

  /**
   * Crea las paredes de la casa
   */
  createWalls(stoneMaterial, brownMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    // Pared frontal (completa, sin puerta)
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

    // Pared trasera
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

    // Pared izquierda
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

    // Pared derecha (con espacio para la puerta)
    const doorHeight = 4.0; // Altura de la puerta
    const doorWidth = 2.5; // Ancho de la puerta
    
    // Parte superior de la pared derecha
    const rightWallTop = new THREE.BoxGeometry(wallThickness, height - doorHeight, depth);
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
    
    // Parte inferior izquierda de la pared derecha (antes de la puerta)
    const rightWallBottomLeft = new THREE.BoxGeometry(wallThickness, doorHeight, (depth / 2) - (doorWidth / 2));
    const rightWallBottomLeftMesh = new THREE.Mesh(rightWallBottomLeft, stoneMaterial);
    rightWallBottomLeftMesh.position.set(
      this.position.x + width / 2,
      this.position.y + doorHeight / 2,
      this.position.z - (depth / 4) - (doorWidth / 4)
    );
    rightWallBottomLeftMesh.castShadow = true;
    rightWallBottomLeftMesh.receiveShadow = true;
    this.scene.add(rightWallBottomLeftMesh);
    this.walls.push(rightWallBottomLeftMesh);
    
    // Parte inferior derecha de la pared derecha (después de la puerta)
    const rightWallBottomRight = new THREE.BoxGeometry(wallThickness, doorHeight, (depth / 2) - (doorWidth / 2));
    const rightWallBottomRightMesh = new THREE.Mesh(rightWallBottomRight, stoneMaterial);
    rightWallBottomRightMesh.position.set(
      this.position.x + width / 2,
      this.position.y + doorHeight / 2,
      this.position.z + (depth / 4) + (doorWidth / 4)
    );
    rightWallBottomRightMesh.castShadow = true;
    rightWallBottomRightMesh.receiveShadow = true;
    this.scene.add(rightWallBottomRightMesh);
    this.walls.push(rightWallBottomRightMesh);

    // Añadir cajas de colisión para las paredes
    this.walls.forEach((wall) => {
      const collisionBox = new THREE.Box3().setFromObject(wall);
      this.collisionBoxes.push({
        box: collisionBox,
        side: "wall",
        wall: wall,
      });
    });
  }

  /**
   * Crea el techo de la casa
   */
  createRoof(roofMaterial) {
    const { width, height, depth } = this.size;
    
    // Techo principal (plano base) - aumentado para cubrir completamente la casa
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

    // Techo inclinado (forma triangular) - ajustado al nuevo tamaño del techo base
    const roofGeometry = new THREE.ConeGeometry((width + 1.0) / 1.4, 2, 4);
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.set(
      this.position.x,
      this.position.y + height + 1.2,
      this.position.z
    );
    roofMesh.rotation.y = Math.PI / 4; // Rotar 45 grados para alinear con la casa
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    this.scene.add(roofMesh);
    this.walls.push(roofMesh);
  }

  /**
   * Crea la puerta principal de la casa
   */
  createDoor(doorMaterial) {
    const { height } = this.size;
    const doorWidth = 2.5; // Puerta más grande y visible
    const doorHeight = 4.0; // Puerta más alta
    const doorThickness = 0.2; // Puerta más gruesa para mayor visibilidad

    // Crear el marco fijo por separado
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a, // Gris oscuro para el marco
      metalness: 0.2,
      roughness: 0.7
    });

    const frameGroup = new THREE.Group();
    
    // Lado izquierdo del marco
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, doorHeight, 0.2), // Marco más grueso
      frameMaterial
    );
    leftFrame.position.set(-doorWidth / 2 - 0.1, doorHeight / 2, 0);
    frameGroup.add(leftFrame);

    // Lado derecho del marco
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, doorHeight, 0.2), // Marco más grueso
      frameMaterial
    );
    rightFrame.position.set(doorWidth / 2 + 0.1, doorHeight / 2, 0);
    frameGroup.add(rightFrame);

    // Parte superior del marco
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth + 0.4, 0.2, 0.2), // Marco más grueso
      frameMaterial
    );
    topFrame.position.set(0, doorHeight, 0);
    frameGroup.add(topFrame);

    // Posicionar el marco fijo en la pared
    frameGroup.position.set(
      this.position.x + this.size.width / 2,
      this.position.y + doorHeight / 2,
      this.position.z
    );
    frameGroup.rotation.y = Math.PI / 2;
    this.scene.add(frameGroup);
    this.walls.push(frameGroup); // Añadir el marco a las paredes para colisiones

    // Crear la puerta móvil por separado
    const doorGroup = new THREE.Group();

    // Hoja de la puerta
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(0, 0, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    doorGroup.add(doorMesh);

    // Manija de la puerta
    const handleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8); // Manija más grande
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700, // Dorado para la manija
      metalness: 0.8,
      roughness: 0.2
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    // Posicionar la manija en el lado correcto de la puerta (considerando la rotación)
    handle.position.set(-doorWidth / 3, 0, doorThickness / 2 + 0.1); // En el lado izquierdo de la puerta
    handle.rotation.z = Math.PI / 2;
    doorGroup.add(handle);

    // Posicionar la puerta en la pared derecha de la casa (paralela y al ras de la pared)
    doorGroup.position.set(
      this.position.x + this.size.width / 2 - doorThickness / 2, // Ligeramente dentro de la pared
      this.position.y + doorHeight / 2,
      this.position.z
    );
    
    // Rotar la puerta para que quede paralela a la pared derecha
    doorGroup.rotation.y = Math.PI / 2;

    // Configurar el punto de rotación (bisagras en el lado frontal para puerta rotada)
    doorGroup.userData.pivotPoint = new THREE.Vector3(0, 0, doorWidth / 2);

    // Estado de la puerta
    const gateData = {
      mesh: doorGroup,
      open: false,
      targetRotation: 0,
      currentRotation: 0,
      side: "main",
      originalPosition: doorGroup.position.clone(),
      baseRotation: Math.PI / 2, // Rotación base para estar paralela a la pared
    };

    this.gates.push(gateData);
    this.scene.add(doorGroup);
    // No añadir la puerta móvil a las paredes para colisiones, ya que se maneja por separado

    console.log("Puerta principal de la casa creada");

    // Añadir caja de colisión inicial para la puerta cerrada
    this.updateSingleGateCollisionBox(gateData);
  }

  /**
   * Actualiza la caja de colisión de una puerta según su estado
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
   * Verifica si el farmer está cerca de una puerta específica
   * @param {THREE.Vector3} farmerPosition - Posición del farmer
   * @param {Object} gateData - Datos de la puerta
   * @returns {boolean} - True si el farmer está cerca de la puerta
   */
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
    // Abrir 90 grados hacia afuera (hacia la izquierda)
    gateData.targetRotation = Math.PI / 2;

    // Eliminar la colisión de la puerta
    this.updateSingleGateCollisionBox(gateData);

    console.log(`Puerta ${gateData.side} de la casa abierta`);

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

    console.log(`Puerta ${gateData.side} de la casa cerrada`);
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
    const baseRotation = gateData.baseRotation || 0;

    // Rotar la puerta: rotación base + rotación de animación
    gate.rotation.y = baseRotation + gateData.currentRotation;

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

    // Solo verificar interacción si el farmer se ha movido significativamente
    // o si ha pasado suficiente tiempo desde la última verificación
    const currentTime = Date.now();
    const timeSinceLastCheck = currentTime - (this.lastInteractionCheck || 0);
    
    // Verificar cada 100ms como máximo para no afectar rendimiento
    if (timeSinceLastCheck < 100) {
      return;
    }
    
    // Guardar la última posición verificada para comparar
    const hasMoved = !this.lastFarmerPosition || 
      farmerPosition.distanceTo(this.lastFarmerPosition) > 0.5;
    
    if (!hasMoved) {
      return;
    }
    
    this.lastFarmerPosition = farmerPosition.clone();
    this.lastInteractionCheck = currentTime;
    
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

  /**
   * Verifica si un objeto colisiona con la casa
   * @param {THREE.Box3} objectBox - Caja de colisión del objeto a verificar
   * @returns {Object} Información de la colisión o null si no hay colisión
   */
  checkCollision(objectBox) {
    for (let collisionData of this.collisionBoxes) {
      if (objectBox.intersectsBox(collisionData.box)) {
        return collisionData;
      }
    }
    return null;
  }

  /**
   * Obtiene el punto de colisión más cercano y la normal de la superficie
   * @param {THREE.Vector3} position - Posición del objeto
   * @param {THREE.Vector3} direction - Dirección del movimiento
   * @returns {Object} Información de la colisión más cercana
   */
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

  /**
   * Calcula el punto de colisión con una caja específica
   */
  getCollisionPoint(box, position, direction) {
    const ray = new THREE.Ray(position, direction);
    const intersectionPoint = new THREE.Vector3();

    if (ray.intersectBox(box, intersectionPoint)) {
      return intersectionPoint;
    }
    return null;
  }

  /**
   * Obtiene la normal de la superficie según el lado
   */
  getSurfaceNormal(side) {
    switch (side) {
      case "wall":
        return new THREE.Vector3(0, 1, 0);
      default:
        return new THREE.Vector3(0, 1, 0);
    }
  }

  /**
   * Actualiza las cajas de colisión (útil si la casa se mueve)
   */
  updateCollisionBoxes() {
    this.collisionBoxes.forEach((collisionData) => {
      collisionData.box.setFromObject(collisionData.wall);
    });
  }

  /**
   * Actualiza el estado de la casa (animaciones, etc.)
   * @param {number} delta - Tiempo transcurrido
   * @param {THREE.Vector3} farmerPosition - Posición del farmer para interacción
   */
  update(delta, farmerPosition = null) {
    // Actualizar animaciones de las puertas
    this.updateGates(delta);

    // Manejar interacción con el farmer
    if (farmerPosition) {
      this.handleFarmerInteraction(farmerPosition);
    }
  }

  /**
   * Elimina la casa de la escena
   */
  dispose() {
    // Cancelar todos los timers de autocierre
    this.autoCloseTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.autoCloseTimers.clear();

    this.walls.forEach((wall) => {
      this.scene.remove(wall);
      if (wall.geometry) wall.geometry.dispose();
      if (wall.material) {
        if (Array.isArray(wall.material)) {
          wall.material.forEach(material => material.dispose());
        } else {
          wall.material.dispose();
        }
      }
    });
    this.walls = [];
    this.collisionBoxes = [];
    this.gates = [];
  }
}
