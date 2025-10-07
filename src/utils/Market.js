import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

/**
 * Clase para crear un mercado con textura de piedra y ventana frontal
 */
export class Market {
  constructor(
    scene,
    position = { x: -155.8, y: 0.0, z: 53.3 },
    size = { width: 18, height: 20, depth: 14 } // Aumentada la altura a 20 unidades
  ) {
    this.scene = scene;
    this.position = position;
    this.size = size;
    this.walls = [];
    this.collisionBoxes = [];

    this.createMarket();
  }

  /**
   * Crea el mercado con sus paredes, techo y ventana
   */
  createMarket() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    // Crear el grupo principal del mercado
    this.marketGroup = new THREE.Group();
    this.marketGroup.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );

    // Calcular la dirección hacia la que debe mirar el mercado
    const targetPosition = new THREE.Vector3(-140.1, 0.0, 66.4);
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, this.marketGroup.position).normalize();

    // Calcular el ángulo de rotación en el eje Y
    this.marketGroup.rotation.y = Math.atan2(direction.x, direction.z);

    // Ajustar la altura para que el mercado esté sobre el terreno
    this.marketGroup.position.y = 0; // La base del mercado está en y=0

    this.scene.add(this.marketGroup);

    // Cargar la textura de piedra
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/coral_gravel/coral_gravel_diff_4k.jpg",
      (texture) => {
        console.log("✅ Textura de grava de coral cargada para el mercado");
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        // Material principal de piedra
        const stoneMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        // Material para el techo (misma textura de grava de coral)
        const roofMaterial = new THREE.MeshStandardMaterial({
          map: texture.clone(),
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

        // Material para la ventana (cristal oscuro)
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

        // Crear las paredes del mercado
        this.createWalls(stoneMaterial, windowMaterial);

        // Asegurarse de que las paredes se agreguen al grupo del mercado
        this.walls.forEach((wall) => this.marketGroup.add(wall));

        // Crear el techo y agregarlo al grupo
        const roof = this.createRoof(roofMaterial);
        this.marketGroup.add(roof);

        console.log("Mercado creado con texturas");
      },
      undefined,
      (error) => {
        console.warn(
          "No se pudo cargar la textura de grava de coral, usando materiales alternativos:",
          error
        );
        // Usar materiales alternativos si la textura no carga
        this.createMarketWithAlternativeMaterials();
      }
    );
  }

  /**
   * Crea el mercado con materiales alternativos si la textura no carga
   */
  createMarketWithAlternativeMaterials() {
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gris piedra
      metalness: 0.05,
      roughness: 0.95,
    });

    const windowMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7,
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gris piedra
      metalness: 0.05,
      roughness: 0.95,
    });

    this.createWalls(stoneMaterial, windowMaterial);
    this.createRoof(roofMaterial);

    console.log("Mercado creado con materiales alternativos");
  }

  /**
   * Crea las paredes del mercado con una ventana grande en el frente
   */
  createWalls(stoneMaterial, windowMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    // Limpiar cualquier pared existente
    this.walls = [];

    // Crear la caja principal del mercado
    const marketBox = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      stoneMaterial
    );
    marketBox.position.set(0, height / 2, 0);
    marketBox.castShadow = true;
    marketBox.receiveShadow = true;
    this.marketGroup.add(marketBox);
    this.walls.push(marketBox);

    // Crear la ventana como un agujero en la pared frontal
    const windowWidth = width * 0.6;
    const windowHeight = height * 0.3;
    const windowGeometry = new THREE.BoxGeometry(
      windowWidth,
      windowHeight,
      wallThickness * 1.1
    );
    const windowHole = new THREE.Mesh(
      windowGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
      })
    );
    windowHole.position.set(0, height / 2, depth / 2 + 0.01);
    this.marketGroup.add(windowHole);

    // Crear el cartel alienígena
    this.createAlienSign(width, height, depth, stoneMaterial);

    const wallBSP = new ThreeBSP(frontWallMain);
    const windowBSP = new ThreeBSP(windowHole);
    const wallWithWindow = wallBSP.subtract(windowBSP);

    // Reemplazamos la pared con la versión que tiene el agujero
    frontWall.remove(frontWallMain);
    const wallMesh = wallWithWindow.toMesh(stoneMaterial);
    wallMesh.position.set(0, 0, 0);
    frontWall.add(wallMesh);

    // Ajustar la altura del mercado y la posición de la ventana para que esté alineada con los vértices
    this.marketGroup.position.y = -height / 2;
    frontWall.position.y = height / 2;

    // Añadir marcos alrededor del agujero de la ventana
    const frameThickness = 0.3;

    // Marco superior
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(
        windowWidth + frameThickness * 2,
        frameThickness,
        frameThickness
      ),
      stoneMaterial
    );
    windowHole.position.set(0, height / 2, depth / 2 + 0.01);
    this.marketGroup.add(windowHole);

    // Actualizar las cajas de colisión
    this.updateCollisionBoxes();

    return this.walls;

    // Alero del techo
    const roofOverhang = new THREE.Mesh(
      new THREE.BoxGeometry(
        width + overhang * 2 + 0.2,
        roofThickness * 0.5,
        depth + overhang * 2 + 0.2
      ),
      roofMaterial
    );
    // Posición relativa al grupo padre
    roofOverhang.position.set(0, height / 2 - roofThickness * 0.75, 0);

    // Agrupar las partes del techo
    const roofGroup = new THREE.Group();
    roofGroup.add(roof);
    roofGroup.add(roofOverhang);

    // Retornar el grupo del techo para que pueda ser agregado al grupo principal
    return roofGroup;
  }

  /**
   * Verifica si un objeto colisiona con el mercado
   * @param {THREE.Box3} objectBox - Caja de colisión del objeto a verificar
   */
  checkCollision(objectBox) {
    for (const { box, side } of this.collisionBoxes) {
      if (box.intersectsBox(objectBox)) {
        return { collided: true, side };
      }
    }
    return { collided: false };
  }

  /**
   * Actualiza las cajas de colisión (útil si el mercado se mueve)
   */
  updateCollisionBoxes() {
    this.collisionBoxes = [];
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
   * Actualiza el estado del mercado (animaciones, etc.)
   * @param {number} delta - Tiempo transcurrido
   */
  update(delta) {
    // Actualizar lógica del mercado si es necesario
  }

  /**
   * Elimina el mercado de la escena
   */
  /**
   * Crea un cartel con letras de estilo alienígena
   */
  createAlienSign(width, height, depth, material) {
    // Crear un grupo para el cartel
    const signGroup = new THREE.Group();

    // Crear el soporte del cartel con tamaño original
    const signPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 2, 0.15),
      material
    );
    signPost.position.set(0, height + 1, depth / 2 + 0.2);

    // Crear el panel del cartel con tamaño original pero texto más grande
    const panelWidth = 6; // Un poco más ancho para el texto más grande
    const panelHeight = 2.5; // Un poco más alto para el texto más grande
    const signPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth, panelHeight),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        side: THREE.DoubleSide,
      })
    );
    signPanel.position.set(0, height + 2.5, depth / 2 + 0.3);
    // Solo rotamos el panel, no el texto
    signPanel.rotation.y = Math.PI; // Gira 180 grados para que mire hacia el frente

    // Crear texto con símbolos alienígenas y (MERCADO) debajo - TEXTO MÁS GRANDE Y CON MÁS ESPACIO
    const alienText = this.createAlienText("◊ § ¶ • ◊ ¶ •\n(MERCADO)", 2, {
      r: 0,
      g: 1,
      b: 0,
    });
    alienText.position.set(0, height + 2.5, depth / 2 + 0.31);
    // Eliminamos la rotación del texto para evitar el efecto espejo
    // El texto ya se crea correctamente orientado

    // Añadir luces neón al cartel
    const neonLight = new THREE.PointLight(0x00ff00, 2, 5);
    neonLight.position.set(0, height + 2.5, depth / 2 + 0.2);

    // Añadir todo al grupo del cartel
    signGroup.add(signPost);
    signGroup.add(signPanel);
    signGroup.add(alienText);
    signGroup.add(neonLight);

    // Añadir el cartel al mercado
    this.marketGroup.add(signGroup);
  }

  /**
   * Crea texto con apariencia alienígena
   */
  createAlienText(text, size, color) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // Configurar el canvas
    const fontSize = 60; // Tamaño de fuente aumentado
    const padding = 15; // Más padding
    const lineHeight = 1.5; // Más espacio entre líneas
    const letterSpacing = 5; // Espaciado entre letras
    const lines = text.split("\n");

    // Función para dibujar texto con espaciado entre letras
    const drawText = (text, x, y) => {
      const characters = text.split("");
      let currentX =
        x -
        context.measureText(text).width / 2 -
        ((characters.length - 1) * letterSpacing) / 2;

      characters.forEach((char) => {
        context.strokeText(char, currentX, y);
        context.fillText(char, currentX, y);
        currentX += context.measureText(char).width + letterSpacing;
      });
    };

    // Calcular dimensiones del texto con espaciado
    context.font = `bold ${fontSize}px Arial`;
    const textWidth =
      Math.max(
        ...lines.map((line) =>
          line
            .split("")
            .reduce(
              (width, char) =>
                width + context.measureText(char).width + letterSpacing,
              0
            )
        )
      ) - letterSpacing; // Restar el último espaciado
    const textHeight =
      fontSize * lines.length * lineHeight + (lines.length - 1) * 10; // Más espacio entre líneas

    // Configurar tamaño del canvas
    canvas.width = textWidth + padding * 2;
    canvas.height = textHeight + padding * 2;

    // Fondo transparente
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Configurar estilo de texto
    context.font = `bold ${fontSize}px Arial`;
    context.textBaseline = "top";
    context.textAlign = "center";

    // Dibujar texto con borde
    context.strokeStyle = "#00ff00";
    context.lineWidth = 3;
    context.fillStyle = `rgb(${color.r * 255}, ${color.g * 255}, ${
      color.b * 255
    })`;

    // Dibujar cada línea de texto con espaciado
    lines.forEach((line, i) => {
      const y = padding + fontSize * lineHeight * i + i * 10; // Más espacio entre líneas
      drawText(line, canvas.width / 2, y);
    });

    // Crear textura a partir del canvas
    const texture = new THREE.CanvasTexture(canvas);

    // Crear material con la textura
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // Crear plano con el texto
    const aspect = canvas.width / canvas.height;
    const geometry = new THREE.PlaneGeometry(size * aspect, size);
    const mesh = new THREE.Mesh(geometry, material);

    return mesh;
  }

  dispose() {
    // Eliminar el grupo principal de la escena
    if (this.marketGroup) {
      // Eliminar todos los hijos del grupo
      while (this.marketGroup.children.length > 0) {
        const child = this.marketGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
        this.marketGroup.remove(child);
      }
      this.scene.remove(this.marketGroup);
    }

    // Limpiar referencias
    this.walls = [];
    this.collisionBoxes = [];
  }
}
