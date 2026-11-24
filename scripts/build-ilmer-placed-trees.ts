import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildPlacedTreesFromFiles } from './ilmer-placed-trees.js';

const started = performance.now();
const placed = buildPlacedTreesFromFiles(THREE);
const output = new URL('../assets/ilmer-placed-trees.json', import.meta.url);
writeFileSync(output, JSON.stringify(placed) + '\n');
const seconds = ((performance.now() - started) / 1000).toFixed(2);
console.log(
  `Wrote ${placed.trees.length} placed trees (${placed.excluded.shiftedToVerge} shifted onto the verge, ${placed.excluded.road} left on the road) in ${seconds}s`
);
