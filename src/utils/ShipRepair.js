import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.module.js";

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
      this.openShipHUD();
    });
    this.shipPopup.appendChild(okBtn);

    document.body.appendChild(this.shipPopup);
  }

  hideShipPopup() {
    if (this.shipPopup && this.shipPopup.parentNode) {
      this.shipPopup.parentNode.removeChild(this.shipPopup);
      this.shipPopup = null;
    }
  }

  openShipHUD() {
    if (this.isUIOpen) return;
    this.isUIOpen = true;
    this.hideShipPopup();

    // Main HUD container (reduced dimensions)
    this.hud = document.createElement('div');
    this.hud.id = 'ship-hud';
    this.hud.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 1100px; height: 640px; background: rgba(10,10,10,0.98); color: #fff; z-index: 1000000;
      border: 3px solid #1fbf1f; border-radius: 8px; padding: 14px; box-sizing: border-box; font-family: Arial, sans-serif;
      display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 14px;
    `;

    // Top bar: title centered, close button on the right
    const topBar = document.createElement('div');
    topBar.style.cssText = `position:absolute; top:20px; left:0; right:0; display:flex; align-items:center; justify-content:center;`;
    const title = document.createElement('h2');
    title.textContent = 'Estado de la nave';
    title.style.cssText = `font-size: 28px; color: #7fff7f; margin: 0; text-shadow: 0 0 12px rgba(127,255,127,0.3); font-weight: 700;`;
    topBar.appendChild(title);
    const topCloseBtn = document.createElement('button');
    topCloseBtn.textContent = '✕';
    topCloseBtn.style.cssText = `position:absolute; right:20px; top:0; padding:10px 16px; background:#c94a4a; color:white; border:none; border-radius:6px; cursor:pointer; font-size:18px; font-weight:700; transition: background 0.2s;`;
    topCloseBtn.addEventListener('mouseenter', () => topCloseBtn.style.background = '#e05555');
    topCloseBtn.addEventListener('mouseleave', () => topCloseBtn.style.background = '#c94a4a');
    topCloseBtn.addEventListener('click', () => this.closeShipHUD());
    topBar.appendChild(topCloseBtn);
    this.hud.appendChild(topBar);

    // Center column will contain slots+progress; right column will be inventory list
    const centerCol = document.createElement('div');
    centerCol.style.cssText = `flex: 1 1 65%; display:flex; flex-direction:column; align-items:flex-start; gap:24px; justify-content:center; padding-top:80px; padding-left:40px;`;

    // Top slots (1-3) - spaced a bit more
    const topRow = document.createElement('div');
    topRow.style.cssText = `display:flex; gap: 40px; margin-top:20px; justify-content:flex-start;`;
    for (let i = 0; i < 3; i++) topRow.appendChild(this.createSlotElement(i));
    centerCol.appendChild(topRow);

    // Progress bar (placed below top slots)
    const progressContainer = document.createElement('div');
    progressContainer.id = 'ship-progress-container';
    progressContainer.style.cssText = `width: 100%; max-width:660px; height: 110px; background: rgba(255,255,255,0.04); border-radius: 8px; display:flex; align-items:stretch; position: relative; padding: 8px; box-sizing: border-box; margin-top:8px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.3);`;
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
    bottomRow.style.cssText = `display:flex; gap: 40px; margin-bottom:10px; margin-top:8px; justify-content:flex-start;`;
    for (let i = 3; i < 6; i++) bottomRow.appendChild(this.createSlotElement(i));
    centerCol.appendChild(bottomRow);

    this.hud.appendChild(centerCol);

    // Right column: inventory list, positioned lower than the top close button and roughly mid-right
    const rightCol = document.createElement('div');
    rightCol.style.cssText = `width: 220px; display:flex; flex-direction:column; gap:12px; align-items:stretch; padding-top:140px;`;
    const invTitle = document.createElement('div');
    invTitle.textContent = 'INVENTARIO';
    invTitle.style.cssText = `font-weight:700; color:#fdbb2d; text-align:center;`;
    rightCol.appendChild(invTitle);

    const invList = document.createElement('div');
    invList.id = 'ship-inv-list';
    invList.style.cssText = `display:flex; flex-direction:column; gap:8px; max-height:420px; overflow:auto; padding:6px; background: rgba(255,255,255,0.02); border-radius:6px;`;

    // Tools listed as column on the right
    this.toolButtons = [];
    const tools = ['Llave', 'Soldador', 'Catalizador', 'Membrana', 'Chip', 'Cristal'];
    tools.forEach((t) => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px; border-radius:6px; cursor:pointer;`;
      const name = document.createElement('div');
      name.textContent = t;
      name.style.cssText = `font-weight:600; color:#e6ffe6;`;

      const badge = document.createElement('div');
      badge.textContent = ''; // will show availability
      badge.style.cssText = `min-width:18px; height:18px; border-radius:8px;`;

      row.appendChild(name);
      row.appendChild(badge);
      row.addEventListener('click', () => {
        // select/unselect
        if (this.selectedTool === t) {
          this.selectedTool = null;
          row.style.outline = '';
        } else {
          this.selectedTool = t;
          document.querySelectorAll('#ship-inv-list div').forEach(d => d.style.outline='');
          row.style.outline = '3px solid rgba(127,255,127,0.12)';
        }
      });

      this.toolButtons.push({ name: t, row, badge });
      invList.appendChild(row);
    });

    rightCol.appendChild(invList);

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
  }

  createSlotElement(index) {
    const slot = document.createElement('div');
    slot.className = 'ship-slot';
    slot.dataset.index = index;
    slot.style.cssText = `width:165px; height:85px; background: rgba(255,255,255,0.03); border:2px dashed rgba(127,255,127,0.12); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#cfefcc; font-weight:600; font-size:16px; transition: all 0.2s; box-shadow: inset 0 1px 4px rgba(0,0,0,0.2);`;
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

    slot.addEventListener('click', () => {
      if (this.selectedTool) {
        this.assignToolToSlot(index, this.selectedTool, slot);
      } else {
        // toggle remove
        if (this.slots[index]) {
          this.slots[index] = null;
          slot.textContent = `Slot ${index + 1}`;
          slot.style.background = 'rgba(255,255,255,0.03)';
          this.updateProgress();
          this.refreshInventoryList();
        }
      }
    });

    return slot;
  }

  assignToolToSlot(index, toolName, slotElement) {
    this.slots[index] = toolName;
    slotElement.textContent = toolName;
    slotElement.style.background = 'linear-gradient(180deg, rgba(160,255,160,0.12), rgba(0,170,0,0.08))';
    this.updateProgress();
    this.refreshInventoryList();
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
        const exists = !!toolsInInv.find(t => t === item.name);
        if (exists) {
          item.badge.style.background = '#26a926';
          item.row.style.background = 'rgba(38,169,38,0.06)';
          item.row.style.color = '#cfffcc';
        } else {
          item.badge.style.background = '#b72b2b';
          item.row.style.background = 'rgba(180,43,43,0.04)';
          item.row.style.color = '#ffd6d6';
        }
      }
    } catch (e) {
      console.warn('No se pudo actualizar la lista de inventario:', e);
    }
  }

  updateProgress() {
    const filled = this.slots.filter(Boolean).length;
    // distribute fill across 6 segments evenly
    for (let i = 0; i < 6; i++) {
      if (i < filled) {
        this.segments[i].style.height = '100%';
      } else {
        this.segments[i].style.height = '0%';
      }
    }
  }

  closeShipHUD() {
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
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
}