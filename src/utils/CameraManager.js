import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { ControlsManager } from "./controls.js";
export class CameraManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = {
      fov: 75,
      near: 0.1,           
      far: 5000,           
      frustumSize: 60,
      renderer: null,
      ...options,
    };
    this.renderer = this.options.renderer || null;
    const aspect = window.innerWidth / window.innerHeight;
    this.frustumSize = this.options.frustumSize;
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
    const isoAngle = Math.atan(Math.sqrt(2)); 
    const distance = this.options.distance || 120;
    this._isoOffset = new THREE.Vector3(distance, distance, distance);
    this.camera.position.copy(this._isoOffset);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = Math.PI / 4;
    this.camera.rotation.x = -isoAngle;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    this.controls = null;
    this.followTarget = null;
    this.followLag = 0.08;
    this._tmpTargetPos = new THREE.Vector3();
    this._prevTargetPos = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._lookahead = new THREE.Vector3();
    this._tmpDisp = new THREE.Vector3();
    this._lookaheadFactor = 0.6;
    this._lookaheadMax = 8;
    this.setupCamera();
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  setupCamera() {
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
  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const halfWidth = (this.frustumSize * aspect) / 2;
    const halfHeight = this.frustumSize / 2;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    if (this.renderer && typeof this.renderer.setSize === 'function') {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (typeof this.renderer.setClearColor === 'function' && this.renderer.domElement) {
        this.renderer.autoClear = true;
      }
    }
    if (this.controls && typeof this.controls.handleResize === 'function') {
      this.controls.handleResize();
    }
  }
  setRenderer(renderer) {
    this.renderer = renderer;
    if (this.renderer && typeof this.renderer.setSize === 'function') {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.autoClear = true;
    }
    this.onWindowResize();
  }
  setupControls(domElement) {
    if (!this.controls) {
      this.controls = new ControlsManager(this.camera, {
        domElement,
        isometric: true,
      });
      if (this.controls.setLimits) {
        try { this.controls.setLimits({ minDistance: 10, maxDistance: 1000 }); } catch(e) {}
      }
    }
  }
  setFollow(target, opts = {}) {
    this.followTarget = target || null;
    if (opts.distance !== undefined) {
      const d = opts.distance;
      this._isoOffset.set(d, d, d);
    }
    if (opts.frustumSize !== undefined) {
      this.frustumSize = opts.frustumSize;
      this.onWindowResize();
    }
    if (opts.lag !== undefined) this.followLag = opts.lag;
  }
  update(delta) {
    if (this.controls) {
      this.controls.update(delta);
    }
    if (this.followTarget) {
      this.followTarget.getWorldPosition(this._tmpTargetPos);
      this._tmpDisp.subVectors(this._tmpTargetPos, this._prevTargetPos);
      const steps = delta ? delta * 60 : 1;
      const vBase = 0.15;
      const vT = 1 - Math.pow(1 - vBase, steps);
      this._vel.lerp(this._tmpDisp, vT);
      this._prevTargetPos.copy(this._tmpTargetPos);

      this._lookahead.copy(this._vel);
      this._lookahead.y = 0;
      const len = this._lookahead.length();
      if (len > this._lookaheadMax) this._lookahead.setLength(this._lookaheadMax);
      this._lookahead.multiplyScalar(this._lookaheadFactor);

      const desired = this._tmpTargetPos.clone().add(this._isoOffset).add(this._lookahead);
      const base = Math.max(0, Math.min(1, this.followLag));
      const t = 1 - Math.pow(1 - base, steps);
      this.camera.position.lerp(desired, t);
      this.camera.lookAt(this._tmpTargetPos);
    }
  }
  setTarget(target, offset = new THREE.Vector3(0, 2, -2)) {
    if (this.controls) {
      this.controls.setTarget(target, offset);
    } else {
      this.camera.position.copy(target.position).add(offset);
      this.camera.lookAt(target.position);
    }
    this.setFollow(target);
  }
  getCamera() {
    return this.camera;
  }
  getControls() {
    return this.controls ? this.controls.controls : null;
  }
}

export default CameraManager;
