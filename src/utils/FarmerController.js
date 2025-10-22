import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/loaders/FBXLoader.js";

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
      moveSpeed: 0.3, // Aumentado para mayor velocidad base
      rotationSpeed: 0.1, // Rotación más rápida
      runMultiplier: 5.5, // Mayor multiplicador al correr
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

    // Referencia a las vacas para detección de colisiones
    this.cows = null;

    // Referencia al mercado para detección de colisiones
    this.market = null;

    // Referencia al inventario (se puede inyectar desde main.js)
    this.inventory = null;

    // Referencia al arma equipada
    this.equippedWeapon = null;
    this.isEquipped = false;

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
      e: false, // tecla E para rotar a la DERECHA
      q: false, // tecla Q para rotar a la IZQUIERDA
      1: false, // tecla 1 para equipar/descartar arma
    };

    // Estado de rotación
    this.isRotating = false;
    this.targetRotation = null;
    this.rotationSpeed = Math.PI; // 180 grados por segundo

    // Estado de rotación para tecla S (caminar hacia atrás)
    this.isRotatedForBackward = false;
    this.originalRotation = 0;

    // Estado de animación de colisión con vacas
    this.isCollidingWithCow = false;
    this.cowCollisionState = "none"; // none, kneelingDown, kneeling
    this.cowCollisionStartTime = 0;
    this.currentCollidedCow = null; // Vaca con la que se colisionó actualmente
    this.kneelingDownDuration = 2000; // 2 segundos para la animación de transición
    this.kneelingDuration = 15000; // 15 segundos para la animación final agachada

    // Tamaño unificado del bounding box del personaje para todas las colisiones
    this.characterSize = new THREE.Vector3(1, 1, 1);

    // Tamaño específico para colisiones con piedras (más pequeño para permitir acercarse más)
    this.stoneCollisionSize = new THREE.Vector3(0.5, 0.5, 0.5);

    // Inicializar el controlador
    this.setupEventListeners();

    // referencia al bone de la mano (si se encuentra) para seguirla
    this._handBone = null;

    // vector y quaternion temporales para cálculos
    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();

    // Crear HUD de coordenadas
    this.createCoordinateDisplay();
  }

  /**
   * Inyecta una instancia de Inventory para añadir leche al ordeñar
   * @param {Object} inventory - Instancia de Inventory
   */
  setInventory(inventory) {
    this.inventory = inventory;
    console.log("Inventory conectado al FarmerController");
  }

  /**
   * Crea un HUD rectangular HTML para mostrar coordenadas del farmer
   */
  createCoordinateDisplay() {
    // Crear elemento HTML para el HUD
    this.coordinateHUD = document.createElement("div");
    this.coordinateHUD.id = "farmer-coordinate-hud";

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
    this.coordValuesElement = document.getElementById("coord-values");

    // Actualizar coordenadas inicialmente
    this.updateCoordinateDisplay();
  }

  /**
   * Actualiza el texto del HUD de coordenadas
   */
  updateCoordinateDisplay() {
    if (!this.coordValuesElement || !this.model) return;

    const position = this.model.position;
    const text = `X: ${position.x.toFixed(1)}  Y: ${position.y.toFixed(
      1
    )}  Z: ${position.z.toFixed(1)}`;

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
    const validStones = stones.filter((stone) => {
      const hasCheckCollision = typeof stone.checkCollision === "function";
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
    console.log(
      `✅ Conectadas ${validStones.length} piedras al farmerController`
    );
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
    const hasCheckCollision = typeof house.checkCollision === "function";
    if (!hasCheckCollision) {
      console.warn("⚠️ La casa no tiene método checkCollision:", house);
      this.house = null;
      return;
    }

    console.log(
      "✅ Casa conectada al farmerController para detección de colisiones"
    );
  }

  /**
   * Establece la referencia a las vacas para detección de colisiones
   * @param {Array} cows - Array de instancias de vacas
   */
  setCows(cows) {
    if (!cows || cows.length === 0) {
      console.warn("⚠️ No se proporcionaron vacas válidas");
      return;
    }

    this.cows = cows;

    // Verificar que las vacas tengan el método de colisión
    const validCows = cows.filter((cow) => {
      const hasCheckCollision = typeof cow.checkCollision === "function";
      if (!hasCheckCollision) {
        console.warn("⚠️ Vaca sin método checkCollision:", cow);
      }
      return hasCheckCollision;
    });

    if (validCows.length === 0) {
      console.warn("⚠️ Ninguna vaca tiene método checkCollision");
      this.cows = null;
      return;
    }

    this.cows = validCows;
    console.log(`✅ Conectadas ${validCows.length} vacas al farmerController`);
  }

  /**
   * Verifica si el personaje colisiona con el corral
   * @param {THREE.Vector3} newPosition - Nueva posición a verificar
   * @returns {boolean} - True si hay colisión
   */
  checkCorralCollision(newPosition) {
    if (!this.corral || !this.model) return false;

    // Crear una caja de colisión temporal para el personaje en la nueva posición
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
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

    // Verificar colisión con el Space Shuttle
    return this.spaceShuttle.checkCollision(newPosition, this.characterSize);
  }

  /**
   * Verifica si el personaje colisiona con las piedras
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si hay colisión con alguna piedra
   */
  checkStonesCollision(position) {
    if (!this.stones || !this.model) return false;

    // Usar el tamaño específico para colisiones con piedras (más pequeño)
    const stoneCharacterSize = this.stoneCollisionSize;

    // Verificar colisión con cada piedra
    for (const stone of this.stones) {
      if (stone.checkCollision(position, stoneCharacterSize)) {
        console.log(
          "🚫 Colisión con piedra detectada usando tamaño específico:",
          {
            position: position,
            stoneCharacterSize: stoneCharacterSize,
            stonePosition: stone.model ? stone.model.position : "No disponible",
          }
        );
        return true; // Hay colisión con al menos una piedra
      }
    }
    return false; // No hay colisión con ninguna piedra
  }

  /**
   * Verifica si el personaje colisiona con alguna vaca
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si hay colisión con alguna vaca
   */
  checkCowsCollision(position) {
    if (!this.cows || !this.model) return false;

    // Verificar colisión con cada vaca
    for (const cow of this.cows) {
      if (cow.checkCollision(position, this.characterSize)) {
        console.log("🐄 Colisión con vaca detectada:", {
          farmerPosition: position,
          cowPosition: cow.model ? cow.model.position : "No disponible",
          hasExclamationMark: cow.hasExclamationMarkVisible(),
        });

        // Solo activar animación de colisión si la vaca tiene el signo de exclamación visible
        if (cow.hasExclamationMarkVisible()) {
          // Activar animación de colisión con vaca y pasar la vaca como referencia
          this.handleCowCollisionAnimation(cow);
        }

        return true; // Hay colisión con al menos una vaca
      }
    }
    return false; // No hay colisión con ninguna vaca
  }

  /**
   * Maneja la animación de colisión con vacas
   * @param {Cow} cow - La vaca con la que se colisionó
   */
  handleCowCollisionAnimation(cow) {
    if (!this.isCollidingWithCow) {
      this.isCollidingWithCow = true;
      this.cowCollisionState = "kneelingDown";
      this.cowCollisionStartTime = Date.now();
      this.currentCollidedCow = cow; // Almacenar la vaca con la que se colisionó
      console.log(
        "🐄 Iniciando secuencia de animación de colisión con vaca que tiene signo de exclamación"
      );

      // Actualizar el estado de animación inmediatamente
      this.updateAnimationState();
    }
  }

  /**
   * Actualiza el estado de la animación de colisión con vacas
   * @param {number} currentTime - Tiempo actual en milisegundos
   */
  updateCowCollisionAnimation(currentTime) {
    if (this.isCollidingWithCow) {
      const elapsedTime = currentTime - this.cowCollisionStartTime;

      if (this.cowCollisionState === "kneelingDown") {
        // Si ha pasado el tiempo de la animación de transición, cambiar al estado final agachado
        if (elapsedTime >= this.kneelingDownDuration) {
          this.cowCollisionState = "kneeling";
          this.cowCollisionStartTime = Date.now(); // Reiniciar el tiempo para el estado kneeling
          console.log("🐄 Transición a estado final agachado");

          // Actualizar el estado de animación para reproducir la animación final
          this.updateAnimationState();
        }
      } else if (this.cowCollisionState === "kneeling") {
        // Si ha pasado el tiempo de la animación final, terminar la secuencia y reiniciar la barra de progreso
        if (elapsedTime >= this.kneelingDuration) {
          console.log("🐄 Secuencia de animación de colisión finalizada");

          // Reiniciar la barra de progreso de la vaca con la que se colisionó
          if (this.currentCollidedCow) {
            console.log("🐄 Reiniciando barra de progreso de la vaca");
            this.currentCollidedCow.resetProgressBar();
          }

          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;
          // Al finalizar el kneeling, otorgar leche al inventario si está conectado
          try {
            // Generar cantidad aleatoria entre 1.2 y 2.5 litros
            const min = 1.2;
            const max = 2.5;
            const milkAmount =
              Math.round((Math.random() * (max - min) + min) * 100) / 100; // 2 decimales

            const addAndNotify = (inv) => {
              inv.addMilk(milkAmount);
              // Calcular posición en pantalla encima del personaje si es posible
              let screenPos = null;
              try {
                if (
                  this.camera &&
                  this.model &&
                  typeof window !== "undefined"
                ) {
                  // proyectar la posición del modelo al espacio de pantalla (NDC)
                  const vector = this.model.position.clone();
                  // ajustar altura para mostrar arriba de la cabeza
                  vector.y += 1.6;
                  vector.project(this.camera);

                  // Normalized device coords (NDC) -> pixel coords relative to renderer canvas
                  const ndcX = vector.x;
                  const ndcY = vector.y;

                  // Preferir calcular respecto al canvas del renderer si está disponible
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
                    // Fallback a viewport completo
                    const halfWidth = window.innerWidth / 2;
                    const halfHeight = window.innerHeight / 2;
                    screenPos = {
                      x: ndcX * halfWidth + halfWidth,
                      y: -ndcY * halfHeight + halfHeight,
                    };
                  }
                }
              } catch (e) {
                console.warn("No se pudo calcular screenPos para popup:", e);
                screenPos = null;
              }

              // Intentar usar popup si existe, si no usar notify
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
              console.log(`🐄 Ordeñaste y obtuviste ${milkAmount} L de leche`);
            } else if (
              window &&
              window.inventory &&
              typeof window.inventory.addMilk === "function"
            ) {
              // Fallback a window.inventory
              addAndNotify(window.inventory);
              console.log(
                `🐄 Ordeñaste y obtuviste ${milkAmount} L de leche (fallback window.inventory)`
              );
            }
          } catch (err) {
            console.warn("No se pudo añadir leche al inventario:", err);
          }

          this.currentCollidedCow = null; // Limpiar la referencia a la vaca

          // Actualizar el estado de animación para volver al estado normal
          this.updateAnimationState();
        }
      }
    }
  }

  /**
   * Obtiene el movimiento ajustado específicamente para colisiones con piedras
   * Permite acercamiento más cercano y deslizamiento suave
   * @param {THREE.Vector3} currentPosition - Posición actual
   * @param {THREE.Vector3} movementVector - Vector de movimiento original
   * @returns {THREE.Vector3} - Vector de movimiento ajustado para piedras
   */
  getStoneAdjustedMovement(currentPosition, movementVector) {
    // Primero verificar si hay colisión con el movimiento completo
    const newPosition = currentPosition.clone().add(movementVector);

    if (!this.checkStonesCollision(newPosition)) {
      return movementVector; // No hay colisión, permitir movimiento completo
    }

    // Si hay colisión, intentar deslizamiento suave
    // Intentar movimiento solo en X
    const xMovement = new THREE.Vector3(movementVector.x, 0, 0);
    const xPosition = currentPosition.clone().add(xMovement);

    if (!this.checkStonesCollision(xPosition)) {
      return xMovement; // Permitir movimiento solo en X
    }

    // Intentar movimiento solo en Z
    const zMovement = new THREE.Vector3(0, 0, movementVector.z);
    const zPosition = currentPosition.clone().add(zMovement);

    if (!this.checkStonesCollision(zPosition)) {
      return zMovement; // Permitir movimiento solo en Z
    }

    // Si tampoco funciona, intentar movimiento reducido
    const reducedMovement = movementVector.clone().multiplyScalar(0.5);
    const reducedPosition = currentPosition.clone().add(reducedMovement);

    if (!this.checkStonesCollision(reducedPosition)) {
      return reducedMovement; // Permitir movimiento reducido
    }

    // Si todo falla, detener movimiento completamente
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Verifica si el personaje colisiona con la casa
   * @param {THREE.Vector3} newPosition - Nueva posición a verificar
   * @returns {boolean} - True si hay colisión con la casa
   */
  checkHouseCollision(newPosition) {
    if (!this.house || !this.model) return false;

    // Crear una caja de colisión temporal para el personaje en la nueva posición
    const characterBox = new THREE.Box3().setFromCenterAndSize(
      newPosition,
      this.characterSize
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
    // Si está en animación de colisión con vaca, detener movimiento completamente
    if (this.isCollidingWithCow) {
      return new THREE.Vector3(0, 0, 0);
    }

    // Probar la nueva posición
    const newPosition = currentPosition.clone().add(movementVector);

    // Verificar colisión con el mercado (antes que otras colisiones)
    if (this.market && this.checkMarketCollision(newPosition)) {
      console.log(
        "🚫 Colisión con mercado detectada, intentando deslizamiento..."
      );
      // Intentar deslizamiento suave contra el mercado
      const slidingMovement = this.getSlidingMovement(
        currentPosition,
        movementVector
      );
      // Si el deslizamiento resulta en movimiento, usarlo, de lo contrario detenerse
      return slidingMovement.length() > 0
        ? slidingMovement
        : new THREE.Vector3(0, 0, 0);
    }

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
      // Hay colisión con las piedras, usar el método específico para piedras
      // que permite acercamiento más cercano y deslizamiento suave
      const stoneAdjustedMovement = this.getStoneAdjustedMovement(
        currentPosition,
        movementVector
      );

      // Si el ajuste específico para piedras no funciona, intentar deslizamiento general
      if (stoneAdjustedMovement.length() === 0) {
        return this.getSlidingMovement(currentPosition, movementVector);
      }

      return stoneAdjustedMovement;
    }

    // Verificar colisión con la casa
    if (this.house && this.checkHouseCollision(newPosition)) {
      // Hay colisión con la casa, intentar deslizamiento suave
      return this.getSlidingMovement(currentPosition, movementVector);
    }

    // Verificar colisión con las vacas
    if (this.cows && this.checkCowsCollision(newPosition)) {
      // Hay colisión con las vacas, detener movimiento completamente
      console.log("🐄 Movimiento detenido por colisión con vaca");
      return new THREE.Vector3(0, 0, 0); // Detener movimiento
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

    // Verificar colisión con el mercado
    if (this.market && this.checkMarketCollision(position)) {
      return false;
    }

    // Si no hay colisiones, la posición es válida
    return true;
  }

  /**
   * Verifica si hay colisión con el área del mercado
   * @param {THREE.Vector3} position - Posición a verificar
   * @returns {boolean} - True si hay colisión
   */
  checkMarketCollision(position) {
    if (!this.market || !this.market.marketGroup) {
      console.warn(
        "Mercado no está correctamente inicializado para detección de colisiones"
      );
      return false;
    }

    // Coordenadas exactas del polígono del mercado (ajustadas manualmente)
    // Basadas en las coordenadas que proporcionaste
    const marketPolygon = [
      new THREE.Vector2(-148.7, 51.5), // Punto 1
      new THREE.Vector2(-154.7, 46.2), // Punto 2
      new THREE.Vector2(-162.7, 55.3), // Punto 3
      new THREE.Vector2(-156.5, 60.4), // Punto 4
      new THREE.Vector2(-148.7, 51.5), // Cierra el polígono
    ];

    // Punto a verificar (posición del personaje)
    const point = new THREE.Vector2(position.x, position.z);

    // Algoritmo de punto en polígono (ray casting)
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

      // Asegurarse de que no haya divisiones por cero
      if (yj === yi) continue;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    // Para depuración: mostrar la posición y si hay colisión
    if (inside) {
      console.log(
        "🚫 Colisión con mercado en posición:",
        `X: ${position.x.toFixed(1)}, Z: ${position.z.toFixed(1)}`,
        "Polígono:",
        marketPolygon.map((p) => `(${p.x}, ${p.y})`).join(" -> ")
      );
    }

    return inside;
  }

  /**
   * Establece la referencia al mercado para detección de colisiones
   * @param {Object} market - Instancia del mercado
   */
  /**
   * Establece la referencia al mercado para detección de colisiones
   * @param {Object} market - Instancia del mercado
   */
  setMarket(market) {
    this.market = market;
    if (market && market.marketGroup) {
      console.log("✅ Market reference set in FarmerController", {
        position: market.marketGroup.position,
        rotation: market.marketGroup.rotation,
      });
    } else {
      console.warn("⚠️ Se pasó una referencia de mercado no válida");
    }
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
        // Detectar si se presiona S o flecha abajo por primera vez
        if ((key === "s" || key === "arrowdown") && !this.keys[key]) {
          // Guardar rotación original y rotar 180°
          this.originalRotation = this.model.rotation.y;
          this.model.rotation.y += Math.PI;
          this.isRotatedForBackward = true;
        }

        this.keys[key] = true;
        this.updateAnimationState();

        // Manejar tecla '1' para equipar/desequipar arma
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

    // Evento cuando se suelta una tecla
    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key in this.keys) {
        // Detectar si se suelta S o flecha abajo
        if ((key === "s" || key === "arrowdown") && this.isRotatedForBackward) {
          // Restaurar rotación original
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

  /**
   * Busca recursivamente el hueso de la mano en el modelo
   * @param {THREE.Object3D} object - Objeto o hueso donde buscar
   * @returns {THREE.Bone|null} - Hueso de la mano (izquierda o derecha) o null si no se encuentra
   */
  findRightHandBone(object) {
    if (!object) return null;

    // Debug: Log the bone hierarchy
    if (object.isBone && object.parent) {
      console.log(`Bone found: ${object.name} (parent: ${object.parent.name})`);
    }

    if (object.isBone) {
      const name = object.name.toLowerCase();

      // Buscar específicamente el hueso de la mano izquierda (left hand)
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
        console.log(`Hueso de la mano izquierda encontrado: ${object.name}`);

        // Agregar una esfera de depuración en la posición del hueso
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        debugSphere.name = "leftHandDebug";
        object.add(debugSphere);

        return object;
      }

      // Si no se encuentra la mano izquierda, buscar la derecha como respaldo
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
        console.log(
          `Hueso de la mano derecha encontrado: ${object.name} (usando como respaldo)`
        );

        // Agregar una esfera de depuración en la posición del hueso
        const debugSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        debugSphere.name = "rightHandDebug";
        object.add(debugSphere);

        return object;
      }
    }

    // Búsqueda recursiva en los hijos
    if (object.children) {
      for (const child of object.children) {
        const result = this.findRightHandBone(child);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Intenta equipar el arma precargada en window.loadedAxe
   */
  async equipWeapon() {
    try {
      if (this.isEquipped) {
        console.log("El arma ya está equipada");
        return;
      }

      // Asegurarse de que el modelo esté completamente cargado
      this.model.updateMatrixWorld(true);

      // Encontrar el hueso de la mano izquierda
      this._handBone = this.findRightHandBone(this.model);

      if (!this._handBone) {
        console.warn(
          "No se encontró el hueso de la mano izquierda, usando posición por defecto"
        );
        // Posición por defecto si no se encuentra el hueso
        this._weaponPivot = new THREE.Group();
        this.model.add(this._weaponPivot);
      } else {
        console.log(`Usando hueso para el arma: ${this._handBone.name}`);
        // Crear un pivote para el arma
        this._weaponPivot = new THREE.Group();

        // Asegurarse de que el pivote esté en la jerarquía correcta
        if (this._handBone) {
          // Si ya tiene un padre, quitarlo primero
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);
          console.log("Pivote del arma añadido al hueso:", this._handBone.name);

          // Asegurar que el pivote herede la rotación del personaje
          this._weaponPivot.matrixAutoUpdate = true;
        }
      }

      // Limpiar cualquier arma anterior
      while (this._weaponPivot.children.length) {
        this._weaponPivot.remove(this._weaponPivot.children[0]);
      }

      // Si ya hay un arma cargada, úsala
      if (window.loadedAxe) {
        // Clonar el modelo del arma para evitar problemas de referencia
        this.equippedWeapon = window.loadedAxe.clone();

        // Ajustar escala del arma para que sea visible
        this.equippedWeapon.scale.set(0.5, 0.5, 0.5);

        // Asegurar que el arma sea visible
        console.log("Configurando visibilidad del arma...");
        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            console.log(`Procesando mesh: ${child.name || "sin nombre"}`);

            // Hacer el mesh visible
            child.visible = true;
            child.frustumCulled = false; // Desactivar frustum culling

            // Configurar materiales para que sean visibles
            if (Array.isArray(child.material)) {
              console.log(`  - Materiales (${child.material.length}):`);
              child.material.forEach((mat, i) => {
                console.log(`    [${i}]`, mat);
                mat.visible = true;
                mat.transparent = false;
                mat.opacity = 1;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });
            } else if (child.material) {
              console.log("  - Material:", child.material);
              child.material.visible = true;
              child.material.transparent = false;
              child.material.opacity = 1;
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }

            // Configurar sombras
            child.castShadow = true;
            child.receiveShadow = true;

            // Forzar actualización de la matriz
            child.updateMatrix();

            // Eliminado el recuadro verde de depuración
          }
        });

        console.log("Arma configurada:", this.equippedWeapon);

        // Añadir el arma al pivote
        this._weaponPivot.add(this.equippedWeapon);

        // Ajustes de posición y rotación relativos al hueso de la mano
        // Posición del arma (ajustar según sea necesario)
        this._weaponPivot.position.set(0.1, 0.1, 0); // Ajuste fino de posición
        this._weaponPivot.rotation.set(0, 0, 0); // Rotación inicial

        // Asegurar que el pivote esté en la jerarquía correcta
        if (this._handBone) {
          // Si ya tiene un padre, quitarlo primero
          if (this._weaponPivot.parent) {
            this._weaponPivot.parent.remove(this._weaponPivot);
          }
          this._handBone.add(this._weaponPivot);
          console.log("Pivote del arma añadido al hueso:", this._handBone.name);
        }

        // Ajustar la escala del arma (aumentada para mejor visibilidad)
        this.equippedWeapon.scale.set(10, 10, 10);

        // Posición relativa al pivote (ajustar según sea necesario)
        this.equippedWeapon.position.set(0.1, 0.1, 0);

        // Rotación inicial del hacha para que apunte hacia adelante
        this.equippedWeapon.rotation.set(
          -Math.PI / 2, // Apuntar hacia adelante
          0, // Sin rotación en Y
          Math.PI / 4 // Inclinación de 45 grados para mejor agarre
        );

        // Ajustar la posición del pivote para que el arma esté en la mano
        // Valores ajustados para la mano izquierda
        this._weaponPivot.position.set(
          0.2, // Ajuste lateral (positivo para derecha, negativo para izquierda)
          0.2, // Ajuste vertical (arriba/abajo)
          0.1 // Ajuste hacia adelante/atrás
        );

        // Asegurar que el arma esté orientada correctamente
        this.equippedWeapon.updateMatrix();

        // Punto de referencia visual (temporalmente visible para depuración)
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        marker.name = "weaponMarker";
        marker.visible = true; // Temporalmente visible para depuración
        this.equippedWeapon.add(marker);

        // Asegurar que el arma sea visible
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

        // Asegurarse de que el arma esté orientada correctamente
        this.equippedWeapon.updateMatrix();

        // Actualizar las matrices de toda la jerarquía
        this.model.updateMatrixWorld(true);
        if (this._handBone) this._handBone.updateMatrixWorld(true);
        this._weaponPivot.updateMatrixWorld(true);
        this.equippedWeapon.updateMatrixWorld(true);

        // Forzar actualización de todas las matrices
        this.model.traverse((obj) => {
          if (obj.updateMatrix) obj.updateMatrix();
          if (obj.updateMatrixWorld) obj.updateMatrixWorld(true);
        });

        // Forzar renderizado
        if (this._renderer && this._scene && this._camera) {
          console.log("Forzando renderizado...");
          this._renderer.render(this._scene, this._camera);

          // Añadir un temporizador para forzar actualizaciones
          if (!this._debugInterval) {
            this._debugInterval = setInterval(() => {
              console.log("Actualizando arma...");
              this.equippedWeapon.updateMatrix();
              this.equippedWeapon.updateMatrixWorld(true);
              this._renderer.render(this._scene, this._camera);
            }, 1000);
          }
        }

        // Depuración: Mostrar un punto en la posición del arma
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

        // Depuración: Mostrar ejes en el pivote del arma
        const axesHelper = new THREE.AxesHelper(0.5);
        axesHelper.name = "weaponAxes";
        this._weaponPivot.add(axesHelper);

        // Depuración: Mostrar ejes en el hueso de la mano
        if (this._handBone) {
          const handAxes = new THREE.AxesHelper(0.3);
          handAxes.name = "handAxes";
          this._handBone.add(handAxes);
        }

        // Forzar actualización de la matriz del mundo
        this.equippedWeapon.updateMatrixWorld(true);

        // Depuración
        console.log("=== INFORMACIÓN DEL ARMA ===");
        console.log("Posición del arma (local):", this.equippedWeapon.position);
        console.log(
          "Posición del arma (mundo):",
          this.equippedWeapon.getWorldPosition(new THREE.Vector3())
        );
        console.log("Escala del arma:", this.equippedWeapon.scale);
        console.log("Rotación del arma:", this.equippedWeapon.rotation);
        console.log("==========================");

        // Forzar actualización de la escena
        this.equippedWeapon.updateMatrixWorld(true);

        // Verificar si el arma tiene geometría
        this.equippedWeapon.traverse((child) => {
          if (child.isMesh) {
            console.log("Mesh encontrado en el arma:", child);
            console.log("Geometría del mesh:", child.geometry);
            console.log("Material del mesh:", child.material);
          }
        });

        // Depuración
        console.log("=== INFORMACIÓN DEL ARMA ===");
        console.log("Posición del arma (local):", this.equippedWeapon.position);
        console.log(
          "Posición del arma (mundo):",
          this.equippedWeapon.getWorldPosition(new THREE.Vector3())
        );
        console.log("Rotación del arma:", this.equippedWeapon.rotation);
        console.log("Escala del arma:", this.equippedWeapon.scale);
        console.log("==========================");

        this.isEquipped = true;
        console.log("Arma equipada correctamente");
        return;
      }

      // Si no hay arma cargada, crea una caja roja temporal
      console.log(
        "No se encontró un arma precargada, creando una de prueba..."
      );

      // Crear un grupo para el hacha
      const axe = new THREE.Group();

      // Crear el mango del hacha (más grueso y largo)
      const handleGeometry = new THREE.BoxGeometry(0.2, 1.0, 0.2);
      const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 }); // Marrón madera
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);

      // Crear la cabeza del hacha (más grande)
      const headGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.8);
      const headMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc }); // Gris metal
      const head = new THREE.Mesh(headGeometry, headMaterial);

      // Posicionar la cabeza en la parte superior del mango
      head.position.y = 0.5;
      head.rotation.z = Math.PI / 4; // Inclinar la cabeza del hacha

      // Añadir las partes al hacha
      axe.add(handle);
      axe.add(head);

      // Hacer el hacha más grande
      axe.scale.set(2, 2, 2);

      // Añadir el hacha a la escena (directamente al modelo por ahora)
      this.model.add(axe);
      this.equippedWeapon = axe;

      // Mostrar posición de depuración
      console.log("Hacha de prueba creada en posición:", axe.position);

      // Encontrar el hueso de la mano
      this._handBone = this.findRightHandBone(this.model);

      if (this._handBone) {
        console.log("Hueso de la mano encontrado:", this._handBone.name);

        // Obtener la posición y rotación del hueso
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        // Aplicar la posición y rotación al arma
        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        // Ajustes de posición (más pronunciados para mejor visibilidad)
        this.equippedWeapon.translateX(0.5); // Mover más a la derecha
        this.equippedWeapon.translateY(0.5); // Mover más arriba
        this.equippedWeapon.translateZ(0.5); // Mover más al frente

        // Rotación para mejor visibilidad
        this.equippedWeapon.rotation.x = Math.PI / 2; // Apuntar hacia adelante
        this.equippedWeapon.rotation.y = Math.PI / 4; // Girar 45 grados

        // Actualizar la matriz del mundo del arma
        this.equippedWeapon.updateMatrixWorld(true);
      } else {
        console.warn(
          "No se encontró el hueso de la mano, usando posición por defecto"
        );
        // Posición por defecto si no se encuentra el hueso
        this.equippedWeapon.position.copy(this.model.position);
        this.equippedWeapon.position.y += 2.0; // Ajustar altura (más alto)
        this.equippedWeapon.position.z += 1.0; // Mover hacia adelante
        this.equippedWeapon.rotation.set(Math.PI / 2, 0, 0); // Rotar para mejor visibilidad
      }

      this.isEquipped = true;
      console.log("Hacha de prueba creada");

      console.log("Hacha de prueba creada en la mano derecha");

      // Función para mostrar información de depuración
      const logDebugInfo = () => {
        const worldPos = new THREE.Vector3();
        axe.getWorldPosition(worldPos);

        console.log("=== INFORMACIÓN DE DEPURACIÓN ===");
        console.log("Posición del hacha (local):", axe.position);
        console.log("Posición del hacha (mundo):", worldPos);
        console.log("Escala del hacha:", axe.scale);
        console.log("Padre del hacha:", axe.parent?.name || "Escena raíz");
        console.log("Hueso de la mano:", rightHandBone.name);
        console.log("Posición del hueso (local):", rightHandBone.position);
        console.log(
          "Posición del hueso (mundo):",
          rightHandBone.getWorldPosition(new THREE.Vector3())
        );
        console.log("================================");
      };

      // Mostrar información de depuración
      logDebugInfo();

      // Mostrar información periódicamente (útil para depuración)
      this.debugInterval = setInterval(logDebugInfo, 2000);

      // Forzar actualización
      axe.updateMatrixWorld(true);
    } catch (error) {
      console.error("Error al equipar el hacha:", error);
    }
  }

  /**
   * Equipar una herramienta por nombre (p. ej. 'Hacha')
   * @param {string} toolName
   */
  async equipTool(toolName) {
    console.log(`Intentando equipar herramienta: ${toolName}`);

    // Si el nombre de la herramienta es 'Hacha' o 'Axe', llamar a equipWeapon
    if (
      toolName &&
      (toolName.toLowerCase() === "hacha" || toolName.toLowerCase() === "axe")
    ) {
      console.log("Equipando hacha...");
      await this.equipWeapon();
    } else {
      console.log(`Tipo de herramienta no soportado: ${toolName}`);
    }
  }

  /**
   * Desequipar herramienta actualmente equipada
   */
  unequipTool() {
    if (this.equippedWeapon) {
      // Remover el hacha de la escena
      if (this.equippedWeapon.parent) {
        this.equippedWeapon.parent.remove(this.equippedWeapon);
      }
      this.equippedWeapon = null;
      this.isEquipped = false;
      console.log("Herramienta desequipada correctamente");
    }

    // Volver a la animación de reposo
    if (this.modelLoader) {
      this.modelLoader.play("idle", 0.15);
    }
  }

  /**
   * Ejecutar un ataque corto usando la animación meleeAttack
   */
  attack() {
    console.log("La funcionalidad de ataque está deshabilitada temporalmente");
    // No hacer nada cuando se intente atacar
    return;
  }

  /**
   * Actualiza el estado de las animaciones según la entrada del usuario
   */
  updateAnimationState() {
    if (!this.modelLoader || !this.modelLoader.model) {
      console.warn("No se puede actualizar animación: modelo no cargado");
      return;
    }

    // Obtener el multiplicador de velocidad para las animaciones
    const speedMultiplier = this.getSpeedMultiplier();
    const animationSpeed = 0.2 * speedMultiplier; // Ajustar velocidad de animación basada en el speed boost

    // Si está rotando, no cambiar la animación
    if (this.isRotating) {
      return;
    }

    // Si está colisionando con una vaca, reproducir la animación correspondiente según el estado
    // pero permitir interrupción si el jugador intenta moverse después de un breve momento
    if (this.isCollidingWithCow) {
      // Solo permitir interrupción después de 0.5 segundos de la colisión para evitar interrupciones inmediatas
      const timeSinceCollision = Date.now() - this.cowCollisionStartTime;
      const canInterrupt = timeSinceCollision > 500; // 0.5 segundos

      if (canInterrupt) {
        // Verificar si el jugador intenta moverse (interrupción)
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
          // El jugador quiere interrumpir la animación
          this.isCollidingWithCow = false;
          this.cowCollisionState = "none";
          this.cowCollisionStartTime = 0;
          console.log("🐄 Animación de colisión interrumpida por el jugador");

          // No hacer return aquí, dejar que continúe con la lógica normal de movimiento
        } else {
          // Reproducir la animación correspondiente según el estado
          if (this.cowCollisionState === "kneelingDown") {
            this.modelLoader.play("Kneel_Granjero2", animationSpeed); // Kneeling Down
          } else if (this.cowCollisionState === "kneeling") {
            this.modelLoader.play("Kneeling", animationSpeed); // Kneeling (estado final)
          }
          return;
        }
      } else {
        // Durante los primeros 0.5 segundos, siempre reproducir la animación sin permitir interrupción
        if (this.cowCollisionState === "kneelingDown") {
          this.modelLoader.play("Kneel_Granjero2", 0.2); // Kneeling Down
        } else if (this.cowCollisionState === "kneeling") {
          this.modelLoader.play("Kneeling", 0.2); // Kneeling (estado final)
        }
        return;
      }
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
    // Deshabilitar temporalmente el sistema de melee
    const usingMelee = false; // Siempre falso para deshabilitar las animaciones de melee

    if (!isMoving) {
      // Siempre usar animación de reposo normal
      this.modelLoader.play("idle", 0.15);
      return;
    }

    // Determinar la animación basada en la dirección del movimiento

    // Movimiento diagonal adelante-izquierda (W + A)
    if (
      (this.keys.w || this.keys.ArrowUp) &&
      (this.keys.a || this.keys.ArrowLeft)
    ) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls
        ? "diagonalForwardRight"
        : "diagonalForwardLeft";
      this.modelLoader.play(animation, 0.1);
    }
    // Movimiento diagonal adelante-derecha (W + D)
    else if (
      (this.keys.w || this.keys.ArrowUp) &&
      (this.keys.d || this.keys.ArrowRight)
    ) {
      const shouldInvertControls = this.isFacingCamera();
      const animation = shouldInvertControls
        ? "diagonalForwardLeft"
        : "diagonalForwardRight";
      this.modelLoader.play(animation, 0.1);
    }
    // Movimiento hacia adelante
    else if (this.keys.w || this.keys.ArrowUp) {
      // Debug: Log available animations
      console.log(
        "Available animations:",
        Object.keys(this.modelLoader.actions || {})
      );

      // Definir velocidades de animación
      const walkSpeed = 0.15;
      const runSpeed = 0.25;

      if (usingMelee) {
        if (isRunning && hasMeleeRun) {
          console.log("Playing meleeRun");
          this.modelLoader.play("meleeRun", runSpeed);
        } else if (hasMeleeIdle) {
          console.log("Playing meleeIdle");
          this.modelLoader.play("meleeIdle", walkSpeed);
        } else {
          console.log("Playing run (melee fallback)");
          this.modelLoader.play("run", isRunning ? runSpeed : walkSpeed);
        }
      } else {
        // Siempre usa la animación 'run' ya que 'walk' y 'run' usan el mismo archivo
        console.log(`Playing run (${isRunning ? "running" : "walking"})`);
        this.modelLoader.play("run", isRunning ? runSpeed : walkSpeed);
      }
    }
    // Movimiento hacia atrás - Como el personaje está rotado 180°, usa animación normal
    else if (this.keys.s || this.keys.ArrowDown) {
      // El personaje está rotado 180°, así que usa la animación de correr normal
      this.modelLoader.play("run", isRunning ? 0.25 : 0.15);
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
        // Actualizar el estado de animación según la tecla presionada
        this.updateAnimationState();
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
   * Obtiene el multiplicador de velocidad actual
   * @returns {number} - Multiplicador de velocities
   */
  getSpeedMultiplier() {
    let multiplier = 1.0;

    // Aplicar multiplicador de correr
    if (this.keys.shift) {
      multiplier *= this.config.runMultiplier;
    }

    return multiplier;
  }

  update(delta) {
    if (!this.model || !this.modelLoader?.model) {
      return;
    }

    // Actualizar estado de animación de colisión con vacas
    this.updateCowCollisionAnimation(Date.now());

    // Actualizar rotación primero
    this.updateRotation(delta);

    // Actualizar posición del arma si está equipada
    if (this.isEquipped && this.equippedWeapon) {
      if (!this._handBone) {
        // Intentar encontrar el hueso de la mano si no se ha encontrado
        this._handBone = this.findRightHandBone(this.model);
      }

      if (this._handBone) {
        // Obtener la posición y rotación del hueso
        this._handBone.getWorldPosition(this._tmpVec);
        this._handBone.getWorldQuaternion(this._tmpQuat);

        // Aplicar la posición y rotación al arma
        this.equippedWeapon.position.copy(this._tmpVec);
        this.equippedWeapon.quaternion.copy(this._tmpQuat);

        // Ajustes de posición (los mismos que en equipWeapon)
        this.equippedWeapon.translateX(0.1);
        this.equippedWeapon.translateZ(0.1);
        this.equippedWeapon.rotation.x += Math.PI / 4;

        // Actualizar la matriz del mundo del arma
        this.equippedWeapon.updateMatrixWorld(true);
      }
    }

    // Si está rotando, no permitir movimiento
    if (this.isRotating) {
      return;
    }

    // Calcular la velocidad base
    const baseSpeed = this.config.moveSpeed * 60 * delta;
    // Aplicar todos los multiplicadores (correr y speed boost)
    const speedMultiplier = this.getSpeedMultiplier();
    const currentMoveSpeed = baseSpeed * speedMultiplier;

    let moveX = 0;
    let moveZ = 0;
    let moved = false;

    // Movimiento hacia adelante (W y flecha arriba)
    if (this.keys.w || this.keys.ArrowUp) {
      moveX += Math.sin(this.model.rotation.y);
      moveZ += Math.cos(this.model.rotation.y);
      moved = true;
    }

    // Movimiento hacia atrás (S y flecha abajo)
    // Como el personaje ya está rotado 180°, solo necesita moverse hacia adelante
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

    // Rotación manual del personaje:
    // - Q: Rota a la izquierda
    // - E: Rota a la derecha
    // (solo si no está rotando automáticamente)
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

    // Si hay arma equipada, actualizar su posición para seguir la mano
    if (this.equippedWeapon) {
      try {
        // Si no se encontró el hueso de la mano, intentar encontrarlo de nuevo
        if (!this._handBone) {
          this._handBone = this.findRightHandBone(this.model);
          if (this._handBone) {
            console.log(
              "Hueso de la mano derecha encontrado en update:",
              this._handBone.name
            );
          }
        }

        if (this._handBone) {
          // Obtener la posición y rotación mundial del hueso
          this._handBone.getWorldPosition(this._tmpVec);
          this._handBone.getWorldQuaternion(this._tmpQuat);

          // Aplicar la posición y rotación al arma
          this.equippedWeapon.position.copy(this._tmpVec);
          this.equippedWeapon.quaternion.copy(this._tmpQuat);

          // Ajustes de posición (ajustar según sea necesario)
          this.equippedWeapon.translateX(0.1); // Ajustar posición X
          this.equippedWeapon.translateY(-0.1); // Ajustar posición Y
          this.equippedWeapon.translateZ(0.05); // Ajustar posición Z

          // Actualizar la matriz del mundo del arma
          this.equippedWeapon.updateMatrixWorld(true);
        } else {
          // Si no se encuentra el hueso, posicionar el arma en una posición relativa al modelo
          this.equippedWeapon.position.copy(this.model.position);
          this.equippedWeapon.position.y += 1.0; // Ajustar altura
          this.equippedWeapon.rotation.copy(this.model.rotation);
        }
      } catch (e) {
        console.error("Error al actualizar la posición del arma:", e);
      }
    }
  }

  /**
   * Limpia los event listeners y el HUD
   */
  dispose() {
    // Limpiar event listeners
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);

    // Limpiar el HUD de coordenadas
    if (this.coordinateHUD && this.coordinateHUD.parentNode) {
      this.coordinateHUD.parentNode.removeChild(this.coordinateHUD);
    }

    // Limpiar el arma equipada si existe
    if (this.equippedWeapon && this.equippedWeapon.parent) {
      this.equippedWeapon.parent.remove(this.equippedWeapon);
      this.equippedWeapon = null;
    }

    // Limpiar referencias
    this._handBone = null;
    this.isEquipped = false;
  }
}

export default FarmerController;
