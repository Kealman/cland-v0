// Native HTTP/SSE transport double. Production OpenCode watch/inject and the real hub/spoke
// handle every frame; only process lifecycle and the server's transport are scripted.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.ts';
import { OpenCodeClient, type PermissionRequest, type ServerEvent } from '../../src/adapters/opencode/client.ts';
import type { HarnessProcess } from '../../src/adapters/contract.ts';
import type { Message } from '../../src/protocol.ts';
import { FakeClock } from '../fake-clock.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from '../harness.ts';
import { fakeHarness } from './harness.ts';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
export class ScriptedOpenCode {
  session = '';
  running = false;
  permissions: PermissionRequest[] = [];
  readonly prompts: Array<{ id: string; text: string; delivery: string; running: boolean }> = [];
  readonly lookups: Array<ReturnType<typeof deferred<unknown>>> = [];
  holdMessages = false;
  failPut = false;
  failDelete = false;
  instruction: string | undefined;
  opens = 0;
  reconnected = 0;
  onEvent: (event: ServerEvent) => void = () => {};
  endStream = () => {};
  emit(type: string, data: Record<string, unknown> = {}) { this.onEvent({ type, data: { sessionID: this.session, ...data } }); }
  async events(onEvent: (e: ServerEvent) => void, onOpen: () => void, signal: AbortSignal) {
    this.onEvent = onEvent;
    const ended = deferred<void>();
    this.endStream = () => ended.resolve();
    signal.addEventListener('abort', this.endStream, { once: true });
    this.opens++;
    onOpen();
    try { await ended.promise; } finally { signal.removeEventListener('abort', this.endStream); }
  }
  message() { return { data: { type: 'assistant', privateInput: 'private-message', content: [
    { type: 'tool', id: 'wrong', name: 'shell', state: { status: 'completed', input: { command: 'wrong command' } } },
    { type: 'tool', id: 'tool-shell', name: 'shell', state: { status: 'completed', input: { command: 'touch approved && echo done', privateInput: 'private-tool' } } },
    { type: 'tool', id: 'tool-edit', name: 'edit', state: { status: 'completed', input: { command: 'private-edit-command' } } },
  ] } }; }
  request(method: string, path: string, body?: unknown): unknown {
    if (path === '/api/session/active') return { data: this.running ? { [this.session]: {} } : {} };
    if (path.endsWith('/permission')) return { data: this.permissions };
    if (path.endsWith('/form')) return { data: [] };
    if (path.includes('/message/')) {
      if (!this.holdMessages) return this.message();
      const response = deferred<unknown>(); this.lookups.push(response); return response.promise;
    }
    if (path.endsWith('/prompt')) {
      const input = body as { text: string; delivery: string };
      const prompt = { id: `inbox-${this.prompts.length}`, ...input, running: this.running };
      this.prompts.push(prompt);
      this.emit('session.inbox.enqueued', { inboxID: prompt.id, item: { payload: { text: input.text } } });
      return { data: { id: prompt.id } };
    }
    if (path.endsWith('/instructions/entries/cland-role')) {
      if (method === 'PUT') { if (this.failPut) throw new Error('PUT unavailable'); this.instruction = (body as { value: string }).value; }
      else if (method === 'DELETE') { if (this.failDelete) throw new Error('DELETE unavailable'); this.instruction = undefined; }
      else throw new Error(`unscripted instruction method ${method}`);
      return {};
    }
    throw new Error(`unscripted native request ${method} ${path}`);
  }
  start() { this.running = true; this.emit('session.execution.started'); }
  deliver(prompt: { id: string }) { this.emit('session.inbox.delivered', { inboxID: prompt.id }); }
  complete(failed = false) {
    this.running = false; this.permissions = [];
    this.emit(failed ? 'session.execution.failed' : 'session.execution.succeeded', failed ? { error: { message: 'Upstream request failed: Endpoint is unavailable' } } : {});
  }
  ask(id = 'shell', action = 'shell', source = true) {
    const request = { id, action, resources: ['private-resource'], metadata: { secret: 'private-permission-metadata' }, ...(source ? { source: { type: 'tool', messageID: 'assistant', id: `tool-${action}` } } : {}) };
    this.permissions = [request]; this.emit('permission.asked', request); return request;
  }
  approve(id = 'shell', reply = 'once') { this.permissions = []; this.emit('permission.replied', { requestID: id, reply }); }
  shutdown() { this.running = false; this.emit('session.execution.interrupted', { reason: 'shutdown' }); }
  async releaseMessages() {
    this.holdMessages = false;
    const pending = this.lookups.splice(0);
    for (const lookup of pending) lookup.resolve(this.message());
    await Promise.all(pending.map(lookup => lookup.promise));
  }
}

export async function scriptedOpenCode(t: TestContext, roleInstructions = false) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = new ScriptedOpenCode();
  t.mock.method(OpenCodeClient.prototype, 'request', async (method: string, path: string, body?: unknown) => native.request(method, path, body));
  t.mock.method(OpenCodeClient.prototype, 'events', native.events.bind(native));
  let adapter!: OpenCodeAdapter;
  let process!: HarnessProcess;
  let launchToken: string | undefined;
  const { discovery } = await projectHub(t, root, {}, { clock, adapters: [(host) => {
    const lifecycle = fakeHarness('opencode', { host, clock });
    adapter = new OpenCodeAdapter({ ...host, reconnected: id => { native.reconnected++; host.reconnected?.(id); } }, { clock, roleInstructions });
    const spawn = lifecycle.spawn.bind(lifecycle);
    lifecycle.spawn = async (...args) => {
      launchToken = args[0].launchToken; process = await spawn(...args);
      process = { ...process, pid: null, harnessId: 'http://scripted-opencode' };
      native.session = process.harnessSessionId!;
      await mkdir(join(root, '.cland/opencode', process.name), { recursive: true });
      await writeFile(join(root, '.cland/opencode', process.name, 'password'), 'synthetic-password');
      return process;
    };
    lifecycle.inject = adapter.inject.bind(adapter);
    lifecycle.watch = adapter.watch.bind(adapter);
    lifecycle.unwatch = adapter.unwatch.bind(adapter);
    lifecycle.usage = adapter.usage.bind(adapter);
    const close = lifecycle.close.bind(lifecycle);
    lifecycle.close = () => { adapter.close(); close(); };
    return lifecycle;
  }] });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  assert.equal((await ui.request({ type: 'session.launch', harness: 'opencode', name: 'impl', role: 'implementer' })).ok, true);
  await eventually('native snapshot applied', () => native.reconnected === 1 || undefined);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: process.sessionId, ...(launchToken ? { launchToken } : {}) });
  await peer.waitForPresence(['impl']);
  await peer.waitForEvent(e => e.params.meta?.kind === 'role');
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'sender', role: 'reviewer' });
  await sender.waitForPresence(['sender']);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  async function records() {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
  }
  async function log() { await records(); return readFile(join(root, '.cland/log/hub.log'), 'utf8'); }
  async function send(text: string, bySender = false) {
    const result = await (bySender ? sender : coord).call<{ ok: boolean; error?: string }>('send', { to: ['impl'], text });
    assert.equal(result.ok, true, result.error);
    const frame = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === text);
    const id = (frame.message as Message).id;
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    const prompt = native.prompts.find(p => p.text.includes(`msg_id="${id}"`));
    assert.ok(prompt, "the native admission carries the hub message");
    return { ...prompt, messageId: id };
  }
  async function reply(input: { messageId: string }, text: string) {
    const result = await peer.call<{ ok: boolean; error?: string }>('send', { to: ['coord'], text, reply_to: input.messageId });
    assert.equal(result.ok, true, result.error);
    await ui.waitFor(f => f.type === 'message' && (f.message as Message).replyTo === input.messageId && (f.message as Message).text === text);
  }
  async function reconnect() {
    const before = native.reconnected;
    native.endStream();
    await eventually('fresh SSE snapshot applied', async () => { await clock.advance(100); return native.reconnected > before || undefined; });
  }
  const states = () => ui.frames.filter(f => f.type === 'session.state' && f.session === 'impl');
  async function row() { return ((await ui.request({ type: 'session.list' })).value as { processes: Array<{ status: string; state: string; approvalCommand?: string }> }).processes.find(p => p.state !== undefined)!; }
  async function idle() { native.complete(); await ui.waitFor(f => f.type === 'session.state' && f.session === 'impl' && f.state === 'idle' && ui.frames.indexOf(f) >= mark); }
  let mark = 0;
  // Every positive state wait starts after the caller's mark, avoiding a prior episode's receipt.
  function markStates() { mark = ui.frames.length; return mark; }
  async function state(state: string) { return ui.waitFor(f => f.type === 'session.state' && f.session === 'impl' && f.state === state && ui.frames.indexOf(f) >= mark); }
  return { root, clock, native, ui, peer, sender, coord, adapter, process, records, log, send, reply, reconnect, states, row, idle, markStates, state };
}
