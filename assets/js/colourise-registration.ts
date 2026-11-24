/** Stable URL of the colourise service worker. It is not content-hashed and not under the immutable `/assets/dist/` cache. */
export const COLOURISE_SW_PATH = '/assets/js/colorize-sw.js';

/**
 * Registrations whose script is a colourise worker other than the stable file.
 * That includes hashed `/assets/dist/colorize-sw-*.js` copies, which 404 after the next deploy.
 * The original `/assets/js/colorize-sw.js` registration is kept: that file is published again, so the browser updates it in place.
 */
export function isStaleColouriseWorker(scriptURL: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(scriptURL).pathname;
  } catch {
    return false;
  }
  if (!pathname.includes('colorize-sw')) return false;
  return pathname !== COLOURISE_SW_PATH;
}
