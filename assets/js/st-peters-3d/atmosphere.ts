import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas } from './canvas-utils.ts';
import { DIM } from './dimensions.ts';

type Vec3 = [number, number, number];
type ShaftColors = { colorA: number; colorB: number; colorC: number; baseOpacity?: number };
type ShaftSpec = ShaftColors & {
  origin: Vec3;
  target: Vec3;
  startW: number;
  startH: number;
  endScale?: number;
};
type PoolStop = [number, number, number, string];
type MoodKey = 'autumn' | 'golden' | 'evensong';

// Volumetric stained-glass sunbeam shader with smooth Fresnel edge feathering,
// multi-hue stained-glass streaks, and distance falloff (no hard edges from any angle).
function createShaftShaderMaterial({ colorA, colorB, colorC, baseOpacity = 0.22 }: ShaftColors): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uColorC: { value: new THREE.Color(colorC) },
      uTint: { value: new THREE.Color(0xfff4dc) },
      uOpacity: { value: baseOpacity },
      uIntensity: { value: 1.0 },
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uIntensity;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        // vUv.y = 1.0 at the window glass, 0.0 at the far end of the shaft
        float along = smoothstep(0.0, 0.75, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        // Smooth edge feather across width and view-angle Fresnel so beam dissolves with zero hard edges
        float across = pow(max(sin(vUv.x * 3.14159265), 0.0), 1.35);
        float fresnel = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.65);

        // Stained-glass color variation across the two lights + subtle animated dust shimmer
        float band1 = smoothstep(0.05, 0.48, vUv.x) * (1.0 - smoothstep(0.48, 0.95, vUv.x));
        float band2 = smoothstep(0.45, 0.9, vUv.x);
        vec3 glassCol = mix(uColorA, uColorB, band1);
        glassCol = mix(glassCol, uColorC, band2 * 0.72);

        float rays = 0.76 + 0.24 * sin(vUv.x * 22.0 + vUv.y * 2.5 - uTime * 0.35)
                   + 0.14 * sin(vUv.x * 41.0 + uTime * 0.22);

        vec3 finalColor = glassCol * uTint * rays;
        float alpha = along * across * (0.04 + 0.96 * fresnel) * uOpacity * uIntensity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });
}

// Build an oriented volumetric light-beam frustum + inner crossed light curtains from a window aperture
function buildWindowShaft({
  origin,
  target,
  startW,
  startH,
  endScale = 1.65,
  colorA,
  colorB,
  colorC,
  baseOpacity = 0.22
}: ShaftSpec): { group: THREE.Group; materials: THREE.ShaderMaterial[] } {
  const g = new THREE.Group();
  const start = new THREE.Vector3(...origin);
  const end = new THREE.Vector3(...target);
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();

  const mat = createShaftShaderMaterial({ colorA, colorB, colorC, baseOpacity });

  // Outer tapered 4-sided soft frustum aligned along local +Y (top=origin, bottom=target)
  const topR = Math.max(startW, startH) * 0.52;
  const botR = topR * endScale;
  const frustumGeo = new THREE.CylinderGeometry(topR, botR, length, 4, 1, true);
  frustumGeo.rotateY(Math.PI / 4);
  frustumGeo.scale(startW / Math.max(startW, startH), 1, startH / Math.max(startW, startH));
  const frustum = new THREE.Mesh(frustumGeo, mat);
  g.add(frustum);

  // Inner crossed volumetric sheets so the shaft stays richly visible even when looking nearly side-on
  const innerMat = mat.clone();
  innerMat.uniforms.uOpacity.value = baseOpacity * 0.72;
  const makeCurtain = (wTop: number, wBot: number, rotY: number) => {
    const pos = new Float32Array([
      -wBot * 0.5,
      -length * 0.5,
      0,
      wBot * 0.5,
      -length * 0.5,
      0,
      wTop * 0.5,
      length * 0.5,
      0,
      -wTop * 0.5,
      length * 0.5,
      0
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, innerMat);
    m.rotation.y = rotY;
    return m;
  };
  g.add(makeCurtain(startW * 0.9, startW * endScale * 0.95, 0));
  g.add(makeCurtain(startH * 0.85, startH * endScale * 0.9, Math.PI / 2));

  // Position at midpoint and orient local -Y from origin toward target
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  g.position.copy(mid);
  const unitDir = dir.clone().normalize();
  // Local -Y points along unitDir => local +Y points along -unitDir
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), unitDir);

  return { group: g, materials: [mat, innerMat] };
}

// Floating golden dust motes drifting lazily through the sunlit Nave & Chancel
function buildDustMotes() {
  const count = 240;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  let s = 42197;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    // Concentrate motes inside Nave & Chancel interior air volume
    const inChancel = i < 75;
    const x = inChancel ? 3.5 + rand() * 5.2 : -4.8 + rand() * 7.8;
    const z = inChancel ? (rand() - 0.5) * 3.4 : (rand() - 0.5) * 4.6;
    const y = 0.65 + rand() * 3.55;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds[i] = rand() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
      uColor: { value: new THREE.Color(0xffe9bd) }
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.24 + aSeed * 3.1) * 0.14;
        p.y += sin(uTime * 0.18 + aSeed * 5.7) * 0.18;
        p.z += cos(uTime * 0.21 + aSeed * 2.3) * 0.14;
        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(24.0 / max(-mvPos.z, 1.2), 1.5, 5.5);
        vAlpha = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 0.9 + aSeed * 6.28));
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      uniform vec3 uColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(uColor, soft * vAlpha * 0.42 * uIntensity);
      }
    `
  });

  return { points: new THREE.Points(geo, mat), material: mat };
}

// Create a soft stained-glass colored light pool decal (for Sanctuary steps & Nave floor)
function createColorPoolTexture(colors: readonly PoolStop[]): THREE.CanvasTexture {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = canvas2d(c);
  ctx.clearRect(0, 0, s, s);

  colors.forEach(([x, y, r, rgba]) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, rgba);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });
  const tex = canvasTexture(c);
  return tex;
}

export function buildAtmosphere() {
  const group = new THREE.Group();
  group.name = 'cinematic-atmosphere';

  const N = DIM.nave;
  const C = DIM.chancel;
  const W = DIM.windows;

  const shaftMaterials: THREE.ShaderMaterial[] = [];
  const windowBounceLights: { light: THREE.PointLight; baseInt: number }[] = [];
  const poolMaterials: { mat: THREE.MeshBasicMaterial; baseOp: number }[] = [];

  // 1. Volumetric Stained-Glass Sunbeam Shafts pouring diagonally into the church
  const shaftSpecs: ShaftSpec[] = [
    // A1: South Nave "Sower" Window (primary dramatic SW sunbeam crossing the Nave onto the North wall!)
    {
      origin: [W.w4.x, 1.98, N.zSouthInt + 0.05],
      target: [W.w4.x - 1.15, 0.95, N.zNorthInt + 0.15],
      startW: 1.28,
      startH: 1.22,
      endScale: 1.62,
      colorA: 0xffd27a,
      colorB: 0x8fd694,
      colorC: 0x8ec8ff,
      baseOpacity: 0.24
    },
    // A2: East / Altar Window (majestic sapphire-gold-crimson shaft descending over the Altar & Sanctuary!)
    {
      origin: [C.xEastInt + 0.05, 3.25, 0.0],
      target: [5.45, 0.55, 0.0],
      startW: 1.24,
      startH: 1.65,
      endScale: 1.75,
      colorA: 0xffe094,
      colorB: 0x6ea8ff,
      colorC: 0xff7a7a,
      baseOpacity: 0.22
    },
    // A3: North Nave "Jaques" Window (soft cool sapphire-ruby-gold skylight shaft beside the Pulpit)
    {
      origin: [W.w6.x, 1.98, N.zNorthInt - 0.05],
      target: [W.w6.x - 0.25, 0.45, 0.45],
      startW: 1.24,
      startH: 1.25,
      endScale: 1.45,
      colorA: 0x92c8ff,
      colorB: 0xff9b85,
      colorC: 0xffe49e,
      baseOpacity: 0.13
    },
    // Window 2: Chancel South-East Lancet (crisp golden shaft across the Sanctuary floor)
    {
      origin: [W.w2.x, 1.82, C.zSouthInt + 0.05],
      target: [W.w2.x - 0.85, 0.55, -1.05],
      startW: 0.52,
      startH: 1.05,
      endScale: 1.65,
      colorA: 0xfff0cc,
      colorB: 0xffe2a8,
      colorC: 0xd8ecff,
      baseOpacity: 0.18
    },
    // Window 3: Chancel South-West Wilson lancet (cool blue & lilac shaft over the clergy stall)
    {
      origin: [W.w3.x, (W.w3.sillY + W.w3.apexY) * 0.5, C.zSouthInt + 0.05],
      target: [W.w3.x - 0.55, 0.45, -0.35],
      startW: 0.36,
      startH: W.w3.apexY - W.w3.sillY - 0.2,
      endScale: 1.6,
      colorA: 0xd8dcff,
      colorB: 0xe6d8f6,
      colorC: 0xc8dcff,
      baseOpacity: 0.15
    },
    // Window 5: West Lancet (dramatic shaft filtering through the dark oak chevron belfry timbers!)
    {
      origin: [N.xWestInt - 0.05, 2.48, 0.0],
      target: [-3.85, 1.05, 0.0],
      startW: 0.62,
      startH: 1.25,
      endScale: 1.75,
      colorA: 0xfff0d4,
      colorB: 0xffe0aa,
      colorC: 0xcce2ff,
      baseOpacity: 0.17
    }
  ];

  shaftSpecs.forEach((spec) => {
    const shaft = buildWindowShaft(spec);
    group.add(shaft.group);
    shaftMaterials.push(...shaft.materials);
  });

  // 2. Warm Colored Bounce Lights right inside the 3 Stained Glass Windows
  const addWindowBounce = (x: number, y: number, z: number, color: number, baseInt: number, dist: number) => {
    const lt = new THREE.PointLight(color, baseInt, dist, 1.6);
    lt.position.set(x, y, z);
    group.add(lt);
    windowBounceLights.push({ light: lt, baseInt });
  };
  addWindowBounce(W.w4.x, 1.95, N.zSouthInt - 0.35, 0xffd58a, 1.45, 7.5); // Sower Window warm gold
  addWindowBounce(C.xEastInt - 0.45, 3.05, 0.0, 0xffe0ad, 1.35, 7.0); // Altar East Window glow
  addWindowBounce(W.w6.x, 1.95, N.zNorthInt + 0.35, 0xbcdbff, 0.75, 5.5); // Jaques North Window sky fill

  // 3. Soft Stained-Glass Floor Light Pools (Nave aisle from Sower Window + Sanctuary steps from East Window)
  const navePoolMat = new THREE.MeshBasicMaterial({
    map: createColorPoolTexture([
      [96, 130, 68, 'rgba(255,210,105,0.34)'],
      [158, 124, 62, 'rgba(120,210,145,0.28)'],
      [130, 92, 54, 'rgba(115,185,255,0.28)'],
      [120, 165, 54, 'rgba(255,135,120,0.25)']
    ]),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.72
  });
  const navePool = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1), navePoolMat);
  navePool.rotation.x = -Math.PI / 2;
  navePool.position.set(W.w4.x - 0.45, DIM.naveFloorY + 0.015, 0.35);
  group.add(navePool);
  poolMaterials.push({ mat: navePoolMat, baseOp: 0.72 });

  const sanctuaryPoolMat = new THREE.MeshBasicMaterial({
    map: createColorPoolTexture([
      [105, 118, 66, 'rgba(110,170,255,0.32)'],
      [152, 138, 66, 'rgba(255,115,105,0.28)'],
      [128, 128, 74, 'rgba(255,220,130,0.34)']
    ]),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.62
  });
  const sanctuaryPool = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), sanctuaryPoolMat);
  sanctuaryPool.rotation.x = -Math.PI / 2;
  sanctuaryPool.position.set(6.75, DIM.sanctuaryStep1Y + 0.02, 0.0);
  group.add(sanctuaryPool);
  poolMaterials.push({ mat: sanctuaryPoolMat, baseOp: 0.62 });

  // 4. Floating Golden Dust Motes drifting through the shafts
  const dust = buildDustMotes();
  group.add(dust.points);

  const MOOD_PRESETS = {
    autumn: { shaftInt: 1.0, tint: 0xfff3d8, bounceScale: 1.0, dustInt: 0.95, poolScale: 0.85 },
    golden: { shaftInt: 1.38, tint: 0xffc97a, bounceScale: 1.35, dustInt: 1.25, poolScale: 1.15 },
    evensong: { shaftInt: 0.14, tint: 0x7aa4e8, bounceScale: 0.15, dustInt: 0.25, poolScale: 0.08 }
  };

  return {
    group,
    setMood(moodKey: MoodKey) {
      const m = MOOD_PRESETS[moodKey] || MOOD_PRESETS.autumn;
      shaftMaterials.forEach((mat) => {
        mat.uniforms.uIntensity.value = m.shaftInt;
        mat.uniforms.uTint.value.setHex(m.tint);
      });
      windowBounceLights.forEach(({ light, baseInt }) => {
        light.intensity = baseInt * m.bounceScale;
      });
      poolMaterials.forEach(({ mat, baseOp }) => {
        mat.opacity = baseOp * m.poolScale;
      });
      dust.material.uniforms.uIntensity.value = m.dustInt;
      dust.material.uniforms.uColor.value.setHex(m.tint);
    },
    update(elapsed: number) {
      shaftMaterials.forEach((mat) => {
        mat.uniforms.uTime.value = elapsed;
      });
      dust.material.uniforms.uTime.value = elapsed;
    }
  };
}
