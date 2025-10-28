import { worldToMinimap as coordsWorldToMinimap } from "./coords.js";

export function makeMinimap({ width = 340, height = 249, worldBounds } = {}) {
  let canvas = null;
  let ctx = null;
  let isMinimapExpanded = false;
  let refs = {
    stones: [],
    house: null,
    spaceShuttle: null,
    corral: null,
    cows: [],
    farmerController: null,
  };

  function init(canvasId = "minimap-canvas") {
    canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error("No se encontró el canvas del minimap (id: " + canvasId + ")");
      return;
    }
    ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;

    const minimapToggle = document.getElementById("minimap-toggle");
    const minimapClose = document.getElementById("minimap-close");
    const minimap = document.getElementById("minimap");

    function collapseMinimap() {
      if (!minimap) return;
      minimap.classList.remove("minimap-expanded");
      minimap.classList.add("minimap-collapsed");
      if (minimapToggle) minimapToggle.classList.remove("hidden");
      isMinimapExpanded = false;
    }

    function expandMinimap() {
      if (!minimap) return;
      minimap.classList.remove("minimap-collapsed");
      minimap.classList.add("minimap-expanded");
      if (minimapToggle) minimapToggle.classList.add("hidden");
      isMinimapExpanded = true;
    }

    if (minimapToggle) {
      minimapToggle.addEventListener("click", () => expandMinimap());
    }
    if (minimapClose) {
      minimapClose.addEventListener("click", () => collapseMinimap());
    }

    console.log("✅ Minimap inicializado (modular)");
  }

  function setReferences(newRefs = {}) {
    refs = Object.assign(refs, newRefs);
  }

  function worldToMinimap(x, z) {
    return coordsWorldToMinimap(x, z, worldBounds, width, height);
  }

  function update() {
    if (!ctx || !canvas) return;

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
    if (refs.stones && refs.stones.length) {
      refs.stones.forEach((stone) => {
        if (stone.model) {
          const pos = stone.model.position;
          const minimapPos = worldToMinimap(pos.x, pos.z);
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
    if (refs.house && refs.house.position) {
      const minimapPos = worldToMinimap(refs.house.position.x, refs.house.position.z);
      ctx.fillStyle = "rgba(139, 69, 19, 0.5)";
      ctx.fillRect(minimapPos.x - 3, minimapPos.y - 3, 6, 6);
    }

    // Space Shuttle
    if (refs.spaceShuttle && refs.spaceShuttle.model) {
      const pos = refs.spaceShuttle.model.position;
      const minimapPos = worldToMinimap(pos.x, pos.z);
      ctx.fillStyle = "rgba(192, 192, 192, 0.7)";
      ctx.beginPath();
      ctx.arc(minimapPos.x, minimapPos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mercado (dibujar como un cuadrado púrpura)
    if (refs.market && refs.market.position) {
      const minimapPos = worldToMinimap(refs.market.position.x, refs.market.position.z);
      ctx.fillStyle = "rgba(153, 102, 204, 0.9)"; // púrpura
      const s = 5; // tamaño del icono del mercado
      ctx.fillRect(minimapPos.x - s/2, minimapPos.y - s/2, s, s);
      // opcion: contorno
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(minimapPos.x - s/2, minimapPos.y - s/2, s, s);
    }

    // Corral
    if (refs.corral && refs.corral.position) {
      const minimapPos = worldToMinimap(refs.corral.position.x, refs.corral.position.z);
      const size = 20;
      const sizeX = (size / (worldBounds.maxX - worldBounds.minX)) * width;
      const sizeZ = (size / (worldBounds.maxZ - worldBounds.minZ)) * height;
      ctx.strokeStyle = "rgba(139, 69, 19, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(minimapPos.x - sizeX / 2, minimapPos.y - sizeZ / 2, sizeX, sizeZ);
    }

    // Vacas
    if (refs.cows && refs.cows.length) {
      refs.cows.forEach((cow) => {
        if (cow.model) {
          const pos = cow.model.position;
          const minimapPos = worldToMinimap(pos.x, pos.z);
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.beginPath();
          ctx.arc(minimapPos.x, minimapPos.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Farmer
    if (refs.farmerController && refs.farmerController.model) {
      const pos = refs.farmerController.model.position;
      const minimapPos = worldToMinimap(pos.x, pos.z);

      ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
      ctx.save();
      ctx.translate(minimapPos.x, minimapPos.y);
      const farmerRotation = refs.farmerController.model.rotation.y || 0;
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

  return {
    init,
    setReferences,
    update,
    worldToMinimap,
  };
}
