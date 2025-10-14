import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import * as BufferGeometryUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/BufferGeometryUtils.js";
import modelConfig from "../config/modelConfig.js";

export class Alien2 {
  constructor(
    scene,
    modelLoader,
    position = { x: 0, y: 0, z: 0 },
    lookAt = { x: 0, y: 0, z: 0 }
  ) {
    this.scene = scene;
    this.modelLoader = modelLoader;
    this.position = position;
    this.lookAt = lookAt;
    this.model = null;
    this.mixer = null;
    this.currentAction = null;
    this.animations = {};
  }

  async load() {
    try {
      const alien2Config = modelConfig.characters.alien2;
      console.log("Cargando configuración de Alien2:", alien2Config);

      // Cargar el modelo base (sin animaciones)
      const modelPath = modelConfig.getPath(alien2Config.model);
      console.log("Cargando modelo base desde:", modelPath);

      // Cargar modelo base como promesa
      this.model = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          modelPath,
          (fbx) => {
            console.log("Modelo base cargado exitosamente");
            resolve(fbx);
          },
          undefined,
          (error) => {
            console.error("Error cargando el modelo base:", error);
            reject(error);
          }
        );
      });

      // Configurar el modelo
      this.model.scale.set(0.02, 0.02, 0.02);
      this.model.position.copy(this.position);

      // Configurar el mezclador de animaciones
      this.mixer = new THREE.AnimationMixer(this.model);

      // Cargar la animación idle por separado
      const idlePath = modelConfig.getPath(alien2Config.animations.idle);
      console.log("Cargando animación idle desde:", idlePath);
      
      const idleLoaded = await this.loadAnimation("idle", idlePath);
      if (idleLoaded) {
        console.log("Animación idle cargada exitosamente");
        // Esperar un frame antes de reproducir la animación
        setTimeout(() => {
          this.playAnimation("idle");
        }, 100);
      } else {
        console.warn("No se pudo cargar la animación idle");
      }

      // Verificar si el modelo base tiene animaciones incluidas
      if (this.model.animations && this.model.animations.length > 0) {
        console.log("Modelo base tiene animaciones incluidas:", this.model.animations.length);
        this.model.animations.forEach((anim, index) => {
          console.log(`  Animación ${index}: ${anim.name} (${anim.duration}s)`);
        });
        
        // Si hay animaciones en el modelo base, usar la primera como idle
        const baseIdleClip = this.model.animations[0];
        this.animations.baseIdle = baseIdleClip;
        console.log("Usando animación del modelo base como respaldo");
        
        // Intentar reproducir la animación del modelo base si la externa falla
        setTimeout(() => {
          if (!this.currentAction || !this.currentAction.isRunning()) {
            console.log("Intentando usar animación del modelo base...");
            this.playAnimation("baseIdle");
          }
        }, 500);
      }

      // Hacer que el modelo mire hacia la posición objetivo
      const targetPosition = new THREE.Vector3(
        this.lookAt.x,
        this.model.position.y,
        this.lookAt.z
      );
      this.model.lookAt(targetPosition);

      // Optimizar el modelo para mejor rendimiento
      this.optimizeForPerformance();

      // Agregar el modelo a la escena
      this.scene.add(this.model);

      console.log("Alien2 cargado y configurado correctamente");
      return true;
    } catch (error) {
      console.error("Error al cargar el Alien2:", error);
      return false;
    }
  }

  optimizeForPerformance() {
    if (!this.model) return;

    // Reducir la calidad de sombras
    this.model.traverse((child) => {
      if (child.isMesh) {
        // Optimizar geometrías
        if (child.geometry) {
          child.geometry.computeVertexNormals();

          // Reducir la calidad de las sombras
          child.castShadow = true;
          child.receiveShadow = true;

          // Reducir la calidad de las mallas
          if (
            child.geometry.attributes.position &&
            child.geometry.attributes.position.count > 5000
          ) {
            try {
              const ratio = Math.min(
                1,
                5000 / child.geometry.attributes.position.count
              );
              const simplifiedGeometry = BufferGeometryUtils.mergeVertices(
                child.geometry,
                0.01 * ratio
              );
              child.geometry.dispose(); // Liberar memoria de la geometría anterior
              child.geometry = simplifiedGeometry;
            } catch (error) {
              console.warn("No se pudo simplificar la geometría:", error);
            }
          }
        }

        // Optimizar materiales
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => this.optimizeMaterial(mat));
          } else {
            this.optimizeMaterial(child.material);
          }
        }
      }
    });

    console.log("Optimizaciones de rendimiento aplicadas al modelo Alien2");
  }

  optimizeMaterial(material) {
    // Reducir la calidad de los materiales para mejor rendimiento
    material.precision = "mediump";
    material.shininess = 0;
    material.roughness = 1;
    material.metalness = 0;

    // Desactivar características costosas
    if (material.map) material.map.anisotropy = 1;
    if (material.normalMap) material.normalScale.set(0.5, 0.5);
    if (material.bumpMap) material.bumpScale = 0.5;

    // Usar sombras más simples
    material.shadowSide = THREE.FrontSide;
  }

  async loadAnimation(name, path) {
    try {
      const anim = await new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(
          path,
          (fbx) => {
            if (fbx.animations.length > 0) {
              console.log(`Animación '${name}' cargada correctamente`);
              resolve(fbx.animations[0]);
            } else {
              reject(new Error(`No se encontraron animaciones en ${path}`));
            }
          },
          undefined,
          (error) => {
            console.error(`Error cargando la animación '${name}':`, error);
            reject(error);
          }
        );
      });

      this.animations[name] = anim;
      return true;
    } catch (error) {
      console.error(`Error al cargar la animación '${name}':`, error);
      return false;
    }
  }

  playAnimation(name) {
    if (!this.animations[name] || !this.mixer) {
      console.warn(
        `Animación '${name}' no disponible o mezclador no inicializado`
      );
      return false;
    }

    // Evitar reiniciar la misma animación
    if (
      this.currentAction &&
      this.currentAction.getClip()?.name === this.animations[name].name &&
      this.currentAction.isRunning()
    ) {
      return true;
    }

    try {
      // Detener animación actual con fade out suave
      if (this.currentAction) {
        this.currentAction.fadeOut(0.1);
      }

      // Crear y configurar la nueva acción
      const clip = this.animations[name];
      const action = this.mixer.clipAction(clip);

      if (!action) {
        console.error("No se pudo crear la acción para el clip:", clip);
        return false;
      }

      // Configuración óptima para la animación
      action
        .reset()
        .setEffectiveTimeScale(1.0)
        .setEffectiveWeight(1.0)
        .setLoop(THREE.LoopRepeat, Infinity)
        .fadeIn(0.1)
        .play();

      this.currentAction = action;
      console.log(`Animación '${name}' iniciada correctamente`);
      
      // Forzar la actualización del mixer para aplicar la animación inmediatamente
      if (this.mixer) {
        this.mixer.update(0.016); // Actualizar con un delta pequeño
      }
      
      // Verificar que la animación se está reproduciendo
      setTimeout(() => {
        if (this.currentAction && this.currentAction.isRunning()) {
          console.log(`✅ Animación '${name}' confirmada como activa`);
        } else {
          console.warn(`⚠️ Animación '${name}' no se está reproduciendo`);
          // Intentar forzar la animación
          if (this.currentAction) {
            this.currentAction.reset().play();
            console.log("Intentando forzar la animación...");
          }
        }
      }, 200);
      
      return true;
    } catch (error) {
      console.error(`Error al reproducir animación '${name}':`, error);
      return false;
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  // Método para forzar la aplicación de la animación
  forceAnimation() {
    if (this.currentAction && this.mixer) {
      console.log("Forzando aplicación de animación...");
      this.currentAction.reset();
      this.currentAction.play();
      this.mixer.update(0.1);
      console.log("Animación forzada aplicada");
    }
  }

  // Método para verificar el esqueleto del modelo
  checkSkeleton() {
    if (!this.model) {
      console.log("Modelo no cargado");
      return;
    }

    console.log("=== VERIFICACIÓN DEL ESQUELETO ===");
    let skeletonFound = false;
    
    this.model.traverse((child) => {
      if (child.isBone || child.type === 'Bone') {
        skeletonFound = true;
        console.log("Hueso encontrado:", child.name, child.type);
      }
      if (child.isSkinnedMesh) {
        console.log("Malla con esqueleto encontrada:", child.name);
        if (child.skeleton) {
          console.log("Esqueleto de la malla:", child.skeleton.bones.length, "huesos");
        }
      }
    });

    if (!skeletonFound) {
      console.warn("⚠️ No se encontró esqueleto en el modelo");
    } else {
      console.log("✅ Esqueleto encontrado en el modelo");
    }
    console.log("================================");
  }

  // Método de depuración para verificar el estado de las animaciones
  logAnimationState() {
    console.log("=== ESTADO DE ANIMACIONES ALIEN2 ===");
    console.log("Modelo cargado:", !!this.model);
    console.log("Mixer inicializado:", !!this.mixer);
    console.log("Animaciones cargadas:", Object.keys(this.animations));
    
    if (this.currentAction) {
      console.log("Reproduciendo animación:", this.currentAction.getClip().name);
      console.log("Animación activa:", this.currentAction.isRunning());
      console.log("Peso de la animación:", this.currentAction.getEffectiveWeight());
    } else {
      console.log("No hay ninguna animación reproduciéndose actualmente");
    }
    
    // Verificar si el modelo tiene animaciones incluidas
    if (this.model && this.model.animations) {
      console.log("Animaciones incluidas en el modelo:", this.model.animations.length);
      this.model.animations.forEach((anim, index) => {
        console.log(`  ${index}: ${anim.name} (${anim.duration}s)`);
      });
    }
    console.log("=====================================");
  }
}

// Hacer las funciones de depuración disponibles globalmente
window.debugAlien2 = function () {
  if (window.alien2) {
    window.alien2.logAnimationState();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.forceAlien2Animation = function () {
  if (window.alien2) {
    window.alien2.forceAnimation();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};

window.checkAlien2Skeleton = function () {
  if (window.alien2) {
    window.alien2.checkSkeleton();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};
