import { worldToMinimap as coordsWorldToMinimap } from "./coords.js";

export class Minimap {
  constructor({ width = 340, height = 249, worldBounds } = {}) {
    this.width = width;
    this.height = height;
    this.worldBounds = worldBounds;
    this.canvas = null;
    this.ctx = null;
    this.isMinimapExpanded = false;
    this.refs = {
      stones: [],
      house: null,
      spaceShuttle: null,
      corral: null,
      cows: [],
      farmerController: null,
    };
  }

  init(canvasId = "minimap-canvas") {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error("No se encontró el canvas del minimap (id: " + canvasId + ")");
      return;
    }
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const minimapToggle = document.getElementById("minimap-toggle");
    const minimapClose = document.getElementById("minimap-close");
    const minimap = document.getElementById("minimap");

    const collapseMinimap = () => {
      if (!minimap) return;
      minimap.classList.remove("minimap-expanded");
      minimap.classList.add("minimap-collapsed");
      if (minimapToggle) minimapToggle.classList.remove("hidden");
      this.isMinimapExpanded = false;
    };

    const expandMinimap = () => {
      if (!minimap) return;
      minimap.classList.remove("minimap-collapsed");
      minimap.classList.add("minimap-expanded");
      if (minimapToggle) minimapToggle.classList.add("hidden");
      this.isMinimapExpanded = true;
    };

    if (minimapToggle) {
      minimapToggle.addEventListener("click", () => expandMinimap());
    }
    if (minimapClose) {
      minimapClose.addEventListener("click", () => collapseMinimap());
    }

    console.log("✅ Minimap inicializado (clase)");
  }

  setReferences(newRefs = {}) {
    this.refs = Object.assign(this.refs, newRefs);
  }

  worldToMinimap(x, z) {
    return coordsWorldToMinimap(x, z, this.worldBounds, this.width, this.height);
  }

  update() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const width = this.width;
    const height = this.height;
    const worldBounds = this.worldBounds;

    // Fondo sutil
    ctx.fillStyle = "rgba(25, 25, 25, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Cuadrícula
    ctx.strokeStyle = "rgba(255, 255, 255, 0.01)";
    ctx.lineWidth = 0.3;

    for (let x = worldBounds.minX; x <= worldBounds.maxX; x += 50) {
      const minimapX = ((x - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX)) * width;
      ctx.beginPath();
      ctx.moveTo(minimapX, 0);
      ctx.lineTo(minimapX, height);
      ctx.stroke();
    }
    for (let z = worldBounds.minZ; z <= worldBounds.maxZ; z += 50) {
      const minimapY = ((z - worldBounds.minZ) / (worldBounds.maxZ - worldBounds.minZ)) * height;
      ctx.beginPath();
      ctx.moveTo(0, minimapY);
      ctx.lineTo(width, minimapY);
      ctx.stroke();
    }

    // Dibujar piedras
    if (this.refs.stones && this.refs.stones.length) {
      this.refs.stones.forEach((stone) => {
        if (stone.model) {
          const pos = stone.model.position;
          const minimapPos = this.worldToMinimap(pos.x, pos.z);
          if (
            minimapPos.x >= 0 &&
            minimapPos.x <= width &&
            minimapPos.y >= 0 &&
            minimapPos.y <= height
          ) {
            ctx.fillStyle = "rgba(139, 69, 19, 0.6)";
            ctx.beginPath();
            ctx.arc(minimapPos.x, minimapPos.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    // Casa
    if (this.refs.house && this.refs.house.position) {
      const minimapPos = this.worldToMinimap(this.refs.house.position.x, this.refs.house.position.z);
      ctx.fillStyle = "rgba(139, 69, 19, 0.5)";
      ctx.fillRect(minimapPos.x - 3, minimapPos.y - 3, 6, 6);
    }

    // Space Shuttle
    if (this.refs.spaceShuttle && this.refs.spaceShuttle.model) {
      const pos = this.refs.spaceShuttle.model.position;
      const minimapPos = this.worldToMinimap(pos.x, pos.z);
      ctx.fillStyle = "rgba(192, 192, 192, 0.7)";
      ctx.beginPath();
      ctx.arc(minimapPos.x, minimapPos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mercado (dibujar como un cuadrado púrpura)
    if (this.refs.market && this.refs.market.position) {
      const minimapPos = this.worldToMinimap(this.refs.market.position.x, this.refs.market.position.z);
      ctx.fillStyle = "rgba(153, 102, 204, 0.9)"; // púrpura
      const s = 5; // tamaño del icono del mercado
      ctx.fillRect(minimapPos.x - s/2, minimapPos.y - s/2, s, s);
      // opcion: contorno
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(minimapPos.x - s/2, minimapPos.y - s/2, s, s);
    }

    // Corral
    if (this.refs.corral && this.refs.corral.position) {
      const minimapPos = this.worldToMinimap(this.refs.corral.position.x, this.refs.corral.position.z);
      const size = 20;
      const sizeX = (size / (worldBounds.maxX - worldBounds.minX)) * width;
      const sizeZ = (size / (worldBounds.maxZ - worldBounds.minZ)) * height;
      ctx.strokeStyle = "rgba(139, 69, 19, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(minimapPos.x - sizeX / 2, minimapPos.y - sizeZ / 2, sizeX, sizeZ);
    }

    // Vacas
    if (this.refs.cows && this.refs.cows.length) {
      this.refs.cows.forEach((cow) => {
        if (cow.model) {
          const pos = cow.model.position;
          const minimapPos = this.worldToMinimap(pos.x, pos.z);
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.beginPath();
          ctx.arc(minimapPos.x, minimapPos.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Enemigos (puntos rojos)
    if (this.refs.enemies && this.refs.enemies.length) {
      this.refs.enemies.forEach((enemy) => {
        try {
          let pos = null;
          if (!enemy) return;
          // enemy may be a model or an object with .model
          if (enemy.position) pos = enemy.position;
          else if (enemy.model && enemy.model.position) pos = enemy.model.position;
          else if (enemy.instance && enemy.instance.model && enemy.instance.model.position) pos = enemy.instance.model.position;
          if (!pos) return;
          const minimapPos = this.worldToMinimap(pos.x, pos.z);
          if (
            minimapPos.x >= 0 &&
            minimapPos.x <= width &&
            minimapPos.y >= 0 &&
            minimapPos.y <= height
          ) {
            ctx.fillStyle = "rgba(255, 50, 50, 0.95)"; // rojo fuerte
            ctx.beginPath();
            ctx.arc(minimapPos.x, minimapPos.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } catch (e) {
          // ignore drawing errors for single enemies
        }
      });
    }

    // Farmer
    if (this.refs.farmerController && this.refs.farmerController.model) {
      const pos = this.refs.farmerController.model.position;
      const minimapPos = this.worldToMinimap(pos.x, pos.z);

      ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
      ctx.save();
      ctx.translate(minimapPos.x, minimapPos.y);
      const farmerRotation = this.refs.farmerController.model.rotation.y || 0;
      ctx.rotate(farmerRotation + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-3, 3);
      ctx.lineTo(3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

// Keep the factory function name for backward compatibility
export function makeMinimap(opts = {}) {
  return new Minimap(opts);
}

export default makeMinimap;
