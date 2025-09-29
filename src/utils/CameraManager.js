import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { ControlsManager } from "./controls.js";

/**
 * Clase para gestionar la cámara y sus comportamientos
 */
export class CameraManager {
  /**
   * Crea una instancia de CameraManager
   * @param {THREE.Scene} scene - Escena de Three.js
   * @param {Object} options - Opciones de configuración de la cámara
   * @param {number} [options.fov=75] - Campo de visión en grados
   * @param {number} [options.near=0.5] - Plano cercano de recorte
   * @param {number} [options.far=2000] - Plano lejano de recorte
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = {
      fov: 75,
      near: 0.5,
      far: 2000,
      ...options,
    };
    // Crear cámara
    this.camera = this.createCamera();

    // Inicializar controles de cámara
    this.controls = null;

    // Configuración de la cámara
    this.setupCamera();
  }

  /**
   * Crea una cámara perspectiva con vista isométrica
   * @returns {THREE.PerspectiveCamera} - Instancia de la cámara
   */
  createCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(
      this.options.fov,
      aspect,
      this.options.near,
      this.options.far
    );

    // Configuración isométrica - ángulo fijo de 45 grados en ambos ejes
    const distance = 50; // Distancia inicial de la cámara (lejos para iniciar la animación de zoom)
    const angle = Math.PI / 4; // 45 grados
    
    // Posición isométrica: 45 grados en XY y 45 grados en XZ
    camera.position.set(
      distance * Math.cos(angle), // X
      distance * Math.sin(angle), // Y (altura)
      distance * Math.cos(angle)  // Z
    );
    
    // Mirar al centro del mundo
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Configura la cámara con valores iniciales
   */
  setupCamera() {
    // Aplicar configuración adicional
    this.camera.fov = this.options.fov;
    this.camera.updateProjectionMatrix();

    // Configuración de planos de recorte
    this.camera.near = this.options.near;
    this.camera.far = this.options.far;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Actualiza la cámara cuando cambia el tamaño de la ventana
   */
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.handleResize();
    }
  }

  /**
   * Configura los controles de la cámara para vista isométrica
   * @param {HTMLElement} domElement - Elemento del DOM para los controles
   */
  setupControls(domElement) {
    if (!this.controls) {
      // Pasar configuración isométrica al ControlsManager
      this.controls = new ControlsManager(this.camera, { domElement, isometric: true });

      console.log("Controles de cámara isométrica configurados");
    }
  }

  /**
   * Actualiza la cámara en cada fotograma
   * @param {number} delta - Tiempo transcurrido desde el último fotograma
   */
  update(delta) {
    if (this.controls) {
      this.controls.update(delta);
    }
  }

  /**
   * Establece el objetivo que la cámara debe seguir
   * @param {THREE.Object3D} target - Objeto a seguir
   * @param {THREE.Vector3} [offset] - Desplazamiento de la cámara respecto al objetivo
   */
  setTarget(target, offset = new THREE.Vector3(0, 2, -2)) {
    if (this.controls) {
      this.controls.setTarget(target, offset);
    } else {
      // Configuración básica de seguimiento si no hay controles
      this.camera.position.copy(target.position).add(offset);
      this.camera.lookAt(target.position);
    }
  }

  /**
   * Obtiene la instancia de la cámara
   * @returns {THREE.PerspectiveCamera} - Instancia de la cámara
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Obtiene los controles de la cámara
   * @returns {Object|null} - Controles de la cámora o null si no están configurados
   */
  getControls() {
    return this.controls ? this.controls.controls : null;
  }
}

export default CameraManager;
