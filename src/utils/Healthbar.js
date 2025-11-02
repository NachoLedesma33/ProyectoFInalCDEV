// Healthbar HUD para el granjero
// Crea un HUD simple en DOM y lo actualiza según un HealthComponent

export class HealthBar {
  constructor(opts = {}) {
    this.id = opts.id || 'player-healthbar';
    this.width = opts.width || 300;
    this.height = opts.height || 24;
    this.showNumbers = opts.showNumbers !== undefined ? opts.showNumbers : true;
    this.position = opts.position || 'top-left'; // 'top-left' | 'bottom-center' | custom
    this.opts = opts || {};
    this.container = null;
    this.fill = null;
    this.text = null;
    this.healthComponent = null;
    this._raf = null;
    this._lastValue = null;

    this._createDom();
  }

  _createDom() {
    // Contenedor principal
    const wrapper = document.createElement('div');
    wrapper.id = this.id;
    wrapper.style.position = 'fixed';
    // Positioning based on option
    if (this.position === 'bottom-center') {
      wrapper.style.left = '50%';
      wrapper.style.bottom = (this.opts && this.opts.y !== undefined) ? `${this.opts.y}px` : '20px';
      wrapper.style.transform = 'translateX(-50%)';
      // ensure top is not set
      wrapper.style.top = 'auto';
    } else if (this.position === 'top-center') {
      wrapper.style.left = '50%';
      wrapper.style.top = (this.opts && this.opts.y !== undefined) ? `${this.opts.y}px` : '20px';
      wrapper.style.transform = 'translateX(-50%)';
    } else {
      wrapper.style.left = (this.opts && this.opts.x !== undefined) ? `${this.opts.x}px` : '20px';
      wrapper.style.top = (this.opts && this.opts.y !== undefined) ? `${this.opts.y}px` : '20px';
    }
    wrapper.style.width = `${this.width}px`;
    wrapper.style.height = `${this.height}px`;
    wrapper.style.background = 'rgba(0,0,0,0.6)';
    wrapper.style.border = '2px solid rgba(255,255,255,0.12)';
    wrapper.style.borderRadius = '6px';
    wrapper.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
    wrapper.style.padding = '4px';
  // Keep HUD elements behind modal overlays (pause/menu). Pause overlay uses z-index ~10005,
  // so choose a value lower than that so the pause modal visually appears on top.
  wrapper.style.zIndex = 9000;
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';

    // barra de fondo
    const barBg = document.createElement('div');
    barBg.style.flex = '1';
    barBg.style.height = '100%';
    barBg.style.background = 'linear-gradient(90deg, #4b4b4b, #2b2b2b)';
    barBg.style.borderRadius = '4px';
    barBg.style.overflow = 'hidden';
    barBg.style.position = 'relative';

    // fill
    const fill = document.createElement('div');
    fill.style.position = 'absolute';
    fill.style.left = '0';
    fill.style.top = '0';
    fill.style.bottom = '0';
    fill.style.width = '100%';
    fill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    fill.style.transformOrigin = 'left center';
    fill.style.transition = 'width 0.15s linear, background 0.2s linear';

    barBg.appendChild(fill);

    // Texto numérico
    const text = document.createElement('div');
    text.style.minWidth = '64px';
    text.style.color = '#fff';
    text.style.fontWeight = '700';
    text.style.fontFamily = 'Arial, sans-serif';
    text.style.fontSize = '14px';
    text.style.textAlign = 'center';

    wrapper.appendChild(barBg);
  if (this.showNumbers) wrapper.appendChild(text);

    document.body.appendChild(wrapper);

    this.container = wrapper;
    this.fill = fill;
    this.text = text;
  }

  attachTo(healthComponent, opts = {}) {
    if (!healthComponent) throw new Error('HealthComponent requerido');
    this.healthComponent = healthComponent;
    if (opts.position === 'top-left') {
      this.container.style.left = opts.x !== undefined ? `${opts.x}px` : '20px';
      this.container.style.top = opts.y !== undefined ? `${opts.y}px` : '20px';
    }

    // start RAF loop
    if (!this._raf) this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  _tick() {
    if (!this.healthComponent) return;
    const current = this.healthComponent.current;
    const max = this.healthComponent.maxHealth;
    const pct = Math.max(0, Math.min(1, current / max));

    const pctCss = `${(pct * 100).toFixed(1)}%`;
    // update width
    this.fill.style.width = pctCss;

    // cambio de color dependiendo del %
    if (pct > 0.6) {
      this.fill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    } else if (pct > 0.3) {
      this.fill.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
    } else {
      this.fill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    }

    if (this.showNumbers) this.text.textContent = `${Math.round(current)}/${Math.round(max)}`;

    // flash when damaged
    if (this._lastValue !== null && current < this._lastValue) {
      this._flash();
    }
    this._lastValue = current;

    this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  _flash() {
    if (!this.container) return;
    this.container.style.boxShadow = '0 0 12px rgba(231, 76, 60, 0.9)';
    setTimeout(() => {
      if (this.container) this.container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
    }, 180);
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
    this.container = null;
    this.fill = null;
    this.text = null;
    this.healthComponent = null;
  }
}

// Helper global para crear el HUD del jugador (granjero)
window.createPlayerHealthBar = function (hc, opts) {
  const hb = new HealthBar(Object.assign({ id: 'player-healthbar', width: 320, height: 28 }, opts || {}));
  hb.attachTo(hc, opts || {});
  window.playerHealthBar = hb;
  return hb;
};

export default HealthBar;
