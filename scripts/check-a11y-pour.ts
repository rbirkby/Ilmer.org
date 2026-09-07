#!/usr/bin/env node
/**
 * Serve the built site and run pour accessibility audits against key pages.
 * Exit 1 if any page has violations (default --fail-on violations).
 *
 * Usage:
 *   node scripts/check-a11y-pour.ts [siteDir]
 *   POUR_BASE_URL=http://127.0.0.1:4173 node scripts/check-a11y-pour.ts   # use existing server
 *
 * CI note: pour-cli does not expose Chrome launch flags. On GitHub Actions /
 * Ubuntu runners Chrome needs --no-sandbox. Set POUR_CHROME_NO_SANDBOX=1
 * (or rely on CI=true) when PUPPETEER_EXECUTABLE_PATH is set.
 */
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.resolve(process.argv[2] || path.join(root, '_site'));
const pourBin = path.join(root, 'node_modules', 'pour-cli', 'pour.mjs');

const PAGES = process.env.POUR_PAGES
  ? process.env.POUR_PAGES.split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  : [
      '/',
      '/about/',
      '/history/church/',
      '/wills/',
      '/map/',
      '/history/timeline/',
      '/parish/',
      '/parish/parishcouncil/',
      '/parish/parishmeeting/',
      '/census/',
      '/census/1921/'
    ];

const FAIL_ON = process.env.POUR_FAIL_ON || 'violations';
const VIEWPORT = process.env.POUR_VIEWPORT || '1440x900';
const EXTRA_ARGS = process.env.POUR_ARGS ? process.env.POUR_ARGS.split(/\s+/).filter(Boolean) : [];

let chromeWrapperPath: string | null = null;

/**
 * pour-cli hardcodes puppeteer launch args without --no-sandbox. Wrap the
 * real Chrome binary so CI sandboxes that block userns still work.
 */
function ensureChromeNoSandboxWrapper(): void {
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const wantNoSandbox =
    process.env.POUR_CHROME_NO_SANDBOX === '1' ||
    process.env.POUR_CHROME_NO_SANDBOX === 'true' ||
    process.env.CI === 'true';

  if (!chromePath || !wantNoSandbox) {
    return;
  }
  if (!existsSync(chromePath)) {
    console.error(`PUPPETEER_EXECUTABLE_PATH not found: ${chromePath}`);
    process.exit(2);
  }

  chromeWrapperPath = path.join(os.tmpdir(), `pour-chrome-${process.pid}.sh`);
  // Quote path for POSIX shell; escape embedded single quotes.
  const quotedChrome = `'${chromePath.replace(/'/g, `'\\''`)}'`;
  const script = `#!/bin/sh
exec ${quotedChrome} --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage "$@"
`;
  writeFileSync(chromeWrapperPath, script, { mode: 0o755 });
  process.env.PUPPETEER_EXECUTABLE_PATH = chromeWrapperPath;
}

function cleanupChromeWrapper(): void {
  if (!chromeWrapperPath) {
    return;
  }
  try {
    unlinkSync(chromeWrapperPath);
  } catch {
    // ignore
  }
  chromeWrapperPath = null;
}
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

function contentType(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/** Resolves `path.join(siteDir, ...)`, rejecting results that escape siteDir via `..`. */
function withinSiteDir(...segments: string[]): string | null {
  const resolved = path.join(siteDir, ...segments);
  if (resolved !== siteDir && !resolved.startsWith(siteDir + path.sep)) return null;
  return resolved;
}

function resolveFile(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';

  const candidates = [withinSiteDir(rel), withinSiteDir(rel, 'index.html'), withinSiteDir(`${rel}.html`)];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

interface StaticServerHandle {
  server: Server;
  baseUrl: string;
}

function startStaticServer(): Promise<StaticServerHandle> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const filePath = resolveFile(req.url || '/');
      if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

interface PourResult {
  url: string;
  code: number;
  stdout: Buffer;
  stderr: Buffer;
  spawnError?: Error;
}

function runPour(url: string): Promise<PourResult> {
  return new Promise((resolve) => {
    const args = [pourBin, url, '--fail-on', FAIL_ON, '--viewport', VIEWPORT, ...EXTRA_ARGS];
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout?.on('data', (chunk) => out.push(chunk));
    child.stderr?.on('data', (chunk) => err.push(chunk));
    child.on('error', (spawnErr) => {
      resolve({
        url,
        code: 2,
        stdout: Buffer.concat(out),
        stderr: Buffer.concat(err),
        spawnError: spawnErr
      });
    });
    child.on('close', (code) => {
      resolve({
        url,
        code: code ?? 2,
        stdout: Buffer.concat(out),
        stderr: Buffer.concat(err)
      });
    });
  });
}

async function main(): Promise<void> {
  if (!existsSync(siteDir)) {
    console.error(`Site directory not found: ${siteDir}\nRun npm run build first.`);
    process.exit(2);
  }
  if (!existsSync(pourBin)) {
    console.error('pour-cli is not installed. Run npm install.');
    process.exit(2);
  }

  ensureChromeNoSandboxWrapper();

  let server: Server | undefined;
  let baseUrl = process.env.POUR_BASE_URL;

  if (!baseUrl) {
    ({ server, baseUrl } = await startStaticServer());
    console.log(`Serving ${siteDir} at ${baseUrl}\n`);
  } else {
    console.log(`Using existing server at ${baseUrl}\n`);
  }

  let worstExit = 0;
  try {
    const urls = PAGES.map((page) => new URL(page, baseUrl!.endsWith('/') ? baseUrl! : `${baseUrl}/`).href);
    console.log(`Running pour on ${urls.length} pages in parallel…`);
    const results = await Promise.all(urls.map((url) => runPour(url)));

    for (const result of results) {
      console.log(`\n── pour ${result.url} ──`);
      if (result.spawnError) {
        console.error(`Failed to run pour for ${result.url}:`, result.spawnError.message);
      }
      if (result.stdout.length) process.stdout.write(result.stdout);
      if (result.stderr.length) process.stderr.write(result.stderr);
      if (result.code > worstExit) worstExit = result.code;
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    cleanupChromeWrapper();
  }

  if (worstExit === 0) {
    console.log('\n✓ pour: all pages clean');
  } else {
    console.error(`\n✗ pour: failures (exit ${worstExit})`);
  }
  process.exit(worstExit);
}

main().catch((err) => {
  console.error(err);
  cleanupChromeWrapper();
  process.exit(2);
});
