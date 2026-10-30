/** Probe-only synthetic remote receipts through the real hub's Suites owner. */
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { memoryInstrumentation } from './memory-instrumentation.ts';
import type { TestContext } from 'node:test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';

export async function memoryStreaming(t: TestContext, root: string, runs: number) {
  const instrument = memoryInstrumentation(t);
  const owner = pacingOwner(t);
  const database = join(root, '.cland/hub.db');
  await mkdir(join(root, '.cland'), { recursive: true });
  const jobs: SuiteJob[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < runs; i++) {
    const id = `memory-synthetic-${i}`, dir = join(root, '.cland/run/suites', id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'suite.log'), '');
    const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', run: id, lease: id, name: id, tags: [], size: 'synthetic', region: 'none', priceHourly: 0, keyName: id, created: now, deadline: new Date(Date.now() + 3600000).toISOString(), state: 'active', resource: null, keyId: null };
    jobs.push({ id, executor: 'droplet', mode: 'auto', cwd: root, topic: 'agents', to: [], actor: { name: 'human', sessionId: 'memory-synthetic', shell: true },
      head: 'a'.repeat(40), branch: id, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'),
      pid: null, started: null, outcome: null, artifact: null, reported: false, error: null, cleaned: false,
      state: 'running', lease, remoteLogStart: 0, admittedAt: now, progressReported: true, budgetReported: true });
  }
  const store = new Store(database);
  try {
    const active = JSON.parse(store.meta('suite-jobs') ?? '[]') as SuiteJob[];
    store.setMeta('suite-jobs', JSON.stringify([...active, ...jobs]));
  } finally { store.close(); }
  let finishing = false, bytes = 0, checkpoints = 0;
  const start = Date.now();
  const line = '# synthetic checkpoint ' + 'x'.repeat(4000) + '\n';
  const selected = new Set(jobs.map(job => job.id));
  const admit = (lease: DropletLease) => { if (!selected.has(lease.run)) throw new Error('memory fake refuses non-synthetic run'); };
  instrument(DropletExecutor.prototype, 'status', async (lease: DropletLease) => {
    admit(lease);
    return finishing ? { state: 'done', code: 0, finished: new Date().toISOString() } : { state: 'running' };
  });
  instrument(DropletExecutor.prototype, 'log', async (lease: DropletLease, offset: number) => {
    admit(lease);
    // Finite synthetic wire window; no retained growing log in the fake.
    const available = (Math.floor((Date.now() - start) / 10_000) + 1) * Buffer.byteLength(line);
    const text = offset < available ? line : '';
    const chunk = Buffer.from(text); bytes += chunk.length;
    return { text, bytes: chunk, next: offset + chunk.length };
  });
  instrument(DropletExecutor.prototype, 'release', async (lease: DropletLease) => { admit(lease); return { lifetimeMs: Date.now() - start, costUsd: 0 }; });
  return {
    checkpoint: () => { checkpoints++; },
    dispose: owner.dispose,
    finish: async (settled: () => Promise<void>, timeoutMs = 20_000) => {
      finishing = true;
      const deadline = Date.now() + timeoutMs;
      let completed = 0, expired = false;
      const completion = owner.observe(async () => {
        while (Date.now() < deadline) {
          await settled();
          if (expired) return;
          const reader = new Store(database);
          try {
            completed = 0;
            for (const job of jobs) {
              const raw = reader.suiteJob(job.id);
              if (!raw) continue;
              const saved = (JSON.parse(raw) as { job: SuiteJob }).job;
              if (saved.cleaned && saved.outcome?.code === 0) {
                const result = JSON.parse(await readFile(job.result, 'utf8')) as { code: number };
                if (result.code === 0) completed++;
              }
            }
          } finally { reader.close(); }
          if (expired) return;
          if (completed === runs) {
            return { runs, completed, bytes, checkpoints, cadenceMs: 10_000, wireBytesPerRunPerTick: Buffer.byteLength(line), executor: 'fake receipts through production Suites; no network or workers' };
          }
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`synthetic settlement/result deadline reached: ${completed}/${runs} durable results`);
      }, { drain: true });
      try {
        const receipt = await within(completion, timeoutMs, undefined, () => new Error(`synthetic settlement/result deadline reached: ${completed}/${runs} durable results`));
        if (!receipt) throw new Error('synthetic settlement/result incomplete');
        await writeFile(join(root, 'streaming.json'), JSON.stringify(receipt));
      } catch (error) {
        expired = true;
        await writeFile(join(root, 'streaming.json'), JSON.stringify({ incomplete: true, runs, completed, bytes, checkpoints, reason: error instanceof Error ? error.message : 'settlement/result failure' }));
        throw error;
      }
    },
  };
}
