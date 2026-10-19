// T2 fixture: production sockets, dispatcher and Suites; candidate facts and local
// executor receipts are injected. No package command or infrastructure process runs.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import { SuiteAdmissionError, type SuiteCandidate } from '../src/hub/suite-candidate.ts';
import { lintHubShards, type TierManifest } from '../src/suite-shards.ts';
import { checkTestLint, TestLintError } from '../src/test-lint-policy.ts';
import type { DurationBudgetContext } from '../src/suite-duration-budget.ts';
import type { SuiteSelection } from '../src/suite-selection.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import type { ResultMessage } from './suite-fixture.ts';
import { verificationFixture } from './verification-fixture.ts';

export async function fixture(t: TestContext, code = 0, config = '', withDurations = false) {
  const root = await tempProject(t, 'cland-suite-component-');
  await mkdir(join(root, '.cland'), { recursive: true });
  await verificationFixture(root, { typecheck: 'true', testScript: 'true' });
  await writeFile(join(root, '.cland/config.toml'), `${config}\n[verification]\ncheck="npm run typecheck"\ntest="npm test"\nbudget=1\nlock_path=${JSON.stringify(join(root, 'suite.lock'))}\n`);
  const clock = new FakeClock();
  const facts = { head: 'a'.repeat(40), branch: 'candidate', tree: 'b'.repeat(40),
    selection: { mode: 'full', files: [], reason: 'fixture' } as SuiteSelection };
  const trees = new Map<string, string>();
  const legacyKeys = new Set<string>();
  const manifest = { version: 1 as const, source: { artifacts: [], commit: facts.head }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {} };
  const durationContext: DurationBudgetContext = { manifest, tiers: {}, base: { manifest: structuredClone(manifest), tiers: {}, retained: [], sources: {} } };
  let captureBarrier = async () => {};
  let inspectBarrier = async () => {};
  let immutableCheck = async (_head: string) => {};
  const candidate: SuiteCandidate = {
    head: async () => facts.head, tree: async cwd => trees.get(cwd) ?? facts.tree,
    inspect: async (cwd, mode) => {
      await captureBarrier();
      const captured = { ...structuredClone(facts), tree: trees.get(cwd) ?? facts.tree };
      await inspectBarrier();
      try {
        await immutableCheck(captured.head);
        await lintHubShards(cwd, { legacyKeys });
        const text = await readFile(join(cwd, 'hub/test/tiers.json'), 'utf8').catch(() => null);
        if (text) {
          const findings = await checkTestLint({ manifest: JSON.parse(text) as TierManifest, source: file => readFile(join(cwd, file), 'utf8') });
          if (findings.length) throw new TestLintError(findings);
        }
      } catch (error) { throw new SuiteAdmissionError(error); }
      if (mode !== 'auto') captured.selection = { ...captured.selection,
        mode: mode === 'all' ? 'full' : mode === 'hub' ? 'hub-only' : 'nvim-only',
        reason: mode === 'all' ? '--all / all forces full' : 'explicit package' };
      return { ...captured, tierPlan: [], budgetBase: undefined };
    },
  };
  const receipts = new Map<string, RunStatus>(), executions: RunRef[] = [];
  const exists = (file: string) => access(file).then(() => true, () => false);
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', () => exists(join(root, 'suite.lock')));
  t.mock.method(LocalExecutor.prototype, 'restore', (run: RunRef): Lease => ({ kind: 'local', run: run.id, created: clock.now().toISOString(), deadline: clock.now().toISOString(), resource: run }));
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<Lease> => ({ kind: 'local', run: run.id, created: clock.now().toISOString(), deadline, resource: run }));
  t.mock.method(LocalExecutor.prototype, 'prepare', async () => {});
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  let workerCode = code;
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
    executions.push(structuredClone(run));
    await writeFile(run.log, `selection ${JSON.stringify(run.selection)}\n# tests 1\n# pass ${workerCode === 0 ? 1 : 0}\n`);
    receipts.set(run.id, { state: 'done', code: workerCode, finished: clock.now().toISOString(), platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'none' } });
  });
  t.mock.method(LocalExecutor.prototype, 'status', async (lease: Lease) => receipts.get(lease.run) ?? { state: 'running' });
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  let hub = await projectHub(t, root, {}, { clock, candidate, durationContext: withDurations ? durationContext : null, selectSuite: async () => structuredClone(facts.selection) });
  let ui = await connectUi(t, hub.discovery, 'cli');
  await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' });
  await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' });
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'suite-caller', role: 'implementer', clock });
  await spoke.waitForPresence(['impl']);
  const made = await ui.request({ type: 'task.create', size: 'M', title: 'fixture', assignee: 'impl' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const madeTopic = await ui.request({ type: 'topic.create', title: 'Suite fixture', item });
  assert.equal(madeTopic.ok, true, madeTopic.error);
  const topic = (madeTopic.value as { topic: { id: string } }).topic.id;
  const settle = async () => {
    await hub.verificationSettled();
    await clock.advance(1000);
    await hub.verificationSettled();
  };
  const results = async () => {
    await settle();
    const history = await ui.request({ type: 'topic.history', topic });
    assert.equal(history.ok, true, history.error);
    return (history.value as { messages: ResultMessage[] }).messages.filter(m => m.text.startsWith('suite result '));
  };
  const launch = async (mode = 'auto', ...options: string[]) => {
    const result = await ui.request({ type: 'suite.start', as: { name: 'impl', sessionId: 'suite-caller', shell: true }, mode: mode === '--all' ? 'all' : mode, fresh: options.includes('--fresh'), cwd: root, report: topic, to: ['rev', 'impl'] });
    assert.equal(result.ok, true, result.error);
    return result.value as { id: string; pid: number | null; position: number; cached?: { run: string; head: string; tree: string } };
  };
  return { root, facts, trees, candidate, clock, legacyKeys, durationContext, topic, spoke, executions, receipts, results, launch, settle,
    env: { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'suite-caller', CLAND_ROLE: 'implementer' },
    get ui() { return ui; },
    code(value: number) { workerCode = value; },
    beforeCapture(barrier: () => Promise<void>) { captureBarrier = barrier; },
    beforeInspect(barrier: () => Promise<void>) { inspectBarrier = barrier; },
    immutable(check: (head: string) => Promise<void>) { immutableCheck = check; },
    async reopen() {
      await hub.verificationSettled();
      ui.close(); await hub.stop();
      hub = await projectHub(t, root, {}, { clock, candidate, durationContext: withDurations ? durationContext : null, selectSuite: async () => structuredClone(facts.selection) });
      ui = await connectUi(t, hub.discovery, 'cli');
    },
  };
}
