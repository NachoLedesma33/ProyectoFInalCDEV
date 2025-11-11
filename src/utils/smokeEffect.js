import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

export class SmokeEffect {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.position = position;
    this.particles = null;
    this.time = 0;

    this.init();
  }

  init() {
    const particleCount = 600;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.2;
      const heightOffset = (i / particleCount) * 15;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = heightOffset;
      positions[i3 + 2] = Math.sin(angle) * radius;
      const intensity = 0.1 + Math.random() * 0.2;
      colors[i3] = intensity * (0.7 + Math.random() * 0.3);
      colors[i3 + 1] = intensity * (0.6 + Math.random() * 0.3);
      colors[i3 + 2] = intensity * (0.5 + Math.random() * 0.3);
      sizes[i] = 2 + Math.random() * 2;
    }

    particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particles.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({
      size: 2.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      fog: true,
      alphaMap: this.createSmokeTexture(),
    });
    this.particles = new THREE.Points(particles, material);
    this.particles.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );
    this.scene.add(this.particles);
    this.initialPositions = positions.slice();
  }

  createSmokeTexture() {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, size, size);
    const center = size / 2;
    const gradient1 = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center
    );
    gradient1.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient1.addColorStop(0.6, "rgba(200, 200, 200, 0.5)");
    gradient1.addColorStop(1, "rgba(0, 0, 0, 0)");
    for (let i = 0; i < 5; i++) {
      const x = center + (Math.random() - 0.5) * 10;
      const y = center + (Math.random() - 0.5) * 10;
      const r = center * (0.7 + Math.random() * 0.3);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(
        0,
        `rgba(255, 255, 255, ${0.3 + Math.random() * 0.2})`
      );
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  update(delta) {
    if (!this.particles) return;

    this.time += delta * 2.5;
    const particles = this.particles.geometry.attributes.position;
    const colors = this.particles.geometry.attributes.color;
    const sizes = this.particles.geometry.attributes.size;
    const particleCount = particles.count;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const particleTime = this.time + i * 0.1;
      const baseSpeed = 2.5;
      const speedVariation = Math.sin(particleTime * 3 + i) * 0.1;
      const verticalSpeed = baseSpeed + speedVariation;
      particles.array[i3 + 1] += delta * verticalSpeed;
      const noiseX = Math.sin(particleTime * 0.8 + i * 0.5) * 0.15;
      const noiseZ = Math.cos(particleTime * 0.7 + i * 0.6) * 0.15;
      particles.array[i3] += noiseX * delta * 15;
      particles.array[i3 + 2] += noiseZ * delta * 15;
      const sizeVariation = Math.sin(particleTime * 2 + i) * 0.2 + 1;
      sizes.array[i] = (2 + Math.random() * 0.5) * sizeVariation;
      const heightFactor = particles.array[i3 + 1] / 15;
      colors.array[i3] *= 0.95 + Math.random() * 0.1;
      colors.array[i3 + 1] *= 0.95 + Math.random() * 0.1;
      colors.array[i3 + 2] = Math.min(
        0.8,
        colors.array[i3 + 2] * (1 + delta * 0.5)
      );
      if (particles.array[i3 + 1] > 25) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 1.0;
        particles.array[i3] = Math.cos(angle) * radius;
        particles.array[i3 + 1] = -Math.random() * 5; 
        particles.array[i3 + 2] = Math.sin(angle) * radius;
        const intensity = 0.1 + Math.random() * 0.2;
        colors.array[i3] = intensity * (0.7 + Math.random() * 0.3);
        colors.array[i3 + 1] = intensity * (0.6 + Math.random() * 0.3);
        colors.array[i3 + 2] = intensity * (0.5 + Math.random() * 0.3);
      }
    }
    particles.needsUpdate = true;
    colors.needsUpdate = true;
    sizes.needsUpdate = true;
    this.particles.rotation.y = Math.sin(this.time * 0.1) * 0.05;
    this.particles.rotation.x = Math.sin(this.time * 0.08) * 0.02;
    const sway = Math.sin(this.time * 0.3) * 0.02;
    this.particles.position.x = this.position.x + sway;
    this.particles.position.z =
      this.position.z + Math.cos(this.time * 0.25) * 0.02;
  }

  remove() {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
  }
}
