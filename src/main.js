// Importaciones de Three.js y módulos personalizados
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js";

// Módulos personalizados
import { Terrain } from "./utils/Terrain.js";
import { Lighting } from "./utils/lighting.js";
import { ControlsManager } from "./utils/controls.js";
import { ModelLoader } from "./utils/modelLoader.js";
import { Skybox } from "./utils/Skybox.js";
import modelConfig from "./config/modelConfig.js";
import { CameraManager } from "./utils/CameraManager.js";
import { FarmerController } from "./utils/FarmerController.js";
import { Corral } from "./utils/Corral.js";
import { SpaceShuttle } from "./utils/SpaceShuttle.js";
import { Cow } from "./utils/Cow.js";
import { Stone } from "./utils/Stone.js";
import { House } from "./utils/House.js";
import { Market } from "./utils/Market.js";
import { Inventory } from "./utils/Inventory.js";
import { Alien2 } from "./utils/Alien2.js";
import { SmokeEffect } from "./effects/smokeEffect.js";

// Inicialización del menú principal
document.addEventListener("DOMContentLoaded", () => {
    const playButton = document.getElementById("play-button");
    const tutorialButton = document.getElementById("tutorial-button");
    const controlsButton = document.getElementById("controls-button");
    const soundButton = document.getElementById("sound-button");
    
    playButton.addEventListener("click", () => {
        document.getElementById("main-menu").style.display = "none";
        document.getElementById("game-container").style.display = "block";
        init().catch(console.error);
    });
    
    tutorialButton.addEventListener("click", () => {});
    controlsButton.addEventListener("click", () => {});
    soundButton.addEventListener("click", () => {});
});

// Variables globales principales de Three.js
let scene,
  renderer,
  cameraManager,
  camera,
  controls;

// Componentes personalizados
let terrain,
  lighting,
  clock,
  skybox;

// Variables para el minimap
let minimapCanvas,
  minimapCtx,
  minimapWidth = 340,
  minimapHeight = 249;
let worldBounds = { minX: -250, maxX: 100, minZ: -250, maxZ: 300 };

// Cargador de modelos
let modelLoader;

// Instancias de objetos del juego
let farmerController;
let corral;
let spaceShuttle;
let cows = [];
let stones = [];
let house;

// Configuración de controles de movimiento
const moveSpeed = 0.1;
const rotationSpeed = 0.05;

// Estado de las teclas (para controles WASD)
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

/**
 * Crear 6 vacas dentro del corral
 */
function createCows() {
  const cowPositions = [
    { x: 21.6, y: 0.0, z: 22.6 },
    { x: 21.6, y: 0.0, z: 17.2 },
    { x: 20.9, y: 0.0, z: 11.4 },
    { x: 9.6, y: 0.0, z: 21.9 },
    { x: 9.6, y: 0.0, z: 16.7 },
    { x: 9.6, y: 0.0, z: 12.6 },
  ];

  const centerLineStart = { x: 15.3, y: 0.0, z: 24.4 };
  const centerLineEnd = { x: 15.3, y: 0.0, z: 5.6 };

  cowPositions.forEach((position, index) => {
    const cow = new Cow(scene, position);

    const targetZ = Math.max(
      centerLineEnd.z,
      Math.min(centerLineStart.z, position.z)
    );
    const lookAtPoint = { x: centerLineStart.x, y: position.y, z: targetZ };

    const orientCow = () => {
      if (cow.model) {
        const targetVector = new THREE.Vector3(
          lookAtPoint.x,
          lookAtPoint.y,
          lookAtPoint.z
        );
        cow.model.lookAt(targetVector);
      }
    };

    setTimeout(orientCow, 500);
    setTimeout(orientCow, 1000);
    setTimeout(orientCow, 2000);
    setTimeout(orientCow, 3000);

    cows.push(cow);
  });
}

/**
 * Inicializar el minimap HUD
 */
function initMinimap() {
  minimapCanvas = document.getElementById("minimap-canvas");
  if (!minimapCanvas) return;

  minimapCtx = minimapCanvas.getContext("2d");
  minimapCanvas.width = minimapWidth;
  minimapCanvas.height = minimapHeight;

  const minimapToggle = document.getElementById("minimap-toggle");
  const minimapClose = document.getElementById("minimap-close");
  const minimap = document.getElementById("minimap");

  let isMinimapExpanded = false;

  function collapseMinimap() {
    minimap.classList.remove("minimap-expanded");
    minimap.classList.add("minimap-collapsed");
    minimapToggle.classList.remove("hidden");
    isMinimapExpanded = false;
  }

  function expandMinimap() {
    minimap.classList.remove("minimap-collapsed");
    minimap.classList.add("minimap-expanded");
    minimapToggle.classList.add("hidden");
    isMinimapExpanded = true;
  }

  minimapToggle.addEventListener("click", () => {
    expandMinimap();
  });

  minimapClose.addEventListener("click", () => {
    collapseMinimap();
  });
}

/**
 * Convertir coordenadas del mundo a coordenadas del minimap
 */
function worldToMinimap(x, z) {
  const normalizedX =
    (x - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX);
  const normalizedZ =
    (z - worldBounds.minZ) / (worldBounds.maxZ - worldBounds.minZ);

  const minimapX = normalizedX * minimapWidth;
  const minimapY = normalizedZ * minimapHeight;

  return { x: minimapX, y: minimapY };
}

/**
 * Actualizar el minimap con todos los objetos
 */
function updateMinimap() {
  if (!minimapCtx || !minimapCanvas) return;

  minimapCtx.fillStyle = "rgba(25, 25, 25, 0.2)";
  minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight);

  minimapCtx.strokeStyle = "rgba(255, 255, 255, 0.01)";
  minimapCtx.lineWidth = 0.3;

  for (let x = worldBounds.minX; x <= worldBounds.maxX; x += 50) {
    const minimapX =
      ((x - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX)) *
      minimapWidth;
    minimapCtx.beginPath();
    minimapCtx.moveTo(minimapX, 0);
    minimapCtx.lineTo(minimapX, minimapHeight);
    minimapCtx.stroke();
  }

  for (let z = worldBounds.minZ; z <= worldBounds.maxZ; z += 50) {
    const minimapY =
      ((z - worldBounds.minZ) / (worldBounds.maxZ - worldBounds.minZ)) *
      minimapHeight;
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, minimapY);
    minimapCtx.lineTo(minimapWidth, minimapY);
    minimapCtx.stroke();
  }

  if (stones && stones.length > 0) {
    stones.forEach((stone, index) => {
      if (stone.model) {
        const pos = stone.model.position;
        const minimapPos = worldToMinimap(pos.x, pos.z);

        if (
          minimapPos.x >= 0 &&
          minimapPos.x <= minimapWidth &&
          minimapPos.y >= 0 &&
          minimapPos.y <= minimapHeight
        ) {
          minimapCtx.fillStyle = "rgba(139, 69, 19, 0.6)";
          minimapCtx.beginPath();
          minimapCtx.arc(minimapPos.x, minimapPos.y, 1.5, 0, Math.PI * 2);
          minimapCtx.fill();
        }
      }
    });
  }

  if (house && house.position) {
    const minimapPos = worldToMinimap(house.position.x, house.position.z);
    minimapCtx.fillStyle = "rgba(139, 69, 19, 0.5)";
    minimapCtx.fillRect(minimapPos.x - 3, minimapPos.y - 3, 6, 6);
  }

  if (spaceShuttle && spaceShuttle.model) {
    const pos = spaceShuttle.model.position;
    const minimapPos = worldToMinimap(pos.x, pos.z);
    minimapCtx.fillStyle = "rgba(192, 192, 192, 0.7)";
    minimapCtx.beginPath();
    minimapCtx.arc(minimapPos.x, minimapPos.y, 4, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  if (corral && corral.position) {
    const minimapPos = worldToMinimap(corral.position.x, corral.position.z);
    const size = 20;

    const sizeX = (size / (worldBounds.maxX - worldBounds.minX)) * minimapWidth;
    const sizeZ =
      (size / (worldBounds.maxZ - worldBounds.minZ)) * minimapHeight;

    minimapCtx.strokeStyle = "rgba(139, 69, 19, 0.4)";
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(
      minimapPos.x - sizeX / 2,
      minimapPos.y - sizeZ / 2,
      sizeX,
      sizeZ
    );
  }

  if (cows && cows.length > 0) {
    cows.forEach((cow) => {
      if (cow.model) {
        const pos = cow.model.position;
        const minimapPos = worldToMinimap(pos.x, pos.z);
        minimapCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
        minimapCtx.beginPath();
        minimapCtx.arc(minimapPos.x, minimapPos.y, 2, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });
  }

  if (farmerController && farmerController.model) {
    const pos = farmerController.model.position;
    const minimapPos = worldToMinimap(pos.x, pos.z);

    minimapCtx.fillStyle = "rgba(0, 255, 0, 0.8)";
    minimapCtx.save();
    minimapCtx.translate(minimapPos.x, minimapPos.y);

    const farmerRotation = farmerController.model.rotation.y;
    minimapCtx.rotate(farmerRotation + Math.PI);

    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -5);
    minimapCtx.lineTo(-3, 3);
    minimapCtx.lineTo(3, 3);
    minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.restore();
  }
}

/**
 * Crear 30 piedras con posiciones y modelos fijos
 */
function createStones() {
  const stonePositions = [
    { x: -150, y: 0.2, z: 150, scale: 0.3, modelType: 1 },
    { x: -120, y: 0.2, z: 180, scale: 0.4, modelType: 2 },
    { x: -170, y: 0.2, z: 200, scale: 0.25, modelType: 1 },
    { x: -140, y: 0.2, z: 120, scale: 0.35, modelType: 2 },
    { x: -160, y: 0.2, z: 170, scale: 0.45, modelType: 1 },
    { x: -130, y: 0.2, z: 140, scale: 0.3, modelType: 2 },
    { x: -180, y: 0.2, z: 160, scale: 0.4, modelType: 1 },
    { x: -110, y: 0.2, z: 190, scale: 0.35, modelType: 2 },
    { x: -112.0, y: 0.0, z: 14.3, scale: 0.35, modelType: 1 },
    { x: -164.1, y: 0.0, z: -29.7, scale: 0.3, modelType: 1 },
    { x: -231.6, y: 0.0, z: 237.8, scale: 0.2, modelType: 1 },
    { x: -210, y: 0.0, z: 80.2, scale: 0.35, modelType: 2 },
    { x: -225.0, y: 0.0, z: -61.1, scale: 0.35, modelType: 1 },
    { x: -101.3, y: 0.0, z: -192.5, scale: 0.35, modelType: 1 },
    { x: -20, y: 0.2, z: 120, scale: 0.3, modelType: 1 },
    { x: 10, y: 0.2, z: 140, scale: 0.4, modelType: 2 },
    { x: -30, y: 0.2, z: 160, scale: 0.25, modelType: 1 },
    { x: 20, y: 0.2, z: 100, scale: 0.35, modelType: 2 },
    { x: 0, y: 0.2, z: 130, scale: 0.45, modelType: 1 },
    { x: -10, y: 0.2, z: 150, scale: 0.3, modelType: 2 },
    { x: 30, y: 0.2, z: 110, scale: 0.4, modelType: 1 },
    { x: -40, y: 0.2, z: 170, scale: 0.35, modelType: 2 },
    { x: -20, y: 0.2, z: -150, scale: 0.3, modelType: 1 },
    { x: 10, y: 0.2, z: -170, scale: 0.4, modelType: 2 },
    { x: -30, y: 0.2, z: -130, scale: 0.25, modelType: 1 },
    { x: 20, y: 0.2, z: -160, scale: 0.35, modelType: 2 },
    { x: 0, y: 0.2, z: -140, scale: 0.45, modelType: 1 },
    { x: -10, y: 0.2, z: -180, scale: 0.3, modelType: 2 },
    { x: 30, y: 0.2, z: -120, scale: 0.4, modelType: 1 },
    { x: -40, y: 0.2, z: -190, scale: 0.35, modelType: 2 },
    { x: 100, y: 0.2, z: 150, scale: 0.3, modelType: 1 },
    { x: 130, y: 0.2, z: 180, scale: 0.4, modelType: 2 },
    { x: 80, y: 0.2, z: 200, scale: 0.25, modelType: 1 },
    { x: 110, y: 0.2, z: 120, scale: 0.35, modelType: 2 },
    { x: 90, y: 0.2, z: 170, scale: 0.45, modelType: 1 },
    { x: 120, y: 0.2, z: 140, scale: 0.3, modelType: 2 },
  ];

  stonePositions.forEach((stoneData, index) => {
    const stone = new Stone(
      scene,
      { x: stoneData.x, y: stoneData.y, z: stoneData.z },
      stoneData.scale,
      stoneData.modelType
    );
    stones.push(stone);
  });
}

/**
 * Crear la casa con textura de piedra y puerta interactiva
 */
function createHouse() {
  house = new House(
    scene,
    { x: -23.5, y: 0.0, z: -5.0 },
    { width: 20, height: 8, depth: 15 }
  );
}

/**
 * Crear el mercado con textura de piedra y ventana frontal
 */
function createMarket() {
  const market = new Market(
    scene,
    { x: -155.8, y: 0.0, z: 53.3 },
    { width: 12, height: 6, depth: 8 }
  );

  return market;
}

/**
 * Crear y configurar el alien2 en la escena
 */
async function createAlien2() {
  const alien2 = new Alien2(
    scene,
    modelLoader,
    { x: -52.5, y: 0.0, z: -159.7 },
    { x: -51.5, y: 0.0, z: -158.7 }
  );

  await alien2.load();
  alien2.startMovementSequence();
  
  return alien2;
}

/**
 * Función de inicialización principal
 */
async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x5e5d5d, 100, 500);

  // Crear efecto de humo en las coordenadas especificadas
  smokeEffect = new SmokeEffect(scene, { x: 52.4, y: 0.0, z: -30.2 });

  THREE.Cache.enabled = true;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById("container").appendChild(renderer.domElement);

  cameraManager = new CameraManager(scene, {
    fov: 75,
    near: 0.5,
    far: 2000,
  });

  camera = cameraManager.getCamera();
  clock = new THREE.Clock();

  (async () => {
    try {
      const skyboxPaths = [
        "src/assets/FondoDiaEstrellado3.png",
        "./src/assets/FondoDiaEstrellado3.png",
        "/src/assets/FondoDiaEstrellado3.png",
        "assets/FondoDiaEstrellado3.png",
        "./assets/FondoDiaEstrellado3.png",
      ];

      for (const path of skyboxPaths) {
        try {
          skybox = new Skybox(scene, path);
          break;
        } catch (err) {
          continue;
        }
      }

      if (!skybox) {
        throw new Error("No se pudo cargar ninguna textura de skybox");
      }

      renderer.setClearColor(0x000000, 1);
      renderer.outputEncoding = THREE.sRGBEncoding;
    } catch (error) {
      scene.background = new THREE.Color(0x87ceeb);
    }
  })();

  lighting = new Lighting(scene);
  terrain = new Terrain(scene, renderer);
  modelLoader = new ModelLoader(scene);

  corral = new Corral(
    scene,
    { x: 15, y: 0, z: 15 },
    { width: 20, height: 2, depth: 20 }
  );

  spaceShuttle = new SpaceShuttle(
    scene,
    { x: 50, y: 0, z: -30 },
    0.1
  );

  createCows();
  createStones();
  createHouse();
  
  const alien2 = await createAlien2();
  window.alien2 = alien2;

  const market = createMarket();
  window.market = market;

  cameraManager.setupControls(renderer.domElement);
  controls = cameraManager.getControls();

  if (renderer.shadowMap) {
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }

  const farmerConfig = modelConfig.characters.farmer2;

  const animationPaths = {};
  for (const [animName, animPath] of Object.entries(farmerConfig.animations)) {
    animationPaths[animName] = modelConfig.getPath(animPath);
  }

  try {
    await modelLoader.load(
      modelConfig.getPath(farmerConfig.model),
      animationPaths,
      (instance) => {
        if (instance.model) {
          cameraManager.setTarget(instance.model);
          camera = cameraManager.getCamera();

          farmerController = new FarmerController(
            instance.model,
            modelLoader,
            camera,
            {
              moveSpeed: 0.1,
              rotationSpeed: 0.05,
              runMultiplier: 1.5,
            }
          );

          try {
            const inventory = new Inventory({ pricePerLiter: 5 });
            window.inventory = inventory;
            if (typeof farmerController.setInventory === "function") {
              farmerController.setInventory(inventory);
            }
          } catch (e) {}

          if (corral) {
            farmerController.setCorral(corral);
          }

          if (spaceShuttle) {
            farmerController.setSpaceShuttle(spaceShuttle);
          }

          if (farmerController && stones && stones.length > 0) {
            farmerController.setStones(stones);
          }

          if (farmerController && house) {
            farmerController.setHouse(house);
          }

          if (farmerController && cows && cows.length > 0) {
            farmerController.setCows(cows);
          }

          if (farmerController && market) {
            farmerController.setMarket(market);
          }
        }
      },
      farmerConfig
    );
  } catch (error) {}

  (async () => {
    try {
      const axePath = modelConfig.getPath("weapons/melee/axes/axe.fbx");
      const axeModel = await modelLoader.loadModel(axePath);
      let axeMesh = null;
      axeModel.traverse((c) => {
        if (!axeMesh && c.isMesh) axeMesh = c.clone();
      });

      if (!axeMesh) axeMesh = axeModel;

      if (axeMesh) {
        axeMesh.name = "equip_axe";
      }

      window.loadedAxe = axeMesh;

      if (window.inventory && typeof window.inventory.addTool === "function") {
        window.inventory.addTool("Hacha");
      }
    } catch (err) {}
  })();

  setupEventListeners();

  window.addEventListener("keydown", (ev) => {
    const tag =
      (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (!window.inventory) return;
    const k = ev.key;
    if (/^[1-5]$/.test(k)) {
      const idx = Number(k) - 1;
      try {
        window.inventory.toggleSlot(idx);
      } catch (e) {}
    }
  });

  if (window.inventory && farmerController) {
    window.inventory.onEquipChange = (slotIndex, toolName) => {
      try {
        if (!toolName) {
          if (typeof farmerController.unequipTool === "function")
            farmerController.unequipTool();
        } else {
          if (typeof farmerController.equipTool === "function")
            farmerController.equipTool(toolName);
        }
      } catch (e) {}
    };
  }

  initMinimap();
  animate();
}

/**
 * Configura los listeners de eventos de la ventana
 */
function setupEventListeners() {
  window.addEventListener("resize", onWindowResize);

  window.addEventListener("keydown", (ev) => {
    const tag =
      (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (ev.key && ev.key.toLowerCase() === "i") {
      if (window.inventory && typeof window.inventory.toggle === "function") {
        window.inventory.toggle();
      }
    }
  });
}

/**
 * Maneja el redimensionamiento de la ventana
 */
function onWindowResize() {
  if (cameraManager) {
    cameraManager.onWindowResize();
  }

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Variables globales
let smokeEffect;

// Variables para el control de FPS
let lastTime = 0;
const targetFPS = 60;
const frameTime = 1000 / targetFPS;

// Variables para optimización de actualizaciones
let minimapUpdateCounter = 0;
const minimapUpdateInterval = 10;
let terrainUpdateCounter = 0;
const terrainUpdateInterval = 5;
let skyboxUpdateCounter = 0;
const skyboxUpdateInterval = 3;

function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  const deltaTime = currentTime - lastTime;
  if (deltaTime < frameTime) return;
  lastTime = currentTime - (deltaTime % frameTime);

  const delta = Math.min(0.05, clock.getDelta());

  try {
    if (cameraManager) {
      cameraManager.update(delta);
    }

    if (farmerController) {
      farmerController.update(delta);
    }

    if (modelLoader) {
      modelLoader.update(delta);
    }
    
    if (window.alien2 && window.alien2.update) {
      window.alien2.update(delta);
    }

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => {
        if (corral && farmerController?.model) {
          corral.update(delta, farmerController.model.position);
        }

        if (house && farmerController?.model) {
          house.update(delta, farmerController.model.position);
        }

        if (spaceShuttle) {
          spaceShuttle.update(delta);
        }
      });
    }

    for (let i = 0; i < cows.length; i++) {
      cows[i].update(delta);
    }

    for (let i = 0; i < stones.length; i++) {
      stones[i].update(delta);
    }
    
    if (window.market && farmerController?.model) {
      window.market.update(farmerController.model.position);
    }
    
    // Actualizar el efecto de humo
    if (smokeEffect) {
      smokeEffect.update(delta);
    }

    if (terrainUpdateCounter++ >= terrainUpdateInterval) {
      terrain?.update(camera.position);
      terrainUpdateCounter = 0;
    }

    if (skyboxUpdateCounter++ >= skyboxUpdateInterval && skybox) {
      skybox.update(camera.position);
      skyboxUpdateCounter = 0;
    }

    if (terrain?.animateFires) {
      terrain.animateFires();
    }

    lighting?.update(delta);

    if (minimapUpdateCounter++ >= minimapUpdateInterval * 2) {
      updateMinimap();
      minimapUpdateCounter = 0;
    }

    renderer.render(scene, camera);
  } catch (error) {}
}


window.THREE = THREE; /* Biblioteca Three.js completa*/
window.scene = scene; /*Escena 3D*/
window.camera = camera; /* Cámara activa*/
window.renderer = renderer; /* Renderizador WebG*/
