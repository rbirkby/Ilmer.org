/**
 * What `npm start` should do when one of its child processes exits.
 * Returns null when this process is already stopping the children on purpose.
 * An unexpected signal (for example SIGKILL) is a failure, so the sibling is stopped too.
 */
export function unexpectedChildExit(
  stopping: boolean,
  code: number | null,
  signal: NodeJS.Signals | null
): number | null {
  if (stopping) return null;
  if (signal) return 1;
  return code ?? 1;
}

/**
 * `vite build --watch` must not empty `assets/dist`. Doing so deletes the manifest
 * while Eleventy is serving, and Eleventy would start a second build into the same folder.
 */
export function viteEmptiesOutput(argv: readonly string[]): boolean {
  return !argv.includes('--watch');
}

/** Eleventy's own build runs Vite. Serve and watch leave bundling to `vite build --watch`. */
export function eleventyRunsVite(runMode: string | undefined): boolean {
  return runMode !== 'serve' && runMode !== 'watch';
}

/**
 * Child processes for `npm start`, as `node <script>`.
 * The `.bin` shims are `.cmd` on Windows and are not executable when spawned directly.
 */
export function devChildArgs(root: string, execPath: string): { vite: string[]; eleventy: string[] } {
  return {
    vite: [execPath, `${root}/node_modules/vite/bin/vite.js`, 'build', '--watch'],
    eleventy: [execPath, `${root}/node_modules/@11ty/eleventy/cmd.cjs`, '--config=.eleventy.ts', '--serve']
  };
}
