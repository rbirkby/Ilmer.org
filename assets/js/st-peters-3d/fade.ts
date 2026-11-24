import * as THREE from 'three';

// Fading features in & out (Today/1900 switch, roof cutaway) instead of snapping them on or off.
//
// While an object fades, each mesh under it draws with a transparent copy of its material whose opacity follows the
// fade; when the fade ends the original material goes back and the object is simply shown or hidden, so nothing is
// left transparent (or sorted with the glass) once it settles. Copies are made per fade, never shared with meshes
// outside it, so baked (merged) meshes that share a material with the rest of the church are unaffected. Nothing is
// written to userData, which the static-mesh merge reads.
//
// Lights under a fading object dim with it. Shader materials keep their own uniforms (so their animation carries on);
// those with a uOpacity or uIntensity uniform fade through it, and the rest (flames, smoke) switch at the midpoint.
// Shadows follow at the midpoint too: the sun's shadow map is redrawn only on change, so update() reports when.

export const FADE_SECONDS = 0.5;
const FADE_UNIFORMS = ['uOpacity', 'uIntensity'];

const smooth = (t: number) => t * t * (3 - 2 * t);

interface Fade {
  obj: THREE.Object3D;
  show: boolean;
  t: number;
}

interface MaterialCopy {
  orig: THREE.Material;
  copy: THREE.Material;
  /** The shader uniform the fade drives, if any. */
  uniform: string | null;
  written: number;
  base?: number;
  origSeen?: number;
}

type Renderable = THREE.Object3D & { material: THREE.Material | THREE.Material[] };

interface FadingMesh {
  mats: MaterialCopy[];
  single: boolean;
  castShadow: boolean;
  fades: Set<Fade>;
}

interface FadingLight {
  base: number;
  written: number;
  fades: Set<Fade>;
}

const isShader = (material: THREE.Material): material is THREE.ShaderMaterial =>
  (material as Partial<THREE.ShaderMaterial>).isShaderMaterial === true;
const hasMaterial = (object: THREE.Object3D): object is Renderable => !!(object as Partial<Renderable>).material;

function copyMaterial(orig: THREE.Material): MaterialCopy {
  const copy = orig.clone();
  // clone() leaves out per-instance shader hooks (e.g. the solid-core cut faces); keep them, so the copy looks the same
  copy.onBeforeCompile = orig.onBeforeCompile;
  copy.customProgramCacheKey = orig.customProgramCacheKey;
  copy.userData = orig.userData;
  if (isShader(orig) && isShader(copy)) {
    const key = FADE_UNIFORMS.find((k) => typeof orig.uniforms[k]?.value === 'number');
    // Share every uniform object, so whatever animates the original (time, tint) animates the copy too
    copy.uniforms = { ...orig.uniforms };
    if (key) copy.uniforms[key] = { value: orig.uniforms[key].value };
    return { orig, copy, uniform: key ?? null, written: NaN };
  }
  copy.transparent = true;
  return { orig, copy, uniform: null, written: NaN };
}

export function createFader() {
  const fades = new Map<THREE.Object3D, Fade>();
  const meshes = new Map<Renderable, FadingMesh>();
  const lights = new Map<THREE.Light, FadingLight>();
  const timers = new Map<string, { left: number; fn: () => void }>();
  let shadowsChanged = false;

  function enlist(fade: Fade, obj: THREE.Object3D) {
    obj.traverse((o) => {
      if (o instanceof THREE.Light) {
        let l = lights.get(o);
        if (!l) lights.set(o, (l = { base: o.intensity, written: NaN, fades: new Set() }));
        l.fades.add(fade);
        return;
      }
      if (!hasMaterial(o)) return;
      let m = meshes.get(o);
      if (!m) {
        const single = !Array.isArray(o.material);
        const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(copyMaterial);
        m = { mats, single, castShadow: o.castShadow, fades: new Set() };
        o.material = single ? mats[0].copy : mats.map((c) => c.copy);
        meshes.set(o, m);
      }
      m.fades.add(fade);
    });
  }

  function release(fade: Fade) {
    for (const [o, m] of meshes) {
      if (!m.fades.delete(fade) || m.fades.size) continue;
      o.material = m.single ? m.mats[0].orig : m.mats.map((c) => c.orig);
      if (o.castShadow !== m.castShadow) shadowsChanged = true;
      o.castShadow = m.castShadow;
      for (const c of m.mats) c.copy.dispose();
      meshes.delete(o);
    }
    for (const [light, l] of lights) {
      if (!l.fades.delete(fade) || l.fades.size) continue;
      if (light.intensity === l.written) light.intensity = l.base;
      lights.delete(light);
    }
  }

  // Show or hide an object: fades over FADE_SECONDS, or at once when instant (scene start-up). Reversing mid-fade
  // carries on from where it is.
  function setVisible(obj: THREE.Object3D, show: boolean, instant = false) {
    const fade = fades.get(obj);
    if (instant) {
      if (fade) {
        release(fade);
        fades.delete(obj);
      }
      if (obj.visible !== show) shadowsChanged = true;
      obj.visible = show;
      return;
    }
    if (fade) {
      fade.show = show;
      return;
    }
    if (obj.visible === show) return;
    const f = { obj, show, t: show ? 0 : 1 };
    fades.set(obj, f);
    obj.visible = true;
    enlist(f, obj);
  }

  // Run fn half way through a fade (material swaps that can't fade, e.g. glazing): a later call with the same key
  // replaces it; instant runs it now
  function atMidpoint(key: string, fn: () => void, instant = false) {
    timers.delete(key);
    if (instant) fn();
    else timers.set(key, { left: FADE_SECONDS / 2, fn });
  }

  // Advance the fades; true when the shadow map needs redrawing
  function update(dt: number) {
    for (const [key, timer] of timers) {
      timer.left -= dt;
      if (timer.left <= 0) {
        timers.delete(key);
        timer.fn();
        shadowsChanged = true;
      }
    }
    for (const [obj, f] of fades) {
      f.t = THREE.MathUtils.clamp(f.t + (f.show ? dt : -dt) / FADE_SECONDS, 0, 1);
      if (f.t === (f.show ? 1 : 0)) {
        release(f);
        fades.delete(obj);
        obj.visible = f.show;
        shadowsChanged = true;
      }
    }
    // A mesh under more than one fade (e.g. a 1900 feature in the roof while the cutaway also fades) takes the product
    for (const [o, m] of meshes) {
      let k = 1;
      for (const f of m.fades) k *= smooth(f.t);
      for (const c of m.mats) {
        const { orig, copy } = c;
        copy.clippingPlanes = orig.clippingPlanes; // the half-hip clip changes with the era
        if (isShader(orig) && isShader(copy)) {
          if (c.uniform) copy.uniforms[c.uniform].value = orig.uniforms[c.uniform].value * k;
          else copy.visible = orig.visible && k >= 0.5;
          continue;
        }
        // Some animations write opacity through the mesh (a candle halo's flicker)
        // (the copy), others (the mood) to the original
        if (copy.opacity !== c.written) c.base = copy.opacity;
        else if (orig.opacity !== c.origSeen) c.base = orig.opacity;
        c.origSeen = orig.opacity;
        copy.opacity = c.written = (c.base ?? orig.opacity) * k;
      }
      const cast = m.castShadow && k >= 0.5;
      if (o.castShadow !== cast) {
        o.castShadow = cast;
        shadowsChanged = true;
      }
    }
    for (const [light, l] of lights) {
      if (light.intensity !== l.written) l.base = light.intensity; // the mood (or a flicker) set it since
      let k = 1;
      for (const f of l.fades) k *= smooth(f.t);
      light.intensity = l.written = l.base * k;
    }
    const changed = shadowsChanged;
    shadowsChanged = false;
    return changed;
  }

  return { setVisible, atMidpoint, update, isFading: () => fades.size > 0 };
}
