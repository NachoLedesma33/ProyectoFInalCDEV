import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

export class ProgressBar {
  constructor(cow, scene, duration = 75000) {
    this.cow = cow;
    this.scene = scene;
    this.duration = duration; // Duración en milisegundos
    this.startTime = Date.now();
    this.isComplete = false;
    this.progressBar = null;
    this.exclamationMark = null;
    this.container = null;
    
    this.init();
  }
  
  init() {
    // Crear un contenedor para la barra de progreso y el signo de exclamación
    this.container = new THREE.Group();
    
    // Crear la barra de progreso
    this.createProgressBar();
    
    // Crear el signo de exclamación (inicialmente oculto)
    this.createExclamationMark();
    
    // Posicionar el contenedor sobre la vaca
    this.updatePosition();
    
    // Agregar a la escena
    this.scene.add(this.container);
  }
  
  createProgressBar() {
    // Crear el fondo de la barra (rojo)
    const backgroundGeometry = new THREE.BoxGeometry(2, 0.3, 0.1);
    const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    
    // Crear la barra de progreso (verde) - mismo tamaño que el fondo, inicialmente oculta
    const progressGeometry = new THREE.BoxGeometry(2, 0.3, 0.15);
    const progressMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.progressBarFill = new THREE.Mesh(progressGeometry, progressMaterial);
    this.progressBarFill.position.x = 0; // Centrada
    this.progressBarFill.scale.x = 0; // Inicialmente invisible (escala 0)
    
    // Agrupar las partes de la barra
    this.progressBar = new THREE.Group();
    this.progressBar.add(background);
    this.progressBar.add(this.progressBarFill);
    
    // Asegurar que la barra de progreso sea visible
    this.progressBar.visible = true;
    
    // Posicionar la barra sobre la vaca
    this.progressBar.position.y = 1.5; // 1.5 unidades sobre la base de la vaca
    
    this.container.add(this.progressBar);
  }
  
  createExclamationMark() {
    // Crear el signo de exclamación 3D
    this.exclamationMark = new THREE.Group();
    
    // Palo vertical del signo de exclamación
    const verticalGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const verticalMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const vertical = new THREE.Mesh(verticalGeometry, verticalMaterial);
    vertical.position.y = 0.4;
    
    // Punto del signo de exclamación
    const pointGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.y = -0.2;
    
    this.exclamationMark.add(vertical);
    this.exclamationMark.add(point);
    
    // Escalar el signo de exclamación
    this.exclamationMark.scale.set(0.8, 0.8, 0.8);
    
    // Posicionar el signo de exclamación sobre la vaca
    this.exclamationMark.position.y = 1.5;
    
    // Inicialmente oculto
    this.exclamationMark.visible = false;
    // console.log('Signo de exclamación creado y oculto');
    
    this.container.add(this.exclamationMark);
  }
  
  updatePosition() {
    if (this.cow && this.cow.model) {
      // Obtener la posición de la vaca
      const cowPosition = this.cow.model.position.clone();
      
      // Posicionar el contenedor sobre la vaca
      this.container.position.copy(cowPosition);
      this.container.position.y += 1; // Ajustar altura sobre la vaca
    }
  }
  
  update() {
    // Forzar los estados correctos de visibilidad
    if (this.progressBar && !this.isComplete) {
      this.progressBar.visible = true;
    }
    if (this.exclamationMark && !this.isComplete) {
      this.exclamationMark.visible = false;
    }
    
    if (this.isComplete) {
      // Animación flotante del signo de exclamación
      if (this.exclamationMark && this.exclamationMark.visible) {
        const time = Date.now() * 0.005;
        this.exclamationMark.position.y = 1.5 + Math.sin(time) * 0.2; // Flotación suave
        this.exclamationMark.rotation.y = Math.sin(time * 0.5) * 0.1; // Rotación suave
      }
      return;
    }
    
    // Actualizar la posición sobre la vaca
    this.updatePosition();
    
    // Calcular el progreso
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    
    // Depuración deshabilitada para mejorar rendimiento
    
    // Actualizar la barra de progreso
    if (this.progressBarFill) {
      // La barra verde se "pinta" gradualmente desde la izquierda
      this.progressBarFill.scale.x = progress; // Escala de 0 a 1
      // Alinear al lado izquierdo para que parezca que se pinta de izquierda a derecha
      this.progressBarFill.position.x = -1 + (progress * 1); // Mover según el progreso
    }
    
    // Verificar si la barra está completa
    if (progress >= 1 && !this.isComplete) {
      this.complete();
    }
  }
  
  complete() {
    this.isComplete = true;
    
    // Ocultar la barra de progreso
    if (this.progressBar) {
      this.progressBar.visible = false;
    }
    
    // Mostrar el signo de exclamación
    if (this.exclamationMark) {
      this.exclamationMark.visible = true;
    }
  }
  
  dispose() {
    // Eliminar el contenedor de la escena
    if (this.container && this.scene) {
      this.scene.remove(this.container);
    }
    
    // Limpiar geometrías y materiales
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
