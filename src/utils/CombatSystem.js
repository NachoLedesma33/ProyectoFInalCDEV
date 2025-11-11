import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

export class HealthComponent {
  constructor(maxHealth = 100, opts = {}) {
    this.maxHealth = maxHealth;
    this.current = maxHealth;
    this.invulnSeconds = opts.invulnSeconds || 0.5;
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
      return err;
    }

    if (this.current <= 0) {
      this.current = 0;
      try {
        this.onDeath(source);
      } catch (err) {
        return err;
      }
      return true; 
    }
    return false;
  }

  heal(amount) {
    this.current = Math.min(this.maxHealth, this.current + amount);
  }
}export class Hitbox {
  constructor(ownerId, opts = {}) {
    this.ownerId = ownerId;
    this.damage = opts.damage || 10;
    this.duration = opts.duration || 0.2; 
    this.radius = opts.radius || 1.0; 
    this.offset = opts.offset || new THREE.Vector3(0, 0, 0); 
    this.startAt = null;
    this.active = false;
    this.consumed = false; 
    this.friendlyFire = !!opts.friendlyFire;
    this.shape = opts.shape || 'sphere';
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
  updateWorldPosition(ownerModel) {
    if (!ownerModel) return;
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
export class CombatSystem {
  constructor() {
    this.entities = new Map(); 
    this.hitboxes = []; 
    this._tmpSphere = new THREE.Sphere();
  }
  registerEntity(id, model, healthComponent, opts = {}) {
    if (!id || !model || !healthComponent) {
      throw new Error('registerEntity: id, model y healthComponent son requeridos');
    }
    this.entities.set(id, {
      id,
      model,
      health: healthComponent,
      team: opts.team || 'neutral',
      hurtRadius: opts.hurtRadius || 0.8,
      onDeath: opts.onDeath || null,
    });
  }

  unregisterEntity(id) {
    this.entities.delete(id);
  }
  spawnHitbox(ownerId, opts = {}) {
    const hb = new Hitbox(ownerId, opts);
    hb.activate();
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
  applyFrontalAttack(ownerId, {damage = 10, range = 1.5, radius = 0.8, duration = 0.18, offsetHeight = 0.9, friendlyFire = false} = {}) {
    const owner = this.entities.get(ownerId);
    if (!owner) return null;
    const offsetLocal = new THREE.Vector3(0, offsetHeight, -range);
    const hb = this.spawnHitbox(ownerId, {
      damage,
      duration,
      radius,
      offset: offsetLocal,
      friendlyFire,
    });

    return hb;
  }
  _getEntitySphere(entity) {
    if (!entity || !entity.model) return null;
    try {
      if (entity.model.updateMatrixWorld) entity.model.updateMatrixWorld(true);
    } catch (e) {}
    const box = new THREE.Box3().setFromObject(entity.model);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    if (!sphere.radius || sphere.radius === 0) {
      const worldPos = new THREE.Vector3();
      try { entity.model.getWorldPosition(worldPos); } catch (e) { worldPos.copy(entity.model.position || new THREE.Vector3()); }
      sphere.center.copy(worldPos);
      sphere.radius = entity.hurtRadius || 0.8;
    }
    return sphere;
  }
  update(delta) {
    const now = performance.now();
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hb = this.hitboxes[i];
      const owner = this.entities.get(hb.ownerId);
      if (!owner) {
        this.hitboxes.splice(i, 1);
        continue;
      }
      hb.updateWorldPosition(owner.model);
      try {
        if (hb._debugMesh) {
          hb._debugMesh.position.copy(hb._worldSphere.center);
          const s = Math.max(0.001, hb._worldSphere.radius);
          hb._debugMesh.scale.set(s, s, s);
        }
      } catch (e) {}
      for (const [id, entity] of this.entities.entries()) {
        if (id === hb.ownerId) continue; 
        if (!entity.health || !entity.health.isAlive()) continue;
        if (!hb.friendlyFire && entity.team && owner.team && entity.team === owner.team) continue;
        const targetSphere = this._getEntitySphere(entity);
        if (!targetSphere) continue;
        let didHit = false;
        if (hb.intersectsSphere(targetSphere) && !hb.consumed) {
          didHit = true;
        }
        if (!didHit && !hb.consumed) {
          try {
            const entPos = new THREE.Vector3();
            if (entity.model && typeof entity.model.getWorldPosition === 'function') entity.model.getWorldPosition(entPos);
            else entPos.copy(entity.model.position || new THREE.Vector3());
            const dist = hb._worldSphere.center.distanceTo(entPos);
            const targetRadius = (entity.hurtRadius || targetSphere.radius || 0.8);
            if (dist <= (hb._worldSphere.radius + targetRadius + 0.15)) {
              didHit = true;
            }
          } catch (e) {
            // ignore fallback errors
          }
        }

        if (didHit && !hb.consumed) {
          try {
            const before = entity.health.current;
            const died = entity.health.takeDamage(hb.damage, { from: hb.ownerId });
            hb.consumed = true;
            const after = entity.health.current;
            try {
              if (entity.onDeath && died) entity.onDeath(hb.ownerId);
            } catch (err) {
              return err;
            }
          } catch (err) {
            return err;
          }
        }
      }
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
export function integrateEntityWithCombat(system, id, model, maxHealth = 100, opts = {}) {
  const hc = new HealthComponent(maxHealth, {
    invulnSeconds: opts.invulnSeconds || 0.5,
    onDeath: (source) => {
      try {
        const controller = model && model.userData ? model.userData.controller : null;
        if (controller) {
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
      try {
        const controller = model && model.userData ? model.userData.controller : null;
        let delayMs = 1200;
        if (controller) {
          const deathClip = (controller.animations && controller.animations.death) ? controller.animations.death : null;
          if (deathClip && typeof deathClip.duration === 'number') {
            delayMs = Math.max(delayMs, Math.floor(deathClip.duration * 1000));
          }
          try {
            const act = controller.modelLoader && controller.modelLoader.actions ? controller.modelLoader.actions.death : null;
            const clip = act && typeof act.getClip === 'function' ? act.getClip() : null;
            if (clip && typeof clip.duration === 'number') {
              delayMs = Math.max(delayMs, Math.floor(clip.duration * 1000));
            }
          } catch (e) {}
        }
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
window.createCombatSystem = function () {
  if (!window.combatSystem) window.combatSystem = new CombatSystem();
  return window.combatSystem;
};

export default CombatSystem;

window.printCombatEntities = function () {
  try {
    const sys = window.combatSystem;
    for (const [id, ent] of sys.entities.entries()) {
      try {
        const sphere = sys._getEntitySphere(ent);
      } catch (e) { return e }
    }
  } catch (e) { return e }
};
