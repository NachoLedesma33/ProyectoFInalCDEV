import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/utils/SkeletonUtils.js";
import modelConfig from "../config/modelConfig.js";
import { safePlaySfx } from './audioHelpers.js';

export class Alien1 {
	constructor(scene, modelLoader, position = { x: 0, y: 0, z: 0 }, lookAt = { x: 0, y: 0, z: 0 }) {
		this.scene = scene;
		this.modelLoader = modelLoader;
		this.position = position;
		this.lookAt = lookAt;

		this.model = null;
		this.mixer = null;
		this.currentAction = null;
		this.animations = {}; 
		this._lastWallHit = null;
		this.moveSpeed = 0.10; 
		this.detectionRange = 25; 
		this.playerAggroRadius = 12; 
		this.attackRange = 1.4;
		this.attackDamage = 5; 
		this.attackCooldown = 1.0; 
		this._lastAttackAt = -Infinity;
		this._postAttackUntil = 0; 
		this._currentPunchClip = null; 
		this._impactTimeoutId = null; 
		this._mixerFinishedBound = this._onMixerFinished.bind(this);
		this.target = null; 
		this.state = 'idle';
		this.isDead = false; 
		this.attackDamage = 5; 
		this.attackCooldown = 1.0; 
		this._lastAttackAt = -Infinity;
		this._postAttackUntil = 0; 
		this._currentPunchClip = null; 
		this._impactTimeoutId = null; 
		this._mixerFinishedBound = this._onMixerFinished.bind(this);
		this.target = null; 
		this.state = 'idle';
		this.isDead = false; 
		this.colliderRadius = 0.6; 
		this.colliderHeight = 1.8; 
		this._obstacles = null; 
		this._obstaclesBuilt = false;
		this.combat = null; 
		this.entityId = null;
		this.healthComponent = null; 
		this.getPlayer = null; 
		this.getCows = null; 
		this.getCorralCenter = null;
		this.getStones = null;
		this.getCorral = null;
		this.getHouse = null;
		this.getMarket = null;
		this.getShip = null;
		this._animDiagnostics = {};
			this.getStones = null;
			this.getCorral = null;
			this.getHouse = null;
			this.getMarket = null;
			this.getShip = null;
			this._animDiagnostics = {}; 
			this._animLogEnabled = false;
			this._hb = {
				anchor: null, 
				group: null, 
				back: null,   
				fill: null,   
				chip: null,   
				width: 1.4,
				height: 0.14,
				marginAbove: 0.35,
				lastPct: 1,
				chipPct: 1,
				visible: true,
				_damageTexts: [] 
			};
		this._runAudio = null; 
		this._nextVoiceAt = 0; 
	}
	async load() {
		try {
			const cfg = modelConfig.characters.alien1;
			const modelPath = modelConfig.getPath(cfg.model);
			this.model = await new Promise((resolve, reject) => {
				const loader = new FBXLoader();
				loader.load(
					modelPath,
					(fbx) => resolve(fbx),
					undefined,
					(err) => reject(err)
				);
			});
			try {
				this.normalizeSkinWeightsInModel(this.model);
			} catch (e) {
				// non-critical
			}
			try {
				const box = new THREE.Box3().setFromObject(this.model);
				const size = new THREE.Vector3();
				box.getSize(size);
				const targetHeight = (cfg && cfg.settings && cfg.settings.height) ? cfg.settings.height : 1.9;
				let scaleFactor = 1;
				if (size.y > 0) scaleFactor = targetHeight / size.y;
				// allow optional cfg.scale multiplier
				if (typeof cfg.scale === 'number') scaleFactor *= cfg.scale;
				else if (cfg.scale && typeof cfg.scale === 'object') scaleFactor *= (cfg.scale.x || cfg.scale.y || cfg.scale.z || 1);
				this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
				this.model.position.x = this.position.x;
				this.model.position.z = this.position.z;
				const newBox = new THREE.Box3().setFromObject(this.model);
				const minY = newBox.min.y !== undefined ? newBox.min.y : 0;
				this.model.position.y = this.position.y - minY;
			} catch (e) {
				// fallback
				this.model.position.set(this.position.x, this.position.y, this.position.z);
			}
			try {
				if (cfg && typeof cfg.moveSpeed === 'number') this.moveSpeed = cfg.moveSpeed;
			} catch (e) {}

			this.mixer = new THREE.AnimationMixer(this.model);
			try {
				this.mixer.addEventListener('finished', this._mixerFinishedBound);
			} catch (e) {
				// algunos entornos pueden lanzar si el mixer ya tiene listeners
			}
			const animCfg = cfg.animations || {};
			const animNames = Object.keys(animCfg);
			const buildBoneIndex = (obj) => {
				const list = [];
				obj.traverse((c) => {
					if (c.isBone) list.push(c.name||'');
					if (c.skeleton && c.skeleton.bones) c.skeleton.bones.forEach(b => list.push(b.name||''));
				});
				const uniq = Array.from(new Set(list.filter(Boolean)));
				const index = { namesLower: new Set(), bySanitized: new Map(), all: uniq };
				for (const n of uniq) {
					const lc = (n||'').toLowerCase();
					index.namesLower.add(lc);
					const san = Alien1._sanitizeBoneName(lc);
					if (!index.bySanitized.has(san)) index.bySanitized.set(san, n);
				}
				return index;
			};
			this._boneIndex = this.model ? buildBoneIndex(this.model) : { namesLower: new Set(), bySanitized: new Map(), all: [] };
			const modelBoneNames = this._boneIndex ? this._boneIndex.namesLower : new Set();

			for (const name of animNames) {
				const path = modelConfig.getPath(animCfg[name]);
				await this.loadAnimation(name, path, modelBoneNames);
			}
			if (this.model.animations && this.model.animations.length > 0) {
				this.model.animations.forEach((clip, idx) => {
					const key = clip.name || `clip_${idx}`;
					if (!this.animations[key]) this.animations[key] = clip;
				});
			}
			try {
				if (!this.animations.run && this.animations.walk) {
					this.animations.run = this.animations.walk;;
				}
				if (!this.animations.walk && this.animations.run) {
					this.animations.walk = this.animations.run;;
				}
				if (!this.animations.idle && this.animations.combatIdle) {
					this.animations.idle = this.animations.combatIdle;;
				}
			} catch (e) {
				// non-critical
			}
			try {
				const keys = Object.keys(this.animations || {}).map(k => k.toLowerCase());
				const findKey = (subs) => {
					for (const k of Object.keys(this.animations || {})) {
						const kl = k.toLowerCase();
						for (const s of subs) if (kl.includes(s)) return k;
					}
					return null;
				};
				if (!this.animations.idle) {
					const candidate = findKey(['idle','rest','stand']);
					if (candidate) { this.animations.idle = this.animations[candidate]; }
				}
				if (!this.animations.walk) {
					const candidate = findKey(['walk','walking','walk_forward','walkforward','stride']);
					if (candidate) { this.animations.walk = this.animations[candidate]; }
				}
				if (!this.animations.run) {
					const candidate = findKey(['run','sprint','fast','jog']);
					if (candidate) { this.animations.run = this.animations[candidate]; }
				}
			} catch (e) {
				// non-critical auto-mapping failure
			}
			try {
				const box = new THREE.Box3().setFromObject(this.model);
				const minY = box.min.y !== undefined ? box.min.y : 0;
				this.model.position.y = this.position.y - minY;
			} catch (e) {
				this.model.position.y = this.position.y;
			}
			const target = new THREE.Vector3(this.lookAt.x, this.model.position.y, this.lookAt.z);
			this.model.lookAt(target);
			this.model.visible = true;
			this.scene.add(this.model);
			try { this._createHealthbar(); } catch (e) { console.warn('Alien1: no se pudo crear healthbar', e); }
			setTimeout(() => {
				if (this.animations.idle) this.playAnimation('idle');
				else {
					const first = Object.keys(this.animations)[0];
					if (first) this.playAnimation(first);
				}
			}, 100);

			return true;
		} catch (err) {
			console.error('Error cargando Alien1:', err);
			return false;
		}
	}
	async loadAnimation(name, path) {
		try {
			const animation = await new Promise((resolve, reject) => {
				const loader = new FBXLoader();
				loader.load(
					path,
					(fbx) => {
						if (fbx.animations && fbx.animations.length > 0) resolve({ fbx, clip: fbx.animations[0] });
						else reject(new Error('No animations in fbx'));
					},
					undefined,
					(err) => reject(err)
				);
			});
			const modelBoneNames = arguments[2] || new Set();
			const diag = { name, path, loaded: false, retargeted: false, commonBones: 0, animBones: 0, modelBones: modelBoneNames.size, duration: 0, skippedReason: null };

			try {
				const animBoneNames = new Set();
				animation.fbx.traverse((c) => {
					if (c.isBone) animBoneNames.add((c.name||'').toLowerCase());
					if (c.skeleton && c.skeleton.bones) c.skeleton.bones.forEach(b=>animBoneNames.add((b.name||'').toLowerCase()));
				});
				let common = 0;
				animBoneNames.forEach(n => { if (modelBoneNames.has(n)) common++; });
				diag.commonBones = common;
				diag.animBones = animBoneNames.size;
			} catch (e) {}
			let usedClip = animation.clip;
			try {
				let hasSkeleton = false;
				try {
					animation.fbx.traverse((obj) => { if (!hasSkeleton && obj.isSkinnedMesh && obj.skeleton && obj.skeleton.bones) hasSkeleton = true; });
				} catch (_) {}
				if (hasSkeleton && SkeletonUtils && typeof SkeletonUtils.retargetClip === 'function') {
					const retargeted = SkeletonUtils.retargetClip(this.model, animation.fbx, animation.clip);
					if (retargeted && retargeted.tracks && retargeted.tracks.length > 0) {
						usedClip = retargeted;
						diag.retargeted = true;
					}
				}
			} catch (retargetErr) {
				console.warn(`Alien1: retarget failed for '${name}' from '${path}':`, retargetErr);
			}
			if (!diag.retargeted) {
				try { usedClip = this._remapClipTracksToModel(usedClip, name); } catch (_) {}
			}
			const finalClip = this._sanitizeClip(usedClip, name);
			this.animations[name] = finalClip;
			diag.loaded = true;
			diag.duration = finalClip?.duration || 0;
			this._animDiagnostics[name] = diag;
			return true;
		} catch (err) {
			console.warn(`No se pudo cargar animación '${name}' desde ${path}:`, err);
			try { this._animDiagnostics[name] = { name, path, loaded: false, retargeted: false, commonBones: 0, animBones: 0, modelBones: 0, duration: 0, skippedReason: String(err?.message || err) }; } catch(e) {}
			return false;
		}
	}
	static _sanitizeBoneName(n) {
		let s = (n||'').toLowerCase();
		s = s.replace(/^mixamorig:/g, '').replace(/^armature\|/g, '').replace(/^armature:/g,'');
		s = s.replace(/\s+/g, '');
		return s;
	}
	_remapClipTracksToModel(clip, name) {
		if (!clip || !clip.tracks || clip.tracks.length === 0 || !this._boneIndex) return clip;
		const idx = this._boneIndex;
		let changed = false;
		const remappedTracks = [];
		for (const t of clip.tracks) {
			const tn = (t && t.name) ? t.name : '';
			const parts = tn.split('.');
			if (parts.length < 2) { remappedTracks.push(t); continue; }
			const node = parts[0];
			const prop = parts.slice(1).join('.');
			const nodeSan = Alien1._sanitizeBoneName(node);
			let targetName = idx.bySanitized.get(nodeSan) || null;
			if (!targetName) {
				// try endsWith match among all names
				for (const n of idx.all) {
					const sn = Alien1._sanitizeBoneName(n);
					if (nodeSan === sn || nodeSan.endsWith(sn) || sn.endsWith(nodeSan)) { targetName = n; break; }
				}
			}
			if (targetName && targetName !== node) {
				const nt = t.clone();
				nt.name = `${targetName}.${prop}`;
				remappedTracks.push(nt);
				changed = true;
			} else {
				remappedTracks.push(t);
			}
		}
		if (!changed) return clip;
		const cloned = clip.clone();
		cloned.tracks = remappedTracks;
		return cloned;
	}
	_sanitizeClip(clip, name) {
		try {
			if (!clip || !clip.tracks || clip.tracks.length === 0) return clip;
			const n = (name||'').toLowerCase();
			const shouldSanitize = (n.includes('run') || n.includes('walk') || n.includes('idle') || n.includes('combat'));
			if (!shouldSanitize) return clip;
			const rootHints = ['hips','mixamorig:hips','root','pelvis'];
			const tracks = [];
			for (const t of clip.tracks) {
				const tn = (t && t.name) ? t.name : '';
				const isPos = tn.endsWith('.position');
				let node = tn.split('.')[0] || '';
				node = node.toLowerCase();
				const isRoot = rootHints.some(h => node.includes(h));
				if (isPos && isRoot) {
					continue;
				}
				tracks.push(t);
			}
			if (tracks.length !== clip.tracks.length) {
				const cloned = clip.clone();
				cloned.tracks = tracks;
				return cloned;
			}
			return clip;
		} catch (_) { return clip; }
	}
	normalizeSkinWeightsForSkinnedMesh(skinnedMesh) {
		if (!skinnedMesh || !skinnedMesh.geometry) return;
		const geom = skinnedMesh.geometry;
		const sw = geom.attributes && geom.attributes.skinWeight;
		if (!sw) return;
		const arr = sw.array;
		for (let i = 0; i < arr.length; i += 4) {
			const x = arr[i] || 0; const y = arr[i+1] || 0; const z = arr[i+2] || 0; const w = arr[i+3] || 0;
			const sum = x+y+z+w;
			if (sum === 0) continue;
			if (Math.abs(sum-1) > 1e-6) {
				arr[i] = x/sum; arr[i+1] = y/sum; arr[i+2] = z/sum; arr[i+3] = w/sum;
			}
		}
		sw.needsUpdate = true;
	}
	normalizeSkinWeightsInModel(root) {
		if (!root || !root.traverse) return;
		root.traverse(o => { if (o.isSkinnedMesh) this.normalizeSkinWeightsForSkinnedMesh(o); });
	}
	playAnimation(name, { loop = THREE.LoopRepeat, fadeIn = 0.15, timeScale = 1.0 } = {}) {
		if (!this.mixer || !this.animations[name]) {
			return false;
		}
		try {
			if (this._animLogEnabled) {
				const id = this.entityId || 'unknown';
			}
			const clip = this.animations[name];
			const action = this.mixer.clipAction(clip, this.model);
			if (!action) return false;
			if (this.currentAction && this.currentAction.getClip && this.currentAction.getClip() === clip) {
				try { this.currentAction.setEffectiveTimeScale(timeScale); } catch (_) {}
				return true; 
			}
			if (this.currentAction && this.currentAction !== action) {
				this.currentAction.fadeOut(0.08);
			}
			if (name === 'death') {
				try { action.setLoop(THREE.LoopOnce, 0); action.clampWhenFinished = true; } catch (e) {}
				loop = THREE.LoopOnce;
			}
			action.reset();
			action.setLoop(loop, Infinity);
			action.setEffectiveTimeScale(timeScale);
			action.setEffectiveWeight(1);
			action.fadeIn(fadeIn);
			action.play();

			this.currentAction = action;
			return true;
		} catch (err) {
			console.error('Error al reproducir animación', name, err);
			return false;
		}
	}
	crossFadeTo(name, duration = 0.2, timeScale = 1.0) {
		if (!this.mixer || !this.animations[name]) return false;
		const next = this.mixer.clipAction(this.animations[name]);
		if (!next) return false;
		if (this.currentAction && this.currentAction !== next) {
			next.reset();
			next.setEffectiveTimeScale(timeScale);
			next.setEffectiveWeight(1);
			next.play();
			this.currentAction.crossFadeTo(next, duration, false);
			this.currentAction = next;
			return true;
		} else if (!this.currentAction) {
			next.play();
			this.currentAction = next;
			return true;
		}

		return false;
	}
	update(delta) {
		if (this.mixer) this.mixer.update(delta);
		try { this._updateHealthbar(delta); } catch (e) {}
		try {
			if (this.isDead || (this.healthComponent && !this.healthComponent.isAlive())) return;
			const nowMs = performance.now();
			if (this._postAttackUntil && nowMs < this._postAttackUntil) {
				if (this.animations.combatIdle) this.playAnimation('combatIdle');
				return;
			}
			try {
				if (typeof this.getPlayer === 'function') {
					const p = this.getPlayer();
					if (p && p.position) {
						const dx = (this.model.position.x - p.position.x);
						const dz = (this.model.position.z - p.position.z);
						const d2 = dx*dx + dz*dz;
						const r = this.playerAggroRadius || 12;
						if (d2 <= r*r) {
							this.target = { type: 'player', ref: p };
						}
					}
				}
			} catch (_) {}
			if (!this.target || !this._isTargetValid(this.target)) {
				this._acquireTarget();
			}
			if (this.target && this.target.ref && this.target.ref.position) {
				let targetPos;
				const p = this.target.ref && this.target.ref.position;
				if (p && typeof p.clone === 'function') targetPos = p.clone();
				else if (p && typeof p.x === 'number') targetPos = new THREE.Vector3(p.x, p.y || 0, p.z);
				else return; // target inválido
				const myPos = this.model.position.clone();
				const dist = myPos.distanceTo(targetPos);
				if (dist > this.attackRange) {
					this.state = this.target.type === 'cow' ? 'seekCow' : 'seekPlayer';
					try {
						if (!this._runAudio) {
							if (window.audio && typeof window.audio.playSFX === 'function' && this.model) {
								const p = window.audio.playSFX('run', { loop: true, object3D: this.model, volume: 0.6 });
								this._runAudio = p;
								if (p && typeof p.then === 'function') p.then((inst) => { this._runAudio = inst; }).catch(() => { this._runAudio = null; });
							} else {
								try { safePlaySfx('run', { volume: 0.6 }); } catch(_) {}
							}
						}
					} catch (e) {}
					this._moveTowards(targetPos, delta);
					if (this.animations.run) this.playAnimation('run');
					else if (this.animations.walk) this.playAnimation('walk');
					else if (this.animations.combatIdle) this.playAnimation('combatIdle');
					try {
						const now = performance.now();
						if (!this._nextVoiceAt || now >= this._nextVoiceAt) {
							if (Math.random() < 0.18) {
								try { safePlaySfx('alienVoice', { object3D: this.model, volume: 0.9 }); } catch(_) {}
							}
							this._nextVoiceAt = now + (5000 + Math.floor(Math.random() * 15000));
						}
					} catch (e) {}
				} else {
					this.state = this.target.type === 'cow' ? 'attackCow' : 'attackPlayer';
					this._tryAttack();
					try {
						if (this._runAudio) {
							const ra = this._runAudio;
							if (ra && typeof ra.then === 'function') {
								ra.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
							} else if (ra && typeof ra.stop === 'function') {
								try { ra.stop(); } catch(e) {}
							}
						}
					} catch (e) {}
					this._runAudio = null;
				}
				} else {
					this.state = 'idle';
					try {
						if (this._runAudio) {
							const ra = this._runAudio;
							if (ra && typeof ra.then === 'function') {
								ra.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
							} else if (ra && typeof ra.stop === 'function') {
								try { ra.stop(); } catch(e) {}
							}
						}
					} catch (e) {}
					this._runAudio = null;
					if (this.animations.idle) this.playAnimation('idle');
					else if (this.animations.combatIdle) this.playAnimation('combatIdle');
					else if (this.animations.run) this.playAnimation('run', { timeScale: 0.6 });
				}
		} catch (err) {
			console.warn('Alien1 AI update error:', err);
		}
	}
	_getCamera() {
		try { if (this.scene && this.scene.userData && this.scene.userData.camera) return this.scene.userData.camera; } catch (_) {}
		try { if (typeof window !== 'undefined' && window.camera) return window.camera; } catch (_) {}
		return null;
	}

	_createHealthbar() {
		if (!this.model || this._hb.anchor) return;
		const hb = this._hb;
		// Anchor above head using bounding box
		const box = new THREE.Box3().setFromObject(this.model);
		const size = new THREE.Vector3(); box.getSize(size);
		const topY = box.max.y || (this.model.position.y + 1.5);
		hb.anchor = new THREE.Object3D();
		hb.anchor.position.set(0, (topY - this.model.position.y) + hb.marginAbove, 0);
		this.model.add(hb.anchor);
		hb.group = new THREE.Group();
		hb.group.renderOrder = 9999;
		hb.group.frustumCulled = false;
		hb.anchor.add(hb.group);
		const matBack = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.65, depthTest: false });
		const matChip = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.9, depthTest: false });
		const matFill = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.95, depthTest: false });
		const geo = new THREE.PlaneGeometry(hb.width, hb.height);
		hb.back = new THREE.Mesh(geo.clone(), matBack);
		hb.back.position.set(0, 0, 0);
		hb.back.renderOrder = 10000;
		hb.group.add(hb.back);
		hb.chip = new THREE.Mesh(geo.clone(), matChip);
		hb.chip.position.set(0, 0, 0.002);
		hb.chip.renderOrder = 10001;
		hb.group.add(hb.chip);
		hb.fill = new THREE.Mesh(geo.clone(), matFill);
		hb.fill.position.set(0, 0, 0.004);
		hb.fill.renderOrder = 10002;
		hb.group.add(hb.fill);
		const pct = this.healthComponent ? Math.max(0, Math.min(1, (this.healthComponent.current || 0) / (this.healthComponent.maxHealth || 1))) : 1;
		hb.lastPct = pct; hb.chipPct = pct;
		this._setBarPct(pct, true);
	}

	_setBarPct(pct, instant = false) {
		const hb = this._hb; if (!hb || !hb.fill || !hb.chip) return;
		const p = Math.max(0, Math.min(1, pct));
		const fullW = hb.width;
		const leftX = -fullW / 2;
		hb.fill.scale.x = Math.max(1e-4, p);
		hb.fill.position.x = leftX + (fullW * p) / 2;
		const chipP = hb.chipPct;
		hb.chip.scale.x = Math.max(1e-4, chipP);
		hb.chip.position.x = leftX + (fullW * chipP) / 2;
		try {
			if (p > 0.6) hb.fill.material.color.set(0x2ecc71);
			else if (p > 0.3) hb.fill.material.color.set(0xf39c12);
			else hb.fill.material.color.set(0xe74c3c);
		} catch (_) {}
	}

	_updateHealthbar(delta = 0.016) {
		const hb = this._hb; if (!hb || !hb.group || !this.model) return;
		try {
			const cam = this._getCamera();
			if (cam) hb.group.quaternion.copy(cam.quaternion);
		} catch (_) {}
		if (this.healthComponent && !this.healthComponent.isAlive()) {
			hb.group.visible = false; hb.visible = false; return;
		} else { hb.group.visible = true; hb.visible = true; }
		if (!hb.anchor) this._createHealthbar();
		let pct = 1;
		if (this.healthComponent) {
			const max = Math.max(1, this.healthComponent.maxHealth || 1);
			pct = Math.max(0, Math.min(1, (this.healthComponent.current || 0) / max));
		}
		if (pct < hb.lastPct) {
			hb.chipPct = Math.max(hb.chipPct, hb.lastPct);
			const dmg = Math.max(0, Math.round((hb.lastPct - pct) * (this.healthComponent ? (this.healthComponent.maxHealth || 0) : 0)));
			if (dmg > 0) this._spawnDamageText(`-${dmg}`);
		}
		const speed = 0.8;
		if (hb.chipPct > pct) {
			hb.chipPct = Math.max(pct, hb.chipPct - speed * delta);
		}
		hb.lastPct = pct;
		this._setBarPct(pct);
		for (let i = hb._damageTexts.length - 1; i >= 0; i--) {
			const dt = hb._damageTexts[i];
			dt.life -= delta;
			if (dt.life <= 0) {
				try { hb.group.remove(dt.obj); if (dt.dispose) dt.dispose(); } catch (_) {}
				hb._damageTexts.splice(i, 1);
				continue;
			}
			dt.obj.position.y += delta * 0.25;
			const a = Math.max(0, Math.min(1, dt.life / dt.maxLife));
			try { dt.obj.material.opacity = a; } catch (_) {}
		}
	}
	_spawnDamageText(text) {
		const hb = this._hb; if (!hb || !hb.group) return;
		try {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const fontSize = 48; const padding = 16;
			ctx.font = `bold ${fontSize}px Arial`;
			const metrics = ctx.measureText(text);
			canvas.width = Math.ceil(metrics.width + padding * 2);
			canvas.height = Math.ceil(fontSize + padding * 2);
			// redraw with proper scale
			const scale = window.devicePixelRatio || 1;
			canvas.width *= scale; canvas.height *= scale;
			ctx.scale(scale, scale);
			ctx.font = `bold ${fontSize}px Arial`;
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
			ctx.strokeStyle = 'rgba(231, 76, 60, 0.95)';
			ctx.lineWidth = 6;
			ctx.strokeText(text, (canvas.width/scale)/2, (canvas.height/scale)/2);
			ctx.fillText(text, (canvas.width/scale)/2, (canvas.height/scale)/2);
			const tex = new THREE.CanvasTexture(canvas);
			tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
			const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 1 });
			const spr = new THREE.Sprite(mat);
			const worldW = Math.min(1.6, this._hb.width * 1.2);
			const aspect = canvas.width / canvas.height;
			spr.scale.set(worldW, worldW / aspect, 1);
			spr.position.set(0, 0.22, 0.01);
			hb.group.add(spr);
			const entry = { obj: spr, life: 0.9, maxLife: 0.9, dispose: () => { try { tex.dispose(); mat.dispose(); } catch (_) {} } };
			hb._damageTexts.push(entry);
		} catch (_) {}
	}
	_buildObstacleCache() {
		if (this._obstaclesBuilt) return;
		this._obstacles = { circles: [], boxes: [] };
		try {
			let stones = [];
			try { if (typeof this.getStones === 'function') stones = this.getStones() || []; else if (typeof window !== 'undefined') stones = window.stones || []; } catch(_) {}
			for (const s of stones) {
				try {
					const mdl = s && (s.model || (typeof s.getModel === 'function' ? s.getModel() : null));
					if (!mdl || !mdl.position) continue;
					let r = 1.2;
					try {
						if (typeof s.getBoundingBox === 'function') {
							const box = s.getBoundingBox();
							if (box && box.min && box.max) {
								const sx = Math.abs(box.max.x - box.min.x);
								const sz = Math.abs(box.max.z - box.min.z);
								r = Math.max(sx, sz) * 0.5;
							}
						}
					} catch(_) {}
					this._obstacles.circles.push({ cx: mdl.position.x, cz: mdl.position.z, r: r });
				} catch(_) {}
			}
			try {
				const c = (typeof this.getCorral === 'function') ? this.getCorral() : (typeof window !== 'undefined' ? window.corral : null);
				if (c && Array.isArray(c.collisionBoxes)) {
					for (const cb of c.collisionBoxes) { if (cb && cb.box) this._obstacles.boxes.push(cb.box.clone()); }
				}
			} catch(_) {}
			try {
				const h = (typeof this.getHouse === 'function') ? this.getHouse() : (typeof window !== 'undefined' ? window.house : null);
				if (h && Array.isArray(h.collisionBoxes)) {
					for (const hb of h.collisionBoxes) { if (hb && hb.box) this._obstacles.boxes.push(hb.box.clone()); }
				}
			} catch(_) {}
			try {
				const m = (typeof this.getMarket === 'function') ? this.getMarket() : (typeof window !== 'undefined' ? window.market : null);
				if (m) {
					let root = null;
					if (m.marketGroup) root = m.marketGroup;
					else if (Array.isArray(m.walls) && m.walls.length > 0) root = m.walls[0].parent || m.walls[0];
					if (root) {
						const box = new THREE.Box3().setFromObject(root);
						if (box && box.min && box.max) this._obstacles.boxes.push(box);
					}
				}
			} catch(_) {}
			try {
				const sh = (typeof this.getShip === 'function') ? this.getShip() : (typeof window !== 'undefined' ? window.spaceShuttle : null);
				if (sh && typeof sh.getBoundingBox === 'function') {
					const box = sh.getBoundingBox();
					if (box) this._obstacles.boxes.push(box);
				}
			} catch(_) {}
			try {
				let buildings = [];
				if (typeof this.getBuildings === 'function') buildings = this.getBuildings() || [];
				else if (typeof window !== 'undefined' && window.buildingMgr && typeof window.buildingMgr.getColliders === 'function') buildings = window.buildingMgr.getColliders() || [];
				for (const b of buildings) {
					if (!b) continue;
					let box = null;
					if (b.bbox && b.bbox.min && b.bbox.max) box = b.bbox;
					else if (b.object && b.object.isObject3D) {
						try { box = new THREE.Box3().setFromObject(b.object); } catch(_) { box = null; }
					} else if (typeof b.getBoundingBox === 'function') {
						try { box = b.getBoundingBox(); } catch(_) { box = null; }
					}
					if (box) {
						const cloned = box.clone();
						cloned.expandByScalar(0.1);
						this._obstacles.boxes.push(cloned);
					}
				}
			} catch (e) { console.warn('[Alien1] failed including building obstacles', e); }
		} catch(_) {}
		this._obstaclesBuilt = true;
	}
	_collidesAt(pos) {
		try {
			if (!this._obstaclesBuilt) this._buildObstacleCache();
			const halfW = this.colliderRadius;
			const halfH = this.colliderHeight * 0.5;
			const size = new THREE.Vector3(halfW*2, this.colliderHeight, halfW*2);
			const center = new THREE.Vector3(pos.x, (pos.y || 0) + halfH, pos.z);
			const charBox = new THREE.Box3().setFromCenterAndSize(center, size);
			if (this.getCorral && typeof this.getCorral === 'function') {
				const corral = this.getCorral();
				if (corral && corral.checkCollision) {
					const alienBox = new THREE.Box3().setFromCenterAndSize(
						new THREE.Vector3(pos.x, center.y, pos.z),
						new THREE.Vector3(halfW * 2, halfH * 2, halfW * 2)
					);
					const collisionData = corral.checkCollision(alienBox);
					if (collisionData) {
						const currentWall = collisionData.side;
						const currentTime = Date.now();
						const DAMAGE_PER_SECOND = 0.1;
						const UPDATE_INTERVAL = 0.00001;
						const timeSinceLastUpdate = this._lastWallHit ? (currentTime - this._lastWallHit.time) : 1000;
						const damageThisFrame = (DAMAGE_PER_SECOND * timeSinceLastUpdate) / 1000;
						const damageApplied = corral.damageWall(currentWall, damageThisFrame);
						this._lastWallHit = {
							wall: currentWall,
							time: currentTime
						};
						if (Math.floor(corral.health) % 5 === 0 && Math.random() < 0.01) {;
						}
						if (corral.health <= 0) {;
							this._obstaclesBuilt = false;
							return false;
						}
						
						return true;
					} else {
						this._lastWallHit = null;
					}
				} else {
					console.warn('Corral or checkCollision method not available');
				}
			}
			for (const c of (this._obstacles.circles || [])) {
				const dx = pos.x - c.cx; const dz = pos.z - c.cz;
				if ((dx*dx + dz*dz) <= Math.pow(c.r + this.colliderRadius * 0.9, 2)) return true;
			}
			for (const b of (this._obstacles.boxes || [])) {
				if (b && charBox.intersectsBox(b)) return true;
			}
		} catch(error) {
			console.error('Error in _collidesAt:', error);
		}
		return false;
	}
	_findSteerDirection(dir, moveDist) {
		const up = new THREE.Vector3(0,1,0);
		const basePos = this.model.position.clone();
		const stepDeg = 15;
		for (let i = 1; i <= 12; i++) {
			const a = THREE.MathUtils.degToRad(stepDeg * i);
			for (const sign of [1, -1]) {
				const ang = a * sign;
				const tryDir = dir.clone().applyAxisAngle(up, ang);
				const candidate = basePos.clone().add(tryDir.clone().multiplyScalar(moveDist));
				if (!this._collidesAt(candidate)) return tryDir;
			}
		}
		return null;
	}
		_isTargetValid(target) {
			if (!target || !target.ref) return false;
			if (target.ref.position === undefined) return false;
			if (target.type === 'cow') {
				if (target.ref.userData && target.ref.userData.isDead) return false;
				const cowController = target.ref.userData && target.ref.userData.cowController;
				if (cowController && typeof cowController.isAlive === 'function' && !cowController.isAlive()) {
					return false;
				}
			}
			if (target.ref.userData && target.ref.userData.controller && target.ref.userData.controller.healthComponent) {
				return target.ref.userData.controller.healthComponent.isAlive();
			}
			return true;
		}
		_acquireTarget() {
			let playerRef = null;
			let playerDist = Infinity;
			try {
				if (typeof this.getPlayer === 'function') {
					const p = this.getPlayer();
					if (p && p.position) {
						playerRef = p;
						playerDist = this.model.position.distanceTo(p.position);
					}
				}
			} catch (_) {}
			const aggroR = this.playerAggroRadius || 12;
			if (playerRef && playerDist <= aggroR) {
				this.target = { type: 'player', ref: playerRef };
				return;
			}
			try {
				if (typeof this.getCows === 'function') {
					const cows = this.getCows() || [];
					let closest = null;
					let closestDist = Infinity;
					for (const c of cows) {
						if (!c || !c.model) continue;
						// Skip dead cows
						if (c.isDead || !c.isAlive || (typeof c.isAlive === 'function' && !c.isAlive())) continue;
						const d = this.model.position.distanceTo(c.model.position);
						if (d < closestDist && d <= this.detectionRange) {
							closest = c;
							closestDist = d;
						}
					}
					if (closest) {
						this.target = { type: 'cow', ref: closest.model };
						return;
					}
				}
				if (playerRef && playerDist <= this.detectionRange) {
					this.target = { type: 'player', ref: playerRef };
					return;
				}
				try {
					if (typeof this.getCorralCenter === 'function') {
						const c = this.getCorralCenter();
						if (c && c.position) {
							this.target = { type: 'corral', ref: c };
							return;
						}
					}
				} catch (_) {}
				this.target = null;
			} catch (err) {
				console.warn('Alien1 _acquireTarget error:', err);
				this.target = null;
			}
		}
		_moveTowards(targetPos, delta) {
			if (!this.model) return;
			const dir = new THREE.Vector3().subVectors(targetPos, this.model.position);
			dir.y = 0; // movimiento plano
			const distance = dir.length();
			if (distance < 1e-3) return;
			dir.normalize();
			const moveDistance = this.moveSpeed * delta * 60;
			const step = Math.min(moveDistance, distance);
			const nextPos = this.model.position.clone().add(dir.clone().multiplyScalar(step));
			let finalDir = dir;
			if (this._collidesAt(nextPos)) {
				const steered = this._findSteerDirection(dir, step);
				if (steered) finalDir = steered;
				else {
					if (this.animations.combatIdle) this.playAnimation('combatIdle');
					return;
				}
			}
			const look = this.model.position.clone().add(finalDir);
			this.model.lookAt(look);
			this.model.position.add(finalDir.multiplyScalar(step));
		}
		_tryAttack() {
				const now = performance.now() / 1000;
				if (now - this._lastAttackAt < this.attackCooldown) return;
				this._lastAttackAt = now;
				const side = Math.random() < 0.5 ? 'punch_left' : 'punch_right';
				if (this.animations[side]) {
					const clip = this.animations[side];
					this._currentPunchClip = clip;
					this.playAnimation(side, { loop: THREE.LoopOnce, fadeIn: 0.06 });
					try {
						const impactRatio = 0.45;
						const impactMs = Math.max(50, clip.duration * impactRatio * 1000);
						if (this._impactTimeoutId) clearTimeout(this._impactTimeoutId);
							this._impactTimeoutId = setTimeout(() => {
							try {
								this._applyCowDamage();
								if (this.combat && this.entityId) {
									this.combat.applyFrontalAttack(this.entityId, {
										damage: this.attackDamage,
										range: this.attackRange,
										radius: 0.8,
										duration: 0.15,
										offsetHeight: 1.0,
										friendlyFire: false,
									});
								} else {
									if (this.target && this.target.ref && this.target.ref.userData && this.target.ref.userData.controller && this.target.ref.userData.controller.healthComponent) {
										this.target.ref.userData.controller.healthComponent.takeDamage(this.attackDamage, { from: this.entityId });
									}
								}
							} catch (err) {
								console.warn('Alien1 impact error:', err);
							}
							try { safePlaySfx('punch', { object3D: this.model, volume: 0.95 }); } catch(_) {}
							this._impactTimeoutId = null;
						}, impactMs);
					} catch (e) {
						// ignore scheduling errors
					}
				} else if (this.animations.attack) {
					this.playAnimation('attack', { loop: THREE.LoopOnce, fadeIn: 0.06 });
					try { safePlaySfx('punch', { object3D: this.model, volume: 0.95 }); } catch(_) {}
					this._applyCowDamage();
					try {
						if (this.combat && this.entityId) {
							this.combat.applyFrontalAttack(this.entityId, {
								damage: this.attackDamage,
								range: this.attackRange,
								radius: 0.8,
								duration: 0.15,
								offsetHeight: 1.0,
								friendlyFire: false,
							});
						} else {
							if (this.target && this.target.ref && this.target.ref.userData && this.target.ref.userData.controller && this.target.ref.userData.controller.healthComponent) {
								this.target.ref.userData.controller.healthComponent.takeDamage(this.attackDamage, { from: this.entityId });
							}
						}
					} catch (err) {
						console.warn('Alien1 attack error:', err);
					}
				}
				try {
					if (this.combat && this.entityId) {
						this.combat.applyFrontalAttack(this.entityId, {
							damage: this.attackDamage,
							range: this.attackRange,
							radius: 0.8,
							duration: 0.15,
							offsetHeight: 1.0,
							friendlyFire: false,
						});
					} else {
						if (this.target && this.target.ref && this.target.ref.userData && this.target.ref.userData.controller && this.target.ref.userData.controller.healthComponent) {
							this.target.ref.userData.controller.healthComponent.takeDamage(this.attackDamage, { from: this.entityId });
						}
					}
				} catch (err) {
					console.warn('Alien1 attack error:', err);
				}
		}
		_applyCowDamage() {
			if (!this.target || !this.target.ref) return;
			const hasTagCow = this.target.ref.userData && this.target.ref.userData.tag === "Cow";
			const hasCowController = this.target.ref.userData && this.target.ref.userData.cowController;
			const isTargetTypeCow = this.target.type === 'cow';
			if (!hasTagCow && !hasCowController && !isTargetTypeCow) {;
				return;
			}
			let cowController = null;
			if (hasCowController) {
				cowController = this.target.ref.userData.cowController;
			} else if (isTargetTypeCow) {
				try {
					if (typeof this.getCows === 'function') {
						const cows = this.getCows() || [];
						for (const cow of cows) {
							if (cow && cow.model === this.target.ref) {
								cowController = cow;
								break;
							}
						}
					}
				} catch (e) {
					console.warn('Error finding cow controller:', e);
				}
			}
			if (!cowController || typeof cowController.onAlienHit !== 'function') {
				console.warn('[Alien1] Found cow target but no valid controller with onAlienHit method');
				return;
			}
			const attackerId = this.entityId || 'alien1_unknown';
			try {
				const died = cowController.onAlienHit(attackerId);
				if (died) {
					this.target = null;
				}
			} catch (err) {
				console.error('[Alien1] Error applying cow damage:', err);
			}
		}
		attachCombat(combatSystem, entityId, healthComponent, getPlayerFunc, getCowsFunc) {
			this.combat = combatSystem;
			this.entityId = entityId;
			this.healthComponent = healthComponent;
			if (typeof getPlayerFunc === 'function') this.getPlayer = getPlayerFunc;
			if (typeof getCowsFunc === 'function') this.getCows = getCowsFunc;
				try {
					const prevOnDamage = this.healthComponent && this.healthComponent.onDamage ? this.healthComponent.onDamage.bind(this.healthComponent) : null;
					this.healthComponent.onDamage = (amount, source) => {
						try { if (prevOnDamage) prevOnDamage(amount, source); } catch (_) {}
						try { this._spawnDamageText(`-${Math.round(amount)}`); } catch (_) {}
						try { safePlaySfx('hit', { object3D: this.model, volume: 0.9 }); } catch(_) {}
					};
				} catch (_) {}
				try {
					const prevOnDeath = this.healthComponent && this.healthComponent.onDeath ? this.healthComponent.onDeath.bind(this.healthComponent) : null;
					this.healthComponent.onDeath = (source) => {
						try { if (prevOnDeath) prevOnDeath(source); } catch (_) {}
						this.isDead = true;
						try { if (this._impactTimeoutId) { clearTimeout(this._impactTimeoutId); this._impactTimeoutId = null; } } catch (_) {}
						this._currentPunchClip = null;
						this._postAttackUntil = 0;
						try {
							if (this._runAudio) {
								const ra = this._runAudio;
								if (ra && typeof ra.then === 'function') {
									ra.then((inst) => { try { if (inst && typeof inst.stop === 'function') inst.stop(); } catch(e){}; }).catch(()=>{});
								} else if (ra && typeof ra.stop === 'function') {
									try { ra.stop(); } catch(e) {}
								}
							}
						} catch (_) {}
						try { if (this.animations.death) this.playAnimation('death', { loop: THREE.LoopOnce, fadeIn: 0.06, timeScale: 1.0 }); } catch (_) {}
						try { safePlaySfx('alienScream', { object3D: this.model, volume: 1.0 }); } catch(_) {}
						try { if (this._hb && this._hb.group) this._hb.group.visible = false; } catch (_) {}
						try { this.target = null; } catch (_) {}
					};
				} catch (_) {}
				try { this._createHealthbar(); this._updateHealthbar(0); } catch (_) {}
		}
		_onMixerFinished(event) {
			try {
				if (this.isDead || (this.healthComponent && !this.healthComponent.isAlive())) return;
				if (!event || !event.action) return;
				const clip = event.action.getClip();
				if (this._currentPunchClip && clip === this._currentPunchClip) {
					try {
						if (this.animations.combatIdle) this.playAnimation('combatIdle');
						this._postAttackUntil = performance.now() + 1000;
					} catch (e) {}
					this._currentPunchClip = null;
					if (this._impactTimeoutId) {
						clearTimeout(this._impactTimeoutId);
						this._impactTimeoutId = null;
					}
				}
			} catch (e) {
				console.warn('Alien1 mixer finished handler error:', e);
			}
		}
	setSpeed(speed) {
		if (this.currentAction) this.currentAction.setEffectiveTimeScale(speed);
		if (this.mixer) this.mixer.timeScale = speed;
	}
	getAnimationDiagnostics() { return this._animDiagnostics; }

	setAnimationLogging(enabled) { this._animLogEnabled = !!enabled; }
}
window.debugAlien1 = function () {
	if (window.alien1) {
		if (window.alien1.currentAction);
	} else {
		console.warn('Alien1 no definido en window.alien1');
	}
};
window.forceAlien1Animation = function (name) {
	if (window.alien1) {
		window.alien1.playAnimation(name);
	} else console.warn('Alien1 no definido en window.alien1');
};
window.setAlienAnimLog = function (enabled) {
	if (!window.aliens || window.aliens.length === 0) {
		console.warn('No hay aliens aún');
		return;
	}
	window.aliens.forEach(a => a.setAnimationLogging && a.setAnimationLogging(enabled));
};
window.printAlien1AnimDiag = function () {
	if (window.alien1) {
		const diag = window.alien1.getAnimationDiagnostics ? window.alien1.getAnimationDiagnostics() : null;
		if (!diag) return console.warn('No hay diagnósticos de animaciones aún');
		console.table(Object.keys(diag).map(k => ({ name: k, ...diag[k] })));
	} else {
		console.warn('Alien1 no definido en window.alien1');
	}
};

