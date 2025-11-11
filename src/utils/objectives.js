export class Objectives {
  constructor() {
    this.isExpanded = false;
    this.init();
  }
  init() {
    this.objectivesToggle = document.getElementById('objectives-toggle');
    this.objectivesClose = document.getElementById('objectives-close');
    this.objectivesHud = document.getElementById('objectives-hud');
    this.inventoryHud = document.getElementById('inventory-hud');
    this.minimapHud = document.getElementById('minimap-hud');
    this.inventoryToggle = document.getElementById('inventory-toggle');
    this.minimapToggle = document.getElementById('minimap-toggle');
    if (this.objectivesHud) {
      this.objectivesHud.classList.add('objectives-collapsed');
      this.objectivesHud.classList.remove('objectives-expanded');
      this.objectivesHud.style.display = 'block';
    }
    this.setupEventListeners();
  }
  setupEventListeners() {
    if (this.objectivesToggle) {
      this.objectivesToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isExpanded) {
          this.collapse();
        } else {
          this.expand();
        }
      });
    }
    if (this.objectivesClose) {
      this.objectivesClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.collapse();
      });
    }
    document.addEventListener('click', (e) => {
      if (this.isExpanded && 
          this.objectivesHud && 
          !this.objectivesHud.contains(e.target) && 
          this.objectivesToggle && 
          !this.objectivesToggle.contains(e.target)) {
        this.collapse();
      }
    });
  }
  expand() {
    if (!this.objectivesHud || !this.objectivesToggle || !this.objectivesClose) return;
    if (this.inventoryHud && this.inventoryHud.classList.contains('inventory-expanded')) {
      this.inventoryHud.classList.remove('inventory-expanded');
      this.inventoryHud.classList.add('inventory-collapsed');
      if (this.inventoryToggle) this.inventoryToggle.style.display = 'block';
    }
    if (this.minimapHud && this.minimapHud.classList.contains('minimap-expanded')) {
      this.minimapHud.classList.remove('minimap-expanded');
      this.minimapHud.classList.add('minimap-collapsed');
      if (this.minimapToggle) this.minimapToggle.style.display = 'block';
    }
    this.objectivesHud.style.display = 'block';
    this.objectivesHud.classList.remove('objectives-collapsed');
    this.objectivesHud.classList.add('objectives-expanded');
    this.objectivesToggle.style.display = 'none';
    this.objectivesClose.style.display = 'flex';
    this.isExpanded = true;
  }
  collapse() {
    if (!this.objectivesHud || !this.objectivesToggle || !this.objectivesClose) return;
    this.isExpanded = false;
    this.objectivesHud.classList.remove('objectives-expanded');
    this.objectivesHud.classList.add('objectives-collapsed');
    this.objectivesToggle.style.display = 'block';
    this.objectivesClose.style.display = 'none';
    this.isExpanded = false;
  }
  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }
}
let objectivesManager = null;
export function initObjectives() {
  if (!objectivesManager) {
    objectivesManager = new Objectives();
    window.ObjectivesManager = objectivesManager;
  }
  return objectivesManager;
}
export function collapseObjectives() {
  if (objectivesManager) {
    objectivesManager.collapse();
  }
}

export default initObjectives;
