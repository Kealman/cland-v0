/// <reference lib="dom" />
// T1: connectHub's public callback over a scripted browser socket; no network or real clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectHub, type ConnectionState } from '../../web/src/connection.ts';
import type { AccountView, Artifact, Capabilities, HubFrame, RemoteStateRow, SessionRow, SnapshotValues, Topic, VerificationQueue, WorkbenchRequest } from '../../shared/wire/index.ts';

const account = (name: string): AccountView => ({ name, harness: 'codex', path: `/scratch/${name}`, variable: 'CODEX_HOME', windows: [], at: null, source: null });
const artifact = (title: string): Artifact => ({ id: 'A-1', title, kind: 'note', path: '/scratch/note.md', creator: 'human', time: '2026-10-22T10:00:00Z', topic: 'general', status: 'shared' });
const queue: VerificationQueue = { version: 1, at: '2026-10-22T10:00:00Z', holder: null, waiters: [], metrics: { window: 20, count: 0, wait: { count: 0, medianMs: null, p90Ms: null }, run: { count: 0, medianMs: null, p90Ms: null } } };
const session = (name: string, key = name): SessionRow => ({ key, name, sessionId: key, role: null, label: name, cwd: '/scratch', harness: 'codex', status: 'running', state: 'idle', stateSince: null, launched: true, live: true, presence: null, holds: [], item: null, itemKind: null, itemRequested: false, additionalHolds: 0 });
const sessions = (name: string): SnapshotValues['sessions'] => ({ rows: [session(name)], processes: [], presence: [], archived: 3, roles: { roles: [{ role: 'implementer', label: 'Implementer', exclusive: false, skills: [], holders: [], launch: { harness: 'codex', model: 'chosen-model', account: 'zeta', effort: 'high', approval: null, permissions: null, sandbox: null } }], coordinator: null }, crew: { config: { leads: [], idle_from: [], idle_categories: [], idle_ignored: [], crew: {} }, summary: '' }, coordinator: null, verification: queue });

function scripted(t: import('node:test').TestContext) {
  let state: ConnectionState = { project: '', live: false };
  const sockets: ScriptedSocket[] = [];
  class ScriptedSocket {
    static OPEN = 1;
    readyState = 1;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    sent: WorkbenchRequest[] = [];
    constructor() { sockets.push(this); }
    send(line: string) { this.sent.push(JSON.parse(line)); }
    close() { this.readyState = 3; this.onclose?.(); }
    receive(frame: HubFrame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  }
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-10-22T11:00:00Z') });
  for (const [key, value] of Object.entries({ WebSocket: ScriptedSocket, location: { href: 'http://fixture/', protocol: 'http:' }, document: { querySelector: () => null } })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  const stop = connectHub(value => { state = value; });
  t.after(stop);
  return { get state() { return state; }, get socket() { return sockets.at(-1)!; }, sockets };
}

test('area snapshots retain merged sessions, launch defaults, queue arrival and ordered account views', t => {
  const client = scripted(t);
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'sessions', value: sessions('first') });
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'accounts', value: { registry: '/scratch/accounts.toml', error: 'registry warning', accounts: [account('zeta'), account('alpha')] } });
  assert.deepEqual(client.state.sessions, [session('first')]);
  assert.equal(client.state.archivedSessions, 3);
  assert.equal(client.state.roles?.roles[0]?.launch.model, 'chosen-model');
  assert.deepEqual(client.state.verification, { queue, receivedAt: Date.now() });
  assert.deepEqual(client.state.accounts?.accounts.map(row => row.name), ['zeta', 'alpha']);
  assert.equal(client.state.accounts?.error, 'registry warning');
});

test('remote state replaces all messenger facts and a previous-hub snapshot clears the optional rows', t => {
  const client = scripted(t);
  const healthy: RemoteStateRow = { messenger: 'telegram', enabled: true, connection: 'connected', offlineSince: null,
    pairedName: 'Phone human', mute: true, outboxDepth: 3, lastError: null };
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'sessions', value: { ...sessions('first'), remotes: [healthy] } });
  assert.deepEqual(client.state.remotes, [healthy]);
  const stopped: RemoteStateRow = { ...healthy, connection: 'stopped', pairedName: null, mute: false,
    outboxDepth: 7, lastError: 'bot blocked (403)', stopCause: 'blocked' };
  const discord: RemoteStateRow = { messenger: 'discord', enabled: false, connection: 'disabled', offlineSince: null,
    pairedName: null, mute: false, outboxDepth: 0, lastError: null };
  client.socket.receive({ type: 'remote.state', remotes: [stopped, discord] });
  assert.deepEqual(client.state.remotes, [stopped, discord]);
  assert.deepEqual(client.socket.sent, [], 'safe pushes need no remote.status or other reread');
  // Literal previous-hub shape: the field is absent, not null or an empty array.
  client.socket.receive({ type: 'snapshot', epoch: 'older', seq: 0, domain: 'sessions', value: sessions('older-hub') });
  assert.equal(client.state.remotes, undefined, 'replacement snapshots cannot retain stale remote facts');
  assert.equal(client.state.sessions?.[0]?.name, 'older-hub');
});

test('area deltas replace complete views without inventory requests and retain registry order', t => {
  const client = scripted(t);
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'accounts', value: { registry: '/scratch/accounts.toml', accounts: [account('zeta'), account('alpha')] } });
  client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [artifact('Before')] } });
  const updated: AccountView = { ...account('zeta'), windows: [{ id: 'five_hour', label: '5h', usedPercent: 81, resetsAt: '2026-10-22T16:00:00Z' }], at: '2026-10-22T11:00:00Z', source: { kind: 'poll' } };
  client.socket.sent.length = 0;
  client.socket.receive({ type: 'account', account: updated });
  client.socket.receive({ type: 'artifact', artifact: artifact('After') });
  t.mock.timers.tick(1000);
  client.socket.receive({ type: 'verification.queue', queue: { ...queue, metrics: { ...queue.metrics, count: 7 } } });
  assert.deepEqual(client.state.accounts?.accounts, [updated, account('alpha')]);
  assert.deepEqual(client.state.artifacts, [artifact('After')]);
  assert.equal(client.state.rows?.Artifacts?.[0]?.title, 'After');
  assert.equal(client.state.verification?.queue?.metrics.count, 7);
  assert.equal(client.state.verification?.receivedAt, Date.parse('2026-10-22T11:00:01Z'));
  assert.deepEqual(client.socket.sent, [], 'delta delivery needs no inventory round trip');
});

test('merged session deltas update inventories by stable key without process or presence rereads', t => {
  const client = scripted(t);
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'sessions', value: sessions('first') });
  client.socket.receive({ type: 'session.row', key: 'first', row: session('renamed', 'first') });
  assert.deepEqual(client.state.rows?.Sessions, [{ id: 'renamed', title: 'renamed' }]);
  client.socket.receive({ type: 'presence', sessions: [] });
  client.socket.receive({ type: 'sessions.pruned', sessionIds: ['first'], archived: 5 });
  assert.deepEqual(client.state.sessions, []);
  assert.equal(client.state.archivedSessions, 5);
  assert.equal(client.socket.sent.some(frame => frame.type === 'session.list'), false);
});


test('adapter capabilities are read once per connection without replacing newer merged session rows', t => {
  const client = scripted(t);
  client.socket.receive({ type: 'welcome', name: 'human', presence: [] });
  assert.equal(client.socket.sent.filter(frame => frame.type === 'session.list').length, 1);
  const adapters: Record<string, Capabilities> = { codex: { terminal: 'none', history: 'reliable', usage: 'heuristic', setModel: 'none', approvalRelay: 'reliable', states: { idle: 'reliable', busy: 'reliable', 'waiting for human': 'none', 'waiting for approval': 'reliable' } } };
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'sessions', value: sessions('current') });
  client.socket.receive({ type: 'result', id: 'shell-sessions', ok: true, value: { processes: [], archived: 99, adapters, coordinator: null } });
  assert.deepEqual(client.state.adapters, adapters);
  assert.deepEqual(client.state.rows?.Sessions, [{ id: 'current', title: 'current' }]);
  assert.equal(client.state.archivedSessions, 3, 'a capability read cannot overwrite newer snapshot facts');
});

test('reconnect and resync replace the areas from fresh hub snapshots and inventories', t => {
  const client = scripted(t);
  const snapshot = (name: string, epoch: string) => {
    client.socket.receive({ type: 'snapshot', epoch, seq: 0, domain: 'sessions', value: { ...sessions(name), verification: null } });
    client.socket.receive({ type: 'snapshot', epoch, seq: 0, domain: 'accounts', value: { registry: '/scratch/accounts.toml', accounts: [account(name)] } });
    client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [artifact(name)] } });
  };
  snapshot('old', 'one');
  for (const [type, name, epoch] of [['disconnect', 'new', 'two'], ['resync', 'resynced', 'two']] as const) {
    if (type === 'resync') client.socket.receive({ type: 'resync', reason: 'snapshot-required' });
    else client.socket.close();
    assert.deepEqual(client.state.sessions?.map(row => row.name), [type === 'resync' ? 'new' : 'old'], 'offline keeps the last display');
    t.mock.timers.tick(type === 'resync' ? 500 : 250);
    snapshot(name, epoch);
    assert.deepEqual(client.state.sessions?.map(row => row.name), [name]);
    assert.deepEqual(client.state.accounts?.accounts.map(row => row.name), [name]);
    assert.deepEqual(client.state.rows?.Sessions, [{ id: name, title: name }]);
    assert.deepEqual(client.state.artifacts?.map(row => row.title), [name]);
    assert.equal(client.state.accounts?.error, undefined);
    assert.equal(client.state.verification?.queue, null);
  }
  assert.equal(client.sockets.length, 3);
});

test('visibility reprojects artifacts by id without dropping the rest or rereading inventories', t => {
  const client = scripted(t);
  const first = artifact('One'), second = { ...artifact('Two'), id: 'A-2' };
  const topic: Topic = { id: 'general', title: 'General', standing: true, status: 'open', item: null, createdAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-22T10:00:00Z', lastMessageAt: null, unread: 0 };
  const otherTopic: Topic = { ...topic, id: 'agents', title: 'Agents' };
  client.socket.receive({ type: 'snapshot', epoch: 'one', seq: 0, domain: 'topics', value: { topics: [topic, otherTopic], marks: { events: null, plans: {}, imported: true } } });
  client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [first, second] } });
  client.socket.sent.length = 0;
  client.socket.receive({ type: 'visibility', rows: { artifacts: [{ ...first, layer: 'watch' }], topics: [{ ...topic, layer: 'watch' }], sessions: [], processes: [], messages: [] } });
  assert.deepEqual(client.state.artifacts, [{ ...first, layer: 'watch' }, second]);
  assert.deepEqual(client.state.topics, [{ ...topic, layer: 'watch' }, otherTopic]);
  assert.equal(client.socket.sent.some(frame => ['session.list', 'account.list', 'artifact.list'].includes(frame.type)), false);
  assert.deepEqual(client.socket.sent, [], 'topic and artifact visibility apply together without list rereads');
});

test('moving an artifact removes its top-level inventory row and never adds an unseen moved child', t => {
  const client = scripted(t);
  const first = artifact('One'), folder = { ...artifact('Folder'), id: 'A-2', folder: true, entry: 'index.md' };
  client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [folder, first] } });
  client.socket.sent.length = 0;
  client.socket.receive({ type: 'artifact', artifact: { ...first, movedTo: { folder: 'A-2', path: 'one.md' }, status: 'moved' } });
  assert.deepEqual(client.state.artifacts, [folder]);
  assert.deepEqual(client.state.rows?.Artifacts, [{ id: 'A-2', title: 'Folder' }]);
  client.socket.receive({ type: 'artifact', artifact: { ...artifact('Unseen child'), id: 'A-3', movedTo: { folder: 'A-2', path: 'unseen.md' }, status: 'moved' } });
  assert.deepEqual(client.state.artifacts, [folder]);
  assert.deepEqual(client.state.rows?.Artifacts, [{ id: 'A-2', title: 'Folder' }]);
  assert.deepEqual(client.socket.sent, [], 'move membership is handled without a list read');
});

test('new artifact deltas preserve the newest-first inventory order from artifact.list', t => {
  const client = scripted(t);
  const first = artifact('Earlier'), latest = { ...artifact('Latest'), id: 'A-2' };
  client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [first] } });
  client.socket.receive({ type: 'artifact', artifact: latest });
  assert.deepEqual(client.state.artifacts, [latest, first]);
  assert.deepEqual(client.state.rows?.Artifacts?.map(row => row.id), ['A-2', 'A-1']);
});

test('artifact inventory pages retain live replacements and discard replies from an old connection', async t => {
  const client = scripted(t);
  client.socket.receive({ type: 'result', id: 'connection-status', ok: true, value: { root: '/scratch' } });
  client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [{ ...artifact('Newest'), id: 'A-3' }], more: true, before: 'A-3' } });
  const load = client.state.loadMoreArtifacts!;
  assert.equal(typeof load, 'function');
  const loading = load();
  const request = client.socket.sent.at(-1)!;
  assert.equal(request.type, 'artifact.list');
  assert.equal(request.type === 'artifact.list' && request.before, 'A-3');
  const changed = { ...artifact('Changed while paging'), id: 'A-2', kept: true };
  client.socket.receive({ type: 'artifact', artifact: changed });
  client.socket.receive({ type: 'result', id: request.id!, ok: true, value: { artifacts: [{ ...artifact('Stale'), id: 'A-2' }], more: true, before: 'A-2' } });
  await loading;
  assert.deepEqual(client.state.artifacts?.map(a => a.title), ['Newest', 'Changed while paging']);
  assert.equal(client.state.artifacts?.find(a => a.id === 'A-2')?.kept, true);
  const old = load();
  const oldSocket = client.socket;
  const oldRequest = oldSocket.sent.at(-1)!;
  oldSocket.close();
  t.mock.timers.tick(250);
  client.socket.receive({ type: 'result', id: 'connection-status', ok: true, value: { root: '/scratch' } });
  client.socket.receive({ type: 'result', id: 'shell-artifacts', ok: true, value: { artifacts: [artifact('Replacement')] } });
  oldSocket.receive({ type: 'result', id: oldRequest.id!, ok: true, value: { artifacts: [artifact('Old reply')] } });
  await old;
  assert.deepEqual(client.state.artifacts?.map(a => a.title), ['Replacement']);
  assert.equal(client.state.artifactsBefore, undefined);
});
