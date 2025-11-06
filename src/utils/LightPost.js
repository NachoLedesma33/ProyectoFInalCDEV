import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

export default class LightPost {
  constructor(scene, position = { x: 0, y: 0, z: 0 }, options = {}) {
    this.scene = scene;
    this.position = position;
    this.height = options.height || 6.0;
    this.enabled = false;
    this.group = new THREE.Group();

    const metal = new THREE.MeshStandardMaterial({ color: 0x888a90, metalness: 0.9, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, emissive: 0x000000, emissiveIntensity: 0.0, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.0 });

    const baseGeom = new THREE.CylinderBufferGeometry(0.35, 0.5, 0.25, 16);
    const base = new THREE.Mesh(baseGeom, metal);
    base.castShadow = true;
    base.receiveShadow = true;
    base.position.set(0, 0.125, 0);
    this.group.add(base);

    const poleGeom = new THREE.CylinderBufferGeometry(0.12, 0.12, this.height, 16);
    const pole = new THREE.Mesh(poleGeom, metal);
    pole.castShadow = true;
    pole.receiveShadow = true;
    pole.position.set(0, 0.125 + this.height / 2, 0);
    this.group.add(pole);

    const armRadius = 0.8;
    const armTube = 0.06;
    const armGeom = new THREE.TorusBufferGeometry(armRadius, armTube, 12, 24, Math.PI / 2);
    const arm = new THREE.Mesh(armGeom, metal);
    arm.castShadow = true;
    arm.receiveShadow = true;
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.PI;
    arm.position.set(0, pole.position.y + this.height / 2 - 0.1, 0);
    this.group.add(arm);

    const lampGeom = new THREE.ConeBufferGeometry(0.35, 0.6, 8);
    const lamp = new THREE.Mesh(lampGeom, metal);
    lamp.castShadow = true;
    lamp.receiveShadow = true;
    lamp.rotation.x = Math.PI;
    lamp.position.set(-armRadius, arm.position.y - 0.05, 0);
    this.group.add(lamp);

    const bulbGeom = new THREE.SphereBufferGeometry(0.18, 12, 12);
    const bulb = new THREE.Mesh(bulbGeom, glass);
    bulb.castShadow = false;
    bulb.receiveShadow = false;
    bulb.position.copy(lamp.position).add(new THREE.Vector3(0, -0.2, 0));
    this.group.add(bulb);
    this.bulb = bulb;

    const light = new THREE.SpotLight(0xfff2c7, 0, 280, 1.45, 0.7, 0.9);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.bias = -0.00008;
    light.position.copy(bulb.position);
    light.target.position.set(bulb.position.x, 0.1, bulb.position.z);
    this.group.add(light);
    this.group.add(light.target);

    this.light = light;

    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.scene.add(this.group);
  }

  setEnabled(on) {
    // Accept boolean or numeric factor 0..1
    const isNumber = typeof on === 'number' && isFinite(on);
    const factor = isNumber ? THREE.MathUtils.clamp(on, 0, 1) : (on ? 1 : 0);
    this.enabled = factor > 0;
    const baseIntensity = 26.0; // EXTREMELY strong
    const baseDistance = 280;   // EXTREMELY wide radius
    this.light.intensity = baseIntensity * factor;
    this.light.distance = Math.max(0.01, baseDistance * factor);
    // Warm yellow color when enabled
    try { this.light.color.setHex(0xffd35a); } catch (_) {}
    // Make the bulb glow via emissive
    try {
      if (this.bulb && this.bulb.material) {
        this.bulb.material.emissive = new THREE.Color(0xffd35a);
        this.bulb.material.emissiveIntensity = 0.6 * factor + (factor > 0 ? 0.2 : 0);
        this.bulb.material.needsUpdate = true;
      }
    } catch (_) {}
  }
}
