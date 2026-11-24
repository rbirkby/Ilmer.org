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
