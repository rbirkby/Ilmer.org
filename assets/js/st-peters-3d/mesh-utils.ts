// Small helpers for the many simple box meshes that make up the church model.
import * as THREE from 'three';

/** @typedef {[number, number, number]} Vec3Tuple */
/** @typedef {{ cast?: boolean, receive?: boolean }} ShadowFlags */

/**
 * A box mesh of the given size, placed at `position`, casting and receiving shadows as asked.
 * @param {Vec3Tuple} size width (x), height (y) and depth (z) in metres
 * @param {THREE.Material | THREE.Material[]} material
 * @param {Vec3Tuple} [position]
 * @param {ShadowFlags} [shadows]
 */
export function boxMesh(
  [width, height, depth],
  material,
  [x, y, z] = [0, 0, 0],
  { cast = false, receive = false } = {}
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Makes a box mesh with {@link boxMesh} and adds it to `parent`.
 * @param {THREE.Object3D} parent
 * @param {Vec3Tuple} size
 * @param {THREE.Material | THREE.Material[]} material
 * @param {Vec3Tuple} [position]
 * @param {ShadowFlags} [shadows]
 */
export function addBox(parent, size, material, position?, shadows?) {
  const mesh = boxMesh(size, material, position, shadows);
  parent.add(mesh);
  return mesh;
}
