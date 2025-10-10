import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";

export class Stone {
  constructor(
    scene,
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    modelType = 1
  ) {
    this.scene = scene;
    this.model = null;
    this.position = position;
    this.scale = scale;
    this.modelType = modelType; // 1 para ST_Stone1.fbx, 2 para ST_Stone2.fbx

    this.init();
  }

  init() {
    const loader = new FBXLoader();

    // Determinar qué modelo cargar
    const modelPath =
      this.modelType === 1
        ? "./src/models/characters/terrain/ST_Stone1.fbx"
        : "./src/models/characters/terrain/ST_Stone2.fbx";

    loader.load(
      modelPath,
      (fbx) => {
        console.log(`✅ Modelo ${modelPath} cargado exitosamente`);
        this.model = fbx;

        // Aplicar escala
        this.model.scale.setScalar(this.scale);

        // Posicionar el modelo (altura ajustada para piedras pequeñas)
        this.model.position.set(
          this.position.x,
          this.position.y + 0.1,
          this.position.z
        );

        console.log(
          `Posicionando piedra en: (${this.model.position.x}, ${this.model.position.y}, ${this.model.position.z})`
        );

        // Generar variación de rotación para orientación diversa
        this.model.rotation.y = Math.random() * Math.PI * 2;
        this.model.rotation.x = (Math.random() - 0.5) * 0.3;
        this.model.rotation.z = (Math.random() - 0.5) * 0.3;

        // Primero, limpiar cualquier textura existente que pueda intentar cargar el FBX
        this.model.traverse((child) => {
          if (child.isMesh) {
            // Crear un nuevo material para piedras realistas y oscuras
            child.material = new THREE.MeshStandardMaterial({
              color: 0x4a4a4a, // Color base gris oscuro (piedra real)
              metalness: 0.1, // Bajo metalness para piedra natural
              roughness: 0.9, // Alta rugosidad para aspecto mate de piedra
              emissive: 0x000000, // Sin emisión para aspecto natural
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Cargar la textura de roca de lecho de río seco para las piedras
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/dry_riverbed_rock/dry_riverbed_rock_diff_4k.jpg",
          (texture) => {
            console.log(
              `✅ Textura dry_riverbed_rock_diff_4k.jpg cargada para piedra en (${this.position.x}, ${this.position.z})`
            );
            this.model.traverse((child) => {
              if (child.isMesh) {
                // Aplicar la textura de roca y ajustar para mejor iluminación
                child.material.map = texture;
                child.material.metalness = 0.05; // Bajo metalness para piedra natural
                child.material.roughness = 0.95; // Alta rugosidad para aspecto mate de piedra
                child.material.color.setHex(0xffffff); // Color blanco para que la textura se vea natural
                child.material.needsUpdate = true;
                console.log(
                  `Textura de roca aplicada a piedra en (${this.position.x}, ${this.position.z})`
                );
              }
            });
          },
          undefined,
          (error) => {
            console.warn(
              `No se pudo cargar la textura dry_riverbed_rock_diff_4k.jpg para la piedra en (${this.position.x}, ${this.position.z}):`,
              error
            );
            // Usar material alternativo de piedra
            this.model.traverse((child) => {
              if (child.isMesh) {
                // Colores de piedra natural
                const stoneColors = [
                  0x696969, 0x808080, 0xa9a9a9, 0xc0c0c0, 0xd3d3d3,
                ];
                const randomColor =
                  stoneColors[Math.floor(Math.random() * stoneColors.length)];

                child.material.color.setHex(randomColor);
                child.material.metalness = 0.05; // Bajo metalness para piedra
                child.material.roughness = 0.95; // Alta rugosidad para aspecto mate
                child.material.needsUpdate = true;
                console.log(
                  `Material de piedra alternativo aplicado a piedra en (${this.position.x}, ${this.position.z})`
                );
              }
            });
          }
        );

        // Calcular y mostrar el bounding box para depuración
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        console.log(
          `BoundingBox de la piedra: tamaño (${size.x.toFixed(
            2
          )}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`
        );

        // Agregar a la escena
        this.scene.add(this.model);

        console.log(
          `✅ Piedra ST_Stone${this.modelType}.fbx creada en posición: (${this.model.position.x}, ${this.model.position.y}, ${this.position.position.z}) con escala ${this.scale}`
        );

        // Verificar si la piedra es visible en la escena
        setTimeout(() => {
          if (this.model.parent) {
            console.log(
              `✅ Piedra en (${this.position.x}, ${this.position.z}) está en la escena y debería ser visible`
            );
          } else {
            console.warn(
              `⚠️ Piedra en (${this.position.x}, ${this.position.z}) no está en la escena`
            );
          }
        }, 100);
      },
      (progress) => {
        // Progreso de carga
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Cargando ${modelPath}: ${percentComplete.toFixed(2)}%`);
        }
      },
      (error) => {
        console.error(`❌ Error al cargar el modelo ${modelPath}:`, error);
        console.error(
          `❌ La piedra en (${this.position.x}, ${this.position.z}) no se pudo crear. Verifica que el archivo FBX exista.`
        );
      }
    );
  }

  update(delta) {
    // Las piedras están estáticas
  }

  getModel() {
    return this.model;
  }

  /**
   * Verifica si una posición colisiona con esta piedra usando sistema robusto
   * @param {THREE.Vector3} position - Posición a verificar
   * @param {THREE.Vector3} characterSize - Tamaño del bounding box del personaje
   * @returns {boolean} - True si hay colisión
   */
  checkCollision(position, characterSize) {
    if (!this.model) return false;

    // Sistema robusto: combinación de bounding box reducido y distancia
    return this.checkRobustCollision(position, characterSize);
  }

  /**
   * Sistema de colisión robusto que evita que el farmer atraviese las piedras
   * @param {THREE.Vector3} position - Posición a verificar
   * @param {THREE.Vector3} characterSize - Tamaño del personaje
   * @returns {boolean} - True si hay colisión
   */
  checkRobustCollision(position, characterSize) {
    // Método 1: Bounding box optimizado para piedras (más preciso)
    const stoneBox = this.getBoundingBox();

    // Crear bounding box para el personaje con el tamaño específico para piedras
    const characterBox = new THREE.Box3();
    const characterMin = position
      .clone()
      .sub(characterSize.clone().multiplyScalar(0.5));
    const characterMax = position
      .clone()
      .add(characterSize.clone().multiplyScalar(0.5));
    characterBox.setFromPoints([characterMin, characterMax]);

    // Expandir el bounding box de la piedra con un valor más pequeño para permitir acercamiento
    // Valor negativo = reduce el bounding box, permitiendo acercarse más
    stoneBox.expandByScalar(-0.3);

    const boxCollision = stoneBox.intersectsBox(characterBox);

    // Método 2: Verificación por distancia optimizada para piedras
    const stoneCenter = this.model.position.clone();
    // Ignorar el eje Y para la distancia (solo importan X y Z)
    const horizontalDistance = Math.sqrt(
      Math.pow(position.x - stoneCenter.x, 2) +
        Math.pow(position.z - stoneCenter.z, 2)
    );

    // Radio de colisión más pequeño para permitir acercamiento
    const collisionRadius = Math.max(characterSize.x, characterSize.z) * 0.6;

    const distanceCollision = horizontalDistance < collisionRadius;

    // Método 3: Verificación de proximidad adicional (solo para piedras)
    const stoneSize = stoneBox.getSize(new THREE.Vector3());
    const stoneRadius = Math.max(stoneSize.x, stoneSize.z) * 0.4; // Radio efectivo de la piedra
    const characterRadius = Math.max(characterSize.x, characterSize.z) * 0.5;
    const proximityCollision =
      horizontalDistance < stoneRadius + characterRadius;

    // Solo considerar colisión si al menos dos métodos detectan colisión
    // Esto reduce falsos positivos y permite acercamiento más cercano
    const collisionMethods = [
      boxCollision,
      distanceCollision,
      proximityCollision,
    ];
    const collisionCount = collisionMethods.filter((method) => method).length;
    const collision = collisionCount >= 2;

    if (collision) {
      console.log("🚫 Colisión con piedra detectada (sistema optimizado):", {
        position: position,
        stoneCenter: stoneCenter,
        horizontalDistance: horizontalDistance.toFixed(3),
        collisionRadius: collisionRadius.toFixed(3),
        stoneRadius: stoneRadius.toFixed(3),
        characterRadius: characterRadius.toFixed(3),
        methods: {
          boxCollision: boxCollision,
          distanceCollision: distanceCollision,
          proximityCollision: proximityCollision,
        },
        collisionCount: collisionCount,
      });
    }

    return collision;
  }

  /**
   * Obtiene el bounding box de la piedra para depuración
   * @returns {THREE.Box3} - Bounding box de la piedra
   */
  getBoundingBox() {
    if (!this.model) {
      console.warn("⚠️ El modelo de la piedra no está cargado");
      return new THREE.Box3();
    }

    const box = new THREE.Box3().setFromObject(this.model);
    return box;
  }
}
