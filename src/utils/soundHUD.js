import { safePlaySfx } from './audioHelpers.js';
const STORAGE_KEY = "gameSoundSettings";

function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  for (const c of children) el.appendChild(c);
  return el;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveSettings(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (_) {}
}

export class SoundHUD {
  constructor({ container = document.body } = {}) {
    // Avoid duplicates
    const existing = document.getElementById("sound-hud");
    if (existing) {
      this.panel = existing;
      return this;
    }

    this.stored = loadSettings();
    this.container = container;
    this.panel = createEl("div", { id: "sound-hud" });
    this.panel.style.display = 'none';
    this.panel.style.position = "fixed";
    this.panel.style.left = "50%";
    this.panel.style.top = "50%";
    this.panel.style.transform = "translate(-50%, -50%)";
    this.panel.style.width = "60vw";
    this.panel.style.maxWidth = "900px";
    this.panel.style.maxHeight = "84vh";
    this.panel.style.overflowY = "auto";
    this.panel.style.background = "rgba(18,18,18,0.98)";
    this.panel.style.color = "#fff";
    this.panel.style.padding = "28px";
    this.panel.style.borderRadius = "12px";
    this.panel.style.boxShadow = "0 24px 90px rgba(0,0,0,0.85)";
    this.panel.style.fontFamily = "Arial, sans-serif";
    this.panel.style.zIndex = "10050";

    const title = createEl("div", { innerText: "AUDIO" });
    title.style.fontWeight = "800";
    title.style.marginBottom = "8px";
    title.style.fontSize = '24px';
    title.style.letterSpacing = '1px';

    const header = createEl('div', {});
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '14px';

    const closeBtn = createEl('button', { innerText: '✕' });
    closeBtn.title = 'Cerrar';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '8px 12px';

    closeBtn.addEventListener('click', (ev) => {
      try { ev.stopPropagation(); this.panel.style.display = 'none'; } catch(_) {}
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    const makeRow = (labelText, idSuffix, min = 0, max = 100) => {
      const row = createEl("div", {});
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.marginBottom = "16px";

      const label = createEl("label", { innerText: labelText });
      label.style.flex = "0 0 160px";
      label.style.fontSize = "16px";
      label.style.fontWeight = '600';

      const input = createEl("input", { type: "range", min, max });
      input.id = `sound-${idSuffix}`;
      input.style.flex = "1";
      input.style.margin = "0 16px";
      input.style.height = '10px';
      input.style.cursor = 'pointer';
      input.style.borderRadius = '6px';

      const value = createEl("div", { innerText: "--" });
      value.style.width = "56px";
      value.style.textAlign = "right";
      value.style.fontSize = "16px";
      value.style.fontWeight = '600';

      input.addEventListener("input", () => {
        value.innerText = input.value;
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(value);
      return { row, input, value };
    };

    const masterRow = makeRow("Master", "master");
    const musicRow = makeRow("Music", "music");
    const sfxRow = makeRow("SFX", "sfx");

    this.panel.appendChild(masterRow.row);
    this.panel.appendChild(musicRow.row);
    this.panel.appendChild(sfxRow.row);

    const controls = createEl("div", {});
    controls.style.display = "flex";
    controls.style.gap = "16px";
    controls.style.marginTop = "18px";
    controls.style.justifyContent = 'center';

    const muteBtn = createEl("button", { innerText: "Mute" });
    muteBtn.style.flex = "1";
    muteBtn.style.padding = "14px";
    muteBtn.style.fontSize = '16px';
    muteBtn.style.cursor = "pointer";
    muteBtn.style.border = "none";
    muteBtn.style.borderRadius = "6px";
    muteBtn.style.background = "#333";
    muteBtn.style.color = "#fff";

    const resetBtn = createEl("button", { innerText: "Reset" });
    resetBtn.style.flex = "1";
    resetBtn.style.padding = "14px";
    resetBtn.style.fontSize = '16px';
    resetBtn.style.cursor = "pointer";
    resetBtn.style.border = "none";
    resetBtn.style.borderRadius = "6px";
    resetBtn.style.background = "#444";
    resetBtn.style.color = "#fff";

    controls.appendChild(muteBtn);
    controls.appendChild(resetBtn);
    this.panel.appendChild(controls);

    const applyToAudio = () => {
      try {
        const audio = window.audio;
        if (!audio) return;
        const master = Number(masterRow.input.value) / 100;
        const music = Number(musicRow.input.value) / 100;
        const sfx = Number(sfxRow.input.value) / 100;

        if (typeof audio.setMasterVolume === "function") audio.setMasterVolume(master);
        if (typeof audio.setMusicVolume === "function") audio.setMusicVolume(music);
        if (typeof audio.setSfxVolume === "function") audio.setSfxVolume(sfx);

        if (typeof audio.muted !== 'undefined') {
          muteBtn.innerText = audio.muted ? 'Unmute' : 'Mute';
        }
      } catch (e) {
        // ignore
      }
    };

    const defaults = this.stored || { master: 90, music: 50, sfx: 100, muted: false };
    masterRow.input.value = Math.round((defaults.master || 90));
    musicRow.input.value = Math.round((defaults.music || 50));
    sfxRow.input.value = Math.round((defaults.sfx || 100));
    masterRow.value.innerText = masterRow.input.value;
    musicRow.value.innerText = musicRow.input.value;
    sfxRow.value.innerText = sfxRow.input.value;

    [masterRow.input, musicRow.input, sfxRow.input].forEach((inp) => {
      inp.addEventListener("input", () => {
        applyToAudio();
        saveSettings({ master: Number(masterRow.input.value), music: Number(musicRow.input.value), sfx: Number(sfxRow.input.value) });
      });
    });

    muteBtn.addEventListener("click", () => {
      try {
        if (window.audio && typeof window.audio.toggleMute === 'function') {
          const muted = window.audio.toggleMute();
          muteBtn.innerText = muted ? 'Unmute' : 'Mute';
        } else {
          const currentlyMuted = muteBtn.innerText === 'Unmute';
          if (!currentlyMuted) {
            masterRow.input.dataset.prev = masterRow.input.value;
            masterRow.input.value = 0;
            masterRow.value.innerText = '0';
          } else {
            masterRow.input.value = masterRow.input.dataset.prev || 90;
            masterRow.value.innerText = masterRow.input.value;
          }
          applyToAudio();
        }
      } catch (_) {}
    });

    resetBtn.addEventListener("click", () => {
      masterRow.input.value = 90;
      musicRow.input.value = 50;
      sfxRow.input.value = 100;
      masterRow.value.innerText = masterRow.input.value;
      musicRow.value.innerText = musicRow.input.value;
      sfxRow.value.innerText = sfxRow.input.value;
      saveSettings({ master: 90, music: 50, sfx: 100 });
      applyToAudio();
    });

    const onAudioReady = () => {
      try {
        if (window.audio) {
          applyToAudio();
        }
      } catch (_) {}
    };

    if (!window.audio) {
      const listener = () => {
        onAudioReady();
        window.removeEventListener('audioReady', listener);
      };
      window.addEventListener('audioReady', listener);
    } else {
      onAudioReady();
    }

    this.container.appendChild(this.panel);

    // lightweight helper to show/hide programmatically
    this.panel.show = function() { try { this.style.display = 'block'; } catch(_) {} };
    this.panel.hide = function() { try { this.style.display = 'none'; } catch(_) {} };
    this.panel.isShown = function() { try { return window.getComputedStyle(this).display !== 'none'; } catch(_) { return this.style.display === 'block'; } };

    try {
      let wasVisible = this.panel.isShown();
      const mo = new MutationObserver(() => {
        try {
          const visible = this.panel.isShown();
          if (visible && !wasVisible) {
            wasVisible = true;
            try { safePlaySfx('popup', { volume: 0.9 }); } catch(_) {}
          } else if (!visible) {
            wasVisible = false;
          }
        } catch (_) {}
      });
      mo.observe(this.panel, { attributes: true, attributeFilter: ['style', 'class'] });
    } catch (_) {}

    return this;
  }
}

// Factory wrapper to keep existing callsites (returns the DOM panel like before)
export function createSoundHUD(opts = {}) {
  const inst = new SoundHUD(opts);
  return inst.panel;
}

export default createSoundHUD;
