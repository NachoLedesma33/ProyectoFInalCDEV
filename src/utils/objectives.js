/**
 * Módulo para manejar el HUD de objetivos del juego
 */

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

    // Asegurarse de que el HUD de objetivos empiece cerrado
    if (this.objectivesHud) {
      this.objectivesHud.classList.add('objectives-collapsed');
      this.objectivesHud.classList.remove('objectives-expanded');
      this.objectivesHud.style.display = 'block';
    }

    // Asignar manejadores de eventos
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Toggle del botón de objetivos
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

    // Botón de cierre
    if (this.objectivesClose) {
      this.objectivesClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.collapse();
      });
    }

    // Cerrar al hacer clic fuera del HUD
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
    
    // Cerrar otros HUDs si están abiertos
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
    
    // Mostrar el HUD de objetivos
    this.objectivesHud.style.display = 'block';
    this.objectivesHud.classList.remove('objectives-collapsed');
    this.objectivesHud.classList.add('objectives-expanded');
    
    // Ocultar el botón de toggle y mostrar el de cierre
    this.objectivesToggle.style.display = 'none';
    this.objectivesClose.style.display = 'flex';
    
    this.isExpanded = true;
  }

  collapse() {
    if (!this.objectivesHud || !this.objectivesToggle || !this.objectivesClose) return;
    
    this.isExpanded = false;
    this.objectivesHud.classList.remove('objectives-expanded');
    this.objectivesHud.classList.add('objectives-collapsed');
    
    // Mostrar el botón de toggle y ocultar el de cierre
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

// Inicialización automática al cargar el módulo
let objectivesManager = null;

export function initObjectives() {
  if (!objectivesManager) {
    objectivesManager = new Objectives();
    
    // Hacer que el gestor de objetivos esté disponible globalmente
    // para que otros módulos puedan acceder a él
    window.ObjectivesManager = objectivesManager;
  }
  return objectivesManager;
}

// Función para que otros módulos puedan colapsar el panel de objetivos
export function collapseObjectives() {
  if (objectivesManager) {
    objectivesManager.collapse();
  }
}

export default initObjectives;
