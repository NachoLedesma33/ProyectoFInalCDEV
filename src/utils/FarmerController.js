import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";

export class FarmerController {
  constructor(model, modelLoader, camera, config = {}) {
    this.model = model;
    this.modelLoader = modelLoader;
    this.camera = camera;
    this.config = {
      moveSpeed: 0.3,
      rotationSpeed: 0.1,
      runMultiplier: 5.5,
      bounds: {
        minX: -250,
        maxX: 250,
        minZ: -250,
        maxZ: 250,
      },
      ...config,
    };

    this.corral = null;
    this.spaceShuttle = null;
    this.stones = null;
    this.house = null;
    this.cows = null;
    this.market = null;
    this.inventory = null;
    this.equippedWeapon = null;
    this.isEquipped = false;

    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      shift: false,
      e: false,
      q: false,
      1: false,
    };

    this.isRotating = false;
    this.targetRotation = null;
    this.rotationSpeed = Math.PI;

    this.isRotatedForBackward = false;
    this.originalRotation = 0;

    this.isCollidingWithCow = false;
    this.cowCollisionState = "none";
    this.cowCollisionStartTime = 0;
    this.currentCollidedCow = null;
    this.kneelingDownDuration = 2000;
    this.kneelingDuration = 15000;

    this.characterSize = new THREE.Vector3(1, 1, 1);
    this.stoneCollisionSize = new THREE.Vector3(0.5, 0.5, 0.5);

    this.setupEventListeners();

    this._handBone = null;
    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();

    this.createCoordinateDisplay();
  }

  setInventory(inventory) {
    this.inventory = inventory;
  }

  createCoordinateDisplay() {
    this.coordinateHUD = document.createElement("div");
    this.coordinateHUD.id = "farmer-coordinate-hud";

    this.coordinateHUD.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      min-width: 250px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ff00;
      border-radius: 8px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
      text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
    `;

    this.coordinateHUD.innerHTML = `
      <div style="margin-bottom: 8px; color: #ffffff; font-size: 12px;">FARMER COORDINATES</div>
      <div id="coord-values">X: 0.0  Y: 0.0  Z: 0.0</div>
    `;

    document.body.appendChild(this.coordinateHUD);
    this.coordValuesElement = document.getElementById("coord-values");
    this.updateCoordinateDisplay();
  }

  updateCoordinateDisplay() {
    if (!this.coordValuesElement || !this.model) return;

    const position = this.model.position;
    const text = `X: ${position.x.toFixed(1)}  Y: ${position.y.toFixed(
      1
    )}  Z: ${position.z.toFixed(1)}`;

    this.coordValuesElement.textContent = text;
  }

  setCorral(corral) {
    this.corral = corral;
  }

  setSpaceShuttle(spaceShuttle) {
    this.spaceShuttle = spaceShuttle;
  }

  setStones(stones) {
    if (!stones || stones.length === 0) return;

    const validStones = stones.filter(
      (stone) => typeof stone.checkCollision === "function"
    );

    if (validStones.length === 0) {
      this.stones = null;
      return;
    }

    this.stones = validStones;
  }

  setHouse(house) {
    if (!house || typeof house.checkCollision !== "function") {
      this.house = null;
      return;
    }

    this.house = house;
  }

  setCows(cows) {
    if (!cows || cows.length === 0) return;

    const validCows = cows.filter(
      (cow) => typeof cow.checkCollision === "function"
    );

    if (validCows.length === 0) {
      this.cows = null;
      return;
    }

    this.cows = validCows;
  }

  checkCorralCollision(newPosition) {
    if (!this.corral || !this.model) return false;

    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
    );

    const collision = this.corral.checkCollision(characterBox);
    return collision !== null;
  }

  checkSpaceShuttleCollision(newPosition) {
    if (!this.spaceShuttle || !this.model) return false;
    return this.spaceShuttle.checkCollision(newPosition, this.characterSize);
  }

  checkStonesCollision(position) {
    if (!this.stones || !this.model) return false;

    const stoneCharacterSize = this.stoneCollisionSize;

    for (const stone of this.stones) {
      if (stone.checkCollision(position, stoneCharacterSize)) {
        return true;
      }
    }
    return false;
  }

  checkCowsCollision(position) {
    if (!this.cows || !this.model) return false;

    for (const cow of this.cows) {
      if (cow.checkCollision(position, this.characterSize)) {
        if (cow.hasExclamationMarkVisible()) {
          this.handleCowCollisionAnimation(cow);
        }
        return true;
      }
    }
    return false;
  }

  handleCowCollisionAnimation(cow) {
    if (!this.isCollidingWithCow) {
      this.isCollidingWithCow = true;
      this.cowCollisionState = "kneelingDown";
      this.cowCollisionStartTime = Date.now();
      this.currentCollidedCow = cow;
      this.updateAnimationState();
    }
  }

  updateCowCollisionAnimation(currentTime) {
    if (this.isCollidingWithCow) {
      const elapsedTime = currentTime - this.cowCollisionStartTime;

      if (this.cowCollisionState === "kneelingDown") {
        if (elapsedTime >= this.kneelingDownDuration) {
          this.cowCollisionState = "kneeling";
          this.cowCollisionStartTime = Date.now();
          this.updateAnimationState();
        }
      } else if (this.cowCollisionState === "kneeling") {
        if (elapsedTime >= this.kneelingDuration) {
          if (this.currentCollidedCow) {
            this.currentCollidedCow.resetProgressBar();
          }

          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;

          try {
            const min = 1.2;
            const max = 2.5;
            const milkAmount =
              Math.round((Math.random() * (max - min) + min) * 100) / 100;

            const addAndNotify = (inv) => {
              inv.addMilk(milkAmount);
              let screenPos = null;
              try {
                if (
                  this.camera &&
                  this.model &&
                  typeof window !== "undefined"
                ) {
                  const vector = this.model.position.clone();
                  vector.y += 1.6;
                  vector.project(this.camera);

                  const ndcX = vector.x;
                  const ndcY = vector.y;

                  const rendererEl =
                    typeof window !== "undefined" &&
                    window.renderer &&
                    window.renderer.domElement
                      ? window.renderer.domElement
                      : null;
                  if (rendererEl) {
                    const rect = rendererEl.getBoundingClientRect();
                    screenPos = {
                      x: rect.left + ((ndcX + 1) / 2) * rect.width,
                      y: rect.top + ((1 - ndcY) / 2) * rect.height,
                    };
                  } else {
                    const halfWidth = window.innerWidth / 2;
                    const halfHeight = window.innerHeight / 2;
                    screenPos = {
                      x: ndcX * halfWidth + halfWidth,
                      y: -ndcY * halfHeight + halfHeight,
                    };
                  }
                }
              } catch (e) {
                screenPos = null;
              }

              if (typeof inv.popup === "function")
                inv.popup(
                  `+${milkAmount.toFixed(2)} L de leche obtenidos`,
                  2800,
                  { screenPos }
                );
              else if (typeof inv.notify === "function")
                inv.notify(`+${milkAmount.toFixed(2)} L de leche obtenidos`);
            };

            if (
              this.inventory &&
              typeof this.inventory.addMilk === "function"
            ) {
              addAndNotify(this.inventory);
            } else if (
              window &&
              window.inventory &&
              typeof window.inventory.addMilk === "function"
            ) {
              addAndNotify(window.inventory);
            }
          } catch (err) {}

          this.currentCollidedCow = null;
          this.updateAnimationState();
        }
      }
    }
  }

  getStoneAdjustedMovement(currentPosition, movementVector) {
    const newPosition = currentPosition.clone().add(movementVector);

    if (!this.checkStonesCollision(newPosition)) {
      return movementVector;
    }

    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (!this.checkStonesCollision(xPosition)) {
      return xMovement;
    }

    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (!this.checkStonesCollision(zPosition)) {
      return zMovement;
    }

    const reducedMovement = movementVector.clone().multiplyScalar(0.5);
    const reducedPosition = currentPosition.clone().add(reducedMovement);

    if (!this.checkStonesCollision(reducedPosition)) {
      return reducedMovement;
    }

    return new THREE.Vector3(0, 0, 0);
  }

  checkHouseCollision(newPosition) {
    if (!this.house || !this.model) return false;

    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
    );

    const collision = this.house.checkCollision(characterBox);
    return collision !== null;
  }

  getAdjustedMovement(currentPosition, movementVector) {
    if (this.isCollidingWithCow) {
      return new THREE.Vector3(0, 0, 0);
    }

    const newPosition = currentPosition.clone().add(movementVector);

    if (this.market && this.checkMarketCollision(newPosition)) {
      const slidingMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );
      return slidingMovement.length() > 0
        ? slidingMovement
        : new THREE.Vector3(0, 0, 0);
    }

    if (this.corral && this.checkCorralCollision(newPosition)) {
      const adjustedMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );

      if (adjustedMovement.length() === 0) {
        return new THREE.Vector3(0, 0, 0);
      }

      return adjustedMovement;
    }

    if (this.spaceShuttle && this.checkSpaceShuttleCollision(newPosition)) {
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    if (this.stones && this.checkStonesCollision(newPosition)) {
      const stoneAdjustedMovement = this.getStoneAdjustedMovement(
        currentPosition,
        movementVector
      );

      if (stoneAdjustedMovement.length() === 0) {
        return this.getSlidingMovement(currentPosition, movementVector);
      }

      return stoneAdjustedMovement;
    }

    if (this.house && this.checkHouseCollision(newPosition)) {
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    if (this.cows && this.checkCowsCollision(newPosition)) {
      return new THREE.Vector3(0, 0, 0);
    }

    return movementVector;
  }

  getSlidingMovement(currentPosition, movementVector) {
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (this.isPositionValid(xPosition)) {
      return xMovement;
    }

    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (this.isPositionValid(zPosition)) {
      return zMovement;
    }

    return new THREE.Vector3(0, 0, 0);
  }

  isPositionValid(position) {
    if (this.corral && this.checkCorralCollision(position)) {
      return false;
    }

    if (this.spaceShuttle && this.checkSpaceShuttleCollision(position)) {
      return false;
    }

    if (this.stones && this.checkStonesCollision(position)) {
      return false;
    }

    if (this.house && this.checkHouseCollision(position)) {
      return false;
    }

    if (this.market && this.checkMarketCollision(position)) {
      return false;
    }

    return true;
  }

  checkMarketCollision(position) {
    if (!this.market || !this.market.marketGroup) {
      return false;
    }

    const marketPolygon = [
      new THREE.Vector2(-148.7, 51.5),
      new THREE.Vector2(-154.7, 46.2),
      new THREE.Vector2(-162.7, 55.3),
      new THREE.Vector2(-156.5, 60.4),
      new THREE.Vector2(-148.7, 51.5),
    ];

    const point = new THREE.Vector2(position.x, position.z);

    let inside = false;
    for (
      let i = 0, j = marketPolygon.length - 1;
      i < marketPolygon.length;
      j = i++
    ) {
      const xi = marketPolygon[i].x,
        yi = marketPolygon[i].y;
      const xj = marketPolygon[j].x,
        yj = marketPolygon[j].y;

      if (yj === yi) continue;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  setMarket(market) {
    this.market = market;
  }

  isFacingCamera() {
    if (!this.camera || !this.model) return false;

    const characterDirection = new THREE.Vector3(
      Math.sin(this.model.rotation.y),
      0,
      Math.cos(this.model.rotation.y)
    );

    const cameraToCharacter = new THREE.Vector3()
      .subVectors(this.model.position, this.camera.position)
      .normalize();
    cameraToCharacter.y = 0;

    const dotProduct = characterDirection.dot(cameraToCharacter);

    return dotProduct <= 0;
  }

  setupEventListeners() {
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        if ((key === 's' || key === 'arrowdown') && !this.keys[key]) {
          this.originalRotation = this.model.rotation.y;
          this.model.rotation.y += Math.PI;
          this.isRotatedForBackward = true;
        }
        
        this.keys[key] = true;
        this.updateAnimationState();

        if (key === "1") {
          if (this.isEquipped) {
            this.attack();
          } else {
            this.equipWeapon();
          }
        }
      } else if (key === "shift") {
        this.keys.shift = true;
        this.updateAnimationState();
      }
    });

    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        if ((key === 's' || key === 'arrowdown') && this.isRotatedForBackward) {
          this.model.rotation.y = this.originalRotation;
          this.isRotatedForBackward = false;
        }
        
        this.keys[key] = false;
        this.updateAnimationState();
      } else if (key === "shift") {
        this.keys.shift = false;
        this.updateAnimationState();
      }
    });
  }

  findRightHandBone(object) {
    if (!object) return null;

    if (object.isBone) {
      const name = object.name.toLowerCase();

      const isLeftHand =
        name.includes("lefthand") ||
        name.includes("left_hand") ||
        name.includes("hand_l") ||
        name.includes("hand.left") ||
        name.includes("mixamorighandl") ||
        name.includes("mixamorig_lefthand") ||
        name === "mixamoriglefthand" ||
        name === "mixamorigLeftHand";

      if (isLeftHand) {
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        debugSphere.name = "leftHandDebug";
        object.add(debugSphere);
        return object;
      }

      const isRightHand =
        name.includes("righthand") ||
        name.includes("right_hand") ||
        name.includes("hand_r") ||
        name.includes("hand.right") ||
        name.includes("mixamorighandr") ||
        name.includes("mixamorig_righthand") ||
        name === "mixamorigrighthand" ||
        name === "mixamorigRightHand";

      if (isRightHand) {
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        debugSphere.name = "rightHandDebug";
        object.add(debugSphere);
        return object;
      }
    }

    if (object.children) {
      for (const child of object.children) {
        const result = this.findRightHandBone(child);
        if (result) return result;
      }
    }

    return null;
  }

  async equipWeapon() {
    try {
      if (this.isEquipped) return;

      this.model.updateMatrixWorld(true);
      this._handBone = this.findRightHandBone(this.model);

      if (!this._handBone) {
        this._weaponPivot = new THREE.Group();
        this.model.add(this._weaponPivot);
      } else {
        this._weaponPivot = new THREE.Group();

        if (this._weaponPivot.parent) {
          this._weaponPivot.parent.remove(this._weaponPivot);
        }
        this._handBone.add(this._weaponPivot);
        this._weaponPivot.matrixAutoUpdate = true;
      }

      while (this._weaponPivot.children.length) {
        this._weaponPivot.remove(this._weaponPivot.children[0]);
      }

      if (window.loadedAxe) {
        this.equippedWeapon = window.loadedAxe.clone();
        this.equippedWeapon.scale.set(0.5, 0.5, 0.5);

        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
            child.frustumCulled = false;

            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                mat.visible = true;
                mat.transparent = false;
                mat.opacity = 1;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });
            } else if (child.material) {
              child.material.visible = true;
              child.material.transparent = false;
              child.material.opacity = 1;
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }

            child.castShadow = true;
            child.receiveShadow = true;
            child.updateMatrix();
          }
        });

        this._weaponPivot.add(this.equippedWeapon);
        this._weaponPivot.position.set(0.1, 0.1, 0);
        this._weaponPivot.rotation.set(0, 0, 0);

        if (this._handBone) {
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);
        }

        this.equippedWeapon.scale.set(10, 10, 10);
        this.equippedWeapon.position.set(0.1, 0.1, 0);
        this.equippedWeapon.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
        this._weaponPivot.position.set(0.2, 0.2, 0.1);
        this.equippedWeapon.updateMatrix();

        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        marker.name = "weaponMarker";
        marker.visible = true;
        this.equippedWeapon.add(marker);

        this.equippedWeapon.visible = true;
        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
            if (child.material) {
              child.material.visible = true;
              child.material.needsUpdate = true;
            }
          }
        });

        this.equippedWeapon.updateMatrix();
        this.model.updateMatrixWorld(true);
        if (this._handBone) this._handBone.updateMatrixWorld(true);
        this._weaponPivot.updateMatrixWorld(true);
        this.equippedWeapon.updateMatrixWorld(true);

        this.model.traverse((obj) => {
          if (obj.updateMatrix) obj.updateMatrix();
          if (obj.updateMatrixWorld) obj.updateMatrixWorld(true);
        });

        if (this._renderer && this._scene && this._camera) {
          this._renderer.render(this._scene, this._camera);

          if (!this._debugInterval) {
            this._debugInterval = setInterval(() => {
              this.equippedWeapon.updateMatrix();
              this.equippedWeapon.updateMatrixWorld(true);
              this._renderer.render(this._scene, this._camera);
            }, 1000);
          }
        }

        let debugSphere = this._weaponPivot.getObjectByName("weaponDebug");
        if (!debugSphere) {
          debugSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({
              color: 0xff0000,
              wireframe: true,
              transparent: true,
              opacity: 0.8,
            })
          );
          debugSphere.name = "weaponDebug";
          this._weaponPivot.add(debugSphere);
        }

        const axesHelper = new THREE.AxesHelper(0.5);
        axesHelper.name = "weaponAxes";
        this._weaponPivot.add(axesHelper);

        if (this._handBone) {
          const handAxes = new THREE.AxesHelper(0.3);
          handAxes.name = "handAxes";
          this._handBone.add(handAxes);
        }

        this.equippedWeapon.updateMatrixWorld(true);
        this.isEquipped = true;
        return;
      }

      const axe = new THREE.Group();
      const handleGeometry = new THREE.BoxGeometry(0.2, 1.0, 0.2);
      const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);

      const headGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.8);
      const headMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
      const head = new THREE.Mesh(headGeometry, headMaterial);

      head.position.y = 0.5;
      head.rotation.z = Math.PI / 4;

      axe.add(handle);
      axe.add(head);
      axe.scale.set(2, 2, 2);

      this.model.add(axe);
      this.equippedWeapon = axe;

      this._handBone = this.findRightHandBone(this.model);

      if (this._handBone) {
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        this.equippedWeapon.translateX(0.5);
        this.equippedWeapon.translateY(0.5);
        this.equippedWeapon.translateZ(0.5);

        this.equippedWeapon.rotation.x = Math.PI / 2;
        this.equippedWeapon.rotation.y = Math.PI / 4;

        this.equippedWeapon.updateMatrixWorld(true);
      } else {
        this.equippedWeapon.position.copy(this.model.position);
        this.equippedWeapon.position.y += 2.0;
        this.equippedWeapon.position.z += 1.0;
        this.equippedWeapon.rotation.set(Math.PI / 2, 0, 0);
      }

      this.isEquipped = true;
      axe.updateMatrixWorld(true);
    } catch (error) {
      console.error("Error al equipar el hacha:", error);
    }
  }

  async equipTool(toolName) {
    if (
      toolName &&
      (toolName.toLowerCase() === "hacha" || toolName.toLowerCase() === "axe")
    ) {
      await this.equipWeapon();
    }
  }

  unequipTool() {
    if (this.equippedWeapon) {
      if (this.equippedWeapon.parent) {
        this.equippedWeapon.parent.remove(this.equippedWeapon);
      }
      this.equippedWeapon = null;
      this.isEquipped = false;
    }

    if (this.modelLoader) {
      this.modelLoader.play("idle", 0.15);
    }
  }

  attack() {
    return;
  }

  updateAnimationState() {
    if (!this.modelLoader || !this.modelLoader.model) return;

    const speedMultiplier = this.getSpeedMultiplier();
    const animationSpeed = 0.2 * speedMultiplier;

    if (this.isRotating) {
      return;
    }

    if (this.isCollidingWithCow) {
      const timeSinceCollision = Date.now() - this.cowCollisionStartTime;
      const canInterrupt = timeSinceCollision > 500;

      if (canInterrupt) {
        const isTryingToMove =
          this.keys.w ||
          this.keys.a ||
          this.keys.s ||
          this.keys.d ||
          this.keys.ArrowUp ||
          this.keys.ArrowDown ||
          this.keys.ArrowLeft ||
          this.keys.ArrowRight;

        if (isTryingToMove) {
          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;
        } else {
          if (this.cowCollisionState === "kneelingDown") {
            this.modelLoader.play("Kneel_Granjero2", animationSpeed);
          } else if (this.cowCollisionState === "kneeling") {
            this.modelLoader.play("Kneeling", animationSpeed);
          }
          return;
        }
      } else {
        if (this.cowCollisionState === "kneelingDown") {
          this.modelLoader.play("Kneel_Granjero2", 0.2);
        } else if (this.cowCollisionState === "kneeling") {
          this.modelLoader.play("Kneeling", 0.2);
        }
        return;
      }
    }

    const isMoving =
      this.keys.w ||
      this.keys.a ||
      this.keys.s ||
      this.keys.d ||
      this.keys.ArrowUp ||
      this.keys.ArrowDown ||
      this.keys.ArrowLeft ||
      this.keys.ArrowRight;
    const isRunning = this.keys.shift;
    const usingMelee = false;

    if (!isMoving) {
      this.modelLoader.play("idle", 0.15);
      return;
    }

    if (
      (this.keys.w || this.keys.ArrowUp) &&
      (this.keys.a || this.keys.ArrowLeft)
    ) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls
        ? "diagonalForwardRight"
        : "diagonalForwardLeft";
      this.modelLoader.play(animation, 0.1);
    } else if (
      (this.keys.w || this.keys.ArrowUp) &&
      (this.keys.d || this.keys.ArrowRight)
    ) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls
        ? "diagonalForwardLeft"
        : "diagonalForwardRight";
      this.modelLoader.play(animation, 0.1);
    } else if (this.keys.w || this.keys.ArrowUp) {
      const walkSpeed = 0.15;
      const runSpeed = 0.25;

      this.modelLoader.play("run", isRunning ? runSpeed : walkSpeed);
    } else if (this.keys.s || this.keys.ArrowDown) {
      this.modelLoader.play("run", isRunning ? 0.25 : 0.15);
    } else {
      const shouldInvertControls = this.isFacingCamera();

      if (
        (this.keys.a || this.keys.ArrowLeft) &&
        !(this.keys.d || this.keys.ArrowRight)
      ) {
        const animation = shouldInvertControls ? "strafeRight" : "strafeLeft";
        this.modelLoader.play(animation, 0.15);
      } else if (
        (this.keys.d || this.keys.ArrowRight) &&
        !(this.keys.a || this.keys.ArrowLeft)
      ) {
        const animation = shouldInvertControls ? "strafeLeft" : "strafeRight";
        this.modelLoader.play(animation, 0.15);
      }
    }
  }

  start180Rotation() {
    if (this.isRotating) return;

    this.isRotating = true;
    this.targetRotation = this.model.rotation.y + Math.PI;
    this.modelLoader.play("turn180", 0.2);
  }

  updateRotation(delta) {
    if (!this.isRotating || this.targetRotation === null) return;

    const rotationStep = this.rotationSpeed * delta;
    const currentRotation = this.model.rotation.y;

    let diff = this.targetRotation - currentRotation;

    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) <= rotationStep) {
      this.model.rotation.y = this.targetRotation;
      this.isRotating = false;
      this.targetRotation = null;

      const isMoving =
        this.keys.w ||
        this.keys.a ||
        this.keys.s ||
        this.keys.d ||
        this.keys.ArrowUp ||
        this.keys.ArrowDown ||
        this.keys.ArrowLeft ||
        this.keys.ArrowRight;

      if (isMoving) {
        this.updateAnimationState();
      } else {
        this.modelLoader.play("idle", 0.15);
      }
    } else {
      this.model.rotation.y += Math.sign(diff) * rotationStep;
    }
  }

  getSpeedMultiplier() {
    let multiplier = 1.0;

    if (this.keys.shift) {
      multiplier *= this.config.runMultiplier;
    }

    return multiplier;
  }

  update(delta) {
    if (!this.model || !this.modelLoader?.model) {
      return;
    }

    this.updateCowCollisionAnimation(Date.now());
    this.updateRotation(delta);

    if (this.isEquipped && this.equippedWeapon) {
      if (!this._handBone) {
        this._handBone = this.findRightHandBone(this.model);
      }

      if (this._handBone) {
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        this.equippedWeapon.translateX(0.1);
        this.equippedWeapon.translateZ(0.1);
        this.equippedWeapon.rotation.x += Math.PI / 4;

        this.equippedWeapon.updateMatrixWorld(true);
      }
    }

    if (this.isRotating) {
      return;
    }

    const baseSpeed = this.config.moveSpeed * 60 * delta;
    const speedMultiplier = this.getSpeedMultiplier();
    const currentMoveSpeed = baseSpeed * speedMultiplier;

    let moveX = 0;
    let moveZ = 0;
    let moved = false;

    if (this.keys.w || this.keys.ArrowUp) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    if (this.keys.s || this.keys.ArrowDown) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    const shouldInvertControls = this.isFacingCamera();

    if (this.keys.a || this.keys.ArrowLeft) {
      const directionMultiplier = shouldInvertControls ? -1 : 1;
      moveX += Math.cos(this.model.rotation.y) * directionMultiplier;
      moveZ -= Math.sin(this.model.rotation.y) * directionMultiplier;
      moved = true;
    }
    if (this.keys.d || this.keys.ArrowRight) {
      const directionMultiplier = shouldInvertControls ? -1 : 1;
      moveX -= Math.cos(this.model.rotation.y) * directionMultiplier;
      moveZ += Math.sin(this.model.rotation.y) * directionMultiplier;
      moved = true;
    }

    if (moved) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (length > 0) {
        moveX = (moveX / length) * currentMoveSpeed;
        moveZ = (moveZ / length) * currentMoveSpeed;
      }

      const movementVector = new THREE.Vector3(moveX, 0, moveZ);

      const adjustedMovement = this.getAdjustedMovement(
        this.model.position,
        movementVector
      );

      let newX = this.model.position.x + adjustedMovement.x;
      let newZ = this.model.position.z + adjustedMovement.z;

      newX = Math.max(
        this.config.bounds.minX,
        Math.min(newX, this.config.bounds.maxX)
      );
      newZ = Math.max(
        this.config.bounds.minZ,
        Math.min(newZ, this.config.bounds.maxZ)
      );

      const finalPosition = new THREE.Vector3(
        newX,
        this.model.position.y,
        newZ
      );
      if (!this.checkCorralCollision(finalPosition)) {
        this.model.position.setX(newX);
        this.model.position.setZ(newZ);
      }

      if (this.checkCorralCollision(finalPosition)) {
        this.modelLoader.play("idle", 0.15);
      }
    }

    if (!this.isRotating) {
      if (this.keys.q) {
        this.model.rotation.y += this.config.rotationSpeed * 2;
      }
      if (this.keys.e) {
        this.model.rotation.y -= this.config.rotationSpeed * 2;
      }
    }

    this.updateCoordinateDisplay();

    if (this.equippedWeapon) {
      try {
        if (!this._handBone) {
          this._handBone = this.findRightHandBone(this.model);
        }

        if (this._handBone) {
          this._handBone.getWorldPosition(this._tmpVec);
          this._handBone.getWorldQuaternion(this._tmpQuat);

          this.equippedWeapon.position.copy(this._tmpVec);
          this.equippedWeapon.quaternion.copy(this._tmpQuat);

          this.equippedWeapon.translateX(0.1);
          this.equippedWeapon.translateY(-0.1);
          this.equippedWeapon.translateZ(0.05);

          this.equippedWeapon.updateMatrixWorld(true);
        } else {
          this.equippedWeapon.position.copy(this.model.position);
          this.equippedWeapon.position.y += 1.0;
          this.equippedWeapon.rotation.copy(this.model.rotation);
        }
      } catch (e) {}
    }
  }

  dispose() {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);

    if (this.coordinateHUD && this.coordinateHUD.parentNode) {
      this.coordinateHUD.parentNode.removeChild(this.coordinateHUD);
    }

    if (this.equippedWeapon && this.equippedWeapon.parent) {
      this.equippedWeapon.parent.remove(this.equippedWeapon);
      this.equippedWeapon = null;
    }

    this._handBone = null;
    this.isEquipped = false;
  }
}

export default FarmerController;