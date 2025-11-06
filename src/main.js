import './utils/consoleFilter.js';

// Importaciones de Three.js y módulos personalizados
import PauseMenu from './utils/pauseMenu.js';
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

// Módulos personalizados
import { Terrain } from "./utils/Terrain.js"; // Manejo del terreno
import { Lighting } from "./utils/lighting.js"; // Sistema de iluminación
// ControlsManager se usa internamente en CameraManager; no es necesario importarlo aquí
import { ModelLoader } from "./utils/modelLoader.js"; // Carga de modelos 3D
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/SkeletonUtils.js";
import { Skybox } from "./utils/Skybox.js"; // Fondo 360°
import modelConfig from "./config/modelConfig.js"; // Configuración de modelos
import { CameraManager } from "./utils/CameraManager.js"; // Gestor de cámara
import { FarmerController } from "./utils/FarmerController.js"; // Controlador del granjero
import { Corral } from "./utils/Corral.js"; // Corral con sistema de colisiones
import { SpaceShuttle } from "./utils/SpaceShuttle.js"; // Space Shuttle Orbiter
import { Cow } from "./utils/Cow.js"; // Modelo de vaca
import { Stone } from "./utils/Stone.js"; // Modelo de piedra
import { Crystal } from "./utils/Crystal.js"; // Modelo de cristal
import { House } from "./utils/House.js"; // Casa con puerta interactiva
import { Market } from "./utils/Market.js"; // Mercado con ventana frontal
import BuildingManager from './utils/building.js';
import { Inventory } from "./utils/Inventory.js"; // Inventario del personaje
import { initObjectives } from "./utils/objectives.js"; // Sistema de objetivos
import { Alien2 } from "./utils/Alien2.js"; // Alien2
import { ShipRepair } from "./utils/ShipRepair.js";
import { SmokeEffect } from "./utils/smokeEffect.js"; // Efecto de humo
import { showFinalScene } from "./utils/finalScene.js";
import { makeMinimap } from "./utils/minimap.js";
import { createStoryManager, storySlides } from "./utils/startMenu.js";
import createSoundHUD from "./utils/soundHUD.js";
import CombatSystem, { integrateEntityWithCombat } from "./utils/CombatSystem.js";
import HealthBar from "./utils/Healthbar.js";
import showDeathScreen from "./utils/DeathScreen.js";
import WaveManager from "./utils/waves.js";
import { AudioManager } from "./utils/AudioManager.js";
import { safePlaySfx } from './utils/audioHelpers.js';
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import LightPost from "./utils/LightPost.js";

// Inicialización del menú principal
document.addEventListener("DOMContentLoaded", () => {
  // Configurar los botones del menú principal
  const playButton = document.getElementById("play-button");
  const tutorialButton = document.getElementById("tutorial-button");
  const controlsButton = document.getElementById("controls-button");
  let soundButton = document.getElementById("sound-button");

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

// (moved to global scope below)

// Clonar el Alien2 del mercado y colocarlo en posiciones fijas (solo visual)
function createAlien2Clones() {
  try {
    try { if (!window.alien2Clones) window.alien2Clones = []; } catch (_) {}
    // Remove any existing clones from the scene to avoid stacking
    try {
      if (Array.isArray(window.alien2Clones)) {
        for (let i = 0; i < window.alien2Clones.length; i++) {
          const c = window.alien2Clones[i];
          try { if (c && c.parent) c.parent.remove(c); } catch (_) {}
        }
        window.alien2Clones.length = 0;
      }
    } catch (_) {}
    // Also remove any previous static Alien2 instances (first ones) so only the last ones remain
    try {
      if (Array.isArray(window.alien2Statics)) {
        for (let i = 0; i < window.alien2Statics.length; i++) {
          const a = window.alien2Statics[i];
          try { if (a && a.model && a.model.parent) a.model.parent.remove(a.model); } catch (_) {}
        }
        window.alien2Statics.length = 0;
      }
    } catch (_) {}
    // reset mixers each time we recreate clones
    try { alien2CloneMixers.length = 0; } catch (_) {}
    if (!window.alien2 || !window.alien2.model) return;
    const base = window.alien2.model;
    const idlePath = modelConfig.getPath(modelConfig.characters.alien2.animations.idle);
    const entries = [
      { pos: { x: -81.2, y: 0.0, z: -65.9 }, look: { x: -79.9, y: 0.0, z: -64.4 } },
      { pos: { x: -81.6, y: 0.0, z: -62.4 }, look: { x: -79.9, y: 0.0, z: -64.4 } },
      { pos: { x: -153.2, y: 0.0, z: -119.9 }, look: { x: -149.1, y: 0.0, z: -118.6 } },
      { pos: { x: -83.3, y: 0.0, z: 37.2 }, look: { x: -79.3, y: 0.0, z: 38.9 } },
      { pos: { x: -81.1, y: 0.0, z: 36.6 }, look: { x: -79.3, y: 0.0, z: 38.9 } },
    ];
    const clones = [];
    for (const e of entries) {
      try {
        const clone = SkeletonUtils.clone(base);
        clone.position.set(e.pos.x, (e.pos.y || 0) + 0.2, e.pos.z);
        clone.visible = true;
        clone.traverse(o => { try { o.frustumCulled = true; o.visible = true; } catch(_){} });
        const lookTarget = new THREE.Vector3(e.look.x, clone.position.y, e.look.z);
        try { clone.lookAt(lookTarget); } catch (_) {}
        scene.add(clone);

        // Create an AnimationMixer for the clone and load Idle animation
        try {
          const mixer = new THREE.AnimationMixer(clone);
          alien2CloneMixers.push(mixer);
          const loader = new FBXLoader();
          loader.load(
            idlePath,
            (fbx) => {
              try {
                if (fbx && fbx.animations && fbx.animations.length > 0) {
                  const clip = fbx.animations[0];
                  const action = mixer.clipAction(clip);
                  action.loop = THREE.LoopRepeat;
                  action.clampWhenFinished = false;
                  action.play();
                }
              } catch (_) {}
            },
            undefined,
            () => {}
          );
        } catch (_) {}
        clones.push(clone);
      } catch (_) {}
    }
    try { window.alien2Clones = clones; } catch (_) {}
    try { window.createAlien2Clones = createAlien2Clones; } catch (_) {}
    try { return false } catch(_){ }
  } catch (_) {}
}
try { window.createAlien2Clones = createAlien2Clones; } catch (_) {}

 

/**
 * Crear Alien2 estáticos (idle) en posiciones fijas mirando a un objetivo
 */
async function createAlien2Statics() {
  const entries = [
    { pos: { x: -81.2, y: 0.0, z: -65.9 }, look: { x: -79.9, y: 0.0, z: -64.4 } },
    { pos: { x: -81.6, y: 0.0, z: -62.4 }, look: { x: -79.9, y: 0.0, z: -64.4 } },
    { pos: { x: -153.2, y: 0.0, z: -119.9 }, look: { x: -149.1, y: 0.0, z: -118.6 } },
    { pos: { x: -83.3, y: 0.0, z: 37.2 }, look: { x: -79.3, y: 0.0, z: 38.9 } },
    { pos: { x: -81.1, y: 0.0, z: 36.6 }, look: { x: -79.3, y: 0.0, z: 38.9 } },
  ];

  for (const e of entries) {
    try {
      const a = new Alien2(scene, modelLoader, e.pos, e.look);
      await a.load();
      // Asegurar idle y sin movimiento
      try { a.forceIdleAnimation && a.forceIdleAnimation(); } catch (_) {}
      try { a.movementSystem && (a.movementSystem.isActive = false); } catch (_) {}
      // Nudge Y up slightly and ensure orientation after load
      try {
        if (a.model) {
          a.model.position.set(e.pos.x, (e.pos.y || 0) + 0.2, e.pos.z);
          a.model.visible = true;
          a.model.traverse(o => { try { o.frustumCulled = true; o.visible = true; } catch(_){} });
          const lookTarget = new THREE.Vector3(e.look.x, a.model.position.y, e.look.z);
          const doOrient = () => { try { a.model && a.model.lookAt(lookTarget); } catch (_) {} };
          doOrient();
          setTimeout(doOrient, 200);
          setTimeout(doOrient, 800);
        }
      } catch (_) {}
      try { return false } catch (_) {}
      alien2Statics.push(a);
    } catch (err) { /* non-fatal */ }
  }

  try { window.alien2Statics = alien2Statics; } catch (_) {}
  try { return false } catch(_){}
}
try { window.createAlien2Statics = createAlien2Statics; } catch (_) {}

 

 

 
    return window.__gameInitPromise;
  });

  // Conectar el play button al manager
  storyManager.attachToPlayButton(playButton);

  // Ensure there's a visible sound button under the Play button. If the
  // element is missing in the HTML, create it dynamically so the HUD can
  // be toggled and the UI SFX play.
  try {
    if (!soundButton && playButton && playButton.parentNode) {
      soundButton = document.createElement('button');
      soundButton.id = 'sound-button';
      soundButton.className = 'menu-button';
      soundButton.type = 'button';
      soundButton.innerText = 'Sonido';
      playButton.parentNode.insertBefore(soundButton, playButton.nextSibling);
    } else if (playButton && soundButton && playButton.parentNode) {
      // If the button exists in the DOM, ensure it's right after the Play button
      try { playButton.parentNode.insertBefore(soundButton, playButton.nextSibling); } catch(_) {}
    }
  } catch (e) {
    return e;
  }

  // Inicializar AudioManager lo antes posible (sin cámara) para que la música del menú pueda reproducirse
  try {
    if (!window.audio) {
      const earlyAudio = new AudioManager(null);
      window.audio = earlyAudio;
      // Intentar reproducir la música del menú. Si el autoplay es bloqueado,
      // reproduciremos tras el primer gesto del usuario.
      earlyAudio.playMusic("main", { loop: true }).catch(() => {
        const startMenuMusic = () => {
          try {
            window.audio && window.audio.playMusic("main", { loop: true });
          } catch (_) {}
          window.removeEventListener("pointerdown", startMenuMusic, true);
          window.removeEventListener("keydown", startMenuMusic, true);
        };
        window.addEventListener("pointerdown", startMenuMusic, true);
        window.addEventListener("keydown", startMenuMusic, true);
      });
    }
  } catch (e) {
    return e;
  }

  // Por ahora, los otros botones no tienen funcionalidad. Guardamos las
  // comprobaciones por si no existen en el markup (evita que el script se
  // detenga con un TypeError y deje sin listeners al botón de sonido).
  if (tutorialButton && typeof tutorialButton.addEventListener === 'function') {
    tutorialButton.addEventListener("click", () => {
      try { safePlaySfx('uiClick', { volume: 0.9 }); } catch(_){}
    });
  }

  if (controlsButton && typeof controlsButton.addEventListener === 'function') {
    controlsButton.addEventListener("click", () => {
      try { safePlaySfx('uiClick', { volume: 0.9 }); } catch(_){};
    });
  }

  // Mostrar/ocultar HUD de sonido al pulsar el botón
  const soundHud = (typeof createSoundHUD === 'function') ? createSoundHUD({ container: document.body }) : null;
  try { if (soundHud) soundHud.style.display = 'none'; } catch(_) {}

  // Crear el menú de pausa (overlay) y mantenerlo oculto por defecto
    let pauseMenu = null;
    try {
      if (typeof PauseMenu === 'function') {
        pauseMenu = new PauseMenu({ container: document.body });
        // hide immediately in case constructor left it visible
        try { if (pauseMenu && typeof pauseMenu.hide === 'function') pauseMenu.hide(); } catch (_) {}
      }
    } catch (e) { return e; }
    // expose for debugging from console
    try { window.pauseMenu = pauseMenu; } catch (_) {}
  try { if (pauseMenu && typeof pauseMenu.hide === 'function') pauseMenu.hide(); } catch(_) {}

  if (soundButton) {
    // Play hover SFX when the user moves the pointer over the button
      try {
        soundButton.addEventListener("pointerenter", () => { try { safePlaySfx('uiHover', { volume: 0.6 }); } catch(_){} });
        // fallback for older browsers
        soundButton.addEventListener("mouseenter", () => { try { safePlaySfx('uiHover', { volume: 0.6 }); } catch(_){} });
      } catch (e) {
        // non-fatal
      }

    soundButton.addEventListener("click", () => {
    try { safePlaySfx('uiClick', { volume: 0.9 }); } catch(_) {}

    try {
      // Only allow the sound HUD to be opened while the main menu is visible.
      const mainMenu = document.getElementById('main-menu');
      const menuVisible = mainMenu && window.getComputedStyle(mainMenu).display !== 'none';
      if (!menuVisible) {
        // do not open HUD outside of the start screen
        return;
      }

      if (!soundHud) return;
      const visible = soundHud.style.display !== 'none' && soundHud.style.display !== '';
      soundHud.style.display = visible ? 'none' : 'block';
    } catch (e) {
      return e;
    }
    });
  } else {
    return 'sound-button not found and could not be created; sound HUD will not be toggleable via button';
  }

  // Toggle pause menu with Escape while gameplay is active
  try {
    window.addEventListener('keydown', (ev) => {
      if (!ev || !ev.key) return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        // Toggle pause when the game container is visible (allow flows that didn't set __gameplayStarted)
        try {
          const tag = (document.activeElement && document.activeElement.tagName) || '';
          if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't toggle while typing
          const gameCont = document.getElementById('game-container');
          if (!gameCont) return;
          const visible = window.getComputedStyle ? getComputedStyle(gameCont).display !== 'none' : (gameCont.style.display !== 'none');
          if (!visible) return;

          // debug log to help trace if handler runs (no early return)
          try { console.debug && console.debug('[pause] Escape pressed, toggling pause'); } catch (_) {}

          // Prefer using the created pauseMenu object's API if present
          try {
            if (pauseMenu && typeof pauseMenu.show === 'function' && typeof pauseMenu.hide === 'function' && typeof pauseMenu.isShown === 'function') {
              // use PauseMenu instance API
              const isShown = pauseMenu.isShown();
              if (isShown) pauseMenu.hide(); else pauseMenu.show();
              return;
            }
          } catch (err) {return err;}

          const overlay = document.getElementById('pause-overlay');
          if (!overlay) return;
          const overlayVisible = window.getComputedStyle ? getComputedStyle(overlay).display !== 'none' && getComputedStyle(overlay).opacity !== '0' : (overlay.style.display === 'block');
          if (overlayVisible) {
            overlay.style.display = 'none';
            window.__gamePaused = false;
          } else {
            overlay.style.display = 'block';
            window.__gamePaused = true;
          }
        } catch (e) {
          return e;
        }
      }
    });
  } catch (e) { return e; }

  // Iniciar música cuando arranca el gameplay (tras controles)
  try {
    window.addEventListener('gameplaystart', () => {
      try { if (window.audio && typeof window.audio.stopMusic === 'function') window.audio.stopMusic(); } catch (_) {}
      // start background ambience when gameplay begins
      try {
        if (window.audio && typeof window.audio.playAmbience === 'function') {
          window.audio.playAmbience('noise', { loop: true, volume: 0.6 });
        }
        // Start occasional ambient music cues (randomly play ambient1 or ambient2 every so often)
        if (window.audio && typeof window.audio.startRandomAmbient === 'function') {
          // casual: between 30s and 180s, ~60% chance each window, moderate volume
          window.audio.startRandomAmbient({ minDelay: 30, maxDelay: 180, playProbability: 0.6, volume: 0.7 });
        }
      } catch (_) {}
    });
  } catch (_) {}

  try {
    const invToggle = document.getElementById('inventory-toggle');
    const mapToggle = document.getElementById('minimap-toggle');
    const objToggle = document.getElementById('objectives-toggle');

    const invHud = document.getElementById('inventory-hud');
    const mapHud = document.getElementById('minimap-hud');
    const objHud = document.getElementById('objectives-hud');

    const invClose = document.getElementById('inventory-close');
    const mapClose = document.getElementById('minimap-close');
    const objClose = document.getElementById('objectives-close');

    if (invToggle && mapToggle && objToggle && invHud && mapHud && objHud) {
      const hideOtherToggles = () => {};
      const showAllToggles = () => {};
      const closeAllHuds = () => {
        invHud.classList.remove('inventory-expanded');
        invHud.classList.add('inventory-collapsed');
        mapHud.classList.remove('minimap-expanded');
        mapHud.classList.add('minimap-collapsed');
        objHud.classList.remove('objectives-expanded');
        objHud.classList.add('objectives-collapsed');
      };

      const toggleHud = (hud, expandedClass, collapsedClass, srcBtn) => {
        const isExpanded = hud.classList.contains(expandedClass);
        if (isExpanded) {
          hud.classList.remove(expandedClass);
          hud.classList.add(collapsedClass);
          if (hud === invHud && invClose) invClose.style.display = 'none';
        } else {
          closeAllHuds();
          hud.classList.remove(collapsedClass);
          hud.classList.add(expandedClass);
          hideOtherToggles();
          if (hud === invHud && invClose) invClose.style.display = 'flex';
        }
      };

      invToggle.addEventListener('click', () => {
        toggleHud(invHud, 'inventory-expanded', 'inventory-collapsed', invToggle);
      });
      mapToggle.addEventListener('click', () => {
        toggleHud(mapHud, 'minimap-expanded', 'minimap-collapsed', mapToggle);
        try { if (mapHud.classList.contains('minimap-expanded')) initMinimap(); } catch(_){ }
      });
      objToggle.addEventListener('click', () => {
        toggleHud(objHud, 'objectives-expanded', 'objectives-collapsed', objToggle);
      });

      if (invClose) invClose.addEventListener('click', () => { invHud.classList.remove('inventory-expanded'); invHud.classList.add('inventory-collapsed'); invClose.style.display = 'none'; });
      if (mapClose) mapClose.addEventListener('click', () => { mapHud.classList.remove('minimap-expanded'); mapHud.classList.add('minimap-collapsed'); });
      if (objClose) objClose.addEventListener('click', () => { objHud.classList.remove('objectives-expanded'); objHud.classList.add('objectives-collapsed'); });
    }
  } catch (e) { /* non-fatal */ }
});

// Variables globales principales de Three.js
let scene; // Escena 3D que contiene todos los objetos
let renderer; // Motor de renderizado WebGL
let cameraManager; // Gestor de cámara
let camera; // Cámara que define la vista del usuario (accesible a través de cameraManager)
let controls; // Controles de la cámara (accesibles a través de cameraManager)
let smokeEffect; // Efecto de humo
// Audio
let audioManager; // Gestor de audio

// Componentes personalizados
let terrain, // Gestor del terreno
  lighting, // Sistema de iluminación
  clock, // Reloj para animaciones
  skybox; // Fondo 360°

// Variables para el minimap
let minimapWidth = 340,
  minimapHeight = 249;
let worldBounds = { minX: -250, maxX: 100, minZ: -250, maxZ: 300 }; // Límites del mundo ajustados para todas las piedras

// Minimapa modular - Solo creamos la instancia aquí, la inicialización se hará más tarde
let minimapManager = null;

// Cargador de modelos
let modelLoader; // Maneja la carga y animación de modelos 3D

// Instancia del controlador del granjero
let farmerController;

// Sistema de combate y gestor de oleadas
let combatSystem;
let waveManager;
// Contador de tiempo para la primera oleada (timestamp en ms)
let waveStartAt = null;
// helper to pause/resume absolute timestamps (avoid countdowns advancing while paused)
let __globalPauseAt = null;
try {
  window.addEventListener('gamepause', () => { __globalPauseAt = Date.now(); });
  window.addEventListener('gameresume', () => {
    try {
      if (__globalPauseAt) {
        const pausedMs = Date.now() - __globalPauseAt;
        if (waveStartAt) waveStartAt += pausedMs;
      }
    } catch (_) {}
    __globalPauseAt = null;
  });
} catch (_) {}
// Elemento DOM del contador
let waveCountdownEl = null;
// Elemento DOM de advertencia previa a la oleada
let waveWarningEl = null;
// Flag para etiquetar el contador como 'Primera oleada'
let isFirstWaveCountdown = false;

// Instancia del corral
let corral;

// Instancia del Space Shuttle Orbiter
let spaceShuttle;
let shipRepair;

// Array de vacas en el corral
let cows = [];

// Array de piedras en el terreno
let stones = [];

// Array de cristales en el terreno
let crystals = [];

// Aliens estáticos (solo idle)
let alien2Statics = [];
try { window.alien2Statics = alien2Statics; } catch (_) {}

// Mixers para clones de Alien2 (para reproducir IdleAlien2.fbx en los clones)
let alien2CloneMixers = [];
try { window.alien2CloneMixers = alien2CloneMixers; } catch (_) {}

// Postes de luz
let lightPosts = [];
try { window.lightPosts = lightPosts; } catch (_) {}

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
      }
    };

    // Intentar orientar inmediatamente y luego varios reintentos
    setTimeout(orientCow, 500);
    setTimeout(orientCow, 1000);
    setTimeout(orientCow, 2000);
    setTimeout(orientCow, 3000);

    cows.push(cow);
  });

  // Hacer las vacas accesibles para depuración
  window.cows = cows;
}

/**
 * Inicializar el minimap HUD
 */
function initMinimap() {
  // Solo inicializar si no se ha hecho ya
  if (!minimapManager) {
      minimapManager = makeMinimap({ width: minimapWidth, height: minimapHeight, worldBounds });

      // Inicialización del manager
      try {
        minimapManager.init("minimap-canvas");
        // If building refs were created before minimap initialization, attach them now
        if (window._pendingBuildingsForMinimap) {
          try { minimapManager.setReferences({ buildings: window._pendingBuildingsForMinimap }); } catch (_) {}
          window._pendingBuildingsForMinimap = null;
        }
      } catch (e) {
        return e;
      }
  }
}

/**
 * Actualizar el minimap con todos los objetos
 */
function updateMinimap() {
  // Delegado al manager
  try {
    // collect active enemy models from waveManager (if present)
    const enemyModels = [];
    try {
      const wm = window.waveManager || waveManager;
      if (wm && wm.activeEnemies) {
        for (const entry of wm.activeEnemies.values()) {
          if (!entry) continue;
          if (entry.instance && entry.instance.model) enemyModels.push(entry.instance.model);
          else if (entry.model) enemyModels.push(entry.model);
        }
      }
    } catch (e) {
      // ignore
    }

    minimapManager.setReferences({
      stones,
      house,
      spaceShuttle,
      corral,
      market,
      cows,
      farmerController,
      enemies: enemyModels,
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
  });

  // Hacer las piedras accesibles para depuración
  window.stones = stones;

}

/**
 * Crear cristales en posiciones fijas
 */
function createCrystals() {
  const crystalPositions = [
    { x: 27.0, y: 0.0, z: -29.3 },
    { x: 27.1, y: 0.0, z: -32.2 },
    { x: 30.5, y: 0.0, z: -21.1 },
    { x: -12.6, y: 0.0, z: -13.6 },
    { x: -35.0, y: 0.0, z: -26.6 },
    { x: 22.0, y: 0.0, z: -85.0 },
    { x: 24.0, y: 0.0, z: -83.7 },
    { x: 13.6, y: 0.0, z: -88.1 },
    { x: 25.8, y: 0.0, z: -31.8 },
    { x: 22.7, y: 0.0, z: -32.9 },
    { x: -32.7, y: 0.0, z: 4.1 },
    { x: -28.4, y: 0.0, z: 3.2 },
    { x: -81.8, y: 0.0, z: 24.7 },
    { x: -16.3, y: 0.0, z: 61.3 },
    { x: -20.7, y: 0.0, z: 61.7 },
    { x: -16.3, y: 0.0, z: 61.3 },
    { x: -38.7, y: 0.0, z: 27.6 },
    { x: -81.7, y: 0.0, z: 20.6 },
    { x: -97.7, y: 0.0, z: 42.1 },
    { x: -95.4, y: 0.0, z: 40.0 },
    { x: -94.3, y: 0.0, z: 38.9 },
    { x: -102.3, y: 0.0, z: 43.5 },
    { x: -100.6, y: 0.0, z: 43.5 },
    { x: -140.9, y: 0.0, z: 45.8 },
    { x: -156.5, y: 0.0, z: 61.7 },
    { x: -70.7, y: 0.0, z: 68.8 },
    { x: -67.8, y: 0.0, z: 68.3 },
    { x: -30.2, y: 0.0, z: 4.6 },
    { x: 28.2, y: 0.0, z: -24.5 },
    { x: 19.2, y: 0.0, z: -86.1 },
    { x: 27.6, y: 0.0, z: -27.4 },
    { x: 64.6, y: 0.0, z: 57.0 },
    { x: 61.8, y: 0.0, z: 58.1 },
    { x: 27.6, y: 0.0, z: -27.4 },
    { x: 61.1, y: 0.0, z: -55.8 },
    { x: 64.0, y: 0.0, z: 53.5 },
    { x: 27.4, y: 0.0, z: -22.1 },
    { x: -32.9, y: 0.0, z: -28.2 },
    { x: -37.4, y: 0.0, z: -28.1 },
    { x: -104.7, y: 0.0, z: -34.1 },
    { x: -138.0, y: 0.0, z: -21.9 },
  ];

  crystalPositions.forEach((pos) => {
    const crystal = new Crystal(scene, pos);
    crystals.push(crystal);
  });

  // Exponer para depuración
  try { window.crystals = crystals; } catch (_) {}
}

/**
 * Crear la casa con textura de piedra y puerta interactiva
 */
function createHouse() {

  // Crear la casa en las coordenadas especificadas
  house = new House(
    scene,
    { x: -23.5, y: 0.0, z: -5.0 }, // Posición ajustada para mejor orientación de la puerta
    { width: 20, height: 8, depth: 15 } // Tamaño rectangular más ancho y profundo
  );

  // La conexión con el farmerController se hará después de que se cree el controlador

  // Hacer la casa accesible desde la consola para depuración
  window.house = house;
}

/**
 * Crear postes de luz en coordenadas especificadas (global)
 */
function createLightPosts() {
  const positions = [
    { x: -12.7, y: 0.0, z: 4.4 },
    { x: -7.8, y: 0.0, z: -48.9 },
    { x: 55.2, y: 0.0, z: -0.6 },
    { x: 31.8, y: 0.0, z: 35.6 },
    { x: -13.8, y: 0.0, z: 47.9 },
    { x: -84.2, y: 0.0, z: 33.2 },
    { x: -151.9, y: 0.0, z: 72.0 },
  ];

  // Altura ≈ 3x altura del farmer (fallback 6.0)
  let poleHeight = 6.0;
  try {
    const fm = window.farmerController?.model;
    if (fm) {
      const box = new THREE.Box3().setFromObject(fm);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0) poleHeight = Math.max(4.5, Math.min(12, size.y * 3));
    }
  } catch (_) {}

  for (const p of positions) {
    try {
      const post = new LightPost(scene, p, { height: poleHeight });
      post.setEnabled(false);
      lightPosts.push(post);
    } catch (_) {}
  }
  try { window.lightPosts = lightPosts; } catch (_) {}
}

/**
 * Crear el mercado con textura de piedra y ventana frontal
 */
function createMarket() {

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
  return market;
}

/**
 * Crear la interacción de reparación de la nave (círculo y HUD)
 */
function createShipRepair() {
  shipRepair = new ShipRepair(scene, { x: 39.9, y: 0.0, z: -21.1 }, 1.5);
  window.shipRepair = shipRepair;
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
  window.alien2 = alien2;;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // Cap pixel ratio para rendimiento
  renderer.setSize(window.innerWidth, window.innerHeight); // Tamaño completo de la ventana
  renderer.shadowMap.enabled = true; // Habilitar sombras
  renderer.shadowMap.type = THREE.PCFShadowMap; // Sombras más baratas
  renderer.physicallyCorrectLights = true; // Iluminación realista
  renderer.outputEncoding = THREE.sRGBEncoding; // Mejor representación de colores
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mapeo de tonos cinematográfico
  renderer.toneMappingExposure = 1.0; // Exposición del mapeo de tonos
  document.getElementById("container").appendChild(renderer.domElement); // Añadir al DOM

  // Inicializar el gestor de cámara
  cameraManager = new CameraManager(scene, {
    fov: 75,
    near: 0.5,
    far: 1400,
  });

  // Obtener la cámara para compatibilidad con el código existente
  camera = cameraManager.getCamera();
  // Exponer cámara también en la escena para utilidades que hacen billboard (healthbars, etc.)
  try { scene.userData = scene.userData || {}; scene.userData.camera = camera; } catch (e) {}

  // Inicializar audio manager (ligado a la cámara para audio 3D)
  try {
    if (!window.audio) {
      audioManager = new AudioManager(camera);
      window.audio = audioManager;
    } else {
      // Reusar la instancia creada previamente en DOMContentLoaded. Adjuntar listener a la cámara si es necesario.
      audioManager = window.audio;
      try {
        if (camera && typeof camera.add === 'function') camera.add(audioManager.listener);
      } catch (e) {}
    }
  } catch (e) {
    return e;
  }

  // Inicializar reloj para animaciones
  clock = new THREE.Clock();

  // Cargar skybox (fondo 360°)
  (async () => {
    try {
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
          skybox = new Skybox(scene, path);
          break; // Salir del bucle si la carga es exitosa
        } catch (err) {
          return e;
          // Continuar con la siguiente ruta en caso de error
        }
      }

      // Si no se pudo cargar ningún skybox
      if (!skybox) {
        throw new Error("No se pudo cargar ninguna textura de skybox");
      }

      // Configuración adicional del renderizado
      renderer.setClearColor(0x000000, 1); // Color de fondo negro
      renderer.outputEncoding = THREE.sRGBEncoding; // Codificación de color sRGB
    } catch (error) {
      // Configurar un color de fondo celeste como respaldo
      scene.background = new THREE.Color(0x87ceeb);
    }
  })();

  // Inicializar el sistema de iluminación
  lighting = new Lighting(scene);

  // Expose DeathScreen helper globally (redundant but explicit)
  try { window.showDeathScreen = showDeathScreen; } catch (e) {}

  // Crear y configurar el terreno
  terrain = new Terrain(scene, renderer);

  // Inicializar el cargador de modelos 3D
  modelLoader = new ModelLoader(scene);


  // Crear un CombatSystem global temprano para que FarmerController y WaveManager
  // se registren en la misma instancia (evita tener múltiples instancias aisladas)
  if (!window.combatSystem) {
    try {
      window.combatSystem = new CombatSystem();
    } catch (e) {
      return e;
    }
  }
  // asignar a la variable local también (se reasignará más tarde si es necesario)
  combatSystem = window.combatSystem;

  // Crear el corral para vacas
  corral = new Corral(
    scene,
    { x: 15, y: 0, z: 15 },
    { width: 20, height: 2, depth: 20 }
  );

  // Registrar el corral en el CombatSystem y crear su barra de vida HUD (debajo de la del jugador)
  try {
    // Asegurar instancia global del sistema de combate
    combatSystem = window.combatSystem || new CombatSystem();
    window.combatSystem = combatSystem;

    // Crear un ancla simple en el centro del corral para registrar vida/daño
    const corralAnchor = new THREE.Object3D();
    corralAnchor.position.set(corral.position.x, corral.position.y + 1, corral.position.z);
    scene.add(corralAnchor);
    window.corralAnchor = corralAnchor;

    // Integrar con vida propia (p.ej. 300 de vida), equipo aliado para evitar Fuego Amigo si aplica
    const corralHealth = integrateEntityWithCombat(combatSystem, 'corral', corralAnchor, 500, { team: 'ally' });
    window.corralHealth = corralHealth;
    
    // Connect the corral's health component to the corral instance
    if (corral) {
      corral.healthComponent = corralHealth;
      corral.maxHealth = 500; // Match the health set in integrateEntityWithCombat
      corral.health = 500;
    }

    // Crear HUD del corral cuando comience el gameplay, una sola vez
    const spawnCorralHealthbar = () => {
      try {
        if (window.corralHealthBar) return;
        const hb = new HealthBar({ id: 'corral-healthbar', position: 'top-left', x: 20, y: 56, width: 320, height: 24, label: 'corral' });
        hb.attachTo(corralHealth, { position: 'top-left', x: 20, y: 56, label: 'corral' });
        window.corralHealthBar = hb;
      } catch (_) {}
    };

    try {
      if (window.__gameplayStarted) {
        spawnCorralHealthbar();
      } else {
        window.addEventListener('gameplaystart', spawnCorralHealthbar, { once: true });
      }
    } catch (_) { spawnCorralHealthbar(); }
  } catch (e) { /* no fatal */ }

  // Crear el Space Shuttle Orbiter
  spaceShuttle = new SpaceShuttle(
    scene,
    { x: 50, y: 0, z: -30 }, // Posición: a un lado, sobre la superficie del terreno
    0.1 // Escala mucho más reducida para que no sea tan grande
  );

  // Crear 4 vacas dentro del corral
  createCows();

  // Crear 30 piedras aleatorias en el terreno
  createStones();

  // Crear cristales en coordenadas dadas
  createCrystals();

  // Crear la casa con puerta interactiva
  createHouse();
  // Crear postes de luz en posiciones dadas
  try { createLightPosts(); } catch (_) {}
  // Crear el alien2
  const alien2 = await createAlien2();
  window.alien2 = alien2;

  // No crear aliens estáticos (para evitar duplicación/stack). Dejamos solo los últimos (clones)
  try { /* static Alien2 disabled */ } catch (_) {}

  // Clonar el alien2 del mercado para garantizar que se vean igual en las coordenadas pedidas
  try { createAlien2Clones(); } catch (_) {}

  // Iniciar la secuencia de movimiento automático (5 minutos de delay)
  alien2.startMovementSequence();

  // Crear el mercado con ventana frontal
  const market = createMarket();

  // Actualizar minimap inmediatamente con la referencia del mercado
  try {
    minimapManager.setReferences({ market });
  } catch (e) {}

  // Hacer el mercado accesible desde la consola para depuración
  window.market = market;

  // Crear interacción de reparación de la nave (círculo y HUD)
  createShipRepair();
  // Hook: mostrar escena final cuando la reparación esté completa
  if (shipRepair) {
    try {
      shipRepair.onRepairComplete = (info) => {
        try {
          showFinalScene({ shipRepair, cameraManager });
        } catch (e) {
          return e;
        }
      };
    } catch (e) {
      return e;
    }
  }

  // --- Preload and place decorative buildings in free positions ---
  try {
  const buildingMgr = new BuildingManager(scene, { basePath: 'src/models/characters/building/', terrain });
    window.buildingMgr = buildingMgr;
    // Preload prototypes (FBX) once
    try { await buildingMgr.preloadDefaults(); } catch (e) { return e; }

    // Build avoid list: stones' models, house, market, corral, spaceShuttle
    const avoidObjects = [];
    try {
      if (stones && stones.length) {
        for (const s of stones) {
          if (!s) continue;
          if (s.model) avoidObjects.push(s.model);
          else avoidObjects.push(s);
        }
      }
      if (house) avoidObjects.push(house);
      if (market) avoidObjects.push(market);
      if (corral) avoidObjects.push(corral);
      if (spaceShuttle) avoidObjects.push(spaceShuttle.model || spaceShuttle);
      if (shipRepair) avoidObjects.push(shipRepair);
    } catch (e) {
      return e;
    }

    // Place exactly one of each structure (avoid clustering)
    try {
  // Preferred fixed positions (explicit y provided; BuildingManager will snap to terrain if available)
  const preferredPositions = {
    alienPyramid: { x: 23.4, y: 0.0, z: 198.5 },
    alienLab: { x: -137.3, y: 0.0, z: -145.4 },
    alienHouse: { x: -79.9, y: 0.0, z: -70.3 },
  };

  const placed = buildingMgr.placeOneOfEach(['alienHouse','alienLab','alienPyramid'], worldBounds, avoidObjects, { clearance: 10, maxAttemptsPerPlacement: 400, positions: preferredPositions });
      window.placedBuildings = placed;
      // Provide placed buildings to the minimap manager if initialized; otherwise stash for later
      try {
        const buildingRefs = buildingMgr.getAllStructures();
        if (minimapManager) {
          minimapManager.setReferences({ buildings: buildingRefs });
        } else {
          // store globally so initMinimap can pick it up
          window._pendingBuildingsForMinimap = buildingRefs;
        }
      } catch (e) {
        return e;
      }
    } catch (e) {
      return e;
    }
  } catch (e) {
    return e;
  }

  // Configurar los controles de la cámara
  cameraManager.setupControls(renderer.domElement);
  controls = cameraManager.getControls();

  // Configuración de sombras
  if (renderer.shadowMap) {
    renderer.shadowMap.autoUpdate = true; // Actualización automática de sombras
    renderer.shadowMap.needsUpdate = true; // Forzar actualización inicial
  }

  // Obtener la configuración del personaje granjero2
  const farmerConfig = modelConfig.characters.farmer2;

  // Preparar las rutas de las animaciones
  // Creamos un objeto que mapea nombres de animación a sus rutas completas
  const animationPaths = {};
  for (const [animName, animPath] of Object.entries(farmerConfig.animations)) {
    // Usar el método getPath para obtener la ruta completa del archivo
    animationPaths[animName] = modelConfig.getPath(animPath);
  }

  // Cargar el modelo 3D con sus animaciones
  try {

    // Cargar el modelo principal con sus animaciones
    await modelLoader.load(
      modelConfig.getPath(farmerConfig.model), // Ruta al archivo del modelo
      animationPaths, // Diccionario de animaciones
      (instance) => {

        // Configurar la cámara isométrica para seguir al modelo
        if (instance.model) {
          // Configurar el objetivo de la cámara para seguir al modelo en modo isométrico
          cameraManager.setTarget(instance.model);

          // Obtener la cámara actualizada
          camera = cameraManager.getCamera();

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
          } catch (e) {
           return e;
          }

          // Conectar el corral con el controlador del granjero
          if (corral) {
            farmerController.setCorral(corral);
          }

          // Conectar el Space Shuttle con el controlador del granjero
          if (spaceShuttle) {
            farmerController.setSpaceShuttle(spaceShuttle);
          }

          // Hacer el modelo accesible desde la consola para depuración
          window.farmer = instance;
          window.farmerController = farmerController; // Para depuración
          window.corral = corral; // Para depuración del corral

          // Inicializar CombatSystem y WaveManager usando SIEMPRE la instancia global existente
          // Esto evita que el farmer y los enemigos queden registrados en instancias distintas
          try {
            combatSystem = window.combatSystem || new CombatSystem();
            window.combatSystem = combatSystem;

            // Crear wave manager con helpers para localizar jugador y vacas
            waveManager = new WaveManager(scene, modelLoader, window.combatSystem, {
              getPlayer: () => (window.farmerController ? window.farmerController.model : null),
              getCows: () => window.cows || [],
              getCorral: () => window.corral || corral,
              getStones: () => window.stones || stones || [],
              getMarket: () => window.market || market,
              getHouse: () => window.house || house,
              getSpaceShuttle: () => window.spaceShuttle || spaceShuttle,
              difficultyMode: (typeof window !== 'undefined' && window.selectedDifficulty) ? window.selectedDifficulty : 'easy',
              // Generar spawns alrededor del corral (alrededores), evitando piedras
              spawnPoints: [ ], // fallback vacío: el WaveManager generará alrededor del corral
              // Spawns todavía más alejados del corral
              spawnRingMin: 100, // mucho más lejos del corral
              spawnRingMax: 200, // anillo amplio
              alienDetectionRange: 220, // ampliar para detectar antes al acercarse
              playerAggroRadius: 14, // si el jugador está muy cerca, priorizarlo sobre vacas
              baseCount: 3,
              waveCount: 6,
            });

            window.waveManager = waveManager;
            // Programar oleadas solo cuando el jugador empiece el gameplay (tras pantalla de controles)
            const scheduleWavesAfterStart = () => {
              try {
                // Evitar reprogramar si ya existe una cuenta regresiva activa
                if (waveStartAt) return;
                // Mostrar advertencia previa a la primera oleada
                try { createWaveWarningElement(); } catch (e) {}
                isFirstWaveCountdown = true;
                waveStartAt = performance.now() + 60000;
                try { createWaveCountdownElement(); } catch (e) {}
                // waveManager will be started from the main loop when waveStartAt elapses
              } catch (e) { return e; }
            };

            try {
              if (window.__gameplayStarted) {
                scheduleWavesAfterStart();
              } else {
                window.addEventListener('gameplaystart', scheduleWavesAfterStart, { once: true });
              }
            } catch (_) {
              scheduleWavesAfterStart();
            }
          } catch (e) {
            return e;
          }

          // Conectar el farmerController con las piedras para detección de colisiones
          if (farmerController && stones && stones.length > 0) {
            farmerController.setStones(stones);
          } 
          // Conectar el farmerController con la casa para detección de colisiones
          if (farmerController && house) {
            farmerController.setHouse(house);
            
          }
          // Conectar el farmerController con los edificios (si el buildingMgr existe)
          try {
            if (farmerController && window.buildingMgr && typeof window.buildingMgr.getColliders === 'function') {
              const buildingColliders = window.buildingMgr.getColliders();
              farmerController.setBuildings(buildingColliders);
            }
          } catch (e) { /* non-fatal */ }

          // Conectar el farmerController con las vacas para detección de colisiones
          if (farmerController && cows && cows.length > 0) {
            farmerController.setCows(cows);
          } 
          // Conectar el farmerController con el mercado para detección de colisiones
          if (farmerController && market) {
            farmerController.setMarket(market);
          }

          // Mostrar las animaciones disponibles en consola
          const availableAnims = Object.keys(instance.actions);

        }
      },
      farmerConfig // Pasar la configuración completa del modelo
    );
  } catch (error) {
    return e;
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
        }
      } catch (e) {
        return e;
      }
    };
  }

  // Inicializar el minimap
  initMinimap();

  // Inicializar el sistema de objetivos
  initObjectives();

  // Iniciar bucle de animación
  animate();
}

/**
 * Configura los listeners de eventos de la ventana
 */
function setupEventListeners() {
  // Escuchar cambios en el tamaño de la ventana
  window.addEventListener("resize", onWindowResize);

  // Tecla 'i' para mostrar/ocultar el inventario
  window.addEventListener("keydown", (ev) => {
    // Ignorar si el usuario está escribiendo en un input/textarea
    // Se eliminó el manejo de la tecla 'i' para abrir/cerrar el inventario
    // Ahora solo se puede interactuar con el botón del inventario
  }
  );
}

// --- Wave countdown HUD helpers ---
function createWaveCountdownElement() {
  if (waveCountdownEl) return waveCountdownEl;
  const el = document.createElement('div');
  el.id = 'wave-countdown';
  el.style.position = 'fixed';
  el.style.top = '12px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.padding = '8px 12px';
  el.style.background = 'rgba(0,0,0,0.65)';
  el.style.color = '#fff';
  el.style.fontFamily = 'Arial, sans-serif';
  el.style.fontSize = '18px';
  el.style.borderRadius = '6px';
  el.style.zIndex = '9999';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0.95';
  el.textContent = 'Primera oleada: 1:00';
  document.body.appendChild(el);
  waveCountdownEl = el;
  return el;
}

// Advertencia previa a la primera oleada
function createWaveWarningElement() {
  if (waveWarningEl) return waveWarningEl;
  const el = document.createElement('div');
  el.id = 'wave-warning';
  el.style.position = 'fixed';
  el.style.top = '28%';
  el.style.left = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.maxWidth = '80%';
  el.style.padding = '16px 20px';
  el.style.background = 'rgba(180,0,0,0.85)';
  el.style.color = '#fff';
  el.style.fontFamily = 'Arial, sans-serif';
  el.style.fontSize = '20px';
  el.style.fontWeight = '700';
  el.style.border = '2px solid rgba(255,255,255,0.2)';
  el.style.borderRadius = '8px';
  el.style.boxShadow = '0 10px 24px rgba(0,0,0,0.6)';
  el.style.textAlign = 'center';
  el.style.zIndex = '10000';
  el.style.pointerEvents = 'none';
  el.textContent = 'Cuidado: los aliens comenzarán a atacar para llevarse las vacas. Debes defenderlas y escapar';
  document.body.appendChild(el);

  // Auto-ocultar luego de unos segundos
  setTimeout(() => {
    try {
      if (el && el.parentElement) el.parentElement.removeChild(el);
      waveWarningEl = null;
    } catch (e) {}
  }, 7000);

  waveWarningEl = el;
  return el;
}

function formatTimeMMSS(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
const minimapUpdateInterval = 20; // Actualizar minimap cada 20 frames
let terrainUpdateCounter = 0;
const terrainUpdateInterval = 8; // Actualizar terreno cada 8 frames
let skyboxUpdateCounter = 0;
const skyboxUpdateInterval = 6; // Actualizar skybox cada 6 frames
let frameCounter = 0; // para escalonar actualizaciones

// Escalador de rendimiento dinámico
let __perfFrames = 0;
let __perfAccumTime = 0;
let __currentFps = 60;
let __targetPixelRatio = 1.0;
let __maxShadowPosts = 3; // presupuesto de sombras para postes

function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  // Control de FPS mejorado
  const deltaTime = currentTime - lastTime;
  if (deltaTime < frameTime) return;
  lastTime = currentTime - (deltaTime % frameTime);

  const delta = Math.min(0.05, clock.getDelta()); // Reducir el delta máximo para mayor suavidad
  frameCounter++;

  // Medición simple de FPS y ajuste de presupuesto
  __perfFrames++;
  __perfAccumTime += delta;
  if (__perfAccumTime >= 1.0) {
    __currentFps = __perfFrames / __perfAccumTime;
    __perfFrames = 0;
    __perfAccumTime = 0;
    // Ajustar pixel ratio dinamicamente entre 0.85 y 1.25
    if (__currentFps < 42) {
      __targetPixelRatio = Math.max(0.85, __targetPixelRatio - 0.1);
    } else if (__currentFps > 58) {
      __targetPixelRatio = Math.min(1.25, __targetPixelRatio + 0.05);
    }
    try { renderer.setPixelRatio(__targetPixelRatio); } catch (_) {}

    // Ajustar presupuesto de sombras según FPS
    if (__currentFps < 45) __maxShadowPosts = 2;
    else if (__currentFps < 55) __maxShadowPosts = 3;
    else __maxShadowPosts = 4;
  }

  // If the game is paused via the pause menu, skip updates but keep rendering the current frame
  try {
    if (window.__gamePaused) {
      if (renderer && scene && camera) {
        try { renderer.render(scene, camera); } catch (e) {}
      }
      return;
    }
  } catch (_) {}

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
    // Update all static Alien2 instances so their idle AnimationMixers advance
    try {
      if (window.alien2Statics && Array.isArray(window.alien2Statics)) {
        for (let i = 0; i < window.alien2Statics.length; i++) {
          const a = window.alien2Statics[i];
          if (a && typeof a.update === 'function') a.update(delta);
        }
      }
    } catch (_) {}
    // Update all Alien2 clone mixers (IdleAlien2.fbx on clones)
    try {
      if (window.alien2CloneMixers && Array.isArray(window.alien2CloneMixers) && (frameCounter % 2 === 0)) {
        for (let i = 0; i < window.alien2CloneMixers.length; i++) {
          const m = window.alien2CloneMixers[i];
          if (m && typeof m.update === 'function') m.update(delta);
        }
      }
    } catch (_) {}

    // actualizar y mostrar contador de la primera oleada si está programado
    try {
      if (waveStartAt && waveStartAt > 0) {
        const now = performance.now();
        const remainingMs = Math.max(0, waveStartAt - now);
        if (remainingMs > 0) {
          const remainingSec = Math.ceil(remainingMs / 1000);
          // crear elemento si no existe
          if (!waveCountdownEl) createWaveCountdownElement();
          if (waveCountdownEl) waveCountdownEl.textContent = `${isFirstWaveCountdown ? 'Primera oleada' : 'Siguiente oleada'}: ${formatTimeMMSS(remainingSec)}`;
        } else {
          // oculta cuando llegue la hora
          try {
            if (waveManager && typeof waveManager.start === 'function' && !waveManager._running) {
              try {
                waveManager.start();
              } catch (e) { return e; }
            }
          } catch (_) {}
          if (waveCountdownEl && waveCountdownEl.parentElement) waveCountdownEl.parentElement.removeChild(waveCountdownEl);
          waveCountdownEl = null;
          waveStartAt = null; // no necesitamos más el timestamp
          isFirstWaveCountdown = false;
        }
      }
    } catch (e) {
      // no crítico
    }

    // actualizar sistema de combate (procesa hitboxes)
    if (combatSystem && typeof combatSystem.update === 'function') {
      try {
        combatSystem.update(delta);
      } catch (e) {
        return e;
      }
    }

    // actualizar wave manager (spawns + actualiza enemigos)
    if (waveManager && typeof waveManager.update === 'function') {
      try {
        waveManager.update(delta);
      } catch (e) {
        return e;
      }
    }

    // Actualizar el corral y la casa cada frame para animaciones suaves
    if (corral && farmerController?.model) {
      corral.update(delta, farmerController.model.position);
    }

    if (house && farmerController?.model) {
      house.update(delta, farmerController.model.position);
    }

    // 4. Actualización de objetos del juego (prioridad media-baja)
    // Usar requestIdleCallback para tareas menos críticas
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => {
        // Actualizar el Space Shuttle
        if (spaceShuttle) {
          spaceShuttle.update(delta);
        }
      });
    }

    // 5. Actualización de múltiples instancias (optimizado y escalonado)
    // Actualizar vacas en frames pares y piedras en frames impares para repartir carga
    if ((frameCounter & 1) === 0) {
      for (let i = 0; i < cows.length; i++) {
        cows[i].update(delta);
      }
    } else {
      for (let i = 0; i < stones.length; i++) {
        stones[i].update(delta);
      }
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
    // Ajustar postes según la noche (más realista: que la iluminación principal provenga de los postes)
    try {
      if (lighting && Array.isArray(lightPosts)) {
        // Suavizado del factor nocturno para transición
        const nf = Math.max(0, Math.min(1, (lighting.nightFactor || 0)));
        // Curva para reforzar más brillo en plena noche
        const factor = nf * nf;
        for (let i = 0; i < lightPosts.length; i++) {
          const lp = lightPosts[i];
          if (lp && typeof lp.setEnabled === 'function') lp.setEnabled(factor);
        }

        // Presupuesto de sombras: activar sombras solo en los postes más cercanos al jugador por la noche
        if (factor > 0.1 && farmerController && farmerController.model) {
          const playerPos = farmerController.model.position;
          const entries = [];
          for (let i = 0; i < lightPosts.length; i++) {
            const lp = lightPosts[i];
            if (!lp || !lp.light || !lp.group) continue;
            const p = lp.group.position;
            const dx = p.x - playerPos.x; const dz = p.z - playerPos.z;
            const d2 = dx*dx + dz*dz;
            entries.push({ i, d2, lp });
          }
          // ordenar por distancia
          entries.sort((a,b)=>a.d2-b.d2);
          const maxShadowLights = __maxShadowPosts; // presupuesto dinámico
          for (let idx = 0; idx < entries.length; idx++) {
            const { lp } = entries[idx];
            if (!lp || !lp.light) continue;
            const enableShadow = idx < maxShadowLights;
            // Activar/desactivar castShadow dinámicamente
            try { lp.light.castShadow = enableShadow; } catch (_) {}
            // Ajustar resolución de sombras si es necesario
            try {
              const size = enableShadow ? 1024 : 256;
              lp.light.shadow.mapSize.width = size;
              lp.light.shadow.mapSize.height = size;
            } catch (_) {}
          }
        } else {
          // De día o sin jugador: desactivar sombras en postes
          for (let i = 0; i < lightPosts.length; i++) {
            const lp = lightPosts[i];
            if (lp && lp.light) {
              try { lp.light.castShadow = false; } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}

    // 8.1 Actualizar efecto de humo (menos frecuente)
    if (smokeEffect && (frameCounter % 3 === 0)) {
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
    return error;
  }
}

// Función global para forzar la apertura del HUD del mercado
window.forceOpenMarketHUD = function () {
  if (window.market) {
    window.market.showMarketUI();
    return "HUD del mercado abierto forzosamente";
  } else {
    return "Error: No se encontró la instancia del mercado";
  }
};

// Función global para mostrar la posición actual del jugador
window.showPlayerPosition = function () {
  if (farmerController && farmerController.model) {
    const pos = farmerController.model.position;
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
