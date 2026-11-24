import type * as Three from 'three';
import { canvas2d } from './st-peters-3d/canvas-utils.ts';

// Wooden fingerposts where the road leaves the map, pointing to the next villages. Turnpike-era posts were
// white-painted oak with black capitals on a pointed arm.

/** Where each fingerpost stands: which end of the cart road and the village its arm points to. */
export const SIGNPOSTS = [
  { id: 'longwick', end: 'east', text: 'LONGWICK' },
  { id: 'towersey', end: 'west', text: 'TOWERSEY' }
];

export const POST_HEIGHT = 2.5;
export const ARM_LENGTH = 1.25;

/**
 * Stand the post on the verge beside the road end, clear of the road surface, with its arm pointing out along
 * the road.
 * @param end road end point [x, z]
 * @param inward a point a few metres back along the road [x, z]
 */
export function signpostPlacement(
  end: readonly number[],
  inward: readonly number[],
  onRoad: (x: number, z: number) => boolean
) {
  const length = Math.hypot(end[0] - inward[0], end[1] - inward[1]);
  if (!(length > 0)) throw new Error('Invalid signpost road direction');
  const out = [(end[0] - inward[0]) / length, (end[1] - inward[1]) / length];
  // The verge to the left of someone leaving the village
  const side = [out[1], -out[0]];
  for (let offset = 1; offset < 30; offset += 0.25) {
    const x = end[0] + side[0] * offset;
    const z = end[1] + side[1] * offset;
    if (!onRoad(x, z)) {
      const clear = offset + 0.9;
      return { x: end[0] + side[0] * clear, z: end[1] + side[1] * clear, heading: Math.atan2(out[1], out[0]) };
    }
  }
  throw new Error('No verge beside the road end for a signpost');
}

/** A white fingerpost whose arm, lettered with `text`, points along local +x. */
export function createFingerpost(THREE: typeof Three, text: string): Three.Group {
  const paint = new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.85 });
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, POST_HEIGHT, 0.13), paint);
  post.position.y = POST_HEIGHT / 2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 4), paint);
  cap.position.y = POST_HEIGHT + 0.06;
  cap.rotation.y = Math.PI / 4;
  group.add(post, cap);

  // A flat board with a pointed tip, lettered on both faces
  const width = 0.24;
  const shape = new THREE.Shape();
  shape.moveTo(0, -width / 2);
  shape.lineTo(ARM_LENGTH - 0.16, -width / 2);
  shape.lineTo(ARM_LENGTH, 0);
  shape.lineTo(ARM_LENGTH - 0.16, width / 2);
  shape.lineTo(0, width / 2);
  shape.closePath();
  const board = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }), paint);
  board.position.set(0.04, POST_HEIGHT - 0.32, -0.0175);
  group.add(board);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas2d(canvas)!;
  ctx.fillStyle = '#1b1a18';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4, canvas.width - 24);
  const lettering = new THREE.CanvasTexture(canvas);
  lettering.colorSpace = THREE.SRGBColorSpace;
  lettering.anisotropy = 4;
  const letters = new THREE.MeshStandardMaterial({
    map: lettering,
    transparent: true,
    roughness: 0.9,
    depthWrite: false
  });
  const plate = new THREE.PlaneGeometry(ARM_LENGTH - 0.3, 0.18);
  for (const face of [1, -1]) {
    const words = new THREE.Mesh(plate, letters);
    // The back face is turned round so it also reads left to right, not mirrored
    words.position.set(0.04 + (ARM_LENGTH - 0.16) / 2, POST_HEIGHT - 0.32, face * 0.019);
    if (face < 0) words.rotation.y = Math.PI;
    group.add(words);
  }
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true;
  });
  return group;
}
