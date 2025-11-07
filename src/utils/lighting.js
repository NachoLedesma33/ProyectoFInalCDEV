import * as THREE from "three";

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.time = 0; // seconds
    this.dayLength = 330; // seconds for a full day-night cycle (3:30 día + 2:00 noche)
    this.nightFactor = 0; // 0=day, 1=night
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
    // Tiempo acumulado del ciclo día/noche (en segundos)
    this.time += Math.max(0, delta || 0);
    const phase = (this.time % this.dayLength) / this.dayLength; // 0..1

    // Órbita elíptica del sol alrededor de la escena
    // Escalas para la elipse (horizontal y altura)
    const rx = 140;   // radio horizontal X
    const rz = 90;    // radio horizontal Z
    const ry = 90;    // altura máxima del sol
    // Ajustar la fase para que el día dure 3:30 y la noche 2:00
    const dayRatio = 210 / 330; // 3:30 de día / 5:30 total
    const adjustedPhase = phase < dayRatio ? 
      (phase / dayRatio) * 0.5 * Math.PI : // Día: 0 a π/2
      Math.PI * 0.5 + ((phase - dayRatio) / (1 - dayRatio)) * 1.5 * Math.PI; // Noche: π/2 a 2π
    const angle = adjustedPhase; // Usar el ángulo ajustado

    const sunX = Math.cos(angle) * rx;
    const sunY = Math.sin(angle) * ry; // negativo = noche, positivo = día
    const sunZ = Math.sin(angle) * -rz; // contra-fase para variar dirección

    if (this.dirLight) {
      this.dirLight.position.set(sunX, sunY, sunZ);
      this.dirLight.target.position.set(0, 0, 0);

      // Normalizar altura del sol a 0..1 para controlar intensidades
      const height01 = THREE.MathUtils.clamp((sunY + ry) / (2 * ry), 0, 1); // 0 noche, 1 día

      // Curvas de transición suaves (evita cortes bruscos)
      const dayCurve = height01 * height01 * (3 - 2 * height01); // smoothstep
      const nightCurve = 1 - dayCurve;
      this.nightFactor = nightCurve; // Exponer factor nocturno

      // Intensidades
      const dirIntensity = THREE.MathUtils.lerp(0.05, 1.2, dayCurve); // casi apagado en noche, fuerte de día
      const ambIntensity = THREE.MathUtils.lerp(0.02, 0.28, dayCurve);
      const hemiIntensity = THREE.MathUtils.lerp(0.05, 0.7, dayCurve);

      this.dirLight.intensity = dirIntensity;
      if (this.ambientLight) this.ambientLight.intensity = ambIntensity;
      if (this.hemiLight) this.hemiLight.intensity = hemiIntensity;

      // Color del sol: más cálido al amanecer/atardecer, más neutro al mediodía
      const warm = new THREE.Color(0xffb36b);
      const neutral = new THREE.Color(0xffffff);
      const noonFactor = Math.sin(angle) * 0.5 + 0.5; // 0 en noche, 1 en mediodía
      this.dirLight.color.copy(neutral).lerp(warm, 1 - Math.abs(noonFactor - 0.5) * 2);

      // Actualizar cámara de sombras
      this.dirLight.shadow.camera.updateProjectionMatrix();
    }
  }
}
