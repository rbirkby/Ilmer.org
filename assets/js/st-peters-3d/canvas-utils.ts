// Shared helpers for the procedural canvas textures: a seeded random number generator, so every texture is drawn
// the same on every load, a canvas factory and the usual CanvasTexture set-up.
import * as THREE from 'three';

/**
 * Mulberry32: a small, fast seeded generator returning numbers in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} width
 * @param {number} height
 */
export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** 2D drawing context for a procedural texture. These maps are not drawn when a browser cannot provide one. */
export function canvas2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D;
export function canvas2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D;
export function canvas2d(
  canvas: HTMLCanvasElement | OffscreenCanvas
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

/**
 * A texture drawn from `canvas`. Colour maps are sRGB; pass `srgb: false` for bump, roughness and alpha maps.
 * Wrapping is left at clamp-to-edge unless `repeat` is given.
 * @param {HTMLCanvasElement} canvas
 * @param {{ srgb?: boolean, anisotropy?: number, repeat?: [number, number] }} [options]
 */
export function canvasTexture(
  canvas: HTMLCanvasElement,
  { srgb = true, anisotropy, repeat }: { srgb?: boolean; anisotropy?: number; repeat?: [number, number] } = {}
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (anisotropy !== undefined) texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
  }
  return texture;
}
