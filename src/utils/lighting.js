import * as THREE from "three";

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.time = 0; 
    this.dayLength = 330;
    this.nightFactor = 0; 
    this.init();
  }

  init() {
    this.addAmbientLight();
    this.addDirectionalLight();
    this.addHemisphereLight();
  }

  addAmbientLight() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.ambientLight.intensity = 0.2;
    this.scene.add(this.ambientLight);
  }

  addDirectionalLight() {
    this.dirLight = new THREE.DirectionalLight(0xff8c00, 0.8); 
    this.dirLight.position.set(5, 20, 10);
    this.dirLight.castShadow = true;

    this.dirLight.shadow.mapSize.width = 4096;
    this.dirLight.shadow.mapSize.height = 4096;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 500; 
    this.dirLight.shadow.camera.left = -150; 
    this.dirLight.shadow.camera.right = 150;
    this.dirLight.shadow.camera.top = 150;
    this.dirLight.shadow.camera.bottom = -150;

    this.dirLight.shadow.bias = -0.0001; 
    this.dirLight.shadow.normalBias = 0.05; 
    this.dirLight.shadow.radius = 2; 


    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.dirLight.target.position.set(0, 0, 0);
  }

  addHemisphereLight() {
    this.hemiLight = new THREE.HemisphereLight(
      0x87ceeb, 
      0x8b7355, 
      0.6 
    );

    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);
  }

  update(delta) {
    this.time += Math.max(0, delta || 0);
    const phase = (this.time % this.dayLength) / this.dayLength; 

    const rx = 140;   
    const rz = 90;    
    const ry = 90;    
    const dayRatio = 210 / 330;
    const adjustedPhase = phase < dayRatio ? 
      (phase / dayRatio) * 0.5 * Math.PI : 
      Math.PI * 0.5 + ((phase - dayRatio) / (1 - dayRatio)) * 1.5 * Math.PI;
    const angle = adjustedPhase; 

    const sunX = Math.cos(angle) * rx;
    const sunY = Math.sin(angle) * ry;
    const sunZ = Math.sin(angle) * -rz;

    if (this.dirLight) {
      this.dirLight.position.set(sunX, sunY, sunZ);
      this.dirLight.target.position.set(0, 0, 0);

      const height01 = THREE.MathUtils.clamp((sunY + ry) / (2 * ry), 0, 1); 

      const dayCurve = height01 * height01 * (3 - 2 * height01); 
      const nightCurve = 1 - dayCurve;
      this.nightFactor = nightCurve; 

      const dirIntensity = THREE.MathUtils.lerp(0.05, 1.2, dayCurve); 
      const ambIntensity = THREE.MathUtils.lerp(0.02, 0.28, dayCurve);
      const hemiIntensity = THREE.MathUtils.lerp(0.05, 0.7, dayCurve);

      this.dirLight.intensity = dirIntensity;
      if (this.ambientLight) this.ambientLight.intensity = ambIntensity;
      if (this.hemiLight) this.hemiLight.intensity = hemiIntensity;

      const warm = new THREE.Color(0xffb36b);
      const neutral = new THREE.Color(0xffffff);
      const noonFactor = Math.sin(angle) * 0.5 + 0.5; 
      this.dirLight.color.copy(neutral).lerp(warm, 1 - Math.abs(noonFactor - 0.5) * 2);

      this.dirLight.shadow.camera.updateProjectionMatrix();
    }
  }
}
