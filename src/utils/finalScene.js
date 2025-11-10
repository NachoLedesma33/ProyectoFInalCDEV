/**
 * Módulo para manejar la escena final y la UI asociada.
 * Exporta funciones compat en top-level pero internamente usa una clase.
 */
import { safePlaySfx } from './audioHelpers.js';
export class FinalScene {
  constructor({ shipRepair, cameraManager } = {}) {
    this.shipRepair = shipRepair;
    this.cameraManager = cameraManager;
  }

  show() {
    try {
      // 1) Cerrar HUD si está abierto
      try {
        if (this.shipRepair && typeof this.shipRepair.closeShipHUD === "function")
          this.shipRepair.closeShipHUD();
      } catch (e) {}

      // 2) Deshabilitar controles de cámara para evitar movimientos durante la transición
      try {
        const controls =
          this.cameraManager && typeof this.cameraManager.getControls === "function"
            ? this.cameraManager.getControls()
            : null;
        if (controls && typeof controls.enabled !== "undefined") controls.enabled = false;
      } catch (e) {}

      // 3) Crear overlay negro que hará el fade
      let overlay = document.getElementById("final-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "final-overlay";
        document.body.appendChild(overlay);
        // Force style calc then trigger opacity transition
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";
        });
      }

      // 4) Cuando el overlay haya terminado su transición, mostrar la UI final
      const onOverlayEnd = (ev) => {
        if (ev.propertyName && ev.propertyName !== "opacity") return;
        overlay.removeEventListener("transitionend", onOverlayEnd);
        try {
          this.createUI();
        } catch (e) {
          console.error("Error creando UI final", e);
        }
      };
      overlay.addEventListener("transitionend", onOverlayEnd);

      // Fallback: si no hay transición por alguna razón, mostrar UI tras 2400ms
      setTimeout(() => {
        if (!document.getElementById("final-card")) this.createUI();
      }, 2400);
    } catch (e) {
      console.error("showFinalScene error", e);
    }
  }

  createUI() {
    // Evitar múltiples inserciones
    if (document.getElementById("final-card")) return;

    // Reproducir música final y limpiar ambience/combat para evitar solapamientos
    try {
      if (window.audio && typeof window.audio.playMusic === 'function') {
        try { if (typeof window.audio.stopAmbience === 'function') window.audio.stopAmbience(); } catch (_) {}
        try { if (typeof window.audio.stopRandomAmbient === 'function') window.audio.stopRandomAmbient(); } catch (_) {}
        try { if (typeof window.audio.stopCombatMusic === 'function') window.audio.stopCombatMusic({ fadeOutMs: 0 }); } catch (_) {}
        try { window.audio.playMusic('final', { loop: true }); } catch (_) {}
      }
    } catch (e) {
      try { console.warn('No se pudo iniciar música final', e); } catch (_) {}
    }

    // Disparar un sonido corto de victoria alegre
    try { safePlaySfx('victory', { volume: 0.95 }); } catch (_) {}

    // Imagen de fondo (reusa la clase .background-image pero aseguramos posición y z-index)
    const bg = document.createElement("div");
    bg.className = "final-scene-bg";
    // La ruta cumple con la convención del proyecto (archivo en src/assets)
    bg.style.backgroundImage = 'url("./src/assets/Escena Final.png")';
    bg.style.opacity = "0";
    bg.style.transition = "opacity 1200ms ease";
    document.body.appendChild(bg);
    requestAnimationFrame(() => {
      bg.style.opacity = "1";
    });

    // Tarjeta central con texto y botón
    const card = document.createElement("div");
    card.id = "final-card";

    const title = document.createElement("h2");
    title.textContent = "¡Gracias por tu esfuerzo!";
    card.appendChild(title);

    const msg = document.createElement("p");
    msg.textContent =
      "Gracias por ayudar a reparar la nave — el granjero puede volver con su ganado a salvo a su planeta.";
    card.appendChild(msg);

    const credits = document.createElement("div");
    credits.className = "final-credits";
    credits.innerHTML =
      "<strong>Trabajo realizado por:</strong><br>Ledesma Ignacio Manuel, Sif\u00f3n Monteros Lucas Valent\u00edn, Palacios Mat\u00edas Valent\u00edn y Moyano Tomas.";
    card.appendChild(credits);

    const restartWrap = document.createElement("div");
    restartWrap.className = "restart-button";
    const restartBtn = document.createElement("button");
    restartBtn.className = "menu-button";
    restartBtn.textContent = "Reiniciar juego";
    // UI sounds (safe checks)
    restartBtn.addEventListener("mouseenter", () => {
      try {
        if (window.audio && typeof window.audio.playSFX === "function") window.audio.playSFX("uiHover", { volume: 0.6 });
      } catch (_) {}
    });
    restartBtn.addEventListener("click", () => {
      try {
        if (window.audio && typeof window.audio.playSFX === "function") window.audio.playSFX("uiClick", { volume: 0.9 });
      } catch (_) {}
      try {
        // Intenta un reinicio suave: recargar la página
        location.reload();
      } catch (e) {
        console.error(e);
      }
    });
    restartWrap.appendChild(restartBtn);
    card.appendChild(restartWrap);

    document.body.appendChild(card);

    // Mostrar con transición
    requestAnimationFrame(() => {
      card.classList.add("show");
    });
  }
}

// Backwards-compatible named exports
export function showFinalScene({ shipRepair, cameraManager } = {}) {
  return new FinalScene({ shipRepair, cameraManager }).show();
}

export function createFinalUI() {
  return new FinalScene().createUI();
}
