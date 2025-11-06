import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/SkeletonUtils.js";
import { ModelLoader } from "./modelLoader.js";

// BuildingManager: administra estructuras decorativas colocadas en el mapa.
// - Registra tipos (prototipos) cargando el FBX una vez.
// - Clona instancias de esos prototipos y las añade a la escena principal.
// Nota/Asunción: por convención asumo que los modelos estarán en
// `src/models/characters/building/` a menos que se pase otro basePath.

export class BuildingManager {
	constructor(scene, options = {}) {
		this.scene = scene;
		this.basePath = options.basePath || "src/models/characters/building/";
		// Optional terrain reference to snap buildings to ground
		this.terrain = options.terrain || null;
		this.prototypes = new Map(); // type -> { model, config }
		this.instances = new Map(); // id -> { id, type, object }
		this._nextId = 1;
	}

	// Carga un prototipo y lo guarda sin añadirlo a la escena principal.
	// modelFile: string (archivo .fbx)
	// config: objeto opcional que se pasa a ModelLoader (scale, settings.height, ...)
	async registerStructureType(type, modelFile, config = {}) {
		if (!type || !modelFile) throw new Error("type y modelFile son requeridos");

		const tempScene = new THREE.Scene();
		const loader = new ModelLoader(tempScene);

		// Cargamos en escena temporal para evitar añadirlo a la escena real.
		await loader.load(this.basePath + modelFile, {}, null, config);

		const proto = loader.model;

		// Try to apply known textures for certain structure types
		try {
			await this._applyTexturesByType(type, proto);
		} catch (e) {
			// Non-fatal: continue without textures
			return e;
		}

		// Desvincularlo de la escena temporal para mantenerlo como prototipo.
		if (proto.parent) proto.parent.remove(proto);

		// Guardar el prototipo (sin añadirlo a la escena principal)
		this.prototypes.set(type, { model: proto, config });
		return true;
	}

	/**
	 * Helper to try loading a texture from multiple candidate paths
	 * Returns a Promise that resolves to a THREE.Texture or null on failure
	 */
	_loadTextureCandidate(filename) {
		const loader = new THREE.TextureLoader();
		const candidates = [
			`${this.basePath}textures/${filename}`,
			`${this.basePath}${filename}`,
			`src/assets/${filename}`,
			`./src/assets/${filename}`,
		];

		return new Promise((resolve) => {
			let resolved = false;
			let pending = 0;
			for (const p of candidates) {
				pending++;
				loader.load(
					p,
					(tex) => {
						if (resolved) return;
						resolved = true;
						resolve(tex);
					},
					undefined,
					() => {
						pending--;
						if (pending === 0 && !resolved) resolve(null);
					}
				);
			}
			// if no candidates, resolve null
			if (candidates.length === 0) resolve(null);
		});
	}

	/**
	 * Assign textures to a loaded prototype based on known type -> texture mappings
	 * This is heuristic: it matches texture keywords to mesh/material names.
	 */
	async _applyTexturesByType(type, root) {
		if (!root || !root.traverse) return;

		const mapping = {
			alienHouse: [
				{ nameKeywords: ['wall', 'Wall'], file: 'wallDIFF.png' },
				{ nameKeywords: ['window', 'Window'], file: 'windowDIFF.png' },
				{ nameKeywords: ['concrete', 'Concrete'], file: 'concreteDIFF.png' },
				{ nameKeywords: ['pilla', 'pilar', 'pillar', 'Pilla'], file: 'pillaDIFF.png' },
			],
			alienPyramid: [
				{ nameKeywords: ['pyramid', 'Pyramid', 'perm', 'permid', 'permId'], file: 'tvariant2_diffuse.png' },
			],
			// alienLab: no textures provided; keep as-is
		};

		const rules = mapping[type];
		if (!rules || rules.length === 0) return;

		// Preload texture promises
		const texPromises = [];
		for (const r of rules) {
			texPromises.push(this._loadTextureCandidate(r.file).then((tex) => ({ rule: r, tex })));
		}

		const results = await Promise.all(texPromises);

		// For each mesh/material, try to assign texture if its name matches keywords
		root.traverse((child) => {
			if (!child.isMesh) return;
			const matList = Array.isArray(child.material) ? child.material : [child.material];
			for (const mat of matList) {
				if (!mat) continue;
				const matName = (mat.name || child.name || '').toLowerCase();
				for (const res of results) {
					if (!res.tex) continue;
					for (const kw of res.rule.nameKeywords) {
						if (!kw) continue;
						if (matName.includes(kw.toLowerCase())) {
							mat.map = res.tex;
							mat.needsUpdate = true;
							break;
						}
					}
				}
			}
		});
	}

	// Añade una instancia clonada del prototipo a la escena.
	// options: { position: Vector3|{x,y,z}, rotation: Euler|{x,y,z}, scale: number|{x,y,z} }
	addStructure(type, options = {}) {
		const proto = this.prototypes.get(type);
		if (!proto) throw new Error(`Prototipo no registrado: ${type}`);

		// Deep-clone that preserves skinned meshes / skeletons
		const clone = SkeletonUtils.clone(proto.model);

		// Apply default per-type scale if caller didn't provide one
		const defaultScales = {
			// Increased sizes (much larger) per request
			alienHouse: 6.0,
			alienLab: 6.0,
			alienPyramid: 8.0,
		};
		if (options.scale === undefined) {
			const ds = defaultScales[type] || 1.5;
			clone.scale.multiplyScalar(ds);
		}

		// Apply transforms
		if (options.position) {
			const p = options.position;
			if (p.isVector3) clone.position.copy(p);
			else clone.position.set(p.x || 0, p.y || 0, p.z || 0);
		}

		if (options.rotation) {
			const r = options.rotation;
			if (r.isEuler) clone.rotation.copy(r);
			else clone.rotation.set(r.x || 0, r.y || 0, r.z || 0);
		}

		if (options.scale !== undefined) {
			if (typeof options.scale === "number") clone.scale.multiplyScalar(options.scale);
			else clone.scale.set(options.scale.x || 1, options.scale.y || 1, options.scale.z || 1);
		}

		// Fix orientation issues for known models (e.g., pyramid is upside-down)
		try {
			if (type === 'alienPyramid') {
				// rotate 180 degrees on X to flip upright
				clone.rotation.x += Math.PI;
			}
		} catch (e) {}

		const id = options.id || this._nextId++;

		// Snap clone to terrain if available and position provided
		try {
			if (options.position) {
				const pos = options.position;
				// ensure clone has x/z set for bbox calc
				clone.position.x = pos.x || 0;
				clone.position.z = pos.z || 0;
				// temporarily set y=0 to compute local bbox
				clone.position.y = 0;
				let terrainY = 0;
				if (this.terrain && typeof this.terrain.getHeightAtPosition === 'function') {
					terrainY = this.terrain.getHeightAtPosition(clone.position.x, clone.position.z) || 0;
				} else if (pos.y !== undefined) {
					terrainY = pos.y;
				}
				// ensure world matrices are current, then compute bbox and lift so model base sits on terrain
				clone.updateMatrixWorld(true);
				const box = new THREE.Box3().setFromObject(clone);
				const minY = box.min.y;
				clone.position.y = terrainY - minY;
			} else {
				// no position provided, just add at default (y is whatever the model contains)
			}
		} catch (e) {
			// non-fatal
			return e;
		}

		clone.userData._buildingId = id;
		this.scene.add(clone);

		const instance = { id, type, object: clone };
		// compute and store bounding box for collision queries and external consumers
		try {
			clone.updateMatrixWorld(true);
			instance.bbox = new THREE.Box3().setFromObject(clone);
		} catch (e) { instance.bbox = null; }

		// create a visible=false collider mesh so other systems can reference an Object3D for collisions
		try {
			if (instance.bbox) {
				const size = instance.bbox.getSize(new THREE.Vector3());
				const center = instance.bbox.getCenter(new THREE.Vector3());
				const geom = new THREE.BoxGeometry(Math.max(0.001, size.x), Math.max(0.001, size.y), Math.max(0.001, size.z));
				const mat = new THREE.MeshBasicMaterial({ visible: false });
				const collider = new THREE.Mesh(geom, mat);
				collider.position.copy(center);
				collider.userData._buildingCollider = true;
				collider.userData.buildingId = id;
				// keep collider from being frustum culled (optional)
				collider.frustumCulled = false;
				this.scene.add(collider);
				instance.collider = collider;
			} else {
				instance.collider = null;
			}
		} catch (e) {
			instance.collider = null;
		}

		this.instances.set(id, instance);
		return id;
	}

	// Remove an instance by id. Does NOT fully dispose shared materials by default.
	removeStructure(id) {
		const inst = this.instances.get(id);
		if (!inst) return false;

		// Remove from scene
		if (inst.object && inst.object.parent) inst.object.parent.remove(inst.object);
		// remove collider if present
		if (inst.collider && inst.collider.parent) {
			try {
				inst.collider.parent.remove(inst.collider);
				if (inst.collider.geometry) inst.collider.geometry.dispose();
				if (inst.collider.material) inst.collider.material.dispose();
			} catch (e) {}
		}

		// Optionally, attempt to dispose geometry/buffers — but prototypes may share materials.
		// To avoid accidental disposal of prototype resources, we only dispose geometries
		// created per-instance (rare). For safe disposal of textures/materials, do it manually
		// when you know they are unique.

		this.instances.delete(id);
		return true;
	}

	getAllStructures() {
		return Array.from(this.instances.values()).map((i) => ({ id: i.id, type: i.type, object: i.object, bbox: i.bbox || null }));
	}

	// Remove all instances (keeps prototypes)
	clearAll() {
		for (const [id, inst] of this.instances.entries()) {
			if (inst.object && inst.object.parent) inst.object.parent.remove(inst.object);
			if (inst.collider && inst.collider.parent) {
				try { inst.collider.parent.remove(inst.collider); } catch (e) {}
				try { if (inst.collider.geometry) inst.collider.geometry.dispose(); } catch (e) {}
				try { if (inst.collider.material) inst.collider.material.dispose(); } catch (e) {}
			}
			this.instances.delete(id);
		}
	}


	_computeAvoidBoxes(avoidObjects = []) {
		const boxes = [];
		for (const o of avoidObjects) {
			try {
				if (!o) continue;
				if (o.isBox3 || (o.min && o.max)) {
					boxes.push(o);
					continue;
				}
				// If object has getBoundingBox method
				if (typeof o.getBoundingBox === 'function') {
					const b = o.getBoundingBox();
					if (b) boxes.push(b);
					continue;
				}
				// If caller passed a wrapper { object, bbox, type } use its inner object/bbox
				if (o.object && o.object.isObject3D) {
					const bb = new THREE.Box3().setFromObject(o.object);
					boxes.push(bb);
					continue;
				}
				if (o.bbox && o.bbox.min && o.bbox.max) {
					boxes.push(o.bbox);
					continue;
				}
				// If it's an Object3D, compute from object
				if (o.isObject3D) {
					const bb = new THREE.Box3().setFromObject(o);
					boxes.push(bb);
					continue;
				}
			} catch (e) {
				// ignore malformed avoid entries
			}
		}
		return boxes;
	}

	isPositionFree(position, avoidBoxes = [], clearance = 3) {
		// Determine the correct Y for the candidate box: prefer provided position.y
		// but if the terrain is available, sample it so the check occurs at ground level.
		let posY = 0;
		try {
			if (position && position.y !== undefined && position.y !== null) posY = position.y;
			else if (this.terrain && typeof this.terrain.getHeightAtPosition === 'function') {
				posY = this.terrain.getHeightAtPosition(position.x, position.z) || 0;
			}
		} catch (e) {
			posY = position.y || 0;
		}
		const center = position.clone();
		center.y = posY;
		// candidate box centered at position with given clearance
		const size = new THREE.Vector3(clearance * 2, clearance * 2, clearance * 2);
		const candidate = new THREE.Box3().setFromCenterAndSize(center, size);

		// Check against provided avoid boxes
		for (const ab of avoidBoxes) {
			if (!ab || !ab.isBox3 && !(ab.min && ab.max)) continue;
			const expanded = ab.clone().expandByScalar(clearance * 0.8);
			if (expanded.intersectsBox(candidate)) return false;
		}

		// Check against other placed instances
			for (const inst of this.instances.values()) {
				if (!inst || !inst.object) continue;
				let instBox = null;
				if (inst.bbox && inst.bbox.min && inst.bbox.max) {
					instBox = inst.bbox;
				} else {
					try {
						inst.object.updateMatrixWorld(true);
						instBox = new THREE.Box3().setFromObject(inst.object);
						// cache for future checks
						inst.bbox = instBox;
					} catch (e) {
						continue;
					}
				}
				const expandedInst = instBox.clone().expandByScalar(clearance * 0.5);
				if (expandedInst.intersectsBox(candidate)) return false;
			}

		return true;
	}


	findFreePosition(bounds, avoidObjects = [], clearance = 3, maxAttempts = 200) {
		const avoidBoxes = this._computeAvoidBoxes(avoidObjects);
		for (let i = 0; i < maxAttempts; i++) {
			const x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
			const z = Math.random() * (bounds.maxZ - bounds.minZ) + bounds.minZ;
			// sample terrain height if available so position checks happen at ground level
			let y = 0;
			try {
				if (this.terrain && typeof this.terrain.getHeightAtPosition === 'function') {
					y = this.terrain.getHeightAtPosition(x, z) || 0;
				}
			} catch (e) { y = 0; }
			const pos = new THREE.Vector3(x, y, z);
			if (this.isPositionFree(pos, avoidBoxes, clearance)) return pos;
		}
		return null;
	}

	/**
	 * Deterministic nearby search (grid/spiral) to find a free position near a given point.
	 * This avoids randomness by scanning offsets in a predictable order.
	 */
	_findNearbyFreePosition(origin, bounds, avoidObjects = [], clearance = 3, maxRadius = 30, step = 2) {
		const avoidBoxes = this._computeAvoidBoxes(avoidObjects);
		// origin: THREE.Vector3
		if (!origin || !origin.isVector3) return null;
		// ensure we use terrain height if available
		let baseY = origin.y;
		try {
			if ((baseY === undefined || baseY === null) && this.terrain && typeof this.terrain.getHeightAtPosition === 'function') baseY = this.terrain.getHeightAtPosition(origin.x, origin.z) || 0;
		} catch (e) { baseY = baseY || 0; }

		// spiral search on grid
		for (let r = step; r <= maxRadius; r += step) {
			for (let dx = -r; dx <= r; dx += step) {
				for (let dz = -r; dz <= r; dz += step) {
					// only consider positions on the perimeter of the square to be more spiral-like
					if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
					const x = origin.x + dx;
					const z = origin.z + dz;
					if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
					let y = baseY;
					try { if (this.terrain && typeof this.terrain.getHeightAtPosition === 'function') y = this.terrain.getHeightAtPosition(x, z) || y; } catch (e) {}
					const pos = new THREE.Vector3(x, y, z);
					if (this.isPositionFree(pos, avoidBoxes, clearance)) return pos;
				}
			}
		}
		return null;
	}


	placeOneOfEach(types = [], bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, avoidObjects = [], opts = {}) {
		if (!Array.isArray(types) || types.length === 0) types = Array.from(this.prototypes.keys());
		const placed = [];
		const clearance = opts.clearance || 4;

		// To avoid creating buildings in random locations, require explicit positions
		// to be provided in opts.positions. If none provided, do not attempt random placement.
		if (!opts.positions) {
			return [];
		}
		for (const t of types) {
			let pos = null;
			// If caller provided explicit positions map or array, prefer those
			if (opts.positions) {
				if (Array.isArray(opts.positions)) {
					// array aligned with types
					const idx = types.indexOf(t);
					if (idx >= 0 && opts.positions[idx]) pos = opts.positions[idx];
				} else if (opts.positions[t]) {
					pos = opts.positions[t];
				}
			}
			// If positions were provided but this type has no entry, skip to avoid randomness
			if (opts.positions && !pos) {
				continue;
			}
			if (pos) {
				// normalize to THREE.Vector3
				if (!(pos.isVector3)) pos = new THREE.Vector3(pos.x || 0, pos.y || 0, pos.z || 0);
				// if caller didn't provide y, sample terrain height so we check & place on ground
				if ((pos.y === undefined || pos.y === null || pos.y === 0) && this.terrain && typeof this.terrain.getHeightAtPosition === 'function') {
					try { pos.y = this.terrain.getHeightAtPosition(pos.x, pos.z) || 0; } catch (e) { pos.y = pos.y || 0; }
				}
				// Ensure provided position lies within bounds; otherwise try fallback
				if (pos.x < bounds.minX || pos.x > bounds.maxX || pos.z < bounds.minZ || pos.z > bounds.maxZ) {
					// clamp origin to bounds to start nearby search
					const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
					const clampedZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
					const origin = new THREE.Vector3(clampedX, pos.y || 0, clampedZ);
					const nearby = this._findNearbyFreePosition(origin, bounds, avoidObjects, clearance, opts.nearbyMaxRadius || 60, opts.nearbyStep || 2);
					if (!nearby) { console.warn(`No fallback found for ${t}`); continue; }
					pos = nearby;
				}
				// check free
				if (!this.isPositionFree(pos, this._computeAvoidBoxes(avoidObjects), clearance)) {
					// deterministic nearby search (no randomness)
					const nearby = this._findNearbyFreePosition(pos, bounds, avoidObjects, clearance, opts.nearbyMaxRadius || 60, opts.nearbyStep || 2);
					if (!nearby) { console.warn(`No free position available near provided position for ${t}`); continue; }
					pos = nearby;
				}
			} else {
				continue;
			}
			const id = this.addStructure(t, { position: pos, scale: opts.scale });
			placed.push(id);
		}
		return placed;
	}

	// Convenience: preload the three structures the user mencionó
	// Assumptions about filenames are documented in README/comments.
	async preloadDefaults() {
		// These are based on the user's provided names
		// alienHouse -> building.fbx
		// alienLab   -> Bina.fbx
		// alienPyramid -> permid.fbx
		await this.registerStructureType("alienHouse", "building.fbx", {});
		await this.registerStructureType("alienLab", "Bina.fbx", {});
		await this.registerStructureType("alienPyramid", "permid.fbx", {});
	}

	/**
	 * Devuelve un listado de objetos de colisión para las estructuras colocadas.
	 * Cada objeto expone checkCollision(position, size) para integrarlo con FarmerController.
	 */
	getColliders() {
		const out = [];
		for (const inst of this.instances.values()) {
			if (!inst) continue;
			// Recompute bbox from object to ensure it's up-to-date
			let bbox = inst.bbox;
			try {
				if (inst.object) {
					inst.object.updateMatrixWorld(true);
					bbox = new THREE.Box3().setFromObject(inst.object);
					// cache it
					inst.bbox = bbox;
				}
			} catch (e) {
				bbox = inst.bbox || null;
			}
			try {
				if (bbox) {
					const size = bbox.getSize(new THREE.Vector3());
				} else {
					return
				}
			} catch (e) {}
			const collider = {
				id: inst.id,
				type: inst.type,
				object: inst.object,
				bbox,
				// checkCollision: acepta (position:THREE.Vector3, size:THREE.Vector3)
				checkCollision(pos, size) {
					try {
						if (!bbox) return false;
						const charSize = size || new THREE.Vector3(1, 1, 1);
						const characterBox = new THREE.Box3().setFromCenterAndSize(pos.clone(), charSize.clone());
						// Expand building bbox slightly to be conservative
						const b = bbox.clone().expandByScalar(0.01);
						return b.intersectsBox(characterBox);
					} catch (e) { return false; }
				}
			};
			out.push(collider);
		}
		return out;
	}
}

export default BuildingManager;

