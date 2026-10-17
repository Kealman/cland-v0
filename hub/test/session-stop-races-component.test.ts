// T2 component: manual/post-merge stop classification across the grace boundary on a FakeClock.
// Native signal handling and OS descendant identity stay in session-stop-races.test.ts (T3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
import { FakeClock } from './fake-clock.ts';
import { remoteWaits } from './remote-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HarnessProcessView, EventsPage } from '../src/protocol.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

test('manual and post-merge stops remain stopped across graceful and forced completion', async t => {
  const root = await preparedProject(t);
  const clock = new FakeClock();
  const waits = remoteWaits(clock);
  const stopGraceMs = 100;
  const { discovery, fakes } = await projectHub(t, root, { CLAND_STOP_GRACE_MS: String(stopGraceMs) }, { harnesses: 'fake', clock });
  const fake = fakes.codex!;
  const stopAdapter = fake.stop;
  let activeDrain: (() => Promise<unknown>) | undefined;
  // Registered before sockets/peers: cancellation may run hooks while the body is unfinished.
  onCleanup(t, async () => { await activeDrain?.(); });
  const ui = await connectUi(t, discovery);
  for (const stop of ['manual', 'post-merge'] as const) for (const forced of [false, true]) {
    const name = `${stop}-${forced ? 'forced' : 'graceful'}`;
    const created = await ui.request({ size: 'M', type: 'task.create', title: name });
    assert.equal(created.ok, true, created.error);
    const item = (created.value as { item: { id: string } }).item.id;
    const launched = await ui.request({ type: 'session.launch', name, harness: 'codex', role: 'implementer', item });
    assert.equal(launched.ok, true, launched.error);
    const { process: row, worktree } = launched.value as { process: HarnessProcessView; worktree: { path: string } };
    const peer = await inProcessSpoke(t, { discover: true, cwd: worktree.path, name, sessionId: row.sessionId, launchToken: fake.spawns.at(-1)!.launchToken! });
    await peer.waitForPresence([name]);
    fake.idle(name);
    if (stop === 'post-merge') {
      await writeFile(join(worktree.path, 'README.md'), `${name}\n`);
      git(worktree.path, 'add', 'README.md');
      git(worktree.path, 'commit', '-qm', 'Ship');
    }
    const entered = Promise.withResolvers<void>();
    const completed = Promise.withResolvers<void>();
    let adapterWork: Promise<void> | undefined;
    fake.stop = (...args) => {
      const receipt = waits.wait(stopGraceMs + (forced ? 1 : 0));
      adapterWork = (async () => {
        entered.resolve();
        await receipt;
        await stopAdapter.call(fake, ...args);
        completed.resolve();
      })();
      return adapterWork;
    };
    let answered = false;
    let advancing = Promise.resolve();
    let request: ReturnType<typeof ui.request> | undefined;
    let draining: ReturnType<typeof ui.request> | undefined;
    const drain = () => draining ??= (async () => {
      try {
        await advancing;
        assert.ok(request, 'the request starts synchronously after its drain is registered');
        return await waits.run(request);
      } finally {
        try { if (adapterWork) await waits.run(adapterWork); }
        finally { fake.stop = stopAdapter; }
      }
    })();
    activeDrain = drain;
    request = ui.request(stop === 'manual' ? { type: 'session.stop', session: name } : { type: 'merge', item, override: 'Exercise post-merge stop classification' }, 30_000).then(result => { answered = true; return result; });
    try {
      await Promise.race([entered.promise, request.then(result => assert.fail(`stop did not reach the adapter: ${JSON.stringify(result)}`))]);
      if (!draining) advancing = clock.advance(stopGraceMs - 1);
      await advancing;
      const pending = await ui.request({ type: 'session.list' });
      assert.equal((pending.value as { processes: HarnessProcessView[] }).processes.find(p => p.sessionId === row.sessionId)?.status, 'running');
      assert.equal(answered, false, 'stop waits for the adapter completion receipt');
      const stopped = await drain();
      await completed.promise;
      assert.equal(stopped.ok, true, stopped.error);
      assert.equal((stopped.value as { followUp?: unknown }).followUp, undefined, JSON.stringify(stopped));
      if (stop === 'post-merge') {
        const view = await ui.request({ type: 'task.view', item });
        assert.equal((view.value as { item: { status: string } }).item.status, 'done');
      }
      // A later liveness observation cannot turn an acknowledged stop into a death.
      fake.exit(name);
      const list = await ui.request({ type: 'session.list' });
      assert.equal((list.value as { processes: HarnessProcessView[] }).processes.find(p => p.sessionId === row.sessionId)?.status, 'stopped');
      assert.equal(fake.stops.at(-1)!.sessionId, row.sessionId);
      assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
      const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
      assert.ok(log.includes(`"event":"session-stopped","session":"${name}"`));
      assert.doesNotMatch(log, /"event":"harness-exited"|"kind":"death"|its harness exited/);
      const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
      assert.ok(journal.includes(`"event":"session-stopped","session":"${name}"`));
      assert.doesNotMatch(journal, /"event":"harness-exited"/);
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const messages = (history.value as { messages: Array<{ kind: string; text: string }> }).messages;
      assert.equal(messages.some(m => m.kind === 'session-death'), false);
      assert.ok(messages.some(m => m.kind === 'role-revoke' && m.text.includes(name) && m.text.includes('its session was stopped')));
      const events = await ui.request({ type: 'events.list' });
      assert.equal((events.value as EventsPage).rows.some(r => r.warning && r.session === name), false);
    } finally { await drain(); }
    await peer.close();
  }
});
