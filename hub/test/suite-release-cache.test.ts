// T2: release admission and cache notices through projectHub sockets, with
// durable fake receipts. No provider, Git or worker process is started.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import type { TopicMessage } from '../src/protocol.ts';
import { inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { verificationFixture } from './verification-fixture.ts';

for (const receipt of [
  { occasion: 'stage', executor: 'local', os: 'darwin', reuse: false },
  { occasion: 'release', executor: 'local', os: 'darwin', reuse: false },
  { occasion: 'release', executor: 'droplet', os: 'linux', reuse: true },
  { occasion: 'stage', executor: 'droplet', os: 'linux', reuse: true },
  { occasion: 'stage', executor: 'droplet', os: 'darwin', reuse: false },
  { occasion: 'release', executor: 'droplet', os: undefined, reuse: false },
] as const) test(`release cache admission: ${receipt.occasion} ${receipt.executor} ${receipt.os ?? 'unknown'} receipt`, async t => {
  const root = await tempProject(t, 'cland-release-cache-');
  // A cache miss reaches spend admission; keep that provider boundary synthetic.
  const spend = t.mock.method(DropletExecutor.prototype, 'checkSpend', async () => { throw new Error('cache miss reached provider admission'); });
  const clock = new FakeClock();
  await verificationFixture(root);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\nexecutor="droplet"\nlocal_fallback=false\n');
  const head = 'a'.repeat(40), tree = 'b'.repeat(40);
  const selection = { mode: 'full' as const, files: [], reason: 'integrated full', fetchedDev: head, soak: true, loadGate: true };
  const log = join(root, 'original.log');
  await writeFile(log, '# tests 1\n# pass 1\n');
  const store = new Store(join(root, '.cland/hub.db'));
  const artifact = store.registerArtifact(id => ({ id, title: 'Original receipt', kind: 'file', path: log, creator: 'hub', time: clock.now().toISOString(), topic: 'general', status: 'shared' }), () => {});
  const original: SuiteJob = {
    id: 'original', mode: 'all', cwd: root, topic: 'general', to: [], actor: null,
    head, tree, branch: 'dev', integrated: true, selection,
    commands: { prepare: '', check: '', test: 'true' }, workers: 4,
    log, result: join(root, 'result.json'), gate: join(root, 'ready'), pid: null, started: null,
    outcome: { code: 0, cause: 'executed' }, artifact: artifact.id,
    reported: true, error: null, state: 'finished', cleaned: true,
    finished: clock.now().toISOString(), occasion: receipt.occasion, executor: receipt.executor,
    ...(receipt.os ? { platform: { os: receipt.os, arch: 'arm64', release: 'fixture', node: process.version, nvim: 'none' } } : {}),
  };
  store.setMeta('suite-jobs', JSON.stringify([original])); store.close();
  const hub = await projectHub(t, root, {}, { clock, durationContext: null, candidate: {
    head: async () => head, tree: async () => tree,
    inspect: async () => ({ head, tree, branch: 'dev', selection, tierPlan: [], budgetBase: undefined }),
  } });
  const ui = await connectUi(t, hub.discovery, 'cli');
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord', role: 'coordinator', clock });
  await spoke.waitForPresence(['coord']);
  // Omit executor: the configured droplet policy must still reject Mac evidence.
  const submitted = await ui.request({ type: 'suite.start', as: { name: 'coord', sessionId: 'coord', shell: true }, mode: 'all', occasion: 'release', integrated: true, cwd: root, report: 'general', to: [] });
  if (!receipt.reuse) {
    assert.equal(submitted.ok, false, 'incompatible evidence must reach fresh provider admission');
    assert.equal(submitted.error, 'cache miss reached provider admission');
    assert.equal(spend.mock.callCount(), 1);
    return;
  }
  assert.equal(submitted.ok, true, submitted.error);
  assert.equal(spend.mock.callCount(), 0, 'compatible evidence avoids fresh provider admission');
  const result = submitted.value as { id: string; cached?: { run: string } };
  assert.equal(result.cached?.run, receipt.reuse ? original.id : undefined);
  if (receipt.reuse) {
    await hub.verificationSettled(); await clock.advance(1000); await hub.verificationSettled();
    const history = await ui.request({ type: 'topic.history', topic: 'general' });
    const report = (history.value as { messages: TopicMessage[] }).messages.find(m => m.id === `suite:${result.id}`);
    assert.ok(report, 'cache result has a durable topic receipt');
    assert.match(report.text, new RegExp(`Original occasion ${receipt.occasion} · executor droplet`));
    const cachedLog = await readFile(join(root, '.cland/run/suites', result.id, 'suite.log'), 'utf8');
    assert.match(cachedLog, new RegExp(`Original occasion ${receipt.occasion} · executor droplet`));
    if (receipt.occasion === 'stage') {
      const cli = await clandWithEnv(root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coord', CLAND_ROLE: 'coordinator' }, 'verify', 'all', '--occasion', 'release', '--report', 'general');
      assert.equal(cli.code, 0, cli.stderr);
      assert.match(cli.stdout, /cached from original .*original occasion stage executor droplet/);
    }
  }
});
