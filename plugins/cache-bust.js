import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HASH_LENGTH = 8;

/**
 * Builds an Eleventy filter that appends a content-hash query string to a
 * local asset URL (`/assets/css/style.css` → `/assets/css/style.css?v=a1b2c3d4`).
 *
 * External (`http(s):`, protocol-relative, `data:`) URLs are left unchanged.
 * Hashes are cached per build; call `clearCache()` from `eleventy.before`.
 */
export function createCacheBustFilter(rootDir) {
  const cache = new Map();

  function cacheBust(url) {
    if (url == null || url === '') return url;
    const raw = String(url);
    if (/^(https?:)?\/\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;

    const hashIndex = raw.indexOf('#');
    const fragment = hashIndex === -1 ? '' : raw.slice(hashIndex);
    const withoutFragment = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
    const queryIndex = withoutFragment.indexOf('?');
    const pathname = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
    const existingQuery = queryIndex === -1 ? '' : withoutFragment.slice(queryIndex + 1);

    const filePath = path.join(rootDir, pathname.replace(/^\/+/, ''));
    let hash = cache.get(filePath);
    if (!hash) {
      let bytes;
      try {
        bytes = readFileSync(filePath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          throw new Error(`cacheBust: no file at ${filePath} (from ${raw})`);
        }
        throw err;
      }
      hash = createHash('sha256').update(bytes).digest('hex').slice(0, HASH_LENGTH);
      cache.set(filePath, hash);
    }

    const params = new URLSearchParams(existingQuery);
    params.set('v', hash);
    return `${pathname}?${params.toString()}${fragment}`;
  }

  cacheBust.clearCache = () => cache.clear();
  return cacheBust;
}
