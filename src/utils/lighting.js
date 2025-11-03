import * as THREE from "three";

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.init();
  }

  init() {
    this.addAmbientLight();
    this.addDirectionalLight();
    this.addHemisphereLight();
  }

  addAmbientLight() {
    // Luz ambiental general con temperatura de color cálida
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.ambientLight.intensity = 0.2;
    this.scene.add(this.ambientLight);
  }

  addDirectionalLight() {
    // Luz direccional (simula el sol)
    this.dirLight = new THREE.DirectionalLight(0xff8c00, 0.8); // Color naranja/ámbar
    this.dirLight.position.set(5, 20, 10);
    this.dirLight.castShadow = true;

    // Configuración avanzada de sombras - Aumentado el rango de las sombras
    this.dirLight.shadow.mapSize.width = 4096;
    this.dirLight.shadow.mapSize.height = 4096;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 500; // Aumentado de 100 a 500 para cubrir más distancia
    this.dirLight.shadow.camera.left = -150; // Aumentado para cubrir un área más amplia
    this.dirLight.shadow.camera.right = 150;
    this.dirLight.shadow.camera.top = 150;
    this.dirLight.shadow.camera.bottom = -150;

    // Mejorar la calidad de las sombras
    this.dirLight.shadow.bias = -0.0001; // Reducir el bias para evitar artefactos
    this.dirLight.shadow.normalBias = 0.05; // Reducir el bias normal para bordes más suaves
    this.dirLight.shadow.radius = 2; // Suavizado de bordes de sombra

    // Añadir ayuda visual para depuración (opcional)
    // const helper = new THREE.CameraHelper(this.dirLight.shadow.camera);
    // this.scene.add(helper);

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Asegurar que el objetivo mire al centro de la escena
    this.dirLight.target.position.set(0, 0, 0);
  }

  addHemisphereLight() {
    // Luz de hemisferio mejorada para simular cielo y tierra
    this.hemiLight = new THREE.HemisphereLight(
      0x87ceeb, // Color del cielo (azul claro)
      0x8b7355, // Color del suelo (marrón tierra)
      0.6 // Intensidad
    );

    // Posicionar la luz de hemisferio
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);
  }

  update(delta) {
    // Actualizar la posición de la luz direccional para simular movimiento del sol
    if (this.dirLight) {
      const time = Date.now() * 0.00002;
      this.dirLight.position.x = Math.sin(time) * 20;
      this.dirLight.position.z = Math.cos(time) * 20;

      // Ajustar intensidad basado en la altura del sol
      const sunHeight = Math.max(0, this.dirLight.position.y / 20);
      this.dirLight.intensity = 0.5 + sunHeight * 0.8;

      // Ajustar color basado en la altura del sol
      const color = new THREE.Color();
      color.setHSL(0.1 + sunHeight * 0.1, 0.9, 0.5);
      this.dirLight.color.copy(color);

      // Actualizar la cámara de sombra
      this.dirLight.shadow.camera.updateProjectionMatrix();
    }
  }
}
