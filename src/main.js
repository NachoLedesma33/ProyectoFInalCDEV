// Importaciones de Three.js y módulos personalizados
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js";

// Módulos personalizados
import { Terrain } from "./utils/Terrain.js"; // Manejo del terreno
import { Lighting } from "./utils/lighting.js"; // Sistema de iluminación
import { ControlsManager } from "./utils/controls.js"; // Controles de cámara
import { ModelLoader } from "./utils/modelLoader.js"; // Carga de modelos 3D
import { Skybox } from "./utils/Skybox.js"; // Fondo 360°
import modelConfig from "./config/modelConfig.js"; // Configuración de modelos
import { CameraManager } from "./utils/CameraManager.js"; // Gestor de cámara
import { FarmerController } from "./utils/FarmerController.js"; // Controlador del granjero
import { Corral } from "./utils/Corral.js"; // Corral con sistema de colisiones
import { SpaceShuttle } from "./utils/SpaceShuttle.js"; // Space Shuttle Orbiter

// Variables globales principales de Three.js
let scene, // Escena 3D que contiene todos los objetos
  renderer, // Motor de renderizado WebGL
  cameraManager, // Gestor de cámara
  camera, // Cámara que define la vista del usuario (accesible a través de cameraManager)
  controls; // Controles de la cámara (accesibles a través de cameraManager)

// Componentes personalizados
let terrain, // Gestor del terreno
  lighting, // Sistema de iluminación
  clock, // Reloj para animaciones
  skybox; // Fondo 360°

// Cargador de modelos
let modelLoader; // Maneja la carga y animación de modelos 3D

// Instancia del controlador del granjero
let farmerController;

// Instancia del corral
let corral;

// Instancia del Space Shuttle Orbiter
let spaceShuttle;

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

// Iniciar la aplicación y manejar errores
init().catch(console.error);

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

  // Obtener la configuración del personaje granjero
  const farmerConfig = modelConfig.characters.farmer;
  console.log("Configuración del personaje cargada:", farmerConfig);

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

          // Mostrar las animaciones disponibles en consola
          const availableAnims = Object.keys(instance.actions);
          console.log("🎬 Animaciones disponibles:", availableAnims);

          if (availableAnims.length === 0) {
            console.warn("⚠️ No se encontraron animaciones para este modelo");
          }
        }
      }
    );
  } catch (error) {
    console.error("Error al cargar el modelo o animaciones:", error);
  }

  // Configurar eventos
  setupEventListeners();

  // Iniciar bucle de animación
  animate();
}

/**
 * Configura los controles de órbita de la cámara
 * Permite rotar, hacer zoom y desplazarse alrededor de la escena
 * @deprecated Esta función ya no es necesaria, usar CameraManager en su lugar
 */
function setupOrbitControls() {
  console.warn(
    "setupOrbitControls() está obsoleto. Usa CameraManager en su lugar."
  );

  if (cameraManager) {
    const controls = cameraManager.getControls();
    if (controls) {
      controls.minDistance = 1; // Distancia mínima de acercamiento
      controls.maxDistance = 50; // Distancia máxima de alejamiento
      controls.maxPolarAngle = Math.PI / 2; // Ángulo máximo de inclinación (90°)
      controls.minPolarAngle = 0.1; // Ángulo mínimo de inclinación (casi 0°)

      console.log("Controles de órbita configurados a través de CameraManager");
    }
  }
}

/**
 * Configura los listeners de eventos de la ventana
 */
function setupEventListeners() {
  // Escuchar cambios en el tamaño de la ventana
  window.addEventListener("resize", onWindowResize);
  console.log("Listener de redimensionamiento configurado");
}

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
function updateAnimationState() {
  console.warn(
    "updateAnimationState() está obsoleto. Usa FarmerController en su lugar."
  );
}

/**
 * @deprecated Usar FarmerController en su lugar
 * Esta función ya no es necesaria ya que el control del personaje
 * ahora se maneja en la clase FarmerController
 */
function handleMovement(delta) {
  console.warn(
    "handleMovement() está obsoleto. Usa FarmerController en su lugar."
  );
}

// Variables para el control de FPS
let lastTime = 0;
const targetFPS = 60;
const frameTime = 1000 / targetFPS;

function animate(currentTime = 0) {
  // La cámara isométrica ahora es manejada automáticamente por el CameraManager
  // No se necesita lógica adicional de seguimiento aquí

  requestAnimationFrame(animate);

  // Control de FPS
  const deltaTime = currentTime - lastTime;
  if (deltaTime < frameTime) return;
  lastTime = currentTime - (deltaTime % frameTime);

  const delta = Math.min(0.1, clock.getDelta()); // Limitar el delta para evitar saltos grandes

  try {
    // Actualizar cámara y controles
    if (cameraManager) {
      cameraManager.update(delta);
    }

    // Actualizar animaciones del modelo
    if (modelLoader) {
      modelLoader.update(delta);
    }

    // Actualizar el controlador del granjero
    if (farmerController) {
      farmerController.update(delta);
    }

    // Actualizar el corral (para animaciones de puerta, etc.)
    if (corral && farmerController && farmerController.model) {
      corral.update(delta, farmerController.model.position);
    }

    // Actualizar el Space Shuttle Orbiter
    if (spaceShuttle) {
      spaceShuttle.update(delta);
    }

    // Actualizar el terreno
    terrain.update(camera.position);

    // Actualizar el skybox para que siga a la cámara
    if (skybox) {
      skybox.update(camera.position);
    }

    // Actualizar los efectos de fuego
    if (terrain && terrain.animateFires) {
      terrain.animateFires();
    }

    // Actualizar la iluminación
    if (lighting) {
      lighting.update(delta);
    }

    // Renderizar la escena
    renderer.render(scene, camera);
  } catch (error) {
    console.error("Error en el bucle de animación:", error);
  }
}

// ==============================================
// HERRAMIENTAS DE DEPURACIÓN
// ==============================================

/**
 * Hacer disponibles las variables globales para depuración en la consola del navegador
 * Permite acceder a estas variables directamente desde la consola para pruebas
 */
window.THREE = THREE; /* Biblioteca Three.js completa*/
window.scene = scene; /*Escena 3D*/
window.camera = camera; /* Cámara activa*/
window.renderer = renderer; /* Renderizador WebG*/
