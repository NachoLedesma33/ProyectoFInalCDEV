import "./utils/consoleFilter.js";
import PauseMenu from "./utils/pauseMenu.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { Terrain } from "./utils/Terrain.js";
import { Lighting } from "./utils/lighting.js";
import { ModelLoader } from "./utils/modelLoader.js"; 
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/SkeletonUtils.js";
import { Skybox } from "./utils/Skybox.js";
import modelConfig from "./config/modelConfig.js";
import { CameraManager } from "./utils/CameraManager.js";
import { FarmerController } from "./utils/FarmerController.js";
import { Corral } from "./utils/Corral.js";
import { SpaceShuttle } from "./utils/SpaceShuttle.js";
import { Cow } from "./utils/Cow.js";
import { Stone } from "./utils/Stone.js";
import { Crystal } from "./utils/Crystal.js"; 
import { House } from "./utils/House.js";
import { Market } from "./utils/Market.js";
import BuildingManager from "./utils/building.js";
import { Inventory } from "./utils/Inventory.js";
import { initObjectives } from "./utils/objectives.js";
import { Alien2 } from "./utils/Alien2.js";
import { ShipRepair } from "./utils/ShipRepair.js";
import { SmokeEffect } from "./utils/smokeEffect.js";
import { showFinalScene } from "./utils/finalScene.js";
import { makeMinimap } from "./utils/minimap.js";
import { createStoryManager, storySlides } from "./utils/startMenu.js";
import createSoundHUD from "./utils/soundHUD.js";
import CombatSystem, {
  integrateEntityWithCombat,
} from "./utils/CombatSystem.js";
import HealthBar from "./utils/Healthbar.js";
import showDeathScreen from "./utils/DeathScreen.js";
import WaveManager from "./utils/waves.js";
import { AudioManager } from "./utils/AudioManager.js";
import { safePlaySfx } from "./utils/audioHelpers.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import LightPost from "./utils/LightPost.js";

document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("play-button");
  const tutorialButton = document.getElementById("tutorial-button");
  const controlsButton = document.getElementById("controls-button");
  let soundButton = document.getElementById("sound-button");

  const storyManager = createStoryManager(storySlides, () => {
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

    function createAlien2Clones() {
      try {
        try {
          if (!window.alien2Clones) window.alien2Clones = [];
        } catch (_) {}
        try {
          if (Array.isArray(window.alien2Clones)) {
            for (let i = 0; i < window.alien2Clones.length; i++) {
              const c = window.alien2Clones[i];
              try {
                if (c && c.parent) c.parent.remove(c);
              } catch (_) {}
            }
            window.alien2Clones.length = 0;
          }
        } catch (_) {}
        try {
          if (Array.isArray(window.alien2Statics)) {
            for (let i = 0; i < window.alien2Statics.length; i++) {
              const a = window.alien2Statics[i];
              try {
                if (a && a.model && a.model.parent)
                  a.model.parent.remove(a.model);
              } catch (_) {}
            }
            window.alien2Statics.length = 0;
          }
        } catch (_) {}
        try {
          alien2CloneMixers.length = 0;
        } catch (_) {}
        if (!window.alien2 || !window.alien2.model) return;
        const base = window.alien2.model;
        const idlePath = modelConfig.getPath(
          modelConfig.characters.alien2.animations.idle
        );
        const entries = [
          {
            pos: { x: -81.2, y: 0.0, z: -65.9 },
            look: { x: -79.9, y: 0.0, z: -64.4 },
          },
          {
            pos: { x: -81.6, y: 0.0, z: -62.4 },
            look: { x: -79.9, y: 0.0, z: -64.4 },
          },
          {
            pos: { x: -153.2, y: 0.0, z: -119.9 },
            look: { x: -149.1, y: 0.0, z: -118.6 },
          },
          {
            pos: { x: -83.3, y: 0.0, z: 37.2 },
            look: { x: -79.3, y: 0.0, z: 38.9 },
          },
          {
            pos: { x: -81.1, y: 0.0, z: 36.6 },
            look: { x: -79.3, y: 0.0, z: 38.9 },
          },
        ];
        const clones = [];
        for (const e of entries) {
          try {
            const clone = SkeletonUtils.clone(base);
            clone.position.set(e.pos.x, (e.pos.y || 0) + 0.2, e.pos.z);
            clone.visible = true;
            clone.traverse((o) => {
              try {
                o.frustumCulled = true;
                o.visible = true;
              } catch (_) {}
            });
            const lookTarget = new THREE.Vector3(
              e.look.x,
              clone.position.y,
              e.look.z
            );
            try {
              clone.lookAt(lookTarget);
            } catch (_) {}
            scene.add(clone);

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
        try {
          window.alien2Clones = clones;
        } catch (_) {}
        try {
          window.createAlien2Clones = createAlien2Clones;
        } catch (_) {}
        try {
          return false;
        } catch (_) {}
      } catch (_) {}
    }
    try {
      window.createAlien2Clones = createAlien2Clones;
    } catch (_) {}

    async function createAlien2Statics() {
      const entries = [
        {
          pos: { x: -81.2, y: 0.0, z: -65.9 },
          look: { x: -79.9, y: 0.0, z: -64.4 },
        },
        {
          pos: { x: -81.6, y: 0.0, z: -62.4 },
          look: { x: -79.9, y: 0.0, z: -64.4 },
        },
        {
          pos: { x: -153.2, y: 0.0, z: -119.9 },
          look: { x: -149.1, y: 0.0, z: -118.6 },
        },
        {
          pos: { x: -83.3, y: 0.0, z: 37.2 },
          look: { x: -79.3, y: 0.0, z: 38.9 },
        },
        {
          pos: { x: -81.1, y: 0.0, z: 36.6 },
          look: { x: -79.3, y: 0.0, z: 38.9 },
        },
      ];

      for (const e of entries) {
        try {
          const a = new Alien2(scene, modelLoader, e.pos, e.look);
          await a.load();
          try {
            a.forceIdleAnimation && a.forceIdleAnimation();
          } catch (_) {}
          try {
            a.movementSystem && (a.movementSystem.isActive = false);
          } catch (_) {}
          try {
            if (a.model) {
              a.model.position.set(e.pos.x, (e.pos.y || 0) + 0.2, e.pos.z);
              a.model.visible = true;
              a.model.traverse((o) => {
                try {
                  o.frustumCulled = true;
                  o.visible = true;
                } catch (_) {}
              });
              const lookTarget = new THREE.Vector3(
                e.look.x,
                a.model.position.y,
                e.look.z
              );
              const doOrient = () => {
                try {
                  a.model && a.model.lookAt(lookTarget);
                } catch (_) {}
              };
              doOrient();
              setTimeout(doOrient, 200);
              setTimeout(doOrient, 800);
            }
          } catch (_) {}
          try {
            return false;
          } catch (_) {}
          alien2Statics.push(a);
        } catch (err) {}
      }

      try {
        window.alien2Statics = alien2Statics;
      } catch (_) {}
      try {
        return false;
      } catch (_) {}
    }
    try {
      window.createAlien2Statics = createAlien2Statics;
    } catch (_) {}

    return window.__gameInitPromise;
  });

  storyManager.attachToPlayButton(playButton);

  const scheduleIdle = (fn, timeout = 1500) => {
    try {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(fn, { timeout });
      } else {
        setTimeout(fn, Math.min(timeout, 300));
      }
    } catch (_) {
      setTimeout(fn, Math.min(timeout, 300));
    }
  };

  try {
    if (!soundButton && playButton && playButton.parentNode) {
      soundButton = document.createElement("button");
      soundButton.id = "sound-button";
      soundButton.className = "menu-button";
      soundButton.type = "button";
      soundButton.innerText = "Sonido";
      playButton.parentNode.insertBefore(soundButton, playButton.nextSibling);
    } else if (playButton && soundButton && playButton.parentNode) {
      try {
        playButton.parentNode.insertBefore(soundButton, playButton.nextSibling);
      } catch (_) {}
    }
  } catch (e) {
    return e;
  }

  scheduleIdle(() => {
    try {
      if (!window.audio) {
        const earlyAudio = new AudioManager(null);
        window.audio = earlyAudio;
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
        try { earlyAudio.preloadSfx(["run","punch","uiClick","uiHover","milking"]); } catch (_) {}
      }
    } catch (e) {
      return e;
    }
  }, 1200);

  if (tutorialButton && typeof tutorialButton.addEventListener === "function") {
    tutorialButton.addEventListener("click", () => {
      try {
        safePlaySfx("uiClick", { volume: 0.9 });
      } catch (_) {}
    });
  }

  if (controlsButton && typeof controlsButton.addEventListener === "function") {
    controlsButton.addEventListener("click", () => {
      try {
        safePlaySfx("uiClick", { volume: 0.9 });
      } catch (_) {}
    });
  }

  let soundHud = null;
  scheduleIdle(() => {
    try {
      soundHud =
        typeof createSoundHUD === "function"
          ? createSoundHUD({ container: document.body })
          : null;
      if (soundHud) soundHud.style.display = "none";
    } catch (_) {}
  }, 1500);

  let pauseMenu = null;
  scheduleIdle(() => {
    try {
      if (typeof PauseMenu === "function") {
        pauseMenu = new PauseMenu({ container: document.body });
        try {
          if (pauseMenu && typeof pauseMenu.hide === "function") pauseMenu.hide();
        } catch (_) {}
      }
    } catch (e) {
      return e;
    }
    try { window.pauseMenu = pauseMenu; } catch (_) {}
  }, 1600);

  if (soundButton) {
    try {
      soundButton.addEventListener("pointerenter", () => {
        try {
          safePlaySfx("uiHover", { volume: 0.6 });
        } catch (_) {}
      });
      soundButton.addEventListener("mouseenter", () => {
        try {
          safePlaySfx("uiHover", { volume: 0.6 });
        } catch (_) {}
      });
    } catch (e) {}

    soundButton.addEventListener("click", () => {
      try {
        safePlaySfx("uiClick", { volume: 0.9 });
      } catch (_) {}

      try {
        const mainMenu = document.getElementById("main-menu");
        const menuVisible =
          mainMenu && window.getComputedStyle(mainMenu).display !== "none";
        if (!menuVisible) {
          return;
        }

        if (!soundHud) return;
        const visible =
          soundHud.style.display !== "none" && soundHud.style.display !== "";
        soundHud.style.display = visible ? "none" : "block";
      } catch (e) {
        return e;
      }
    });
  } else {
    return "sound-button not found and could not be created; sound HUD will not be toggleable via button";
  }

  try {
    window.addEventListener("keydown", (ev) => {
      if (!ev || !ev.key) return;
      if (ev.key === "Escape" || ev.key === "Esc") {
        try {
          const tag =
            (document.activeElement && document.activeElement.tagName) || "";
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          const gameCont = document.getElementById("game-container");
          if (!gameCont) return;
          const visible = window.getComputedStyle
            ? getComputedStyle(gameCont).display !== "none"
            : gameCont.style.display !== "none";
          if (!visible) return;

          try {
            console.debug &&
              console.debug("[pause] Escape pressed, toggling pause");
          } catch (_) {}

          try {
            if (
              pauseMenu &&
              typeof pauseMenu.show === "function" &&
              typeof pauseMenu.hide === "function" &&
              typeof pauseMenu.isShown === "function"
            ) {
              const isShown = pauseMenu.isShown();
              if (isShown) pauseMenu.hide();
              else pauseMenu.show();
              return;
            }
          } catch (err) {
            return err;
          }

          const overlay = document.getElementById("pause-overlay");
          if (!overlay) return;
          const overlayVisible = window.getComputedStyle
            ? getComputedStyle(overlay).display !== "none" &&
              getComputedStyle(overlay).opacity !== "0"
            : overlay.style.display === "block";
          if (overlayVisible) {
            overlay.style.display = "none";
            window.__gamePaused = false;
          } else {
            overlay.style.display = "block";
            window.__gamePaused = true;
          }
        } catch (e) {
          return e;
        }
      }
    });
  } catch (e) {
    return e;
  }

  try {
    window.addEventListener("gameplaystart", () => {
      try {
        if (window.audio && typeof window.audio.stopMusic === "function")
          window.audio.stopMusic();
      } catch (_) {}
      try {
        if (window.audio && typeof window.audio.playAmbience === "function") {
          window.audio.playAmbience("noise", { loop: true, volume: 0.6 });
        }
        if (
          window.audio &&
          typeof window.audio.startRandomAmbient === "function"
        ) {
          window.audio.startRandomAmbient({
            minDelay: 30,
            maxDelay: 180,
            playProbability: 0.6,
            volume: 0.7,
          });
        }
      } catch (_) {}
    });
  } catch (_) {}

  try {
    const invToggle = document.getElementById("inventory-toggle");
    const mapToggle = document.getElementById("minimap-toggle");
    const objToggle = document.getElementById("objectives-toggle");

    const invHud = document.getElementById("inventory-hud");
    const mapHud = document.getElementById("minimap-hud");
    const objHud = document.getElementById("objectives-hud");

    const invClose = document.getElementById("inventory-close");
    const mapClose = document.getElementById("minimap-close");
    const objClose = document.getElementById("objectives-close");

    if (invToggle && mapToggle && objToggle && invHud && mapHud && objHud) {
      const hideOtherToggles = () => {};
      const showAllToggles = () => {};
      const closeAllHuds = () => {
        invHud.classList.remove("inventory-expanded");
        invHud.classList.add("inventory-collapsed");
        mapHud.classList.remove("minimap-expanded");
        mapHud.classList.add("minimap-collapsed");
        objHud.classList.remove("objectives-expanded");
        objHud.classList.add("objectives-collapsed");
      };

      const toggleHud = (hud, expandedClass, collapsedClass, srcBtn) => {
        const isExpanded = hud.classList.contains(expandedClass);
        if (isExpanded) {
          hud.classList.remove(expandedClass);
          hud.classList.add(collapsedClass);
          if (hud === invHud && invClose) invClose.style.display = "none";
        } else {
          closeAllHuds();
          hud.classList.remove(collapsedClass);
          hud.classList.add(expandedClass);
          hideOtherToggles();
          if (hud === invHud && invClose) invClose.style.display = "flex";
        }
      };

      invToggle.addEventListener("click", () => {
        toggleHud(
          invHud,
          "inventory-expanded",
          "inventory-collapsed",
          invToggle
        );
      });
      mapToggle.addEventListener("click", () => {
        toggleHud(mapHud, "minimap-expanded", "minimap-collapsed", mapToggle);
        try {
          if (mapHud.classList.contains("minimap-expanded")) initMinimap();
        } catch (_) {}
      });
      objToggle.addEventListener("click", () => {
        toggleHud(
          objHud,
          "objectives-expanded",
          "objectives-collapsed",
          objToggle
        );
      });

      if (invClose)
        invClose.addEventListener("click", () => {
          invHud.classList.remove("inventory-expanded");
          invHud.classList.add("inventory-collapsed");
          invClose.style.display = "none";
        });
      if (mapClose)
        mapClose.addEventListener("click", () => {
          mapHud.classList.remove("minimap-expanded");
          mapHud.classList.add("minimap-collapsed");
        });
      if (objClose)
        objClose.addEventListener("click", () => {
          objHud.classList.remove("objectives-expanded");
          objHud.classList.add("objectives-collapsed");
        });
    }
  } catch (e) {}
});

let scene;
let renderer;
let cameraManager;
let camera;
let controls;
let smokeEffect;
let audioManager;
let terrain,
  lighting,
  clock,
  skybox;
let minimapWidth = 340,
  minimapHeight = 249;
let worldBounds = { minX: -250, maxX: 100, minZ: -250, maxZ: 300 };
let minimapManager = null;
let modelLoader;
let farmerController;
let combatSystem;
let waveManager;
let waveStartAt = null;
let __globalPauseAt = null;
try {
  window.addEventListener("gamepause", () => {
    __globalPauseAt = Date.now();
  });
  window.addEventListener("gameresume", () => {
    try {
      if (__globalPauseAt) {
        const pausedMs = Date.now() - __globalPauseAt;
        if (waveStartAt) waveStartAt += pausedMs;
      }
    } catch (_) {}
    __globalPauseAt = null;
  });
} catch (_) {}
let waveCountdownEl = null;
let waveWarningEl = null;
let isFirstWaveCountdown = false;
let corral;
let spaceShuttle;
let shipRepair;
let cows = [];
let stones = [];
let crystals = [];
let alien2Statics = [];
try {
  window.alien2Statics = alien2Statics;
} catch (_) {}
let alien2CloneMixers = [];
try {
  window.alien2CloneMixers = alien2CloneMixers;
} catch (_) {}
let lightPosts = [];
try {
  window.lightPosts = lightPosts;
} catch (_) {}
let house;
const moveSpeed = 0.1;
const rotationSpeed = 0.05;
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

function checkAllCowsDead() {
  if (!cows || cows.length === 0) return false;

  const allDead = cows.every((cow) => cow.isDead);

  if (allDead) {
    showDeathScreen({
      title: "¡Todas las vacas han muerto!",
      subtitle: "Tu rebaño ha sido eliminado",
      buttonText: "Reiniciar",
    });

    if (window.pauseMenu) {
      window.pauseMenu.togglePause(true);
    }

    return true;
  }

  return false;
}

window.checkAllCowsDead = checkAllCowsDead;

function createCows() {
  window.checkAllCowsDead = checkAllCowsDead;

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

  window.cows = cows;
}

function initMinimap() {
  if (!minimapManager) {
    minimapManager = makeMinimap({
      width: minimapWidth,
      height: minimapHeight,
      worldBounds,
    });

    try {
      minimapManager.init("minimap-canvas");
      if (window._pendingBuildingsForMinimap) {
        try {
          minimapManager.setReferences({
            buildings: window._pendingBuildingsForMinimap,
          });
        } catch (_) {}
        window._pendingBuildingsForMinimap = null;
      }
    } catch (e) {
      return e;
    }
  }
}

function updateMinimap() {
  try {
    const enemyModels = [];
    try {
      const wm = window.waveManager || waveManager;
      if (wm && wm.activeEnemies) {
        for (const entry of wm.activeEnemies.values()) {
          if (!entry) continue;
          if (entry.instance && entry.instance.model)
            enemyModels.push(entry.instance.model);
          else if (entry.model) enemyModels.push(entry.model);
        }
      }
    } catch (e) {}

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
  } catch (e) {}
}

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

  window.stones = stones;
}

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

  try {
    window.crystals = crystals;
  } catch (_) {}
}

function createHouse() {
  house = new House(
    scene,
    { x: -23.5, y: 0.0, z: -5.0 },
    { width: 20, height: 8, depth: 15 }
  );

  window.house = house;
}

function createLightPosts() {
  const positions = [
    { x: -12.7, y: 0.0, z: 4.4 },
    { x: -7.8, y: 0.0, z: -48.9 },
    { x: 55.2, y: 0.0, z: -0.6 },
    { x: 31.8, y: 0.0, z: 35.6 },
    { x: -13.8, y: 0.0, z: 47.9 },
    { x: -84.2, y: 0.0, z: 33.2 },
    { x: -151.9, y: 0.0, z: 72.0 },
    { x: -101.0, y: 0.0, z: 86.8 },
    { x: -133.0, y: 0.0, z: 34.9 },
  ];

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
  try {
    window.lightPosts = lightPosts;
  } catch (_) {}
}

function createMarket() {
  smokeEffect = new SmokeEffect(scene, { x: 52.4, y: 0.0, z: -30.2 });

  const market = new Market(
    scene,
    { x: -155.8, y: 0.0, z: 53.3 },
    { width: 12, height: 6, depth: 8 }
  );

  window.market = market;
  return market;
}

function createShipRepair() {
  shipRepair = new ShipRepair(scene, { x: 39.9, y: 0.0, z: -21.1 }, 1.5);
  window.shipRepair = shipRepair;
}
async function createAlien2() {
  const alien2 = new Alien2(
    scene,
    modelLoader,
    { x: -52.5, y: 0.0, z: -159.7 },
    { x: -51.5, y: 0.0, z: -158.7 }
  );

  await alien2.load();
  window.alien2 = alien2;
  return alien2;
}
async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x5e5d5d, 100, 500);
  THREE.Cache.enabled = true;
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById("container").appendChild(renderer.domElement);
  cameraManager = new CameraManager(scene, {
    fov: 75,
    near: 0.5,
    far: 1400,
  });
  camera = cameraManager.getCamera();
  try {
    scene.userData = scene.userData || {};
    scene.userData.camera = camera;
  } catch (e) {}
  try {
    if (!window.audio) {
      audioManager = new AudioManager(camera);
      window.audio = audioManager;
    } else {
      audioManager = window.audio;
      try {
        if (camera && typeof camera.add === "function")
          camera.add(audioManager.listener);
      } catch (e) {}
    }
  } catch (e) {
    return e;
  }
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
          return e;
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
  try {
    window.showDeathScreen = showDeathScreen;
  } catch (e) {}
  terrain = new Terrain(scene, renderer);
  modelLoader = new ModelLoader(scene);
  if (!window.combatSystem) {
    try {
      window.combatSystem = new CombatSystem();
    } catch (e) {
      return e;
    }
  }
  combatSystem = window.combatSystem;
  corral = new Corral(
    scene,
    { x: 15, y: 0, z: 15 },
    { width: 20, height: 2, depth: 20 }
  );
  try {
    combatSystem = window.combatSystem || new CombatSystem();
    window.combatSystem = combatSystem;

    const corralAnchor = new THREE.Object3D();
    corralAnchor.position.set(
      corral.position.x,
      corral.position.y + 1,
      corral.position.z
    );
    scene.add(corralAnchor);
    window.corralAnchor = corralAnchor;

    const corralHealth = integrateEntityWithCombat(
      combatSystem,
      "corral",
      corralAnchor,
      500,
      { team: "ally" }
    );
    window.corralHealth = corralHealth;

    if (corral) {
      corral.healthComponent = corralHealth;
      corral.maxHealth = 500;
      corral.health = 500;
    }

    const spawnCorralHealthbar = () => {
      const createHud = () => {
        try {
          if (window.corralHealthBar) return;
          const hb = new HealthBar({
            id: "corral-healthbar",
            position: "top-left",
            x: 20,
            y: 56,
            width: 320,
            height: 24,
            label: "corral",
          });
          hb.attachTo(corralHealth, {
            position: "top-left",
            x: 20,
            y: 56,
            label: "corral",
          });
          window.corralHealthBar = hb;
        } catch (_) {}
      };

      try {
        if (window.playerHealthBar) {
          createHud();
        } else {
          const waitForPlayerHud = () => {
            try {
              if (window.playerHealthBar) {
                createHud();
              } else {
                setTimeout(waitForPlayerHud, 100);
              }
            } catch (_) {
              setTimeout(waitForPlayerHud, 100);
            }
          };
          waitForPlayerHud();
        }
      } catch (_) {
        createHud();
      }
    };

    try {
      if (window.__gameplayStarted) {
        spawnCorralHealthbar();
      } else {
        window.addEventListener("gameplaystart", spawnCorralHealthbar, {
          once: true,
        });
      }
    } catch (_) {
      spawnCorralHealthbar();
    }
  } catch (e) {}
  spaceShuttle = new SpaceShuttle(
    scene,
    { x: 50, y: 0, z: -30 },
    0.1
  );
  createCows();
  createStones();
  createCrystals();
  createHouse();
  try {
    createLightPosts();
  } catch (_) {}
  const alien2 = await createAlien2();
  window.alien2 = alien2;
  try {
  } catch (_) {}
  try {
    createAlien2Clones();
  } catch (_) {}
  alien2.startMovementSequence();
  const market = createMarket();
  try {
    minimapManager.setReferences({ market });
  } catch (e) {}
  window.market = market;
  createShipRepair();
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
  try {
    const buildingMgr = new BuildingManager(scene, {
      basePath: "src/models/characters/building/",
      terrain,
    });
    window.buildingMgr = buildingMgr;
    try {
      await buildingMgr.preloadDefaults();
    } catch (e) {
      return e;
    }

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

    try {
      const preferredPositions = {
        alienPyramid: { x: 23.4, y: 0.0, z: 198.5 },
        alienLab: { x: -137.3, y: 0.0, z: -145.4 },
        alienHouse: { x: -79.9, y: 0.0, z: -70.3 },
      };

      const placed = buildingMgr.placeOneOfEach(
        ["alienHouse", "alienLab", "alienPyramid"],
        worldBounds,
        avoidObjects,
        {
          clearance: 10,
          maxAttemptsPerPlacement: 400,
          positions: preferredPositions,
        }
      );
      window.placedBuildings = placed;
      try {
        const buildingRefs = buildingMgr.getAllStructures();
        if (minimapManager) {
          minimapManager.setReferences({ buildings: buildingRefs });
        } else {
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
          } catch (e) {
            return e;
          }

          if (corral) {
            farmerController.setCorral(corral);
          }

          if (spaceShuttle) {
            farmerController.setSpaceShuttle(spaceShuttle);
          }

          window.farmer = instance;
          window.farmerController = farmerController;
          window.corral = corral;

          try {
            combatSystem = window.combatSystem || new CombatSystem();
            window.combatSystem = combatSystem;

            waveManager = new WaveManager(
              scene,
              modelLoader,
              window.combatSystem,
              {
                getPlayer: () =>
                  window.farmerController
                    ? window.farmerController.model
                    : null,
                getCows: () => window.cows || [],
                getCorral: () => window.corral || corral,
                getStones: () => window.stones || stones || [],
                getMarket: () => window.market || market,
                getHouse: () => window.house || house,
                getSpaceShuttle: () => window.spaceShuttle || spaceShuttle,
                difficultyMode:
                  typeof window !== "undefined" && window.selectedDifficulty
                    ? window.selectedDifficulty
                    : "easy",
                spawnPoints: [],
                spawnRingMin: 100,
                spawnRingMax: 200,
                alienDetectionRange: 220,
                playerAggroRadius: 14,
                baseCount: 3,
                waveCount: 6,
              }
            );

            window.waveManager = waveManager;
            
            const scheduleWavesAfterStart = () => {
              try {
                
                if (waveStartAt) return;
                try {
                  createWaveWarningElement();
                } catch (e) {}
                isFirstWaveCountdown = true;
                waveStartAt = performance.now() + 60000;
                try {
                  createWaveCountdownElement();
                } catch (e) {}
              } catch (e) {
                return e;
              }
            };

            try {
              if (window.__gameplayStarted) {
                scheduleWavesAfterStart();
              } else {
                window.addEventListener(
                  "gameplaystart",
                  scheduleWavesAfterStart,
                  { once: true }
                );
              }
            } catch (_) {
              scheduleWavesAfterStart();
            }
          } catch (e) {
            return e;
          }

          if (farmerController && stones && stones.length > 0) {
            farmerController.setStones(stones);
          }
          if (farmerController && house) {
            farmerController.setHouse(house);
              }
          try {
            if (
              farmerController &&
              window.buildingMgr &&
              typeof window.buildingMgr.getColliders === "function"
            ) {
              const buildingColliders = window.buildingMgr.getColliders();
              farmerController.setBuildings(buildingColliders);
            }
          } catch (e) {}
          if (farmerController && cows && cows.length > 0) {
            farmerController.setCows(cows);
          }
          if (farmerController && market) {
            farmerController.setMarket(market);
          }
          if (farmerController && crystals && crystals.length > 0) {
            farmerController.setCrystals(crystals);
          }
          const availableAnims = Object.keys(instance.actions);
        }
      },
      farmerConfig
    );
  } catch (error) {
    return e;
  }
  setupEventListeners();
  if (window.inventory && farmerController) {
    window.inventory.onEquipChange = (slotIndex, toolName) => {
      try {
        if (toolName) {
          console.log(
            `Herramienta seleccionada: ${toolName} (slot ${slotIndex + 1})`
          );
        } else {
        }
      } catch (e) {
        return e;
      }
    };
  }
  initMinimap();
  initObjectives();
  animate();
}

function setupEventListeners() {
  window.addEventListener("resize", onWindowResize);
}
function createWaveCountdownElement() {
  if (waveCountdownEl) return waveCountdownEl;
  const el = document.createElement("div");
  el.id = "wave-countdown";
  el.style.position = "fixed";
  el.style.top = "12px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.padding = "8px 12px";
  el.style.background = "rgba(0,0,0,0.65)";
  el.style.color = "#fff";
  el.style.fontFamily = "Arial, sans-serif";
  el.style.fontSize = "18px";
  el.style.borderRadius = "6px";
  el.style.zIndex = "9999";
  el.style.pointerEvents = "none";
  el.style.opacity = "0.95";
  el.textContent = "Primera oleada: 1:00";
  document.body.appendChild(el);
  waveCountdownEl = el;
  return el;
}
function createWaveWarningElement() {
  if (waveWarningEl) return waveWarningEl;
  const el = document.createElement("div");
  el.id = "wave-warning";
  el.style.position = "fixed";
  el.style.top = "28%";
  el.style.left = "50%";
  el.style.transform = "translate(-50%, -50%)";
  el.style.maxWidth = "80%";
  el.style.padding = "16px 20px";
  el.style.background = "rgba(180,0,0,0.85)";
  el.style.color = "#fff";
  el.style.fontFamily = "Arial, sans-serif";
  el.style.fontSize = "20px";
  el.style.fontWeight = "700";
  el.style.border = "2px solid rgba(255,255,255,0.2)";
  el.style.borderRadius = "8px";
  el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.6)";
  el.style.textAlign = "center";
  el.style.zIndex = "10000";
  el.style.pointerEvents = "none";
  el.textContent =
    "Cuidado: los aliens comenzarán a atacar al rebaño. Debes defenderlas y escapar";
  document.body.appendChild(el);
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
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
window.showFinalScene = () => showFinalScene({ shipRepair, cameraManager });

function onWindowResize() {
  if (cameraManager) {
    cameraManager.onWindowResize();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastTime = 0;
const targetFPS = 60;
const frameTime = 1000 / targetFPS;
let minimapUpdateCounter = 0;
const minimapUpdateInterval = 20; 
let terrainUpdateCounter = 0;
const terrainUpdateInterval = 8; 
let skyboxUpdateCounter = 0;
const skyboxUpdateInterval = 6; 
let frameCounter = 0; 
let __perfFrames = 0;
let __perfAccumTime = 0;
let __currentFps = 60;
let __targetPixelRatio = 1.0;
let __maxShadowPosts = 3; 
let __lastShadowUpdateTick = 0;
let __shadowActive = false;

function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  const deltaTime = currentTime - lastTime;
  if (deltaTime < frameTime) return;
  lastTime = currentTime - (deltaTime % frameTime);

  const delta = Math.min(0.05, clock.getDelta()); 
  frameCounter++;
  __perfFrames++;
  __perfAccumTime += delta;
  if (__perfAccumTime >= 1.0) {
    __currentFps = __perfFrames / __perfAccumTime;
    __perfFrames = 0;
    __perfAccumTime = 0;
    if (__currentFps < 42) {
      __targetPixelRatio = Math.max(0.85, __targetPixelRatio - 0.1);
    } else if (__currentFps > 58) {
      __targetPixelRatio = Math.min(1.25, __targetPixelRatio + 0.05);
    }
    try {
      renderer.setPixelRatio(__targetPixelRatio);
    } catch (_) {}
    if (__currentFps < 45) __maxShadowPosts = 2;
    else if (__currentFps < 55) __maxShadowPosts = 3;
    else __maxShadowPosts = 4;
  }
  try {
    if (window.__gamePaused) {
      if (renderer && scene && camera) {
        try {
          renderer.render(scene, camera);
        } catch (e) {}
      }
      return;
    }
  } catch (_) {}

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
    try {
      if (window.alien2Statics && Array.isArray(window.alien2Statics)) {
        for (let i = 0; i < window.alien2Statics.length; i++) {
          const a = window.alien2Statics[i];
          if (a && typeof a.update === "function") a.update(delta);
        }
      }
    } catch (_) {}
    try {
      if (
        window.alien2CloneMixers &&
        Array.isArray(window.alien2CloneMixers) &&
        frameCounter % 2 === 0
      ) {
        for (let i = 0; i < window.alien2CloneMixers.length; i++) {
          const m = window.alien2CloneMixers[i];
          if (m && typeof m.update === "function") m.update(delta);
        }
      }
    } catch (_) {}
    try {
      if (waveStartAt && waveStartAt > 0) {
        const now = performance.now();
        const remainingMs = Math.max(0, waveStartAt - now);
        if (remainingMs > 0) {
          const remainingSec = Math.ceil(remainingMs / 1000);
          if (!waveCountdownEl) createWaveCountdownElement();
          if (waveCountdownEl)
            waveCountdownEl.textContent = `${
              isFirstWaveCountdown ? "Primera oleada" : "Siguiente oleada"
            }: ${formatTimeMMSS(remainingSec)}`;
        } else {
          try {
            if (
              waveManager &&
              typeof waveManager.start === "function" &&
              !waveManager._running
            ) {
              try {
                waveManager.start();
              } catch (e) {
                return e;
              }
            }
          } catch (_) {}
          if (waveCountdownEl && waveCountdownEl.parentElement)
            waveCountdownEl.parentElement.removeChild(waveCountdownEl);
          waveCountdownEl = null;
          waveStartAt = null;
          isFirstWaveCountdown = false;
        }
      }
    } catch (e) {}
    if (combatSystem && typeof combatSystem.update === "function") {
      try {
        combatSystem.update(delta);
      } catch (e) {
        return e;
      }
    }
    if (waveManager && typeof waveManager.update === "function") {
      try {
        waveManager.update(delta);
      } catch (e) {
        return e;
      }
    }
    if (corral && farmerController?.model) {
      corral.update(delta, farmerController.model.position);
    }

    if (house && farmerController?.model) {
      house.update(delta, farmerController.model.position);
    }
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => {
        if (spaceShuttle) {
          spaceShuttle.update(delta);
        }
      });
    }
    if ((frameCounter & 1) === 0) {
      for (let i = 0; i < cows.length; i++) {
        cows[i].update(delta);
      }
    } else {
      for (let i = 0; i < stones.length; i++) {
        stones[i].update(delta);
      }
    }
    if (window.market && farmerController?.model) {
      window.market.update(farmerController.model.position);
    }
    if (shipRepair && farmerController?.model) {
      shipRepair.update(farmerController.model.position);
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
    try {
      if (lighting && Array.isArray(lightPosts)) {
        const nf = Math.max(0, Math.min(1, lighting.nightFactor || 0));
        const factor = nf * nf;
        for (let i = 0; i < lightPosts.length; i++) {
          const lp = lightPosts[i];
          if (lp && typeof lp.setEnabled === "function") lp.setEnabled(factor);
        }
        const _should = __shadowActive ? factor > 0.08 : factor > 0.12;
        if (_should !== __shadowActive) __shadowActive = _should;
        if (__shadowActive && farmerController && farmerController.model) {
          const playerPos = farmerController.model.position;
          const entries = [];
          for (let i = 0; i < lightPosts.length; i++) {
            const lp = lightPosts[i];
            if (!lp || !lp.light || !lp.group) continue;
            const p = lp.group.position;
            const dx = p.x - playerPos.x;
            const dz = p.z - playerPos.z;
            const d2 = dx * dx + dz * dz;
            entries.push({ i, d2, lp });
          }
          entries.sort((a, b) => a.d2 - b.d2);
          const maxShadowLights = __maxShadowPosts; 
          if (frameCounter - __lastShadowUpdateTick >= 4) {
            for (let idx = 0; idx < entries.length; idx++) {
              const { lp } = entries[idx];
              if (!lp || !lp.light) continue;
              const enableShadow = idx < maxShadowLights;
              const size = enableShadow ? 1024 : 256;
              if (typeof lp.setShadow === "function") {
                try { lp.setShadow(enableShadow, size); } catch (_) {}
              } else {
                try { lp.light.castShadow = enableShadow; } catch (_) {}
                try {
                  lp.light.shadow.mapSize.width = size;
                  lp.light.shadow.mapSize.height = size;
                } catch (_) {}
              }
            }
            __lastShadowUpdateTick = frameCounter;
          }
        } else {
          for (let i = 0; i < lightPosts.length; i++) {
            const lp = lightPosts[i];
            if (!lp) continue;
            if (typeof lp.setShadow === "function") {
              try { lp.setShadow(false, 256); } catch (_) {}
            } else if (lp.light) {
              try { lp.light.castShadow = false; } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}
    if (smokeEffect && frameCounter % 3 === 0) {
      smokeEffect.update(delta);
    }
    if (minimapUpdateCounter++ >= minimapUpdateInterval * 2) {
      updateMinimap();
      minimapUpdateCounter = 0;
    }
    renderer.render(scene, camera);
  } catch (error) {
    return error;
  }
}
window.forceOpenMarketHUD = function () {
  if (window.market) {
    window.market.showMarketUI();
    return "HUD del mercado abierto forzosamente";
  } else {
    return "Error: No se encontró la instancia del mercado";
  }
};
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
window.THREE = THREE; 
window.scene = scene; 
window.camera = camera;
window.renderer = renderer;