export class Inventory {
  constructor({ pricePerLiter = 5 } = {}) {
    this.milkLiters = 0;
    // tools represented as array of slot strings (null = empty)
    this.slotCount = 5;
    this.tools = new Array(this.slotCount).fill(null);
    this.equippedSlot = null; // index (0-based) of equipped tool
    this.coins = 0;
    this.pricePerLiter = pricePerLiter;
    this._createUI();
    this._updateUI();
    // Mostrar el inventario por defecto
    this.show();
    // callback cuando cambia equipamiento: (slotIndex, toolName|null)
    this.onEquipChange = null;
  }

  addMilk(liters = 0) {
    const n = Math.max(0, Number(liters) || 0);
    this.milkLiters += n;
    this._updateUI();
    return this.milkLiters;
  }

  // Añadir una herramienta a la primera ranura libre. Devuelve el índice o -1 si no hay espacio
  addTool(name) {
    if (!name) return -1;
    const freeIndex = this.tools.findIndex((t) => t === null);
    if (freeIndex === -1) {
      console.warn('No hay ranuras libres en el inventario');
      return -1;
    }
    this.tools[freeIndex] = name;
    this._updateUI();
    return freeIndex;
  }

  // Obtener herramienta en slot (1-based index for callers is nicer; internal 0-based)
  getToolInSlot(index0) {
    if (index0 == null) return null;
    if (index0 < 0 || index0 >= this.slotCount) return null;
    return this.tools[index0];
  }

  // Toggle equip/unequip slot. index0 = 0..slotCount-1
  toggleSlot(index0) {
    if (index0 == null) return;
    if (index0 < 0 || index0 >= this.slotCount) return;
    const tool = this.tools[index0];
    if (!tool) {
      // nothing to equip
      this._flash('Ranura vacía');
      return;
    }

    console.log('Inventory.toggleSlot called for', index0, 'current equipped:', this.equippedSlot, 'tool:', this.tools[index0]);
    if (this.equippedSlot === index0) {
      // unequip
      this.equippedSlot = null;
      this._updateUI();
      if (typeof this.onEquipChange === 'function') this.onEquipChange(null, null);
      this._flash(`${tool} guardada`);
    } else {
      // equip
      this.equippedSlot = index0;
      this._updateUI();
      if (typeof this.onEquipChange === 'function') this.onEquipChange(index0, tool);
      this._flash(`${tool} equipada`);
    }
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
        position: "fixed",
        right: "12px",
        top: "12px",
        width: "200px",
        padding: "12px",
        background: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontSize: "14px",
        borderRadius: "8px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
        transition: "all 0.3s ease"
      });
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;font-size:16px;color:#fdbb2d;text-shadow:0 1px 2px rgba(0,0,0,0.5)">INVENTARIO</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span><strong>Leche:</strong></span>
        <span id="inv-milk" style="font-family:'Courier New', monospace">0.00 L</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span><strong>Monedas:</strong></span>
        <span id="inv-coins" style="font-family:'Courier New', monospace">0</span>
      </div>
      <div style="margin-top:10px;margin-bottom:4px">
        <div style="font-size:12px;opacity:0.8;margin-bottom:4px"><strong>Herramientas (1-5):</strong></div>
        <div id="inv-tools" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
      <div id="inv-msg" style="margin-top:10px;padding:6px;background:rgba(255,255,255,0.1);border-radius:4px;font-size:12px;display:none"></div>
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
    // Actualizar monedas
    if (this._ui.coins) this._ui.coins.textContent = String(this.coins);

    // Actualizar slots de herramientas
    if (this._ui.tools) {
      // Limpiar
      this._ui.tools.innerHTML = '';
      for (let i = 0; i < this.slotCount; i++) {
        const slot = document.createElement('div');
        Object.assign(slot.style, {
          minWidth: '36px',
          height: '36px',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a0d8ef',
          fontSize: '12px',
          border: '1px solid rgba(255,255,255,0.04)',
          cursor: 'default'
        });

        if (this.equippedSlot === i) {
          slot.style.background = 'linear-gradient(90deg, rgba(250,200,50,0.15), rgba(250,200,50,0.05))';
          slot.style.border = '1px solid rgba(250,200,50,0.6)';
          slot.style.color = '#ffd66b';
        }

        const toolName = this.tools[i] || '';
        slot.textContent = toolName ? `${i + 1}. ${toolName}` : `${i + 1}`;
        this._ui.tools.appendChild(slot);
      }
    }
  }

  _flash(msg, ms = 2200) {
    if (!this._ui) return;
    const msgEl = this._ui.msg;
    msgEl.textContent = msg;
    msgEl.style.display = 'block';
    msgEl.style.opacity = '1';
    clearTimeout(this._t);
    
    this._t = setTimeout(() => {
      if (msgEl) {
        msgEl.style.opacity = '0';
        // Ocultar después de la transición
        setTimeout(() => {
          if (msgEl) msgEl.style.display = 'none';
        }, 300);
      }
    }, ms);
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
