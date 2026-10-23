// Native HTTP/SSE transport double. Production OpenCode watch/inject and the real hub/spoke
// handle every frame; only process lifecycle and the server's transport are scripted.
import { completeJournalLines } from '../journal-lines.ts';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.ts';
import { HttpError, OpenCodeClient, type PermissionRequest, type ServerEvent } from '../../src/adapters/opencode/client.ts';
import type { AdapterHost, HarnessProcess } from '../../src/adapters/contract.ts';
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
  readonly children = new Map<string, { running: boolean; permissions: PermissionRequest[]; forms: string[] }>();
  holdPermissionSession: string | undefined;
  readonly permissionSnapshots: Array<{ response: ReturnType<typeof deferred<unknown>>; data: PermissionRequest[] }> = [];
  readonly prompts: Array<{ id: string; text: string; delivery: string; running: boolean }> = [];
  readonly promptAttempts: Array<{ id?: string; text: string; delivery: string }> = [];
  readonly replies: Array<{ session: string; request: string; decision: string; message?: string }> = [];
  onReply?: () => unknown;
  replyFailure: { status: number; body: string } | undefined;
  losePromptResponse = false;
  readonly lookups: Array<ReturnType<typeof deferred<unknown>>> = [];
  holdMessages = false;
  shellCommand = 'touch approved && echo done';
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
    { type: 'tool', id: 'tool-shell', name: 'shell', state: { status: 'completed', input: { command: this.shellCommand, privateInput: 'private-tool' } } },
    { type: 'tool', id: 'tool-edit', name: 'edit', state: { status: 'completed', input: { command: 'private-edit-command' } } },
  ] } }; }
  request(method: string, path: string, body?: unknown): unknown {
    if (path === '/api/session/active') return { data: Object.fromEntries([
      ...(this.running ? [[this.session, {}]] : []),
      ...[...this.children].filter(([, s]) => s.running).map(([id]) => [id, {}]),
    ]) };
    const sid = decodeURIComponent(path.split('/')[3] ?? '');
    if (path.includes('/permission/') && path.endsWith('/reply') && method === 'POST') {
      if (this.onReply) return this.onReply();
      if (this.replyFailure) throw new HttpError(this.replyFailure.status, this.replyFailure.body);
      const request = decodeURIComponent(path.split('/')[5]!);
      const answer = body as { decision: string; message?: string };
      this.replies.push({ session: sid, request, ...answer });
      const permissions = sid === this.session ? this.permissions : this.children.get(sid)?.permissions ?? [];
      const remaining = permissions.filter(p => answer.decision !== 'reject' && p.id !== request);
      if (sid === this.session) this.permissions = remaining;
      else if (this.children.has(sid)) this.children.get(sid)!.permissions = remaining;
      this.emit('permission.replied', { sessionID: sid, requestID: request, reply: answer.decision });
      return { data: true };
    }
    if (path.endsWith('/permission')) {
      const data = structuredClone(sid === this.session ? this.permissions : this.children.get(sid)?.permissions ?? []);
      if (sid !== this.holdPermissionSession) return { data };
      const response = deferred<unknown>();
      this.permissionSnapshots.push({ response, data });
      return response.promise;
    }
    if (path.endsWith('/form')) return { data: (this.children.get(sid)?.forms ?? []).map(id => ({ id })) };
    if (path.includes('/message/')) {
      if (!this.holdMessages) return this.message();
      const response = deferred<unknown>(); this.lookups.push(response); return response.promise;
    }
    if (path.endsWith('/prompt')) {
      const input = body as { id?: string; text: string; delivery: string };
      this.promptAttempts.push(input);
      const existing = input.id && this.prompts.find(p => p.id === input.id);
      if (existing) return { data: { id: existing.id } };
      const prompt = { id: `inbox-${this.prompts.length}`, ...input, running: this.running };
      this.prompts.push(prompt);
      this.emit('session.inbox.enqueued', { inboxID: prompt.id, item: { payload: { text: input.text } } });
      if (this.losePromptResponse) {
        this.losePromptResponse = false;
        throw new DOMException('Admission response lost', 'TimeoutError');
      }
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
  async releasePermissionSnapshots() {
    this.holdPermissionSession = undefined;
    const pending = this.permissionSnapshots.splice(0);
    for (const { response, data } of pending) response.resolve({ data });
    await Promise.all(pending.map(({ response }) => response.promise));
  }
}

export async function scriptedOpenCode(t: TestContext, roleInstructions = false, withItem = false) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = new ScriptedOpenCode();
  t.mock.method(OpenCodeClient.prototype, 'request', async (method: string, path: string, body?: unknown) => native.request(method, path, body));
  t.mock.method(OpenCodeClient.prototype, 'events', native.events.bind(native));
  let adapter!: OpenCodeAdapter;
  let process!: HarnessProcess;
  let launchToken: string | undefined;
  const factory = (host: AdapterHost) => {
    const lifecycle = fakeHarness('opencode', { host, clock });
    if (process) lifecycle.scriptResume(process.name, 'found');
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
    lifecycle.answerApproval = adapter.answerApproval?.bind(adapter);
    const close = lifecycle.close.bind(lifecycle);
    lifecycle.close = () => { adapter.close(); close(); };
    return lifecycle;
  };
  let hub = await projectHub(t, root, {}, { clock, adapters: [factory] });
  let discovery = hub.discovery;
  let ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const created = withItem ? await ui.request({ type: 'task.create', title: 'OpenCode item', kind: 'epic' }) : null;
  const item = created ? (created.value as { item: { id: string } }).item.id : undefined;
  assert.equal((await ui.request({ type: 'session.launch', harness: 'opencode', name: 'impl', role: withItem ? 'lead' : 'implementer', ...(item ? { item } : {}) })).ok, true);
  await eventually('native snapshot applied', () => native.reconnected === 1 || undefined);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', assignRole: false, sessionId: process.sessionId, ...(launchToken ? { launchToken } : {}) });
  await peer.waitForPresence(['impl']);
  await peer.waitForEvent(e => e.params.meta?.kind === 'role');
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'sender', role: 'reviewer', sessionId: 'scripted-sender' });
  await sender.waitForPresence(['sender']);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'scripted-coord' });
  await coord.waitForPresence(['coord']);
  async function records() {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; session?: string });
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
  async function restartHub() {
    ui.close();
    await hub.stop();
    const before = native.reconnected;
    hub = await projectHub(t, root, {}, { clock, adapters: [factory] });
    discovery = hub.discovery;
    ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    await eventually('new hub native snapshot applied', () => native.reconnected > before || undefined);
  }
  return { root, get discovery() { return discovery; }, clock, native, get ui() { return ui; }, peer, sender, coord, get adapter() { return adapter; }, process, restartHub, records, log, send, reply, reconnect, states, row, idle, markStates, state };
}
