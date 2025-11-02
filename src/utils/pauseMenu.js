// Pause menu modal
import { safePlaySfx } from './audioHelpers.js';

export default class PauseMenu {
  constructor({ container = document.body } = {}) {
    this.container = container;
    this._build();
    this.keyHandler = null;
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'pause-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'none';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 220ms ease';
    overlay.style.zIndex = '10005';
    overlay.style.backdropFilter = 'blur(2px)';

    const panel = document.createElement('div');
    panel.id = 'pause-menu';
    panel.style.position = 'absolute';
    panel.style.top = '50%';
    panel.style.left = '50%';
    panel.style.transform = 'translate(-50%, -50%) scale(0.96)';
    panel.style.width = '56vw';
    panel.style.maxWidth = '760px';
    panel.style.padding = '28px';
    panel.style.background = 'linear-gradient(180deg, rgba(30,30,30,0.98), rgba(22,22,22,0.98))';
    panel.style.border = '2px solid rgba(255,255,255,0.06)';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 18px 40px rgba(0,0,0,0.6)';
    panel.style.color = '#fff';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.zIndex = '10010';
    panel.style.opacity = '0';
    panel.style.transition = 'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 200ms ease';

    const title = document.createElement('h2');
    title.textContent = 'Pausa';
    title.style.margin = '0 0 14px 0';
    title.style.fontSize = '28px';
    title.style.textAlign = 'center';
    panel.appendChild(title);

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.gap = '12px';
    btnContainer.style.marginTop = '12px';

    const makeButton = (text, id) => {
      const b = document.createElement('button');
      b.id = id;
      b.type = 'button';
      b.textContent = text;
      b.style.padding = '12px 16px';
      b.style.fontSize = '18px';
      b.style.borderRadius = '8px';
      b.style.border = 'none';
      b.style.cursor = 'pointer';
      b.style.background = 'rgba(255,255,255,0.06)';
      b.style.color = '#fff';
      b.style.boxShadow = 'inset 0 -2px 0 rgba(0,0,0,0.2)';
      // smooth transitions for hover/focus effects
      b.style.transition = 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease';
      return b;
    };

    const soundBtn = makeButton('Sonido', 'pause-sound');
    const controlsBtn = makeButton('Controles', 'pause-controls');
    const mainMenuBtn = makeButton('Menu Principal', 'pause-mainmenu');
    const resumeBtn = makeButton('Continuar', 'pause-resume');

    btnContainer.appendChild(soundBtn);
    btnContainer.appendChild(controlsBtn);
    btnContainer.appendChild(mainMenuBtn);
    btnContainer.appendChild(resumeBtn);

    panel.appendChild(btnContainer);

    const closeX = document.createElement('button');
    closeX.textContent = '✕';
    closeX.title = 'Cerrar';
    closeX.style.position = 'absolute';
    closeX.style.top = '8px';
    closeX.style.right = '8px';
    closeX.style.border = 'none';
    closeX.style.background = 'transparent';
    closeX.style.color = '#fff';
    closeX.style.fontSize = '20px';
    closeX.style.cursor = 'pointer';
    panel.appendChild(closeX);

    overlay.appendChild(panel);
    this.container.appendChild(overlay);

    // store refs
    this.overlay = overlay;
    this.panel = panel;
    this.focusables = [soundBtn, controlsBtn, mainMenuBtn, resumeBtn, closeX];

    // sounds (use centralized helper)
    const playHover = () => { try { safePlaySfx('uiHover', { volume: 0.6 }); } catch (_) {} };
    const playClick = () => { try { safePlaySfx('uiClick', { volume: 0.9 }); } catch (_) {} };
    const playPopup = () => { try { safePlaySfx('popup', { volume: 0.9 }); } catch (_) {} };

    this._playClick = playClick;

    // hover/focus sounds + visual hover/focus effects
    this.focusables.forEach((el) => {
      try {
        el.addEventListener('pointerenter', playHover);
        el.addEventListener('mouseenter', playHover);
        el.addEventListener('focus', playHover);
      } catch (_) {}

      // visual highlight on hover/focus
      const hoverIn = () => {
        try {
          el.style.border = '2px solid rgba(125,211,252,0.9)';
          el.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))';
          el.style.boxShadow = '0 10px 22px rgba(0,0,0,0.6), 0 0 14px rgba(125,211,252,0.12)';
          el.style.transform = 'translateX(6px)';
        } catch (_) {}
      };
      const hoverOut = () => {
        try {
          el.style.border = 'none';
          el.style.background = 'rgba(255,255,255,0.06)';
          el.style.boxShadow = 'inset 0 -2px 0 rgba(0,0,0,0.2)';
          el.style.transform = 'translateX(0)';
        } catch (_) {}
      };

      try {
        el.addEventListener('pointerleave', hoverOut);
        el.addEventListener('blur', hoverOut);
        el.addEventListener('focus', hoverIn);
        el.addEventListener('mouseenter', hoverIn);
      } catch (_) {}
    });

    // actions
    soundBtn.addEventListener('click', () => {
      playClick();
      try { const sh = document.getElementById('sound-hud'); if (sh) sh.style.display = sh.style.display === 'block' ? 'none' : 'block'; } catch (_) {}
      this.hide();
    });

    controlsBtn.addEventListener('click', () => { playClick(); try { const ch = document.getElementById('controls-hud'); if (ch) ch.style.display = 'flex'; } catch (_) {} this.hide(); });

    mainMenuBtn.addEventListener('click', () => {
      playClick();
      try { if (typeof window.resetGame === 'function') { window.resetGame(); } else { location.reload(); } } catch (_) { try { location.reload(); } catch (_) {} }
    });

    // wire resume & close
    resumeBtn.addEventListener('click', () => { playClick(); this.hide(); });
    closeX.addEventListener('click', () => { playClick(); this.hide(); });

    // click outside to close
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) this.hide(); });
  }

  focusNext(dir = 1) {
    const active = document.activeElement;
    let idx = this.focusables.indexOf(active);
    if (idx === -1) idx = 0;
    idx = (idx + dir + this.focusables.length) % this.focusables.length;
    try { this.focusables[idx].focus(); } catch (_) {}
  }

  _onKeyDown = (e) => {
    if (!this.overlay || this.overlay.style.display !== 'block') return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); this.hide(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.focusNext(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.focusNext(-1); return; }
    if (e.key === 'Enter') { if (document.activeElement && typeof document.activeElement.click === 'function') { e.preventDefault(); document.activeElement.click(); } return; }
    if (e.key === 'Tab') { e.preventDefault(); if (e.shiftKey) this.focusNext(-1); else this.focusNext(1); }
  }

  show() {
    this.overlay.style.display = 'block';
  // play popup sound when pause menu appears
  try { if (this._playClick) { /* keep click sound available */ } } catch (_) {}
  try { safePlaySfx('popup', { volume: 0.9 }); } catch (_) {}
    requestAnimationFrame(() => { try { this.overlay.style.opacity = '1'; } catch (_) {} try { this.panel.style.transform = 'translate(-50%, -50%) scale(1)'; this.panel.style.opacity = '1'; } catch (_) {} });
  window.__gamePaused = true;
  // notify other systems that the game is paused
  // When the pause menu is opened via UI (Esc), we don't want to pause audio
  // playback — include a detail flag so listeners can opt-out of pausing audio.
  try { window.dispatchEvent(new CustomEvent('gamepause', { detail: { pauseAudio: false } })); } catch (_) {}
    document.addEventListener('keydown', this._onKeyDown, true);
    try { this.focusables[0].focus(); } catch (_) {}
  }

  hide() {
    try { this.overlay.style.opacity = '0'; } catch (_) {}
    try { this.panel.style.transform = 'translate(-50%, -50%) scale(0.96)'; this.panel.style.opacity = '0'; } catch (_) {}
    const cleanup = () => { try { this.overlay.style.display = 'none'; } catch (_) {} window.__gamePaused = false; document.removeEventListener('keydown', this._onKeyDown, true); this.overlay.removeEventListener('transitionend', cleanup); };
    this.overlay.addEventListener('transitionend', cleanup);
  // notify other systems that the game has resumed
  // Match the pause above: indicate that this resume is coming from the UI pause
  // menu so audio listeners can ignore it if they didn't pause audio.
  try { window.dispatchEvent(new CustomEvent('gameresume', { detail: { pauseAudio: false } })); } catch (_) {}
  }

  isShown() {
    try { return window.getComputedStyle ? getComputedStyle(this.overlay).display !== 'none' && getComputedStyle(this.overlay).opacity !== '0' : (this.overlay.style.display === 'block'); } catch (_) { return false; }
  }
}
