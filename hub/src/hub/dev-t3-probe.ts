// File probes use the ordinary Suites executor/budget queue on detached immutable commits.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Store } from './store.ts';
import type { Suites } from './suites.ts';
import type { DevT3Result } from './dev-t3-result.ts';
import type { ProbeReceipt } from './dev-t3-search.ts';
import { diagnosticResult, type BatchCandidate } from './merge-batches.ts';
import { checkoutMergeBatch, removeMergeBatch, type BatchRepository } from './merge-batch-territory.ts';
import { committedTreeOrThrow } from '../verification-tree.ts';
import { suiteProgress } from '../suite-progress.ts';
import { quarantineResults } from '../suite-quarantine.ts';
import { failingTests } from './shared-defects.ts';

export type ProbeRepository = Pick<BatchRepository, 'identity' | 'checkout' | 'remove'>;
export class DevT3Probes {
  readonly suites: Suites;
  readonly store: Store;
  readonly root: string;
  readonly repository: ProbeRepository;
  constructor(store: Store, suites: Suites, root: string, env: NodeJS.ProcessEnv, repository?: ProbeRepository) {
    this.store = store; this.suites = suites; this.root = root;
    this.repository = repository ?? { identity: head => committedTreeOrThrow(root, head, env), checkout: candidate => checkoutMergeBatch(root, candidate, env), remove: candidate => removeMergeBatch(root, candidate, env) };
  }
  async probe(input: DevT3Result, head: string, file: string): Promise<ProbeReceipt | null> {
    const key = `dev-t3-probe:${input.run}:${head}:${file}`;
    let candidate = JSON.parse(this.store.meta(key) ?? 'null') as BatchCandidate | null;
    if (!candidate) {
      const tree = await this.repository.identity(head);
      if (!tree) throw new Error(`probe tree unavailable at ${head}`);
      // Separate immutable checkout per commit/file: a restarted admission never rewrites a running worker.
      candidate = { base: input.previousGreenHead ?? input.head, head, tree, cwd: join(this.root, '.cland/run/merge-batches', `dev-t3-${createHash('sha256').update(key).digest('hex')}`), budgetLines: [] };
      this.store.setMeta(key, JSON.stringify(candidate));
    }
    let job = this.suites.status().find(job => job.devT3Probe?.key === key);
    if (!job) {
      await this.repository.checkout(candidate);
      try {
        const run = await this.suites.start({ mode: 'all', cwd: candidate.cwd, topic: 'general', to: ['coordinator'], actor: null,
          devT3Probe: { key, files: [file] }, executor: 'droplet', priority: 10, fresh: true }, () => {});
        if (!('id' in run)) throw new Error('probe needs an admitted suite');
        job = this.suites.status().find(job => job.id === run.id)!;
      } catch (error) {
        job = this.suites.status().find(job => job.devT3Probe?.key === key);
        if (!job) { await this.repository.remove(candidate); throw error; }
      }
    }
    if (!job.reported) return null;
    const receipt = await this.suites.receipt(job.id);
    const artifact = this.store.resolveArtifact(receipt.job.artifact!);
    if (!artifact) throw new Error('probe artifact unavailable');
    const verdict = probeResult(receipt.job, receipt.log, file);
    if (receipt.job.head !== candidate.head || receipt.job.tree !== candidate.tree) throw new Error('probe does not match its immutable candidate');
    await this.repository.remove(candidate);
    return { head, file, run: job.id, ...verdict, artifact: artifact.id, path: artifact.path };
  }
}
/** Missing, skipped or interrupted execution is neither a pass nor blame evidence. */
export function probeResult(job: Parameters<typeof diagnosticResult>[0], log: string, file: string): Pick<ProbeReceipt, 'result' | 'reason'> {
  const diagnostic = diagnosticResult(job, log);
  if (diagnostic.result === 'inconclusive') return diagnostic;
  if (diagnostic.result === 'red') return failingTests(log).some(identity => identity.split('::')[0] === file) ? diagnostic : { result: 'inconclusive', reason: 'no failure in the requested file' };
  for (const line of log.split('\n').filter(line => line.startsWith('suite progress '))) {
    try {
      const row = JSON.parse(line.slice('suite progress '.length));
      if (!row || typeof row.file !== 'string' || typeof row.name !== 'string' || typeof row.id !== 'string'
        || !Number.isInteger(row.nesting) || row.nesting < 0 || !Number.isFinite(row.at) || !['start', 'finish'].includes(row.event)
        || row.event === 'finish' && (!['pass', 'fail', 'skip', 'todo', 'cancelled'].includes(row.outcome) || !Number.isFinite(row.seconds) || row.seconds < 0)) throw new Error('invalid progress');
      if (row.file === file && row.event === 'finish' && row.outcome !== 'pass') return { result: 'inconclusive', reason: 'file has nonpassing execution receipts' };
    } catch { return { result: 'inconclusive', reason: 'malformed execution receipt' }; }
  }
  const progress = suiteProgress(log, 0);
  const completed = progress?.completed.filter(row => row.file === file) ?? [];
  if (!completed.some(row => row.outcome === 'pass' && row.type !== 'suite') || completed.some(row => row.outcome !== 'pass')
    || progress?.unfinished.some(row => row.file === file) || quarantineResults(log).some(row => row.file === file && row.outcome !== 'pass')) {
    return { result: 'inconclusive', reason: 'file lacks complete executed passing receipts' };
  }
  return { result: 'green' };
}
