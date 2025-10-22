import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

export class SmokeEffect {
  constructor(scene, position = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.position = position;
    this.particles = null;
    this.time = 0;
    
    this.init();
  }

  init() {
    const particleCount = 600; // Aumentamos aún más las partículas
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    // Crear partículas en el suelo
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Distribución inicial escalonada en el eje Y para un flujo constante
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.2; // Origen más concentrado
      const heightOffset = (i / particleCount) * 15; // Distribución vertical inicial
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = heightOffset; // Distribución vertical escalonada
      positions[i3 + 2] = Math.sin(angle) * radius;
      
      // Colores de humo más realistas
      const intensity = 0.1 + Math.random() * 0.2;
      // Variación de grises con un toque azulado/marrón
      colors[i3] = intensity * (0.7 + Math.random() * 0.3);     // R
      colors[i3 + 1] = intensity * (0.6 + Math.random() * 0.3); // G
      colors[i3 + 2] = intensity * (0.5 + Math.random() * 0.3); // B
      
      // Tamaño más consistente con pequeñas variaciones
      sizes[i] = 2 + Math.random() * 2; // Tamaño un poco más grande
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Material optimizado para humo realista
    const material = new THREE.PointsMaterial({
      size: 2.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.NormalBlending, // Mejor para humo realista
      depthWrite: false,
      fog: true,
      alphaMap: this.createSmokeTexture(), // Textura mejorada para humo
    });
    
    this.particles = new THREE.Points(particles, material);
    this.particles.position.set(this.position.x, this.position.y, this.position.z);
    this.scene.add(this.particles);
    
    // Almacenar posiciones iniciales para el efecto de movimiento
    this.initialPositions = positions.slice();
  }
  
  // Crear textura de humo más realista
  createSmokeTexture() {
    const canvas = document.createElement('canvas');
    const size = 128; // Textura más grande para más detalle
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fondo transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, size, size);
    
    // Dibujar nubes de humo irregulares
    const center = size / 2;
    const gradient1 = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient1.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient1.addColorStop(0.6, 'rgba(200, 200, 200, 0.5)');
    gradient1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    // Varias capas para textura más orgánica
    for (let i = 0; i < 5; i++) {
      const x = center + (Math.random() - 0.5) * 10;
      const y = center + (Math.random() - 0.5) * 10;
      const r = center * (0.7 + Math.random() * 0.3);
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.3 + Math.random() * 0.2})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter; // Suavizado mejorado
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }
  
  update(delta) {
    if (!this.particles) return;
    
    this.time += delta * 2.5; // Aumentamos la velocidad general
    const particles = this.particles.geometry.attributes.position;
    const colors = this.particles.geometry.attributes.color;
    const sizes = this.particles.geometry.attributes.size;
    const particleCount = particles.count;
    
    // Actualizar todas las partículas
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const particleTime = this.time + i * 0.1; // Desfase por partícula
      
      // Movimiento ascendente más rápido y consistente
      const baseSpeed = 2.5; // Aumentamos la velocidad base
      const speedVariation = Math.sin(particleTime * 3 + i) * 0.1; // Menos variación
      const verticalSpeed = baseSpeed + speedVariation;
      
      // Movimiento vertical más fluido
      particles.array[i3 + 1] += delta * verticalSpeed;
      
      // Movimiento lateral más sutil para flujo más constante
      const noiseX = Math.sin(particleTime * 0.8 + i * 0.5) * 0.15;
      const noiseZ = Math.cos(particleTime * 0.7 + i * 0.6) * 0.15;
      
      particles.array[i3] += noiseX * delta * 15;
      particles.array[i3 + 2] += noiseZ * delta * 15;
      
      // Variar ligeramente el tamaño para simular expansión
      const sizeVariation = Math.sin(particleTime * 2 + i) * 0.2 + 1;
      sizes.array[i] = (2 + Math.random() * 0.5) * sizeVariation;
      
      // Cambios de color más sutiles
      const heightFactor = particles.array[i3 + 1] / 15;
      colors.array[i3] *= (0.95 + Math.random() * 0.1);
      colors.array[i3 + 1] *= (0.95 + Math.random() * 0.1);
      colors.array[i3 + 2] = Math.min(0.8, colors.array[i3 + 2] * (1 + delta * 0.5));
      
      // Reiniciar partículas que han subido demasiado
      if (particles.array[i3 + 1] > 25) { // Aumentamos la altura máxima
        // Dispersión más pequeña para mantener el humo más concentrado
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 1.0;
        particles.array[i3] = Math.cos(angle) * radius;
        particles.array[i3 + 1] = -Math.random() * 5; // Empezar un poco por debajo para transición suave
        particles.array[i3 + 2] = Math.sin(angle) * radius;
        
        // Reiniciar colores a valores de humo fresco
        const intensity = 0.1 + Math.random() * 0.2;
        colors.array[i3] = intensity * (0.7 + Math.random() * 0.3);
        colors.array[i3 + 1] = intensity * (0.6 + Math.random() * 0.3);
        colors.array[i3 + 2] = intensity * (0.5 + Math.random() * 0.3);
      }
    }
    
    // Actualizar atributos
    particles.needsUpdate = true;
    colors.needsUpdate = true;
    sizes.needsUpdate = true;
    
    // Movimiento global mínimo para no distraer
    this.particles.rotation.y = Math.sin(this.time * 0.1) * 0.05;
    this.particles.rotation.x = Math.sin(this.time * 0.08) * 0.02;
    
    // Ligero movimiento de balanceo
    const sway = Math.sin(this.time * 0.3) * 0.02;
    this.particles.position.x = this.position.x + sway;
    this.particles.position.z = this.position.z + Math.cos(this.time * 0.25) * 0.02;
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
