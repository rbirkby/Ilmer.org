import { terrainHeight } from './ilmer-terrain.ts';

export const cameraGroundClearance = 1.2;

export function cameraFloor(terrain: any, x: any, z: any) {
  const clampedX = Math.max(-terrain.width / 2, Math.min(terrain.width / 2, x));
  const clampedZ = Math.max(-terrain.depth / 2, Math.min(terrain.depth / 2, z));
  return terrainHeight(terrain, clampedX, clampedZ) + cameraGroundClearance;
}
