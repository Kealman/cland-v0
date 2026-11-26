// Fixed labels bound retained work independently of operation count.
export type CasePhase = 'setup' | 'git' | 'cli' | 'launch' | 'completion' | 'landing';
export function casePhases(now: () => number) {
  type Row = { phase: CasePhase; calls: number; completed: number; failed: number; milliseconds: number };
  const rows = new Map<CasePhase, Row>();
  function begin(phase: CasePhase) {
    let row = rows.get(phase);
    if (!row) { row = { phase, calls: 0, completed: 0, failed: 0, milliseconds: 0 }; rows.set(phase, row); }
    row.calls++;
    const started = now();
    return { row, finish: () => { row.milliseconds += Math.max(0, now() - started); } };
  }
  return {
    async measure<T>(phase: CasePhase, work: () => Promise<T>): Promise<T> {
      const { row, finish } = begin(phase);
      try { const value = await work(); row.completed++; return value; }
      catch (error) { row.failed++; throw error; }
      finally { finish(); }
    },
    measureSync<T>(phase: CasePhase, work: () => T): T {
      const { row, finish } = begin(phase);
      try { const value = work(); row.completed++; return value; }
      catch (error) { row.failed++; throw error; }
      finally { finish(); }
    },
    snapshot() { return [...rows.values()].map(row => ({ ...row })); },
  };
}
