/** The useful first line of a harness error (OpenCode wraps API errors in `data`). */
export function turnError(error: unknown): string {
  if (typeof error === 'string') return error.split(/\r?\n/, 1)[0]?.trim() || 'unknown error';
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string') return turnError(e.message);
    if (e.data && typeof e.data === 'object' && typeof (e.data as Record<string, unknown>).message === 'string') return turnError((e.data as Record<string, unknown>).message);
    if (typeof e.name === 'string') return turnError(e.name);
  }
  return 'unknown error';
}
