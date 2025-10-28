/**
 * Módulo para manejar la escena final y la UI asociada.
 * Exporta:
 *  - showFinalScene({ shipRepair, cameraManager })
 *  - createFinalUI()
 */
export function showFinalScene({ shipRepair, cameraManager } = {}) {
  try {
    // 1) Cerrar HUD si está abierto
    try {
      if (shipRepair && typeof shipRepair.closeShipHUD === "function")
        shipRepair.closeShipHUD();
    } catch (e) {}

    // 2) Deshabilitar controles de cámara para evitar movimientos durante la transición
    try {
      const controls =
        cameraManager && typeof cameraManager.getControls === "function"
          ? cameraManager.getControls()
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
        createFinalUI();
      } catch (e) {
        console.error("Error creando UI final", e);
      }
    };
    overlay.addEventListener("transitionend", onOverlayEnd);

    // Fallback: si no hay transición por alguna razón, mostrar UI tras 2400ms
    setTimeout(() => {
      if (!document.getElementById("final-card")) createFinalUI();
    }, 2400);
  } catch (e) {
    console.error("showFinalScene error", e);
  }
}

export function createFinalUI() {
  // Evitar múltiples inserciones
  if (document.getElementById("final-card")) return;

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
  restartBtn.addEventListener("click", () => {
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
