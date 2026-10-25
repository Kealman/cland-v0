// T2: production Codex admission/reconciliation on a scripted in-process native connection.
// Lifecycle comes from T-686's fake; socket peers and hub reports remain real. No binary or
// elapsed-time wait. Native request replies and journal receipts bound every negative assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { beforeDirectories } from './process-cleanup.ts';
import { WebSocketServer } from 'ws';
import { join } from 'node:path';
import { once } from 'node:events';
import { AppServerClient, RpcError, RpcNoAnswer, RpcPayloadTooLarge } from '../src/adapters/codex/app-server.ts';
import { deferred, scriptedCodex } from './fakes/scripted-codex.ts';
import { connectUi, eventually, tempProject } from './harness.ts';
import { sessionLine } from '../src/cli/session.ts';
import type { HarnessProcessView, Inbox, Message } from '../src/protocol.ts';

const failure = 'impl [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable';
const redelivered = (intoActive: boolean) => `impl [Implementer]: its turn ended without a message it had accepted; the message was delivered again ${intoActive ? 'into a running turn' : 'as a new turn'}`;
type Fixture = Awaited<ReturnType<typeof scriptedCodex>>;

test('Codex reattaches a long thread without hydrating its oversized turn history', async t => {
  const f = await scriptedCodex(t);
  f.native.handlers.set('thread/resume', params => {
    if (params.excludeTurns !== true) throw new RpcNoAnswer('Max payload size exceeded');
    assert.deepEqual(params, { threadId: f.native.thread, excludeTurns: true });
    return { thread: { id: f.native.thread, status: { type: 'active', activeFlags: [] } } };
  });
  const resumed = f.ui.waitFor(frame => frame.type === 'session.state' && frame.sessionId === f.process.sessionId && frame.state === 'busy');
  await f.reconnect();
  await resumed;
  const listed = await f.ui.request({ type: 'session.list' });
  const row = (listed.value as { processes: Array<{ sessionId: string; state: string }> }).processes.find(row => row.sessionId === f.process.sessionId);
  assert.equal(row?.state, 'busy');
  f.native.state('idle');
  const id = await f.send('continue after long-thread recovery');
  await f.injected(id);
  assert.equal(f.native.calls.filter(call => call.method === 'thread/read').length, 0);
});

test('Codex exposes a payload-limit reattach failure on the session row and clears it after recovery', async t => {
  const f = await scriptedCodex(t);
  f.native.handlers.set('thread/resume', () => { throw new RpcPayloadTooLarge('payload limit: Max payload size exceeded'); });
  await f.reconnect();
  await eventually('failed subscription logged', async () => (await f.log()).includes('harness-reconnect-failed') || undefined);
  const row = async () => {
    const listed = await f.ui.request({ type: 'session.list' });
    return (listed.value as { processes: HarnessProcessView[] }).processes.find(row => row.sessionId === f.process.sessionId)!;
  };
  assert.equal((await row()).stateReason, 'payload limit');
  assert.match(sessionLine(await row()), /\[payload limit\]/);
  assert.equal((await row()).state, 'unknown');
  f.native.handlers.delete('thread/resume');
  await f.reconnect();
  await eventually('recovered state', async () => (await row()).state === 'idle' || undefined);
  assert.equal((await row()).stateReason, undefined);
});

test('Codex retries an older app-server without excludeTurns and accepts its previous reply shape', async t => {
  const f = await scriptedCodex(t);
  f.native.handlers.set('thread/resume', params => {
    if ('excludeTurns' in params) throw new RpcError(-32602, 'unknown field excludeTurns');
    return { thread: { id: f.native.thread, turns: [], status: { type: 'active', activeFlags: [] } }, model: 'legacy-model' };
  });
  const resumed = f.ui.waitFor(frame => frame.type === 'session.state' && frame.sessionId === f.process.sessionId && frame.state === 'busy');
  await f.reconnect();
  await resumed;
  assert.deepEqual(f.native.calls.filter(call => call.method === 'thread/resume').slice(-2).map(call => call.params), [
    { threadId: f.native.thread, excludeTurns: true }, { threadId: f.native.thread },
  ]);
  assert.equal(f.native.count('turn/start'), 0);
});

for (const outcome of ['large reply', 'payload limit'] as const) {
  test(`Codex WebSocket transport handles ${outcome} at the native frame boundary`, async t => {
    const root = await tempProject(t, 'cx-');
    const path = join(root, 's');
    const server = createServer();
    const peers = new WebSocketServer({ noServer: true });
    const sockets = new Set<Socket>();
    let client: AppServerClient | undefined;
    let clientDidClose = false;
    // Own partial setup and cancellation before the first listen/connection acquisition.
    beforeDirectories(t, async () => {
      const listenerClosed = server.listening ? once(server, 'close', { signal: AbortSignal.timeout(2000) }) : Promise.resolve();
      if (server.listening) server.close();
      const clientClosed = client && !clientDidClose ? once(client, 'close', { signal: AbortSignal.timeout(2000) }) : Promise.resolve();
      const peersClosed = once(peers, 'close', { signal: AbortSignal.timeout(2000) });
      client?.close();
      const socketsClosed = [...sockets].map(socket => {
        const closed = once(socket, 'close', { signal: AbortSignal.timeout(2000) });
        socket.destroy();
        return closed;
      });
      peers.close();
      await Promise.all([listenerClosed, clientClosed, peersClosed, ...socketsClosed]);
      assert.equal(server.listening, false);
      assert.equal(peers.clients.size, 0);
      assert.equal(sockets.size, 0);
    });
    server.on('connection', socket => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
    server.on('upgrade', (request, socket, head) => peers.handleUpgrade(request, socket, head, peer => {
      peer.on('error', () => {});
      peer.on('message', bytes => {
        const request = JSON.parse(String(bytes)) as { id?: number; method: string };
        if (request.method === 'initialize') peer.send(JSON.stringify({ id: request.id, result: {} }));
        else if (request.method === 'thread/resume') {
          if (outcome === 'large reply') {
            // A real reply above ws's former 100 MiB default, with a known final receipt.
            peer.send(JSON.stringify({ id: request.id, result: { history: 'x'.repeat(101 * 1024 * 1024), receipt: 'long-thread' } }));
          } else {
            // Announce 513 MiB in a legal frame header. ws rejects before allocating its body.
            const header = Buffer.alloc(10);
            header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(513 * 1024 * 1024), 2);
            socket.write(header);
          }
        }
      });
    }));
    const listening = once(server, 'listening', { signal: AbortSignal.timeout(2000) });
    server.listen(path);
    await listening;
    client = await AppServerClient.connect(path, { client: { name: 'test', version: '0' } });
    client.once('close', () => { clientDidClose = true; });
    const result = client.request<{ history: string; receipt: string }>('thread/resume', { threadId: 'long-thread' });
    if (outcome === 'large reply') {
      const reply = await result;
      assert.equal(reply.receipt, 'long-thread');
      assert.equal(reply.history.length, 105906176);
    } else {
      await assert.rejects(result, error => error instanceof RpcPayloadTooLarge && error instanceof RpcNoAnswer && /payload limit/.test(error.message));
    }
  });
}

test('a Codex command approval is one allowlisted record and Approve once responds to its native id', async t => {
  const f = await scriptedCodex(t);
  const pending = f.ui.waitFor(frame => frame.type === 'approval');
  const request = { id: 71, method: 'item/commandExecution/requestApproval', params: {
    threadId: f.native.thread, turnId: 'turn-1', itemId: 'item-1', command: 'touch approved', cwd: f.root,
    reason: 'Write a file', privateInput: 'PRIVATE-TOOL-INPUT',
  } };
  f.native.emit('serverRequest', request);
  const row = (await pending).approval as Inbox['approvals'][number];
  assert.equal(row.id, `${f.process.sessionId}:71`);
  assert.equal(row.answerIn, 'hub');
  assert.equal(row.state, 'pending');
  assert.equal(row.kind, 'command');
  assert.deepEqual(row.subject, { command: 'touch approved', cwd: f.root, reason: 'Write a file' });
  assert.deepEqual(row.choices, ['once', 'always', 'deny']);
  f.native.emit('serverRequest', request);
  const listed = await f.ui.request({ type: 'inbox.list' });
  assert.deepEqual((listed.value as Inbox).approvals, [row]);
  const answer = await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'once' });
  assert.equal(answer.ok, true, answer.error);
  assert.deepEqual(f.native.responses, [{ id: 71, result: { decision: 'accept' } }]);
  assert.equal((answer.value as { approval: typeof row }).approval.outcome?.choice, 'once');
  assert.equal(JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'), false);
});

test('Codex Always and Deny preserve the human outcome when the resolution echo follows delivery', async t => {
  const f = await scriptedCodex(t);
  for (const [choice, decision] of [['always', 'acceptForSession'], ['deny', 'decline']] as const) {
    const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(`:${choice}`));
    f.native.emit('serverRequest', { id: choice, method: 'item/commandExecution/requestApproval', params: {
      threadId: f.native.thread, turnId: 'turn-1', itemId: choice, command: 'touch approved', cwd: f.root,
    } });
    const row = (await pending).approval as Inbox['approvals'][number];
    const note = choice === 'deny' ? 'Keep this worktree' : undefined;
    const result = await f.ui.request({ type: 'approval.answer', approval: row.id, choice, ...(note ? { note } : {}) });
    assert.equal(result.ok, true, result.error);
    f.native.notify('serverRequest/resolved', { requestId: choice });
    const closed = (result.value as { approval: typeof row }).approval;
    assert.deepEqual(closed.outcome, { choice, by: 'human', via: 'neovim', at: f.clock.now().toISOString(), ...(note ? { note } : {}) });
    assert.deepEqual(f.native.responses.at(-1), { id: choice, result: { decision } });
    const archive = ((await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox).archive!;
    assert.deepEqual(archive.find(record => record.id === row.id)?.outcome, closed.outcome);
    if (note) {
      const history = (await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Message[] };
      assert.ok(history.messages.some(message => message.from === 'human' && message.text === note));
    }
  }
});

test('a Codex request resolved by another client closes for every subscribed client', async t => {
  const f = await scriptedCodex(t);
  const other = await connectUi(t, f.discovery);
  await other.request({ type: 'subscribe' });
  const pending = f.ui.waitFor(frame => frame.type === 'approval');
  f.native.emit('serverRequest', { id: 'native', method: 'item/commandExecution/requestApproval', params: {
    threadId: f.native.thread, turnId: 'turn-1', itemId: 'item-1', command: 'touch approved', cwd: f.root,
  } });
  const row = (await pending).approval as Inbox['approvals'][number];
  const closed = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as typeof row).state === 'closed');
  const otherClosed = other.waitFor(frame => frame.type === 'approval' && (frame.approval as typeof row).state === 'closed');
  f.native.notify('serverRequest/resolved', { requestId: 'native' });
  const record = (await closed).approval as typeof row;
  assert.deepEqual((await otherClosed).approval, record);
  assert.deepEqual(record.outcome, {
    choice: 'answered in the harness', by: 'harness', via: 'harness', at: f.clock.now().toISOString(),
  });
  const archive = ((await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox).archive!;
  assert.deepEqual(archive.find(record => record.id === row.id)?.outcome, record.outcome);
  assert.equal((await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'deny' })).ok, false);
  assert.deepEqual(f.native.responses, []);
});

test('a harness answer wins while a hub Codex Deny is in flight', async t => {
  const f = await scriptedCodex(t);
  const other = await connectUi(t, f.discovery);
  await other.request({ type: 'subscribe' });
  const pending = f.ui.waitFor(frame => frame.type === 'approval');
  f.native.emit('serverRequest', { id: 'race', method: 'item/commandExecution/requestApproval', params: {
    threadId: f.native.thread, turnId: 'turn', itemId: 'command', command: 'touch approved', cwd: f.root,
  } });
  const row = (await pending).approval as Inbox['approvals'][number];
  const delivery = deferred<void>();
  f.native.onResponse = () => delivery.promise;
  const answering = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as typeof row).state === 'answering');
  const answer = f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'deny', note: 'Do not run' });
  await answering;
  const closed = other.waitFor(frame => frame.type === 'approval' && (frame.approval as typeof row).state === 'closed');
  f.native.notify('serverRequest/resolved', { requestId: 'race' });
  delivery.resolve();
  const result = await answer;
  assert.equal(result.ok, false);
  assert.match(result.error!, /already answered by harness via harness at /);
  const outcome = (await closed).approval as typeof row;
  assert.deepEqual(outcome.outcome, { choice: 'answered in the harness', by: 'harness', via: 'harness', at: f.clock.now().toISOString() });
  const archive = ((await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox).archive!;
  assert.deepEqual(archive.find(record => record.id === row.id)?.outcome, outcome.outcome);
  for (const client of [f.ui, other]) {
    assert.equal(client.frames.filter(frame => frame.type === 'approval' && (frame.approval as typeof row).state === 'closed').length, 1);
  }
  const history = (await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Message[] };
  assert.equal(history.messages.some(message => message.from === 'human' && message.text === 'Do not run'), false);
});

test('a replayed Codex request after reconnect keeps its record id and accepts an answer', async t => {
  const f = await scriptedCodex(t);
  const request = { id: 'replayed', method: 'item/commandExecution/requestApproval', params: {
    threadId: f.native.thread, turnId: 'turn-1', itemId: 'item-1', command: 'touch approved', cwd: f.root,
  } };
  const pending = f.ui.waitFor(frame => frame.type === 'approval');
  f.native.emit('serverRequest', request);
  const row = (await pending).approval as Inbox['approvals'][number];
  f.native.handlers.set('thread/resume', () => {
    f.native.emit('serverRequest', request);
    return { thread: { id: f.native.thread, status: { type: 'active', activeFlags: ['waitingOnApproval'] } } };
  });
  await f.reconnect();
  await eventually('new native subscription', () => f.native.count('thread/resume') === 2 || undefined);
  assert.equal(f.connections, 2);
  assert.deepEqual(((await f.ui.request({ type: 'inbox.list' })).value as Inbox).approvals, [row]);
  const answer = await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'once' });
  assert.equal(answer.ok, true, answer.error);
  assert.deepEqual(f.native.responses, [{ id: 'replayed', result: { decision: 'accept' } }]);
  assert.equal(f.ui.frames.filter(frame => frame.type === 'approval' && (frame.approval as typeof row).state === 'pending').length, 1);
});

test('the Codex capability table advertises a reliable approval relay', async t => {
  const f = await scriptedCodex(t);
  const result = await f.ui.request({ type: 'session.list' });
  assert.equal((result.value as { adapters: { codex: { approvalRelay: string } } }).adapters.codex.approvalRelay, 'reliable');
});

test('a Codex file-change approval reads only the matching item paths and diff, then sends decline', async t => {
  const f = await scriptedCodex(t);
  f.native.handlers.set('thread/read', () => ({ thread: { id: f.native.thread, turns: [{ id: 'turn-file', items: [
    { id: 'other', type: 'fileChange', changes: [{ path: 'private', diff: 'PRIVATE-TOOL-INPUT' }] },
    { id: 'patch', type: 'fileChange', changes: [{ path: '/work/a.ts', diff: '@@\n-old\n+new', privateInput: 'PRIVATE-TOOL-INPUT' }] },
  ] }] } }));
  const pending = f.ui.waitFor(frame => frame.type === 'approval');
  f.native.emit('serverRequest', { id: 'file-approval', method: 'item/fileChange/requestApproval', params: {
    threadId: f.native.thread, turnId: 'turn-file', itemId: 'patch', reason: 'Update source', privateInput: 'PRIVATE-TOOL-INPUT',
  } });
  const row = (await pending).approval as Inbox['approvals'][number];
  assert.equal(row.kind, 'file change');
  assert.equal(row.answerIn, 'hub');
  assert.deepEqual(row.subject, { files: ['/work/a.ts'], change: '@@\n-old\n+new' });
  assert.deepEqual(row.choices, ['once', 'always', 'deny']);
  const answer = await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'deny' });
  assert.equal(answer.ok, true, answer.error);
  assert.deepEqual(f.native.responses, [{ id: 'file-approval', result: { decision: 'decline' } }]);
  assert.equal(JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'), false);
});

test('malformed Codex command requests fall back to the TUI with a warning and never send a decision', async t => {
  const f = await scriptedCodex(t);
  const pending = f.ui.waitFor(frame => frame.type === 'approval');
  f.native.emit('serverRequest', { id: 'missing-cwd', method: 'item/commandExecution/requestApproval', params: {
    threadId: f.native.thread, turnId: 'turn-1', itemId: 'item-1', command: 'touch approved', privateInput: 'PRIVATE-TOOL-INPUT',
  } });
  const row = (await pending).approval as Inbox['approvals'][number];
  assert.equal(row.answerIn, 'tui');
  assert.deepEqual(row.choices, []);
  assert.deepEqual(row.subject, { command: 'touch approved' });
  assert.equal((await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'deny' })).ok, false);
  assert.deepEqual(f.native.responses, []);
  assert.match(await f.log(), /"event":"harness-approval-unsupported"[^\n]*"severity":"warn"/);
  assert.equal(JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'), false);
});

test('a replayed Codex file approval cannot answer until its subject is validated', async t => {
  const f = await scriptedCodex(t);
  const patch = { thread: { turns: [{ id: 'turn', items: [{ id: 'patch', type: 'fileChange', changes: [{ path: '/work/file', diff: '@@\n-old\n+new' }] }] }] } };
  for (const mode of ['valid', 'malformed', 'failed']) {
    const request = { id: `file-${mode}`, method: 'item/fileChange/requestApproval', params: { threadId: f.native.thread, turnId: 'turn', itemId: 'patch' } };
    f.native.handlers.set('thread/read', () => patch);
    const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(`:file-${mode}`));
    f.native.emit('serverRequest', request);
    const row = (await pending).approval as Inbox['approvals'][number];
    const read = deferred<unknown>(), reads = f.native.count('thread/read');
    f.native.handlers.set('thread/read', () => read.promise);
    f.native.handlers.set('thread/resume', () => {
      f.native.emit('serverRequest', request);
      return { thread: { id: f.native.thread, status: { type: 'idle' } } };
    });
    await f.reconnect();
    await eventually('replayed file read requested', () => f.native.count('thread/read') === reads + 1 || undefined);
    const before = f.native.responses.length;
    const early = await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'once' });
    assert.equal(early.ok, false, 'held validation must refuse the public answer');
    assert.equal(f.native.responses.length, before);
    if (mode === 'failed') read.reject(new Error('planted readback failure'));
    else read.resolve(mode === 'valid' ? patch : { thread: { turns: [] } });
    // The read promise settles before this ordered frame crosses the hub's I/O boundary.
    await f.ui.request({ type: 'session.list' });
    const answer = await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'deny' });
    assert.equal(answer.ok, mode === 'valid', answer.error);
    assert.equal(f.native.responses.length, before + (mode === 'valid' ? 1 : 0));
    if (mode === 'valid') assert.deepEqual(f.native.responses.at(-1), { id: `file-${mode}`, result: { decision: 'decline' } });
  }
});

test('a Codex file request resolved during its first lookup publishes only the closed harness outcome', async t => {
  const f = await scriptedCodex(t);
  const other = await connectUi(t, f.discovery);
  await other.request({ type: 'subscribe' });
  const read = deferred<unknown>();
  f.native.handlers.set('thread/read', () => read.promise);
  const id = `${f.process.sessionId}:early-resolved`;
  const closed = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id);
  const otherClosed = other.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id);
  f.native.emit('serverRequest', { id: 'early-resolved', method: 'item/fileChange/requestApproval', params: { threadId: f.native.thread, turnId: 'turn', itemId: 'patch' } });
  await eventually('first file read requested', () => f.native.count('thread/read') === 1 || undefined);
  f.native.notify('serverRequest/resolved', { requestId: 'early-resolved' });
  const at = f.clock.now().toISOString();
  await f.clock.advance(1000);
  read.resolve({ thread: { turns: [{ id: 'turn', items: [{ id: 'patch', type: 'fileChange', changes: [{ path: '/work/file', diff: '@@\n-old\n+new' }] }] }] } });
  const row = (await closed).approval as Inbox['approvals'][number];
  assert.equal(row.state, 'closed');
  assert.deepEqual(row.subject, { files: ['/work/file'], change: '@@\n-old\n+new' });
  assert.deepEqual(row.outcome, { choice: 'answered in the harness', by: 'harness', via: 'harness', at });
  assert.ok(row.since <= row.outcome!.at, 'the request began no later than its observed closure');
  assert.deepEqual((await otherClosed).approval, row);
  const inbox = (await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
  assert.equal(inbox.approvals.some(record => record.id === id), false);
  assert.deepEqual(inbox.archive?.find(record => record.id === id)?.outcome, row.outcome);
  assert.equal(f.ui.frames.filter(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id).length, 1);
  assert.deepEqual(f.native.responses, []);
});

test('an observed Codex file closure survives native disconnect before its first lookup settles', async t => {
  const f = await scriptedCodex(t), other = await connectUi(t, f.discovery);
  await other.request({ type: 'subscribe' });
  const read = deferred<unknown>();
  f.native.handlers.set('thread/read', () => read.promise);
  const id = `${f.process.sessionId}:disconnected-resolved`;
  const closed = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id);
  const otherClosed = other.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id);
  f.native.emit('serverRequest', { id: 'disconnected-resolved', method: 'item/fileChange/requestApproval', params: { threadId: f.native.thread, turnId: 'turn', itemId: 'patch' } });
  f.native.emit('serverRequest', { id: 'unresolved-on-old-client', method: 'item/fileChange/requestApproval', params: { threadId: f.native.thread, turnId: 'turn', itemId: 'patch' } });
  await eventually('held initial file reads', () => f.native.count('thread/read') === 2 || undefined);
  f.native.notify('serverRequest/resolved', { requestId: 'disconnected-resolved' });
  const at = f.clock.now().toISOString();
  f.refuseConnections(new Error('hold disconnected'));
  f.native.close();
  read.reject(new Error('read failed after observed closure'));
  const row = (await closed).approval as Inbox['approvals'][number];
  assert.equal(row.state, 'closed');
  assert.deepEqual(row.subject, {});
  assert.deepEqual(row.outcome, { choice: 'answered in the harness', by: 'harness', via: 'harness', at });
  assert.ok(row.since <= at);
  assert.deepEqual((await otherClosed).approval, row);
  const inbox = (await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
  assert.equal(inbox.approvals.some(record => record.id === id), false);
  assert.deepEqual(inbox.archive?.find(record => record.id === id)?.outcome, row.outcome);
  assert.equal(f.ui.frames.filter(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id).length, 1);
  assert.equal(f.ui.frames.some(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(':unresolved-on-old-client')), false);
  assert.equal((await f.ui.request({ type: 'approval.answer', approval: id, choice: 'once' })).ok, false);
  assert.deepEqual(f.native.responses, []);
});

test('a known stopped Codex session admits closed-first history but no new pending approval', async t => {
  const f = await scriptedCodex(t);
  const read = deferred<unknown>();
  f.native.handlers.set('thread/read', () => read.promise);
  const id = `${f.process.sessionId}:stopped-resolved`;
  const closed = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id);
  f.native.emit('serverRequest', { id: 'stopped-resolved', method: 'item/fileChange/requestApproval', params: { threadId: f.native.thread, turnId: 'turn', itemId: 'patch' } });
  await eventually('held lookup before stop', () => f.native.count('thread/read') === 1 || undefined);
  f.native.notify('serverRequest/resolved', { requestId: 'stopped-resolved' });
  const at = f.clock.now().toISOString();
  const stopped = await f.ui.request({ type: 'session.stop', session: 'impl' });
  assert.equal(stopped.ok, true, stopped.error);
  const listed = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; status: string }> };
  assert.equal(listed.processes.find(process => process.name === 'impl')?.status, 'stopped');
  f.native.emit('serverRequest', { id: 'terminal-pending', method: 'item/commandExecution/requestApproval', params: { threadId: f.native.thread, turnId: 'turn', itemId: 'command', command: 'touch unapproved', cwd: f.root } });
  f.native.close();
  read.reject(new Error('read rejected after recorded stop'));
  const row = (await closed).approval as Inbox['approvals'][number];
  assert.equal(row.state, 'closed');
  assert.deepEqual(row.outcome, { choice: 'answered in the harness', by: 'harness', via: 'harness', at });
  const inbox = (await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
  assert.equal(inbox.approvals.length, 0);
  assert.deepEqual(inbox.archive?.find(record => record.id === id)?.outcome, row.outcome);
  assert.equal(f.ui.frames.some(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(':terminal-pending')), false);
  assert.deepEqual(f.native.responses, []);
});

test('Codex watch replays a first-turn closure observed before its process row was published', async t => {
  const f = await scriptedCodex(t, async (native, process) => {
    native.emit('serverRequest', { id: 'early-closed', method: 'item/commandExecution/requestApproval', params: { threadId: native.thread, turnId: 'first-turn', itemId: 'first-command', command: 'touch approved', cwd: process.cwd } });
    native.notify('serverRequest/resolved', { requestId: 'early-closed' });
  });
  const id = `${f.process.sessionId}:early-closed`;
  const inbox = (await f.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
  assert.equal(inbox.approvals.length, 0);
  const row = inbox.archive?.find(record => record.id === id);
  assert.ok(row, 'watch publishes the exact early native closure after the process row is known');
  assert.deepEqual(row.outcome, { choice: 'answered in the harness', by: 'harness', via: 'harness', at: f.clock.now().toISOString() });
  const deltas = f.ui.frames.filter(frame => frame.type === 'approval' && (frame.approval as { id: string }).id === id);
  assert.equal(deltas.length, 1);
  assert.equal((deltas[0]!.approval as { state: string }).state, 'closed');
  assert.deepEqual(f.native.responses, []);
});

test('Codex validates every routing field and rejects missing or malformed file patches', async t => {
  const f = await scriptedCodex(t);
  const valid: Record<string, unknown> = { threadId: f.native.thread, turnId: 'turn', itemId: 'patch', command: 'touch approved', cwd: f.root };
  f.native.emit('serverRequest', { id: 'foreign', method: 'item/commandExecution/requestApproval', params: { ...valid, threadId: 'another-thread' } });
  const malformed = [
    ...['threadId', 'turnId', 'itemId', 'command', 'cwd'].map(field => {
      const params = { ...valid }; delete params[field]; return params;
    }),
    { ...valid, reason: { privateInput: 'PRIVATE-TOOL-INPUT' } },
    ...[null, 7, {}, []].map(threadId => ({ ...valid, threadId })),
    ...['threadId', 'turnId', 'itemId'].map(field => ({ ...valid, [field]: '' })),
  ];
  for (const [index, params] of malformed.entries()) {
    const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(`:invalid-${index}`));
    f.native.emit('serverRequest', { id: `invalid-${index}`, method: 'item/commandExecution/requestApproval', params });
    const row = (await pending).approval as Inbox['approvals'][number];
    assert.equal(row.answerIn, 'tui');
    assert.deepEqual(row.choices, []);
  }
  for (const [index, changes] of [undefined, [], [{ path: '/work/file', diff: 123 }]].entries()) {
    f.native.handlers.set('thread/read', () => ({ thread: { turns: [{ id: 'turn', items: [{ id: 'patch', type: 'fileChange', changes }] }] } }));
    const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(`:invalid-file-${index}`));
    f.native.emit('serverRequest', { id: `invalid-file-${index}`, method: 'item/fileChange/requestApproval', params: valid });
    const row = (await pending).approval as Inbox['approvals'][number];
    assert.equal(row.answerIn, 'tui');
    assert.deepEqual(row.subject, {});
    assert.deepEqual(row.choices, []);
  }
  assert.equal((await f.log()).split('"event":"harness-approval-unsupported"').length - 1, 16);
  const inbox = (await f.ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(inbox.approvals.some(row => row.id.endsWith(':foreign')), false);
  assert.equal(JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'), false);
  assert.deepEqual(f.native.responses, []);
});

test('Codex relays only complete command and file subjects within the exact serialized UTF-8 cap', async t => {
  const f = await scriptedCodex(t);
  const cap = 64 * 1024;
  const fill = (bytes: number) => '🚀'.repeat(Math.floor(bytes / 4)) + '.'.repeat(bytes % 4);
  for (const kind of ['command', 'file']) {
    const empty = kind === 'command' ? { command: 'printf ', cwd: '/work' } : { files: ['/work/a'], change: '' };
    const text = fill(cap - Buffer.byteLength(JSON.stringify(empty)));
    const exact = kind === 'command' ? { command: `printf ${text}`, cwd: '/work' } : { files: ['/work/a'], change: text };
    assert.equal(Buffer.byteLength(JSON.stringify(exact)), cap);
    for (const oversized of [false, true]) {
      const id = `${kind}-${oversized ? 'oversized' : 'exact'}`;
      const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { id: string }).id.endsWith(`:${id}`));
      const params: Record<string, unknown> = { threadId: f.native.thread, turnId: 'turn', itemId: id, privateInput: 'PRIVATE-TOOL-INPUT' };
      if (kind === 'command') {
        params.command = exact.command! + (oversized ? `; printf ${'x'.repeat(256)}; touch /work/HIDDEN-OPERATION` : '');
        params.cwd = '/work';
      } else {
        const changes = [{ path: '/work/a', diff: text }];
        if (oversized) changes.push({ path: '/work/HIDDEN-OPERATION', diff: `${'x'.repeat(256)}\n+HIDDEN-OPERATION` });
        f.native.handlers.set('thread/read', () => ({ thread: { turns: [{ id: 'turn', items: [{ id, type: 'fileChange', changes, privateInput: 'PRIVATE-TOOL-INPUT' }] }] } }));
      }
      f.native.emit('serverRequest', { id, method: kind === 'command' ? 'item/commandExecution/requestApproval' : 'item/fileChange/requestApproval', params });
      const row = (await pending).approval as Inbox['approvals'][number];
      assert.equal(row.answerIn, oversized ? 'tui' : 'hub');
      assert.deepEqual(row.choices, oversized ? [] : ['once', 'always', 'deny']);
      assert.ok(Buffer.byteLength(JSON.stringify(row.subject)) <= cap);
      if (!oversized) assert.deepEqual(row.subject, exact);
      else assert.equal(JSON.stringify(row.subject).includes('HIDDEN-OPERATION'), false);
      const count = f.native.responses.length;
      const answer = await f.ui.request({ type: 'approval.answer', approval: row.id, choice: 'once' });
      assert.equal(answer.ok, !oversized, answer.error);
      assert.equal(f.native.responses.length, count + (oversized ? 0 : 1));
    }
  }
  assert.equal(JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'), false);
});
async function active(f: Fixture) {
  f.native.start('original');
  // A known input lets readback judge missing steers independently of their shape.
  f.native.item('original', 'original native input');
  f.native.approval();
  f.native.state('active', ['waitingOnApproval']);
  await f.ui.request({ type: 'session.list' });
}
const textOf = (params: Record<string, unknown>) => ((params.input as Array<{ text: string }> | undefined)?.[0]?.text ?? (params.toolOutput as { output: string } | undefined)?.output)!;
async function recoveries(f: Fixture, id: string, count: number) {
  await eventually('recovery receipt', async () => (await f.records()).filter(e => e.event === 'harness-redelivered' && e.id === id).length === count || undefined);
}
async function consumeRecovery(f: Fixture) {
  const request = f.native.calls.filter(c => c.method === 'turn/start').at(-1)!;
  const id = [...f.native.turns.keys()].at(-1)!;
  f.native.item(id, textOf(request.params), request.params.toolOutput ? 'toolOutput' : 'text');
  f.native.complete(id);
  await f.records();
}

test('busy Codex admits an agent steer before starting the queued human input in a new turn', async t => {
  const f = await scriptedCodex(t);
  // T2 native RPC seam: hold a running turn, without an approval wait or a real binary.
  f.native.start('original');
  f.native.item('original', 'original native input');
  await f.ui.waitFor(frame => frame.type === 'session.state' && frame.state === 'busy');
  const human = await f.send('human input for the next turn');
  const agent = await f.send('agent report for this turn', true);
  await f.injected(agent);
  const steers = f.native.calls.filter(call => call.method === 'turn/steer');
  assert.equal(steers.length, 1);
  assert.ok(textOf(steers[0]!.params).includes(agent));
  assert.equal(f.native.count('turn/start'), 0, 'queued human input has not crossed the native boundary');
  assert.ok(!f.native.calls.some(call => textOf(call.params)?.includes(human)));
  f.native.item('original', textOf(steers[0]!.params));

  f.native.complete('original');
  await f.injected(human);
  const starts = f.native.calls.filter(call => call.method === 'turn/start');
  assert.equal(starts.length, 1);
  assert.ok(textOf(starts[0]!.params).includes(human), 'the human input enters a new native turn after completion');
  assert.equal(f.native.count('turn/steer'), 1, 'the human input never steers the old native turn');
  await consumeRecovery(f);
});

// Both orderings share one hub, and use a new connection per table row.
test('deferred reconnect snapshots preserve newer approval events in either arrival order', async t => {
  const f = await scriptedCodex(t);
  for (const order of ['request-first', 'state-first']) {
    const subscription = deferred<unknown>();
    f.native.handlers.set('thread/resume', () => subscription.promise);
    const beforeCalls = f.native.count('thread/resume');
    await f.reconnect();
    await eventually('subscription pending', () => f.native.count('thread/resume') === beforeCalls + 1 || undefined);
    const approvalMark = f.ui.frames.length;
    if (order === 'request-first') f.native.approval('touch deferred-approved');
    f.native.state('active', ['waitingOnApproval']);
    if (order === 'state-first') f.native.approval('touch deferred-approved');
    await f.ui.waitFor(frame => f.ui.frames.indexOf(frame) >= approvalMark && frame.type === 'session.state' && frame.approvalCommand === 'touch deferred-approved');
    const mark = f.ui.frames.length;
    subscription.resolve({ thread: { id: f.native.thread, status: { type: 'active', activeFlags: [] } } });
    await f.records();
    const rows = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{ state: string; approvalCommand?: string }> };
    assert.ok(rows.processes.some(p => p.state === 'waiting for approval' && p.approvalCommand === 'touch deferred-approved'), order);
    assert.ok(f.ui.frames.slice(mark).filter(frame => frame.type === 'session.state').every(frame => frame.state !== 'busy'), 'stale busy snapshot cannot overwrite a newer event');
    assert.ok(!JSON.stringify(f.ui.frames).includes('PRIVATE-TOOL-INPUT'));
    f.native.state('idle');
    await f.records();
  }
});

test('idle subscription snapshots clear completed approval metadata before the next waiting episode', async t => {
  const f = await scriptedCodex(t);
  for (const lifecycle of ['resume', 'relaunch']) {
    await active(f);
    // Resume retains Live; relaunch unwatches and reconstructs it, both through #subscribe.
    if (lifecycle === 'relaunch') f.adapter.unwatch(f.process.sessionId);
    const before = f.native.count('thread/resume');
    if (lifecycle === 'relaunch') { f.native.removeAllListeners(); f.adapter.watch(f.process); }
    else await f.reconnect();
    await eventually('idle snapshot applied', () => f.native.count('thread/resume') === before + 1 || undefined);
    await f.records();
    const mark = f.ui.frames.length;
    f.native.state('active', ['waitingOnApproval']);
    const event = await f.ui.waitFor(frame => f.ui.frames.indexOf(frame) >= mark && frame.type === 'session.state' && frame.state === 'waiting for approval');
    assert.equal(event.approvalCommand, undefined, lifecycle);
    const rows = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{ approvalCommand?: string }> };
    assert.equal(rows.processes[0]?.approvalCommand, undefined);
  }
});

test('failure before a pending steer response notifies only admitted senders', async t => {
  const f = await scriptedCodex(t);
  for (const accepted of [false, true]) {
    await active(f);
    const response = deferred<unknown>();
    f.native.handlers.set('turn/steer', () => response.promise);
    const id = await f.send(`${accepted ? 'accepted' : 'rejected'} pending failure`, true);
    await eventually('pending steer', () => f.native.calls.some(c => c.method === 'turn/steer' && textOf(c.params).includes(id)) || undefined);
    const mark = f.sender.events.length;
    f.native.complete('original', true);
    if (accepted) response.resolve({});
    else response.reject(new RpcError(-32000, 'no active turn to steer'));
    await f.injected(id); // Rejected steer falls back to a new, successful native admission.
    if (accepted) await f.sender.waitForEvent(e => e.params.content.includes(failure));
    await f.records();
    assert.equal(f.sender.events.slice(mark).some(e => e.params.content.includes(failure)), accepted);
    if (!accepted) await consumeRecovery(f);
  }
});

test('completion before an unanswered late steer never replays an ambiguous admission', async t => {
  const f = await scriptedCodex(t);
  for (const mode of ['rejected', 'unanswered']) {
    await active(f);
    const response = deferred<unknown>();
    f.native.handlers.set('turn/steer', () => response.promise);
    const id = await f.send(`late ${mode} steer`);
    await eventually('pending steer', () => f.native.calls.some(c => c.method === 'turn/steer' && textOf(c.params).includes(id)) || undefined);
    f.native.complete('original');
    // At the native boundary both an absent reply and a reply held beyond its deadline are RpcNoAnswer.
    response.reject(new RpcNoAnswer(`no answer before deadline (${mode})`));
    await eventually('uncertain receipt', async () => (await f.log()).includes(`"event":"inject-uncertain","id":"${id}"`) || undefined);
    const events = await f.records();
    assert.equal(events.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 0);
    assert.equal(f.native.count('turn/start'), 0);
    assert.equal(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).text === `pong: @impl late ${mode} steer`).length, 0);
  }
});

test('successful completion reconciles late rejected, consumed and dropped steer responses', async t => {
  const f = await scriptedCodex(t);
  for (const mode of ['reject', 'accept', 'accept dropped']) {
    await active(f);
    const response = deferred<unknown>();
    f.native.handlers.set('turn/steer', () => response.promise);
    const body = `${mode} pending steer response`;
    const id = await f.send(body);
    await eventually('pending admission', () => f.native.calls.some(c => c.method === 'turn/steer' && textOf(c.params).includes(id)) || undefined);
    const input = textOf(f.native.calls.filter(c => c.method === 'turn/steer').at(-1)!.params);
    if (mode === 'accept') f.native.item('original', input);
    f.native.complete('original');
    if (mode === 'reject') response.reject(new RpcError(-32000, 'no active turn to steer'));
    else response.resolve({});
    await f.injected(id);
    if (mode === 'accept dropped') await recoveries(f, id, 1);
    if (mode !== 'accept') await consumeRecovery(f);
    await f.reply(id, body);
    const events = await f.records();
    assert.equal(events.filter(e => e.event === 'harness-redelivered' && e.id === id).length, mode === 'accept dropped' ? 1 : 0);
    assert.equal(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).text === `pong: @impl ${body}`).length, 1);
  }
});

test('accepted dropped steers are recovered once while consumed steers stay consumed', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const taken = await f.send('a steer the turn takes up');
  await f.injected(taken);
  const input = textOf(f.native.calls.filter(c => c.method === 'turn/steer').at(-1)!.params);
  f.native.item('original', input);
  const dropped = await f.send('drop this steer');
  await f.injected(dropped);
  assert.equal(f.native.count('turn/steer'), 2);
  f.native.complete('original');
  await recoveries(f, dropped, 1);
  await consumeRecovery(f);
  await f.reply(taken, 'a steer the turn takes up');
  await f.reply(dropped, 'drop this steer');
  assert.deepEqual((await f.records()).filter(e => e.event === 'harness-redelivered').map(e => [e.session, e.id]), [['impl', dropped]]);
  assert.equal((await f.log()).split('\n').filter(line => line.includes('"harness-steered"') && line.includes(taken)).length, 1);
  assert.deepEqual((await f.agents()).filter(m => m.kind === 'redelivered').map(m => m.text), [redelivered(false)]);
});

test('idle tool-output readback distinguishes consumed, unannounced and unread inputs', async t => {
  const f = await scriptedCodex(t);
  for (const mode of ['announced', 'unannounced', 'lost envelope', 'read refused', 'unknown item']) {
    f.native.handlers.delete('thread/read');
    const before = f.native.count('turn/start');
    const body = `idle ${mode}`;
    const id = await f.send(body);
    await f.injected(id);
    const request = f.native.calls.filter(c => c.method === 'turn/start').at(-1)!;
    assert.equal((request.params.toolOutput as { name: string }).name, 'hub_event');
    const turn = [...f.native.turns.keys()].at(-1)!;
    if (mode === 'announced' || mode === 'unannounced') f.native.item(turn, textOf(request.params), 'toolOutput', mode === 'announced');
    else if (mode === 'unknown item') f.native.turns.get(turn)!.push({ type: 'unknownInput' });
    else f.native.item(turn, 'unrelated user input', 'text', false);
    if (mode === 'read refused') f.native.handlers.set('thread/read', () => { throw new RpcError(-32000, 'readback refused'); });
    f.native.complete(turn);
    await f.reply(id, body);
    const unread = !['announced', 'unannounced'].includes(mode);
    if (unread) await eventually('unread receipt', async () => (await f.records()).some(e => e.event === 'harness-turn-unread' && e.ids?.includes(id)) || undefined);
    f.native.handlers.delete('thread/read');
    // A later completed native input is the positive barrier replacing every settling sleep.
    const later = await f.send(`later ${mode}`);
    await f.injected(later);
    await consumeRecovery(f);
    await f.reply(later, `later ${mode}`);
    const records = await f.records();
    assert.deepEqual(records.filter(e => e.event === 'harness-turn-unread' && e.ids?.includes(id)).map(e => [e.ids, e.error]), unread ? [[[id], mode === 'read refused' ? 'readback refused' : "the turn's record shows no input item of the shape it was admitted in"]] : []);
    assert.deepEqual(records.filter(e => /harness-(redelivered|redelivery-failed)/.test(e.event)), []);
    assert.equal(f.native.count('turn/start'), before + 2, 'one native turn per delivery');
    assert.deepEqual(f.ui.frames.filter(frame => frame.type === 'message' && (frame.message as Message).replyTo === id).map(frame => (frame.message as Message).text), [`pong: @impl ${body}`]);
  }
  assert.deepEqual((await f.agents()).filter(m => m.kind === 'redelivered' || m.kind === 'turn-failed'), []);
});

test('a recovery dropped in a newer turn retains its obligation until consumed', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('drop recovery in newer turn');
  await f.injected(id);
  f.native.handlers.set('thread/read', () => {
    if (!f.native.turns.has('newer')) f.native.start('newer');
    return { thread: { turns: [...f.native.turns].map(([id, items]) => ({ id, items })) } };
  });
  f.native.handlers.set('turn/start', () => ({ turn: { id: 'newer' } }));
  f.native.complete('original');
  await recoveries(f, id, 1);
  f.native.item('newer', 'unrelated newer input');
  f.native.handlers.delete('turn/start');
  f.native.complete('newer');
  await recoveries(f, id, 2);
  await consumeRecovery(f);
  await f.reply(id, 'drop recovery in newer turn');
  assert.equal((await f.records()).filter(e => e.event === 'harness-redelivered' && e.id === id).length, 2);
  assert.deepEqual((await f.agents()).filter(m => m.kind === 'redelivered').map(m => m.text), [redelivered(true), redelivered(false)]);
});

test('a recovered turn failing before its admission response notifies the original sender once', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('fail recovered turn before response', true);
  await f.injected(id);
  const response = deferred<unknown>();
  f.native.handlers.set('turn/start', () => { f.native.start('recovery'); f.native.complete('recovery', true); return response.promise; });
  f.native.complete('original');
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).text === failure);
  response.resolve({ turn: { id: 'recovery' } });
  await f.sender.waitForEvent(e => e.params.content.includes(failure));
  await f.records();
  assert.equal(f.sender.events.filter(e => e.params.content.includes(failure)).length, 1);
  const events = (await f.ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.equal(events.rows.filter(row => row.text === failure).length, 1);
});

test('a refused recovery reports its failure through journal, Agents, events and original sender', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('refuse recovered request', true);
  await f.injected(id);
  f.native.handlers.set('turn/start', () => { throw new RpcError(-32000, 'recovery request refused'); });
  f.native.complete('original');
  const expected = 'impl [Implementer]: its turn ended without a message it had accepted, and delivering it again failed: recovery request refused';
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'turn-failed' && (frame.message as Message).text === expected);
  const records = await f.records();
  assert.equal(records.filter(e => e.event === 'harness-redelivery-failed' && e.id === id && e.error === 'recovery request refused').length, 1);
  assert.equal(records.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 0);
  const events = (await f.ui.request({ type: 'events.list' })).value as { rows: Array<{ text: string }> };
  assert.equal(events.rows.filter(row => row.text === expected).length, 1);
  await f.sender.waitForEvent(e => e.params.content.includes('redelivery failed: recovery request refused'));
});

test('repeated dropped recoveries stop visibly after two attempts', async t => {
  const f = await scriptedCodex(t);
  await active(f);
  const id = await f.send('drop every recovery');
  await f.injected(id);
  f.native.complete('original');
  for (let attempt = 1; attempt <= 2; attempt++) {
    await recoveries(f, id, attempt);
    const turn = [...f.native.turns.keys()].at(-1)!;
    // A known tool output of the right shape permits a negative consumption judgment.
    f.native.item(turn, 'another envelope', 'toolOutput');
    f.native.complete(turn);
  }
  await f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).kind === 'turn-failed' && (frame.message as Message).text.includes('still missing after two redeliveries'));
  const records = await f.records();
  assert.equal(records.filter(e => e.event === 'harness-redelivered' && e.id === id).length, 2);
  assert.equal(records.filter(e => e.event === 'harness-redelivery-failed' && e.id === id).length, 1);
  assert.equal(f.native.count('turn/start'), 2, 'no third native recovery');
});

test('native RPC classifies malformed replies and accepted-then-disconnected requests as unanswered', async () => {
  for (const mode of ['malformed', 'disconnected']) {
    const output = new PassThrough();
    const input = new PassThrough();
    const calls: string[] = [];
    input.on('data', bytes => {
      for (const line of String(bytes).trim().split('\n')) {
        const frame = JSON.parse(line) as { id?: number; method: string };
        calls.push(frame.method);
        if (frame.method === 'initialize') output.write(JSON.stringify({ id: frame.id, result: {} }) + '\n');
        else if (frame.method === 'turn/start') {
          // Receipt of this request precedes either fault: the server may have run the input.
          if (mode === 'malformed') output.write('not JSON\n');
          else output.end();
        }
      }
    });
    const client = await AppServerClient.connectStdio(output, input, { client: { name: 'test', version: '0' } });
    try {
      await assert.rejects(client.request('turn/start', { threadId: 'thread', input: [] }), RpcNoAnswer);
      assert.equal(calls.filter(method => method === 'turn/start').length, 1);
    } finally { client.close(); output.destroy(); input.destroy(); }
  }
});
