/** Explain a failed start from this attempt's JSON-lines log, tolerating stderr and partial writes. */
export function startupDiagnostic(text: string): string {
  let step = 'unknown', lastEvent = 'none recorded';
  let storage: string | undefined, suiteJobsBytes: number | undefined;
  for (const line of text.split('\n')) {
    let entry: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      entry = value as Record<string, unknown>;
    } catch { continue; }
    if (typeof entry.event !== 'string') continue;
    lastEvent = entry.event;
    if (entry.event === 'hub-startup-step' && typeof entry.step === 'string') step = entry.step;
    if (entry.event === 'serving') step = 'serving';
    if (entry.event === 'hub-startup-storage' && typeof entry.suiteJobsBytes === 'number') suiteJobsBytes = entry.suiteJobsBytes;
    if (entry.event === 'tracker-storage-stalled' && typeof entry.operation === 'string') {
      storage = `${entry.operation} on ${typeof entry.item === 'string' ? entry.item : 'tracker-wide work'}`;
    }
  }
  return [`last startup step: ${step}`, ...(storage ? [`tracker storage: ${storage}`] : []), ...(suiteJobsBytes !== undefined ? [`suite-jobs: ${suiteJobsBytes} bytes`] : []), `last log event: ${lastEvent}`].join('; ');
}
