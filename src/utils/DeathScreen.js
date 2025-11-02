// Simple death screen overlay that restarts the game back to the menu
// Converted to a class while keeping the original named/default function
// for compatibility with existing imports.

export class DeathScreen {
  constructor(options = {}) {
    this.options = options || {};
  }

  show(options = {}) {
    const opts = Object.assign({}, this.options, options || {});
    // avoid multiple overlays
    if (document.getElementById('death-screen-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'death-screen-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.88)';
    overlay.style.zIndex = '100000';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(2px)';

    const title = document.createElement('div');
    title.textContent = opts.title || '¡Has muerto!';
    title.style.color = '#ff5555';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.fontSize = '48px';
    title.style.fontWeight = '900';
    title.style.textShadow = '0 0 16px rgba(255,85,85,0.9)';
    title.style.marginBottom = '24px';

    const subtitle = document.createElement('div');
    subtitle.textContent = opts.subtitle || 'Volverás al menú principal';
    subtitle.style.color = '#ddd';
    subtitle.style.fontFamily = 'Arial, sans-serif';
    subtitle.style.fontSize = '18px';
    subtitle.style.marginBottom = '28px';

    const btn = document.createElement('button');
    btn.textContent = opts.buttonText || 'Reintentar';
    btn.style.padding = '12px 20px';
    btn.style.borderRadius = '8px';
    btn.style.border = 'none';
    btn.style.fontFamily = 'Arial, sans-serif';
    btn.style.fontSize = '16px';
    btn.style.fontWeight = '700';
    btn.style.cursor = 'pointer';
    btn.style.background = '#ff5555';
    btn.style.color = '#fff';
    btn.style.boxShadow = '0 8px 24px rgba(255,85,85,0.45)';

    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.03)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1.0)'; });

    // UI sounds if audio manager available
    btn.addEventListener('mouseenter', () => {
      try {
        if (window.audio && typeof window.audio.playSFX === 'function') {
          window.audio.playSFX('uiHover', { volume: 0.6 });
        }
      } catch (_) {}
    });

    btn.addEventListener('click', () => {
      try {
        if (window.audio && typeof window.audio.playSFX === 'function') {
          window.audio.playSFX('uiClick', { volume: 0.9 });
        }
      } catch (_) {}
      // simplest and most reliable way to reset back to the start/menu
      try {
        window.location.reload();
      } catch (e) {
        // fallback: remove overlay
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
    });

    overlay.appendChild(title);
    overlay.appendChild(subtitle);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
  }

  static show(options = {}) {
    return new DeathScreen(options).show(options);
  }
}

// Convenience attach for backward compatibility
export function showDeathScreen(options = {}) {
  return DeathScreen.show(options);
}

if (typeof window !== 'undefined') {
  try { window.showDeathScreen = showDeathScreen; } catch (e) {}
}

export default showDeathScreen;
