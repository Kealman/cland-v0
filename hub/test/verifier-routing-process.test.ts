// T3: a real Codex PID relaunch acknowledges its early clause before native resume publishes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeCodex, spawnSpoke, projectHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message, SendOutcome } from '../src/protocol.ts';

test('Codex relaunch injects an early accepted clause and frees the queued QA request without a nudge', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const launch = await ui.request({ type: 'session.launch', name: 'qa-d', role: 'qa', harness: 'codex' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const before = (launch.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.session === 'qa-d');
  await eventually('QA idle before relaunch', async () => {
    const { processes } = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return processes.find(p => p.name === 'qa-d')?.state === 'idle' || undefined;
  });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'QA after early relaunch hello' });
  await writeFile(join(fake.home, 'hold-thread-resume'), 'hold resume until the spoke accepts its clause');
  const mark = ui.frames.length;
  const resuming = ui.request({ type: 'session.resume', session: 'qa-d', relaunch: true }, 30_000);
  try {
    await ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'presence'
      && (f.sessions as Array<{ name: string }>).some(s => s.name === 'qa-d'));
    // The fake app-server's native resume barrier keeps the process row stopped
    // while the real spoke reconnects and acknowledges the role clause.
    await eventually('relaunch clause accepted before publication', async () => {
      await ui.request({ type: 'hub.status', flushLogs: true });
      const entries = (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter(line => line.startsWith('{'))
        .map(line => JSON.parse(line) as { event: string; session?: string; id?: string });
      const clause = entries.filter(e => e.event === 'role-clause' && e.session === 'qa-d').at(-1);
      return clause && entries.some(e => e.event === 'acked' && e.id === clause.id) || undefined;
    });
  } finally {
    await writeFile(join(fake.home, 'release-thread-resume'), 'publish the running process');
    await resuming;
  }
  const resumed = await resuming;
  assert.equal(resumed.ok, true, resumed.error);
  const after = (resumed.value as { process: HarnessProcessView }).process;
  assert.equal(after.sessionId, before.sessionId);
  assert.notEqual(after.pid, before.pid);
  const text = `qa request ${item.id}\nBuild after relaunch`;
  const sent = await coord.call<{ outcomes: SendOutcome[] }>('send', { to: ['qa'], text });
  assert.ok(['queued', 'delivered'].includes(sent.outcomes[0]!.outcome));
  const log = await eventually('relaunch clause and QA request injected without another message', async () => {
    const log = await fake.log(after.pid!);
    return log.includes('you hold the role QA') && log.includes(text) ? log : undefined;
  }, 5_000);
  assert.ok(log.indexOf('you hold the role QA') < log.indexOf(text));
  const inputs = (await readFile(join(fake.home, 'log', `${after.pid}.inputs.jsonl`), 'utf8')).trim().split('\n')
    .map(line => JSON.parse(line) as { text: string });
  assert.equal(inputs.filter(input => input.text.includes('you hold the role QA')).length, 1, 'clause consumed once');
  assert.equal(inputs.filter(input => input.text.includes(text)).length, 1, 'request consumed once');
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] };
  assert.deepEqual(history.messages.find(m => m.text === text)?.to, ['qa-d']);
});
