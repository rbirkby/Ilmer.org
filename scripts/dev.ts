/**
 * Rebuild browser bundles when their TypeScript changes, and serve the Eleventy site.
 * Vite's watch build runs first and is left to finish writing before Eleventy starts,
 * so the two never build into assets/dist at the same time.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { devChildArgs, unexpectedChildExit } from './dev-process.ts';

const root = process.cwd();
const children: ChildProcess[] = [];
let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

function track(child: ChildProcess) {
  children.push(child);
  child.on('exit', (code, signal) => {
    const exitCode = unexpectedChildExit(stopping, code, signal);
    if (exitCode === null) return;
    shutdown(exitCode);
  });
}

const commands = devChildArgs(root, process.execPath);
const vite = spawn(commands.vite[0], commands.vite.slice(1), { stdio: 'inherit' });
track(vite);

const readyFiles = [
  path.join(root, 'assets/dist/.vite/manifest.json'),
  path.join(root, 'assets/js/ilmer-fields-embed.js'),
  path.join(root, 'assets/js/colorize-sw.js')
];

async function waitUntilBundled() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) {
      throw new Error('Vite exited before the bundles were written');
    }
    if (readyFiles.every((file) => existsSync(file))) return;
    await delay(100);
  }
  throw new Error('Timed out waiting for the Vite build');
}

try {
  await waitUntilBundled();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}

const eleventy = spawn(commands.eleventy[0], commands.eleventy.slice(1), { stdio: 'inherit' });
track(eleventy);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
