import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

// HealthComponent: maneja vida, daño y muerte
export class HealthComponent {
  constructor(maxHealth = 100, opts = {}) {
    this.maxHealth = maxHealth;
    this.current = maxHealth;
    this.invulnSeconds = opts.invulnSeconds || 0.5; // tiempo mínimo entre daños
    this._lastHitAt = -Infinity;
    this.onDeath = typeof opts.onDeath === "function" ? opts.onDeath : () => {};
    this.onDamage = typeof opts.onDamage === "function" ? opts.onDamage : () => {};
  }

  isAlive() {
    return this.current > 0;
  }

  canBeDamaged() {
    return (performance.now() - this._lastHitAt) / 1000 >= this.invulnSeconds;
  }

  takeDamage(amount, source) {
    if (!this.canBeDamaged()) return false;
    this._lastHitAt = performance.now();
    this.current -= amount;
    try {
      this.onDamage(amount, source);
    } catch (err) {
      console.warn('onDamage callback error', err);
    }

    if (this.current <= 0) {
      this.current = 0;
      try {
        this.onDeath(source);
      } catch (err) {
        console.warn('onDeath callback error', err);
      }
      return true; // murió
    }
    return false; // sigue vivo
  }

  heal(amount) {
    this.current = Math.min(this.maxHealth, this.current + amount);
  }
}

// Hitbox: volumen temporal que inflige daño cuando colisiona
export class Hitbox {
  constructor(ownerId, opts = {}) {
    this.ownerId = ownerId;
    this.damage = opts.damage || 10;
    this.duration = opts.duration || 0.2; // segundos
    this.radius = opts.radius || 1.0; // para esfera por defecto
    this.offset = opts.offset || new THREE.Vector3(0, 0, 0); // relativo al modelo
    this.startAt = null;
    this.active = false;
    this.consumed = false; // si ya aplicó daño (para hit único)
    this.friendlyFire = !!opts.friendlyFire;
    this.shape = opts.shape || 'sphere';
    // runtime
    this._worldSphere = new THREE.Sphere(new THREE.Vector3(), this.radius);
  }

  activate(now = performance.now()) {
    this.startAt = now;
    this.active = true;
    this.consumed = false;
  }

  isExpired(now = performance.now()) {
    if (!this.startAt) return false;
    return (now - this.startAt) / 1000 >= this.duration;
  }

  // actualizar la posición mundial del hitbox dado el modelo del owner
  updateWorldPosition(ownerModel) {
    if (!ownerModel) return;
    // calcular posición local -> world
    const localPos = this.offset.clone();
    ownerModel.updateMatrixWorld(true);
    ownerModel.localToWorld(localPos);
    this._worldSphere.center.copy(localPos);
    this._worldSphere.radius = this.radius;
  }

  intersectsSphere(sphere) {
    return this._worldSphere.intersectsSphere(sphere);
  }
}

// CombatSystem: registra entidades (model + HealthComponent), maneja hitboxes y aplica daño
export class CombatSystem {
  constructor() {
    this.entities = new Map(); // id -> { id, model, health, team }
    this.hitboxes = []; // Hitbox[] activos
    this._tmpSphere = new THREE.Sphere();
  }

  // Registrar una entidad para recibir/recibir colisiones
  registerEntity(id, model, healthComponent, opts = {}) {
    if (!id || !model || !healthComponent) {
      throw new Error('registerEntity: id, model y healthComponent son requeridos');
    }
    this.entities.set(id, {
      id,
      model,
      health: healthComponent,
      team: opts.team || 'neutral',
      hurtRadius: opts.hurtRadius || 0.8, // fallback
      onDeath: opts.onDeath || null,
    });
    try {
      console.log(`CombatSystem: registerEntity -> id='${id}', team='${opts.team || 'neutral'}'`);
    } catch (e) {}
  }

  unregisterEntity(id) {
    this.entities.delete(id);
  }

  // Crear y activar un hitbox a partir de un atacante (por ejemplo en el frame del ataque)
  spawnHitbox(ownerId, opts = {}) {
    const hb = new Hitbox(ownerId, opts);
    hb.activate();
    // optionally create a visible debug mesh when requested (useful to visualize hitboxes)
    try {
      if (window && window.DEBUG_HITBOX && typeof window.scene !== 'undefined') {
        const geo = new THREE.SphereGeometry(hb.radius, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `hitbox_debug_${ownerId}`;
        mesh.frustumCulled = false;
        window.scene.add(mesh);
        hb._debugMesh = mesh;
      }
    } catch (e) {}

    this.hitboxes.push(hb);
    return hb;
  }

  // Aplicar un ataque frontal simple: crea un hitbox a cierta distancia frontal
  applyFrontalAttack(ownerId, {damage = 10, range = 1.5, radius = 0.8, duration = 0.18, offsetHeight = 0.9, friendlyFire = false} = {}) {
    const owner = this.entities.get(ownerId);
    if (!owner) return null;
    // compute offset in model-local space so Hitbox.updateWorldPosition can use localToWorld
    // local forward in three.js FBX models is typically -Z, so place hitbox at (0, offsetHeight, -range)
    const offsetLocal = new THREE.Vector3(0, offsetHeight, -range);

    const hb = this.spawnHitbox(ownerId, {
      damage,
      duration,
      radius,
      offset: offsetLocal,
      friendlyFire,
    });

    try { console.log(`CombatSystem: spawnHitbox owner='${ownerId}' dmg=${damage} range=${range} radius=${radius}`); } catch (e) {}
    return hb;
  }

  // calcular bounding sphere simple para la entidad (cache-friendly)
  _getEntitySphere(entity) {
    if (!entity || !entity.model) return null;
    // intentar usar Box3 del modelo, asegurando matrices mundiales actualizadas
    try {
      if (entity.model.updateMatrixWorld) entity.model.updateMatrixWorld(true);
    } catch (e) {}
    const box = new THREE.Box3().setFromObject(entity.model);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    // si sphere.radius es 0 (modelo vacío), fallback a posición
    if (!sphere.radius || sphere.radius === 0) {
      // intentar usar posición mundial del modelo
      const worldPos = new THREE.Vector3();
      try { entity.model.getWorldPosition(worldPos); } catch (e) { worldPos.copy(entity.model.position || new THREE.Vector3()); }
      sphere.center.copy(worldPos);
      sphere.radius = entity.hurtRadius || 0.8;
    }
    return sphere;
  }

  // actualizar: chequear hitboxes y aplicar daño (llamar desde el loop principal)
  update(delta) {
    const now = performance.now();

    // actualizar posiciones hitboxes
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hb = this.hitboxes[i];
      const owner = this.entities.get(hb.ownerId);
      if (!owner) {
        // remover hitbox si owner no existe
        this.hitboxes.splice(i, 1);
        continue;
      }

      hb.updateWorldPosition(owner.model);

      // update debug mesh position/scale if present
      try {
        if (hb._debugMesh) {
          hb._debugMesh.position.copy(hb._worldSphere.center);
          const s = Math.max(0.001, hb._worldSphere.radius);
          hb._debugMesh.scale.set(s, s, s);
        }
      } catch (e) {}

      // comprobar colisiones contra entidades
      for (const [id, entity] of this.entities.entries()) {
        if (id === hb.ownerId) continue; // no golpearse a sí mismo
        if (!entity.health || !entity.health.isAlive()) continue;
        if (!hb.friendlyFire && entity.team && owner.team && entity.team === owner.team) continue;

        const targetSphere = this._getEntitySphere(entity);
        if (!targetSphere) continue;

        let didHit = false;
        if (hb.intersectsSphere(targetSphere) && !hb.consumed) {
          didHit = true;
        }

        // Fallback por distancia si la intersección con boundingSphere falla
        if (!didHit && !hb.consumed) {
          try {
            const entPos = new THREE.Vector3();
            if (entity.model && typeof entity.model.getWorldPosition === 'function') entity.model.getWorldPosition(entPos);
            else entPos.copy(entity.model.position || new THREE.Vector3());
            const dist = hb._worldSphere.center.distanceTo(entPos);
            const targetRadius = (entity.hurtRadius || targetSphere.radius || 0.8);
            if (dist <= (hb._worldSphere.radius + targetRadius + 0.15)) {
              // consider a hit by proximity
              try { console.log(`CombatSystem: fallback-distance hit owner='${hb.ownerId}' -> target='${id}' dist=${dist.toFixed(2)} threshold=${(hb._worldSphere.radius + targetRadius + 0.15).toFixed(2)}`); } catch (e) {}
              didHit = true;
            }
          } catch (e) {
            // ignore fallback errors
          }
        }

        if (didHit && !hb.consumed) {
          // aplicar daño y marcar consumido para hit único
          try {
            const before = entity.health.current;
            const died = entity.health.takeDamage(hb.damage, { from: hb.ownerId });
            hb.consumed = true;
            const after = entity.health.current;
            try { console.log(`CombatSystem: hit owner='${hb.ownerId}' -> target='${id}' damage=${hb.damage} hp:${before}->${after}`); } catch (e) {}
            try {
              if (entity.onDeath && died) entity.onDeath(hb.ownerId);
            } catch (err) {
              console.warn('onDeath callback failed', err);
            }
          } catch (err) {
            console.warn('CombatSystem: error applying damage', err);
          }
        }
      }

      // eliminar hitbox expirado
      if (hb.isExpired(now) || hb.consumed) {
        try {
          if (hb._debugMesh && window && window.scene) {
            window.scene.remove(hb._debugMesh);
            if (hb._debugMesh.geometry) hb._debugMesh.geometry.dispose();
            if (hb._debugMesh.material) hb._debugMesh.material.dispose();
          }
        } catch (e) {}
        this.hitboxes.splice(i, 1);
      }
    }
  }
}

// Helper de integración: registra una entidad y conecta callbacks de muerte para reproducir animación
export function integrateEntityWithCombat(system, id, model, maxHealth = 100, opts = {}) {
  const hc = new HealthComponent(maxHealth, {
    invulnSeconds: opts.invulnSeconds || 0.5,
    onDeath: (source) => {
      // reproducir animación death si existe
      try {
        const controller = model && model.userData ? model.userData.controller : null;
        if (controller) {
          // marcar estado muerto para que otros sistemas no sobreescriban la animación
          try { controller._isDead = true; if (typeof controller.setInputEnabled === 'function') controller.setInputEnabled(false); } catch (e) {}
          if (typeof controller.playAnimation === 'function') {
            controller.playAnimation('death');
          } else if (controller.modelLoader && controller.modelLoader.actions && controller.modelLoader.actions.death) {
            try {
              const a = controller.modelLoader.actions.death;
              a.setLoop(THREE.LoopOnce, 0);
              a.clampWhenFinished = true;
              controller.modelLoader.play('death', 0.12);
            } catch (e) {}
          }
        }
      } catch (err) {
        // noop
      }
      // ocultar modelo después de la duración del clip de muerte (si podemos estimarla)
      try {
        const controller = model && model.userData ? model.userData.controller : null;
        let delayMs = 1200;
        // intentar obtener duración desde posibles lugares
        if (controller) {
          // Alien1: controller.animations?.death?.duration
          const deathClip = (controller.animations && controller.animations.death) ? controller.animations.death : null;
          if (deathClip && typeof deathClip.duration === 'number') {
            delayMs = Math.max(delayMs, Math.floor(deathClip.duration * 1000));
          }
          // Farmer: controller.modelLoader?.actions?.death?.getClip().duration
          try {
            const act = controller.modelLoader && controller.modelLoader.actions ? controller.modelLoader.actions.death : null;
            const clip = act && typeof act.getClip === 'function' ? act.getClip() : null;
            if (clip && typeof clip.duration === 'number') {
              delayMs = Math.max(delayMs, Math.floor(clip.duration * 1000));
            }
          } catch (e) {}
        }
        // permitir override
        if (typeof opts.hideDelayMs === 'number') delayMs = Math.max(delayMs, opts.hideDelayMs);

        if (opts.disableOnDeath && model) {
          setTimeout(() => { try { if (model) model.visible = false; } catch (e) {} }, delayMs);
        }
      } catch (e) {
        if (opts.disableOnDeath && model) model.visible = false;
      }
    },
    onDamage: (amount, source) => {
      // opcional: flash material, sonido, etc.
      // console.log(`${id} took ${amount} from ${source?.from}`);
    }
  });

  system.registerEntity(id, model, hc, { team: opts.team || 'enemy', hurtRadius: opts.hurtRadius || 0.8, onDeath: opts.onDeath });
  return hc;
}

// Debug helper global (opcional)
window.createCombatSystem = function () {
  if (!window.combatSystem) window.combatSystem = new CombatSystem();
  return window.combatSystem;
};

export default CombatSystem;

// Debug helper: print registered entities and their world positions / bounding spheres
window.printCombatEntities = function () {
  try {
    const sys = window.combatSystem;
    if (!sys) return console.warn('No combatSystem on window');
    console.log('CombatSystem entities:');
    for (const [id, ent] of sys.entities.entries()) {
      try {
        const sphere = sys._getEntitySphere(ent);
        console.log(id, { team: ent.team, model: !!ent.model, pos: ent.model ? (ent.model.getWorldPosition ? ent.model.getWorldPosition(new THREE.Vector3()) : ent.model.position) : null, sphere });
      } catch (e) { console.warn('Error printing entity', id, e); }
    }
  } catch (e) { console.warn('printCombatEntities error', e); }
};
