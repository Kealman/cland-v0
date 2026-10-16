import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { cland, connectUi, eventually, fakeClaude, fakeCodex, projectHub, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { Message } from '../src/protocol.ts';
import type { Rule } from '../src/rules/rulebook.ts';

test('rule tools and CLI preserve long titles and announce title-only edits to running sessions', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const aide = await spawnSpoke({ cwd: root, discover: true, name: 'helper', role: 'aide', sessionId: 'title-aide' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'title-impl' });
  t.after(async () => { await aide.close(); await impl.close(); });
  await aide.waitForPresence(['helper', 'impl']);
  const tool = (await aide.client.listTools()).tools.find(tool => tool.name === 'rule.edit')!;
  type Result = { ok: boolean; error?: string; rule: Rule; rules: Rule[] };
  const title = 'The crew decides the stack, the architecture, the test strategy and every other technical question in the project.';
  const text = `${title}\nExplain those decisions to the human.`;
  const added = await aide.call<Result>('rule.add', { text, scope: 'implementer', reason: 'delegation' });
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.equal(added.rule.title, title);
  assert.equal(added.rule.text, text);
  assert.deepEqual(tool.inputSchema.properties?.title, { type: 'string' });
  const run = async (...args: string[]) => {
    const result = await cland(root, 'rule', ...args, '--json');
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout) as Result;
  };
  const shellRule = (await run('add', text, '--scope', 'implementer', '--reason', 'delegation')).rule;
  assert.equal(shellRule.title, title);
  assert.equal(shellRule.text, text);
  const explicit = await aide.call<Result>('rule.add', { text: 'Keep this body.', title, scope: 'all', reason: 'explicit title' });
  assert.equal(explicit.rule.title, title);
  assert.equal((await run('add', 'Keep this body.', '--title', title, '--scope', 'all', '--reason', 'explicit title')).rule.title, title);
  for (const [number, changedTitle] of [[1, `${title} Revised through the tool.`], [2, `${title} Revised through the CLI.`]] as const) {
    const offset = ui.frames.length;
    const edited = number === 1
      ? await aide.call<Result>('rule.edit', { number, title: changedTitle })
      : await run('edit', String(number), '--title', changedTitle);
    if (number === 1) assert.equal(edited.ok, true, JSON.stringify(edited));
    assert.equal(edited.rule.title, changedTitle);
    assert.equal(edited.rule.text, text, 'a title-only edit preserves the body');
    assert.equal(edited.rule.reason, 'delegation');
    assert.equal(edited.rule.origin, number === 1 ? 'session:helper' : 'shell');
    const notice = await ui.waitFor(f => f.type === 'message' && (f.message as Message).detail?.event === 'rule' && (f.message as Message).text.includes(changedTitle));
    const message = notice.message as Message;
    assert.deepEqual(message.to, ['impl']);
    assert.equal(message.detail?.digest, 'turn');
    assert.equal(message.layer, 'background');
    assert.equal(ui.frames.slice(offset).filter(f => f.type === 'message' && (f.message as Message).detail?.event === 'rule').length, 1);
    const listed = await impl.call<Result>('rule.list');
    assert.equal(listed.rules.find(rule => rule.number === number)?.title, changedTitle);
    assert.ok((await readFile(join(root, '.cland/RULES.md'), 'utf8')).includes(`## ${number} ${changedTitle}\n`));
  }
  const path = join(root, '.cland/RULES.md');
  const before = await readFile(path, 'utf8');
  for (const invalid of ['', '   ', 'Title\ninjection', 'Title\rinjection']) {
    const refused = await aide.call<Result>('rule.edit', { number: 1, title: invalid });
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /title must (not be empty|be one line)/);
    assert.equal(await readFile(path, 'utf8'), before);
  }
});

test('role clauses use current scoped active rules, including rules added while disconnected', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const add = (text: string, scope: string) => cland(root, 'rule', 'add', text, '--scope', scope, '--reason', 'shared policy');
  assert.equal((await add('Run serially.', 'implementer')).code, 0);
  assert.equal((await add('Coordinator only.', 'coordinator')).code, 0);
  let impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'rule-impl', role: 'implementer' });
  t.after(() => impl.close());
  const clause = await impl.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.ok(clause.params.content.endsWith('Project rules for your role\nrule 1: Run serially. (reason: shared policy)'));
  assert.doesNotMatch(clause.params.content, /Coordinator only/);
  await impl.close();
  assert.equal((await cland(root, 'rule', 'retire', '1', '--reason', 'replaced')).code, 0);
  assert.equal((await add('Use the new policy.', 'all')).code, 0);
  impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'rule-impl', role: 'implementer' });
  const current = await impl.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.ok(current.params.content.endsWith('rule 3: Use the new policy. (reason: shared policy)'));
  assert.doesNotMatch(current.params.content, /Run serially/);
});

test('rule tools record human-message and Aide origins, refuse invented origins, and allow every role to read', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'rules-coord' });
  const aide = await spawnSpoke({ cwd: root, discover: true, name: 'helper', role: 'aide', sessionId: 'rules-aide' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'rules-impl' });
  t.after(async () => { await coord.close(); await aide.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'helper', 'impl']);
  const human = await ui.request({ type: 'topic.send', topic: 'general', text: 'Run one suite at a time.' });
  assert.equal(human.ok, true);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  const message = (history.value as { messages: Message[] }).messages.find(m => m.fromKind === 'human')!;
  const origin = { topic: 'general', msg_id: message.id };
  type Result = { ok: boolean; code?: string; reason?: string; rule: Rule; rules: Rule[] };
  const args = { text: 'Run one suite.', scope: 'implementer', reason: 'contention', origin };
  const added = await coord.call<Result>('rule.add', args);
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.equal(added.rule.origin, `message:general/${message.id}`);
  await coord.call('send', { topic: 'general', to: ['impl'], text: 'Agent opinion.' });
  const agentHistory = await ui.request({ type: 'topic.history', topic: 'general' });
  const agent = (agentHistory.value as { messages: Message[] }).messages.find(m => m.fromKind === 'agent' && m.text === 'Agent opinion.')!;
  assert.ok(agent);
  for (const invalid of [undefined, { topic: 'general', msg_id: 'absent' }, { topic: 'agents', msg_id: message.id }, { topic: 'general', msg_id: agent.id }, 'shell']) {
    for (const [tool, input] of [['rule.add', args], ['rule.edit', { number: 1, text: 'Edited.' }], ['rule.retire', { number: 1, reason: 'retired' }]] as const) {
      const refused = await coord.call<Result>(tool, { ...input, origin: invalid });
      assert.equal(refused.code, 'forbidden', JSON.stringify(refused));
      assert.match(refused.reason!, /human.*message/);
    }
  }
  const refused = await impl.call<Result>('rule.add', args);
  assert.equal(refused.code, 'forbidden');
  assert.match(refused.reason!, /propose.*Coordinator.*item topic/);
  const aideRule = await aide.call<Result>('rule.add', { ...args, origin: { topic: 'fake', msg_id: 'fake' } });
  assert.equal(aideRule.ok, true, JSON.stringify(aideRule));
  assert.equal(aideRule.rule.origin, 'session:helper');
  const edited = await aide.call<Result>('rule.edit', { number: 1, scope: 'aide', reason: 'delegated' });
  assert.equal(edited.rule.origin, 'session:helper');
  const retired = await coord.call<Result>('rule.retire', { number: 2, reason: 'finished', origin });
  assert.equal(retired.rule.origin, 'session:helper');
  assert.equal(retired.rule.retired_origin, `message:general/${message.id}`);
  for (const spoke of [coord, aide, impl]) {
    assert.deepEqual((await spoke.call<Result>('rule.list')).rules.map(r => r.number), [1]);
    assert.equal((await spoke.call<Result>('rule.list', { role: 'coordinator' })).rules.length, 0);
    assert.deepEqual((await spoke.call<Result>('rule.list', { all: true, role: 'aide' })).rules.map(r => r.number), [1]);
    const listed = (await spoke.call<Result>('rule.list', { all: true })).rules.find(r => r.number === 2)!;
    assert.equal(listed.origin, 'session:helper');
    assert.equal(listed.retired_origin, `message:general/${message.id}`);
  }
  for (const args of [['show', '2'], ['list', '--all']]) {
    const result = await cland(root, 'rule', ...args);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Origin: session:helper\n/);
    assert.ok(result.stdout.includes(`Retired-origin: message:general/${message.id}\n`));
    const json = await cland(root, 'rule', ...args, '--json');
    assert.equal(json.code, 0, json.stderr);
    const value = JSON.parse(json.stdout) as Result;
    const rule = value.rule ?? value.rules.find(r => r.number === 2)!;
    assert.equal(rule.origin, 'session:helper');
    assert.equal(rule.retired_origin, `message:general/${message.id}`);
  }
});

test('shell rule changes reach fake Implementer turns, never steer, and show one event row without needs-you', async t => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t);
  const codex = await fakeCodex(t, { turnMs: 200 });
  const { discovery } = await startDaemon(t, root, { ...claude.env, ...codex.env });
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

test('scope edits retire rules for removed roles, directly include Aides, and hand edits use the same change path', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const spokes = [];
  for (const role of ['implementer', 'aide', 'lead', 'reviewer', 'qa']) {
    const spoke = await spawnSpoke({ cwd: root, discover: true, name: `rules-${role}`, role, sessionId: `rules-${role}` });
    spokes.push(spoke);
    t.after(() => spoke.close());
  }
  await spokes[0]!.waitForPresence(['rules-implementer', 'rules-aide', 'rules-lead', 'rules-reviewer', 'rules-qa']);
  const added = await cland(root, 'rule', 'add', 'Original policy.', '--scope', 'implementer', '--reason', 'policy');
  assert.equal(added.code, 0, added.stderr);
  const before = await ui.request({ type: 'inbox.list' });
  const offset = ui.frames.length;
  assert.equal((await cland(root, 'rule', 'edit', '1', '--scope', 'aide')).code, 0);
  const notices = ui.frames.slice(offset).filter(f => f.type === 'message' && (f.message as Message).detail?.event === 'rule').map(f => f.message as Message);
  assert.equal(notices.length, 2);
  assert.deepEqual(notices.find(m => m.text.startsWith('rule 1 retired'))?.to, ['rules-implementer']);
  assert.deepEqual(notices.find(m => m.text.startsWith('rule 1:'))?.to, ['rules-aide']);
  assert.ok(notices.every(m => m.detail?.digest === 'turn' && m.layer === 'background'));
  const after = await ui.request({ type: 'inbox.list' });
  assert.equal((after.value as { needsYou: number }).needsYou, (before.value as { needsYou: number }).needsYou);
  const { writeFile } = await import('node:fs/promises');
  const path = join(root, '.cland/RULES.md');
  await writeFile(path, (await readFile(path, 'utf8')).replace('\n\nOriginal policy.\n', '\n\nHand edited policy.\n'));
  await ui.waitFor(f => f.type === 'message' && (f.message as Message).detail?.event === 'rule' && (f.message as Message).text.includes('Hand edited policy.'));
  for (const spoke of spokes) {
    const listed = await spoke.call<{ ok: boolean; rules: Rule[] }>('rule.list');
    assert.equal(listed.ok, true);
    assert.equal(listed.rules[0]?.text, 'Hand edited policy.');
  }
});

test('launch clause and brief end with the same ordered active rules', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
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
  const { discovery } = await startDaemon(t, root, fake.env);
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

test('a clause larger than the send cap reaches a session whole on assignment and reconnect', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const text = `Preserve the complete rule. ${'Complete instructions. '.repeat(450)}END OF RULE`;
  const added = await cland(root, 'rule', 'add', text, '--scope', 'implementer', '--reason', 'complete event delivery');
  assert.equal(added.code, 0, added.stderr);
  let spoke = await spawnSpoke({ cwd: root, discover: true, name: 'large-clause', sessionId: 'large-clause', role: 'implementer' });
  t.after(() => spoke.close());
  const first = (await spoke.waitForEvent(e => e.params.meta?.kind === 'role')).params.content;
  assert.ok(Buffer.byteLength(first) > 8192);
  assert.ok(first.endsWith(`rule 1: ${text} (reason: complete event delivery)`));
  await spoke.close();
  spoke = await spawnSpoke({ cwd: root, discover: true, name: 'large-clause', sessionId: 'large-clause', role: 'implementer' });
  const resent = (await spoke.waitForEvent(e => e.params.meta?.kind === 'role')).params.content;
  assert.equal(resent, first, 'reconnect re-sends the complete over-cap clause');
});
