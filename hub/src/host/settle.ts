import { join, dirname, basename } from 'node:path';
import type { Host } from './host.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';

import { LAUNCH_SETTLEMENT_MS } from '../adapters/launch-settlement.ts';

// Concurrent generations get one stop/reap bound, one retirement bound, then
// two seconds of shared inventory/transport headroom. CLI adds its frame margin.
export const HOST_SETTLEMENT_MS = 2 * LAUNCH_SETTLEMENT_MS + 2000;
export type HostLeftover = { generation: string; session: string; remaining: string[]; reason: string };
export type HostSettlement = { inventoryComplete: boolean; timedOut: boolean; leftovers: HostLeftover[] };
export class HostSettlementIncomplete extends Error {
  readonly remaining: string[];
  constructor(message: string, remaining: string[]) { super(message);this.remaining=remaining; }
}
export type HostSettlementStep = { generation: string; session: string; settle(): Promise<void> };

/** One bounded pre-cut owner. Late work can observe its fence, but cannot start another Host call. */
export async function settleHostBeforeCut(options: {
  host?: Host | undefined; runDirectory?: string | undefined; steps: HostSettlementStep[]; retainedSteps?: AsyncIterable<HostSettlementStep>; retainedFiles?: AsyncIterable<HostLeftover>; nativeClosedGenerations?: ReadonlySet<string>; cut(): void;
  clock?: Clock; timeoutMs?: number; ownWork?: (work: Promise<void>) => void;
}): Promise<HostSettlement> {
  const clock = options.clock ?? realClock;
  let active = true, inventoryComplete = false, timedOut = false;
  const pending = new Map<string, HostLeftover>();
  const check = () => { if (!active) throw new Error('host settlement authority cut'); };
  const remember = (generation: string, session: string) => {
    const existing=pending.get(generation);if(existing)return existing;
    const row = { generation, session, remaining: ['worker (unconfirmed)', 'receipt (unconfirmed)', 'private files (unconfirmed)'], reason: 'settlement pending' };
    pending.set(generation, row); return row;
  };
  for (const step of options.steps) remember(step.generation, step.session);
  let retainedComplete = !options.retainedSteps;
  const work = (async () => {
    const retained: HostSettlementStep[] = [];
    if(options.retainedSteps) {
      for await(const step of options.retainedSteps) { check(); remember(step.generation,step.session);retained.push(step); }
      retainedComplete=true;
    }
    await Promise.all([...options.steps,...retained].map(async step => {
      check();
      try { await step.settle(); check(); pending.delete(step.generation); }
      catch (error) { if (active) { const row=pending.get(step.generation)!;row.reason=error instanceof HostSettlementIncomplete?error.message:'session cleanup incomplete';if(error instanceof HostSettlementIncomplete)row.remaining=[...error.remaining]; } }
    }));
    const inspectClaude=async()=>{
    const host = options.host, run = options.runDirectory;
    if (!host || !run) return;
    let entries: string[];
    try { check(); entries = await host.listFolder(join(run, 'claude')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { inventoryComplete = true; return; } return; }
    check();
    for (const entry of entries) if (/^[a-f0-9-]{36}\.json$/.test(entry)) remember(entry.slice(0, -5), 'agent generation');
    inventoryComplete = true;
    for (const entry of entries) {
      if (!/^[a-f0-9-]{36}\.json$/.test(entry)) continue;
      const generation = entry.slice(0, -5), row = pending.get(generation)!;
      try {
        check();
        const record = JSON.parse(Buffer.from(await host.readFile(join(run, 'claude', entry))).toString());
        check();
        if(options.nativeClosedGenerations?.has(generation)){row.remaining=['receipt','private files'];row.reason='host reboot confirmed native closure; agent resource retirement remains pending';continue;}
        // Disk metadata is never process authority; adopt validates the agent receipt.
        if (!host.adopt) throw new Error('adoption unavailable');
        const receipt = await host.adopt(generation); check();
        if (!receipt.release || !receipt.forget) throw new Error('generation settlement unavailable');
        if (!receipt.released && !receipt.closed) {
          if (!await host.stop(receipt.process)) throw new Error('worker closure incomplete');
          check();
        }
        row.remaining = ['receipt', 'private files'];
        await receipt.release(); check();
        const directory: unknown = record.privateDirectory;
        if (typeof directory !== 'string' || basename(directory) !== generation
          || dirname(dirname(directory)) !== join(run, 'sessions') || !/^[a-f0-9]{64}$/.test(basename(dirname(directory)))) throw new Error('private directory ownership unavailable');
        check();
        const type = await host.fileType(directory); check();
        if (type !== 'missing' && await host.realpath(directory) !== directory) throw new Error('private directory changed');
        check();
        for (const file of ['mcp.json', 'settings.json']) {
          check(); await host.removePath(join(directory, file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
        check(); await host.removePath(directory, { directory: true }).catch(error => { if (error.code !== 'ENOENT') throw error; });
        check(); row.remaining = ['receipt'];
        await receipt.forget(); check(); pending.delete(generation);
      } catch { if (active) row.reason = 'agent generation cleanup incomplete'; }
    }
    inventoryComplete = true;
    };
    await inspectClaude();check();
    if(options.retainedFiles) {
      const claudeComplete=inventoryComplete;inventoryComplete=false;
      try {
        const named=new Set([...pending.values()].map(row=>row.session));
        for await(const row of options.retainedFiles){check();if(!named.has(row.session)){pending.set(row.generation,row);named.add(row.session);}}
        check();inventoryComplete=claudeComplete;
      }catch{inventoryComplete=false;}
    }

  })();
  options.ownWork?.(work);
  let timer: ClockTimer | undefined;
  const deadline = new Promise<void>(resolve => { timer = clock.setTimeout(() => { timedOut = true; resolve(); }, options.timeoutMs ?? HOST_SETTLEMENT_MS); });
  try { await Promise.race([work.catch(() => {}), deadline]); }
  finally { active = false; clock.clearTimeout(timer); options.cut(); }
  return { inventoryComplete:inventoryComplete&&retainedComplete, timedOut, leftovers: [...pending.values()].map(row => ({ ...row, remaining: [...row.remaining] })) };
}

/** Additive result: an older hub's reply has no cleanup field. */
export function hostRevocationLines(reply: { cleanup?: HostSettlement }): string[] {
  const cleanup = reply.cleanup;
  if (!cleanup) return [];
  return [
    ...(!cleanup.inventoryComplete ? ['agent generation inventory unknown'] : []),
    ...cleanup.leftovers.map(row => `left generation ${row.generation} (${row.session}): ${row.remaining.join(', ')}; ${row.reason}`),
  ];
}
