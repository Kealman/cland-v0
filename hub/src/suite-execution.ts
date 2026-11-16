import { suiteProgress } from './suite-progress.ts';
import type { TierPlan } from './suite-tier-report.ts';

export type TierExecution = { tier: TierPlan[number]['tier']; unexecuted: string[]; incomplete: string[] };

/** A completed test is not proof that the rest of its file executed. */
export function tierExecution(plan: TierPlan, log: string): TierExecution[] {
  const progress = suiteProgress(log, 0, { fileEnvelopes: true });
  const finished = new Set(progress?.completed.filter(row => row.type === 'file').map(row => row.file));
  const observed = new Set([...progress?.completed ?? [], ...progress?.unfinished ?? []].map(row => row.file));
  return plan.map(row => ({ tier: row.tier,
    unexecuted: row.files.filter(file => !observed.has(file)),
    incomplete: row.files.filter(file => observed.has(file) && !finished.has(file)),
  }));
}

export function executionLines(rows: TierExecution[], pathBytes?: number): string[] {
  const detail = (files: string[]) => {
    if (pathBytes === undefined || Buffer.byteLength(files.join(', ')) <= pathBytes) return files.join(', ');
    const shown: string[] = [];
    for (const file of files) {
      if (Buffer.byteLength([...shown, file].join(', ')) > pathBytes) break;
      shown.push(file);
    }
    return `${files.length} files; ${shown.length ? shown.join(', ') + '; ' : ''}${files.length - shown.length} omitted; full list in log`;
  };
  return rows.flatMap(row => [
    ...(row.unexecuted.length ? [`unexecuted tier ${row.tier}: ${detail(row.unexecuted)}`] : []),
    ...(row.incomplete.length ? [`incomplete tier ${row.tier}: ${detail(row.incomplete)}`] : []),
  ]);
}
