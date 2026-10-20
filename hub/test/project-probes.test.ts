// T2 component: census of imports, projectHub's socket edges and in-process adapters.
// child_process is observed here, never invoked by the test; native probe coverage stays in T3.
import test, { after, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

// Keep one observation window across imports and both tests: imported modules may
// retain a promisified child_process function even after syncBuiltinESMExports.
let observation: ReturnType<typeof startObservation> | undefined;
let finishObservation = () => {};
after(() => finishObservation());
async function observeChildren(t: TestContext) {
  const seen = await (observation ??= startObservation());
  seen.afterCleanup(t, () => {
    t.diagnostic(`spawn census hub/test/project-probes.test.ts: ${Object.values(seen.census).reduce((sum, count) => sum + count, 0)} child processes (imports, launch, signals, stop, teardown)`);
    assert.deepEqual(seen.census, {}, 'spawn census row must contain zero children, including imports and cleanup');
  });
  return seen;
}

async function startObservation() {
  const census: Record<string, number> = {};
  const originals = new Map<string, Function>();
  for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
    const original = cp[method];
    originals.set(method, original);
    const wrapped = function (this: unknown, ...args: unknown[]) {
      census[method] = (census[method] ?? 0) + 1;
      return Reflect.apply(original, this, args);
    };
    // Node's custom promisifiers otherwise bypass the exported function wrapper.
    const custom = Reflect.get(original, promisify.custom);
    if (typeof custom === 'function') Object.defineProperty(wrapped, promisify.custom, { value: function (this: unknown, ...args: unknown[]) {
      census[method] = (census[method] ?? 0) + 1;
      return Reflect.apply(custom, this, args);
    } });
    Reflect.set(cp, method, wrapped);
  }
  syncBuiltinESMExports();
  finishObservation = () => {
    try { assert.deepEqual(census, {}, 'the complete file observation window contains zero children'); }
    finally { for (const [method, original] of originals) Reflect.set(cp, method, original); syncBuiltinESMExports(); }
  };
  // Import inside the observation window: eager ps probes count too.
  const { connectUi, projectHub, tempProject } = await import('./harness.ts');
  const { afterCleanup } = await import('./process-cleanup.ts');
  return { connectUi, projectHub, tempProject, afterCleanup, census };
}

test('importing the project harness starts zero child processes', async t => {
  await observeChildren(t);
});

test('projectHub defaults launch, signal and stop every harness with zero child processes', async t => {
  const { connectUi, projectHub, tempProject } = await observeChildren(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock });
  await assert.rejects(projectHub(t, root, {}, { clock: new FakeClock() }), /a hub already runs/);
  const { discovery, fakes } = hub;
  const ui = await connectUi(t, discovery);
  const list = async (name: string) => {
    const reply = await ui.request({ type: 'session.list' });
    assert.equal(reply.ok, true, reply.error);
    return (reply.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === name)!;
  };
  for (const flavour of ['claude-code', 'codex', 'opencode'] as const) {
    const name = flavour;
    const fake = fakes[flavour]!;
    const launch = await ui.request({ type: 'session.launch', name, role: 'implementer', harness: flavour });
    assert.equal(launch.ok, true, launch.error);
    assert.equal((await list(name)).pid, null);
    fake.busy(name);
    assert.equal((await list(name)).state, 'busy');
    fake.turn(name, { afterMs: 100 });
    await clock.advance(100);
    assert.equal((await list(name)).state, 'idle');
    const stop = await ui.request({ type: 'session.stop', session: name });
    assert.equal(stop.ok, true, stop.error);
    assert.equal((await list(name)).status, 'stopped');
    assert.equal(fake.stops.length, 1);
  }
  await hub.stop();
  assert.equal(clock.pending, 0);

  // The same census includes nonempty Git facts, configuration reload and the
  // territory base reader. Injecting branch tips alone must not fall through to Git.
  const { mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const factsRoot = await tempProject(t);
  await mkdir(join(factsRoot, '.cland/territory.git'), { recursive: true });
  let commit = 'a'.repeat(40);
  let bare = false;
  const baseRead = Promise.withResolvers<void>();
  const facts = await projectHub(t, factsRoot, {}, {
    clock: new FakeClock(),
    git: async args => {
      if (args[0] === 'rev-parse' && args[1] === '--is-bare-repository') return String(bare);
      if (args[0] === 'log') return commit;
      if (args[0] === 'for-each-ref') return `${'b'.repeat(40)} refs/heads/dev`;
      assert.fail(`unexpected Git read: ${args[0]}`);
    },
    readBase: async tips => {
      assert.equal(tips.get('dev'), 'b'.repeat(40));
      baseRead.resolve();
      return 'dev';
    },
  });
  await baseRead.promise;
  const factsUi = await connectUi(t, facts.discovery);
  const status = await factsUi.request({ type: 'hub.status' });
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { config: { sourceCommit: string } }).config.sourceCommit, commit);
  const made = await factsUi.request({ type: 'task.create', title: 'Injected branch facts', size: 'S' });
  assert.equal(made.ok, true, made.error);
  assert.equal((made.value as { item: { verdictBase: string } }).item.verdictBase, 'dev');
  const item = (made.value as { item: { id: string } }).item.id;
  const claimed = await factsUi.request({ type: 'task.claim', item });
  assert.equal(claimed.ok, true, claimed.error);
  assert.equal((claimed.value as { worktree: unknown }).worktree, null);
  const merged = await factsUi.request({ type: 'merge', item });
  assert.equal(merged.ok, false);
  assert.equal((merged as { code?: string }).code, 'merge-branch', 'the ordinary merge preflight runs without a native lock probe');
  bare = true;
  const bareMerge = await factsUi.request({ type: 'merge', item });
  assert.equal(bareMerge.ok, false);
  assert.equal((bareMerge as { code?: string }).code, 'merge-bare');
  assert.ok(bareMerge.error?.includes(`core.bare=true in project root ${factsRoot}`));
  commit = 'c'.repeat(40);
  const reload = await factsUi.request({ type: 'hub.reload' });
  assert.equal(reload.ok, true, reload.error);
  assert.equal((reload.value as { sourceCommit: string }).sourceCommit, commit);

});
