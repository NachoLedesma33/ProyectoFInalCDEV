import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

export class ProgressBar {
  constructor(cow, scene, duration = 75000) {
    this.cow = cow;
    this.scene = scene;
    this.duration = duration;
    this.startTime = Date.now();
    this.isComplete = false;
    this.progressBar = null;
    this.exclamationMark = null;
    this.container = null;
    
    this.init();
  }
  
  init() {
    this.container = new THREE.Group();
    this.createProgressBar();
    this.createExclamationMark();
    this.updatePosition();
    this.scene.add(this.container);
  }
  createProgressBar() {
    const backgroundGeometry = new THREE.BoxGeometry(2, 0.3, 0.1);
    const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    const progressGeometry = new THREE.BoxGeometry(2, 0.3, 0.15);
    const progressMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.progressBarFill = new THREE.Mesh(progressGeometry, progressMaterial);
    this.progressBarFill.position.x = 0;
    this.progressBarFill.scale.x = 0;
    this.progressBar = new THREE.Group();
    this.progressBar.add(background);
    this.progressBar.add(this.progressBarFill);
    this.progressBar.visible = true;
    this.progressBar.position.y = 1.5;
    this.container.add(this.progressBar);
  }
  
  createExclamationMark() {
    this.exclamationMark = new THREE.Group();
    const verticalGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const verticalMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const vertical = new THREE.Mesh(verticalGeometry, verticalMaterial);
    vertical.position.y = 0.4;
    const pointGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.y = -0.2;
    this.exclamationMark.add(vertical);
    this.exclamationMark.add(point);
    this.exclamationMark.scale.set(0.8, 0.8, 0.8);
    this.exclamationMark.position.y = 1.5;
    this.exclamationMark.visible = false;
    this.container.add(this.exclamationMark);
  }
  updatePosition() {
    if (this.cow && this.cow.model) {
      const cowPosition = this.cow.model.position.clone();
      this.container.position.copy(cowPosition);
      this.container.position.y += 1;
    }
  }
  update() {
    if (this.progressBar && !this.isComplete) {
      this.progressBar.visible = true;
    }
    if (this.exclamationMark && !this.isComplete) {
      this.exclamationMark.visible = false;
    }
    if (this.isComplete) {
      if (this.exclamationMark && this.exclamationMark.visible) {
        const time = Date.now() * 0.005;
        this.exclamationMark.position.y = 1.5 + Math.sin(time) * 0.2; 
        this.exclamationMark.rotation.y = Math.sin(time * 0.5) * 0.1;
      }
      return;
    }
    this.updatePosition();
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    if (this.progressBarFill) {
      this.progressBarFill.scale.x = progress;
      this.progressBarFill.position.x = -1 + (progress * 1);
    }
    if (progress >= 1 && !this.isComplete) {
      this.complete();
    }
  }
  complete() {
    this.isComplete = true;
    if (this.progressBar) {
      this.progressBar.visible = false;
    }
    if (this.exclamationMark) {
      this.exclamationMark.visible = true;
    }
  }
  dispose() {
    if (this.container && this.scene) {
      this.scene.remove(this.container);
    }
    if (this.container) {
      this.container.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
  }
}
