import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The subset of Vite's build manifest this site reads. */
export interface ViteManifestEntry {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  css?: string[];
}

export type ViteManifest = Record<string, ViteManifestEntry>;

const PUBLIC_PREFIX = '/assets/dist/';

export function loadViteManifest(rootDir: string): ViteManifest {
  const candidates = [
    path.join(rootDir, 'assets/dist/.vite/manifest.json'),
    path.join(rootDir, 'assets/dist/manifest.json')
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    throw new Error(
      'Vite manifest not found in assets/dist. Run `npm run build:js` first (`npm run build` and `npm start` do this).'
    );
  }
  return JSON.parse(readFileSync(file, 'utf8')) as ViteManifest;
}

export function findBundleEntry(manifest: ViteManifest, name: string): ViteManifestEntry {
  const entry = Object.values(manifest).find((item) => item.isEntry && item.name === name);
  if (!entry) {
    throw new Error(`Vite manifest has no entry named "${name}".`);
  }
  return entry;
}

function publicUrl(file: string): string {
  return `${PUBLIC_PREFIX}${file.replace(/^\/+/, '')}`;
}

/** Hashed URL for a Rollup input name, e.g. `then-now` → `/assets/dist/then-now-a1b2c3d4.js`. */
export function bundleUrl(manifest: ViteManifest, name: string): string {
  return publicUrl(findBundleEntry(manifest, name).file);
}

/**
 * Hashed URLs of the static chunks an entry imports, for `<link rel="modulepreload">`.
 * Dynamic imports are omitted so on-demand code (the colourise button) stays on demand.
 */
export function bundleImportUrls(manifest: ViteManifest, name: string): string[] {
  const entry = findBundleEntry(manifest, name);
  const files: string[] = [];
  const seen = new Set<string>();

  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const item = manifest[key];
    if (!item) return;
    if (item.file !== entry.file) files.push(item.file);
    for (const child of item.imports ?? []) visit(child);
    for (const css of item.css ?? []) files.push(css);
  };

  for (const key of entry.imports ?? []) visit(key);
  return files.map(publicUrl);
}

export interface BundleFilters {
  (name: string): string;
  clear: () => void;
}

export interface BundleImportFilters {
  (name: string): string[];
  clear: () => void;
}

/** Eleventy filters. The manifest is read on demand and dropped in `eleventy.before`. */
export function createBundleFilters(rootDir: string): { bundle: BundleFilters; bundleImports: BundleImportFilters } {
  let manifest: ViteManifest | null = null;
  const read = () => {
    if (!manifest) manifest = loadViteManifest(rootDir);
    return manifest;
  };
  const clear = () => {
    manifest = null;
  };

  const bundle = ((name: string) => bundleUrl(read(), name)) as BundleFilters;
  bundle.clear = clear;
  const bundleImports = ((name: string) => bundleImportUrls(read(), name)) as BundleImportFilters;
  bundleImports.clear = clear;
  return { bundle, bundleImports };
}
