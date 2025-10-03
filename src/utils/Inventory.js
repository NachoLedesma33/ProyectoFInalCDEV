export class Inventory {
  constructor({ pricePerLiter = 5 } = {}) {
    this.milkLiters = 0;
    this.tools = [];
    this.coins = 0;
    this.pricePerLiter = pricePerLiter;
    this._createUI();
    this._updateUI();
    // Empezar oculto; se mostrará con la tecla 'i' o inventory.show()
    this.hide();
  }

  addMilk(liters = 0) {
    const n = Math.max(0, Number(liters) || 0);
    this.milkLiters += n;
    this._updateUI();
    return this.milkLiters;
  }

  addTool(name) {
    if (!name) return this.tools;
    if (!this.tools.includes(name)) this.tools.push(name);
    this._updateUI();
    return this.tools;
  }

  sellMilk() {
    const liters = this.milkLiters;
    if (liters <= 0) return { earned: 0, litersSold: 0 };
    const earned = Math.floor(liters * this.pricePerLiter);
    this.coins += earned;
    this.milkLiters = 0;
    this._updateUI();
    this._flash(`Vendiste ${liters.toFixed(2)} L y obtuviste ${earned} monedas`);
    return { earned, litersSold: liters };
  }

  setPricePerLiter(p) {
    this.pricePerLiter = Math.max(0, Number(p) || 0);
    this._updateUI();
  }

  getState() {
    return {
      milkLiters: this.milkLiters,
      tools: [...this.tools],
      coins: this.coins,
      pricePerLiter: this.pricePerLiter,
    };
  }

  // UI helpers (minimal, auto-insert HUD)
  _createUI() {
    const id = "inventory-hud";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      Object.assign(el.style, {
        position: "absolute",
        right: "12px",
        top: "12px",
        width: "220px",
        padding: "8px",
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        borderRadius: "6px",
        zIndex: 1000,
      });
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">Inventario</div>
      <div><strong>Leche:</strong> <span id="inv-milk">0.00</span> L</div>
      <div><strong>Herramientas:</strong> <span id="inv-tools">-</span></div>
      <div style="margin-bottom:6px"><strong>Monedas:</strong> <span id="inv-coins">0</span></div>
      <div id="inv-msg" style="margin-top:6px;font-size:12px;opacity:0.9"></div>
    `;
    this._ui = {
      container: el,
      milk: el.querySelector("#inv-milk"),
      tools: el.querySelector("#inv-tools"),
      coins: el.querySelector("#inv-coins"),
      msg: el.querySelector("#inv-msg"),
    };
  }

  _updateUI() {
    if (!this._ui) return;
    this._ui.milk.textContent = this.milkLiters.toFixed(2);
    this._ui.tools.textContent = this.tools.length ? this.tools.join(", ") : "-";
    this._ui.coins.textContent = this.coins;
  }

  _flash(msg, ms = 2200) {
    if (!this._ui) return;
    this._ui.msg.textContent = msg;
    clearTimeout(this._t);
    this._t = setTimeout(() => (this._ui.msg.textContent = ""), ms);
  }

  /**
   * Método público para mostrar una notificación rápida en el HUD del inventario
   * @param {string} msg - Mensaje a mostrar
   * @param {number} ms - Tiempo en ms que dura la notificación
   */
  notify(msg, ms = 2200) {
    this._flash(msg, ms);
  }

  /**
   * Mostrar un pequeño pop-up (toast) independiente del HUD del inventario.
   * Se usa para notificaciones importantes (p.ej. leche obtenida al ordeñar)
   * @param {string} msg
   * @param {number} ms
   */
  popup(msg, ms = 2800, opts = {}) {
    try {
      const { screenPos } = opts; // { x, y } in pixels relative to viewport

      const toast = document.createElement("div");
      // Estilos base: fondo transparente, texto visible
      Object.assign(toast.style, {
        background: "rgba(0,0,0,0)", // transparente por requerimiento
        color: "#fff",
        padding: "6px 10px",
        borderRadius: "6px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
        opacity: "0",
        transform: "translateY(6px)",
        transition: "opacity 220ms ease, transform 220ms ease",
        fontSize: "13px",
        pointerEvents: "none",
        textShadow: "0 2px 6px rgba(0,0,0,0.8)",
        maxWidth: "260px",
        whiteSpace: "nowrap",
      });
      toast.textContent = msg;

      if (screenPos && typeof screenPos.x === "number" && typeof screenPos.y === "number") {
        // Position the toast absolutely at the given screen coords (above character)
        Object.assign(toast.style, {
          position: "absolute",
          left: `${Math.round(screenPos.x)}px`,
          top: `${Math.round(screenPos.y)}px`,
          transform: "translate(-50%, -120%) scale(1)",
          pointerEvents: "none",
          zIndex: 3000,
        });
        document.body.appendChild(toast);
      } else {
        // Default fallback: stacked toasts bottom-right
        const containerId = "inventory-toast-container";
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement("div");
          container.id = containerId;
          Object.assign(container.style, {
            position: "fixed",
            right: "12px",
            bottom: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-end",
            zIndex: 2000,
            pointerEvents: "none",
          });
          document.body.appendChild(container);
        }
        Object.assign(toast.style, { position: "relative" });
        container.appendChild(toast);
      }

      // Forzar layout y animar entrada
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = toast.style.transform.replace("translateY(6px)", "translateY(0)");
      });

      // Ocultar y eliminar después de ms
      setTimeout(() => {
        toast.style.opacity = "0";
        // si estaba posicionado absolute sobre el personaje, deslizar hacia abajo
        toast.style.transform = toast.style.transform.replace("translateY(0)", "translateY(6px)");
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 260);
      }, ms);
    } catch (e) {
      // Fallback silencioso
      console.warn("Error mostrando popup de inventario:", e);
    }
  }

  // Public methods to show/hide/toggle the HUD
  show() {
    if (!this._ui || !this._ui.container) return;
    this._ui.container.style.display = ""; // revert to default
    this._updateUI();
  }

  hide() {
    if (!this._ui || !this._ui.container) return;
    this._ui.container.style.display = "none";
  }

  toggle() {
    if (!this._ui || !this._ui.container) return;
    const d = this._ui.container.style.display;
    if (d === "none") this.show();
    else this.hide();
  }
}
