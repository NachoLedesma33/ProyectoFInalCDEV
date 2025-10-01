import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

/**
 * Controlador para manejar el movimiento y animaciones del granjero
 */
export class FarmerController {
  /**
   * Crea una instancia de FarmerController
   * @param {Object} config - Configuración del controlador
   * @param {THREE.Object3D} model - Modelo 3D del granjero
   * @param {Object} modelLoader - Instancia del cargador de modelos
   */
  constructor(model, modelLoader, camera, config = {}) {
    this.model = model;
    this.modelLoader = modelLoader;
    this.camera = camera;
    this.config = {
      moveSpeed: 0.1,
      rotationSpeed: 0.05,
      runMultiplier: 1.5,
      // Límites del terreno (ajustar según el tamaño real del terreno)
      bounds: {
        minX: -250, // -size/2
        maxX: 250, // size/2
        minZ: -250, // -size/2
        maxZ: 250, // size/2
      },
      ...config,
    };

    // Referencia al corral para detección de colisiones
    this.corral = null;

    // Referencia al Space Shuttle para detección de colisiones
    this.spaceShuttle = null;

    // Referencia a las piedras para detección de colisiones
    this.stones = null;

    // Referencia a la casa para detección de colisiones
    this.house = null;

    // Estado de las teclas
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
    };

    // Estado de rotación
    this.isRotating = false;
    this.targetRotation = null;
    this.rotationSpeed = Math.PI; // 180 grados por segundo

    // Inicializar el controlador
    this.setupEventListeners();

    // Crear HUD de coordenadas
    this.createCoordinateDisplay();
  }

  /**
   * Crea un HUD rectangular HTML para mostrar coordenadas del farmer
   */
  createCoordinateDisplay() {
    // Crear elemento HTML para el HUD
    this.coordinateHUD = document.createElement('div');
    this.coordinateHUD.id = 'farmer-coordinate-hud';
    
    // Estilo del HUD tipo D2 rectangular
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
    
    // Contenido inicial del HUD
    this.coordinateHUD.innerHTML = `
      <div style="margin-bottom: 8px; color: #ffffff; font-size: 12px;">FARMER COORDINATES</div>
      <div id="coord-values">X: 0.0  Y: 0.0  Z: 0.0</div>
    `;
    
    // Añadir el HUD al documento
    document.body.appendChild(this.coordinateHUD);
    
    // Guardar referencia al elemento de valores
    this.coordValuesElement = document.getElementById('coord-values');
    
    // Actualizar coordenadas inicialmente
    this.updateCoordinateDisplay();
  }

  /**
   * Actualiza el texto del HUD de coordenadas
   */
  updateCoordinateDisplay() {
    if (!this.coordValuesElement || !this.model) return;
    
    const position = this.model.position;
    const text = `X: ${position.x.toFixed(1)}  Y: ${position.y.toFixed(1)}  Z: ${position.z.toFixed(1)}`;
    
    // Actualizar el contenido del HUD
    this.coordValuesElement.textContent = text;
  }

  /**
   * Establece la referencia al corral para detección de colisiones
   * @param {Corral} corral - Instancia del corral
   */
  setCorral(corral) {
    this.corral = corral;
  }

  /**
   * Establece la referencia al Space Shuttle para detección de colisiones
   * @param {SpaceShuttle} spaceShuttle - Instancia del Space Shuttle
   */
  setSpaceShuttle(spaceShuttle) {
    this.spaceShuttle = spaceShuttle;
  }

  /**
   * Establece la referencia a las piedras para detección de colisiones
   * @param {Array} stones - Array de instancias de piedras
   */
  setStones(stones) {
    if (!stones || stones.length === 0) {
      console.warn("⚠️ No se proporcionaron piedras válidas");
      return;
    }
    
    this.stones = stones;
    
    // Verificar que las piedras tengan el método de colisión
    const validStones = stones.filter(stone => {
      const hasCheckCollision = typeof stone.checkCollision === 'function';
      if (!hasCheckCollision) {
        console.warn("⚠️ Piedra sin método checkCollision:", stone);
      }
      return hasCheckCollision;
    });
    
    if (validStones.length === 0) {
      console.warn("⚠️ Ninguna piedra tiene método checkCollision");
      this.stones = null;
      return;
    }
    
    this.stones = validStones;
    console.log(`✅ Conectadas ${validStones.length} piedras al farmerController`);
  }

  /**
   * Establece la referencia a la casa para detección de colisiones
   * @param {House} house - Instancia de la casa
   */
  setHouse(house) {
    if (!house) {
      console.warn("⚠️ No se proporcionó una casa válida");
      return;
    }
    
    this.house = house;
    
    // Verificar que la casa tenga el método de colisión
    const hasCheckCollision = typeof house.checkCollision === 'function';
    if (!hasCheckCollision) {
      console.warn("⚠️ La casa no tiene método checkCollision:", house);
      this.house = null;
      return;
    }
    
    console.log("✅ Casa conectada al farmerController para detección de colisiones");
  }

  /**
   * Verifica si el personaje colisiona con el corral
   * @param {THREE.Vector3} newPosition - Nueva posición a verificar
   * @returns {boolean} - True si hay colisión
   */
  checkCorralCollision(newPosition) {
    if (!this.corral || !this.model) return false;

    // Crear una caja de colisión temporal para el personaje en la nueva posición
    const characterSize = new THREE.Vector3(1, 2, 1); // Tamaño aproximado del personaje
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      characterSize
    );

    // Verificar colisión con el corral
    const collision = this.corral.checkCollision(characterBox);
    return collision !== null;
  }

  /**
   * Verifica si el personaje colisiona con el Space Shuttle
   * @param {THREE.Vector3} newPosition - Nueva posición a verificar
   * @returns {boolean} - True si hay colisión
   */
  checkSpaceShuttleCollision(newPosition) {
    if (!this.spaceShuttle || !this.model) return false;
    
    // Tamaño del bounding box del farmer para detección de colisiones
    const characterSize = new THREE.Vector3(2, 2, 2);
    
    // Verificar colisión con el Space Shuttle
    return this.spaceShuttle.checkCollision(newPosition, characterSize);
  }

  /**
   * Verifica si el personaje colisiona con las piedras
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si hay colisión con alguna piedra
   */
  checkStonesCollision(position) {
    if (!this.stones || !this.model) return false;
    
    // Tamaño del bounding box del farmer para detección de colisiones
    const characterSize = new THREE.Vector3(4, 4, 4);
    
    // Verificar colisión con cada piedra
    for (const stone of this.stones) {
      if (stone.checkCollision(position, characterSize)) {
        console.log(" Colisión detectada con piedra en posición:", position);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Verifica si el personaje colisiona con la casa
   * @param {THREE.Vector3} newPosition - Nueva posición a verificar
   * @returns {boolean} - True si hay colisión con la casa
   */
  checkHouseCollision(newPosition) {
    if (!this.house || !this.model) return false;

    // Tamaño del bounding box del farmer para detección de colisiones
    const characterSize = new THREE.Vector3(2, 2, 2);

    // Crear una caja de colisión temporal para el personaje en la nueva posición
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      characterSize
    );

    // Verificar colisión con la casa
    const collision = this.house.checkCollision(characterBox);
    if (collision) {
      console.log("Colisión detectada con la casa en posición:", newPosition);
      return true;
    }

    return false;
  }

  /**
   * Obtiene el movimiento ajustado para evitar colisiones más cercana y ajusta el movimiento
   * @param {THREE.Vector3} currentPosition - Posición actual
   * @param {THREE.Vector3} movementVector - Vector de movimiento
   * @returns {THREE.Vector3} - Vector de movimiento ajustado
   */
  getAdjustedMovement(currentPosition, movementVector) {
    // Probar la nueva posición
    const newPosition = currentPosition.clone().add(movementVector);

    // Verificar colisión con el corral
    if (this.corral && this.checkCorralCollision(newPosition)) {
      // Hay colisión con el corral, intentar deslizamiento suave
      const adjustedMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );

      // Si el deslizamiento no funciona, detener el movimiento completamente
      if (adjustedMovement.length() === 0) {
        return new THREE.Vector3(0, 0, 0);
      }

      return adjustedMovement;
    }

    // Verificar colisión con el Space Shuttle
    if (this.spaceShuttle && this.checkSpaceShuttleCollision(newPosition)) {
      // Hay colisión con el Space Shuttle, intentar deslizamiento suave
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    // Verificar colisión con las piedras
    if (this.stones && this.checkStonesCollision(newPosition)) {
      // Hay colisión con las piedras, intentar deslizamiento suave
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    // Verificar colisión con la casa
    if (this.house && this.checkHouseCollision(newPosition)) {
      // Hay colisión con la casa, intentar deslizamiento suave
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    // Si no hay colisiones, permitir el movimiento
    return movementVector;
  }

  /**
   * Obtiene un movimiento de deslizamiento suave cuando hay colisión
   * @param {THREE.Vector3} currentPosition - Posición actual
   * @param {THREE.Vector3} movementVector - Vector de movimiento original
   * @returns {THREE.Vector3} - Vector de movimiento ajustado para deslizamiento
   */
  getSlidingMovement(currentPosition, movementVector) {
    // Intentar movimiento solo en el eje X
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (this.isPositionValid(xPosition)) {
      return xMovement;
    }

    // Intentar movimiento solo en el eje Z
    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (this.isPositionValid(zPosition)) {
      return zMovement;
    }

    // Si ambos ejes tienen colisión, detener el movimiento
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Verifica si una posición es válida (sin colisiones)
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si la posición es válida
   */
  isPositionValid(position) {
    // Verificar colisión con el corral
    if (this.corral && this.checkCorralCollision(position)) {
      return false;
    }

    // Verificar colisión con el Space Shuttle
    if (this.spaceShuttle && this.checkSpaceShuttleCollision(position)) {
      return false;
    }

    // Verificar colisión con las piedras
    if (this.stones && this.checkStonesCollision(position)) {
      return false;
    }

    // Verificar colisión con la casa
    if (this.house && this.checkHouseCollision(position)) {
      return false;
    }

    // Si no hay colisiones, la posición es válida
    return true;
  }

  /**
   * Determina si el personaje está de frente a la cámara
   * @returns {boolean} - True si el personaje está de frente a la cámara
   */
  isFacingCamera() {
    if (!this.camera || !this.model) return false;

    // Obtener la dirección del personaje (hacia adelante)
    const characterDirection = new THREE.Vector3(
      Math.sin(this.model.rotation.y),
      0,
      Math.cos(this.model.rotation.y)
    );

    // Obtener la dirección de la cámara al personaje
    const cameraToCharacter = new THREE.Vector3()
      .subVectors(this.model.position, this.camera.position)
      .normalize();
    cameraToCharacter.y = 0; // Ignorar la altura

    // Calcular el producto punto para determinar si están mirando en direcciones similares
    const dotProduct = characterDirection.dot(cameraToCharacter);

    // Si el producto punto es positivo, el personaje está de frente a la cámara
    return dotProduct <= 0;
  }

  /**
   * Configura los event listeners para el control del teclado
   */
  setupEventListeners() {
    // Evento cuando se presiona una tecla
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        this.keys[key] = true;
        this.updateAnimationState();
      } else if (key === "shift") {
        this.keys.shift = true;
        this.updateAnimationState();
      }
    });

    // Evento cuando se suelta una tecla
    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        this.keys[key] = false;
        this.updateAnimationState();
      } else if (key === "shift") {
        this.keys.shift = false;
        this.updateAnimationState();
      }
    });
  }

  /**
   * Actualiza el estado de las animaciones según la entrada del usuario
   */
  updateAnimationState() {
    if (!this.modelLoader || !this.modelLoader.model) {
      console.warn("No se puede actualizar animación: modelo no cargado");
      return;
    }

    // Si está rotando, no cambiar la animación
    if (this.isRotating) {
      return;
    }

    // Determinar el estado actual del movimiento
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

    if (!isMoving) {
      this.modelLoader.play("idle", 0.15);
      return;
    }

    // Determinar la animación basada en la dirección del movimiento
    
    // Movimiento diagonal adelante-izquierda (W + A)
    if ((this.keys.w || this.keys.ArrowUp) && (this.keys.a || this.keys.ArrowLeft)) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls ? "diagonalForwardRight" : "diagonalForwardLeft";
      this.modelLoader.play(animation, 0.1);
    } 
    // Movimiento diagonal adelante-derecha (W + D)
    else if ((this.keys.w || this.keys.ArrowUp) && (this.keys.d || this.keys.ArrowRight)) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls ? "diagonalForwardLeft" : "diagonalForwardRight";
      this.modelLoader.play(animation, 0.1);
    }
    // Movimiento hacia adelante
    else if (this.keys.w || this.keys.ArrowUp) {
      this.modelLoader.play(isRunning ? "run" : "walk", 0.1);
    } 
    // Movimiento hacia atrás (rotación 180)
    else if (this.keys.s || this.keys.ArrowDown) {
      // Iniciar rotación de 180 grados
      this.start180Rotation();
    } 
    // Movimiento lateral - invertir animaciones según orientación a la cámara
    else {
      const shouldInvertControls = this.isFacingCamera();

      if (
        (this.keys.a || this.keys.ArrowLeft) &&
        !(this.keys.d || this.keys.ArrowRight)
      ) {
        // Si está de frente a la cámara, A/D se invierten, así que A muestra animación de derecha
        const animation = shouldInvertControls ? "strafeRight" : "strafeLeft";
        this.modelLoader.play(animation, 0.15);
      } else if (
        (this.keys.d || this.keys.ArrowRight) &&
        !(this.keys.a || this.keys.ArrowLeft)
      ) {
        // Si está de frente a la cámara, A/D se invierten, así que D muestra animación de izquierda
        const animation = shouldInvertControls ? "strafeLeft" : "strafeRight";
        this.modelLoader.play(animation, 0.15);
      }
    }
  }

  /**
   * Inicia la rotación de 180 grados
   */
  start180Rotation() {
    if (this.isRotating) return;

    this.isRotating = true;
    // Calcular el objetivo de rotación (180 grados desde la rotación actual)
    this.targetRotation = this.model.rotation.y + Math.PI;

    // Reproducir animación de giro
    this.modelLoader.play("turn180", 0.2);
  }

  /**
   * Actualiza la rotación del modelo
   * @param {number} delta - Tiempo transcurrido desde el último fotograma
   */
  updateRotation(delta) {
    if (!this.isRotating || this.targetRotation === null) return;

    const rotationStep = this.rotationSpeed * delta;
    const currentRotation = this.model.rotation.y;

    // Calcular la diferencia más corta al objetivo
    let diff = this.targetRotation - currentRotation;

    // Normalizar la diferencia al rango [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) <= rotationStep) {
      // Llegamos al objetivo
      this.model.rotation.y = this.targetRotation;
      this.isRotating = false;
      this.targetRotation = null;

      // Después de rotar, verificar si todavía se presiona alguna tecla de movimiento
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
        // Si se presiona 's' o flecha abajo, mover hacia adelante en la nueva dirección
        if (this.keys.s || this.keys.ArrowDown) {
          this.modelLoader.play(this.keys.shift ? "run" : "walk", 0.1);
        } else if (this.keys.w || this.keys.ArrowUp) {
          this.modelLoader.play(this.keys.shift ? "run" : "walk", 0.1);
        } else {
          // Para movimiento lateral, actualizar el estado de animación
          this.updateAnimationState();
        }
      } else {
        // Si no se presiona ninguna tecla de movimiento, volver a animación idle
        this.modelLoader.play("idle", 0.15);
      }
    } else {
      // Continuar rotando
      this.model.rotation.y += Math.sign(diff) * rotationStep;
    }
  }

  /**
   * Actualiza la posición del modelo basado en la entrada del usuario
   * @param {number} delta - Tiempo transcurrido desde el último fotograma
   */
  update(delta) {
    if (!this.model || !this.modelLoader?.model) {
      return;
    }

    // Actualizar rotación primero
    this.updateRotation(delta);

    // Si está rotando, no permitir movimiento
    if (this.isRotating) {
      return;
    }

    // Calcular la distancia de movimiento normalizada por tiempo
    const moveDistance = this.config.moveSpeed * 60 * delta;
    const isRunning = this.keys.shift;
    const currentMoveSpeed = isRunning
      ? moveDistance * this.config.runMultiplier
      : moveDistance;

    let moveX = 0;
    let moveZ = 0;
    let moved = false;

    // Movimiento hacia adelante (W y flecha arriba)
    if (this.keys.w || this.keys.ArrowUp) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    // Después de rotar 180 grados, 's' ahora mueve hacia adelante en la nueva dirección
    if (this.keys.s || this.keys.ArrowDown) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    // Movimiento lateral (A/D y flechas laterales)
    // Invertir controles si el personaje está de frente a la cámara
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

    // Normalizar el vector de movimiento para movimiento diagonal
    if (moved) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (length > 0) {
        moveX = (moveX / length) * currentMoveSpeed;
        moveZ = (moveZ / length) * currentMoveSpeed;
      }

      // Crear vector de movimiento
      const movementVector = new THREE.Vector3(moveX, 0, moveZ);

      // Ajustar movimiento según colisiones con el corral
      const adjustedMovement = this.getAdjustedMovement(
        this.model.position,
        movementVector
      );

      // Calcular nueva posición con límites y colisiones
      let newX = this.model.position.x + adjustedMovement.x;
      let newZ = this.model.position.z + adjustedMovement.z;

      // Aplicar límites del terreno
      newX = Math.max(
        this.config.bounds.minX,
        Math.min(newX, this.config.bounds.maxX)
      );
      newZ = Math.max(
        this.config.bounds.minZ,
        Math.min(newZ, this.config.bounds.maxZ)
      );

      // Verificación final de colisiones antes de aplicar el movimiento
      const finalPosition = new THREE.Vector3(
        newX,
        this.model.position.y,
        newZ
      );
      if (!this.checkCorralCollision(finalPosition)) {
        // Aplicar la nueva posición solo si no hay colisión
        this.model.position.setX(newX);
        this.model.position.setZ(newZ);
      }

      // Si hay colisión, detener el movimiento y mostrar advertencia
      if (this.checkCorralCollision(finalPosition)) {
        console.warn("Movimiento bloqueado por colisión con el corral");
        // Detener animación de movimiento
        this.modelLoader.play("idle", 0.15);
      }
    }

    // Rotación del personaje con Q y E (solo si no está rotando automáticamente)
    if (!this.isRotating) {
      if (this.keys.q) {
        this.model.rotation.y += this.config.rotationSpeed * 2;
      }
      if (this.keys.e) {
        this.model.rotation.y -= this.config.rotationSpeed * 2;
      }
    }

    // Actualizar el cartel de coordenadas
    this.updateCoordinateDisplay();
  }

  /**
   * Limpia los event listeners y el HUD
   */
  dispose() {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    
    // Limpiar el HUD de coordenadas
    if (this.coordinateHUD && this.coordinateHUD.parentNode) {
      this.coordinateHUD.parentNode.removeChild(this.coordinateHUD);
    }
  }
}

export default FarmerController;
