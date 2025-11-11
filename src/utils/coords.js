export function worldToMinimap(x, z, worldBounds, minimapWidth, minimapHeight) {
  const normalizedX = (x - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX);
  const normalizedZ = (z - worldBounds.minZ) / (worldBounds.maxZ - worldBounds.minZ);

  const minimapX = normalizedX * minimapWidth;
  const minimapY = normalizedZ * minimapHeight;

  return { x: minimapX, y: minimapY };
}
