# Proyecto Final CDVE — Juego Three.js

Juego 3D con Three.js orientado a hardware de gama baja/media (i3, GPU media), con foco en fluidez de cámara, tiempos de respuesta de entrada (INP) y reducción de microcortes sin modificar luces/sombras del ciclo día-noche.

## Estado Actual

- Menú inicial con selección de dificultad, carrusel de historia y HUD de controles.
- Overlay de carga “Cargando juego…” al saltar intro/controles si la escena aún no está lista, mostrando el juego solo cuando finaliza la inicialización.
- HUDs de salud sincronizados: jugador (KAEL) y corral aparecen juntos en la esquina superior izquierda.
- Optimizaciones de rendimiento: reutilización de vectores, manejo de `deltaTime` en cámara, límites de `pixelRatio`, antialias desactivado en hardware bajo, e histéresis para evitar saltos de calidad.
- Colisiones optimizadas: grid espacial y broad-phase para reducir picos durante sprint y movimientos rápidos.
- Gestión de texturas: redirección de rutas faltantes a `src/assets/` y carga secuencial para evitar 404 en edificios/piedras.
- Mercado con fallbacks: iconos/emoji cuando faltan imágenes, evitando errores en consola.
- Ciclo día-noche conservado; se minimizaron picos de INP durante las transiciones.

## Ejecutar El Proyecto

- Opción 1 (recomendada): VS Code Live Server.
  - Abre `index.html` con Live Server (puerto típico `http://127.0.0.1:5500/`).
- Opción 2: servidor estático simple.
  - `npm install` (opcional: solo para dependencias locales)
  - `npx serve` y abre `http://localhost:3000`.

El proyecto no requiere bundlers; los módulos se importan vía CDN (Three.js 0.132.2) y código fuente en `src/`.

## Estructura

```text
├── src/
│   ├── assets/          # Texturas e imágenes locales mapeadas desde modelos
│   ├── config/          # Configuración de modelos y rutas
│   ├── utils/           # Lógica de juego, UI, control y sistemas
│   └── main.js          # Inicialización de escena y entidades
├── index.html           # Contenedor principal
└── style.css            # Estilos generales
```

## Funcionalidades Clave

- Menú y flujo de inicio: dificultad → historia (carrusel) → controles.
- Overlay de carga para evitar acceso prematuro a la escena.
- Control del jugador: movimientos, sprint y combate con secuencias.
- Sistema de oleadas y enemigos con integración de combate.
- HUDs: salud de jugador y corral en `top-left`, sincronizados.
- Mercado, minimapa, objetivos, y reparación de nave con escena final.

## Optimizaciones De Rendimiento

- Cámara: interpolación suave con `deltaTime`, reutilización de vectores para reducir GC.
- Render: límites de `pixelRatio`, antialias desactivado en bajo rendimiento.
- Colisiones: grid espacial y chequeos AABB previos.
- UI: listeners deduplicados y preloading de imágenes del carrusel.
- Carga diferida de tareas pesadas usando `requestIdleCallback` cuando está disponible.

## Texturas y Recursos

- Redirección de rutas faltantes de modelos a `src/assets/` (evita 404 comunes).
- Carga secuencial de texturas en edificios/pirámide para reducir spam de errores.
- Mercado: iconos de herramientas con fallback (emoji) si no existen las imágenes.

## Dependencias

- Importación de Three.js vía CDN: `0.132.2` en módulos ES.
- `package.json` incluye dependencias para desarrollo local: `three`, `@types/three`, `three-stdlib`.
  - No es obligatorio instalar para correr con Live Server; útil para edición/typos.

## Desarrollo

- Coloca nuevas texturas en `src/assets/` para que el mapeo automático las resuelva.
- Mantén nombres consistentes para evitar problemas de rutas (usa minúsculas y sin espacios si es posible).
- Evita duplicar listeners de UI; utiliza flags `_bound` donde corresponda.

## Notas

- Diseñado para ejecutarse localmente sin herramientas de construcción (sin Webpack/Vite).
- Si usas Live Server, el puerto suele ser `5500`; ajusta rutas si tu puerto difiere.
