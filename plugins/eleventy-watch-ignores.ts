/**
 * Patterns from .gitignore that Eleventy should keep ignoring so that turning off
 * its gitignore integration (to watch Vite's output) does not start watching or
 * publishing unrelated generated files. `assets/dist` is the one exception.
 */
export function retainedGitignorePatterns(gitignore: string): string[] {
  const patterns: string[] = [];
  for (const raw of gitignore.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    if (line.replace(/^\//, '').replace(/\/$/, '') === 'assets/dist') continue;
    patterns.push(line);
  }
  return patterns;
}
