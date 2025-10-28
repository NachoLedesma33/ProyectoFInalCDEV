// Importaciones de Three.js y módulos personalizados
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

// Módulos personalizados
import { Terrain } from "./utils/Terrain.js"; // Manejo del terreno
import { Lighting } from "./utils/lighting.js"; // Sistema de iluminación
// ControlsManager se usa internamente en CameraManager; no es necesario importarlo aquí
import { ModelLoader } from "./utils/modelLoader.js"; // Carga de modelos 3D
import { Skybox } from "./utils/Skybox.js"; // Fondo 360°
import modelConfig from "./config/modelConfig.js"; // Configuración de modelos
import { CameraManager } from "./utils/CameraManager.js"; // Gestor de cámara
import { FarmerController } from "./utils/FarmerController.js"; // Controlador del granjero
import { Corral } from "./utils/Corral.js"; // Corral con sistema de colisiones
import { SpaceShuttle } from "./utils/SpaceShuttle.js"; // Space Shuttle Orbiter
import { Cow } from "./utils/Cow.js"; // Modelo de vaca
import { Stone } from "./utils/Stone.js"; // Modelo de piedra
import { House } from "./utils/House.js"; // Casa con puerta interactiva
import { Market } from "./utils/Market.js"; // Mercado con ventana frontal
import { Inventory } from "./utils/Inventory.js"; // Inventario del personaje
import { Alien2 } from "./utils/Alien2.js"; // Alien2
import { ShipRepair } from "./utils/ShipRepair.js";
import { SmokeEffect } from "./utils/smokeEffect.js"; // Efecto de humo
import { showFinalScene } from "./utils/finalScene.js";
import { makeMinimap } from "./utils/minimap.js";
import { createStoryManager, storySlides } from "./utils/startMenu.js";

// Inicialización del menú principal
document.addEventListener("DOMContentLoaded", () => {
  // Configurar los botones del menú principal
  const playButton = document.getElementById("play-button");
  const tutorialButton = document.getElementById("tutorial-button");
  const controlsButton = document.getElementById("controls-button");
  const soundButton = document.getElementById("sound-button");

  // Usamos el manager del carrusel/historia modular
  const storyManager = createStoryManager(storySlides, () => {
    // Este callback se ejecuta una sola vez para iniciar la carga en background
    if (!window.__gameInitPromise) {
      window.__gameInitPromise = new Promise((resolve) => {
        setTimeout(() => {
          init()
            .then(() => {
              window.__gameInitialized = true;
              resolve();
            })
            .catch(console.error);
        }, 100);
      });
    }
    return window.__gameInitPromise;
  });

  // Conectar el play button al manager
  storyManager.attachToPlayButton(playButton);

  // Por ahora, los otros botones no tienen funcionalidad
  tutorialButton.addEventListener("click", () => {
    console.log("Tutorial button clicked");
  });

  controlsButton.addEventListener("click", () => {
    console.log("Controls button clicked");
  });

  soundButton.addEventListener("click", () => {
    console.log("Sound button clicked");
  });
});

// Variables globales principales de Three.js
let scene, // Escena 3D que contiene todos los objetos
  renderer, // Motor de renderizado WebGL
  cameraManager, // Gestor de cámara
  camera, // Cámara que define la vista del usuario (accesible a través de cameraManager)
  controls, // Controles de la cámara (accesibles a través de cameraManager)
  smokeEffect; // Efecto de humo

// Componentes personalizados
let terrain, // Gestor del terreno
  lighting, // Sistema de iluminación
  clock, // Reloj para animaciones
  skybox; // Fondo 360°

// Variables para el minimap
let minimapWidth = 340,
  minimapHeight = 249;
let worldBounds = { minX: -250, maxX: 100, minZ: -250, maxZ: 300 }; // Límites del mundo ajustados para todas las piedras

// Minimapa modular
let minimapManager = makeMinimap({ width: minimapWidth, height: minimapHeight, worldBounds });

// Cargador de modelos
let modelLoader; // Maneja la carga y animación de modelos 3D

// Instancia del controlador del granjero
let farmerController;

// Instancia del corral
let corral;

// Instancia del Space Shuttle Orbiter
let spaceShuttle;
let shipRepair;

// Array de vacas en el corral
let cows = [];

// Array de piedras en el terreno
let stones = [];

// Instancia de la casa
let house;

// Configuración de la cámara isométrica
// La cámara ahora es manejada por el CameraManager en modo isométrico

// Configuración de controles de movimiento
const moveSpeed = 0.1; // Velocidad de movimiento base
const rotationSpeed = 0.05; // Velocidad de rotación

// Estado de las teclas (para controles WASD)
const keys = {
  w: false, // Avanzar
  a: false, // Izquierda
  s: false, // Retroceder
  d: false, // Derecha
};

// La inicialización del juego ahora se maneja a través del botón Jugar
// init().catch(console.error);

/**
 * Crear 6 vacas dentro del corral
 */
function createCows() {
  console.log("Creando 6 vacas dentro del corral...");

  // Posiciones específicas para las 6 vacas dentro del corral
  const cowPositions = [
    { x: 21.6, y: 0.0, z: 22.6 }, // Vaca 1
    { x: 21.6, y: 0.0, z: 17.2 }, // Vaca 2
    { x: 20.9, y: 0.0, z: 11.4 }, // Vaca 3
    { x: 9.6, y: 0.0, z: 21.9 }, // Vaca 4 (corregida posición duplicada)
    { x: 9.6, y: 0.0, z: 16.7 }, // Vaca 5 (posición adicional)
    { x: 9.6, y: 0.0, z: 12.6 }, // Vaca 6
  ];

  // Línea central del corral (desde z: 24.4 hasta z: 5.6 en x: 15.3)
  const centerLineStart = { x: 15.3, y: 0.0, z: 24.4 };
  const centerLineEnd = { x: 15.3, y: 0.0, z: 5.6 };

  // Crear cada vaca
  cowPositions.forEach((position, index) => {
    const cow = new Cow(scene, position); // La escala se calcula automáticamente para coincidir con el farmer

    // Calcular el punto más cercano en la línea central para que la vaca mire hacia adentro
    const targetZ = Math.max(
      centerLineEnd.z,
      Math.min(centerLineStart.z, position.z)
    );
    const lookAtPoint = { x: centerLineStart.x, y: position.y, z: targetZ };

    // Orientar la vaca hacia el punto de la línea central
    const orientCow = () => {
      if (cow.model) {
        const targetVector = new THREE.Vector3(
          lookAtPoint.x,
          lookAtPoint.y,
          lookAtPoint.z
        );
        cow.model.lookAt(targetVector);
        console.log(
          `Vaca ${index + 1} orientada hacia la línea central:`,
          lookAtPoint
        );
      } else {
        console.log(`Vaca ${index + 1} modelo aún no cargado, reintentando...`);
      }
    };

    // Intentar orientar inmediatamente y luego varios reintentos
    setTimeout(orientCow, 500);
    setTimeout(orientCow, 1000);
    setTimeout(orientCow, 2000);
    setTimeout(orientCow, 3000);

    cows.push(cow);
    console.log(
      `Vaca ${index + 1} creada en posición:`,
      position,
      "mirando hacia:",
      lookAtPoint
    );
  });

  // Hacer las vacas accesibles para depuración
  window.cows = cows;
  console.log("Vacas disponibles como 'window.cows' para depuración");

  console.log("✅ 6 vacas creadas exitosamente dentro del corral");
}

/**
 * Inicializar el minimap HUD
 */
function initMinimap() {
  // Inicialización delegada al manager modular
  try {
    minimapManager.init("minimap-canvas");
  } catch (e) {
    console.warn("No se pudo inicializar minimapManager:", e);
  }
}

/**
 * Actualizar el minimap con todos los objetos
 */
function updateMinimap() {
  // Delegado al manager
  try {
    minimapManager.setReferences({
      stones,
      house,
      spaceShuttle,
      corral,
      market,
      cows,
      farmerController,
    });
    minimapManager.update();
  } catch (e) {
    // No crítico
  }
}

/**
 * Crear 30 piedras con posiciones y modelos fijos
 */
function createStones() {
  console.log("Creando 30 piedras con posiciones y modelos fijos...");

  // Array con posiciones y modelos fijos para las 30 piedras
  const stonePositions = [
    // Zona izquierda (lejos del corral)
    { x: -150, y: 0.2, z: 150, scale: 0.3, modelType: 1 },
    { x: -120, y: 0.2, z: 180, scale: 0.4, modelType: 2 },
    { x: -170, y: 0.2, z: 200, scale: 0.25, modelType: 1 },
    { x: -140, y: 0.2, z: 120, scale: 0.35, modelType: 2 },
    { x: -160, y: 0.2, z: 170, scale: 0.45, modelType: 1 },
    { x: -130, y: 0.2, z: 140, scale: 0.3, modelType: 2 },
    { x: -180, y: 0.2, z: 160, scale: 0.4, modelType: 1 },
    { x: -110, y: 0.2, z: 190, scale: 0.35, modelType: 2 },

    // Piedra adicional solicitada
    { x: -112.0, y: 0.0, z: 14.3, scale: 0.35, modelType: 1 },
    { x: -164.1, y: 0.0, z: -29.7, scale: 0.3, modelType: 1 },
    { x: -231.6, y: 0.0, z: 237.8, scale: 0.2, modelType: 1 },
    { x: -210, y: 0.0, z: 80.2, scale: 0.35, modelType: 2 },
    { x: -225.0, y: 0.0, z: -61.1, scale: 0.35, modelType: 1 },

    // Piedra adicional 3 solicitada
    { x: -101.3, y: 0.0, z: -192.5, scale: 0.35, modelType: 1 },

    // Zona centro (evitando área del corral) - mitad superior
    { x: -20, y: 0.2, z: 120, scale: 0.3, modelType: 1 },
    { x: 10, y: 0.2, z: 140, scale: 0.4, modelType: 2 },
    { x: -30, y: 0.2, z: 160, scale: 0.25, modelType: 1 },
    { x: 20, y: 0.2, z: 100, scale: 0.35, modelType: 2 },
    { x: 0, y: 0.2, z: 130, scale: 0.45, modelType: 1 },
    { x: -10, y: 0.2, z: 150, scale: 0.3, modelType: 2 },
    { x: 30, y: 0.2, z: 110, scale: 0.4, modelType: 1 },
    { x: -40, y: 0.2, z: 170, scale: 0.35, modelType: 2 },

    // Zona centro - mitad inferior (más lejos de la nave)
    { x: -20, y: 0.2, z: -150, scale: 0.3, modelType: 1 },
    { x: 10, y: 0.2, z: -170, scale: 0.4, modelType: 2 },
    { x: -30, y: 0.2, z: -130, scale: 0.25, modelType: 1 },
    { x: 20, y: 0.2, z: -160, scale: 0.35, modelType: 2 },
    { x: 0, y: 0.2, z: -140, scale: 0.45, modelType: 1 },
    { x: -10, y: 0.2, z: -180, scale: 0.3, modelType: 2 },
    { x: 30, y: 0.2, z: -120, scale: 0.4, modelType: 1 },
    { x: -40, y: 0.2, z: -190, scale: 0.35, modelType: 2 },

    // Zona derecha (lejos del corral)
    { x: 100, y: 0.2, z: 150, scale: 0.3, modelType: 1 },
    { x: 130, y: 0.2, z: 180, scale: 0.4, modelType: 2 },
    { x: 80, y: 0.2, z: 200, scale: 0.25, modelType: 1 },
    { x: 110, y: 0.2, z: 120, scale: 0.35, modelType: 2 },
    { x: 90, y: 0.2, z: 170, scale: 0.45, modelType: 1 },
    { x: 120, y: 0.2, z: 140, scale: 0.3, modelType: 2 },
  ];

  // Crear cada piedra con sus posiciones y modelos fijos
  stonePositions.forEach((stoneData, index) => {
    const stone = new Stone(
      scene,
      { x: stoneData.x, y: stoneData.y, z: stoneData.z },
      stoneData.scale,
      stoneData.modelType
    );
    stones.push(stone);
    console.log(
      `Piedra ${index + 1} (ST_Stone${
        stoneData.modelType
      }.fbx) creada en posición: (${stoneData.x}, ${stoneData.y}, ${
        stoneData.z
      }) con escala ${stoneData.scale}`
    );
  });

  // Hacer las piedras accesibles para depuración
  window.stones = stones;
  console.log("Piedras disponibles como 'window.stones' para depuración");

  console.log(
    "✅ 30 piedras creadas exitosamente con posiciones y modelos fijos"
  );
}

/**
 * Crear la casa con textura de piedra y puerta interactiva
 */
function createHouse() {
  console.log("Creando casa con puerta interactiva...");

  // Crear la casa en las coordenadas especificadas
  house = new House(
    scene,
    { x: -23.5, y: 0.0, z: -5.0 }, // Posición ajustada para mejor orientación de la puerta
    { width: 20, height: 8, depth: 15 } // Tamaño rectangular más ancho y profundo
  );

  // La conexión con el farmerController se hará después de que se cree el controlador

  // Hacer la casa accesible desde la consola para depuración
  window.house = house;
  console.log("Casa disponible como 'window.house' para depuración");

  console.log(
    "✅ Casa creada exitosamente con textura de piedra y puerta interactiva"
  );
}

/**
 * Crear el mercado con textura de piedra y ventana frontal
 */
function createMarket() {
  console.log("Creando mercado con ventana frontal...");

  // Crear efecto de humo en las coordenadas especificadas
  smokeEffect = new SmokeEffect(scene, { x: 52.4, y: 0.0, z: -30.2 });

  // Crear el mercado en las coordenadas especificadas
  const market = new Market(
    scene,
    { x: -155.8, y: 0.0, z: 53.3 }, // Posición especificada
    { width: 12, height: 6, depth: 8 } // Tamaño rectangular con el lado más ancho al frente
  );

  // Hacer el mercado accesible desde la consola para depuración
  window.market = market;
  console.log("Mercado disponible como 'window.market' para depuración");
  console.log(
    "✅ Mercado creado exitosamente con textura de piedra y ventana frontal"
  );

  return market;
}

/**
 * Crear la interacción de reparación de la nave (círculo y HUD)
 */
function createShipRepair() {
  console.log("Creando interacción de reparación de la nave en coords 39.9,0.0,-21.1");
  shipRepair = new ShipRepair(scene, { x: 39.9, y: 0.0, z: -21.1 }, 1.5);
  window.shipRepair = shipRepair;
  console.log("ShipRepair disponible como 'window.shipRepair' para depuración");
}
/**
 * Crear y configurar el alien2 en la escena
 */
async function createAlien2() {
  const alien2 = new Alien2(
    scene,
    modelLoader,
    { x: -52.5, y: 0.0, z: -159.7 }, // Posición inicial correcta
    { x: -51.5, y: 0.0, z: -158.7 } // Punto de mira inicial
  );

  await alien2.load();
  window.alien2 = alien2;
  console.log("Alien2 disponible como 'window.alien2' para depuración");
  return alien2;
}
/**
 * Función de inicialización principal
 * Configura la escena, cámara, renderizador y carga los recursos
 */
async function init() {
  // Crear y configurar la escena 3D
  scene = new THREE.Scene();

  // Fondo temporal hasta cargar el skybox
  scene.background = new THREE.Color(0x000000);

  // Configurar niebla para dar profundidad (color, near, far)
  scene.fog = new THREE.Fog(0x5e5d5d, 100, 500);

  // Habilitar caché para mejor rendimiento
  THREE.Cache.enabled = true;

  // Configuración avanzada del renderizador WebGL
  renderer = new THREE.WebGLRenderer({
    antialias: true, // Suavizado de bordes
    alpha: true, // Permitir transparencia
    powerPreference: "high-performance", // Optimización de rendimiento
    stencil: false, // No se usa búfer de stencil
    depth: true, // Habilitar búfer de profundidad
  });
  // Configuración del renderizador
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimizar para pantallas de alta densidad
  renderer.setSize(window.innerWidth, window.innerHeight); // Tamaño completo de la ventana
  renderer.shadowMap.enabled = true; // Habilitar sombras
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
  renderer.physicallyCorrectLights = true; // Iluminación realista
  renderer.outputEncoding = THREE.sRGBEncoding; // Mejor representación de colores
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mapeo de tonos cinematográfico
  renderer.toneMappingExposure = 1.0; // Exposición del mapeo de tonos
  document.getElementById("container").appendChild(renderer.domElement); // Añadir al DOM

  // Inicializar el gestor de cámara
  cameraManager = new CameraManager(scene, {
    fov: 75,
    near: 0.5,
    far: 2000,
  });

  // Obtener la cámara para compatibilidad con el código existente
  camera = cameraManager.getCamera();

  // Inicializar reloj para animaciones
  clock = new THREE.Clock();

  // Cargar skybox (fondo 360°)
  (async () => {
    try {
      console.log("Cargando textura del skybox...");

      // Rutas alternativas para cargar el skybox
      const skyboxPaths = [
        "src/assets/FondoDiaEstrellado3.png", // Ruta relativa desde la raíz del proyecto
        "./src/assets/FondoDiaEstrellado3.png", // Ruta relativa al directorio actual
        "/src/assets/FondoDiaEstrellado3.png", // Ruta absoluta desde la raíz del servidor
        "assets/FondoDiaEstrellado3.png", // Ruta alternativa 1
        "./assets/FondoDiaEstrellado3.png", // Ruta alternativa 2
      ];

      // Intentar cargar el skybox desde diferentes rutas
      for (const path of skyboxPaths) {
        try {
          console.log("Intentando cargar skybox desde:", path);
          skybox = new Skybox(scene, path);
          console.log("Skybox cargado exitosamente desde:", path);
          break; // Salir del bucle si la carga es exitosa
        } catch (err) {
          console.warn(`No se pudo cargar el skybox desde ${path}:`, err);
          // Continuar con la siguiente ruta en caso de error
        }
      }

      // Si no se pudo cargar ningún skybox
      if (!skybox) {
        console.warn("No se pudo cargar ninguna textura de skybox válida");
        throw new Error("No se pudo cargar ninguna textura de skybox");
      }

      // Configuración adicional del renderizado
      renderer.setClearColor(0x000000, 1); // Color de fondo negro
      renderer.outputEncoding = THREE.sRGBEncoding; // Codificación de color sRGB

      console.log("Skybox inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar el skybox:", error);
      // Configurar un color de fondo celeste como respaldo
      scene.background = new THREE.Color(0x87ceeb);
    }
  })();

  // Inicializar el sistema de iluminación
  lighting = new Lighting(scene);
  console.log("Sistema de iluminación inicializado");

  // Crear y configurar el terreno
  terrain = new Terrain(scene, renderer);
  console.log("Terreno inicializado");

  // Inicializar el cargador de modelos 3D
  modelLoader = new ModelLoader(scene);
  console.log("Cargador de modelos inicializado");

  // Crear el corral para vacas
  corral = new Corral(
    scene,
    { x: 15, y: 0, z: 15 },
    { width: 20, height: 2, depth: 20 }
  );
  console.log("Corral creado");

  // Crear el Space Shuttle Orbiter
  spaceShuttle = new SpaceShuttle(
    scene,
    { x: 50, y: 0, z: -30 }, // Posición: a un lado, sobre la superficie del terreno
    0.1 // Escala mucho más reducida para que no sea tan grande
  );
  console.log("Space Shuttle Orbiter creado");

  // Crear 4 vacas dentro del corral
  createCows();

  // Crear 30 piedras aleatorias en el terreno
  createStones();

  // Crear la casa con puerta interactiva
  createHouse();
  // Crear el alien2
  const alien2 = await createAlien2();
  window.alien2 = alien2;
  console.log("Alien2 creado exitosamente");

  // Iniciar la secuencia de movimiento automático (5 minutos de delay)
  alien2.startMovementSequence();
  console.log(
    "Sistema de movimiento del Alien2 programado para iniciar en 5 minutos"
  );

  // Crear el mercado con ventana frontal
  const market = createMarket();

  // Actualizar minimap inmediatamente con la referencia del mercado
  try {
    minimapManager.setReferences({ market });
  } catch (e) {}

  // Hacer el mercado accesible desde la consola para depuración
  window.market = market;
  console.log("Mercado disponible como 'window.market' para depuración");

  // Crear interacción de reparación de la nave (círculo y HUD)
  createShipRepair();
  // Hook: mostrar escena final cuando la reparación esté completa
  if (shipRepair) {
    try {
      shipRepair.onRepairComplete = (info) => {
        try {
          showFinalScene({ shipRepair, cameraManager });
        } catch (e) {
          console.error("Error mostrando escena final", e);
        }
      };
    } catch (e) {
      console.warn("No se pudo asignar onRepairComplete:", e);
    }
  }

  // Configurar los controles de la cámara
  cameraManager.setupControls(renderer.domElement);
  controls = cameraManager.getControls();
  console.log("Controles de cámara configurados");

  // Configuración de sombras
  if (renderer.shadowMap) {
    renderer.shadowMap.autoUpdate = true; // Actualización automática de sombras
    renderer.shadowMap.needsUpdate = true; // Forzar actualización inicial
    console.log("Sistema de sombras configurado");
  }

  // Obtener la configuración del personaje granjero2
  const farmerConfig = modelConfig.characters.farmer2;
  console.log("Configuración del personaje Granjero2 cargada:", farmerConfig);

  // Preparar las rutas de las animaciones
  // Creamos un objeto que mapea nombres de animación a sus rutas completas
  const animationPaths = {};
  for (const [animName, animPath] of Object.entries(farmerConfig.animations)) {
    // Usar el método getPath para obtener la ruta completa del archivo
    animationPaths[animName] = modelConfig.getPath(animPath);
    console.log(
      `Animación '${animName}' configurada en:`,
      animationPaths[animName]
    );
  }

  // Cargar el modelo 3D con sus animaciones
  try {
    console.log("Iniciando carga del modelo 3D...");

    // Cargar el modelo principal con sus animaciones
    await modelLoader.load(
      modelConfig.getPath(farmerConfig.model), // Ruta al archivo del modelo
      animationPaths, // Diccionario de animaciones
      (instance) => {
        console.log("✅ Modelo 3D y animaciones cargados exitosamente");

        // Configurar la cámara isométrica para seguir al modelo
        if (instance.model) {
          // Configurar el objetivo de la cámara para seguir al modelo en modo isométrico
          cameraManager.setTarget(instance.model);
          console.log("Cámara isométrica configurada para seguir al personaje");

          // Obtener la cámara actualizada
          camera = cameraManager.getCamera();
          console.log("Posición de cámara ajustada:", camera.position);

          // Inicializar el controlador del granjero
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

          // Crear inventario del personaje (precio por litro configurable)
          try {
            const inventory = new Inventory({ pricePerLiter: 5 });
            // Exponer para depuración y uso desde otros módulos
            window.inventory = inventory;
            // Si FarmerController soporta setInventory, conéctalo
            if (typeof farmerController.setInventory === "function") {
              farmerController.setInventory(inventory);
            }
            console.log(
              "Inventory inicializado y disponible en window.inventory"
            );
          } catch (e) {
            console.warn("No se pudo inicializar Inventory:", e);
          }

          // Conectar el corral con el controlador del granjero
          if (corral) {
            farmerController.setCorral(corral);
            console.log("Corral conectado al controlador del granjero");
          }

          // Conectar el Space Shuttle con el controlador del granjero
          if (spaceShuttle) {
            farmerController.setSpaceShuttle(spaceShuttle);
            console.log("Space Shuttle conectado al controlador del granjero");
          }

          console.log("Controlador del granjero inicializado");

          // Hacer el modelo accesible desde la consola para depuración
          window.farmer = instance;
          window.farmerController = farmerController; // Para depuración
          window.corral = corral; // Para depuración del corral
          console.log("Modelo disponible como 'window.farmer' para depuración");
          console.log("Corral disponible como 'window.corral' para depuración");

          // Conectar el farmerController con las piedras para detección de colisiones
          if (farmerController && stones && stones.length > 0) {
            farmerController.setStones(stones);
            console.log(
              "✅ FarmerController conectado con las piedras para detección de colisiones"
            );
          } else {
            console.warn(
              "⚠️ No se pudo conectar el farmerController con las piedras"
            );
            console.warn("farmerController:", farmerController);
            console.warn("stones:", stones);
          }

          // Conectar el farmerController con la casa para detección de colisiones
          if (farmerController && house) {
            farmerController.setHouse(house);
            console.log(
              "✅ FarmerController conectado con la casa para detección de colisiones"
            );
          } else {
            console.warn(
              "⚠️ No se pudo conectar el farmerController con la casa"
            );
            console.warn("farmerController:", farmerController);
            console.warn("house:", house);
          }

          // Conectar el farmerController con las vacas para detección de colisiones
          if (farmerController && cows && cows.length > 0) {
            farmerController.setCows(cows);
            console.log(
              "✅ FarmerController conectado con las vacas para detección de colisiones"
            );
          } else {
            console.warn(
              "⚠️ No se pudo conectar el farmerController con las vacas"
            );
            console.warn("farmerController:", farmerController);
            console.warn("cows:", cows);
          }

          // Conectar el farmerController con el mercado para detección de colisiones
          if (farmerController && market) {
            farmerController.setMarket(market);
            console.log(
              "✅ FarmerController conectado con el mercado para detección de colisiones"
            );
          } else {
            console.warn(
              "⚠️ No se pudo conectar el farmerController con el mercado"
            );
            console.warn("farmerController:", farmerController);
            console.warn("market:", market);
          }

          // Mostrar las animaciones disponibles en consola
          const availableAnims = Object.keys(instance.actions);
          console.log("🎬 Animaciones disponibles:", availableAnims);

          if (availableAnims.length === 0) {
            console.warn("⚠️ No se encontraron animaciones para este modelo");
          }
        }
      },
      farmerConfig // Pasar la configuración completa del modelo
    );
  } catch (error) {
    console.error("Error al cargar el modelo o animaciones:", error);
  }

  // Configurar eventos
  setupEventListeners();

  // Conectar cambio de selección del inventario (sin equipar herramientas)
  if (window.inventory && farmerController) {
    window.inventory.onEquipChange = (slotIndex, toolName) => {
      try {
        // Mostrar mensaje de herramienta seleccionada
        if (toolName) {
          console.log(`Herramienta seleccionada: ${toolName} (slot ${slotIndex + 1})`);
          // Aquí puedes agregar lógica adicional cuando se selecciona una herramienta
          // sin necesidad de equiparla visualmente en el personaje
        } else {
          console.log('Ninguna herramienta seleccionada');
        }
      } catch (e) {
        console.warn("Error manejando selección de inventario", e);
      }
    };
  }

  // Inicializar el minimap
  initMinimap();

  // Iniciar bucle de animación
  animate();
}

/**
 * Configura los listeners de eventos de la ventana
 */
function setupEventListeners() {
  // Escuchar cambios en el tamaño de la ventana
  window.addEventListener("resize", onWindowResize);
  console.log("Listener de redimensionamiento configurado");

  // Tecla 'i' para mostrar/ocultar el inventario
  window.addEventListener("keydown", (ev) => {
    // Ignorar si el usuario está escribiendo en un input/textarea
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

// Referencia global para debug: invoca la función modular importada con las dependencias actuales
window.showFinalScene = () => showFinalScene({ shipRepair, cameraManager });

/**
 * Maneja el redimensionamiento de la ventana
 * Ajusta la cámara y el renderizador al nuevo tamaño de la ventana
 */
function onWindowResize() {
  // Actualizar la cámara a través del gestor
  if (cameraManager) {
    cameraManager.onWindowResize();
  }

  // Ajustar el tamaño del renderizador
  renderer.setSize(window.innerWidth, window.innerHeight);

  console.log(
    `Ventana redimensionada: ${window.innerWidth}x${window.innerHeight}`
  );
}

/**
 * @deprecated Usar FarmerController en su lugar
 * Esta función ya no es necesaria ya que el control del personaje
 * ahora se maneja en la clase FarmerController
 */
// updateAnimationState and handleMovement removed: use FarmerController instead

// Variables para el control de FPS
let lastTime = 0;
const targetFPS = 60;
const frameTime = 1000 / targetFPS;

// Variables para optimización de actualizaciones
let minimapUpdateCounter = 0;
const minimapUpdateInterval = 10; // Actualizar minimap cada 10 frames
let terrainUpdateCounter = 0;
const terrainUpdateInterval = 5; // Actualizar terreno cada 5 frames
let skyboxUpdateCounter = 0;
const skyboxUpdateInterval = 3; // Actualizar skybox cada 3 frames

function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  // Control de FPS mejorado
  const deltaTime = currentTime - lastTime;
  if (deltaTime < frameTime) return;
  lastTime = currentTime - (deltaTime % frameTime);

  const delta = Math.min(0.05, clock.getDelta()); // Reducir el delta máximo para mayor suavidad

  try {
    // 1. Actualización de cámara (prioridad alta)
    if (cameraManager) {
      cameraManager.update(delta);
    }

    // 2. Actualización del jugador (prioridad alta)
    if (farmerController) {
      farmerController.update(delta);
    }

    // 3. Actualización de animaciones principales (prioridad media)
    if (modelLoader) {
      modelLoader.update(delta);
    }
    if (window.alien2 && window.alien2.update) {
      window.alien2.update(delta);
    }

    // 4. Actualización de objetos del juego (prioridad media-baja)
    // Usar requestIdleCallback para tareas menos críticas
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => {
        // Actualizar el corral
        if (corral && farmerController?.model) {
          corral.update(delta, farmerController.model.position);
        }

        // Actualizar la casa
        if (house && farmerController?.model) {
          house.update(delta, farmerController.model.position);
        }

        // Actualizar el Space Shuttle
        if (spaceShuttle) {
          spaceShuttle.update(delta);
        }
      });
    }

    // 5. Actualización de múltiples instancias (optimizado)
    // Usar for en lugar de forEach para mejor rendimiento
    for (let i = 0; i < cows.length; i++) {
      cows[i].update(delta);
    }

    for (let i = 0; i < stones.length; i++) {
      stones[i].update(delta);
    }

    // Actualizar el mercado con la posición del jugador
    if (window.market && farmerController?.model) {
      window.market.update(farmerController.model.position);
    }
    
    // Actualizar el sistema de reparación de la nave
    if (shipRepair && farmerController?.model) {
      shipRepair.update(farmerController.model.position);
    }
    // 6. Actualizaciones menos frecuentes (optimizadas)
    if (terrainUpdateCounter++ >= terrainUpdateInterval) {
      terrain?.update(camera.position);
      terrainUpdateCounter = 0;
    }

    if (skyboxUpdateCounter++ >= skyboxUpdateInterval && skybox) {
      skybox.update(camera.position);
      skyboxUpdateCounter = 0;
    }

    // 7. Efectos visuales (baja prioridad)
    if (terrain?.animateFires) {
      terrain.animateFires();
    }

    // 8. Iluminación
    lighting?.update(delta);

    // 8.1 Actualizar efecto de humo
    if (smokeEffect) {
      smokeEffect.update(delta);
    }

    // 9. Minimap (actualizar con menos frecuencia)
    if (minimapUpdateCounter++ >= minimapUpdateInterval * 2) {
      // Reducir frecuencia
      updateMinimap();
      minimapUpdateCounter = 0;
    }

    // 10. Renderizado final
    renderer.render(scene, camera);
  } catch (error) {
    console.error("Error en el bucle de animación:", error);
  }
}

// ==============================================
// HERRAMIENTAS DE DEPURACIÓN
// ==============================================

// Función global para forzar la apertura del HUD del mercado
window.forceOpenMarketHUD = function () {
  if (window.market) {
    console.log("Forzando apertura del HUD del mercado desde consola");
    window.market.showMarketUI();
    return "HUD del mercado abierto forzosamente";
  } else {
    console.error("No se encontró la instancia del mercado");
    return "Error: No se encontró la instancia del mercado";
  }
};

// Función global para mostrar la posición actual del jugador
window.showPlayerPosition = function () {
  if (farmerController && farmerController.model) {
    const pos = farmerController.model.position;
    console.log(
      `Posición del jugador: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(
        2
      )}, z=${pos.z.toFixed(2)}`
    );
    return `Posición: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(
      2
    )}, z=${pos.z.toFixed(2)}`;
  } else {
    return "Error: No se encontró el modelo del jugador";
  }
};

/**
 * Hacer disponibles las variables globales para depuración en la consola del navegador
 * Permite acceder a estas variables directamente desde la consola para pruebas
 */
window.THREE = THREE; /* Biblioteca Three.js completa*/
window.scene = scene; /*Escena 3D*/
window.camera = camera; /* Cámara activa*/
window.renderer = renderer; /* Renderizador WebG*/
