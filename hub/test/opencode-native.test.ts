// T2: production OpenCode HTTP/SSE handling on a scripted native transport, fake lifecycle,
// in-process spokes and FakeClock. Native completion, lookup and journal receipts bound negatives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptedOpenCode } from './fakes/scripted-opencode.ts';
import { eventually } from './harness.ts';

const command = 'touch approved && echo done';
const failure = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';

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
