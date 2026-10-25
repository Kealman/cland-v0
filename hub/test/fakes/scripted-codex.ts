// A native app-server connection double. It scripts RPC replies and emits production protocol
// notifications; the Codex adapter still owns admission, snapshots, readback and recovery.
import { completeJournalLines } from '../journal-lines.ts';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RpcNoAnswer } from '../../src/adapters/codex/app-server.ts';
import { CodexAdapter, type AppServerConnection } from '../../src/adapters/codex.ts';
import type { HarnessProcess, HarnessAdapter } from '../../src/adapters/contract.ts';
import type { Message } from '../../src/protocol.ts';
import { FakeClock } from '../fake-clock.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from '../harness.ts';
import { fakeHarness } from './harness.ts';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export type NativeItem = { type: string; content?: Array<{ text: string }>; name?: string; namespace?: string; output?: string };
export type NativeCall = { method: string; params: Record<string, unknown> };
type Handler = (params: Record<string, unknown>) => unknown | Promise<unknown>;

export class ScriptedCodex extends EventEmitter implements AppServerConnection {
  closed = false;
  readonly calls: NativeCall[] = [];
  readonly responses: Array<{ id: string | number; result: Record<string, unknown> }> = [];
  onResponse?: (id: string | number, result: Record<string, unknown>) => void | Promise<void>;
  readonly turns = new Map<string, NativeItem[]>();
  readonly handlers = new Map<string, Handler>();
  thread = '';
  #turn = 0;
  readonly #pending = new Set<{ reject: (error: Error) => void }>();
  async respond(id: string | number, result: Record<string, unknown>): Promise<void> {
    if (this.closed) throw new Error('app-server disconnected');
    this.responses.push({ id, result });
    await this.onResponse?.(id, result);
  }
  async request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    if (this.closed) throw new Error('app-server disconnected');
    this.calls.push({ method, params });
    const pending = deferred<T>();
    this.#pending.add(pending);
    try {
      const reply = this.#reply(method, params);
      Promise.resolve(reply).then(value => pending.resolve(value as T), pending.reject);
      return await pending.promise;
    } finally { this.#pending.delete(pending); }
  }
  #reply(method: string, params: Record<string, unknown>): unknown | Promise<unknown> {
    if (this.handlers.has(method)) return this.handlers.get(method)!(params);
    if (method === 'thread/resume') return { thread: { id: this.thread, status: { type: 'idle' } } };
    if (method === 'thread/read') return { thread: { id: this.thread, turns: [...this.turns].map(([id, items]) => ({ id, items })) } };
    if (method === 'turn/steer') return {};
    if (method === 'turn/start') {
      const id = `turn-${++this.#turn}`;
      this.start(id);
      return { turn: { id } };
    }
    if (method === 'account/rateLimits/read') return {};
    throw new Error(`unscripted RPC ${method}`);
  }
  notify(method: string, params: Record<string, unknown>) { this.emit('notification', method, { threadId: this.thread, ...params }); }
  state(type: 'idle' | 'active', activeFlags: string[] = []) { this.notify('thread/status/changed', { status: { type, activeFlags } }); }
  approval(command = 'touch approved') { this.emit('serverRequest', { id: 'approval', method: 'item/commandExecution/requestApproval', params: { threadId: this.thread, command, privateInput: 'PRIVATE-TOOL-INPUT' } }); }
  start(id: string) { this.turns.set(id, []); this.state('active'); this.notify('turn/started', { turn: { id } }); }
  item(turnId: string, text: string, shape: 'text' | 'toolOutput' = 'text', announce = true) {
    const item: NativeItem = shape === 'text' ? { type: 'userMessage', content: [{ text }] } : { type: 'functionCallOutput', name: 'hub_event', namespace: 'cland', output: text };
    this.turns.get(turnId)!.push(item);
    if (announce) this.notify('item/completed', { turnId, item });
  }
  complete(id: string, failed = false) {
    this.state('idle');
    this.notify('turn/completed', { turn: { id, status: failed ? 'failed' : 'completed', ...(failed ? { error: { message: 'Upstream request failed: Endpoint is unavailable' } } : {}) } });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.#pending) pending.reject(new RpcNoAnswer('scripted native connection closed'));
    this.emit('close');
  }
  count(method: string) { return this.calls.filter(call => call.method === method).length; }
}

export async function scriptedCodex(t: TestContext, beforePublish?: (native: ScriptedCodex, process: HarnessProcess) => Promise<void>, options: { startupDelayMs?: number } = {}) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = new ScriptedCodex();
  let adapter!: CodexAdapter;
  let process!: HarnessProcess;
  let connections = 0;
  let connectionFailure: Error | null = null;
  let launchToken: string | undefined;
  const { discovery } = await projectHub(t, root, {}, { clock, adapters: [(host) => {
    // Session-manager construction precedes the serving receipt. Model slow
    // adapter initialization without processes or wall-clock waiting.
    clock.block(options.startupDelayMs ?? 0);
    const lifecycle: ReturnType<typeof fakeHarness> & Pick<HarnessAdapter, 'stateReason'> = fakeHarness('codex', { host, clock });
    adapter = new CodexAdapter(host, { clock, pollMs: 100, connect: async () => { connections++; if (connectionFailure) throw connectionFailure; native.closed = false; return native; } });
    // Only lifecycle is replaced: inject, watch and every native event use the production adapter.
    const spawn = lifecycle.spawn.bind(lifecycle);
    lifecycle.spawn = async (...args) => {
      launchToken = args[0].launchToken; process = await spawn(...args); native.thread = process.harnessSessionId!;
      if (beforePublish) {
        // Native first-turn events can precede the process-table publication and its normal watch.
        adapter.watch(process);
        await eventually('early native subscription', () => native.count('thread/resume') === 1 || undefined);
        await beforePublish(native, process);
      }
      return process;
    };
    lifecycle.inject = adapter.inject.bind(adapter);
    lifecycle.watch = adapter.watch.bind(adapter);
    lifecycle.unwatch = adapter.unwatch.bind(adapter);
    lifecycle.usage = adapter.usage.bind(adapter);
    lifecycle.stateReason = adapter.stateReason.bind(adapter);
    lifecycle.answerApproval = (process, id, answer) => adapter.answerApproval(process, id, answer);
    const close = lifecycle.close.bind(lifecycle);
    lifecycle.close = () => { adapter.close(); close(); };
    return lifecycle satisfies HarnessAdapter;
  }] });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'codex', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  await eventually('native subscription', () => native.count('thread/resume') === 1 || undefined);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: process.sessionId, ...(launchToken ? { launchToken } : {}) });
  await peer.waitForPresence(['impl']);
  const sender = await inProcessSpoke(t, { discover: true, cwd: root, name: 'sender', role: 'reviewer' });
  await sender.waitForPresence(['sender']);
  async function send(body: string, bySender = false) {
    const text = `@impl ${body}`;
    const result = bySender ? await sender.call<{ ok: boolean; error?: string }>('send', { to: ['impl'], text }) : await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text });
    assert.equal(result.ok, true, result.error);
    const frame = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === text);
    return (frame.message as Message).id;
  }
  async function injected(id: string) { await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected'); }
  async function reply(id: string, text: string) {
    assert.equal((await peer.call<{ ok: boolean }>('send', { topic: 'general', text: `pong: @impl ${text}`, reply_to: id })).ok, true);
    await ui.waitFor(f => f.type === 'message' && (f.message as Message).replyTo === id);
  }
  async function records() {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; ids?: string[]; session?: string; error?: string });
  }
  async function log() { await records(); return readFile(join(root, '.cland/log/hub.log'), 'utf8'); }
  async function agents() { return ((await ui.request({ type: 'topic.history', topic: 'agents', limit: 50 })).value as { messages: Array<{ kind?: string; text: string }> }).messages; }
  async function reconnect() {
    // A fresh connection has fresh listeners, just as AppServerClient.connect returns in production.
    native.close(); native.removeAllListeners();
    await clock.advance(100);
    await ui.request({ type: 'session.list' });
  }
  return { refuseConnections(error: Error | null) { connectionFailure = error; }, root, discovery, clock, native, ui, peer, sender, send, injected, reply, records, log, agents, reconnect, get adapter() { return adapter; }, get process() { return process; }, get connections() { return connections; } };
}
