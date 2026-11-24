const PUBLISHED_GENERATED = new Set([
  'assets/dist',
  // Stable, unhashed files Vite writes for third-party embeds and the colourise service worker.
  'assets/js/ilmer-fields-embed.js',
  'assets/js/colorize-sw.js'
]);

/**
 * Patterns from .gitignore that Eleventy should keep ignoring so that turning off
 * its gitignore integration (to watch Vite's output) does not start watching or
 * publishing unrelated generated files. The bundle directory and the two stable
 * script URLs are the exceptions: Eleventy publishes those.
 */
export function retainedGitignorePatterns(gitignore: string): string[] {
  const patterns: string[] = [];
  for (const raw of gitignore.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    if (PUBLISHED_GENERATED.has(line.replace(/^\//, '').replace(/\/$/, ''))) continue;
    patterns.push(line);
  }
  return patterns;
}
