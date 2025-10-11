import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
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
  }

  async load() {
    try {
      const alien2Config = modelConfig.characters.alien2;
      console.log("Configuración de alien2:", alien2Config);

      // Depuración: Verificar rutas
      console.log("Ruta del modelo:", modelConfig.getPath(alien2Config.model));
      console.log(
        "Ruta de animación idle:",
        modelConfig.getPath(alien2Config.animations.idle)
      );

      // Cargar el modelo
      this.model = await this.modelLoader.loadModel(
        modelConfig.getPath(alien2Config.model),
        alien2Config.animations,
        null,
        alien2Config
      );

      if (!this.model) {
        throw new Error("No se pudo cargar el modelo");
      }

      // Escalar el modelo
      this.model.scale.set(0.02, 0.02, 0.02);

      // Posicionar el modelo
      this.model.position.copy(this.position);

      // Configurar mixer para animaciones
      this.mixer = new THREE.AnimationMixer(this.model);

      // Reproducir animación idle
      this.playAnimation("idle");

      // Hacer que mire hacia la dirección especificada
      const targetPosition = new THREE.Vector3(
        this.lookAt.x,
        this.lookAt.y,
        this.lookAt.z
      );
      this.model.lookAt(targetPosition);

      // Agregar a la escena
      this.scene.add(this.model);

      console.log("Alien2 cargado correctamente");
      return this.model;
    } catch (error) {
      console.error("Error al cargar el modelo alien2:", error);
      return null;
    }
  }

  playAnimation(name) {
    if (!this.model.animations || !this.model.animations[name]) {
      console.warn(
        `La animación '${name}' no está disponible.`,
        "Animaciones disponibles:",
        this.model.animations ? Object.keys(this.model.animations) : "ninguna"
      );
      return;
    }

    // Detener la animación actual
    if (this.currentAction) {
      this.currentAction.stop();
    }

    // Reproducir la nueva animación
    const clip = this.model.animations[name];
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.reset();
    this.currentAction.setLoop(THREE.LoopRepeat);
    this.currentAction.play();
    console.log(`Reproduciendo animación: ${name}`);
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }
}
