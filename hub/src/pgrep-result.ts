/** An OS listing failure is unknown, even when macOS pgrep exits successfully. */
export function pgrepMembers(result: { code: number | null; stdout: string; stderr: string; error?: unknown }): number[] {
  if (result.error || result.stderr.length > 0 || result.code !== 0 && result.code !== 1 || /sysmon|cannot get process list/i.test(result.stdout)) {
    throw new Error('process inspection unavailable: pgrep failed or produced diagnostics');
  }
  const values = result.stdout.trim().split(/\s+/).filter(Boolean);
  if (values.some(value => !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 1)) {
    throw new Error('process inspection unavailable: invalid pgrep process list');
  }
  return values.map(Number);
}
