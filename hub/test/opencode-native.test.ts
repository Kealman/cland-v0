// T2: production OpenCode HTTP/SSE handling on a scripted native transport, fake lifecycle,
// in-process spokes and FakeClock. Native completion, lookup and journal receipts bound negatives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptedOpenCode } from './fakes/scripted-opencode.ts';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually } from './harness.ts';
import type { Message, SessionUsage } from '../src/protocol.ts';

const command = 'touch approved && echo done';
const failure = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';

test('a missing OpenCode password keeps PID supervision and retries native watch after restoration', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  const pid = 424242;
  let alive = true;
  const kill = process.kill;
  t.mock.method(process, 'kill', (target: number, signal?: NodeJS.Signals | number) => {
    if (target !== pid) return kill(target, signal);
    assert.equal(signal, 0, 'the fake PID is only observed, never signalled');
    if (alive) return true;
    throw Object.assign(new Error('fake process exited'), { code: 'ESRCH' });
  });
  const p = { ...f.process, pid };
  const passwordFile = join(f.root, '.cland/opencode', p.name, 'password');
  const password = await readFile(passwordFile, 'utf8');
  await rm(passwordFile);
  const missing = () => f.log().then(log => log.split('\n').filter(line => line.includes('"event":"opencode-no-password"')).length);
  const before = await missing();
  f.adapter.watch(p);
  await eventually('missing-password lookup completed', async () => await missing() > before || undefined, 500);
  const subscriptions = f.native.reconnected;
  await writeFile(passwordFile, password);
  await f.clock.advance(5000);
  await eventually('restored password reconnects without an explicit resume', () => f.native.reconnected > subscriptions || undefined, 500);
  f.markStates(); f.native.start();
  await f.state('busy');
  assert.equal((await f.row()).status, 'running');

  await rm(passwordFile);
  const again = await missing();
  f.adapter.watch(p);
  await eventually('second missing-password lookup completed', async () => await missing() > again || undefined, 500);
  alive = false;
  await f.clock.advance(5000);
  assert.equal((await f.row()).status, 'exited', 'PID exit is observed without an HTTP/SSE watcher');
  const exits = (await f.records()).filter(e => e.event === 'harness-exited').length;
  await f.clock.advance(5000);
  assert.equal((await f.records()).filter(e => e.event === 'harness-exited').length, exits, 'the dead PID is unwatched once');
});

test('new child approval events take precedence over held reconnect snapshots', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  f.native.start();
  f.native.emit('session.created', { sessionID: 'child', parentID: f.native.session });
  for (const wasPending of [false, true]) {
    f.native.children.set('child', { running: true, permissions: wasPending ? [{ id: 'approval', action: 'edit' }] : [], forms: [] });
    f.native.holdPermissionSession = 'child';
    const before = f.native.reconnected;
    f.native.endStream();
    await eventually('child snapshot captured and held', async () => { await f.clock.advance(100); return f.native.permissionSnapshots.length === 1 || undefined; });
    f.native.emit(wasPending ? 'permission.replied' : 'permission.asked', {
      sessionID: 'child', ...(wasPending ? { requestID: 'approval', reply: 'once' } : { id: 'approval', action: 'edit' }),
    });
    await f.native.releasePermissionSnapshots();
    await eventually('family snapshot reconciliation completed', () => f.native.reconnected > before || undefined);
    assert.equal((await f.row()).state, wasPending ? 'busy' : 'waiting for approval');
  }
});

test('broadcast recipients have distinct stable OpenCode admission ids', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  const message: Message = { id: 'broadcast-id', from: 'coord', fromKind: 'agent', via: 'session', to: ['impl', 'other'], text: 'broadcast input', ts: '2026-10-18T09:00:00Z' };
  const other = { ...f.process, sessionId: 'other-recipient', harnessSessionId: 'other-native-session' };
  for (const process of [f.process, other, { ...f.process, name: 'renamed' }, other]) await f.adapter.inject(process, message, null);
  const admissions = f.native.prompts.filter(p => p.text.includes('broadcast input'));
  assert.equal(admissions.length, 2);
  assert.notEqual(admissions[0]!.id, admissions[1]!.id);
  assert.ok(admissions.every(p => /^msg_[a-f0-9]+$/.test(p.id)));
  assert.equal(f.native.promptAttempts.filter(p => p.text.includes('broadcast input')).length, 4);
});

test('a known child approval is restored from its own reconnect snapshot', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  f.native.start();
  f.native.emit('session.created', { sessionID: 'child', parentID: f.native.session });
  f.native.emit('permission.asked', { sessionID: 'child', id: 'pending', action: 'edit' });
  await f.records();
  const mark = f.markStates();
  f.native.children.set('child', { running: true, permissions: [{ id: 'pending', action: 'edit' }], forms: [] });
  await f.reconnect();
  assert.equal((await f.row()).state, 'waiting for approval');
  assert.ok(f.ui.frames.slice(mark).filter(e => e.type === 'session.state').every(e => e.state === 'waiting for approval'), 'snapshot recovery never temporarily unblocks a waiting child');
  f.native.children.set('child', { running: false, permissions: [], forms: [] });
  await f.reconnect();
  assert.equal((await f.row()).state, 'busy');
  assert.equal((await f.row()).approvalCommand, undefined);
});

test('child approvals hold the parent waiting until every child is unblocked', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  f.native.start();
  for (const sessionID of ['child-a', 'child-b']) {
    f.native.emit('session.created', { sessionID, parentID: f.native.session });
    f.native.emit('session.execution.started', { sessionID });
    f.native.emit('permission.asked', { sessionID, id: 'shared-id', action: 'edit' });
  }
  await f.records();
  assert.equal((await f.row()).state, 'waiting for approval');
  f.native.emit('permission.replied', { sessionID: 'child-a', requestID: 'shared-id', reply: 'once' });
  f.native.emit('session.execution.succeeded', { sessionID: 'child-a' });
  f.native.emit('form.created', { form: { id: 'parent-form', sessionID: f.native.session } });
  await f.records();
  assert.equal((await f.row()).state, 'waiting for approval', 'another child approval outranks the parent form');
  f.native.emit('session.execution.succeeded', { sessionID: 'child-b' });
  await f.records();
  assert.equal((await f.row()).state, 'waiting for human');
  f.native.emit('form.replied', { id: 'parent-form' });
  await f.records();
  assert.equal((await f.row()).state, 'busy');
  assert.equal((await f.row()).approvalCommand, undefined);
});

test('child steps contribute model-attributed usage to the parent session', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  f.native.emit('session.step.started', { model: { providerID: 'opencode', id: 'parent' } });
  f.native.emit('session.step.ended', { tokens: { input: 10, output: 4 }, cost: 0.125 });
  f.native.emit('session.created', { sessionID: 'unrelated', parentID: 'other-parent', model: { providerID: 'opencode', id: 'ignored' } });
  f.native.emit('session.step.ended', { sessionID: 'unrelated', tokens: { input: 9000 } });
  f.native.emit('session.created', { sessionID: 'child', parentID: f.native.session, agent: 'explore', model: { providerID: 'opencode', id: 'child-model' } });
  f.native.emit('session.step.started', { sessionID: 'child', model: { providerID: 'opencode', id: 'child-model' } });
  f.native.emit('session.step.ended', { sessionID: 'child', tokens: { input: 3, output: 2, reasoning: 1, cache: { read: 5, write: 7 } }, cost: 0.25 });
  // A later parent report is an ordering receipt for all preceding child SSE events.
  f.native.emit('session.step.ended', { tokens: { input: 1, output: 1 }, cost: 0 });
  await f.clock.advance(1000);
  const usageFrame = await f.ui.waitFor(e => e.type === 'session.usage' && (e.usage as SessionUsage).last?.inputTokens === 1);
  const launches = (await f.records()).filter(e => e.event === 'subagent-launched');
  assert.deepEqual(launches.map(e => ({ id: (e as { agentId?: string }).agentId, model: (e as { model?: string }).model })), [{ id: 'child', model: 'opencode/child-model' }]);
  assert.deepEqual((usageFrame.usage as SessionUsage).total, {
    totalTokens: 33, inputTokens: 14, outputTokens: 7, reasoningTokens: 1, cacheReadTokens: 5, cacheWriteTokens: 7, cost: 0.375,
  });
  const list = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{ model: string }> };
  assert.equal(list.processes[0]!.model, 'opencode/parent');
});

test('an admitted OpenCode prompt with a lost response is retried once at idle', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t);
  f.native.start();
  f.native.losePromptResponse = true;
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { to: ['impl'], text: 'admit before timeout' })).ok, true);
  const failed = await eventually('timeout receipt', async () => (await f.log()).split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as { event: string; id?: string }).find(r => r.event === 'inject-unconfirmed'));
  assert.ok(failed.id);
  f.markStates(); await f.idle();
  await f.ui.waitFor(e => e.type === 'delivery' && e.message === failed.id && e.stage === 'injected');
  const admissions = f.native.prompts.filter(p => p.text.includes('admit before timeout'));
  assert.equal(admissions.length, 1, 'the retried input reuses its first admission');
  const attempts = f.native.promptAttempts.filter(p => p.text.includes('admit before timeout'));
  assert.equal(attempts.length, 2);
  assert.match(attempts[0]!.id!, /^msg_[a-f0-9]+$/);
  assert.equal(attempts[1]!.id, attempts[0]!.id);
});

test('shell approval exposes the referenced command and clears metadata between episodes', async t => {
  const f = await scriptedOpenCode(t);
  for (const source of [true, false]) {
    f.markStates(); f.native.start(); f.native.ask('shell', 'shell', source);
    await f.ui.waitFor(e => e.type === 'session.state' && e.approvalCommand === (source ? command : 'shell'));
    assert.equal((await f.row()).approvalCommand, source ? command : 'shell');
    assert.doesNotMatch(JSON.stringify(f.states()), /private-|wrong command/);
    f.native.approve(); await f.idle();
    assert.equal((await f.row()).approvalCommand, undefined);
  }
  assert.ok(f.states().filter(e => e.state !== 'waiting for approval').every(e => e.approvalCommand === undefined));
});

test('a reconnect permission snapshot restores only the referenced shell command', async t => {
  const f = await scriptedOpenCode(t);
  // The request happens while the stream is down: only the reconnect snapshot can expose it.
  f.native.running = true;
  f.native.permissions = [{ id: 'shell', action: 'shell', source: { type: 'tool', messageID: 'assistant', id: 'tool-shell' } }];
  await f.reconnect();
  await f.ui.waitFor(e => e.type === 'session.state' && e.approvalCommand === command);
  assert.equal((await f.row()).approvalCommand, command);
  assert.doesNotMatch(JSON.stringify(f.states()), /private-|wrong command/);
  f.markStates(); f.native.approve(); await f.idle();
});

test('a late command lookup cannot describe the next approval episode', async t => {
  const f = await scriptedOpenCode(t);
  f.native.holdMessages = true;
  f.markStates(); f.native.start(); f.native.ask();
  await f.state('waiting for approval');
  await eventually('first command lookup held', () => f.native.lookups.length === 1 || undefined);
  f.native.approve(); await f.idle();
  f.markStates(); f.native.start(); f.native.ask('edit', 'edit');
  await f.state('waiting for approval');
  await eventually('both command lookups held', () => f.native.lookups.length === 2 || undefined);
  await f.native.releaseMessages();
  // Released native requests settle before the hub's subsequent frame/journal barrier.
  await f.records();
  f.native.approve('edit'); await f.idle();
  assert.ok(f.states().every(e => e.approvalCommand !== command));
});

test('rejected approvals recover known or delayed commands without declaring server death', async t => {
  const f = await scriptedOpenCode(t);
  for (const delayed of [false, true]) {
    f.native.holdMessages = delayed;
    f.markStates(); f.native.start(); f.native.ask();
    if (delayed) await eventually('waiting-state lookup held', () => f.native.lookups.length === 1 || undefined);
    else await f.ui.waitFor(e => e.type === 'session.state' && e.approvalCommand === command);
    const mark = f.ui.frames.length;
    f.native.approve('shell', 'reject'); f.native.shutdown();
    if (delayed) {
      await eventually('rejection report lookup held', () => f.native.lookups.length === 2 || undefined);
      await f.native.releaseMessages();
    }
    const expected = `impl [Implementer]: its turn failed: Approval rejected: ${command}`;
    await f.ui.waitFor(e => f.ui.frames.indexOf(e) >= mark && e.type === 'message' && (e.message as { text: string }).text === expected);
    const live = await f.row();
    assert.equal(live.status, 'running');
    assert.equal(live.state, 'idle');
    const events = (await f.ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
    assert.ok(events.rows.some(e => e.text === expected));
    const input = await f.send(`continue after ${delayed ? 'delayed' : 'known'} rejection`);
    f.native.start(); f.native.deliver(input); await f.idle();
    await f.reply(input, 'pong: continue after rejection');
  }
  f.native.shutdown();
  await eventually('bare shutdown declares server death', async () => (await f.row()).status === 'exited' || undefined);
});

test('failure attribution follows delivered inbox items across queued native turns', async t => {
  const f = await scriptedOpenCode(t);
  const first = await f.send('first queued turn succeeds');
  // Native work starts before its busy SSE frame arrives; the hub still admits a queued input.
  f.native.running = true;
  const second = await f.send('fail this turn', true);
  assert.equal(first.running, false); assert.equal(second.running, true);
  assert.equal(first.delivery, 'queue'); assert.equal(second.delivery, 'queue');
  f.native.start(); f.native.deliver(first); f.native.complete();
  f.native.start(); f.native.deliver(second); f.native.complete(true);
  await f.sender.waitForEvent(e => e.params.content.includes(failure));
  await f.records();
  assert.equal(f.coord.events.some(e => e.params.content.includes(failure)), false);
});

test('stream loss forgets execution inputs whose completion was missed', async t => {
  const f = await scriptedOpenCode(t);
  const first = await f.send('successful turn before outage');
  f.native.start(); f.native.deliver(first);
  // The execution completes off-stream; the next subscription learns only the idle snapshot.
  f.native.running = false;
  await f.reconnect();
  assert.equal((await f.row()).state, 'idle');
  const second = await f.send('fail this turn', true);
  f.native.start(); f.native.deliver(second); f.native.complete(true);
  await f.sender.waitForEvent(e => e.params.content.includes(failure));
  await f.records();
  assert.equal(f.coord.events.some(e => e.params.content.includes(failure)), false);
});

test('instruction fallback removes the installed role before change or revocation prompts', async t => {
  const f = await scriptedOpenCode(t, true);
  await eventually('initial instruction installed', () => f.native.instruction?.includes('you hold the role Implementer') || undefined);
  for (const role of ['reviewer', null]) {
    f.native.failPut = true;
    assert.equal((await f.ui.request(role ? { type: 'role.set', session: 'impl', role } : { type: 'role.clear', session: 'impl' })).ok, true);
    const text = role ? 'you hold the role Reviewer' : 'no longer holds';
    await eventually('role fallback prompt admitted', () => f.native.prompts.some(p => p.text.includes(text)) || undefined);
    assert.equal(f.native.instruction, undefined);
    if (role) {
      f.native.failPut = false;
      assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
      await eventually('instruction restored', () => f.native.instruction?.includes('you hold the role Implementer') || undefined);
    }
  }
});

test('instruction cleanup refusal leaves delivery unconfirmed until a completed turn retries it', async t => {
  const f = await scriptedOpenCode(t, true);
  await eventually('initial instruction installed', () => f.native.instruction?.includes('you hold the role Implementer') || undefined);
  f.native.failPut = true; f.native.failDelete = true;
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  const records = async () => (await f.log()).trim().split('\n').map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  const failed = await eventually('unconfirmed revocation receipt', async () => (await records()).find(e => e.event === 'inject-unconfirmed' && e.session === 'impl'));
  assert.ok(failed.id);
  assert.ok(!(await records()).some(e => e.event === 'injected' && e.id === failed.id));
  assert.match(f.native.instruction!, /you hold the role Implementer/);
  assert.ok(!f.native.prompts.some(p => p.text.includes('no longer holds')));
  f.native.failDelete = false;
  const input = await f.send('retry pending cleanup after this turn');
  f.markStates(); f.native.start(); f.native.deliver(input); await f.idle();
  await eventually('revocation fallback after cleanup recovery', () => f.native.prompts.some(p => p.text.includes('no longer holds')) || undefined);
  assert.equal(f.native.instruction, undefined);
  await eventually('retried revocation injected', async () => (await records()).some(e => e.event === 'injected' && e.id === failed.id) || undefined);
});


test('an OpenCode session moved outside its item worktree warns its supervising lead', { timeout: 2000 }, async t => {
  const f = await scriptedOpenCode(t, false, true);
  for (const directory of [f.root, `${f.root}/inside`]) f.native.emit('session.moved', { location: { directory } });
  f.native.emit('session.moved', { sessionID: 'unrelated', location: { directory: '/elsewhere' } });
  f.native.emit('session.moved', { location: { directory: `${f.root}-outside` } });
  const events = await eventually('move warning reaches events view', async () => {
    const result = (await f.ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string; warning?: boolean }> };
    return result.rows.some(row => row.text.includes('moved outside')) ? result.rows : undefined;
  });
  const warning = events.filter(row => row.text.includes('moved outside'));
  assert.equal(warning.length, 1);
  assert.equal(warning[0]!.warning, true);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] };
  const notice = history.messages.find(m => m.text.includes('moved outside'));
  assert.deepEqual(notice?.to, ['coord']);
  assert.equal(notice?.severity, 'warn');
  await f.peer.call('send', { to: ['coord'], text: 'move observation barrier' });
  await f.coord.waitForEvent(e => e.params.content.includes('move observation barrier'));
  const delivered = await f.coord.waitForEvent(e => e.params.content.includes('moved outside'));
  assert.match(delivered.params.content, /moved outside/);
  assert.match(delivered.params.content, /-outside/);
});
