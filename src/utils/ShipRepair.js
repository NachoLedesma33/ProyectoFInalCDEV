import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";
import { safePlaySfx } from './audioHelpers.js';

export class ShipRepair {
  constructor(scene, position = { x: 39.9, y: 0.0, z: -21.1 }, radius = 1.5) {
    this.scene = scene;
    this.position = position;
    this.radius = radius;
    this.isPlayerNearby = false;
    this.isUIOpen = false;
    this.uiTimer = null;
    this.selectedTool = null; // tool selected from palette
    this.slots = new Array(6).fill(null); // 6 logical slots (3 top, 3 bottom)

    this.createInteractionArea();
    // keep DOM references to slot elements so we can re-populate on HUD reopen
    this.slotElements = new Array(6).fill(null);
    // color palette for progress segments (from red -> orange -> yellow -> yellow-green -> light green -> green)
    this.segmentColors = ['#b72b2b', '#d07020', '#e6b800', '#d0e020', '#9cff9c', '#26a926'];
    // persistence key and completion callback
    this._storageKey = 'shipRepairState_v1';
    this.onRepairComplete = null; // optional callback set by game
    this._repairCompleted = false;
  // Session-only state: do not load from persistent storage. State will be kept in-memory only.
  }

  // Persistence helpers
  saveState() {
    // Persistence disabled: session-only state. No-op to avoid writing to localStorage.
    try {
      // Intentionally do nothing
      return;
    } catch (e) {
      // silent
    }
  }

  loadState() {
    // Persistence disabled: do not load from localStorage. Keep initial in-memory state.
    return;
  }

  createInteractionArea() {
    const geometry = new THREE.CircleGeometry(this.radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });

    this.interactionCircle = new THREE.Mesh(geometry, material);
    this.interactionCircle.rotation.x = -Math.PI / 2;
    this.interactionCircle.position.set(this.position.x, 0.1, this.position.z);
    this.scene.add(this.interactionCircle);

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00aa00, transparent: true, opacity: 0.9 });
    const circle = new THREE.LineSegments(edges, lineMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.copy(this.interactionCircle.position);
    circle.position.y = 0.11;
    this.scene.add(circle);
  }

  update(playerPosition) {
    if (playerPosition) this.checkPlayerPosition(playerPosition);
  }

  checkPlayerPosition(playerPosition) {
    if (!playerPosition) return;
    const worldPosition = new THREE.Vector3();
    this.interactionCircle.getWorldPosition(worldPosition);
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - worldPosition.x, 2) + Math.pow(playerPosition.z - worldPosition.z, 2)
    );

    if (distance <= this.radius) {
      if (!this.isPlayerNearby) {
        this.isPlayerNearby = true;
        if (this.uiTimer) clearTimeout(this.uiTimer);
        // Slight delay before showing small popup (match Market behaviour)
        this.uiTimer = setTimeout(() => {
          if (this.isPlayerNearby) this.showShipPopup();
        }, 800);
      }
    } else if (this.isPlayerNearby) {
      this.isPlayerNearby = false;
      if (this.uiTimer) {
        clearTimeout(this.uiTimer);
        this.uiTimer = null;
      }
      this.hideShipPopup();
    }
  }

  showShipPopup() {
    if (this.isUIOpen) return;
    if (this.shipPopup) return; // already visible
    // small popup with 'Arreglar la nave' and OK button
    this.shipPopup = document.createElement('div');
    this.shipPopup.id = 'ship-popup';
    this.shipPopup.style.cssText = `
      position: fixed; bottom: 20%; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.9); color: #fff; padding: 14px 18px; border: 2px solid #00aa00;
      border-radius: 8px; z-index: 999999; font-family: Arial, sans-serif; box-shadow: 0 0 20px rgba(0,255,0,0.2);
      display: flex; gap: 12px; align-items: center; pointer-events: auto;
    `;

    const text = document.createElement('div');
    text.textContent = 'Arreglar la nave';
    text.style.fontSize = '18px';
    text.style.fontWeight = '600';
    this.shipPopup.appendChild(text);

    const okBtn = document.createElement('button');
    okBtn.textContent = 'ok';
    okBtn.style.cssText = `
      padding: 8px 14px; background: #00aa00; color: #001100; border: none; border-radius: 6px; cursor: pointer; font-weight: 700;
    `;
    okBtn.addEventListener('click', () => {
      try { safePlaySfx('spaceshipRepair', { volume: 0.95 }); } catch(_) {}
      this.openShipHUD();
    });
    this.shipPopup.appendChild(okBtn);

  document.body.appendChild(this.shipPopup);
  // play popup sound when the ship popup appears
  try { safePlaySfx('popup', { volume: 0.9 }); } catch(_) {}
  }

  hideShipPopup() {
    if (this.shipPopup && this.shipPopup.parentNode) {
      this.shipPopup.parentNode.removeChild(this.shipPopup);
      this.shipPopup = null;
    }
  }

  openShipHUD() {
    if (this.isUIOpen) return;
    // Prepare state so referenced arrays exist during creation
    this.toolButtons = this.toolButtons || [];
    this.slotElements = this.slotElements || new Array(6).fill(null);
    // hide small popup first, then attempt to build HUD; only mark UI open after success
    this.hideShipPopup();
    let hudCreated = false;
    try {

    // Main HUD container (reduced dimensions)
    this.hud = document.createElement('div');
    this.hud.id = 'ship-hud';
    this.hud.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 640px;
      height: 360px;
      background: rgba(10,10,10,0.98);
      color: #fff;
      z-index: 1000000;
      border: 2px solid #17a717ff;
      border-radius: 6px;
      padding: 8px;
      box-sizing: border-box;
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    `;

    // Top bar: title centered, close button on the right
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      position: absolute;
      top: 10px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    const title = document.createElement('h2');
    title.textContent = 'Estado de la nave';
    title.style.cssText = `
      font-size: 22px;
      color: #169616ff;
      margin: 0;
      text-shadow: 0 0 8px rgba(127,255,127,0.3);
      font-weight: 600;
      padding: 0;
    `;
    topBar.appendChild(title);
    const topCloseBtn = document.createElement('button');
    topCloseBtn.textContent = '✕';
    topCloseBtn.style.cssText = `
      position: absolute;
      right: 12px;
      top: 0;
      padding: 6px 10px;
      background: #c94a4a;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 400;
      transition: background 0.2s;
    `;
    topCloseBtn.addEventListener('mouseenter', () => topCloseBtn.style.background = '#e05555');
    topCloseBtn.addEventListener('mouseleave', () => topCloseBtn.style.background = '#c94a4a');
    topCloseBtn.addEventListener('click', () => this.closeShipHUD());
    topBar.appendChild(topCloseBtn);
    this.hud.appendChild(topBar);

  // Center column will contain slots+progress; right column will be inventory list
    const centerCol = document.createElement('div');
    centerCol.style.cssText = `
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      justify-content: center;
      padding-top: 35px;
      padding-left: 12px;
      padding-bottom: 8px;
    `;

    // Prepare tool definitions and toolButtons so we can map persisted slot names to labels
    const toolDefs = [
      { inv: 'Llave Multiprop\u00f3sito', label: 'Llave' },
      { inv: 'Membrana de Vac\u00edo', label: 'Membrana' },
      { inv: 'Chip de Navegaci\u00f3n', label: 'Chip' },
      { inv: 'Catalizador de Plasma', label: 'Catalizador' },
      { inv: 'N\u00facleo de Fusi\u00f3n', label: 'N\u00facleo' },
      { inv: 'Cristal de Poder', label: 'Cristal' }
    ];
    this.toolButtons = [];
    // Top slots (1-3) - spaced a bit more
    const topRow = document.createElement('div');
    topRow.style.cssText = `
      display: flex;
      gap: 16px;
      margin-top: 4px;
      justify-content: flex-start;
      align-items: center;
    `;
    for (let i = 0; i < 3; i++) {
      const el = this.createSlotElement(i);
      topRow.appendChild(el);
      this.slotElements[i] = el;
    }
    centerCol.appendChild(topRow);

    // Progress bar (placed below top slots)
    const progressContainer = document.createElement('div');
    progressContainer.id = 'ship-progress-container';
    progressContainer.style.cssText = `
      width: 100%;
      max-width: 500px;
      height: 90px;
      background: rgba(255,255,255,0.04);
      border-radius: 6px;
      display: flex;
      align-items: stretch;
      position: relative;
      padding: 4px;
      box-sizing: border-box;
      margin-top: 6px;
      box-shadow: inset 0 1px 6px rgba(0,0,0,0.3);
    `;
    this.segments = [];
    for (let i = 0; i < 6; i++) {
      const seg = document.createElement('div');
      seg.className = 'ship-segment';
      seg.style.cssText = `flex:1; margin: 0 7px; border-radius: 5px; background: rgba(255,255,255,0.06); display:flex; align-items:flex-end; justify-content:center; position: relative; overflow: hidden;`;
      const fill = document.createElement('div');
      fill.style.cssText = `width:100%; height:0%; background: linear-gradient(180deg, #9cff9c, #00aa00); transition: height 300ms ease; box-shadow: 0 0 12px rgba(0,170,0,0.5);`;
      seg.appendChild(fill);
      this.segments.push(fill);
      progressContainer.appendChild(seg);
    }
    centerCol.appendChild(progressContainer);

    // Bottom slots (4-6)
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `display:flex; gap: 16px; margin-bottom:6px; margin-top:8px; justify-content:flex-start;`;
    for (let i = 3; i < 6; i++) {
      const el = this.createSlotElement(i);
      bottomRow.appendChild(el);
      this.slotElements[i] = el;
    }
    centerCol.appendChild(bottomRow);

    // Add help text below the bottom row
    const helpText = document.createElement('div');
    helpText.textContent = 'Arrastra la herramienta a los espacios vacíos';
    helpText.style.cssText = `
      color: #8f8f8f;
      font-size: 12px;
      text-align: center;
      margin-top: 10px;
      font-style: italic;
      width: 100%;
    `;
    centerCol.appendChild(helpText);

  this.hud.appendChild(centerCol);
  // Ensure progress shows persisted state
  this.updateProgress();

  // Right column: inventory list, positioned lower than the top close button and roughly mid-right
    const rightCol = document.createElement('div');
    rightCol.style.cssText = `width: 160px; display:flex; flex-direction:column; gap:8px; align-items:stretch; padding-top:45px;`;
    const invTitle = document.createElement('div');
    invTitle.textContent = 'INVENTARIO';
    invTitle.style.cssText = `font-weight:400; color:#fdbb2d; text-align:center; font-size: 13px;`;
    rightCol.appendChild(invTitle);

  // Tools listed as column on the right (toolDefs already declared above)
  this.toolButtons = [];
    const invList = document.createElement('div');
    invList.id = 'ship-inv-list';
    invList.style.cssText = `display:flex; flex-direction:column; gap:2px; max-height:260px; padding:3px; background: rgba(255,255,255,0.02); border-radius:4px;`;

    toolDefs.forEach((def) => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:3px; padding:4px 5px; border-radius:3px; cursor:pointer; font-size: 11px;`;
      const name = document.createElement('div');
      name.textContent = def.label;
      name.style.cssText = `font-weight:400; color:#e6ffe6;`;

      const badge = document.createElement('div');
      badge.textContent = '';
      badge.style.cssText = `min-width:10px; height:10px; border-radius:6px;`;

      row.appendChild(name);
      row.appendChild(badge);
      row.addEventListener('click', () => {
        if (this.selectedTool === def.inv) {
          this.selectedTool = null;
          row.style.outline = '';
        } else {
          this.selectedTool = def.inv;
          // clear outlines in this inv list only
          invList.querySelectorAll('div').forEach(d => d.style.outline = '');
          row.style.outline = '3px solid rgba(127,255,127,0.12)';
        }
      });

      row.addEventListener('dragstart', (e) => {
        try {
          e.dataTransfer.setData('text/plain', def.inv);
          e.dataTransfer.effectAllowed = 'move';
          const canvas = document.createElement('canvas');
          canvas.width = 140; canvas.height = 36;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.fillRect(0,0,canvas.width, canvas.height);
          ctx.fillStyle = '#cfffcc';
          ctx.font = 'bold 14px Arial';
          ctx.fillText(def.label, 8, 22);
          try { e.dataTransfer.setDragImage(canvas, 70, 18); } catch (err) {}
        } catch (err) {}
      });

      this.toolButtons.push({ inv: def.inv, label: def.label, row, badge });
      invList.appendChild(row);
    });

    rightCol.appendChild(invList);

    // After toolButtons created, render any persisted slot labels
    for (let i = 0; i < 6; i++) {
      const toolName = this.slots[i];
      const el = this.slotElements[i];
      if (toolName && el) {
        const label = (this.toolButtons.find(b => b.inv === toolName) || {}).label || toolName;
        el.textContent = label;
        el.style.background = 'linear-gradient(180deg, rgba(160,255,160,0.12), rgba(0,170,0,0.08))';
      }
    }

    // Add the right column to HUD (appears lower than top bar because of padding-top)
    this.hud.appendChild(rightCol);

    // initial color update from inventory
    this.refreshInventoryList();

    // If inventory exposes a callback, subscribe to keep list synced
    if (window.inventory && typeof window.inventory.onEquipChange !== 'undefined') {
      try {
        // store previous handler if present
        this._prevInvHandler = window.inventory.onEquipChange;
        window.inventory.onEquipChange = (index, tool) => {
          // call previous if existed
          if (typeof this._prevInvHandler === 'function') this._prevInvHandler(index, tool);
          this.refreshInventoryList();
        };
      } catch (e) {
        // ignore
      }
    }

    // Fallback: refrescar cada 1s si no hay callback
    if (!this._invInterval) this._invInterval = setInterval(() => this.refreshInventoryList(), 1000);

  document.body.appendChild(this.hud);
  // play popup sound when the ship HUD opens
  try { safePlaySfx('popup', { volume: 0.9 }); } catch(_) {}
  // start looping panel ambience for the ship HUD (kept while HUD is open)
  // Note: AudioManager.playSFX is async and returns a Promise — store the eventual
  // Audio instance so we can stop it later. Be defensive if playSFX isn't available.
  try {
    if (window.audio && typeof window.audio.playSFX === 'function') {
      try {
        // assign the Promise first; once resolved we keep the audio instance
        const p = window.audio.playSFX('spaceshipPanel', { loop: true, volume: 0.6 });
        // store promise/object; callers must handle both cases
        this._panelAudio = p;
        try { if (p && typeof p.then === 'function') p.then(a => { this._panelAudio = a; }).catch(() => { this._panelAudio = null; }); } catch(_) {}
      } catch (_) { this._panelAudio = null; }
    } else {
      this._panelAudio = null;
    }
  } catch (_) { this._panelAudio = null; }
    hudCreated = true;
    } catch (err) {
      // cleanup any partial DOM
      if (this.hud && this.hud.parentNode) try { this.hud.parentNode.removeChild(this.hud); } catch(e){}
      this.hud = null;
      // ensure intervals/handlers cleaned
      if (this._invInterval) { clearInterval(this._invInterval); this._invInterval = null; }
      // do not mark UI as open
      return;
    }

    // mark UI open after successful creation
    if (hudCreated) this.isUIOpen = true;
  }

  createSlotElement(index) {
    const slot = document.createElement('div');
    slot.className = 'ship-slot';
    slot.dataset.index = index;
    slot.style.cssText = `width:120px; height:70px; background: rgba(255,255,255,0.03); border:2px dashed rgba(127,255,127,0.12); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#cfefcc; font-weight:600; font-size:14px; transition: all 0.2s; box-shadow: inset 0 1px 4px rgba(0,0,0,0.2);`;
    slot.textContent = `Slot ${index + 1}`;

    slot.addEventListener('mouseenter', () => {
      if (!this.slots[index]) {
        slot.style.borderColor = 'rgba(127,255,127,0.3)';
        slot.style.background = 'rgba(255,255,255,0.05)';
      }
    });
    slot.addEventListener('mouseleave', () => {
      if (!this.slots[index]) {
        slot.style.borderColor = 'rgba(127,255,127,0.12)';
        slot.style.background = 'rgba(255,255,255,0.03)';
      }
    });

    // Click to assign selected tool
    slot.addEventListener('click', () => {
      if (this.selectedTool) {
        this.assignToolToSlot(index, this.selectedTool, slot);
      } else {
        // toggle remove
        if (this.slots[index]) {
          // return tool to inventory
          const returned = this.slots[index];
          this.slots[index] = null;
          slot.textContent = `Slot ${index + 1}`;
          slot.style.background = 'rgba(255,255,255,0.03)';
          // add back to inventory if space
          if (window.inventory && typeof window.inventory.addTool === 'function') {
            window.inventory.addTool(returned);
          }
          this.updateProgress();
          this.refreshInventoryList();
          this.saveState();
        }
      }
    });

    // Drag & Drop handlers
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.style.boxShadow = '0 6px 18px rgba(0,255,0,0.08)';
    });
    slot.addEventListener('dragleave', () => {
      slot.style.boxShadow = '';
    });
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.style.boxShadow = '';
      let toolName = null;
      try { toolName = e.dataTransfer.getData('text/plain'); } catch (err) { toolName = null; }
      // fallback: if selectedTool exists
      if (!toolName && this.selectedTool) toolName = this.selectedTool;
      if (!toolName) return;
      // Do not allow drop if slot already occupied
      if (this.slots[index]) return;
      // Only allow if tool is available in inventory
      const inv = window.inventory;
      const tools = inv ? (inv.getState ? inv.getState().tools : inv.tools) : [];
      const exists = !!tools.find(t => t === toolName);
      if (!exists) return; // cannot drop what you don't have
      this.assignToolToSlot(index, toolName, slot);
    });

    return slot;
  }

  assignToolToSlot(index, toolName, slotElement) {
    // consume tool from inventory if present
    const inv = window.inventory;
    let removed = false;
    if (inv) {
      // find index in inventory tools
      const stateTools = inv.getState ? inv.getState().tools : inv.tools;
      const invIndex = stateTools ? stateTools.findIndex(t => t === toolName) : -1;
      if (invIndex >= 0 && typeof inv.toggleSlot === 'function') {
        // remove from inventory by setting slot to null
        inv.tools[invIndex] = null;
        if (typeof inv._updateUI === 'function') try { inv._updateUI(); } catch(e){}
        removed = true;
      }
    }
  this.slots[index] = toolName; // store inventory name internally
  // display short label if available
  const label = (this.toolButtons.find(b => b.inv === toolName) || {}).label || toolName;
  slotElement.textContent = label;
    slotElement.style.background = 'linear-gradient(180deg, rgba(160,255,160,0.12), rgba(0,170,0,0.08))';
  this.updateProgress();
  this.refreshInventoryList();
  this.saveState();
    // animate segment and slot
    this.animateSegment(index);
    this.pulseSlot(slotElement);
    this.showToast(`${toolName} colocado en Slot ${index + 1}`);
    return removed;
  }

  // small toast in HUD for feedback
  showToast(msg, ms = 1400) {
    try {
      const t = document.createElement('div');
      t.className = 'ship-toast';
      t.textContent = msg;
      Object.assign(t.style, {
        position: 'fixed', left: '50%', top: '12%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '8px 12px', borderRadius: '6px', zIndex: 2000000,
        boxShadow: '0 6px 18px rgba(0,0,0,0.6)', fontFamily: 'Arial', fontSize: '13px'
      });
      document.body.appendChild(t);
      setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(-6px)'; }, ms-300);
      setTimeout(()=>{ if (t.parentNode) t.parentNode.removeChild(t); }, ms);
    } catch(e){}
  }

  animateSegment(index) {
    try {
      const seg = this.segments[index];
      if (!seg) return;
      seg.style.transform = 'scaleY(1.02)';
      seg.style.boxShadow = '0 6px 18px rgba(0,255,0,0.12)';
      setTimeout(()=>{ if(seg){ seg.style.transform=''; seg.style.boxShadow='inset 0 0 12px rgba(0,0,0,0.3)'; } }, 360);
    } catch(e){}
  }

  pulseSlot(slotElement) {
    try {
      slotElement.style.transition = 'transform 180ms ease';
      slotElement.style.transform = 'translateY(-6px)';
      setTimeout(()=>{ slotElement.style.transform = ''; }, 220);
    } catch(e){}
  }

  /**
   * Actualiza la lista de la derecha con colores (verde si está en el inventario, rojo si no)
   */
  refreshInventoryList() {
    try {
      const inv = window.inventory;
      const toolsInInv = inv ? (inv.getState ? inv.getState().tools : inv.tools) : [];
      // Normalize: array of strings or nulls
      for (const item of this.toolButtons) {
        // If this tool type is already assigned to any slot, mark it as used (strike/disable)
        const isAssigned = !!this.slots.find(s => s === item.inv);
        const countInInv = toolsInInv ? toolsInInv.filter(t => t === item.inv).length : 0;
        if (isAssigned) {
          // Mark as used/disabled regardless of inventory count
          item.badge.style.background = '#7a7a7a';
          item.row.style.background = 'rgba(120,120,120,0.04)';
          item.row.style.color = '#9b9b9b';
          // strike-through label
          if (item.row.firstChild) item.row.firstChild.style.textDecoration = 'line-through';
          item.row.setAttribute('draggable', 'false');
          item.row.style.pointerEvents = 'none';
          item.row.title = 'Herramienta ya usada en una ranura';
        } else if (countInInv > 0) {
          // available in inventory and not yet used
          item.badge.style.background = '#26a926';
          item.row.style.background = 'rgba(38,169,38,0.06)';
          item.row.style.color = '#cfffcc';
          if (item.row.firstChild) item.row.firstChild.style.textDecoration = '';
          item.row.setAttribute('draggable', 'true');
          item.row.style.pointerEvents = '';
          item.row.title = '';
        } else {
          // not present in inventory
          item.badge.style.background = '#b72b2b';
          item.row.style.background = 'rgba(180,43,43,0.04)';
          item.row.style.color = '#ffd6d6';
          if (item.row.firstChild) item.row.firstChild.style.textDecoration = '';
          item.row.setAttribute('draggable', 'false');
          item.row.style.pointerEvents = '';
          item.row.title = 'No disponible en inventario';
        }
      }
    } catch (e) {
      return e;
    }
  }

  updateProgress() {
    const filled = this.slots.filter(Boolean).length;
    // set each segment's height and color according to filled count
    for (let i = 0; i < 6; i++) {
      if (i < filled) {
        this.segments[i].style.height = '100%';
        const color = this.segmentColors[Math.min(i, this.segmentColors.length - 1)];
        this.segments[i].style.background = color;
      } else {
        this.segments[i].style.height = '0%';
        this.segments[i].style.background = 'transparent';
      }
    }
    // persist changes
    this.saveState();

    // If completed, trigger callback once
    if (filled === 6 && !this._repairCompleted) {
      this._repairCompleted = true;
      // default behavior: toast + optional reward
      try {
        if (typeof this.onRepairComplete === 'function') {
          try { this.onRepairComplete({ slots: this.slots.slice(), progress: filled }); } catch (e) { console.error('onRepairComplete error', e); }
        } else {
          this.showToast('¡Reparación completa!');
          // default: mark shuttle as repaired and give 200 coins if inventory exists
          if (window.spaceShuttle) window.spaceShuttle.repaired = true;
          if (window.inventory && typeof window.inventory.addCoins === 'function') {
            window.inventory.addCoins(200);
            window.inventory.notify?.('Reparación completa: recibiste 200 monedas');
          }
        }
      } catch (e) { return e}
      this.saveState();
    }
  }

  closeShipHUD() {
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
    // stop panel ambience audio if it was playing
    try {
      if (this._panelAudio) {
        // If it's a Promise (playSFX is async), wait for it to resolve then stop
        if (typeof this._panelAudio.then === 'function') {
          try { this._panelAudio.then(a => { try { if (a && a.isPlaying) a.stop(); } catch(_) { try { a.stop(); } catch(_) {} } }).catch(() => {}); } catch(_) {}
        } else {
          try { if (this._panelAudio.isPlaying) this._panelAudio.stop(); } catch(_) { try { this._panelAudio.stop(); } catch(_) {} }
        }
      }
    } catch(_) {}
    this._panelAudio = null;
    this.isUIOpen = false;
    this.selectedTool = null;
    // cleanup inventory interval and restore handler
    if (this._invInterval) {
      clearInterval(this._invInterval);
      this._invInterval = null;
    }
    if (window.inventory && typeof window.inventory.onEquipChange !== 'undefined') {
      try {
        window.inventory.onEquipChange = this._prevInvHandler || null;
      } catch (e) {}
    }
  }

  // Public method to reset the repair state (clears slots and progress)
  resetRepair() {
    this.slots = new Array(6).fill(null);
    this._repairCompleted = false;
    // update UI if open
    if (this.hud) {
      for (let i = 0; i < 6; i++) {
        const el = this.slotElements[i];
        if (el) {
          el.textContent = `Slot ${i+1}`;
          el.style.background = 'rgba(255,255,255,0.03)';
        }
      }
      this.updateProgress();
      this.refreshInventoryList();
    }
    this.saveState();
  }
}