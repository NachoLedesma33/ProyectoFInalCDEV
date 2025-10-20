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
    this.radius = 1.5; // Radio del área de interacción (reducido de 3 a 1.5)

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
    
    // Cargar la textura del Alien2Chat1.png para la ventana cuadrada
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "./src/assets/Alien2chat1m.png",
      (texture) => {
        console.log("✅ Textura Alien2chat1.png cargada para la ventana");
        
        // Crear ventana cuadrada con la imagen del alien
        const alienWindowSize = 2.5; // Tamaño cuadrado
        const alienWindowMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        });
        
        const alienWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(alienWindowSize, alienWindowSize),
          alienWindowMaterial
        );
        
        // Posicionar en la pared frontal, frente al círculo verde
        // Elevando la posición 0.5 unidades más (aproximadamente 30px más alto)
        alienWindow.position.set(0, height * 0.4 + 0.5, depth / 2 + 0.15);
        this.marketGroup.add(alienWindow);
        
        console.log("✅ Ventana con imagen de alien añadida al mercado");
      },
      undefined,
      (error) => {
        console.error("Error cargando textura del alien:", error);
      }
    );
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
    if (!playerPosition) {
      console.warn("Market: playerPosition es undefined o null");
      return;
    }

    // Convertir la posición del círculo a coordenadas del mundo
    const worldPosition = new THREE.Vector3();
    this.interactionCircle.getWorldPosition(worldPosition);
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - worldPosition.x, 2) +
      Math.pow(playerPosition.z - worldPosition.z, 2)
    );
    if (distance <= this.radius) {
      if (!this.isPlayerNearby) {
        this.isPlayerNearby = true;
        // Añadir un retraso de 2.5 segundos antes de mostrar el HUD
        if (this.uiTimer) clearTimeout(this.uiTimer);
        this.uiTimer = setTimeout(() => {
          if (this.isPlayerNearby) { // Verificar que el jugador sigue en el círculo
            this.showMarketUI();
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

  showMarketUI() {
    if (this.isUIOpen) return;
    this.isUIOpen = true;
    console.log("Creando y mostrando HUD del mercado");

    // Crear el contenedor del HUD
    this.marketUI = document.createElement("div");
    this.marketUI.id = "market-hud";
    this.marketUI.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00aa00;
      border-radius: 10px;
      padding: 20px;
      color: white;
      z-index: 999999 !important;
      width: 640px;
      height: 437px;
      overflow-y: auto;
      font-family: 'Arial', sans-serif;
      box-shadow: 0 0 20px rgba(0, 200, 0, 0.5);
      display: block;
      pointer-events: auto;
    `;

    // Título
    const title = document.createElement("h2");
    title.textContent = "Mercado Alienígena";
    title.style.cssText = "text-align: center; margin-top: 0; color: #4caf50; font-size: 24px;";
    this.marketUI.appendChild(title);

    // Monedas disponibles - Ahora en la parte superior derecha
    const coins = document.createElement("div");
    coins.textContent = `Monedas disponibles: ${window.inventory?.coins || 0}`;
    coins.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      font-size: 1.2em;
      color: #ffd700;
      background: rgba(0, 0, 0, 0.5);
      padding: 5px 10px;
      border-radius: 5px;
      border: 1px solid #ffd700;
    `;
    this.marketUI.appendChild(coins);

    // Subtítulo de Herramientas
    const toolsTitle = document.createElement("h3");
    toolsTitle.textContent = "Herramientas";
    toolsTitle.style.cssText = "margin-top: 30px; color: #7fbfff; border-bottom: 1px solid #7fbfff; padding-bottom: 5px;";
    this.marketUI.appendChild(toolsTitle);

    // Contenedor de slots para herramientas
    const slotsContainer = document.createElement("div");
    slotsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
    `;

    // Crear 6 slots vacíos con placeholders
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement("div");
      slot.style.cssText = `
        background: rgba(50, 50, 50, 0.5);
        border: 1px solid #7fbfff;
        border-radius: 5px;
        height: 80px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      `;
      
      // Placeholder para imagen
      const placeholder = document.createElement("div");
      placeholder.style.cssText = `
        width: 50px;
        height: 50px;
        background: rgba(100, 100, 100, 0.3);
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      placeholder.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="#7fbfff" stroke-width="2" stroke-linecap="round"/></svg>';
      
      // Nombre del item (vacío por ahora)
      const itemName = document.createElement("div");
      itemName.textContent = `Item ${i+1}`;
      itemName.style.cssText = "margin-top: 5px; font-size: 12px; color: #ccc;";
      
      slot.appendChild(placeholder);
      slot.appendChild(itemName);
      slot.addEventListener("mouseover", () => {
        slot.style.background = "rgba(70, 70, 70, 0.7)";
      });
      slot.addEventListener("mouseout", () => {
        slot.style.background = "rgba(50, 50, 50, 0.5)";
      });
      
      slotsContainer.appendChild(slot);
    }
    
    this.marketUI.appendChild(slotsContainer);

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
    
    // Verificar que el HUD esté visible
    setTimeout(() => {
      const hud = document.getElementById("market-hud");
      if (hud) {
        console.log("HUD del mercado encontrado en DOM:", hud.style.display);
        console.log(
          "HUD del mercado visible:",
          hud.offsetWidth > 0 && hud.offsetHeight > 0
        );
        console.log("HUD del mercado z-index:", hud.style.zIndex);
      } else {
        console.error("HUD del mercado no encontrado en DOM");
      }
    }, 100);
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