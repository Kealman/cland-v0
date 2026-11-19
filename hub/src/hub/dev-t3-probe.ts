// File probes use the ordinary Suites executor/budget queue on detached immutable commits.
import { createHash } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { removeWorktreeWithFixtures } from '../fixture-processes.ts';
import type { Store } from './store.ts';
import type { Suites } from './suites.ts';
import type { DevT3Result } from './dev-t3-result.ts';
import type { Platform } from '../executor/executor.ts';
import type { PlatformSkip, ProbeVerdict, ProbeReceipt } from './dev-t3-search.ts';
import { cleanupError, diagnosticResult, type BatchCandidate } from './merge-batches.ts';
import { prepareBatchDependencies, removeMergeBatch, type BatchRepository } from './merge-batch-territory.ts';
import { committedTreeOrThrow } from '../verification-tree.ts';
import { suiteProgress } from '../suite-progress.ts';
import { quarantineResults } from '../suite-quarantine.ts';
import { territoryGitAsync } from '../territory.ts';
import { diagnosticTestFile } from '../suite-selection.ts';
import { failingTests } from './shared-defects.ts';
import { CandidateOwnershipUnavailable } from '../batch-candidate-ownership.ts';
import type { LogFn } from '../log.ts';

type PreservationDiagnostic = { cwd: string; head: string; tree: string; cause: string; reason: string; replacement: string | null };
class PreservationDiagnosticFailure extends Error {
  readonly diagnostic: PreservationDiagnostic;
  readonly secondary: string;
  constructor(diagnostic: PreservationDiagnostic, secondary: string) { super(secondary); this.diagnostic = diagnostic; this.secondary = secondary; }
}

export type ProbeRepository = Pick<BatchRepository, 'identity' | 'checkout' | 'remove'> & { contains(head: string, file: string): Promise<boolean> };
export class DevT3Probes {
  readonly suites: Suites;
  readonly store: Store;
  readonly root: string;
  readonly repository: ProbeRepository;
  readonly log: LogFn;
  constructor(store: Store, suites: Suites, root: string, env: NodeJS.ProcessEnv, repository?: ProbeRepository,
    log: LogFn = entry => { process.stderr.write(JSON.stringify(entry) + '\n'); }) {
    this.store = store; this.suites = suites; this.root = root; this.log = log;
    this.repository = repository ?? {
      contains: async (head, file) => (await territoryGitAsync(root, ['ls-tree', '--name-only', '-z', head, '--', file], false, undefined, env)).split('\0').includes(file),
      identity: head => committedTreeOrThrow(root, head, env),
      checkout: async candidate => {
        let gitFile = await stat(join(candidate.cwd, '.git')).catch(error => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        // Old checkpoints used linked worktrees whose project discovery reached
        // today's tracker. Retire those only at the idle admission boundary.
        if (gitFile?.isFile()) {
          try {
            await removeMergeBatch(root, candidate, env);
            delete candidate.owner;
            gitFile = null;
          } catch (error) {
            if (!(error instanceof CandidateOwnershipUnavailable)) throw error;
            // An upgrade cannot acquire authority over an old root at deletion.
            // Keep its diagnostic, and use a stable, separate clone even when
            // preparation is interrupted before the candidate checkpoint saves.
            const retained = candidate.cwd;
            const identity = createHash('sha256').update(JSON.stringify([retained, candidate.head, candidate.tree])).digest('hex');
            const replacement = join(root, '.cland/run/merge-batches', `dev-t3-upgrade-${identity}`);
            this.#preserveLegacy(candidate, error, replacement);
            candidate.cwd = replacement;
            gitFile = await stat(join(candidate.cwd, '.git')).catch(error => {
              if (error.code === 'ENOENT') return null;
              throw error;
            });
            if (gitFile && !gitFile.isDirectory()) throw new Error('replacement probe path is not a standalone clone; root preserved');
          }
        }
        if (gitFile?.isDirectory()) {
          // A no-checkout clone can already have the requested HEAD while its
          // index/worktree are empty. Repair only here, before any job exists.
          const complete = await (async () => {
            const head = await territoryGitAsync(candidate.cwd, ['rev-parse', 'HEAD'], false, undefined, env);
            const status = await territoryGitAsync(candidate.cwd, ['status', '--porcelain=v1', '--untracked-files=no'], false, undefined, env);
            return head === candidate.head && !status;
          })().catch(() => false);
          if (complete) { await prepareBatchDependencies(root, candidate.cwd); return; }
          await removeWorktreeWithFixtures(candidate.cwd, () => rm(candidate.cwd, { recursive: true, force: true }));
          gitFile = null;
        }
        if (!gitFile) {
          await mkdir(join(root, '.cland/run/merge-batches'), { recursive: true });
          await territoryGitAsync(root, ['clone', '--shared', '--no-checkout', '--', root, candidate.cwd], false, undefined, env);
          await territoryGitAsync(candidate.cwd, ['checkout', '--detach', candidate.head], false, undefined, env);
        }
        const head = await territoryGitAsync(candidate.cwd, ['rev-parse', 'HEAD'], false, undefined, env);
        if (head !== candidate.head) throw new Error('existing probe checkout differs from its durable head');
        await prepareBatchDependencies(root, candidate.cwd);
      },
      remove: async candidate => {
        const gitFile = await stat(join(candidate.cwd, '.git')).catch(error => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        if (gitFile?.isFile()) {
          try { await removeMergeBatch(root, candidate, env); }
          catch (error) {
            if (!(error instanceof CandidateOwnershipUnavailable)) throw error;
            // The worker's collected receipt remains authoritative even when
            // an old checkpoint supplies no authority to remove its checkout.
            this.#preserveLegacy(candidate, error, null);
          }
        }
        else if (gitFile) await removeWorktreeWithFixtures(candidate.cwd, () => rm(candidate.cwd, { recursive: true, force: true }));
      },
    };
  }
  #preserveLegacy(candidate: BatchCandidate, error: CandidateOwnershipUnavailable, replacement: string | null): void {
    const diagnostic = {
      cwd: candidate.cwd, head: candidate.head, tree: candidate.tree, cause: error.code, reason: error.message, replacement,
    };
    try { this.store.setMeta(`dev-t3-preserved-candidate:${candidate.cwd}`, JSON.stringify(diagnostic)); }
    catch (error) {
      const secondary = cleanupError(error);
      try { this.log({ event: 'dev-t3-preservation-diagnostic-failed', ...diagnostic, error: secondary }); }
      catch { /* an ancillary observer cannot replace the selected outcome */ }
      throw new PreservationDiagnosticFailure(diagnostic, secondary);
    }
  }
  async probe(input: DevT3Result, head: string, file: string, repetition?: 'boundary'): Promise<ProbeReceipt | null> {
    if (!diagnosticTestFile(file)) throw new Error('invalid batch diagnostic files');
    const key = `dev-t3-probe:${input.run}:${head}:${file}${repetition ? ':boundary' : ''}`;
    let candidate = JSON.parse(this.store.meta(key) ?? 'null') as BatchCandidate | null;
    if (!candidate) {
      const tree = await this.repository.identity(head);
      if (!tree) throw new Error(`probe tree unavailable at ${head}`);
      // Separate immutable checkout per commit/file: a restarted admission never rewrites a running worker.
      candidate = { base: input.previousGreenHead ?? input.head, head, tree, cwd: join(this.root, '.cland/run/merge-batches', `dev-t3-${createHash('sha256').update(key).digest('hex')}`), budgetLines: [] };
      this.store.setMeta(key, JSON.stringify(candidate));
    }
    const absence = this.store.meta(`${key}:absence`);
    if (absence) return JSON.parse(absence) as ProbeReceipt;
    let job = this.suites.findRun(job => job.devT3Probe?.key === key);
    if (!job) {
      if (!await this.repository.contains(head, file)) {
        const receipt: ProbeReceipt = { head, file, tree: candidate.tree, result: 'absent', run: null, artifact: null, path: null, reason: 'file absent from pinned commit; not executed' };
        this.store.setMeta(`${key}:absence`, JSON.stringify(receipt));
        return receipt;
      }
      await this.repository.checkout(candidate);
      // Checkout can retire a legacy path and relocate preparation. Admission
      // and restarted cleanup must retain the path actually given to the worker.
      this.store.setMeta(key, JSON.stringify(candidate));
      try {
        const run = await this.suites.start({ mode: 'all', cwd: candidate.cwd, topic: 'agents', to: ['coordinator'], actor: null,
          devT3Probe: { key, files: [file] }, executor: 'droplet', priority: 10, fresh: true }, () => {});
        if (!('id' in run)) throw new Error('probe needs an admitted suite');
        job = this.suites.findRun(job => job.id === run.id)!;
      } catch (error) {
        job = this.suites.findRun(job => job.devT3Probe?.key === key);
        if (!job) {
          try { await this.repository.remove(candidate); }
          catch (cleanup) { if (!(cleanup instanceof PreservationDiagnosticFailure)) throw cleanup; }
          throw error;
        }
      }
    }
    if (!job.reported) return null;
    const receipt = await this.suites.receipt(job.id);
    const artifact = this.store.resolveArtifact(receipt.job.artifact!);
    if (!artifact) throw new Error('probe artifact unavailable');
    const verdict = probeResult(receipt.job, receipt.log, file);
    if (receipt.job.head !== candidate.head || receipt.job.tree !== candidate.tree) throw new Error('probe does not match its immutable candidate');
    let reason: string | undefined;
    try { await this.repository.remove(candidate); }
    catch (error) {
      if (!(error instanceof PreservationDiagnosticFailure)) throw error;
      // Keep secondary context in the existing receipt, so the search's durable
      // checkpoint/report retains it even when the dedicated diagnostic cannot save.
      reason = cleanupError([('reason' in verdict ? verdict.reason : undefined), error.diagnostic.reason,
        `retained root ${error.diagnostic.cwd}; diagnostic persistence failed: ${error.secondary}`].filter(Boolean).join('; '));
    }
    return { head, file, run: job.id, ...verdict, artifact: artifact.id, path: artifact.path, ...(reason ? { reason } : {}) };
  }
}
/** Platform exclusions remain partial evidence, usable only beside a matching set. */
export function probeResult(job: Parameters<typeof diagnosticResult>[0] & { platform?: Platform }, log: string, file: string): ProbeVerdict {
  const diagnostic = diagnosticResult(job, log);
  if (diagnostic.result === 'inconclusive') return diagnostic;
  if (diagnostic.result === 'red' && !failingTests(log).some(identity => identity.split('::')[0] === file)) return { result: 'inconclusive', reason: 'no failure in the requested file' };
  for (const line of log.split('\n').filter(line => line.startsWith('suite progress '))) {
    try {
      const row = JSON.parse(line.slice('suite progress '.length));
      if (!row || typeof row.file !== 'string' || typeof row.name !== 'string' || typeof row.id !== 'string'
        || !Number.isInteger(row.nesting) || row.nesting < 0 || !Number.isFinite(row.at) || !['start', 'finish'].includes(row.event)
        || row.event === 'finish' && (!['pass', 'fail', 'skip', 'todo', 'cancelled'].includes(row.outcome) || !Number.isFinite(row.seconds) || row.seconds < 0)) throw new Error('invalid progress');
      if (row.file === file && row.event === 'finish' && (['todo', 'cancelled'].includes(row.outcome) || diagnostic.result === 'green' && row.outcome === 'fail')) return { result: 'inconclusive', reason: 'file has nonpassing execution receipts' };
    } catch { return { result: 'inconclusive', reason: 'malformed execution receipt' }; }
  }
  const progress = suiteProgress(log, 0);
  const completed = progress?.completed.filter(row => row.file === file) ?? [];
  if (progress?.unfinished.some(row => row.file === file) || quarantineResults(log).some(row => row.file === file && row.outcome !== 'pass')) return { result: 'inconclusive', reason: 'file lacks complete executed receipts' };
  const skipped = completed.filter(row => row.outcome === 'skip');
  const platformSkips: PlatformSkip[] = [];
  for (const line of log.split('\n').filter(line => line.startsWith('suite skip ') && !line.startsWith('suite skip details '))) {
    try {
      const row = JSON.parse(line.slice('suite skip '.length));
      if (!row || typeof row.file !== 'string' || typeof row.name !== 'string' || typeof row.reason !== 'string') throw new Error('invalid skip');
      if (row.file === file) platformSkips.push({ name: row.name, reason: row.reason });
    } catch { return { result: 'inconclusive', reason: 'malformed platform skip receipt' }; }
  }
  if (skipped.length || platformSkips.length) {
    // This exact Linux prerequisite is the known historical exclusion. Other
    // prerequisites need their own positive platform contract before comparison.
    if (job.platform?.os !== 'linux' || !job.platform.arch || platformSkips.some(skip => skip.reason !== 'needs macOS sandbox-exec')
      || skipped.some(row => row.type === 'suite') || skipped.length !== platformSkips.length
      || JSON.stringify(skipped.map(row => row.name).sort()) !== JSON.stringify(platformSkips.map(skip => skip.name).sort())) {
      return { result: 'inconclusive', reason: 'unknown platform skip or missing matching exclusion receipt' };
    }
    if (failingTests(log).some(identity => identity.startsWith(file + '::') && platformSkips.some(skip => skip.name === identity.slice(file.length + 2)))) return { result: 'inconclusive', reason: 'failing identity also has a platform skip receipt' };
  }
  if (diagnostic.result === 'green' && !completed.some(row => row.outcome === 'pass' && row.type !== 'suite')) return { result: 'inconclusive', reason: 'file lacks complete executed passing receipts' };
  if (platformSkips.length) return { result: 'partial', executed: diagnostic.result, platform: job.platform!, platformSkips: platformSkips.sort((a, b) => a.name.localeCompare(b.name) || a.reason.localeCompare(b.reason)) };
  return diagnostic;
}
