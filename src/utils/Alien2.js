import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import modelConfig from "../config/modelConfig.js";

export class Alien2 {
  constructor(
    scene,
    modelLoader,
    position = { x: 0, y: 0, z: 0 },
    lookAt = { x: 0, y: 0, z: 0 }
  ) {
    this.scene = scene; // Escena de Three.js
    this.modelLoader = modelLoader; // Cargador de modelos
    this.position = position; // Posición inicial
    this.lookAt = lookAt; // Punto hacia donde mira
    this.model = null; // Modelo 3D
    this.mixer = null; // Mezclador de animaciones
    this.currentAction = null; // Animación actual
    this.animations = {}; // Diccionario de animaciones
  }

  async load() {
    try {
      const alien2Config = modelConfig.characters.alien2;
      console.log("Cargando configuración de Alien2:", alien2Config);

      // Cargar el modelo base
      const modelPath = modelConfig.getPath(alien2Config.model);
      console.log("Cargando modelo desde:", modelPath);

      // Cargar modelo base como promesa
      const model = await new Promise((resolve, reject) => {
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
      this.model = model;
      this.model.scale.set(0.02, 0.02, 0.02); // Ajustar escala
      this.model.position.copy(this.position); // Establecer posición
      this.model.animations = {}; // Inicializar diccionario de animaciones

      // Configurar el mezclador de animaciones
      this.mixer = new THREE.AnimationMixer(this.model);

      // Cargar animaciones
      await this.loadAnimation(
        "idle",
        modelConfig.getPath(alien2Config.animations.idle)
      );
      await this.loadAnimation(
        "walk",
        modelConfig.getPath(alien2Config.animations.walk)
      );

      // Hacer que el modelo mire hacia la posición objetivo
      const targetPosition = new THREE.Vector3(
        this.lookAt.x,
        this.lookAt.y,
        this.lookAt.z
      );
      this.model.lookAt(targetPosition);

      // Agregar el modelo a la escena
      this.scene.add(this.model);

      // Reproducir animación de reposo
      this.playAnimation("idle");

      console.log("Alien2 cargado exitosamente");
      return this.model;
    } catch (error) {
      console.error("Error cargando Alien2:", error);
      return null;
    }
  }

  async loadAnimation(name, path) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(
        path,
        (anim) => {
          console.log(`Animación '${name}' cargada:`, anim);
          if (anim.animations && anim.animations.length > 0) {
            console.log(
              `Se encontraron ${anim.animations.length} animaciones en ${name}.fbx`
            );
            const clip = anim.animations[0];
            clip.name = name; // Forzar el nombre de la animación
            this.animations[name] = clip;
            console.log(`Animación '${name}' registrada correctamente`);
            resolve();
          } else {
            console.warn(
              `No se encontraron animaciones en el archivo ${name}.fbx`
            );
            resolve();
          }
        },
        undefined,
        (error) => {
          console.error(`Error cargando la animación '${name}':`, error);
          reject(error);
        }
      );
    });
  }

  playAnimation(name) {
    console.log(`Intentando reproducir animación: ${name}`);
    console.log("Animaciones disponibles:", Object.keys(this.animations));

    if (!this.animations[name]) {
      console.error(
        `La animación '${name}' no está disponible. Animaciones cargadas:`,
        Object.keys(this.animations)
      );
      return false;
    }

    try {
      // Detener la animación actual con desvanecimiento
      if (this.currentAction) {
        console.log(
          `Deteniendo animación actual: ${this.currentAction.getClip().name}`
        );
        this.currentAction.fadeOut(0.2);
      }

      // Reproducir la nueva animación
      const clip = this.animations[name];
      console.log(`Creando acción para el clip:`, clip);

      this.currentAction = this.mixer.clipAction(clip);
      if (!this.currentAction) {
        console.error("No se pudo crear la acción para el clip:", clip);
        return false;
      }

      console.log("Configurando acción...");
      this.currentAction.reset();
      this.currentAction.setEffectiveTimeScale(1);
      this.currentAction.setEffectiveWeight(1);
      this.currentAction.fadeIn(0.2);
      this.currentAction.play();

      console.log(`Reproduciendo animación: ${name}`);
      return true;
    } catch (error) {
      console.error(`Error reproduciendo animación '${name}':`, error);
      return false;
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  // Método de depuración para verificar el estado de las animaciones
  logAnimationState() {
    console.log("Animaciones cargadas:", Object.keys(this.animations));
    if (this.currentAction) {
      console.log(
        "Reproduciendo animación:",
        this.currentAction.getClip().name
      );
    } else {
      console.log("No hay ninguna animación reproduciéndose actualmente");
    }
  }
}

// Hacer la función de depuración disponible globalmente
window.debugAlien2 = function () {
  if (window.alien2) {
    window.alien2.logAnimationState();
  } else {
    console.warn("Alien2 no encontrado en window.alien2");
  }
};
