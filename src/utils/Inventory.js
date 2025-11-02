  export class Inventory {
  constructor({ pricePerLiter = 5 } = {}) {
    this.milkLiters = 30; // Iniciar con 30 litros de leche para pruebas
    // tools represented as array of slot strings (null = empty)
    this.slotCount = 6; // Aumentado a 6 slots
    this.tools = new Array(this.slotCount).fill(null);
    this.coins = 500; // Iniciar con 100 monedas para pruebas
    this.pricePerLiter = pricePerLiter;
    this._createUI();
    this._updateUI();
    // Iniciar con el inventario cerrado
    this.hide();
    // callback cuando cambia equipamiento: (slotIndex, toolName|null)
    this.onEquipChange = null;
  }

  addMilk(liters = 0) {
    const n = Math.max(0, Number(liters) || 0);
    this.milkLiters += n;
    this._updateUI();
    return this.milkLiters;
  }
  
  // Establece directamente la cantidad de leche
  setMilk(liters) {
    this.milkLiters = Math.max(0, Number(liters) || 0);
    this._updateUI();
    return this.milkLiters;
  }

  addCoins(amount = 0) {
    const n = Math.max(0, Number(amount) || 0);
    this.coins += n;
    this._updateUI();
    this._flash(`+${n} monedas obtenidas`);
    return this.coins;
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

  // Toggle slot. index0 = 0..slotCount-1
  toggleSlot(index0) {
    if (index0 == null) return;
    if (index0 < 0 || index0 >= this.slotCount) return;
    const tool = this.tools[index0];
    if (!tool) {
      // nothing to select
      this._flash('Ranura vacía');
      return;
    }
    
    // Notificar que se seleccionó una herramienta
    if (typeof this.onEquipChange === 'function') {
      this.onEquipChange(index0, tool);
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
    
    // Obtener o crear el contenedor de botones HUD
    let hudButtonsContainer = document.getElementById('hud-buttons-container');
    if (!hudButtonsContainer) {
      hudButtonsContainer = document.createElement('div');
      hudButtonsContainer.id = 'hud-buttons-container';
      document.body.appendChild(hudButtonsContainer);
    }
    
    // Eliminar cualquier instancia previa del inventario
    const existingContainer = document.getElementById('inventory-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    
    // Crear el contenedor del inventario
    const container = document.createElement('div');
    container.id = 'inventory-container';
    container.className = 'hud-button-container';
    container.innerHTML = `
      <button id="inventory-toggle" type="button">Inventario</button>
      <div id="${id}" class="inventory-collapsed">
        <button id="inventory-close" type="button">×</button>
      </div>
    `;
    
    // Insertar el contenedor del inventario en el contenedor de botones HUD
    hudButtonsContainer.appendChild(container);
    
    // Obtener referencias a los elementos
    const el = document.getElementById(id);
    const toggleBtn = document.getElementById('inventory-toggle');
    const closeBtn = document.getElementById('inventory-close');
    
    // Configurar eventos de toggle
    const toggleInventory = () => {
      const isExpanded = el.classList.contains('inventory-expanded');
      if (isExpanded) {
        this.hide();
      } else {
        this.show();
      }
    };
    
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleInventory();
    });
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    
    // Cerrar al hacer clic fuera del inventario
    document.addEventListener('click', (e) => {
      if (!el.contains(e.target) && e.target !== toggleBtn) {
        this.hide();
      }
    });
    
    // Prevenir que los clics en el inventario se propaguen al documento
    el.addEventListener('click', (e) => {
      e.stopPropagation();
    });
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
        <div style="font-size:12px;opacity:0.8;margin-bottom:4px"><strong>Herramientas (1-6):</strong></div>
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
          cursor: 'default',
          transition: 'all 0.2s ease'
        });

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
    const el = document.getElementById('inventory-hud');
    const inventoryToggle = document.getElementById('inventory-toggle');
    const minimapEl = document.getElementById('minimap-hud');
    const minimapToggle = document.getElementById('minimap-toggle');
    const inventoryClose = document.getElementById('inventory-close');
    
    if (el) {
      // Cerrar el minimapa si está abierto
      if (minimapEl && minimapEl.classList.contains('minimap-expanded')) {
        minimapEl.classList.remove('minimap-expanded');
        minimapEl.classList.add('minimap-collapsed');
        if (minimapToggle) minimapToggle.style.display = 'block';
      }
      
      // Asegurarse de que el contenedor sea visible
      el.style.display = 'block';
      
      // Mostrar el inventario
      el.classList.remove('inventory-collapsed');
      el.classList.add('inventory-expanded');
      
      // Ocultar el botón de toggle y mostrar el de cierre
      if (inventoryToggle) {
        inventoryToggle.style.display = 'none';
      }
      
      if (inventoryClose) {
        inventoryClose.style.display = 'flex';
      }
      
      this._updateUI();
    }
  }

  hide() {
    const el = document.getElementById('inventory-hud');
    const inventoryToggle = document.getElementById('inventory-toggle');
    const inventoryClose = document.getElementById('inventory-close');
    
    if (el) {
      el.classList.remove('inventory-expanded');
      el.classList.add('inventory-collapsed');
      
      // Mostrar el botón de toggle y ocultar el de cierre
      if (inventoryToggle) {
        inventoryToggle.style.display = 'block';
      }
      
      if (inventoryClose) {
        inventoryClose.style.display = 'none';
      }
    }
  }

  toggle() {
    const el = document.getElementById('inventory-hud');
    if (el) {
      if (el.classList.contains('inventory-expanded')) {
        this.hide();
      } else {
        this.show();
      }
    }
  }
}
