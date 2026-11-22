import * as THREE from 'three';

// Static-mesh merging: thousands of small meshes (pew boards, stones, mouldings, memorial kerbs...) each cost a draw
// call, and again in the shadow pass. After the scene is built, meshes that never move relative to their nearest
// "container" and share a material are baked into one mesh per (container, material, shadow flags, ~4m cell).
//
// A container is the group a merged mesh is parented to, so it still follows that container's visibility and
// movement. Containers are: the roots passed in, anything carrying userData (era-tagged groups, memorials, bells,
// bell ropes, hymn boards, stained glass...), and anything the caller marks as dynamic (door pivots, organ keys...).
//
// The original meshes stay in the scene, hidden, so raycasting (gravestones, bells, hymn board) still hits them
// exactly as before; hidden objects cost the renderer nothing.

const CELL = 4; // metres: keeps merged meshes small enough for frustum culling to still do useful work
const BASE_BEFORE_RENDER = THREE.Object3D.prototype.onBeforeRender;

function hasUserData(o) {
  for (const _ in o.userData) return true;
  return false;
}

function attributeSignature(geo) {
  const parts = [];
  for (const name of Object.keys(geo.attributes).sort()) {
    const a = geo.attributes[name];
    if (a.isInterleavedBufferAttribute) return null;
    parts.push(`${name}:${a.itemSize}:${a.array.constructor.name}:${a.normalized}`);
  }
  return parts.join(',');
}

function isMergeable(mesh) {
  // InstancedMesh & BatchedMesh report type 'Mesh' too: they draw many copies from per-instance matrices, which
  // baking would throw away (the hymn-book piles became one giant spine each)
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isBatchedMesh || mesh.isSkinnedMesh) return false;
  if (Array.isArray(mesh.material) || !mesh.material || !mesh.material.visible) return false;
  // Sorted blending is per object: merging transparent meshes could change how they overlap
  if (mesh.material.transparent) return false;
  if (mesh.onBeforeRender !== BASE_BEFORE_RENDER || mesh.customDepthMaterial || mesh.customDistanceMaterial) {
    return false;
  }
  const geo = mesh.geometry;
  if (!geo?.isBufferGeometry || !geo.attributes.position) return false;
  // (Box & cylinder geometries carry material groups; with a single material they are irrelevant)
  if (Object.keys(geo.morphAttributes).length > 0) return false;
  if (geo.drawRange.start !== 0 || geo.drawRange.count !== Infinity) return false;
  return attributeSignature(geo) !== null;
}

/**
 * Merge static meshes under each root into a few large meshes.
 * @param {THREE.Object3D[]} roots groups to merge within (each is its own container)
 * @param {{ dynamic?: Set<THREE.Object3D> }} [options] objects that move at run time; each becomes a container
 * @returns {{ before: number, after: number, merged: number }} mesh counts, for the stats overlay
 */
export function mergeStaticMeshes(roots, { dynamic = new Set() } = {}) {
  const isContainer = (o, root) => o === root || dynamic.has(o) || hasUserData(o);
  /** @type {Map<string, { container: THREE.Object3D, meshes: THREE.Mesh[] }>} */
  const buckets = new Map();
  let before = 0;

  for (const root of roots) {
    root.updateMatrixWorld(true);
    const walk = (obj, container, shown) => {
      for (const child of obj.children) {
        const childContainer = isContainer(child, root) ? child : container;
        // Visibility below the container must be static & on; the container's own visibility can change freely
        const childShown = childContainer === child ? true : shown && child.visible;
        if (child.isMesh) before++;
        if (child.isMesh && childContainer !== child && childShown && isMergeable(child)) {
          const geo = child.geometry;
          const c = new THREE.Vector3();
          if (!geo.boundingSphere) geo.computeBoundingSphere();
          c.copy(geo.boundingSphere.center).applyMatrix4(child.matrixWorld);
          const cell = `${Math.floor(c.x / CELL)},${Math.floor(c.y / CELL)},${Math.floor(c.z / CELL)}`;
          const key = [
            container.id,
            child.material.id,
            child.castShadow,
            child.receiveShadow,
            child.renderOrder,
            child.layers.mask,
            attributeSignature(geo),
            cell
          ].join('|');
          let b = buckets.get(key);
          if (!b) buckets.set(key, (b = { container, meshes: [] }));
          b.meshes.push(child);
        }
        walk(child, childContainer, childShown);
      }
    };
    walk(root, root, true);
  }

  let merged = 0;
  let added = 0;
  const toLocal = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();

  for (const { container, meshes } of buckets.values()) {
    if (meshes.length < 2) continue;
    toLocal.copy(container.matrixWorld).invert();
    const first = meshes[0].geometry;
    const names = Object.keys(first.attributes);
    let vertexCount = 0;
    let indexCount = 0;
    for (const mesh of meshes) {
      const g = mesh.geometry;
      vertexCount += g.attributes.position.count;
      indexCount += g.index ? g.index.count : g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    const arrays = {};
    for (const name of names) {
      const a = first.attributes[name];
      arrays[name] = new a.array.constructor(vertexCount * a.itemSize);
    }
    const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let vOff = 0;
    let iOff = 0;
    for (const mesh of meshes) {
      const g = mesh.geometry;
      m.multiplyMatrices(toLocal, mesh.matrixWorld);
      nm.getNormalMatrix(m);
      const flip = m.determinant() < 0; // mirrored: reverse the winding so faces still point outwards
      const count = g.attributes.position.count;
      for (const name of names) {
        const src = g.attributes[name];
        const dst = arrays[name];
        const size = src.itemSize;
        const base = vOff * size;
        if (name === 'position' || name === 'normal' || (name === 'tangent' && size >= 3)) {
          for (let i = 0; i < count; i++) {
            v.fromBufferAttribute(src, i);
            if (name === 'position') v.applyMatrix4(m);
            else if (name === 'normal') v.applyMatrix3(nm).normalize();
            else v.transformDirection(m);
            dst[base + i * size] = v.x;
            dst[base + i * size + 1] = v.y;
            dst[base + i * size + 2] = v.z;
            if (size === 4) dst[base + i * size + 3] = src.getW(i) * (flip ? -1 : 1);
          }
        } else {
          dst.set(src.array.subarray(0, count * size), base);
        }
      }
      const n = g.index ? g.index.count : count;
      for (let i = 0; i < n; i += 3) {
        const a = g.index ? g.index.getX(i) : i;
        const b = g.index ? g.index.getX(i + 1) : i + 1;
        const c = g.index ? g.index.getX(i + 2) : i + 2;
        index[iOff + i] = vOff + a;
        index[iOff + i + 1] = vOff + (flip ? c : b);
        index[iOff + i + 2] = vOff + (flip ? b : c);
      }
      vOff += count;
      iOff += n;
    }
    for (const name of names) {
      const a = first.attributes[name];
      out.setAttribute(name, new THREE.BufferAttribute(arrays[name], a.itemSize, a.normalized));
    }
    out.setIndex(new THREE.BufferAttribute(index, 1));
    out.computeBoundingSphere();
    out.computeBoundingBox();

    const proto = meshes[0];
    const mergedMesh = new THREE.Mesh(out, proto.material);
    mergedMesh.name = 'merged-static';
    mergedMesh.castShadow = proto.castShadow;
    mergedMesh.receiveShadow = proto.receiveShadow;
    mergedMesh.renderOrder = proto.renderOrder;
    mergedMesh.layers.mask = proto.layers.mask;
    mergedMesh.matrixAutoUpdate = false;
    // Never a raycast target: the hidden originals answer clicks, so hits keep their own userData & parents
    mergedMesh.raycast = () => {};
    container.add(mergedMesh);
    mergedMesh.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.visible = false;
    merged += meshes.length;
    added++;
  }
  return { before, after: before - merged + added, merged };
}

/**
 * Find the objects that animations move, by running each animator with everything switched on and seeing which
 * transforms change. Saves tagging every key, pivot & hammer by hand in the model files.
 * Poses are compared at every checkpoint, not just at the end: a hammer that strikes and falls back to rest by the
 * last step still counts as moving.
 * @param {THREE.Object3D[]} roots
 * @param {(checkpoint: () => void) => void} exercise runs the animators, calling checkpoint() after each step
 * @param {() => void} settle brings the animators back to rest afterwards
 * @returns {Set<THREE.Object3D>}
 */
export function findAnimatedObjects(roots, exercise, settle) {
  const snap = new Map();
  for (const root of roots) {
    root.traverse((o) => {
      snap.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]);
    });
  }
  const moved = new Set();
  const checkpoint = () => {
    for (const [o, [p, q, s, v]] of snap) {
      if (
        !moved.has(o) &&
        (!o.position.equals(p) || !o.quaternion.equals(q) || !o.scale.equals(s) || o.visible !== v)
      ) {
        moved.add(o);
      }
    }
  };
  exercise(checkpoint);
  checkpoint();
  // Put everything back exactly as built; the animators' next real update moves it from there as before
  for (const [o, [p, q, s, v]] of snap) {
    o.position.copy(p);
    o.quaternion.copy(q);
    o.scale.copy(s);
    o.visible = v;
  }
  settle();
  return moved;
}
