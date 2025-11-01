// Simple death screen overlay that restarts the game back to the menu
// Exports a function showDeathScreen() and attaches a helper to window when imported.

export function showDeathScreen(options = {}) {
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
  title.textContent = options.title || '¡Has muerto!';
  title.style.color = '#ff5555';
  title.style.fontFamily = 'Arial, sans-serif';
  title.style.fontSize = '48px';
  title.style.fontWeight = '900';
  title.style.textShadow = '0 0 16px rgba(255,85,85,0.9)';
  title.style.marginBottom = '24px';

  const subtitle = document.createElement('div');
  subtitle.textContent = options.subtitle || 'Volverás al menú principal';
  subtitle.style.color = '#ddd';
  subtitle.style.fontFamily = 'Arial, sans-serif';
  subtitle.style.fontSize = '18px';
  subtitle.style.marginBottom = '28px';

  const btn = document.createElement('button');
  btn.textContent = options.buttonText || 'Reintentar';
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

  btn.addEventListener('click', () => {
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

// convenience attach if imported in main.js
if (typeof window !== 'undefined') {
  window.showDeathScreen = showDeathScreen;
}

export default showDeathScreen;
