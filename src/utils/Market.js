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
    this.radius = 1.5;
    this.marketItems = [
      {
        id: 1,
        name: "Núcleo de Fusión",
        description: "Alimenta el motor principal del transbordador con energía cuántica estable",
        image: "../assets/Núcleo de Fusión.png",
        price: 500,
        owned: false
      },
      {
        id: 2,
        name: "Membrana de Vacío",
        description: "Un panel flexible que se usa para sellar grietas en el casco",
        image: "../assets/Membrana de Vacío.png",
        price: 300,
        owned: false
      },
      {
        id: 3,
        name: "Chip de Navegación",
        description: "Un microprocesador que predice rutas seguras a través del espacio",
        image: "../assets/Chip de Navegación.png",
        price: 400,
        owned: false
      },
      {
        id: 4,
        name: "Catalizador de Plasma",
        description: "Cristal que contiene una sustancia incandescente que reacciona a la electricidad",
        image: "../assets/Catalizador de Plasma.png",
        price: 450,
        owned: false
      },
      {
        id: 5,
        name: "Llave Multipropósito",
        description: "Herramienta avanzada que permite manipular la masa de los objetos",
        image: "../assets/Llave de Ajuste multiproposito.png",
        price: 350,
        owned: false
      },
      {
        id: 6,
        name: "Cristal de Poder",
        description: "Potencia el motor para volver a casa",
        image: "../assets/Fragmento de Cristal.png",
        price: 600,
        owned: false
      }
    ];

    this.createMarket();
    this.createInteractionArea();
  }

  createMarket() {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    this.marketGroup = new THREE.Group();
    this.marketGroup.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );

    const targetPosition = new THREE.Vector3(-140.1, 0.0, 66.4);
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, this.marketGroup.position).normalize();
    this.marketGroup.rotation.y = Math.atan2(direction.x, direction.z);

    this.scene.add(this.marketGroup);

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

        const roofMaterial = new THREE.MeshStandardMaterial({
          map: texture.clone(),
          metalness: 0.05,
          roughness: 0.95,
          color: 0xffffff,
        });

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

        this.createWalls(stoneMaterial, windowMaterial);
        this.createRoof(roofMaterial);
        this.createAlienSign(width, height, depth, stoneMaterial);
      },
      undefined,
      (error) => {
        console.error("Error cargando textura:", error);
        const basicMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
        this.createWalls(basicMaterial, basicMaterial);
        this.createRoof(basicMaterial);
      }
    );
  }

  createWalls(stoneMaterial, windowMaterial) {
    const { width, height, depth } = this.size;
    const wallThickness = 0.3;

    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      stoneMaterial
    );
    frontWall.position.set(0, height / 2, depth / 2);
    this.marketGroup.add(frontWall);
    this.walls.push(frontWall);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      stoneMaterial
    );
    backWall.position.set(0, height / 2, -depth / 2);
    this.marketGroup.add(backWall);
    this.walls.push(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      stoneMaterial
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    this.marketGroup.add(leftWall);
    this.walls.push(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      stoneMaterial
    );
    rightWall.position.set(width / 2, height / 2, 0);
    this.marketGroup.add(rightWall);
    this.walls.push(rightWall);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.1, depth),
      stoneMaterial
    );
    floor.position.set(0, -0.05, 0);
    this.marketGroup.add(floor);

    const windowWidth = width * 0.6;
    const windowHeight = height * 0.4;
    const window = new THREE.Mesh(
      new THREE.PlaneGeometry(windowWidth, windowHeight),
      windowMaterial
    );
    window.position.set(0, height * 0.5, depth / 2 + 0.1);
    this.marketGroup.add(window);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "./src/assets/Alien2chat1m.png",
      (texture) => {
        const alienWindowSize = 2.5;
        const alienWindowMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        });
        
        const alienWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(alienWindowSize, alienWindowSize),
          alienWindowMaterial
        );
        
        alienWindow.position.set(0, height * 0.4 + 0.5, depth / 2 + 0.15);
        this.marketGroup.add(alienWindow);
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
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 2, 8),
      material
    );
    signPost.position.set(0, height + 1, depth / 2 + 0.2);
    this.marketGroup.add(signPost);

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

    this.createSignText("MERCADO", sign.position);
  }

  createSignText(text, position) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 256;

    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "Bold 100px Arial";
    context.fillStyle = "#00ff00";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const textGeometry = new THREE.PlaneGeometry(4, 1.5);
    const textMesh = new THREE.Mesh(textGeometry, material);

    textMesh.position.set(position.x, position.y, position.z + 0.1);

    this.marketGroup.add(textMesh);
  }

  createInteractionArea() {
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
      this.position.x + 5,
      0.1,
      this.position.z + 5
    );
    this.scene.add(this.interactionCircle);

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
    circle.position.y = 0.11;
    this.scene.add(circle);
  }

  update(playerPosition) {
    if (playerPosition) {
      this.checkPlayerPosition(playerPosition);
    }
  }

  checkPlayerPosition(playerPosition) {
    if (!playerPosition) return;

    const worldPosition = new THREE.Vector3();
    this.interactionCircle.getWorldPosition(worldPosition);
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - worldPosition.x, 2) +
      Math.pow(playerPosition.z - worldPosition.z, 2)
    );
    if (distance <= this.radius) {
      if (!this.isPlayerNearby) {
        this.isPlayerNearby = true;
        if (this.uiTimer) clearTimeout(this.uiTimer);
        this.uiTimer = setTimeout(() => {
          if (this.isPlayerNearby) {
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

    // Define los ítems del mercado
    this.marketItems = [
      {
        id: 1,
        name: "Núcleo de Fusión",
        description: "Alimenta el motor principal del transbordador con energía cuántica estable",
        image: "../assets/Núcleo de Fusión.png",
        price: 500,
        owned: false
      },
      {
        id: 2,
        name: "Membrana de Vacío",
        description: "Un panel flexible que se usa para sellar grietas en el casco",
        image: "../assets/Membrana de Vacío.png",
        price: 300,
        owned: false
      },
      {
        id: 3,
        name: "Chip de Navegación",
        description: "Un microprocesador antiguo que predice rutas seguras a través de tormentas espaciales y campos de asteroides",
        image: "../assets/Chip de Navegación.png",
        price: 400,
        owned: false
      },
      {
        id: 4,
        name: "Catalizador de Plasma",
        description: "Cristal flotante que contiene una sustancia incandescente que reacciona al contacto con la electricidad",
        image: "../assets/Catalizador de Plasma.png",
        price: 450,
        owned: false
      },
      {
        id: 5,
        name: "Llave Multipropósito",
        description: "Herramienta de ingeniería avanzada que permite manipular la masa de los objetos para montarlos",
        image: "../assets/Llave de Ajuste multipropósito.png",
        price: 350,
        owned: false
      },
      {
        id: 6,
        name: "Cristal de Poder",
        description: "Potencia el poder del motor para volver a casa",
        image: "../assets/Fragmento de Cristal.png",
        price: 600,
        owned: false
      }
    ];

    // Crear el contenedor principal del HUD
    this.marketUI = document.createElement("div");
    this.marketUI.id = "market-hud";
    this.marketUI.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00aa00;
      border-radius: 10px;
      padding: 20px;
      color: white;
      z-index: 999999 !important;
      width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: 'Arial', sans-serif;
      box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
      display: block;
      pointer-events: auto;
    `;

    // Título del mercado
    const title = document.createElement("h2");
    title.textContent = "Mercado Alienígena";
    title.style.cssText = `
      text-align: center; 
      margin: 0 0 20px 0; 
      color: #4cff4c; 
      font-size: 28px;
      text-shadow: 0 0 10px rgba(76, 255, 76, 0.7);
      border-bottom: 2px solid #4cff4c;
      padding-bottom: 10px;
    `;
    this.marketUI.appendChild(title);

    // Mostrar monedas disponibles
    const coins = document.createElement("div");
    const coinsDisplay = document.createElement("span");
    coinsDisplay.textContent = `Monedas: ${window.inventory?.coins || 0} `;
    coins.style.cssText = `
      position: absolute;
      top: 25px;
      right: 25px;
      font-size: 1.2em;
      color: #ffd700;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 15px;
      border-radius: 20px;
      border: 1px solid #ffd700;
      display: flex;
      align-items: center;
      gap: 5px;
    `;
    
    // Añadir icono de moneda
    const coinIcon = document.createElement("span");
    coinIcon.innerHTML = '🪙';
    coinsDisplay.appendChild(coinIcon);
    coins.appendChild(coinsDisplay);
    this.marketUI.appendChild(coins);

    // Contenedor de los ítems
    const itemsContainer = document.createElement("div");
    itemsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 20px 0;
    `;

    // Crear un ítem para cada elemento del mercado
    this.marketItems.forEach((item, index) => {
      const itemElement = document.createElement("div");
      itemElement.dataset.id = item.id;
      // Apply base styles
      itemElement.style.cssText = `
        background: rgba(30, 30, 40, 0.7);
        border: 1px solid #4cff4c;
        border-radius: 10px;
        padding: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      `;
      
      // Add hover effect with event listeners
      itemElement.addEventListener('mouseenter', () => {
        itemElement.style.transform = 'translateY(-5px)';
        itemElement.style.boxShadow = '0 5px 15px rgba(76, 255, 76, 0.3)';
        itemElement.style.borderColor = '#7fff7f';
      });
      
      itemElement.addEventListener('mouseleave', () => {
        itemElement.style.transform = '';
        itemElement.style.boxShadow = '';
        itemElement.style.borderColor = '#4cff4c';
      });

      // Número del ítem
      const itemNumber = document.createElement("div");
      itemNumber.textContent = `${index + 1}`;
      itemNumber.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: #4cff4c;
        color: #000;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
      `;
      itemElement.appendChild(itemNumber);

      // Imagen del ítem
      const itemImage = document.createElement("div");
      itemImage.style.cssText = `
        width: 80px;
        height: 80px;
        margin: 0 auto 10px;
        background: rgba(100, 100, 100, 0.3) url('${item.image}') no-repeat center center;
        background-size: contain;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      `;
      itemImage.textContent = item.name.charAt(0); // Placeholder
      
      itemElement.appendChild(itemImage);

      // Nombre del ítem
      const itemName = document.createElement("div");
      itemName.textContent = item.name;
      itemName.style.cssText = `
        font-weight: bold;
        text-align: center;
        margin: 5px 0;
        color: #7fff7f;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      itemElement.appendChild(itemName);

      // Precio
      const itemPrice = document.createElement("div");
      itemPrice.textContent = `$${item.price}`;
      itemPrice.style.cssText = `
        text-align: center;
        color: #ffd700;
        font-size: 16px;
        font-weight: bold;
        margin: 5px 0;
      `;
      itemElement.appendChild(itemPrice);

      // Evento de clic para mostrar detalles
      itemElement.addEventListener("click", () => this.showItemDetails(item));
      
      itemsContainer.appendChild(itemElement);
    });

    // Añadir contenedor de ítems al HUD
    this.marketUI.appendChild(itemsContainer);

    // Botón de cerrar
    const closeButton = document.createElement("button");
    closeButton.textContent = "Cerrar";
    // Base styles for close button
    closeButton.style.cssText = `
      display: block;
      margin: 20px auto 0;
      padding: 10px 30px;
      background: #d9534f;
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    `;
    
    // Add hover effect with event listeners
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#c9302c';
      closeButton.style.transform = 'scale(1.05)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#d9534f';
      closeButton.style.transform = '';
    });
    closeButton.onclick = (e) => {
      e.stopPropagation();
      this.hideMarketUI();
    };
    this.marketUI.appendChild(closeButton);

    // Añadir al documento
    document.body.appendChild(this.marketUI);
    this.marketUI.onclick = (e) => e.stopPropagation();
    document.addEventListener("click", this.handleOutsideClick);
  }

  // Mostrar detalles del ítem seleccionado
  showItemDetails(item) {
    // Ocultar la vista principal
    this.marketUI.style.display = 'none';
    
    // Crear contenedor de detalles
    const detailsView = document.createElement("div");
    detailsView.id = "item-details";
    detailsView.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #4cff4c;
      border-radius: 10px;
      padding: 25px;
      color: white;
      z-index: 1000000;
      width: 700px;
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      font-family: 'Arial', sans-serif;
      box-shadow: 0 0 30px rgba(76, 255, 76, 0.4);
      display: flex;
      flex-direction: column;
    `;

    // Botón de volver
    const backButton = document.createElement("button");
    backButton.innerHTML = '&larr; Volver';
    // Base styles for back button
    backButton.style.cssText = `
      align-self: flex-start;
      background: none;
      border: 1px solid #4cff4c;
      color: #4cff4c;
      padding: 5px 15px;
      border-radius: 15px;
      margin-bottom: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;
    
    // Add hover effect with event listeners
    backButton.addEventListener('mouseenter', () => {
      backButton.style.background = 'rgba(76, 255, 76, 0.2)';
    });
    
    backButton.addEventListener('mouseleave', () => {
      backButton.style.background = 'none';
    });
    backButton.onclick = () => {
      document.body.removeChild(detailsView);
      this.marketUI.style.display = 'block';
    };
    detailsView.appendChild(backButton);

    // Contenido de detalles
    const content = document.createElement("div");
    content.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: 25px;
      align-items: flex-start;
      @media (max-width: 768px) {
        flex-direction: column;
        align-items: center;
      }
    `;

    // Imagen del ítem
    const itemImage = document.createElement("div");
    itemImage.style.cssText = `
      width: 200px;
      height: 200px;
      background: rgba(100, 100, 100, 0.3) url('${item.image}') no-repeat center center;
      background-size: contain;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      flex-shrink: 0;
      border: 2px solid #4cff4c;
    `;
    itemImage.textContent = item.name.charAt(0); // Placeholder
    
    // Información del ítem
    const itemInfo = document.createElement("div");
    itemInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;

    // Título
    const title = document.createElement("h2");
    title.textContent = item.name;
    title.style.cssText = `
      margin: 0 0 10px 0;
      color: #4cff4c;
      font-size: 24px;
    `;
    
    // Precio
    const price = document.createElement("div");
    price.textContent = `Precio: $${item.price}`;
    price.style.cssText = `
      font-size: 20px;
      color: #ffd700;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 5px;
    `;
    
    // Añadir icono de moneda
    const coinIcon = document.createElement("span");
    coinIcon.innerHTML = '🪙';
    price.insertBefore(coinIcon, price.firstChild);

    // Descripción
    const description = document.createElement("p");
    description.textContent = item.description;
    description.style.cssText = `
      margin: 0 0 25px 0;
      line-height: 1.6;
      color: #ddd;
      flex: 1;
    `;

    // Botón de compra
    const buyButton = document.createElement("button");
    const updateButtonState = () => {
      const canAfford = window.inventory?.coins >= item.price;
      buyButton.textContent = item.owned 
        ? "✓ Ya comprado" 
        : canAfford 
          ? `Comprar por $${item.price} ` 
          : `$ ${item.price} (No tienes suficientes monedas)`;
      
      buyButton.disabled = item.owned;
      buyButton.style.cssText = `
        align-self: flex-start;
        background: ${item.owned ? '#666' : canAfford ? '#4CAF50' : '#d9534f'};
        color: white;
        border: none;
        border-radius: 5px;
        padding: 12px 25px;
        font-size: 14px;
        cursor: ${item.owned ? 'not-allowed' : canAfford ? 'pointer' : 'not-allowed'};
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      
      // Añadir icono
      const icon = document.createElement('span');
      icon.innerHTML = item.owned ? '✓' : canAfford ? '🛒' : '❌';
      buyButton.innerHTML = '';
      buyButton.appendChild(icon);
      buyButton.appendChild(document.createTextNode(
        item.owned 
          ? ' Ya comprado' 
          : canAfford 
            ? ` Comprar por $${item.price}` 
            : ` $${item.price} (No tienes suficientes monedas)`
      ));
    };
    
    updateButtonState();
    
    // Add hover effect if item is not owned and can be afforded
    if (!item.owned) {
      buyButton.addEventListener('mouseenter', () => {
        if (window.inventory?.coins >= item.price) {
          buyButton.style.transform = 'scale(1.02)';
          buyButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        }
      });
      
      buyButton.addEventListener('mouseleave', () => {
        buyButton.style.transform = '';
        buyButton.style.boxShadow = '';
      });
      
      buyButton.onclick = () => {
        if (window.inventory?.coins >= item.price) {
          // Lógica de compra
          window.inventory.coins -= item.price;
          item.owned = true;
          
          // Actualizar el botón
          updateButtonState();
          
          // Actualizar monedas mostradas
          if (coinsDisplay) {
            coinsDisplay.textContent = `Monedas: ${window.inventory.coins} `;
            coinsDisplay.appendChild(coinIcon);
          }
          
          // Guardar en el inventario
          if (window.inventory.addItem) {
            window.inventory.addItem({
              id: item.id,
              name: item.name,
              description: item.description,
              image: item.image,
              type: 'item'
            });
          }
        }
      };
    }

    // Ensamblar la vista de detalles
    itemInfo.appendChild(title);
    itemInfo.appendChild(price);
    itemInfo.appendChild(description);
    itemInfo.appendChild(buyButton);
    
    content.appendChild(itemImage);
    content.appendChild(itemInfo);
    detailsView.appendChild(content);
    
    // Añadir al documento
    document.body.appendChild(detailsView);
    
    // Manejar clic fuera para cerrar
    const handleOutsideClick = (e) => {
      if (!detailsView.contains(e.target)) {
        document.body.removeChild(detailsView);
        this.marketUI.style.display = 'block';
        document.removeEventListener('click', handleOutsideClick);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
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