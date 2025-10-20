# Corrección del Comportamiento de la Tecla S

## 🐛 Problema Identificado

La tecla `S` (y flecha abajo) tenía un comportamiento contra-intuitivo:
1. Primera pulsación → Rotaba al personaje 180° con animación
2. Mantener presionado → Caminaba hacia adelante en la nueva dirección
3. Resultado: Movimiento hacia atrás, pero con una rotación animada confusa

## ✅ Solución Implementada (Versión 2 - Rotación Instantánea)

Ahora la tecla `S` hace que el personaje **rote instantáneamente 180°** para mirar hacia atrás, luego camina hacia adelante en esa dirección (dando la apariencia de caminar hacia atrás mirando en esa dirección).

### Comportamiento:
1. **Presionar S** → Personaje rota instantáneamente 180°
2. **Mantener S** → Personaje camina hacia adelante (mirando hacia atrás)
3. **Soltar S** → Personaje vuelve instantáneamente a su rotación original

### Cambios Realizados

#### 1. **Agregadas variables de estado (línea ~74)**

```javascript
// Estado de rotación para tecla S (caminar hacia atrás)
this.isRotatedForBackward = false;
this.originalRotation = 0;
```

#### 2. **Modificado `setupEventListeners()` (línea ~846)**

**KeyDown - Rotar al presionar S:**
```javascript
// Detectar si se presiona S o flecha abajo por primera vez
if ((key === 's' || key === 'arrowdown') && !this.keys[key]) {
  // Guardar rotación original y rotar 180°
  this.originalRotation = this.model.rotation.y;
  this.model.rotation.y += Math.PI;
  this.isRotatedForBackward = true;
}
```

**KeyUp - Restaurar rotación al soltar S:**
```javascript
// Detectar si se suelta S o flecha abajo
if ((key === 's' || key === 'arrowdown') && this.isRotatedForBackward) {
  // Restaurar rotación original
  this.model.rotation.y = this.originalRotation;
  this.isRotatedForBackward = false;
}
```

#### 3. **Modificado `updateAnimationState()` (línea ~1533)**

**Antes:**
```javascript
else if (this.keys.s || this.keys.ArrowDown) {
  this.modelLoader.play("runBackward", isRunning ? 0.25 : 0.15);
}
```

**Después:**
```javascript
else if (this.keys.s || this.keys.ArrowDown) {
  // El personaje está rotado 180°, así que usa la animación de correr normal
  this.modelLoader.play("run", isRunning ? 0.25 : 0.15);
}
```

#### 4. **Modificado `update()` para movimiento (línea ~1697)**

**Antes:**
```javascript
if (this.keys.s || this.keys.ArrowDown) {
  moveX -= Math.sin(this.model.rotation.y);
  moveZ -= Math.cos(this.model.rotation.y);
  moved = true;
}
```

**Después:**
```javascript
// Movimiento hacia atrás (S y flecha abajo)
// Como el personaje ya está rotado 180°, solo necesita moverse hacia adelante
if (this.keys.s || this.keys.ArrowDown) {
  moveX += Math.sin(this.model.rotation.y);
  moveZ += Math.cos(this.model.rotation.y);
  moved = true;
}
```

## 🎮 Comportamiento Actual

### Controles de Movimiento:
- **W / Flecha Arriba**: Camina/corre hacia adelante
- **S / Flecha Abajo**: Rota 180° instantáneamente y camina hacia adelante (efecto: retroceder mirando hacia atrás) ✨
- **A / Flecha Izquierda**: Strafe izquierda
- **D / Flecha Derecha**: Strafe derecha
- **Shift**: Correr (multiplicador de velocidad)
- **Q**: Rotar manualmente a la izquierda
- **E**: Rotar manualmente a la derecha

### Animaciones:
- Caminar adelante: `run` (velocidad 0.15)
- Correr adelante: `run` (velocidad 0.25)
- **Caminar "atrás" (rotado 180°): `run` (velocidad 0.15)** ✨
- **Correr "atrás" (rotado 180°): `run` (velocidad 0.25)** ✨

### Ventajas de este enfoque:
1. ✅ **Más realista**: El personaje mira hacia donde va
2. ✅ **Instantáneo**: No hay delay de rotación
3. ✅ **Reversible**: Al soltar S, vuelve a mirar hacia adelante
4. ✅ **Consistente**: Usa las mismas animaciones que caminar hacia adelante

## 📝 Notas Técnicas

- La rotación es **instantánea** (sin animación de giro)
- Se guarda la rotación original para restaurarla exactamente
- El movimiento usa `+=` porque el personaje YA está rotado 180°
- Compatible con combinaciones de teclas (S + A, S + D, etc.)
- La animación `runBackward` ya no se usa

## 🧪 Pruebas Sugeridas

1. ✅ Presionar S → Personaje rota 180° instantáneamente y camina
2. ✅ Soltar S → Personaje vuelve a mirar hacia adelante
3. ✅ Shift + S → Personaje corre hacia atrás mirando hacia atrás
4. ✅ S + A/D → Movimiento diagonal hacia atrás (verificar comportamiento)
5. ✅ Presionar W mientras mantienes S → Debería cambiar de dirección
6. ✅ Q/E mientras presionas S → La rotación manual debería funcionar correctamente

## 🔄 Comparación de Versiones

| Aspecto | Versión Original | Versión 1 | Versión 2 (Actual) |
|---------|-----------------|-----------|-------------------|
| **Rotación** | Animada 180° | Sin rotación | Instantánea 180° |
| **Animación** | turn180 | runBackward | run (normal) |
| **Realismo** | ❌ Confuso | ⚠️ Camina de espaldas | ✅ Mira donde va |
| **Responsividad** | ⚠️ Delay | ✅ Inmediata | ✅ Inmediata |

---

**Fecha de corrección:** 20 de octubre de 2025  
**Versión:** 2.0 (Rotación instantánea)  
**Archivos modificados:** `src/utils/FarmerController.js`
