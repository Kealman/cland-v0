// T3: native turn/brief delivery and stopped process rule injection.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { cland, connectUi, eventually, fakeClaude, fakeCodex, nativeProjectHub as projectHub, spawnSpoke, tempProject } from './harness.ts';
import type { Message } from '../src/protocol.ts';
import type { Rule } from '../src/rules/rulebook.ts';

test('shell rule changes reach fake Implementer turns, never steer, and show one event row without needs-you', async t => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t);
  const codex = await fakeCodex(t, { turnMs: 200 });
  const { discovery } = await projectHub(t, root, { ...claude.env, ...codex.env });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const launch = async (name: string, role: string, harness: string) => {
    const result = await ui.request({ type: 'session.launch', name, role, harness, brief: 'Read the task.' });
    assert.equal(result.ok, true, result.error);
    return (result.value as { process: { pid: number; sessionId: string } }).process;
  };
  const coord = await launch('coord', 'coordinator', 'claude-code');
  const impl = await launch('impl', 'implementer', 'codex');
  const idle = () => eventually('Implementer idle', async () => {
    const result = await ui.request({ type: 'session.list' });
    return (result.value as { processes: Array<{ name: string; state: string }> }).processes.find(p => p.name === 'impl')?.state === 'idle' || undefined;
  });
  await idle();
  const before = await ui.request({ type: 'inbox.list' });
  const run = async (...args: string[]) => { const r = await cland(root, 'rule', ...args); assert.equal(r.code, 0, r.stderr); };
  const turn = async (text: string) => {
    await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text });
    await eventually('rule carried into input', async () => (await codex.log(impl.pid)).includes(text) || undefined);
    await idle();
  };
  await run('add', 'Run serially.', '--scope', 'implementer', '--reason', 'contention');
  await ui.waitFor(f => f.type === 'rules.changed' && (f.rules as Rule[])[0]?.text === 'Run serially.');
  assert.doesNotMatch(await codex.log(impl.pid), /rule 1: Run serially/);
  await turn('Read added rule.');
  assert.match(await codex.log(impl.pid), /rule 1: Run serially\. \(scope: implementer; reason: contention\)/);
  await run('edit', '1', '--text', 'Read the queue.');
  await turn('Read edited rule.');
  assert.match(await codex.log(impl.pid), /rule 1: Read the queue/);
  await run('edit', '1', '--title', 'Read the queue before starting a suite.');
  await turn('Read renamed rule.');
  assert.match(await codex.log(impl.pid), /Title: Read the queue before starting a suite\./);
  // While an approval turn is blocked, even another steered report cannot carry the rule.
  await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'needs approval' });
  await ui.waitFor(f => f.type === 'session.state' && f.session === 'impl' && f.state === 'waiting for approval');
  await run('retire', '1', '--reason', 'finished');
  await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'steered report' });
  assert.doesNotMatch(await codex.log(impl.pid), /rule 1 retired/);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(codex.home, 'approve'), 'yes');
  await idle();
  await turn('Read retired rule.');
  assert.match(await codex.log(impl.pid), /rule 1 retired.*finished/);
  const coordinatorLog = await claude.log((await claude.sessions()).find(p => p.name === 'coord')!.id);
  assert.match(coordinatorLog, /Read the task/);
  assert.doesNotMatch(coordinatorLog, /rule 1/);
  const after = await ui.request({ type: 'inbox.list' });
  assert.equal((after.value as { needsYou: number }).needsYou, (before.value as { needsYou: number }).needsYou);
  const events = await ui.request({ type: 'events.list', filter: { kinds: ['rule'], subject: { kind: 'rule', id: '1' } } });
  assert.equal(events.ok, true, events.error);
  const rows = (events.value as { rows: Array<{ kind: string; subject: { kind: string; id: string } }> }).rows;
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => row.kind === 'rule' && row.subject.kind === 'rule' && row.subject.id === '1'));
});

test('launch clause and brief end with the same ordered active rules', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  for (const [text, scope] of [['First.', 'all'], ['Retired.', 'all'], ['Third.', 'implementer'], ['Other role.', 'coordinator']]) {
    assert.equal((await cland(root, 'rule', 'add', text!, '--scope', scope!, '--reason', 'launch policy')).code, 0);
  }
  assert.equal((await cland(root, 'rule', 'retire', '2', '--reason', 'old')).code, 0);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex', brief: 'Read this brief.' });
  assert.equal(launched.ok, true, launched.error);
  const { pid } = (launched.value as { process: { pid: number } }).process;
  const expected = 'Project rules for your role\nrule 1: First. (reason: launch policy)\nrule 3: Third. (reason: launch policy)';
  const log = await eventually('initial input has current rules twice', async () => {
    const log = await fake.log(pid);
    return log.includes('Read this brief.') ? log : undefined;
  });
  assert.equal(log.split(expected).length - 1, 2, 'one list in the clause and one in the brief');
  assert.doesNotMatch(log, /rule 2:|rule 4:/);
});

test('stopped processes receive no rule deliveries while live sessions still do', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const live = await spawnSpoke({ cwd: root, discover: true, name: 'live', role: 'implementer', sessionId: 'live-rules' });
  t.after(() => live.close());
  const launched = await ui.request({ type: 'session.launch', name: 'stopped', role: 'implementer', harness: 'codex' });
  assert.equal(launched.ok, true, launched.error);
  await live.waitForPresence(['live', 'stopped']);
  const stopped = await ui.request({ type: 'session.stop', session: 'stopped' });
  assert.equal(stopped.ok, true, stopped.error);
  // A remembered role is valid for the next launch, but must not make the stopped process a recipient.
  assert.equal((await ui.request({ type: 'role.set', session: 'stopped', role: 'implementer' })).ok, true);
  const added = await cland(root, 'rule', 'add', 'Only running sessions.', '--scope', 'implementer', '--reason', 'avoid stale queues');
  assert.equal(added.code, 0, added.stderr);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const notices = (history.value as { messages: Message[] }).messages.filter(m => m.detail?.event === 'rule');
  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0]!.to, ['live']);
});
