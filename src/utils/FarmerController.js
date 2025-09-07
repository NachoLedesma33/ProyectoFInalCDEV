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
    constructor(model, modelLoader, config = {}) {
        this.model = model;
        this.modelLoader = modelLoader;
        this.config = {
            moveSpeed: 0.1,
            rotationSpeed: 0.05,
            runMultiplier: 1.5,
            ...config
        };
        
        // Estado de las teclas
        this.keys = {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
            shift: false
        };
        
        // Inicializar el controlador
        this.setupEventListeners();
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
            this.modelLoader.play("walkBackward", 0.15);
        } else if ((this.keys.a || this.keys.ArrowLeft) && !(this.keys.d || this.keys.ArrowRight)) {
            this.modelLoader.play("strafeLeft", 0.15);
        } else if ((this.keys.d || this.keys.ArrowRight) && !(this.keys.a || this.keys.ArrowLeft)) {
            this.modelLoader.play("strafeRight", 0.15);
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
        
        // Calcular la distancia de movimiento normalizada por tiempo
        const moveDistance = this.config.moveSpeed * 60 * delta;
        const isRunning = this.keys.shift;
        const currentMoveSpeed = isRunning ? 
            moveDistance * this.config.runMultiplier : 
            moveDistance;
        
        let moveX = 0;
        let moveZ = 0;
        let moved = false;
        
        // Movimiento hacia adelante/atrás
        if (this.keys.w || this.keys.ArrowUp) {
            moveX += Math.sin(this.model.rotation.y);
            moveZ += Math.cos(this.model.rotation.y);
            moved = true;
        }
        if (this.keys.s || this.keys.ArrowDown) {
            moveX -= Math.sin(this.model.rotation.y);
            moveZ -= Math.cos(this.model.rotation.y);
            moved = true;
        }
        
        // Movimiento lateral
        if (this.keys.a || this.keys.ArrowLeft) {
            moveX += Math.cos(this.model.rotation.y);
            moveZ -= Math.sin(this.model.rotation.y);
            moved = true;
        }
        if (this.keys.d || this.keys.ArrowRight) {
            moveX -= Math.cos(this.model.rotation.y);
            moveZ += Math.sin(this.model.rotation.y);
            moved = true;
        }
        
        // Normalizar el vector de movimiento para movimiento diagonal
        if (moved) {
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (length > 0) {
                moveX = (moveX / length) * currentMoveSpeed;
                moveZ = (moveZ / length) * currentMoveSpeed;
            }
            
            // Aplicar movimiento
            this.model.position.x += moveX;
            this.model.position.z += moveZ;
        }
        
        // Rotación del personaje con Q y E
        if (this.keys.q) {
            this.model.rotation.y += this.config.rotationSpeed * 2;
        }
        if (this.keys.e) {
            this.model.rotation.y -= this.config.rotationSpeed * 2;
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
