/** Execution-order receipts survive an interrupted reporter without its exit summary. */
export type TestProgress = { event: 'start' | 'finish'; id: string; file: string; name: string; at: number; nesting: number; type?: string; scope?: 'load-gate'; outcome?: 'pass' | 'fail' | 'skip' | 'todo' | 'cancelled'; seconds?: number };
export type CompletedTest = TestProgress & { event: 'finish'; outcome: NonNullable<TestProgress['outcome']>; seconds: number };
export type UnfinishedTest = TestProgress & { runningSeconds: number };
export type SuiteProgress = { completed: CompletedTest[]; unfinished: UnfinishedTest[] };

export function suiteProgress(log: string, stoppedAt: number): SuiteProgress | null {
  const started = new Map<string, TestProgress>();
  const completed = new Map<string, CompletedTest>();
  const cutoffs = new Map<string, number>();
  let seen = false;
  for (const line of log.split('\n')) {
    if (line.startsWith('suite interruption ')) {
      try {
        const at = Date.parse(JSON.parse(line.slice('suite interruption '.length)).at);
        if (Number.isFinite(at)) for (const id of started.keys()) if (!cutoffs.has(id)) cutoffs.set(id, at);
      } catch { /* an interrupted marker cannot erase valid progress */ }
    }
    if (!line.startsWith('suite progress ')) continue;
    let row: TestProgress;
    try { row = JSON.parse(line.slice('suite progress '.length)) as TestProgress; } catch { continue; }
    if (!row || typeof row.id !== 'string' || typeof row.file !== 'string' || typeof row.name !== 'string' || !Number.isFinite(row.at) || !Number.isInteger(row.nesting)) continue;
    if (row.event === 'start') { started.set(row.id, row); seen = true; }
    else if (row.event === 'finish' && ['pass', 'fail', 'skip', 'todo', 'cancelled'].includes(row.outcome ?? '') && Number.isFinite(row.seconds) && row.seconds! >= 0) {
      seen = true;
      // A run signal may make Node cancel a test. That is no observed completion
      // of its body: retain its start for the interruption's hung-test receipt.
      if (row.outcome === 'cancelled') continue;
      started.delete(row.id);
      if (row.type !== 'file') completed.set(row.id, row as CompletedTest);
    }
  }
  if (!seen) return null;
  return { completed: [...completed.values()], unfinished: [...started.values()].filter(row => row.type !== 'file' || ![...started.values()].some(test => test.file === row.file && test.type !== 'file')).map(row => ({ ...row, runningSeconds: Math.max(0, Math.floor(((cutoffs.get(row.id) ?? stoppedAt) - row.at) / 1000)) }))
    .sort((a, b) => b.runningSeconds - a.runningSeconds || a.at - b.at || a.file.localeCompare(b.file) || a.name.localeCompare(b.name)) };
}

export function progressLines(progress: SuiteProgress): string[] {
  const tests = progress.completed.filter(row => row.type !== 'suite');
  const count = (outcome: TestProgress['outcome']) => tests.filter(row => row.outcome === outcome).length;
  return [...progress.unfinished.map(row => `hung: ${row.file} :: ${row.name} (running ${row.runningSeconds} s)`),
    `completed before interruption: tests ${tests.length}; pass ${count('pass')}; fail ${count('fail')}; skipped ${count('skip')}; todo ${count('todo')}`,
    ...tests.filter(row => row.outcome === 'fail').map(row => `completed failure: ${row.file} :: ${row.name}`)];
}

/** Aggregate child receipts without charging their later collection/cleanup time. */
export function interruptionLines(log: string): string[] {
  if (!log.includes('suite interruption ')) return [];
  const progress = suiteProgress(log, 0);
  return progress ? progressLines(progress) : [];
}
