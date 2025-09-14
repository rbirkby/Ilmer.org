#!/usr/bin/env node
/**
 * Validate _data/historicalEvents.json for common issues and print actionable messages.
 * - required fields: date (string), title (string), description (string)
 * - labels: array of strings (warn if missing/empty)
 * - references: array of strings (coerce or warn)
 * - image/smallimage: accept string; warn if file missing
 * - duplicates: warn on duplicate {date,title}
 * - sortability: detect non-parseable dates
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const dataPath = path.join(projectRoot, '_data', 'historicalEvents.json');
const imagesDir = path.join(projectRoot, 'images');

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: Failed to read ${file}:`, err.message);
    process.exitCode = 1;
    return [];
  }
}

function isString(x) {
  return typeof x === 'string';
}
function toArray(x) {
  if (Array.isArray(x)) return x.filter(Boolean);
  if (isString(x) && x.trim() !== '') return [x.trim()];
  return [];
}

function checkImageExists(p) {
  if (!isString(p)) return false;
  // Skip external URLs
  if (/^https?:\/\//i.test(p)) return true;
  // Treat leading '/' as site-root (project-relative)
  const rel = p.replace(/^\//, '');
  const full = path.join(projectRoot, rel);
  try {
    return fs.existsSync(full);
  } catch {
    return false;
  }
}

function parseLooseDate(d) {
  if (!isString(d)) return null;
  // Try extract a year (4 digits) for ordering checks
  const m = d.match(/(\d{3,4})/);
  return m ? Number(m[1]) : null;
}

const events = readJson(dataPath);
if (!Array.isArray(events)) {
  console.error('ERROR: historicalEvents.json must be an array');
  process.exit(1);
}

let warnCount = 0;
let errorCount = 0;

function warn(msg) {
  warnCount++;
  console.warn('WARN:', msg);
}
function error(msg) {
  errorCount++;
  console.error('ERROR:', msg);
}

const seen = new Set();

events.forEach((ev, idx) => {
  const where = `event #${idx + 1}`;
  // Requireds
  if (!isString(ev.date) || ev.date.trim() === '') error(`${where}: missing/invalid date`);
  if (!isString(ev.title) || ev.title.trim() === '') error(`${where}: missing/invalid title`);
  if (!isString(ev.description) || ev.description.trim() === '') error(`${where}: missing/invalid description`);

  // Duplicates by key
  const key = `${ev.date}::${ev.title}`;
  if (seen.has(key)) warn(`${where}: duplicate date+title '${key}'`);
  else seen.add(key);

  // Labels
  if (ev.labels == null) warn(`${where}: labels missing; consider adding categories`);
  else if (!Array.isArray(ev.labels)) warn(`${where}: labels should be an array of strings`);
  else if (ev.labels.length === 0) warn(`${where}: labels array is empty`);

  // References
  if (ev.references != null && !Array.isArray(ev.references))
    warn(`${where}: references should be an array of strings`);

  // Images
  const images = [...toArray(ev.image), ...toArray(ev.smallimage)];
  images.forEach((rel) => {
    if (!checkImageExists(rel)) warn(`${where}: image path not found '${rel}'`);
  });

  // Date orderability
  const y = parseLooseDate(ev.date);
  if (y == null) warn(`${where}: date is not year-like; sorting may be unexpected`);
});

console.log(`\nValidation complete: ${events.length} events, ${warnCount} warnings, ${errorCount} errors.`);
if (errorCount > 0) process.exit(1);
