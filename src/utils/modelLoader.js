import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/SkeletonUtils.js";

export class ModelLoader {
  constructor(scene) {
    this.scene = scene;
    this.mixer = null;
    this.model = null;
    this.animations = [];
    this.actions = {};
    this.activeAction = null;
    this.animationLoader = new FBXLoader();
    this.modelLoader = new FBXLoader();
  }

  async load(modelPath, animationConfig = {}, onLoad) {
    try {
      // Cargar el modelo principal
      const model = await this.loadModel(modelPath);
      this.model = model;

      // Ajustar la escala y posición del modelo
      this.setupModel();

      // Inicializar el mixer de animaciones
      this.mixer = new THREE.AnimationMixer(this.model);

      // Cargar animaciones si se proporciona la configuración
      if (Object.keys(animationConfig).length > 0) {
        await this.loadAnimations(animationConfig);
      } else if (model.animations && model.animations.length > 0) {
        // Si el modelo tiene animaciones integradas
        this.setupDefaultAnimations(model.animations);
      }

      // Iniciar la animación por defecto
      this.play("idle");

      // Agregar el modelo a la escena
      this.scene.add(this.model);

      if (onLoad) onLoad(this);
      return this;
    } catch (error) {
      console.error("Error loading model:", error);
      throw error;
    }
  }

  async loadModel(path) {
    return new Promise((resolve, reject) => {
      this.modelLoader.load(
        path,
        (model) => resolve(model),
        undefined,
        (error) => reject(error)
      );
    });
  }

  setupModel() {
    // Calcular el bounding box para obtener las dimensiones
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Calcular la escala para que el modelo tenga una altura de 1.8 unidades
    const targetHeight = 1.8;
    const scaleFactor = targetHeight / size.y;
    this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Recalcular el bounding box después de escalar
    box.setFromObject(this.model);
    box.getSize(size);

    // Obtener el punto más bajo del modelo y posicionarlo en Y=0
    const minY = box.min.y;
    this.model.position.y = -minY;

    // Asegurar que el modelo esté orientado correctamente
    this.model.rotation.set(0, 0, 0);
  }

  async loadAnimations(animationConfig) {
    const animationPromises = [];

    // Cargar cada animación definida en la configuración
    for (const [name, path] of Object.entries(animationConfig)) {
      if (!path) continue;

      const promise = new Promise((resolve) => {
        this.animationLoader.load(
          path,
          (animModel) => {
            // Si el modelo cargado tiene animaciones, agregarlas al array
            if (animModel.animations && animModel.animations.length > 0) {
              // Usar la primera animación del modelo cargado
              const clip = animModel.animations[0];

              // Crear un nuevo clip con el nombre de la acción
              const newClip = clip.clone();
              newClip.name = name;
              this.animations.push(newClip);

              // Crear la acción y configurarla
              const action = this.mixer.clipAction(newClip, this.model);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.clampWhenFinished = true;
              this.actions[name] = action;

              console.log(`Loaded animation: ${name}`);
            }
            resolve();
          },
          undefined,
          (error) => {
            console.warn(`Error loading animation ${name}:`, error);
            resolve();
          }
        );
      });

      animationPromises.push(promise);
    }

    // Esperar a que todas las animaciones se carguen
    await Promise.all(animationPromises);

    // Si no se cargaron animaciones, intentar usar las del modelo principal
    if (
      this.animations.length === 0 &&
      this.model.animations &&
      this.model.animations.length > 0
    ) {
      this.setupDefaultAnimations(this.model.animations);
    }
  }

  setupDefaultAnimations(animations) {
    console.log(`Found ${animations.length} animations in the model`);

    animations.forEach((clip, index) => {
      console.log(`Animation ${index}:`, clip.name);

      // Intentar determinar el tipo de animación basado en el nombre
      let animName = clip.name.toLowerCase();
      let actionName = "idle";

      if (animName.includes("idle")) {
        actionName = "idle";
      } else if (animName.includes("walk") || animName.includes("caminar")) {
        actionName = "walk";
      } else if (animName.includes("run") || animName.includes("correr")) {
        actionName = "run";
      } else if (animName.includes("jump") || animName.includes("saltar")) {
        actionName = "jump";
      } else if (index === 0) {
        actionName = "idle";
      }

      // Crear la acción y configurarla
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = true;
      this.actions[actionName] = action;

      console.log(`Mapped animation "${clip.name}" to action "${actionName}"`);
    });
  }

  play(name, transitionTime = 0.2) {
    // Verificar si la animación solicitada existe
    if (!this.actions[name]) {
      // Si la animación no existe, intentar con 'idle' o 'walk' como respaldo
      const fallbackName = name === "run" ? "walk" : "idle";
      if (this.actions[fallbackName] && name !== fallbackName) {
        console.warn(
          `Animación "${name}" no encontrada. Usando "${fallbackName}" como respaldo.`
        );
        return this.play(fallbackName, transitionTime);
      }
      console.warn(
        `Animación "${name}" no encontrada. Animaciones disponibles:`,
        Object.keys(this.actions)
      );
      return false;
    }

    // No hacer nada si ya se está reproduciendo esta animación
    if (this.activeAction === this.actions[name]) {
      return false;
    }

    // Obtener la acción actual y la nueva acción
    const oldAction = this.activeAction;
    const newAction = this.actions[name];

    // Ajustar el tiempo de transición según el tipo de animación
    let actualTransitionTime = transitionTime;
    const isToIdle = name === "idle";
    const isFromIdle = oldAction === this.actions["idle"];

    // Transiciones más rápidas entre movimientos similares
    if (
      (name === "walk" || name === "run") &&
      (oldAction === this.actions["walk"] || oldAction === this.actions["run"])
    ) {
      actualTransitionTime = 0.1;
    }
    // Transición más suave al detenerse
    else if (isToIdle) {
      actualTransitionTime = 0.15;
    }
    // Transición más rápida al comenzar a moverse
    else if (isFromIdle) {
      actualTransitionTime = 0.15;
    }

    // Configurar la nueva acción
    newAction.reset();
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1);
    newAction.clampWhenFinished = true;
    newAction.enabled = true;

    // Reproducir la nueva acción
    newAction.play();

    // Si hay una acción anterior, hacer crossfade
    if (oldAction) {
      // Configurar el crossfade
      oldAction.crossFadeTo(newAction, actualTransitionTime, true);

      // Detener la animación anterior después del crossfade
      setTimeout(() => {
        if (oldAction !== this.activeAction) {
          oldAction.stop();
        }
      }, actualTransitionTime * 1000);
    }

    // Actualizar la acción activa
    this.activeAction = newAction;
    console.log(`Animación "${name}" iniciada correctamente`);
    return true;
  }

  // Método para detener la animación actual
  stop() {
    if (this.activeAction) {
      this.activeAction.stop();
      this.activeAction = null;
    }
  }

  // Método para pausar/reanudar la animación actual
  setPaused(paused) {
    if (this.mixer) {
      this.mixer.timeScale = paused ? 0 : 1;
    }
  }

  update(delta) {
    if (this.mixer) {
      // Limitar el delta para evitar saltos grandes
      const cappedDelta = Math.min(delta, 0.033); // Máximo 30 FPS para cálculos de animación
      this.mixer.update(cappedDelta);
    }
  }
}
