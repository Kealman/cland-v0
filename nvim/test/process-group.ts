/** A signal-zero probe is the native receipt for process-group absence. */
export function processGroupGone(pgid: number, probe: (pid: number, signal: 0) => unknown): boolean {
  try {
    probe(-pgid, 0);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ESRCH') return true;
    throw new Error(`process group ${pgid} probe failed: ${code ?? 'unknown'} (${String(error)})`, { cause: error });
  }
}
