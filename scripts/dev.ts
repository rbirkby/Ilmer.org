/**
 * Rebuild browser bundles when their TypeScript changes, and serve the Eleventy site.
 * `npm start` runs a Vite build first so the manifest exists before Eleventy renders.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const bin = (name: string) => path.resolve('node_modules/.bin', name);

const children: ChildProcess[] = [
  spawn(bin('vite'), ['build', '--watch'], { stdio: 'inherit' }),
  spawn(bin('eleventy'), ['--config=.eleventy.ts', '--serve'], { stdio: 'inherit' })
];

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
for (const child of children) {
  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (signal) return;
    shutdown(code ?? 1);
  });
}
