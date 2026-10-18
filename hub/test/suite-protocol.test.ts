// T2: one real CLI/socket frame proof for cover permissions, queue/status rendering
// and reload. Seeded suite receipts avoid workers; class permutations live in T1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { compatibilityHolder } from '../src/suite-lock.ts';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import type { HubStatus, VerificationQueue } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';

async function seed(t: Parameters<typeof tempProject>[0], make: (base: SuiteJob) => SuiteJob[], verification = '') {
  const root = await tempProject(t); const clock = new FakeClock();
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), `[verification]\nlock_path=${JSON.stringify(join(root, 'held-lock'))}\n${verification}`);
  await mkdir(join(root, 'held-lock'));
  const started = 'Sat Oct 17 12:00:00 2026';
  await writeFile(join(root, 'held-lock/holder.json'), JSON.stringify({ pid: process.pid, started, since: clock.now().toISOString(), token: 'hand', worktree: '/hand/worktree' }));
  const log = join(root, 'suite.log'); await writeFile(log, 'ℹ tests 1\nℹ fail 1\ntest at /home/runner/cland/hub/test/planned-stage.test.ts:208:1\n✖ stage landing query budget (6746ms)\n');
  const base: SuiteJob = { id: 'cover-0', mode: 'all', cwd: root, topic: 'general', to: [], actor: null, head: 'a'.repeat(40), branch: 'dev', log, result: '', gate: '', pid: null, started: null,
    outcome: { code: 1, cause: '' }, artifact: null, reported: true, error: null, state: 'finished', cleaned: true, integrated: true, executor: 'local', platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'none' },
    cover: { status: 'red', cause: 'test-failure', tests: ['hub/test/planned-stage.test.ts::stage landing query budget'] } };
  const store = new Store(join(root, '.cland/hub.db')); store.setMeta('suite-jobs', JSON.stringify(make(base))); store.close();
  const processes = { alive: (pid: number) => pid === process.pid, started: () => started };
  const holder = () => compatibilityHolder([join(root, 'held-lock')], {}, processes);
  const compatibility = { holder, occupied: async () => (await holder()) !== null };
  const hub = await projectHub(t, root, {}, { clock, compatibility, durationContext: null }); const ui = await connectUi(t, hub.discovery);
  return { root, clock, hub, ui, compatibility };
}

test('cover CLI enforces role permissions, journals classifications and renders persisted incident status', async t => {
  const f = await seed(t, base => Array.from({ length: 12 }, (_, i) => ({ ...base, id: `cover-${i}`, completedAt: new Date(Date.UTC(2026, 9, 16, 0, i)).toISOString(),
    ...(i < 11 ? { outcome: { code: 0, cause: '' }, cover: { status: 'green', cause: null, tests: [] } } : {}) })));
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await inProcessSpoke(t, { discover: true, assignRole: false, cwd: f.root, name: 'impl', sessionId: 'cover-cli', role: 'implementer' }); await spoke.waitForPresence(['impl']);
  const env = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'cover-cli' };
  const classify = (note: string) => clandWithEnv(f.root, env, 'verify', 'classify', 'cover-11', 'load-flake', '--note', note, '--json');
  for (const role of ['implementer', 'reviewer', 'qa', 'aide', 'lead']) {
    assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role })).ok, true);
    if (role === 'implementer') {
      // One CLI refusal proves shell attribution; the role table uses the same dispatcher frame.
      const denied = await classify('must not change');
      assert.equal(denied.code, 1); assert.match(denied.stderr, /Coordinator|coordinator/);
    } else {
      const denied = await f.ui.request({ type: 'suite.classify', suite: 'cover-11', cause: 'load-flake', note: 'must not change', as: { name: 'impl', sessionId: 'cover-cli', shell: true } });
      assert.equal(denied.ok, false); assert.match(denied.error!, /Coordinator|coordinator/);
    }
  }
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  assert.equal((await classify('   ')).code, 1);
  const changed = await classify('T-566 confirms a load flake'); assert.equal(changed.code, 0, changed.stderr); const record = JSON.parse(changed.stdout).cover;
  assert.equal(record.classification.by, 'impl'); assert.equal(record.derivedCause, 'test-failure');
  const human = await cland(f.root, 'verify', 'classify', 'cover-11', 'load-flake', '--note', 'Human confirms load evidence', '--json'); assert.equal(human.code, 0, human.stderr);
  assert.equal(JSON.parse(human.stdout).cover.derivedCause, 'test-failure');
  await f.ui.request({ type: 'hub.status', flushLogs: true });
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const changes = journal.filter(e => e.event === 'verification-cover-classified'); assert.equal(changes.length, 2); assert.deepEqual(changes[0].cover, record); assert.deepEqual(changes[1].cover, JSON.parse(human.stdout).cover);
  await spoke.close(); await f.hub.stop();
  const next = await projectHub(t, f.root, {}, { clock: f.clock, compatibility: f.compatibility, durationContext: null }); const ui = await connectUi(t, next.discovery);
  const status = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(status.suites!.find(j => j.id === 'cover-11')!.cover, JSON.parse(human.stdout).cover); assert.deepEqual(status.suites!.find(j => j.id === 'cover-11')!.outcome, { code: 1, cause: '' });
  assert.equal(status.covers!.length, 10);
  const shown = await cland(f.root, 'hub', 'status'); assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /covers: 10/); assert.match(shown.stdout, /cover-11.*red.*load-flake/); assert.match(shown.stdout, /cover-10.*green.*none/);
  assert.doesNotMatch(shown.stdout, /cover-0\b|cover-1\b|task-result|pending-cover/);
});

test('queue CLI and subscription expose ordered hand-held waiters; reload reports changed policy', async t => {
  const f = await seed(t, base => { const { cover: _cover, ...withoutCover } = base; return ['impl', 'other'].map((name, i) => ({ ...withoutCover, id: name, state: 'queued', reported: false, cleaned: false, outcome: null, integrated: false,
    queued: new Date(Date.UTC(2026, 9, 16, 11, i)).toISOString(), actor: { name, sessionId: name, shell: true } } as SuiteJob)); });
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const check = async (ui = f.ui, cliProof = true) => {
    let q: VerificationQueue;
    if (cliProof) {
      const cli = await cland(f.root, 'verify', 'queue', '--json'); assert.equal(cli.code, 0, cli.stderr);
      q = JSON.parse(cli.stdout) as VerificationQueue;
    } else q = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    assert.equal(q.holder?.kind, 'hand run'); assert.equal(q.holder?.pid, process.pid); assert.equal(q.holder?.worktree, '/hand/worktree');
    assert.deepEqual(q.waiters.map(w => [w.id, w.position, w.session]), [['impl', 1, 'impl'], ['other', 2, 'other']]);
    if (cliProof) {
      const text = await cland(f.root, 'verify', 'queue'); assert.equal(text.code, 0, text.stderr); assert.match(text.stdout, /local: hand run/); assert.match(text.stdout, /1\. impl.*wait .*ETA unknown/);
      assert.notEqual((await cland(f.root, 'verify', 'queue', '--fresh')).code, 0);
    }
  };
  await check();
  await f.clock.advance(1000);
  await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as VerificationQueue).waiters.length === 2);
  const path = join(f.root, '.cland/config.toml'); await writeFile(path, (await readFile(path, 'utf8')) + 'load_gate_workers=3\n');
  const reloaded = await cland(f.root, 'hub', 'reload'); assert.equal(reloaded.code, 0, reloaded.stderr); assert.match(reloaded.stdout, /verification.load_gate_workers/);
  await f.hub.stop(); const next = await projectHub(t, f.root, {}, { clock: f.clock, compatibility: f.compatibility, durationContext: null });
  const ui = await connectUi(t, next.discovery);
  await check(ui, false); // The same queue facts survive reopen; CLI rendering was proved above.
  assert.equal(((await ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters.length, 2);
});

test('a recovered integrated receipt posts the derived cover to the domain journal', async t => {
  const f = await seed(t, base => { const { cover: _cover, ...job } = base; return [{ ...job, reported: false }]; });
  await f.ui.request({ type: 'subscribe' });
  await f.clock.advance(1000);
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as { id: string }).id === 'suite:cover-0');
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const receipt = journal.find(e => e.event === 'suite-result' && e.id === 'cover-0');
  assert.deepEqual(receipt.cover, status.suites![0]!.cover); assert.equal(receipt.executor, 'local');
  for (const event of ['suite-result', 'verification-timing']) { const entry = journal.find(e => e.event === event && e.id === 'cover-0'); assert.equal(entry.executor, 'local'); assert.deepEqual(entry.platform, status.suites![0]!.platform); }
});

test('late lease confirmation posts one accounting correction in the original report topic', async t => {
  const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'settled', run: 'cover-0', name: 'cland-settled', tags: ['cland'],
    size: 'c-8', region: 'lon1', priceHourly: 0.25, keyName: 'settled', keyId: null, resource: 123,
    created: '2026-10-16T11:00:00Z', deadline: '2026-10-16T13:00:00Z', state: 'released', lifetimeMs: 60000, costUsd: 0.0042 };
  const f = await seed(t, base => [{ ...base, executor: 'droplet', lease, accountingPending: true,
    machine: { name: lease.name, size: lease.size, region: lease.region, lifetimeMs: null, costUsd: null } }]);
  await writeLease(f.root, lease);
  await f.ui.request({ type: 'subscribe' });
  await f.clock.advance(1000);
  const event = await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as { id: string }).id === 'suite-accounting:cover-0');
  const message = event.message as { text: string; topic: string };
  assert.equal(message.topic, 'general');
  assert.match(message.text, /suite accounting correction cover-0.*lifetime 60 s · cost \$0\.0042/);
  await f.clock.advance(2000);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { id: string }[] };
  assert.equal(history.messages.filter(message => message.id === 'suite-accounting:cover-0').length, 1);
});

test('scratch hub defaults to fixture leases without a project verification override', async t => {
  const root = await tempProject(t, 'cland-scratch-lease-');
  const { discovery } = await projectHub(t, root, { TZ: 'Pacific/Honolulu' }, { durationContext: null });
  const lock = join(root, 'suite.lock'); await mkdir(lock);
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: process.pid, started: null, token: 'scratch', worktree: root, since: '2026-10-12T00:00:00Z' }));
  const ui = await connectUi(t, discovery); const q = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(q.holder?.kind, 'hand run'); assert.equal(q.holder?.pid, process.pid); assert.equal(q.holder?.worktree, root);
});


test('remote queue CLI renders machines, fallback policy and remote-only waiter state', async t => {
  const f = await seed(t, base => {
    const { cover: _cover, ...job } = base;
    return [
      ...[1, 2].map(i => ({ ...job, id: `remote-${i}`, executor: 'droplet', state: 'running', outcome: null, reported: false, cleaned: false,
        admittedAt: '2026-10-16T11:59:00Z', lease: { kind: 'droplet', lease: `remote-${i}`, run: `remote-${i}`, name: `cland-remote-${i}`, size: 'c-8', region: 'lon1', created: '2026-10-16T11:59:00Z', deadline: '2026-10-16T12:15:00Z', resource: null } } as SuiteJob)),
      { ...job, id: 'fallback', state: 'running', outcome: null, reported: false, cleaned: false, actor: { name: 'fallback', sessionId: 'fallback', shell: true } },
      { ...job, id: 'waiting', executor: 'droplet', requestedExecutor: 'droplet', requireRemote: true, state: 'queued', outcome: null, reported: false, cleaned: false, actor: { name: 'waiting', sessionId: 'waiting', shell: true } },
    ];
  });
  await rm(join(f.root, 'held-lock'), { recursive: true });
  const text = await cland(f.root, 'verify', 'queue'); assert.equal(text.code, 0, text.stderr);
  assert.match(text.stdout, /^local: fallback/); assert.match(text.stdout, /remote 2\/4:/); assert.match(text.stdout, /droplet cland-remote-1 c-8 lon1/); assert.match(text.stdout, /droplet cland-remote-2 c-8 lon1/);
  assert.match(text.stdout, /1\. waiting .* · droplet .*waiting for remote/); assert.match(text.stdout, /local fallback: true/);
  const path = join(f.root, '.cland/config.toml'); await writeFile(path, (await readFile(path, 'utf8')) + 'local_fallback=false\n');
  assert.equal((await cland(f.root, 'hub', 'reload')).code, 0);
  assert.match((await cland(f.root, 'verify', 'queue')).stdout, /local fallback: false/);
});

test('recovered fallback notice keeps its warning severity and exact budget explanation', async t => {
  const f = await seed(t, base => { const { cover: _cover, ...job } = base; return [{ ...job, id: 'fallback', state: 'queued', outcome: null, reported: false, cleaned: false, fallback: 'remote budget full', requestedExecutor: 'droplet' }]; });
  await f.ui.request({ type: 'subscribe' }); await f.clock.advance(1000);
  const frame = await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as { id: string }).id === 'executor-fallback:fallback');
  const message = frame.message as { text: string; severity: string }; assert.equal(message.severity, 'warn'); assert.equal(message.text, 'verify fallback: remote budget 4/4 full; running locally');
});

test('dead-requester reports stay hub-authored once across role vacancy and store reopen', async t => {
  const f = await seed(t, base => { const { cover: _cover, ...job } = base; return [{ ...job, id: 'dead', state: 'queued', requesterDied: true, reported: false, outcome: { code: 130, cause: 'cancelled: requester died before admission' }, actor: { name: 'doomed', sessionId: 'gone', shell: true }, to: ['rev'] }]; });
  await f.ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' });
  const reviewer = await inProcessSpoke(t, { discover: true, assignRole: false, cwd: f.root, name: 'rev', sessionId: 'reviewer-id', role: 'reviewer' }); await reviewer.waitForPresence(['rev']);
  await f.ui.request({ type: 'subscribe' }); await f.clock.advance(1000);
  const frame = await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as { text: string }).text.startsWith('suite result dead'));
  const message = frame.message as { from: string; to: string[]; text: string }; assert.equal(message.from, 'hub'); assert.deepEqual(message.to, ['rev']); assert.match(message.text, /cancelled: requester died before admission/);
  await reviewer.close(); await f.hub.stop(); const next = await projectHub(t, f.root, {}, { clock: f.clock, compatibility: f.compatibility, durationContext: null }); const ui = await connectUi(t, next.discovery);
  await f.clock.advance(1000); const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { text: string }[] };
  assert.equal(history.messages.filter(m => m.text.startsWith('suite result dead')).length, 1);
});
