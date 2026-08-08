#!/usr/bin/env node
/**
 * Check links in the built site, skipping external hosts.
 * Internal (same-origin / localhost / relative file paths) links still fail the run.
 */
import { check, LinkState } from 'linkinator';

const path = process.argv[2] || '_site';

function isExternalHttpUrl(url) {
  try {
    // Absolute URLs only; relative and file paths are treated as internal.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return false;
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}

const result = await check({
  path,
  recurse: true,
  linksToSkip: async (url) => isExternalHttpUrl(url)
});

const broken = result.links.filter((link) => link.state === LinkState.BROKEN);

if (broken.length === 0) {
  console.log(`✓ Internal links OK. Scanned ${result.links.length} links under ${path}.`);
  process.exit(0);
}

console.error(`ERROR: ${broken.length} broken internal link(s) under ${path}:`);
for (const link of broken) {
  const parent = link.parent ? ` (from ${link.parent})` : '';
  console.error(`  [${link.status}] ${link.url}${parent}`);
}
process.exit(1);
