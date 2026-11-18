import { verificationInterrupted, type VerificationStep } from './verification-plan.ts';

export type TierReceipt = { tier: 'T0' | VerificationStep['name']; exit: number | null; completion: 'complete' | 'incomplete'; tree: string; run: string; command: string };

/** Complete planned execution, with ordered same-command interruption recovery. */
export function completeTierPlanReason(proof: { id: string; tree?: string | null; tierReceipts?: unknown; commands?: { plan?: VerificationStep[] } }): string | null {
  const plan = proof.commands?.plan;
  if (!plan?.length) return 'missing execution plan';
  const rows = parseTierReceipts(proof.tierReceipts);
  if (!rows || rows.some(row => row.run !== proof.id || row.tree !== proof.tree)) return 'missing producer tier receipts';
  const key = (row: typeof rows[number]) => JSON.stringify([row.tier, row.run, row.tree, row.command]);
  for (const [index, row] of rows.entries()) {
    if (row.completion === 'complete' && row.exit === 0) continue;
    if (row.exit !== null && verificationInterrupted(row.exit) && rows.slice(index + 1).some(later => key(later) === key(row) && later.exit === 0 && later.completion === 'complete')) continue;
    return 'failed or incomplete producer tier receipt';
  }
  if (plan.some(step => !rows.some(row => row.tier === (step.name === 'check' ? 'T0' : step.name)
    && row.command === step.command && row.exit === 0 && row.completion === 'complete'))) return 'missing complete passing step receipt';
  return null;
}

/** One grammar for native status ingestion and persisted receipt eligibility. */
export function parseTierReceipts(value: unknown): TierReceipt[] | undefined {
  if (!Array.isArray(value) || value.length > 32) return undefined;
  for (const row of value) {
    if (!row || !['T0', 'check', 'test', 'T1', 'T2', 'T3', 'T4', 'Web'].includes(row.tier)
      || row.exit !== null && (!Number.isInteger(row.exit) || row.exit < 0 || row.exit > 255)
      || !['complete', 'incomplete'].includes(row.completion)
      || !['tree', 'run', 'command'].every(key => typeof row[key] === 'string' && row[key].length > 0 && row[key].length <= 8192)) return undefined;
  }
  return value;
}

export function tierReceipt(owner: { id: string; tree?: string | null }, step: VerificationStep, exit: number | null): TierReceipt {
  return { tier: step.name === 'check' ? 'T0' : step.name, exit, completion: exit === null ? 'incomplete' : 'complete', tree: owner.tree ?? '', run: owner.id, command: step.command };
}

/** Producer records both native completion and rejection, before terminal publication. */
export async function receiptStep<T extends { code: number }>(rows: TierReceipt[], owner: { id: string; tree?: string | null }, step: VerificationStep, run: () => Promise<T>): Promise<T> {
  let exit: number | null = null;
  try { const outcome = await run(); exit = outcome.code; return outcome; }
  finally { rows.push(tierReceipt(owner, step, exit)); }
}

/** Serialized into the remote reader; bound bytes before JSON collection. */
export function readTierReceipts(fs: { openSync(path: string, flags: 'r'): number; readSync(fd: number, bytes: Buffer, offset: number, length: number, position: number): number; closeSync(fd: number): void }, path: string, parse: typeof parseTierReceipts): TierReceipt[] | undefined {
  let fd: number | undefined;
  let rows: TierReceipt[] | undefined;
  try {
    fd = fs.openSync(path, 'r');
    const bytes = Buffer.alloc(65537);
    let kept = 0;
    while (kept < bytes.length) {
      const count = fs.readSync(fd, bytes, kept, bytes.length - kept, kept);
      if (!count) break;
      kept += count;
    }
    if (kept <= 65536) rows = parse(JSON.parse(bytes.subarray(0, kept).toString('utf8')));
  } catch { /* Missing, damaged and oversized metadata remains unknown. */ }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { rows = undefined; } }
  return rows;
}

/** Hosted source owns the remote writer even when the delivered candidate is older. */
export function tierReceiptWriterProgram(owner: { id: string; tree?: string | null }, step: VerificationStep, seed: TierReceipt[] = []): string {
  return `const fs=require('fs'),p=process.argv[1];const parse=(${parseTierReceipts.toString()}),read=(${readTierReceipts.toString()});const rows=read(fs,p,parse)??${JSON.stringify(seed)};rows.push({...${JSON.stringify(tierReceipt(owner, step, null))},exit:Number(process.argv[2]),completion:'complete'});if(!parse(rows)){process.exitCode=1;}else{fs.writeFileSync(p+'.tmp',JSON.stringify(rows),{mode:384});fs.renameSync(p+'.tmp',p);}`;
}
