import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { SimplexNoise } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/math/SimplexNoise.js";

export class Terrain {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.floor = null;
    this.size = 500; // Tamaño del plano base
    this.repeat = 20; // Repetición de la textura
    this.floorDecale = 0;
    this.walls = []; // Array para almacenar las paredes

    // Configuración del terreno procedural
    this.chunkSize = 64;
    this.renderDistance = 2;
    this.chunks = new Map();
    this.noise = new SimplexNoise();
    this.lastChunkX = null;
    this.lastChunkZ = null;

    // Configuración del terreno
    this.terrainConfig = {
      scale: 40, // Aumentado para colinas más suaves
      height: 5, // Aumentada la altura máxima
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
    };

    this.init();
  }

  init() {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Cargar textura de suelo rojo
    const redSoilTexture = new THREE.TextureLoader().load(
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/red_laterite_soil_stones/red_laterite_soil_stones_diff_4k.jpg"
    );
    redSoilTexture.colorSpace = THREE.SRGBColorSpace;
    redSoilTexture.repeat.set(this.repeat, this.repeat);
    redSoilTexture.wrapS = redSoilTexture.wrapT = THREE.RepeatWrapping;
    redSoilTexture.anisotropy = maxAnisotropy;

    // Material para el plano base
    const mat = new THREE.MeshStandardMaterial({
      map: redSoilTexture,
      color: 0x8b4513, // Tinte marrón
      roughness: 0.9,
      metalness: 0.1,
    });

    // Crear plano base
    const geometry = new THREE.PlaneGeometry(this.size, this.size, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    this.floor = new THREE.Mesh(geometry, mat);
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Material para el terreno procedural
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: redSoilTexture.clone(),
      color: 0x8b4513, // Tinte marrón
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide,
      wireframe: false,
    });

    this.floorDecale = (this.size / this.repeat) * 4;

    // Crear las paredes alrededor del terreno
    // this.createBoundaryWalls();
  }

  generateHeight(x, z) {
    // Retornar siempre 0 para un terreno completamente plano
    return 0;
  }

  createChunk(x, z) {
    const chunkX = Math.floor(x / this.chunkSize) * this.chunkSize;
    const chunkZ = Math.floor(z / this.chunkSize) * this.chunkSize;
    const chunkId = `${chunkX},${chunkZ}`;

    // Si el chunk ya existe, no hacer nada
    if (this.chunks.has(chunkId)) return;

    // Crear geometría del chunk
    const geometry = new THREE.PlaneBufferGeometry(
      this.chunkSize,
      this.chunkSize,
      this.chunkSize - 1,
      this.chunkSize - 1
    );

    // Aplicar desplazamiento a los vértices para crear terreno
    const position = geometry.attributes.position;
    const vertices = position.array;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] + chunkX;
      const z = vertices[i + 2] + chunkZ;
      vertices[i + 1] = this.generateHeight(x, z);
    }

    // Actualizar normales para iluminación correcta
    geometry.computeVertexNormals();
    geometry.rotateX(-Math.PI / 2);

    // Crear el mesh del chunk
    const chunk = new THREE.Mesh(geometry, this.terrainMaterial);
    chunk.position.set(
      chunkX + this.chunkSize / 2,
      0,
      chunkZ + this.chunkSize / 2
    );
    chunk.receiveShadow = true;
    chunk.castShadow = true;

    // Almacenar referencia al chunk
    this.chunks.set(chunkId, {
      mesh: chunk,
      x: chunkX,
      z: chunkZ,
    });

    // Añadir a la escena
    this.scene.add(chunk);

    return chunk;
  }

  removeDistantChunks(cameraX, cameraZ) {
    const renderDistance = this.chunkSize * (this.renderDistance + 1);

    for (const [id, chunk] of this.chunks.entries()) {
      const dx = Math.abs(chunk.x + this.chunkSize / 2 - cameraX);
      const dz = Math.abs(chunk.z + this.chunkSize / 2 - cameraZ);

      if (dx > renderDistance || dz > renderDistance) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        this.chunks.delete(id);
      }
    }
  }

  addTerrainVariation() {
    // Añadir algunas colinas o variaciones al terreno
    const geometry = this.floor.geometry;
    const positionAttribute = geometry.getAttribute("position");
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i);

      // Crear colinas suaves
      const distance = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
      const height = Math.sin(distance * 0.1) * 0.5;

      vertex.y = height;
      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();

    // Se ha eliminado la adición de decoraciones (esferas/rocas)
  }

  addDecorations() {
    // Añadir algunas rocas simples
    const rockGeometry = new THREE.SphereGeometry(0.3, 7, 7);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
    });

    for (let i = 0; i < 20; i++) {
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.set(
        (Math.random() - 0.5) * this.size * 0.8,
        0.3,
        (Math.random() - 0.5) * this.size * 0.8
      );
      rock.castShadow = true;
      rock.receiveShadow = true;

      // Escalar las rocas de forma aleatoria
      const scale = 0.5 + Math.random() * 1.5;
      rock.scale.set(scale, scale, scale);

      this.scene.add(rock);
    }
  }

  update(cameraPosition) {
    if (!cameraPosition) return;

    const cameraX = cameraPosition.x;
    const cameraZ = cameraPosition.z;

    // Calcular el chunk actual de la cámara
    const chunkX = Math.floor(cameraX / this.chunkSize) * this.chunkSize;
    const chunkZ = Math.floor(cameraZ / this.chunkSize) * this.chunkSize;

    // Si la cámara se movió a un nuevo chunk, actualizar la generación
    if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
      // Generar chunks en un radio alrededor del jugador
      for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
        for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
          const worldX = chunkX + x * this.chunkSize;
          const worldZ = chunkZ + z * this.chunkSize;
          this.createChunk(worldX, worldZ);
        }
      }

      // Eliminar chunks lejanos
      this.removeDistantChunks(cameraX, cameraZ);

      this.lastChunkX = chunkX;
      this.lastChunkZ = chunkZ;
    }
  }

  /**
   * Obtiene la altura del terreno en una posición X,Z específica
   * @param {number} x - Coordenada X
   * @param {number} z - Coordenada Z
   * @returns {number} - Altura del terreno en esa posición
   */
  getHeightAtPosition(x, z) {
    return this.generateHeight(x, z);
  }

  /**
   * Crea paredes alrededor de los límites del terreno
   */
  createBoundaryWalls() {
    const wallHeight = 20; // Altura de las paredes
    const wallThickness = 2; // Grosor de las paredes
    const halfSize = this.size / 2;

    // Cargar la textura del contorno
    const contornoTexture = new THREE.TextureLoader().load(
      "./src/assets/Contorno.png"
    );
    contornoTexture.colorSpace = THREE.SRGBColorSpace;
    contornoTexture.wrapS = contornoTexture.wrapT = THREE.RepeatWrapping;

    // Material para las paredes
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: contornoTexture,
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    // Crear las cuatro paredes

    // Pared norte (frontal)
    const northWallGeometry = new THREE.BoxGeometry(
      this.size,
      wallHeight,
      wallThickness
    );
    const northWall = new THREE.Mesh(northWallGeometry, wallMaterial);
    northWall.position.set(0, wallHeight / 2, -halfSize);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    this.scene.add(northWall);
    this.walls.push(northWall);

    // Pared sur (trasera)
    const southWallGeometry = new THREE.BoxGeometry(
      this.size,
      wallHeight,
      wallThickness
    );
    const southWall = new THREE.Mesh(southWallGeometry, wallMaterial);
    southWall.position.set(0, wallHeight / 2, halfSize);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    this.scene.add(southWall);
    this.walls.push(southWall);

    // Pared este (derecha)
    const eastWallGeometry = new THREE.BoxGeometry(
      wallThickness,
      wallHeight,
      this.size
    );
    const eastWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
    eastWall.position.set(halfSize, wallHeight / 2, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    this.scene.add(eastWall);
    this.walls.push(eastWall);

    // Pared oeste (izquierda)
    const westWallGeometry = new THREE.BoxGeometry(
      wallThickness,
      wallHeight,
      this.size
    );
    const westWall = new THREE.Mesh(westWallGeometry, wallMaterial);
    westWall.position.set(-halfSize, wallHeight / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    this.scene.add(westWall);
    this.walls.push(westWall);

    console.log("Paredes de contorno creadas:", this.walls.length, "paredes");
  }

  /**
   * Limpia todos los recursos del terreno
   */
  dispose() {
    // Limpiar las paredes
    for (const wall of this.walls) {
      this.scene.remove(wall);
      if (wall.geometry) wall.geometry.dispose();
      if (wall.material) wall.material.dispose();
    }
    this.walls = [];

    for (const chunk of this.chunks.values()) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    this.chunks.clear();

    if (this.material) {
      this.material.dispose();
    }
  }
}
