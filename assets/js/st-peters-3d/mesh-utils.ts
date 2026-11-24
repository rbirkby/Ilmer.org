// Small helpers for the many simple box meshes that make up the church model.
import * as THREE from 'three';

type Vec3Tuple = [number, number, number];
type ShadowFlags = { cast?: boolean; receive?: boolean };
type MaterialArg = THREE.Material | THREE.Material[];

/**
 * A box mesh of the given size, placed at `position`, casting and receiving shadows as asked.
 * @param size width (x), height (y) and depth (z) in metres
 */
export function boxMesh(
  [width, height, depth]: Vec3Tuple,
  material: MaterialArg,
  [x, y, z]: Vec3Tuple = [0, 0, 0],
  { cast = false, receive = false }: ShadowFlags = {}
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Makes a box mesh with {@link boxMesh} and adds it to `parent`. */
export function addBox(
  parent: THREE.Object3D,
  size: Vec3Tuple,
  material: MaterialArg,
  position?: Vec3Tuple,
  shadows?: ShadowFlags
): THREE.Mesh {
  const mesh = boxMesh(size, material, position, shadows);
  parent.add(mesh);
  return mesh;
}
