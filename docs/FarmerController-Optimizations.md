# Optimizaciones para FarmerController.js

## 📊 Análisis de Problemas de Rendimiento

### 🔴 **CRÍTICO - Alta Prioridad**

#### 1. **Actualización del HUD en cada frame** (línea ~280)
**Problema:** `updateCoordinateDisplay()` se llama en cada frame, manipulando el DOM constantemente.

**Impacto:** 
- Manipulación del DOM = operación costosa
- Se ejecuta ~60 veces por segundo
- Puede causar reflows/repaints innecesarios

**Solución:**
```javascript
// Agregar throttling al constructor
this.lastHUDUpdate = 0;
this.hudUpdateInterval = 100; // Actualizar cada 100ms en lugar de cada frame

// En updateCoordinateDisplay()
updateCoordinateDisplay() {
  const now = Date.now();
  if (now - this.lastHUDUpdate < this.hudUpdateInterval) return;
  this.lastHUDUpdate = now;
  
  if (!this.coordValuesElement || !this.model) return;
  
  const position = this.model.position;
  const text = `X: ${position.x.toFixed(1)}  Y: ${position.y.toFixed(1)}  Z: ${position.z.toFixed(1)}`;
  
  // Solo actualizar si cambió
  if (this.coordValuesElement.textContent !== text) {
    this.coordValuesElement.textContent = text;
  }
}
```

---

#### 2. **Búsqueda recursiva del hueso en cada frame** (línea ~1015)
**Problema:** Si `_handBone` es null, intenta buscarlo recursivamente en cada frame.

**Impacto:**
- Operación O(n) donde n = número de nodos en la jerarquía
- Se ejecuta continuamente si falla

**Solución:**
```javascript
// Agregar flag para evitar búsquedas repetidas
this._handBoneSearchAttempted = false;

// En update()
if (this.isEquipped && this.equippedWeapon) {
  if (!this._handBone && !this._handBoneSearchAttempted) {
    this._handBone = this.findRightHandBone(this.model);
    this._handBoneSearchAttempted = true; // Solo intentar una vez
    
    if (this._handBone) {
      console.log("Hueso de la mano encontrado:", this._handBone.name);
    } else {
      console.warn("No se pudo encontrar el hueso de la mano");
    }
  }
  // ... resto del código
}
```

---

#### 3. **Múltiples llamadas a `isFacingCamera()` en `updateAnimationState()`**
**Problema:** Se calcula múltiples veces en la misma función (líneas ~564, 570, 603).

**Impacto:**
- Cálculos vectoriales redundantes
- Normalización y producto punto repetidos

**Solución:**
```javascript
updateAnimationState() {
  if (!this.modelLoader || !this.modelLoader.model) {
    return;
  }

  // Calcular UNA VEZ al inicio
  const shouldInvertControls = this.isFacingCamera();
  const speedMultiplier = this.getSpeedMultiplier();
  const animationSpeed = 0.2 * speedMultiplier;

  // ... resto del código usando la variable cacheada
  if ((this.keys.w || this.keys.ArrowUp) && (this.keys.a || this.keys.ArrowLeft)) {
    const animation = shouldInvertControls ? "diagonalForwardRight" : "diagonalForwardLeft";
    this.modelLoader.play(animation, 0.1);
  }
  // etc...
}
```

---

#### 4. **Logs de consola excesivos en producción**
**Problema:** Muchos `console.log()` en código de producción (ej: líneas 323, 371, 416, etc.)

**Impacto:**
- Los logs son operaciones I/O costosas
- Pueden ralentizar significativamente en ciertos navegadores
- Inundan la consola

**Solución:**
```javascript
// Al inicio del archivo, después de los imports
const DEBUG = false; // O usar process.env.NODE_ENV !== 'production'

// Crear funciones de logging condicionales
const debugLog = (...args) => DEBUG && console.log(...args);
const debugWarn = (...args) => DEBUG && console.warn(...args);
const debugError = (...args) => console.error(...args); // Errores siempre

// Reemplazar todos los console.log con debugLog
debugLog("✅ Conectadas ${validStones.length} piedras al farmerController");
```

---

### 🟡 **MEDIO - Prioridad Media**

#### 5. **Cálculos de colisión redundantes**
**Problema:** En `getAdjustedMovement()` se calculan múltiples veces las mismas verificaciones.

**Impacto:**
- Se crean múltiples `Vector3` temporales
- Verificaciones redundantes de bounding boxes

**Solución:**
```javascript
getAdjustedMovement(currentPosition, movementVector) {
  if (this.isCollidingWithCow) {
    return this._zeroVector; // Reutilizar vector estático
  }

  const newPosition = this._tmpNewPosition.copy(currentPosition).add(movementVector);
  
  // Orden de verificación por frecuencia (más común primero)
  if (this.cows && this.checkCowsCollision(newPosition)) {
    return this._zeroVector;
  }
  
  if (this.market && this.checkMarketCollision(newPosition)) {
    const slidingMovement = this.getSlidingMovement(currentPosition, movementVector);
    return slidingMovement.length() > 0 ? slidingMovement : this._zeroVector;
  }
  
  // ... resto de verificaciones
}

// En el constructor, crear vectores reutilizables
this._zeroVector = new THREE.Vector3(0, 0, 0);
this._tmpNewPosition = new THREE.Vector3();
```

---

#### 6. **Creación de objetos temporales en loops**
**Problema:** En `checkCowsCollision()` y `checkStonesCollision()` se itera sobre arrays sin optimización.

**Solución:**
```javascript
checkCowsCollision(position) {
  if (!this.cows || !this.model) return false;

  // Usar for tradicional en lugar de for...of (más rápido)
  for (let i = 0, len = this.cows.length; i < len; i++) {
    const cow = this.cows[i];
    if (cow.checkCollision(position, this.characterSize)) {
      if (cow.hasExclamationMarkVisible()) {
        this.handleCowCollisionAnimation(cow);
      }
      return true;
    }
  }
  return false;
}
```

---

#### 7. **Búsqueda del hueso con logs en cada nodo**
**Problema:** `findRightHandBone()` hace log para cada hueso encontrado.

**Solución:**
```javascript
findRightHandBone(object) {
  if (!object) return null;

  if (object.isBone) {
    const name = object.name.toLowerCase();

    // Usar regex precompilado para mejor rendimiento
    if (this._leftHandRegex.test(name)) {
      debugLog(`Hueso de la mano izquierda encontrado: ${object.name}`);
      // ... resto del código
      return object;
    }

    if (this._rightHandRegex.test(name)) {
      debugLog(`Hueso de la mano derecha encontrado: ${object.name}`);
      // ... resto del código
      return object;
    }
  }

  // Búsqueda en hijos
  if (object.children) {
    for (let i = 0; i < object.children.length; i++) {
      const result = this.findRightHandBone(object.children[i]);
      if (result) return result;
    }
  }

  return null;
}

// En el constructor, precompilar regex
this._leftHandRegex = /lefthand|left_hand|hand_l|hand\.left|mixamorighandl|mixamoriglefthand/i;
this._rightHandRegex = /righthand|right_hand|hand_r|hand\.right|mixamorighandr|mixamorigrighthand/i;
```

---

#### 8. **Actualización del arma equipada**
**Problema:** Se actualizan matrices del mundo múltiples veces innecesariamente.

**Solución:**
```javascript
// En update(), simplificar la actualización del arma
if (this.isEquipped && this.equippedWeapon && this._handBone) {
  // No necesitas obtener posición/rotación mundial y aplicarla
  // El arma ya está como hijo del hueso, se actualiza automáticamente
  // Solo necesitas forzar actualización si el hueso cambió
  this._handBone.updateMatrixWorld(true);
}
```

---

### 🟢 **BAJO - Mejoras Generales**

#### 9. **Código muerto y debug temporal**
**Problema:** Hay código de debug que no se limpia:
- Líneas 719-726: `debugInterval` que nunca se limpia
- Líneas 882-896: Debug logging temporal con `setInterval`

**Solución:**
```javascript
// Limpiar en dispose()
dispose() {
  // ... código existente
  
  // Limpiar intervalos de debug
  if (this.debugInterval) {
    clearInterval(this.debugInterval);
    this.debugInterval = null;
  }
  
  if (this._debugInterval) {
    clearInterval(this._debugInterval);
    this._debugInterval = null;
  }
}
```

---

#### 10. **Optimizar detección de teclas**
**Problema:** Múltiples verificaciones de teclas en `update()`.

**Solución:**
```javascript
// Agregar propiedades computadas
get isMovingForward() {
  return this.keys.w || this.keys.ArrowUp;
}

get isMovingBackward() {
  return this.keys.s || this.keys.ArrowDown;
}

get isMovingLeft() {
  return this.keys.a || this.keys.ArrowLeft;
}

get isMovingRight() {
  return this.keys.d || this.keys.ArrowRight;
}

get isMoving() {
  return this.isMovingForward || this.isMovingBackward || 
         this.isMovingLeft || this.isMovingRight;
}
```

---

#### 11. **Optimizar `checkMarketCollision()` con algoritmo ray-casting**
**Problema:** El algoritmo de punto en polígono se ejecuta en cada frame.

**Solución:**
```javascript
checkMarketCollision(position) {
  if (!this.market || !this.market.marketGroup) return false;

  // Cache del polígono (calcular solo una vez)
  if (!this._marketPolygonCache) {
    this._marketPolygonCache = [
      new THREE.Vector2(-148.7, 51.5),
      new THREE.Vector2(-154.7, 46.2),
      new THREE.Vector2(-162.7, 55.3),
      new THREE.Vector2(-156.5, 60.4),
    ];
  }

  const point = this._tmpMarketPoint.set(position.x, position.z);
  
  // Early exit: bounding box check primero (más rápido)
  if (!this._marketBounds) {
    // Calcular bounding box una vez
    this._marketBounds = {
      minX: -162.7, maxX: -148.7,
      minZ: 46.2, maxZ: 60.4
    };
  }
  
  if (point.x < this._marketBounds.minX || point.x > this._marketBounds.maxX ||
      point.y < this._marketBounds.minZ || point.y > this._marketBounds.maxZ) {
    return false; // Fuera del bounding box
  }

  // Solo hacer ray-casting si está dentro del bounding box
  return this._pointInPolygon(point, this._marketPolygonCache);
}

// Extraer algoritmo a método separado
_pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (yj === yi) continue;
    
    const intersect = yi > point.y !== yj > point.y &&
                     point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    
    if (intersect) inside = !inside;
  }
  return inside;
}

// En el constructor
this._tmpMarketPoint = new THREE.Vector2();
```

---

## 🎯 Resumen de Mejoras por Impacto

### Cambios que darían el mayor impacto:

1. **Throttling del HUD** - Reducción de ~60 actualizaciones/s a ~10/s
2. **Cache de `isFacingCamera()`** - Elimina 2-3 cálculos redundantes por frame
3. **Remover logs en producción** - Mejora significativa en algunos navegadores
4. **Vectores reutilizables** - Reduce garbage collection
5. **Early exit en `checkMarketCollision()`** con bounding box

### Ganancia estimada de rendimiento:
- **10-15% mejora general** en FPS
- **Reducción de ~30-40%** en operaciones de GC (garbage collection)
- **Mejora en latencia de input** por menos trabajo en el game loop

---

## 📝 Implementación Sugerida

### Orden de implementación:

1. **Fase 1 (Quick wins):**
   - Remover/desactivar logs
   - Throttling del HUD
   - Cache de `isFacingCamera()`

2. **Fase 2 (Refactoring):**
   - Vectores reutilizables
   - Optimización de colisiones
   - Regex precompilados

3. **Fase 3 (Limpieza):**
   - Remover código debug
   - Documentar mejor
   - Agregar métricas de rendimiento

---

## 🔧 Herramientas de Medición

Para validar las mejoras, agrega esto temporalmente:

```javascript
// En el constructor
this.performanceMetrics = {
  updateCalls: 0,
  collisionChecks: 0,
  animationChanges: 0,
  startTime: performance.now()
};

// Al final de update()
this.performanceMetrics.updateCalls++;

// Cada 60 frames, mostrar métricas
if (this.performanceMetrics.updateCalls % 60 === 0) {
  const elapsed = (performance.now() - this.performanceMetrics.startTime) / 1000;
  const fps = this.performanceMetrics.updateCalls / elapsed;
  console.log(`FPS promedio: ${fps.toFixed(2)}, Colisiones: ${this.performanceMetrics.collisionChecks}`);
}
```

---

¿Te gustaría que implemente alguna de estas optimizaciones específicas en el código?
