import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js";

export class ControlsManager {
  constructor(camera, options = {}) {
    this.camera = camera;
    this.target = null;
    this.controls = null;
    this.isometric = options.isometric || true; // Forzar modo isométrico
    this.domElement = options.domElement;

    // Configuración para vista isométrica con seguimiento
    if (this.isometric) {
      // Configuración isométrica
      this.baseDistance = 15; // Reducido de 30
      this.minDistance = 8;   // Reducido de 15
      this.maxDistance = 40;  // Reducido de 80
      this.smoothness = 0.05;
      this.currentLookAt = new THREE.Vector3(0, 0, 0);
      this.currentDistance = 40; // Ajustado al nuevo maxDistance
      this.targetDistance = this.baseDistance;
      this.zoomAnimationDuration = 3.0;
      this.zoomAnimationStartTime = Date.now();
      this.isZoomAnimating = true;
      this.autoZoomEnabled = true;
      this.lastTargetPosition = new THREE.Vector3();
      this.targetVelocity = new THREE.Vector3();
    } else {
      // Configuración original para tercera persona
      this.offset = new THREE.Vector3(0, 2, 5);
      this.currentLookAt = new THREE.Vector3();
      this.cameraOffset = new THREE.Vector3(0, 2.5, -5);
      this.smoothness = 0.1;
    }

    this.init();
  }

  init() {
    if (this.isometric) {
      // Para vista isométrica, configuramos controles básicos
      this.setupZoomControls();
      this.updateIsometricPosition();
    } else {
      // Configurar controles de órbita para rotación de cámara (modo original)
      this.controls = new OrbitControls(this.camera, this.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enablePan = false;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
      this.controls.minDistance = 2;
      this.controls.maxDistance = 10;
      this.controls.autoRotate = false;

      // Inicializar la posición de la cámara
      if (this.target) {
        this.updateCameraPosition();
      }
    }
  }

  setTarget(target, offset = null) {
    this.target = target;
    if (target) {
      if (this.isometric) {
        this.updateIsometricPosition();
      } else {
        this.updateCameraPosition();
      }
    }
  }

  updateCameraPosition() {
    if (!this.target) return;

    // Límites del terreno (deben coincidir con los del FarmerController)
    const bounds = {
      minX: -250,
      maxX: 250,
      minZ: -250,
      maxZ: 250,
    };
    const cameraMargin = 50; // Margen para evitar que la cámara se acerque demasiado al borde

    // Obtener la posición objetivo de la cámara
    const targetPosition = new THREE.Vector3();
    targetPosition.copy(this.target.position);

    // Aplicar offset basado en la rotación del objetivo
    const offset = this.cameraOffset.clone();

    // Rotar el offset basado en la rotación Y del objetivo
    const angle = this.target.rotation.y;
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);

    let rotatedX = offset.x * cosAngle - offset.z * sinAngle;
    let rotatedZ = offset.x * sinAngle + offset.z * cosAngle;

    // Calcular la posición objetivo de la cámara
    let newCamX = targetPosition.x + rotatedX;
    let newCamZ = targetPosition.z + rotatedZ;

    // Ajustar la posición de la cámara para que no se salga de los límites
    if (newCamX > bounds.maxX - cameraMargin) {
      const diff = bounds.maxX - cameraMargin - newCamX;
      rotatedX += diff;
      newCamX = bounds.maxX - cameraMargin;
    } else if (newCamX < bounds.minX + cameraMargin) {
      const diff = bounds.minX + cameraMargin - newCamX;
      rotatedX += diff;
      newCamX = bounds.minX + cameraMargin;
    }

    if (newCamZ > bounds.maxZ - cameraMargin) {
      const diff = bounds.maxZ - cameraMargin - newCamZ;
      rotatedZ += diff;
      newCamZ = bounds.maxZ - cameraMargin;
    } else if (newCamZ < bounds.minZ + cameraMargin) {
      const diff = bounds.minZ + cameraMargin - newCamZ;
      rotatedZ += diff;
      newCamZ = bounds.minZ + cameraMargin;
    }

    // Aplicar la posición ajustada
    targetPosition.x += rotatedX;
    targetPosition.z += rotatedZ;
    targetPosition.y += offset.y;

    // Aplicar suavizado al movimiento de la cámara
    this.camera.position.lerp(targetPosition, this.smoothness);

    // Calcular el punto de mira (ligeramente por encima del objetivo)
    const lookAtPosition = new THREE.Vector3();
    lookAtPosition.copy(this.target.position);
    lookAtPosition.y += 1.2;

    // Asegurarse de que el punto de mira no se salga de los límites
    lookAtPosition.x = Math.max(
      bounds.minX + 1,
      Math.min(bounds.maxX - 1, lookAtPosition.x)
    );
    lookAtPosition.z = Math.max(
      bounds.minZ + 1,
      Math.min(bounds.maxZ - 1, lookAtPosition.z)
    );

    // Aplicar suavizado al punto de mira
    this.currentLookAt.lerp(lookAtPosition, this.smoothness);
    this.camera.lookAt(this.currentLookAt);

    // Actualizar los controles
    if (this.controls) {
      this.controls.target.copy(this.currentLookAt);
      this.controls.update();
    }
  }

  /**
   * Configura controles de zoom para vista isométrica
   */
  setupZoomControls() {
    if (!this.domElement) return;

    // Event listener para la rueda del mouse (zoom)
    this.domElement.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();

        // Ajustar la distancia según la dirección de la rueda
        const zoomSpeed = 2;
        if (event.deltaY < 0) {
          // Acercar
          this.targetDistance = Math.max(
            this.minDistance,
            this.targetDistance - zoomSpeed
          );
        } else {
          // Alejar
          this.targetDistance = Math.min(
            this.maxDistance,
            this.targetDistance + zoomSpeed
          );
        }
      },
      { passive: false }
    );
  }

  /**
   * Actualiza la posición de la cámara en vista isométrica con seguimiento
   */
  updateIsometricPosition() {
    if (!this.target) return;
    
    // Calcular velocidad del objetivo para ajuste automático de zoom
    if (this.lastTargetPosition) {
      this.targetVelocity.subVectors(this.target.position, this.lastTargetPosition);
      this.lastTargetPosition.copy(this.target.position);
    } else {
      this.lastTargetPosition.copy(this.target.position);
    }
    
    // Animación de zoom automático
    if (this.isZoomAnimating) {
      const elapsed = (Date.now() - this.zoomAnimationStartTime) / 1000;
      if (elapsed < this.zoomAnimationDuration) {
        // Animación suave de zoom
        const progress = elapsed / this.zoomAnimationDuration;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        this.currentDistance = 40 + (this.baseDistance - 40) * easeProgress; // Ajustado al nuevo maxDistance
      } else {
        this.currentDistance = this.baseDistance;
        this.isZoomAnimating = false;
      }
    }
    
    // Ajuste automático de zoom basado en la velocidad del objetivo
    if (this.autoZoomEnabled && !this.isZoomAnimating) {
      const speed = this.targetVelocity.length();
      const speedFactor = Math.min(speed * 10, 1); // Normalizar velocidad
      const dynamicDistance = this.baseDistance + speedFactor * 15;
      this.currentDistance += (dynamicDistance - this.currentDistance) * 0.02;
    }
    
    // Aplicar límites de distancia
    this.currentDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.currentDistance));
    
    // Calcular posición isométrica relativa al objetivo
    const angle = Math.PI / 4; // 45 grados
    const height = this.currentDistance * 0.7; // Altura proporcional a la distancia
    
    // Posición isométrica: 45 grados en XY y 45 grados en XZ
    const offsetX = this.currentDistance * Math.cos(angle);
    const offsetZ = this.currentDistance * Math.cos(angle);
    
    // Posicionar cámara relativa al objetivo
    const targetPosition = this.target.position;
    const cameraX = targetPosition.x + offsetX;
    const cameraY = targetPosition.y + height;
    const cameraZ = targetPosition.z + offsetZ;
    
    // Suavizar movimiento de cámara
    const targetCameraPosition = new THREE.Vector3(cameraX, cameraY, cameraZ);
    this.camera.position.lerp(targetCameraPosition, this.smoothness);
    
    // Calcular punto de mira (ligeramente por encima del objetivo)
    const lookAtPosition = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + 1.5,
      targetPosition.z
    );
    
    // Suavizar punto de mira
    this.currentLookAt.lerp(lookAtPosition, this.smoothness);
    this.camera.lookAt(this.currentLookAt);
  }

  update() {
    if (this.target) {
      if (this.isometric) {
        this.updateIsometricPosition();
      } else {
        this.updateCameraPosition();
      }
    }

    // Actualizar OrbitControls en modo tercera persona
    if (this.controls) {
      this.controls.update();
    }
  }
}
