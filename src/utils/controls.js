import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js";

export class ControlsManager {
  constructor(camera, options = {}) {
    this.camera = camera;
    this.target = null;
    this.controls = null;
    this.isometric = options.isometric || true; 
    this.domElement = options.domElement;

    if (this.isometric) {
      this.baseDistance = 8; 
      this.minDistance = 6; 
      this.maxDistance = 12; 
      this.smoothness = 0.1;
      this.currentLookAt = new THREE.Vector3(0, 0, 0);
      this.currentDistance = 8; 
      this.targetDistance = this.baseDistance;
      this.zoomAnimationDuration = 0; 
      this.isZoomAnimating = false;
      this.autoZoomEnabled = false; 
      this.lastTargetPosition = new THREE.Vector3();
      this.targetVelocity = new THREE.Vector3();
    } else {
      this.offset = new THREE.Vector3(0, 2, 5);
      this.currentLookAt = new THREE.Vector3();
      this.cameraOffset = new THREE.Vector3(0, 2.5, -5);
      this.smoothness = 0.1;
    }

    this.init();
  }

  init() {
    if (this.isometric) {
      this.setupZoomControls();
      this.updateIsometricPosition();
    } else {
      this.controls = new OrbitControls(this.camera, this.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enablePan = false;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
      this.controls.minDistance = 2;
      this.controls.maxDistance = 10;
      this.controls.autoRotate = false;
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
    const bounds = {
      minX: -250,
      maxX: 250,
      minZ: -250,
      maxZ: 250,
    };
    const cameraMargin = 50;
    const targetPosition = new THREE.Vector3();
    targetPosition.copy(this.target.position);
    const offset = this.cameraOffset.clone();
    const angle = this.target.rotation.y;
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);
    let rotatedX = offset.x * cosAngle - offset.z * sinAngle;
    let rotatedZ = offset.x * sinAngle + offset.z * cosAngle;
    let newCamX = targetPosition.x + rotatedX;
    let newCamZ = targetPosition.z + rotatedZ;
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
    targetPosition.x += rotatedX;
    targetPosition.z += rotatedZ;
    targetPosition.y += offset.y;
    this.camera.position.lerp(targetPosition, this.smoothness);
    const lookAtPosition = new THREE.Vector3();
    lookAtPosition.copy(this.target.position);
    lookAtPosition.y += 1.2;
    lookAtPosition.x = Math.max(
      bounds.minX + 1,
      Math.min(bounds.maxX - 1, lookAtPosition.x)
    );
    lookAtPosition.z = Math.max(
      bounds.minZ + 1,
      Math.min(bounds.maxZ - 1, lookAtPosition.z)
    );
    this.currentLookAt.lerp(lookAtPosition, this.smoothness);
    this.camera.lookAt(this.currentLookAt);
    if (this.controls) {
      this.controls.target.copy(this.currentLookAt);
      this.controls.update();
    }
  }
  setupZoomControls() {
    if (!this.domElement) return;
    this.domElement.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const zoomSpeed = 2;
        if (event.deltaY < 0) {
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
  updateIsometricPosition() {
    if (!this.target) return;
    this.currentDistance = this.baseDistance;
    const angle = Math.PI / 4;
    const height = this.currentDistance * 0.7;
    const offsetX = this.currentDistance * Math.cos(angle);
    const offsetZ = this.currentDistance * Math.cos(angle);
    const targetPosition = this.target.position;
    const cameraX = targetPosition.x + offsetX;
    const cameraY = targetPosition.y + height;
    const cameraZ = targetPosition.z + offsetZ;
    const targetCameraPosition = new THREE.Vector3(cameraX, cameraY, cameraZ);
    this.camera.position.lerp(targetCameraPosition, this.smoothness);
    const lookAtPosition = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + 1.5,
      targetPosition.z
    );
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
    if (this.controls) {
      this.controls.update();
    }
  }
  handleResize() {
    if (this.controls) {
      this.controls.update();
    }
  }
}
