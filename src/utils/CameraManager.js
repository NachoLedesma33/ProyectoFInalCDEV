import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { ControlsManager } from "./controls.js";


export class CameraManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = {
      // fov ya no se usa para ortográfica, pero lo dejamos por compatibilidad si cambia a perspectiva
      fov: 75,
      near: 0.1,           // reducido para evitar recortes de primer plano
      far: 5000,           // aumentado para cubrir skybox/escena lejana
      frustumSize: 60,     // valor por defecto más amplio
      renderer: null,
      ...options,
    };

    // Guardar renderer opcional para redimensionar
    this.renderer = this.options.renderer || null;

    const aspect = window.innerWidth / window.innerHeight;
    this.frustumSize = this.options.frustumSize;

    // Crear cámara ortográfica correctamente (left, right, top, bottom según frustumSize y aspect)
    const halfWidth = (this.frustumSize * aspect) / 2;
    const halfHeight = this.frustumSize / 2;

    this.camera = new THREE.OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfHeight,
      -halfHeight,
      this.options.near,
      this.options.far
    );

    // Posición y orientación isométrica inicial:
    const isoAngle = Math.atan(Math.sqrt(2)); // ~35.264°
    const distance = this.options.distance || 120;
    this._isoOffset = new THREE.Vector3(distance, distance, distance);
    this.camera.position.copy(this._isoOffset);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = Math.PI / 4;
    this.camera.rotation.x = -isoAngle;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Inicializar controles de cámara
    this.controls = null;

    // Seguimiento explícito (si se quiere que la cámara siga al jugador)
    this.followTarget = null;
    this.followLag = 0.08; // suavizado de seguimiento (0 = instantáneo)

    // Configuración de la cámara
    this.setupCamera();

    // Listener para redimensionar
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Configura la cámara con valores iniciales (para ortográfica)
   */
  setupCamera() {
    // Para cámara ortográfica no tocar fov/aspect; usar frustumSize
    const aspect = window.innerWidth / window.innerHeight;
    const halfWidth = (this.frustumSize * aspect) / 2;
    const halfHeight = this.frustumSize / 2;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;

    this.camera.near = this.options.near;
    this.camera.far = this.options.far;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Actualiza la cámara cuando cambia el tamaño de la ventana
   */
  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const halfWidth = (this.frustumSize * aspect) / 2;
    const halfHeight = this.frustumSize / 2;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();

    // Si tenemos renderer, redimensionarlo también para que el canvas cubra toda la pantalla
    if (this.renderer && typeof this.renderer.setSize === 'function') {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      // asegurar clear correcto
      if (typeof this.renderer.setClearColor === 'function' && this.renderer.domElement) {
        this.renderer.autoClear = true;
      }
    }

    if (this.controls && typeof this.controls.handleResize === 'function') {
      this.controls.handleResize();
    }
  }

  /**
   * Permite registrar (o cambiar) el renderer después de crear la instancia
   */
  setRenderer(renderer) {
    this.renderer = renderer;
    // ajustar tamaño inicial inmediatamente
    if (this.renderer && typeof this.renderer.setSize === 'function') {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.autoClear = true;
    }
    // también recalcular proyección por si cambió el tamaño del canvas
    this.onWindowResize();
  }

  /**
   * Configura los controles de la cámara para vista isométrica
   * @param {HTMLElement} domElement - Elemento del DOM para los controles
   */
  setupControls(domElement) {
    if (!this.controls) {
      // Pasar configuración isométrica al ControlsManager
      this.controls = new ControlsManager(this.camera, {
        domElement,
        isometric: true,
      });
      // opcional: deshabilitar pans/zooms extremos si ControlsManager expone opciones
      if (this.controls.setLimits) {
        try { this.controls.setLimits({ minDistance: 10, maxDistance: 1000 }); } catch(e) {}
      }
    }
  }

  /**
   * Establece objetivo a seguir (sobrescribe la posición impuesta por los controles)
   * @param {THREE.Object3D} target
   * @param {{distance?, frustumSize?, lag?}} opts
   */
  setFollow(target, opts = {}) {
    this.followTarget = target || null;
    if (opts.distance !== undefined) {
      const d = opts.distance;
      this._isoOffset.set(d, d, d);
    }
    if (opts.frustumSize !== undefined) {
      this.frustumSize = opts.frustumSize;
      this.onWindowResize(); // recalcula proyección
    }
    if (opts.lag !== undefined) this.followLag = opts.lag;
  }

  /**
   * Actualiza la cámara en cada fotograma
   * @param {number} delta - Tiempo transcurrido desde el último fotograma
   */
  update(delta) {
    // actualiza controles (si existen)
    if (this.controls) {
      this.controls.update(delta);
    }

    // seguimiento explícito que sobrescribe pequeñas modificaciones de los controles
    if (this.followTarget) {
      const targetPos = new THREE.Vector3();
      this.followTarget.getWorldPosition(targetPos);

      const desired = targetPos.clone().add(this._isoOffset);

      // suavizado (frame-rate independiente aproximado)
      const t = Math.min(1, this.followLag * (delta * 60 || 1));
      this.camera.position.lerp(desired, t);

      // Asegurar que la cámara mira siempre al objetivo
      this.camera.lookAt(targetPos);
    }
  }

  setTarget(target, offset = new THREE.Vector3(0, 2, -2)) {
    if (this.controls) {
      this.controls.setTarget(target, offset);
    } else {
      // Configuración básica de seguimiento si no hay controles
      this.camera.position.copy(target.position).add(offset);
      this.camera.lookAt(target.position);
    }
    // También activar seguimiento explícito por si controles cambian la cámara luego
    this.setFollow(target);
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
