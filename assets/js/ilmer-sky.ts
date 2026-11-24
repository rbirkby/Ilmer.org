// Autumn Sun sky for the 1839 village, matching the church model's look: a deep blue zenith fading to a pale
// horizon haze, a warm halo round a low sun and slow, wispy clouds.

/** Autumn Sun mood, shared by the sky, lights, fog and exposure. */
export const AUTUMN_SUN = {
  sunDirection: [-16, 15, 20],
  sunColor: 0xfff1d6,
  sunIntensity: 2.7,
  hemiSky: 0xbcd8f5,
  hemiGround: 0x5c6b48,
  hemiIntensity: 0.95,
  skyTop: 0x2a64b5,
  skyHorizon: 0xc8dcf0,
  skyBelow: 0xaab9a6,
  fogColor: 0xc4d8eb,
  fogDensity: 0.0011,
  exposure: 1.06
};

/**
 * @param {typeof import('three')} THREE
 * @param {number} radius sky sphere radius, inside the camera's far plane
 */
export function createVillageSky(THREE: typeof import('three'), radius: number) {
  const mood = AUTUMN_SUN;
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(mood.skyTop) },
      horizonColor: { value: new THREE.Color(mood.skyHorizon) },
      bottomColor: { value: new THREE.Color(mood.skyBelow) },
      sunDir: { value: new THREE.Vector3(...mood.sunDirection).normalize() },
      sunColor: { value: new THREE.Color(mood.sunColor) },
      cloudColor: { value: new THREE.Color(0xf8f3ea) },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform vec3 cloudColor;
      uniform float uTime;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * noise(p);
          p = p * 2.05 + vec2(11.3, 7.1);
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = h >= 0.0
          ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
          : mix(horizonColor, bottomColor, clamp(-h * 4.0, 0.0, 1.0));
        float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
        // Warm haze round the sun, strongest low in the sky, and a crisp disc
        col += sunColor * (pow(sunDot, 7.0) * 0.42 + pow(sunDot, 48.0) * 0.55 + smoothstep(0.9975, 0.9994, sunDot) * 1.1) * 0.58;
        if (h > 0.0) {
          vec2 cloudUv = (dir.xz / (h + 0.16)) * 0.55 + vec2(uTime * 0.0025, uTime * 0.0012);
          float n = fbm(cloudUv * vec2(1.6, 0.85));
          float wisps = smoothstep(0.48, 0.78, n) * smoothstep(0.02, 0.24, h) * (1.0 - smoothstep(0.55, 0.95, h));
          vec3 litCloud = mix(cloudColor, sunColor, pow(sunDot, 4.0) * 0.55);
          col = mix(col, litCloud, wisps * 0.4);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, material };
}
