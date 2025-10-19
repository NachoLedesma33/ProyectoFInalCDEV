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
    this.radius = 3; // Radio del área de interacción

    this.createMarket();
    this.createInteractionArea();
  }

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
    this.marketGroup.rotation.y = Math.atan2(direction.x, direction.z);

    // Añadir el mercado a la escena
    this.scene.add(this.marketGroup);

    // Cargar texturas
    const textureLoader = new THREE.TextureLoader();

    // Textura de piedra
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

        // Material para el techo
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
        this.createRoof(roofMaterial);
        this.createAlienSign(width, height, depth, stoneMaterial);
      },
      undefined,
      (error) => {
        console.error("Error cargando textura:", error);
        // Usar materiales básicos si falla la carga
        const basicMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
        this.createWalls(basicMaterial, basicMaterial);
        this.createRoof(basicMaterial);
      }
    );
  }

  createWalls(stoneMaterial, windowMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    // Pared frontal con ventana
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      stoneMaterial
    );
    frontWall.position.set(0, height / 2, depth / 2);
    this.marketGroup.add(frontWall);
    this.walls.push(frontWall);

    // Pared trasera
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      stoneMaterial
    );
    backWall.position.set(0, height / 2, -depth / 2);
    this.marketGroup.add(backWall);
    this.walls.push(backWall);

    // Pared izquierda
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      stoneMaterial
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    this.marketGroup.add(leftWall);
    this.walls.push(leftWall);

    // Pared derecha
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      stoneMaterial
    );
    rightWall.position.set(width / 2, height / 2, 0);
    this.marketGroup.add(rightWall);
    this.walls.push(rightWall);

    // Piso
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.1, depth),
      stoneMaterial
    );
    floor.position.set(0, -0.05, 0);
    this.marketGroup.add(floor);

    // Ventana frontal
    const windowWidth = width * 0.6;
    const windowHeight = height * 0.4;
    const window = new THREE.Mesh(
      new THREE.PlaneGeometry(windowWidth, windowHeight),
      windowMaterial
    );
    window.position.set(0, height * 0.5, depth / 2 + 0.1);
    this.marketGroup.add(window);
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
    // Crear soporte del cartel
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 2, 8),
      material
    );
    signPost.position.set(0, height + 1, depth / 2 + 0.2);
    this.marketGroup.add(signPost);

    // Crear panel del cartel
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

    // Añadir texto al cartel
    this.createSignText("MERCADO", sign.position);
  }

  createSignText(text, position) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 256;

    // Fondo transparente
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Estilo del texto
    context.font = "Bold 100px Arial";
    context.fillStyle = "#00ff00";
    context.textAlign = "center";
    context.textBaseline = "middle";

    // Dibujar texto
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Crear textura
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // Crear plano para el texto
    const textGeometry = new THREE.PlaneGeometry(4, 1.5);
    const textMesh = new THREE.Mesh(textGeometry, material);

    // Posicionar el texto ligeramente delante del cartel
    textMesh.position.set(position.x, position.y, position.z + 0.1);

    this.marketGroup.add(textMesh);
  }

  createInteractionArea() {
    // Crear un círculo en el suelo para marcar el área de interacción
    const geometry = new THREE.CircleGeometry(this.radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    this.interactionCircle = new THREE.Mesh(geometry, material);
    this.interactionCircle.rotation.x = -Math.PI / 2;
    this.interactionCircle.position.set(
      this.position.x + 5, // 5 unidades delante del mercado
      0.1, // Pequeña elevación para evitar z-fighting
      this.position.z + 5 // 5 unidades a la derecha del mercado
    );
    this.scene.add(this.interactionCircle);

    // Crear un borde para el círculo
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
    circle.position.y = 0.11; // Un poco más arriba que el círculo
    this.scene.add(circle);
  }

  update(playerPosition) {
    if (playerPosition) {
      this.checkPlayerPosition(playerPosition);
    }
  }

  checkPlayerPosition(playerPosition) {
    if (!playerPosition) return;

    const distance = Math.sqrt(
      Math.pow(playerPosition.x - this.interactionCircle.position.x, 2) +
        Math.pow(playerPosition.z - this.interactionCircle.position.z, 2)
    );

    console.log("Distancia al círculo:", distance); // Para depuración

    if (distance <= this.radius) {
      if (!this.isPlayerNearby) {
        this.isPlayerNearby = true;
        this.showMarketUI();
      }
    } else if (this.isPlayerNearby) {
      this.isPlayerNearby = false;
      this.hideMarketUI();
    }
  }

  showMarketUI() {
    if (this.isUIOpen) return;
    this.isUIOpen = true;

    // Crear el contenedor del HUD
    this.marketUI = document.createElement("div");
    this.marketUI.id = "market-hud";
    this.marketUI.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00aa00;
      border-radius: 10px;
      padding: 20px;
      color: white;
      z-index: 1000;
      width: 400px;
      max-width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      font-family: 'Arial', sans-serif;
      box-shadow: 0 0 20px rgba(0, 200, 0, 0.5);
    `;

    // Título
    const title = document.createElement("h2");
    title.textContent = "Mercado";
    title.style.cssText = "text-align: center; margin-top: 0; color: #4caf50;";
    this.marketUI.appendChild(title);

    // Monedas disponibles
    const coins = document.createElement("div");
    coins.textContent = `Monedas: ${window.inventory?.coins || 0}`;
    coins.style.cssText =
      "text-align: center; margin-bottom: 20px; font-size: 1.2em; color: #ffd700;";
    this.marketUI.appendChild(coins);

    // Botón de cierre
    const closeButton = document.createElement("button");
    closeButton.textContent = "Cerrar";
    closeButton.style.cssText = `
      display: block;
      margin: 20px auto 0;
      padding: 10px 20px;
      background: #d9534f;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    `;
    closeButton.onclick = () => this.hideMarketUI();
    this.marketUI.appendChild(closeButton);

    document.body.appendChild(this.marketUI);
    this.marketUI.onclick = (e) => e.stopPropagation();
    document.addEventListener("click", this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    if (this.marketUI && !this.marketUI.contains(e.target)) {
      this.hideMarketUI();
    }
  };

  hideMarketUI() {
    if (!this.isUIOpen) return;
    if (this.marketUI) {
      document.body.removeChild(this.marketUI);
      this.marketUI = null;
    }
    document.removeEventListener("click", this.handleOutsideClick);
    this.isUIOpen = false;
  }
}
