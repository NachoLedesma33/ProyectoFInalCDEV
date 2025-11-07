import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

import { safePlaySfx } from './audioHelpers.js';

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
    // Contenedor para objetos interiores (piso, muebles) para gestión/limpieza
    this.interiorObjects = [];
    this.collisionBoxes = [];
    this.gates = []; // Array para puertas
    this.gateSpeed = 4; // Velocidad de apertura/cierre de la puerta (más rápida para fluidez)
    this.detectionDistance = 4.0; // Distancia de detección del farmer (aumentada)
    this.autoCloseDelay = 5000; // 5 segundos para autocierre
    this.autoCloseTimers = new Map(); // Timers para cada puerta
    
    // Sistema de control de techo
    this.roofMeshes = []; // Almacena las mallas del techo
    this.isInsideHouse = false; // Estado de si el jugador está dentro de la casa
    
    // Límites de la casa (ajustar según la posición y tamaño real)
    this.houseBounds = {
      minX: this.position.x - this.size.width/2 - 1,  // -1 para incluir el grosor de las paredes
      maxX: this.position.x + this.size.width/2 + 1,
      minZ: this.position.z - this.size.depth/2 - 1,
      maxZ: this.position.z + this.size.depth/2 + 1,
      minY: this.position.y,
      maxY: this.position.y + this.size.height
    };

    this.createHouse();
  }

  /**
   * Añade una caja de colisión para un objeto dado y la registra en this.collisionBoxes
   * @param {THREE.Object3D} object
   * @param {string} side
   */
  addCollision(object, side = 'furniture') {
    try {
      const collisionBox = new THREE.Box3().setFromObject(object);
      this.collisionBoxes.push({ box: collisionBox, side: side, wall: object });
    } catch (e) {
      // Si falla (por ejemplo objeto no renderizado aún), añadir entrada vacía y actualizar después
      const collisionBox = new THREE.Box3();
      collisionBox.makeEmpty();
      this.collisionBoxes.push({ box: collisionBox, side: side, wall: object });
    }
  }

  /**
   * Crea decoración adicional: escritorio, cama, armario, heladera, cocina y alacenas
   * @param {THREE.Material} woodMaterial
   * @param {THREE.Material} metalMaterial
   */
  createInteriorDecorations(woodMaterial, metalMaterial) {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    const { width, depth } = this.size;

    // --- Escritorio simple ---
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

    // --- Cama simple ---
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

    // --- Armario (wardrobe) ---
    const wardrobe = new THREE.Group();
  const wardBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.6), metalMaterial);
    wardBody.position.set(0, 0.9, 0);
    wardrobe.add(wardBody);
    // puertas simples (solo visual)
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

    // --- Heladera (fridge) ---
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

    // --- Cocina / Hornalla (stove) ---
    const stove = new THREE.Group();
    const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.6), metalMaterial);
    stoveBody.position.set(0, 0.4, 0);
    stove.add(stoveBody);
    // Quemadores (pequeños cilindros)
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

    // --- Alacenas (cajones de pared) ---
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
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Repetir la textura para mejor cobertura

        // Material principal de piedra
        const stoneMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        // Material secundario marrón para detalles
        const brownMaterial = new THREE.MeshStandardMaterial({
          color: 0x8b4513, // Marrón madera
          metalness: 0.1,
          roughness: 0.8,
        });

        // Material para el techo (misma textura de grava de coral)
        const roofMaterial = new THREE.MeshStandardMaterial({
          map: texture.clone(),
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        // Crear las paredes de la casa
        this.createWalls(stoneMaterial, brownMaterial);

        // Crear el techo
        this.createRoof(roofMaterial);

        // Crear piso interior con textura concreteDIFF.png y muebles
        // Construir la URL de manera compatible con bundlers y módulos (import.meta.url)
        let concretePath;
        try {
          concretePath = new URL('../assets/concreteDIFF.png', import.meta.url).href;
        } catch (e) {
          // Si import.meta.url no está disponible (entornos antiguos), usar ruta absoluta
          concretePath = '/src/assets/concreteDIFF.png';
        }

        textureLoader.load(
          concretePath,
          (concreteTexture) => {
            // Ajustes de textura
            concreteTexture.wrapS = THREE.RepeatWrapping;
            concreteTexture.wrapT = THREE.RepeatWrapping;
            concreteTexture.repeat.set(2, 2);
            // Si tu pipeline usa sRGB, descomenta:
            // concreteTexture.encoding = THREE.sRGBEncoding;

                const floorMaterial = new THREE.MeshStandardMaterial({
                  map: concreteTexture,
                  metalness: 0.02,
                  roughness: 0.9,
                  color: 0xffffff,
                });

                // Material metálico para electrodomésticos
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
            // Fallback: si la textura no carga, usar material gris y avisar en consola
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

        // Crear la puerta principal con la misma textura de piedra
        this.createDoor(stoneMaterial);
      },
      undefined,
      (error) => {
        return error;
        // Usar materiales alternativos si la textura no carga
        this.createHouseWithAlternativeMaterials();
      }
    );
  }

  /**
   * Crea un piso simple gris dentro de la casa
   * @param {THREE.Material} floorMaterial
   */
  createFloor(floorMaterial) {
    const { width, depth } = this.size;

    // Hacemos el piso ligeramente elevado para evitar z-fighting
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

    // Guardar en interiorObjects para limpieza posterior
    this.interiorObjects.push(floorMesh);
    // Opcionalmente añadir a walls para reutilizar la lógica de dispose
    this.walls.push(floorMesh);
  }

  /**
   * Crea algunos muebles sencillos dentro de la casa (mesa y sillas)
   * @param {THREE.Material} woodMaterial
   * @param {THREE.Material} floorMaterial - no usado actualmente, pero disponible
   */
  createFurniture(metalMaterial, floorMaterial) {
    const tableGroup = new THREE.Group();

    // Mesa: tapa y 4 patas
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

    // Posicionar la mesa hacia el centro de la casa
    tableGroup.position.set(this.position.x, this.position.y, this.position.z - 0.5);
    this.scene.add(tableGroup);
    this.interiorObjects.push(tableGroup);
    this.walls.push(tableGroup);
  // Colisión para la mesa
  this.addCollision(tableGroup, 'furniture');

    // Crear dos sillas simples (cubos) alrededor de la mesa
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

  /**
   * Crea la casa con materiales alternativos si la textura no carga
   */
  createHouseWithAlternativeMaterials() {
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gris piedra
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

    // Parte inferior izquierda de la pared derecha (antes de la puerta)
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

    // Parte inferior derecha de la pared derecha (después de la puerta)
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
    this.roofMeshes.push(roofBaseMesh); // Añadir a la lista de techos

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
    this.roofMeshes.push(roofMesh); // Añadir a la lista de techos
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
      roughness: 0.7,
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

    // Manija de la puerta
    const handleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8); // Manija más grande
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Dorado para la manija
      metalness: 0.8,
      roughness: 0.2,
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

    // Reproducir sonido posicional de apertura de puerta
    try {
      safePlaySfx('openDoor', { object3D: gateData.mesh });
    } catch (e) {
      // No bloquear si falla el audio
    }

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

    // Reproducir sonido posicional de cierre de puerta
    try {
      safePlaySfx('closeDoor', { object3D: gateData.mesh });
    } catch (e) {
      // Silenciar errores de audio
    }
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
   * Verifica si el jugador está dentro del área de la casa
   * @param {THREE.Vector3} position - Posición del jugador
   * @returns {boolean} - True si el jugador está dentro de la casa
   */
  isPlayerInsideHouse(position) {
    return position.x >= this.houseBounds.minX && 
           position.x <= this.houseBounds.maxX &&
           position.z >= this.houseBounds.minZ && 
           position.z <= this.houseBounds.maxZ;
  }
  
  /**
   * Verifica si alguna puerta está abierta
   * @returns {boolean} - True si al menos una puerta está abierta
   */
  isAnyDoorOpen() {
    return this.gates.some(gate => gate.isOpen);
  }
  
  /**
   * Actualiza la visibilidad del techo basado en la posición del jugador
   * @param {THREE.Vector3} playerPosition - Posición actual del jugador
   */
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
    // Actualizar animaciones de las puertas
    this.updateGates(delta);

    // Manejar interacción con el farmer y visibilidad del techo
    if (farmerPosition) {
      this.handleFarmerInteraction(farmerPosition);
      this.updateRoofVisibility(farmerPosition);
    }
  }

  dispose() {
    // Cancelar todos los timers de autocierre
    this.autoCloseTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.autoCloseTimers.clear();
    // Dispose de objetos interiores primero (evita duplicados si también están en walls)
    const disposed = new Set();
    this.interiorObjects.forEach((obj) => {
      try {
        this.scene.remove(obj);
      } catch (e) {
        // ignore
      }
      disposed.add(obj);
      // Si es un Group, intentar disponer de sus hijos
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

    // Ahora dispose del resto de walls, omitiendo ya los que se limpiaron
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
