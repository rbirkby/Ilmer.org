#!/usr/bin/env node
/**
 * Serve the built site and run pour accessibility audits against key pages.
 * Exit 1 if any page has violations (default --fail-on violations).
 *
 * Usage:
 *   node scripts/check-a11y-pour.mjs [siteDir]
 *   POUR_BASE_URL=http://127.0.0.1:4173 node scripts/check-a11y-pour.mjs   # use existing server
 *
 * CI note: pour-cli does not expose Chrome launch flags. On GitHub Actions /
 * Ubuntu runners Chrome needs --no-sandbox. Set POUR_CHROME_NO_SANDBOX=1
 * (or rely on CI=true) when PUPPETEER_EXECUTABLE_PATH is set.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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

/** @type {string | null} */
let chromeWrapperPath = null;

/**
 * pour-cli hardcodes puppeteer launch args without --no-sandbox. Wrap the
 * real Chrome binary so CI sandboxes that block userns still work.
 */
function ensureChromeNoSandboxWrapper() {
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

function cleanupChromeWrapper() {
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
const MIME = {
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

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';

  const candidates = [
    path.join(siteDir, rel),
    path.join(siteDir, rel, 'index.html'),
    path.join(siteDir, `${rel}.html`)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function startStaticServer() {
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
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

function runPour(url) {
  return new Promise((resolve) => {
    const args = [pourBin, url, '--fail-on', FAIL_ON, '--viewport', VIEWPORT, ...EXTRA_ARGS];
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', (err) => {
      console.error(`Failed to run pour for ${url}:`, err.message);
      resolve(2);
    });
    child.on('close', (code) => resolve(code ?? 2));
  });
}

async function main() {
  if (!existsSync(siteDir)) {
    console.error(`Site directory not found: ${siteDir}\nRun npm run build first.`);
    process.exit(2);
  }
  if (!existsSync(pourBin)) {
    console.error('pour-cli is not installed. Run npm install.');
    process.exit(2);
  }

  ensureChromeNoSandboxWrapper();

  let server;
  let baseUrl = process.env.POUR_BASE_URL;

  if (!baseUrl) {
    ({ server, baseUrl } = await startStaticServer());
    console.log(`Serving ${siteDir} at ${baseUrl}\n`);
  } else {
    console.log(`Using existing server at ${baseUrl}\n`);
  }

  let worstExit = 0;
  try {
    for (const page of PAGES) {
      const url = new URL(page, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href;
      console.log(`\n── pour ${url} ──`);
      const code = await runPour(url);
      if (code > worstExit) worstExit = code;
    }
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
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
