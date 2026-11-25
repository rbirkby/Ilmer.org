// Shared helpers for the procedural canvas textures: a seeded random number generator, so every texture is drawn
// the same on every load, a canvas factory, CanvasTexture set-up and CPU backing-store release after GPU upload.
import * as THREE from 'three';

const pendingCanvasReleases = new Set<THREE.CanvasTexture>();

export type CanvasTextureOptions = {
  srgb?: boolean;
  anisotropy?: number;
  repeat?: [number, number];
  /** Keep the backing `<canvas>` intact after GPU upload (needed when the canvas is redrawn or read later). */
  retainBacking?: boolean;
};

export type CanvasPairOptions = {
  anisotropy?: number;
  repeat?: [number, number];
  retainBacking?: boolean;
};

/** Mulberry32: a small, fast seeded generator returning numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
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

/** Register a static CanvasTexture (e.g. a cloned texture sharing a canvas) so its backing `<canvas>` is released. */
export function registerStaticCanvasTexture<T extends THREE.CanvasTexture>(texture: T): T {
  pendingCanvasReleases.add(texture);
  return texture;
}

/**
 * A texture drawn from `canvas`. Colour maps are sRGB; pass `srgb: false` for bump, roughness and alpha maps.
 * Wrapping is left at clamp-to-edge unless `repeat` is given. Static textures are registered so
 * `releaseCanvasBackingStores(renderer)` can upload them and shrink the `<canvas>` to 0×0.
 */
export function canvasTexture(
  canvas: HTMLCanvasElement,
  { srgb = true, anisotropy, repeat, retainBacking = false }: CanvasTextureOptions = {}
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (anisotropy !== undefined) texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
  }
  if (!retainBacking) pendingCanvasReleases.add(texture);
  return texture;
}

/** Build a paired colour + bump CanvasTexture set from a single seeded drawing callback. */
export function createCanvasPair(
  width: number,
  height: number,
  seed: number,
  draw: (ctx: CanvasRenderingContext2D, bctx: CanvasRenderingContext2D, rng: () => number) => void,
  { anisotropy = 8, repeat, retainBacking = false }: CanvasPairOptions = {}
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const col = makeCanvas(width, height);
  const bmp = makeCanvas(width, height);
  draw(canvas2d(col), canvas2d(bmp), mulberry32(seed));
  return {
    map: canvasTexture(col, { anisotropy, repeat, retainBacking }),
    bumpMap: canvasTexture(bmp, { srgb: false, anisotropy, repeat, retainBacking })
  };
}

/**
 * Upload all pending static CanvasTextures to WebGL and shrink their backing `<canvas>` elements to 0×0
 * to reclaim CPU pixel buffers once the GPU owns the texture data.
 * Runs in two passes so cloned textures sharing a single `<canvas>` all upload before the canvas is cleared.
 */
export function releaseCanvasBackingStores(renderer: Pick<THREE.WebGLRenderer, 'initTexture'>): number {
  if (pendingCanvasReleases.size === 0) return 0;
  const textures = [...pendingCanvasReleases];
  pendingCanvasReleases.clear();
  for (const tex of textures) {
    renderer.initTexture(tex);
  }
  let released = 0;
  const cleared = new Set<HTMLCanvasElement>();
  for (const tex of textures) {
    const img = tex.image as unknown;
    if (
      img &&
      typeof img === 'object' &&
      'width' in img &&
      'height' in img &&
      'getContext' in img &&
      !cleared.has(img as HTMLCanvasElement)
    ) {
      const canvas = img as HTMLCanvasElement;
      canvas.width = 0;
      canvas.height = 0;
      cleared.add(canvas);
      released++;
    }
  }
  return released;
}
