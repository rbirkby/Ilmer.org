// Festive Norway Spruce Christmas tree placed outside the North Porch in December
// (or when previewed with ?christmas=1 / ?month=12). Dynamically imported so non-December visits skip it.
import * as THREE from 'three';
import { getLeafClusterMaterial } from './churchyard.ts';
import type { ChurchMaterials } from './textures.ts';

export interface ChristmasEffect {
  group: THREE.Group;
  setMood(moodKey: string): void;
  update(elapsed: number): void;
}

export function buildChristmasTree(mats: ChurchMaterials): ChristmasEffect {
  const group = new THREE.Group();
  group.name = 'december-christmas-tree';

  // Wooden half-barrel planter & iron hoops at base
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.36, 12), mats.medOak);
  tub.position.y = 0.18;
  tub.castShadow = true;
  tub.receiveShadow = true;
  group.add(tub);

  [0.09, 0.28].forEach((hy) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.012, 6, 18), mats.iron);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    group.add(hoop);
  });

  // Tapered spruce trunk
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2d20, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 2.7, 8), trunkMat);
  trunk.position.y = 1.62;
  trunk.castShadow = true;
  group.add(trunk);

  // Layered spruce needle boughs (inner cones + feathery alpha-cutout evergreen leaf sprays)
  const spruceMat = new THREE.MeshStandardMaterial({
    color: 0x183d21,
    roughness: 0.9,
    flatShading: true
  });
  const sprayMat = getLeafClusterMaterial(0x1f4f28, true);

  const tiers = [
    { y: 0.88, r: 0.84, h: 0.92 },
    { y: 1.32, r: 0.72, h: 0.84 },
    { y: 1.74, r: 0.59, h: 0.76 },
    { y: 2.12, r: 0.46, h: 0.68 },
    { y: 2.46, r: 0.33, h: 0.58 },
    { y: 2.75, r: 0.21, h: 0.46 }
  ];

  tiers.forEach((tier, tIdx) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.r * 0.86, tier.h, 9), spruceMat);
    cone.position.y = tier.y;
    cone.rotation.y = tIdx * 0.42;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);

    // Feathery spruce branch sprays around each tier edge
    const sprayCount = Math.max(4, Math.round(tier.r * 10));
    for (let s = 0; s < sprayCount; s++) {
      const a = (s / sprayCount) * Math.PI * 2 + tIdx * 0.5;
      const sr = tier.r * 0.74;
      const spraySize = 0.26 + tier.r * 0.34;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(spraySize, spraySize), sprayMat);
      card.position.set(Math.cos(a) * sr, tier.y - tier.h * 0.26, Math.sin(a) * sr);
      card.rotation.set(0.35, -a + Math.PI / 2, (s % 2 === 0 ? 1 : -1) * 0.2);
      card.castShadow = true;
      group.add(card);
    }
  });

  // Spiraling Christmas fairy lights (warm white/gold + festive red, amber, blue, emerald bulbs)
  const palette = [0xffe49e, 0xff4545, 0xffb340, 0x55b0ff, 0x4ae67b, 0xfff0c2];
  const bulbGeo = new THREE.SphereGeometry(0.032, 8, 8);
  const bulbEntries: { mat: THREE.MeshStandardMaterial; phase: number; speed: number }[] = [];
  const bulbCount = 58;

  for (let i = 0; i < bulbCount; i++) {
    const t = i / (bulbCount - 1); // 0 = bottom boughs, 1 = near star
    const y = 0.54 + t * 2.34;
    const radius = THREE.MathUtils.lerp(0.84, 0.14, Math.pow(t, 0.92));
    const angle = t * Math.PI * 11.5; // ~5.75 spiral turns around the spruce
    const colHex = palette[i % palette.length];
    const bulbMat = new THREE.MeshStandardMaterial({
      color: colHex,
      emissive: colHex,
      emissiveIntensity: 1.6,
      roughness: 0.2
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    group.add(bulb);
    bulbEntries.push({ mat: bulbMat, phase: i * 0.85, speed: 2.2 + (i % 4) * 0.55 });
  }

  // Glowing 5-pointed golden star topper
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.16 : 0.068;
    const a = (i * Math.PI) / 5 + Math.PI / 2;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.035, bevelEnabled: false });
  starGeo.translate(0, 0, -0.0175);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xffe484,
    emissive: 0xffc83d,
    emissiveIntensity: 1.8,
    roughness: 0.25,
    metalness: 0.5
  });
  const star = new THREE.Mesh(starGeo, starMat);
  star.position.set(0, 3.12, 0);
  group.add(star);

  // Warm festive glow PointLight illuminating the North Porch stonework & lawn
  const treeLight = new THREE.PointLight(0xffd28a, 1.5, 9.5, 1.6);
  treeLight.position.set(0, 1.85, -0.45);
  group.add(treeLight);

  let baseLightIntensity = 1.5;
  let baseEmissiveScale = 1.0;

  return {
    group,
    setMood(moodKey: string) {
      if (moodKey === 'evensong') {
        baseLightIntensity = 3.2;
        baseEmissiveScale = 1.65;
      } else if (moodKey === 'golden') {
        baseLightIntensity = 2.1;
        baseEmissiveScale = 1.3;
      } else {
        baseLightIntensity = 1.2;
        baseEmissiveScale = 1.05;
      }
      starMat.emissiveIntensity = 1.65 * baseEmissiveScale;
    },
    update(elapsed: number) {
      for (let i = 0; i < bulbEntries.length; i++) {
        const b = bulbEntries[i];
        const twinkle = 0.72 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * b.speed + b.phase));
        b.mat.emissiveIntensity = 1.35 * baseEmissiveScale * twinkle;
      }
      treeLight.intensity = baseLightIntensity * (0.94 + 0.06 * Math.sin(elapsed * 2.4));
    }
  };
}
