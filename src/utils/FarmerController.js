import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js';

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
                minX: -250,  // -size/2
                maxX: 250,   // size/2
                minZ: -250,  // -size/2
                maxZ: 250    // size/2
            },
            ...config
        };
        
        // Estado de las teclas
        this.keys = {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
            shift: false
        };
        
        // Estado de rotación
        this.isRotating = false;
        this.targetRotation = null;
        this.rotationSpeed = Math.PI; // 180 grados por segundo
        
        // Inicializar el controlador
        this.setupEventListeners();
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
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
                this.updateAnimationState();
            } else if (key === 'shift') {
                this.keys.shift = true;
                this.updateAnimationState();
            }
        });
        
        // Evento cuando se suelta una tecla
        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = false;
                this.updateAnimationState();
            } else if (key === 'shift') {
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
        const isMoving = this.keys.w || this.keys.a || this.keys.s || this.keys.d || 
                        this.keys.ArrowUp || this.keys.ArrowDown || this.keys.ArrowLeft || this.keys.ArrowRight;
        const isRunning = this.keys.shift;
        
        if (!isMoving) {
            this.modelLoader.play("idle", 0.15);
            return;
        }
        
        // Determinar la animación basada en la dirección del movimiento
        if (this.keys.w || this.keys.ArrowUp) {
            this.modelLoader.play(isRunning ? "run" : "walk", 0.1);
        } else if (this.keys.s || this.keys.ArrowDown) {
            // Iniciar rotación de 180 grados
            this.start180Rotation();
        } else {
            // Movimiento lateral - invertir animaciones según orientación a la cámara
            const shouldInvertControls = this.isFacingCamera();
            
            if ((this.keys.a || this.keys.ArrowLeft) && !(this.keys.d || this.keys.ArrowRight)) {
                // Si está de frente a la cámara, A/D se invierten, así que A muestra animación de derecha
                const animation = shouldInvertControls ? "strafeRight" : "strafeLeft";
                this.modelLoader.play(animation, 0.15);
            } else if ((this.keys.d || this.keys.ArrowRight) && !(this.keys.a || this.keys.ArrowLeft)) {
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
            
            // Después de rotar, verificar si todavía se presiona 's' para mover hacia adelante
            if (this.keys.s || this.keys.ArrowDown) {
                this.modelLoader.play(this.keys.shift ? "run" : "walk", 0.1);
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
        const currentMoveSpeed = isRunning ? 
            moveDistance * this.config.runMultiplier : 
            moveDistance;
        
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
            
            // Calcular nueva posición con límites
            let newX = this.model.position.x;
            let newZ = this.model.position.z;
            
            // Aplicar movimiento en X si no excede los límites
            if (moveX > 0 && this.model.position.x < this.config.bounds.maxX) {
                newX = Math.min(this.model.position.x + moveX, this.config.bounds.maxX);
            } else if (moveX < 0 && this.model.position.x > this.config.bounds.minX) {
                newX = Math.max(this.model.position.x + moveX, this.config.bounds.minX);
            }
            
            // Aplicar movimiento en Z si no excede los límites
            if (moveZ > 0 && this.model.position.z < this.config.bounds.maxZ) {
                newZ = Math.min(this.model.position.z + moveZ, this.config.bounds.maxZ);
            } else if (moveZ < 0 && this.model.position.z > this.config.bounds.minZ) {
                newZ = Math.max(this.model.position.z + moveZ, this.config.bounds.minZ);
            }
            
            // Aplicar la nueva posición
            this.model.position.setX(newX);
            this.model.position.setZ(newZ);
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
    }
    
    /**
     * Limpia los event listeners
     */
    dispose() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}

export default FarmerController;
