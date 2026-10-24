export type WebRepeatReceipt = { code: number; complete: boolean; passed: number; failed: number; skipped: number; cpu: boolean };
// Existing hubs retain and summarize this prefix. No new running-hub capability
// is required to report counts from the candidate runner.
export const WEB_REPETITION_REPORT = 'load gate workers 2; Web repetition (report only):';
/** Admission owns Git. Only the ancestor shared with HEAD is the baseline;
 * a later dev tip may contain files not yet present at that branch point. */
export async function selectWebRepetitionFiles(files: readonly string[], dev: string, git: (...args: string[]) => Promise<string>): Promise<string[]> {
  const candidates = newWebFiles(files, []);
  if (!candidates.length) return [];
  const base = (await git('merge-base', dev, 'HEAD')).trim();
  if (!base) throw new Error('Web repetition merge base unavailable');
  const known = await git('ls-tree', '-r', '--name-only', '-z', base, '--', 'web/test');
  return newWebFiles(candidates, known.split('\0'));
}

export function admittedWebRepetitions(files: readonly string[] | undefined, planned: readonly string[], emit: (line: string) => void): string[] | undefined {
  if (!files) { emit(`${WEB_REPETITION_REPORT} not run; dev baseline unavailable; missing load proof`); return undefined; }
  return files.filter(file => planned.includes(file));
}
export function webRepeatSummary(text: string): Omit<WebRepeatReceipt, 'code' | 'cpu'> {
  const missing = { complete: false, passed: 0, failed: 0, skipped: 0 };
  try {
    const value = JSON.parse(text) as Record<string, unknown> | null;
    if (!value || value.complete !== true || !['passed', 'failed', 'skipped'].every(key => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)) return missing;
    return { complete: true, passed: value.passed as number, failed: value.failed as number, skipped: value.skipped as number };
  } catch { return missing; }
}
export function newWebFiles(files: readonly string[], known: readonly string[]): string[] {
  const baseline = new Set(known);
  return [...new Set(files)].filter(file => /^web\/test\/(?:[^/]+\/)*[^/]+\.test\.ts$/.test(file)
    && !file.split('/').some(part => part === '.' || part === '..') && !baseline.has(file)).sort();
}

/** Separate from Web timings and ordinary identity load proofs. Report rollout
 * never converts incomplete, skipped or failed receipts into passing evidence. */
export async function repeatWebFiles(files: readonly string[], run: (file: string, repetition: number, worker: number) => Promise<WebRepeatReceipt>, emit: (line: string) => void, interrupted: () => boolean): Promise<void> {
  for (const file of files) {
    let passed = 0;
    let attempted = 0;
    await Promise.all([0, 1].map(async worker => {
      for (let round = 0; round < 5 && !interrupted(); round++) {
        const repetition = round * 2 + worker + 1;
        attempted++;
        let receipt: WebRepeatReceipt;
        try { receipt = await run(file, repetition, worker); }
        catch (error) {
          emit(`load gate Web diagnostic ${JSON.stringify({ file, repetition, error: String(error) })}`);
          receipt = { code: -1, complete: false, passed: 0, failed: 0, skipped: 0, cpu: false };
        }
        const green = receipt.code === 0 && receipt.complete && receipt.passed > 0
          && receipt.failed === 0 && receipt.skipped === 0 && receipt.cpu;
        if (green) passed++;
        else emit(`load gate Web receipt ${JSON.stringify({ file, repetition, ...receipt })}`);
      }
    }));
    emit(`${WEB_REPETITION_REPORT} ${file} ${passed}/10 passed; workers 2; CPU load; attempted ${attempted}/10${passed === 10 ? '' : '; missing load proof'}`);
  }
  if (!files.length) emit(`${WEB_REPETITION_REPORT} 0 new files; 0 repetitions required`);
}
