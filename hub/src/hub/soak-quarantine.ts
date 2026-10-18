import { createHash } from 'node:crypto';
import type { Git } from '../tracker/verdict-git.ts';
import { suiteProgress, type TestProgress } from '../suite-progress.ts';
import { quarantineResults } from '../suite-quarantine.ts';
import { failingTests } from './shared-defects.ts';
import { GENERAL, type HubCore, type TopicNotice } from './core.ts';
import type { SuiteJob } from './suites.ts';

type Green = { run: string; head: string; tree: string; log: { artifact: string; path: string } };
export type QuarantineProposal = { identity: string; run: string; tree: string; lastGreen: Green; log: { artifact: string; path: string } };

/** A proposal is evidence for the Coordinator, never an automatic manifest edit. */
export function quarantineProposal(proposal: QuarantineProposal): TopicNotice {
  return {
    id: `quarantine-proposal:${createHash('sha256').update(`${proposal.run}:${proposal.identity}`).digest('hex')}`,
    kind: 'report', to: ['coordinator'], detail: { event: 'quarantine-proposal', ...proposal },
    text: `quarantine proposal ${proposal.identity}\nTree ${proposal.tree} · run ${proposal.run}\nLast green ${proposal.lastGreen.run} · head ${proposal.lastGreen.head}\nLast green log ${proposal.lastGreen.log.artifact}: ${proposal.lastGreen.log.path}\nLog ${proposal.log.artifact}: ${proposal.log.path}\nNo code change since its last green. Coordinator: establish two independent failure receipts and five isolated greens, then file an owner item with a non-TODO reason and expiry within seven days before adding quarantine.json.`,
  };
}

const KEY = 'test-last-green';
// Conservative: changes anywhere in executable code can explain a formerly green
// test. Documentation-only changes can expose a flake; unknown Git facts cannot.
const CODE = ['hub', 'nvim', 'shared', 'test-support', 'package.json', 'package-lock.json'];

export async function reportSoakQuarantine(core: HubCore, job: Readonly<SuiteJob>, log: string, artifact: { id: string; path: string }, git: Git): Promise<void> {
  if (job.cached || job.cancelled || job.requesterDied || !job.tree || !job.outcome) return;
  const history = JSON.parse(core.store.meta(KEY) ?? '{}') as Record<string, Green>;
  if (job.outcome.code === 0) {
    // Timing rows also describe skipped/TODO tests. Only outcome receipts can
    // establish a green; legacy logs without them supply no per-test evidence.
    const progress = suiteProgress(log, 0);
    if (!progress) return;
    // The interruption projection intentionally drops cancelled finishes. Keep
    // them even when the reporter lost the start; unknown receipts prove no green.
    const cancellations: TestProgress[] = [];
    for (const line of log.split('\n').filter(line => line.startsWith('suite progress '))) {
      let row: TestProgress;
      try { row = JSON.parse(line.slice('suite progress '.length)) as TestProgress; } catch { return; }
      if (!row || typeof row.file !== 'string' || typeof row.name !== 'string' || typeof row.id !== 'string'
        || !Number.isInteger(row.nesting) || row.nesting < 0 || !Number.isFinite(row.at)
        || !['start', 'finish'].includes(row.event)) return;
      if (row.event === 'finish' && (!['pass', 'fail', 'skip', 'todo', 'cancelled'].includes(row.outcome ?? '') || !Number.isFinite(row.seconds) || row.seconds! < 0)) return;
      if (row.event === 'finish' && row.outcome === 'cancelled') cancellations.push(row);
    }
    const blocked = new Set([...failingTests(log), ...quarantineResults(log)
      .filter(test => test.outcome !== 'pass').map(test => `${test.file}::${test.name}`)]);
    const byFile = new Map<string, TestProgress[]>();
    for (const row of [...progress.completed, ...progress.unfinished, ...cancellations]) {
      const rows = byFile.get(row.file) ?? [];
      rows.push(row); byFile.set(row.file, rows);
    }
    const unknownAncestry = new Set<string>();
    for (const [file, rows] of byFile) {
      const parents = [...new Set(rows.filter(row => row.nesting === 0 && row.type !== 'file').map(row => row.name))];
      if (rows.some(row => row.nesting > 0 && parents.filter(name => row.name.startsWith(`${name} > `)).length !== 1)) unknownAncestry.add(file);
    }
    for (const test of progress.completed.filter(test => test.nesting === 0 && test.outcome === 'pass')) {
      const identity = `${test.file}::${test.name}`;
      const rows = byFile.get(test.file)!;
      // Legacy Node events lack parent IDs and may leave nested names unqualified.
      // A child whose parent is unknown withholds evidence for the whole file.
      if (unknownAncestry.has(test.file)) continue;
      const belongs = (row: TestProgress) => row.type === 'file' || row.name === test.name || row.nesting > 0 && row.name.startsWith(`${test.name} > `);
      if (blocked.has(identity) || rows.some(row => belongs(row) && (row.event !== 'finish' || row.outcome !== 'pass'))) continue;
      history[identity] = { run: job.id, head: job.head, tree: job.tree, log: { artifact: artifact.id, path: artifact.path } };
    }
    core.store.setMeta(KEY, JSON.stringify(history));
    return;
  }
  if (job.occasion !== 'soak') return;
  const unchanged = new Map<string, boolean>();
  for (const identity of failingTests(log)) {
    const lastGreen = history[identity];
    if (!lastGreen) continue;
    if (!unchanged.has(lastGreen.head)) {
      unchanged.set(lastGreen.head, await git(['merge-base', '--is-ancestor', lastGreen.head, job.head]).then(result => result !== null, () => false)
        && await git(['diff', '--quiet', lastGreen.head, job.head, '--', ...CODE]).then(result => result === '', () => false));
    }
    if (!unchanged.get(lastGreen.head)) continue;
    const proposal = quarantineProposal({ identity, run: job.id, tree: job.tree, lastGreen, log: { artifact: artifact.id, path: artifact.path } });
    if (!core.noticeTo(GENERAL.id, { ...proposal, text: core.boundedText(proposal.text) })) throw new Error('quarantine proposal topic unavailable');
  }
}
