import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js";

export class ControlsManager {
  constructor(camera, renderer, target = null) {
    this.camera = camera;
    this.renderer = renderer;
    this.target = target;
    this.controls = null;
    this.offset = new THREE.Vector3(0, 2, 5); // Offset behind and above the target
    this.currentLookAt = new THREE.Vector3();

    // Configuración de la cámara en tercera persona
    this.cameraOffset = new THREE.Vector3(0, 2.5, -5); // Aumentada la altura (Y) y distancia (Z)
    this.smoothness = 0.1; // Suavizado del movimiento de la cámara

    this.init();
  }

  init() {
    // Configurar controles de órbita para rotación de cámara
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
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

  setTarget(target) {
    this.target = target;
    if (target) {
      this.updateCameraPosition();
    }
  }

  updateCameraPosition() {
    if (!this.target) return;

    // Límites del terreno (deben coincidir con los del FarmerController)
    const bounds = {
      minX: -250,
      maxX: 250,
      minZ: -250,
      maxZ: 250
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
      const diff = (bounds.maxX - cameraMargin) - newCamX;
      rotatedX += diff;
      newCamX = bounds.maxX - cameraMargin;
    } else if (newCamX < bounds.minX + cameraMargin) {
      const diff = (bounds.minX + cameraMargin) - newCamX;
      rotatedX += diff;
      newCamX = bounds.minX + cameraMargin;
    }

    if (newCamZ > bounds.maxZ - cameraMargin) {
      const diff = (bounds.maxZ - cameraMargin) - newCamZ;
      rotatedZ += diff;
      newCamZ = bounds.maxZ - cameraMargin;
    } else if (newCamZ < bounds.minZ + cameraMargin) {
      const diff = (bounds.minZ + cameraMargin) - newCamZ;
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
    lookAtPosition.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, lookAtPosition.x));
    lookAtPosition.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, lookAtPosition.z));

    // Aplicar suavizado al punto de mira
    this.currentLookAt.lerp(lookAtPosition, this.smoothness);
    this.camera.lookAt(this.currentLookAt);

    // Actualizar los controles
    if (this.controls) {
      this.controls.target.copy(this.currentLookAt);
      this.controls.update();
    }
  }

  update() {
    if (this.target) {
      this.updateCameraPosition();
    }

    if (this.controls) {
      this.controls.update();
    }
  }
}
