// Builds the agent's knowledge corpus from the Eleventy output in ../_site.
// Each page becomes { url, title, description, text }, taken from <main> so navigation and footers are excluded.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const agentDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const siteRoot = path.dirname(agentDir);
const siteDir = path.join(siteRoot, '_site');
const outFile = path.join(agentDir, 'public', 'corpus.json');
const SITE_URL = 'https://www.ilmer.org';
const SKIP = [/^\/_drafts\//, /^\/agent\//, /^\/404\.html$/, /^\/assets\//, /^\/images\//];

if (!existsSync(siteDir) || process.env.CORPUS_REBUILD_SITE === 'true') {
  console.log('Building the Ilmer site with Eleventy…');
  execFileSync('npm', ['run', 'build'], { cwd: siteRoot, stdio: 'inherit' });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
export function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function htmlToText(html) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<img[^>]*\balt="([^"]*)"[^>]*>/gi, ' [Image: $1] ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|blockquote|figure|figcaption|dt|dd)>/gi, '\n')
      .replace(/<(td|th)[^>]*>/gi, ' | ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractPage(html) {
  const title = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '')
    .replace(/\s+[–-]\s+Ilmer Past$/, '')
    .trim();
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '').trim();
  const main =
    html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
  return { title, description, text: htmlToText(main) };
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith('.html')) yield full;
  }
}

function urlFor(file) {
  const rel = '/' + path.relative(siteDir, file).split(path.sep).join('/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = [];
  for (const file of walk(siteDir)) {
    const url = urlFor(file);
    if (SKIP.some((pattern) => pattern.test(url))) continue;
    const page = extractPage(readFileSync(file, 'utf8'));
    if (page.text.length < 40) continue;
    pages.push({ url: SITE_URL + url, ...page });
  }
  pages.sort((a, b) => a.url.localeCompare(b.url));
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), pages }));
  const size = statSync(outFile).size;
  console.log(
    `Wrote ${pages.length} pages (${(size / 1024 / 1024).toFixed(1)} MB) to ${path.relative(agentDir, outFile)}`
  );
}
