#!/usr/bin/env node
import { prefixOf } from '../../hub/src/tracker/prefixes.ts';
import { kindsFor, Ladder } from '../../hub/src/tracker/kinds.ts';
// A stub hub for the shell's tests: it speaks the UI's frames (hub/README.md, "The UI's frames" and the
// `session.*` frames) as JSON lines on stdin and stdout, the way `cland hub serve --stdio` does, from a
// scripted scenario. The client spawns it through CLAND_COMMAND as `<stub> hub serve --stdio`.
//
//   CLAND_STUB_SCENARIO  a JSON file: topics, messages per topic, processes, adapters, presence, items,
//                        attach commands per session, roles, and how topic.send answers (ok | refuse | hold),
//                        session.launch (adds an idle process, or launchError) and session.stop (marks it
//                        stopped and emits session.state unknown, or stopError)
//   CLAND_STUB_SCENARIO_JSON  the same scenario as JSON text, when no file names it (`cland --headless --qa`)
//   CLAND_STUB_CONTROL   a Unix socket the test drives it through, one JSON line per command:
//                        {"emit": frame}       push an event frame to the client
//                        {"emits": [frames]}   push several event frames in one write (a burst)
//                        {"exit": true}        exit, as a hub that dies does (the client spawns a new one, which
//                                              reads CLAND_STUB_SCENARIO again)
//                        {"set": {...}}        replace parts of the scenario (processes, items, send, …)
//                        {"requests": true}    answer with every request frame received so far
//                        {"release": {"error"?: "…"}}  answer the held topic.send requests
//                        {"waitSnapshot": type, "snapshotCount"?: n}  wait until n answers are captured
//                        {"releaseSnapshots": [types], "snapshotError"?: "…"}  release newest first
//   CLAND_STUB_SNAPSHOT_DELAY_MS  delay the first hub.status and task.list answers per connection
//                               for the readiness sweep; explicit holdSnapshots still wins
//   CLAND_STUB_ROLE_DELAY_MS      likewise delay the initial role.list reply for launcher defaults
import { createServer, type Socket } from 'node:net';
import { readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { countCriteria, parseCriteria, summarizeCriteria, type Criterion } from '../../hub/src/tracker/criteria.ts';
import { VisibilityPreferenceFile } from '../../hub/src/hub/visibility-preferences.ts';
import { Visibility } from '../../hub/src/hub/visibility.ts';
import { defaultConfig, readProjectConfig } from '../../hub/src/init/config.ts';
import { STUB_NOW } from './fixtures/clock.ts';

export type Scenario = {
  events?: import('../../hub/src/protocol.ts').EventRow[];
  verification?: import('../../hub/src/protocol.ts').VerificationQueue;
  crew?: { config: Record<string, unknown>; summary: string };
  topics?: Array<Record<string, unknown>>;
  messages?: Record<string, Array<Record<string, unknown>>>;
  processes?: Array<Record<string, unknown>>;
  adapters?: Record<string, unknown>;
  presence?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  attach?: Record<string, string>;
  send?: 'ok' | 'refuse' | 'hold';
  /** `hub.status`'s `coordinator` (the live holder, or null); absent, the field is left out. */
  coordinator?: string | null;
  /** `role.list`'s roles; absent, the four default roles with their launch defaults. */
  roles?: Array<Record<string, unknown>>;
  tracker?: { levels: string[]; ladder?: string[][]; prefixes?: Record<string, string> };
  /** How `session.launch` answers: absent, it adds an idle running process; a string refuses with it. */
  launchError?: string;
  /** How `session.stop` answers: absent, it marks the process stopped; a string refuses with it. */
  stopError?: string;
  resumeReason?: string;
  resumeNotes?: string[];
  resumeBrief?: string | null;
  /** `task.view` never answers (a disconnect while the client waits for it). */
  holdView?: boolean;
  /** Rank results can be delivered without events to test that UI movement waits for the hub. */
  rankEvents?: 'manual';
  rankError?: string;
  /** Capture these snapshot answers now, but deliver them only after `releaseSnapshots` on the control socket. */
  holdSnapshots?: string[];
  rules?: import('../../hub/src/rules/rulebook.ts').Rule[];
  /** The inbox (#33): `inbox.list` answers it, `topic.answer`, `inbox.decline` and `inbox.read` change it and push an `inbox` event.
   * `needsYou` overrides the stub's row aggregate; null omits the count to model a hub that has not said yet. */
  visibility?: import('../../hub/src/hub/visibility.ts').VisibilityOverrides;
  inbox?: { asks?: Array<Record<string, unknown>>; approvals?: Array<Record<string, unknown>>; waiting?: Array<Record<string, unknown>>; plans?: Array<Record<string, unknown>>; requests?: Array<Record<string, unknown>>; messages?: Array<Record<string, unknown>>; needsYou?: number | null; archiveToday?: number; archive?: Array<Record<string, unknown>> };
};

type Frame = Record<string, unknown> & { type?: string; id?: string };

const scenarioFile = process.env.CLAND_STUB_SCENARIO;
const controlPath = process.env.CLAND_STUB_CONTROL;
// a QA case's scenario comes inline: a read-only run has nowhere to write the file
const scenarioJson = process.env.CLAND_STUB_SCENARIO_JSON;
const scenario: Scenario = scenarioFile ? (JSON.parse(readFileSync(scenarioFile, 'utf8')) as Scenario) : scenarioJson ? (JSON.parse(scenarioJson) as Scenario) : {};
// Generated timestamps and age projection must use the same fixture clock.
const clock = () => new Date(process.env.CLAND_STUB_NOW ?? STUB_NOW);
const now = () => clock().toISOString();
scenario.topics ??= [
  { id: 'general', title: 'General', status: 'open', standing: true, createdAt: now(), updatedAt: now() },
  { id: 'agents', title: 'Agents', status: 'open', standing: true, createdAt: now(), updatedAt: now() },
];

const DEFAULT_ROLES = [
  { role: 'coordinator', label: 'Coordinator', exclusive: true, skills: [], launch: { harness: 'claude-code', model: 'claude-fable-5-1', effort: 'max' }, holders: [] },
  { role: 'implementer', label: 'Implementer', exclusive: false, skills: [], launch: { harness: 'opencode', model: null, effort: null }, holders: [] },
  { role: 'reviewer', label: 'Reviewer', exclusive: false, skills: [], launch: { harness: 'codex', model: 'gpt-6.1-sol', effort: 'high' }, holders: [] },
  { role: 'qa', label: 'QA', exclusive: false, skills: [], launch: { harness: 'codex', model: 'gpt-6-astra', effort: 'high' }, holders: [] },
];
const LABELS: Record<string, string> = { aide: 'Aide', coordinator: 'Coordinator', implementer: 'Implementer', reviewer: 'Reviewer', qa: 'QA' };

/** What `session.launch` adds to the process list: a running idle session, the frame's values as given. */
function launched(f: Frame): Record<string, unknown> {
  const name = String(f.name);
  const role = typeof f.role === 'string' ? f.role : null;
  const harness = typeof f.harness === 'string' ? f.harness : 'claude-code';
  return {
    name,
    harness,
    role,
    label: role ? `${name} [${LABELS[role] ?? role}]` : name,
    model: typeof f.model === 'string' ? f.model : null,
    cwd: typeof f.cwd === 'string' ? f.cwd : '/tmp',
    pid: 2,
    harnessId: `${name}-bg`,
    sessionId: `${name}-id`,
    harnessSessionId: null,
    startedAt: now(),
    status: 'running',
    state: 'idle',
    attach: `printf 'attached ${name}\\n'; sleep 600`,
  };
}

const requests: Frame[] = [];
const held: Frame[] = [];

const preferences = new VisibilityPreferenceFile(join(process.cwd(), '.cland/ui.json'));
const visibility = () => new Visibility({
  preferences,
  overrides: scenario.visibility ?? readProjectConfig(join(process.cwd(), '.cland/config.toml'), process.cwd())?.visibility ?? {},
  role: name => String([...(scenario.presence ?? []), ...(scenario.processes ?? [])].find(s => s.name === name)?.role ?? '') || null,
  process: id => scenario.processes?.find(p => p.sessionId === id),
  items: () => scenario.items ?? [], ladder: new Ladder(scenario.tracker?.ladder ?? scenario.tracker?.levels ?? readProjectConfig(join(process.cwd(), '.cland/config.toml'), process.cwd())?.tracker.levels),
  // Age scenarios can pin the hub clock independently of message timestamps.
  now: clock,
});
// Legacy fixtures carry full criteria beside their bodies. Put native counts on
// summary frames while retaining full criteria for task.view; explicit counts win.
const summary = (item: Record<string, unknown>) => {
  if (item.criteria && !Array.isArray(item.criteria)) return item;
  const criteria = (Array.isArray(item.criteria) ? item.criteria : parseCriteria(String(item.body ?? '')).criteria) as Criterion[];
  const tip = 'stub-current-head';
  const current = criteria.map(c => ({ ...c, marks: (c.marks ?? []).map(m => m.kind === 'verified'
    ? { ...m, commit: m.current === false ? 'stub-old-head' : tip } : m) }));
  return { ...item, criteria: countCriteria(summarizeCriteria(current), tip) };
};
const projected = (frame: unknown) => {
  const f = frame as Frame;
  if (f.type === 'task' && f.item) return visibility().frame({ ...f, item: summary(f.item as Record<string, unknown>) });
  if (f.type === 'result' && f.ok === true && requests.find(r => r.id === f.id)?.type === 'task.list') {
    const value = f.value as { items: Array<Record<string, unknown>> };
    return visibility().frame({ ...f, value: { ...value, items: value.items.map(summary) } });
  }
  return visibility().frame(f);
};
const write = (frame: unknown) => process.stdout.write(`${JSON.stringify(projected(frame))}\n`);
const snapshots: Array<{ type: string; release: (error?: string) => void }> = [];
const snapshotWaiters: Array<{ type: string; count: number; resolve: () => void }> = [];
const initialReplay = new Set(['hub.status', 'task.list', 'role.list']);
const snapshotDelayMs = Number(process.env.CLAND_STUB_SNAPSHOT_DELAY_MS ?? 0);
const roleDelayMs = Number(process.env.CLAND_STUB_ROLE_DELAY_MS ?? 0);
const ok = (id: unknown, value: unknown) => {
  const type = requests.find((f) => f.id === id)?.type;
  const frame = { type: 'result', id, ok: true, value };
  const initial = type && initialReplay.delete(type);
  if (type && scenario.holdSnapshots?.includes(type)) {
    const deferred = Promise.withResolvers<string | undefined>();
    const captured = structuredClone(frame);
    snapshots.push({ type, release: deferred.resolve });
    for (let i = snapshotWaiters.length - 1; i >= 0; i--) {
      const waiter = snapshotWaiters[i];
      if (waiter?.type === type && snapshots.filter((s) => s.type === type).length >= waiter.count) { snapshotWaiters.splice(i, 1); waiter.resolve(); }
    }
    void deferred.promise.then((error) => error ? fail(id, error) : write(captured));
    return;
  }
  const delayMs = type === 'role.list' ? roleDelayMs : snapshotDelayMs;
  if (initial && delayMs > 0) {
    const captured = structuredClone(frame);
    setTimeout(() => write(captured), delayMs);
  } else write(frame);
};
const fail = (id: unknown, error: string) => write({ type: 'result', id, ok: false, error });

function topicMessage(f: Frame): Record<string, unknown> {
  // a reply (`replyTo`, the Agents log's `r`) addresses the sender of the message replied to, as the hub does
  const original = typeof f.replyTo === 'string' ? Object.values(scenario.messages ?? {}).flat().find((m) => m.id === f.replyTo) : undefined;
  const to = original ? [original.from] : ['coordinator'];
  return { id: randomUUID(), from: 'human', fromKind: 'human', via: 'ui', to, text: f.text, ts: now(), topic: f.topic, stage: 'queued', ...(original ? { replyTo: f.replyTo } : {}) };
}

function acceptSend(f: Frame) {
  const message = topicMessage(f);
  const topic = scenario.topics?.find((t) => t.id === f.topic);
  write({ type: 'message', topic: { id: f.topic, title: topic?.title ?? f.topic }, message });
  const ib = scenario.inbox;
  if (ib) {
    for (const [section, kind, reason] of [['requests', 'request', 'replied'], ['messages', 'message', 'answered']] as const) {
      const leaving = (ib[section] ?? []).filter(r => (r.topic as { id?: string })?.id === f.topic || (kind === 'request' && r.id === f.replyTo));
      for (const r of leaving) depart(kind, r, reason);
      ib[section] = (ib[section] ?? []).filter(r => !leaving.includes(r));
    }
    write({ type: 'inbox', inbox: inboxValue() });
  }
  ok(f.id, { message, outcomes: [] });
}

/** The inbox as the hub answers it, with its "needs you" count. */
function inboxValue(archive = false): Record<string, unknown> {
  const ib = scenario.inbox ?? {};
  const asks = ib.asks ?? [];
  const approvals = ib.approvals ?? [];
  const waiting = ib.waiting ?? [];
  const plans = ib.plans ?? [], requests = ib.requests ?? [];
  const messages = ib.messages ?? waiting; // Legacy scenarios model messages through their waiting topic.
  const policy = visibility();
  const count = asks.filter(r => policy.place('inbox', r, 'ask').layer === 'now').length
    + approvals.filter(r => policy.place('inbox', r, 'approval').layer === 'now').length
    + plans.length + requests.length
    + messages.filter(r => (r.layer ?? policy.place('inbox', r, 'waiting').layer) === 'now').length;
  return { asks, approvals, waiting, plans, requests, messages, archiveToday: ib.archiveToday ?? 0,
    ...(archive ? { archive: ib.archive ?? [] } : {}),
    ...(ib.needsYou === null ? {} : { needsYou: ib.needsYou ?? count }) };
}

function depart(kind: string, row: Record<string, unknown>, reason: string) {
  const ib = (scenario.inbox ??= {});
  (ib.archive ??= []).unshift({ kind, id: row.id, subject: row.subject ?? (row.topic as { id?: string })?.id ?? row.id,
    text: String(row.text ?? row.question ?? '').split(/\r?\n/, 1)[0], since: row.since ?? row.ts, ts: now(), reason });
  ib.archiveToday = (ib.archiveToday ?? 0) + 1;
  if (typeof ib.needsYou === 'number') ib.needsYou--;
}

/** The human answers an ask: the answer message (with answerTo, to the asker), the card answered, the row gone. */
function answerAsk(f: Frame) {
  const id = String(f.ask);
  let topicId: string | undefined;
  let ask: Record<string, unknown> | undefined;
  for (const [topic, list] of Object.entries(scenario.messages ?? {})) {
    const found = list.find((m) => m.id === id);
    if (found) {
      topicId = topic;
      ask = found;
    }
  }
  const row = scenario.inbox?.asks?.find((a) => a.id === id);
  topicId ??= (row?.topic as { id?: string } | undefined)?.id;
  const card = (ask?.ask ?? { question: row?.question, options: row?.options ?? [], free: row?.free ?? true, state: 'open' }) as Record<string, unknown>;
  if (!topicId || card.state !== 'open') return fail(f.id, `the ask "${id}" takes no answer`);
  const options = (card.options as string[]) ?? [];
  const option = typeof f.option === 'number' ? f.option : undefined;
  const text = option !== undefined ? options[option - 1] : typeof f.text === 'string' ? f.text.trim() : '';
  if (!text) return fail(f.id, option !== undefined ? `option ${option} is not one of 1-${options.length}` : 'an answer needs an option or a text');
  const from = String(ask?.from ?? row?.from ?? 'coordinator');
  const message = { id: randomUUID(), from: 'human', fromKind: 'human', via: 'hub', to: [from], text, ts: now(), topic: topicId, answerTo: id, stage: 'queued' };
  const answered = { ...card, state: 'answered', answer: message.id, ...(option !== undefined ? { option } : {}) };
  if (ask) ask.ask = answered;
  (scenario.messages ??= {})[topicId] = [...(scenario.messages?.[topicId] ?? []), message];
  if (scenario.inbox?.asks) scenario.inbox.asks = scenario.inbox.asks.filter((a) => a.id !== id);
  const topic = scenario.topics?.find((t) => t.id === topicId);
  write({ type: 'message', topic: { id: topicId, title: topic?.title ?? topicId }, message });
  write({ type: 'ask', topic: topicId, ask: id, card: answered });
  write({ type: 'inbox', inbox: inboxValue() });
  ok(f.id, { message, outcomes: [] });
}

function answer(f: Frame) {
  requests.push(f);
  switch (f.type) {
    case 'hello':
      return write({ type: 'welcome', protocol: 2, client: 'nvim' });
    case 'visibility.set': {
      void preferences.toggle(f.surface as 'topics' | 'sessions' | 'artifacts', String(f.target), f.mode as 'pin' | 'mute').then(value => {
        write({ type: 'visibility' });
        ok(f.id, { visibility: value });
      }, err => fail(f.id, String(err)));
      return;
    }
    case 'subscribe':
      return ok(f.id, { subscribed: true });
    case 'artifact.list':
      if (f.artifact !== undefined) {
        const artifact = (scenario.artifacts ?? []).find(a => a.id === f.artifact);
        return artifact ? ok(f.id, { artifact }) : fail(f.id, 'no such artifact');
      }
      return ok(f.id, { artifacts: (scenario.artifacts ?? []).filter((a) => f.topic === undefined || a.topic === f.topic) });
    case 'topic.list':
      return ok(f.id, { topics: scenario.topics });
    case 'topic.history': {
      const topic = scenario.topics?.find((t) => t.id === f.topic);
      if (!topic) return fail(f.id, `no topic ${String(f.topic)}`);
      const messages = scenario.messages?.[String(f.topic)] ?? [];
      const end = f.before === undefined ? messages.length : messages.findIndex(m => m.id === f.before);
      return ok(f.id, { topic, messages: messages.slice(Math.max(0, end - Number(f.limit ?? 50)), end) });
    }
    case 'topic.send':
      if (scenario.send === 'refuse') return fail(f.id, 'the message is larger than 8192 bytes');
      if (scenario.send === 'hold') return void held.push(f);
      return acceptSend(f);
    case 'topic.create': {
      if (typeof f.title !== 'string' || !f.title.trim()) return fail(f.id, 'a topic needs a title');
      if (f.title.length > 200) return fail(f.id, 'a topic title is at most 200 characters');
      const item = f.item === undefined ? undefined : scenario.items?.find(it => it.id === f.item);
      if (f.item !== undefined && !item) return fail(f.id, `unknown item ${String(f.item)}`);
      if (item && (item.topic || scenario.topics?.some(topic => topic.item === item.id))) return fail(f.id, `${String(item.id)} already has a topic`);
      if (item?.state === 'closed') return fail(f.id, `${String(item.id)} is closed: a closed unit of work gets no new topic`);
      const topic = { id: `topic-${(scenario.topics?.length ?? 0) + 1}`, title: f.title.trim(), status: 'open', standing: false, createdAt: now(), updatedAt: now(), item: item?.id ?? null, unread: 0, lastMessageAt: null };
      scenario.topics?.push(topic);
      if (item) { item.topic = topic.id; write({ type: 'task', item }); }
      write({ type: 'topic', topic });
      return ok(f.id, { topic });
    }
    case 'topic.close':
    case 'topic.resolve':
    case 'topic.read': {
      const topic = scenario.topics?.find((t) => t.id === f.topic);
      if (!topic) return fail(f.id, `no topic "${String(f.topic)}"`);
      if (f.type === 'topic.close') topic.status = 'closed';
      if (f.type === 'topic.resolve') topic.status = 'open';
      if (f.type === 'topic.read') topic.unread = 0;
      write({ type: 'topic', topic });
      return ok(f.id, { topic });
    }
    case 'session.list':
      return ok(f.id, { processes: (scenario.processes ?? []).filter(p => !!p.archived === (f.archived === true)), archived: (scenario.processes ?? []).filter(p => p.archived).length, adapters: scenario.adapters ?? {} });
    case 'session.attach': {
      const command = scenario.attach?.[String(f.session)];
      return command ? ok(f.id, { command }) : fail(f.id, `no session named ${String(f.session)}`);
    }
    case 'session.launch': {
      if (scenario.launchError) return fail(f.id, scenario.launchError);
      const p = launched(f);
      scenario.processes = [...(scenario.processes ?? []).filter((x) => x.name !== p.name), p];
      scenario.attach = { ...scenario.attach, [p.name as string]: p.attach as string };
      return ok(f.id, { process: p });
    }
    case 'session.stop': {
      if (scenario.stopError) return fail(f.id, scenario.stopError);
      const p = scenario.processes?.find((x) => x.name === f.session);
      if (!p) return fail(f.id, `no session "${String(f.session)}" was launched by this hub`);
      Object.assign(p, { status: 'stopped', state: 'unknown', attach: null });
      write({ type: 'session.state', session: p.name, sessionId: p.sessionId, state: 'unknown', source: 'stopped', ts: now() });
      return ok(f.id, { process: p });
    }
    case 'session.archive': {
      const p = scenario.processes?.find(x => x.name === f.session);
      if (!p) return fail(f.id, 'no record to archive');
      if (p.status === 'running') return fail(f.id, 'stop it first');
      Object.assign(p, { archived: true, archivedAt: now() });
      write({ type: 'session.process', process: p, archived: (scenario.processes ?? []).filter(p => p.archived).length });
      return ok(f.id, { process: p });
    }
    case 'session.resume': {
      const p = scenario.processes?.find(x => x.name === f.session);
      if (!p) return fail(f.id, `no session "${String(f.session)}" was launched by this hub`);
      if (scenario.resumeReason && f.fresh !== true) return ok(f.id, { found: false, process: p, reason: scenario.resumeReason, fresh: { brief: scenario.resumeBrief ?? null }, notes: [] });
      Object.assign(p, { status: 'running', state: 'idle', archived: false, archivedAt: null });
      write({ type: 'session.process', process: p, archived: (scenario.processes ?? []).filter(p => p.archived).length });
      return ok(f.id, { found: true, process: p, role: p.role, claim: null, notes: scenario.resumeNotes ?? [] });
    }
    case 'role.list':
      return ok(f.id, { roles: scenario.roles ?? DEFAULT_ROLES, coordinator: scenario.coordinator ?? null });
    case 'hub.status': {
      const config = readProjectConfig(join(process.cwd(), '.cland/config.toml'), process.cwd()) ?? defaultConfig(process.cwd());
      const ladder = new Ladder(scenario.tracker?.ladder ?? scenario.tracker?.levels ?? config.tracker.levels);
      return ok(f.id, { keys: config.keys, tracker: { levels: ladder.flat, ladder: ladder.levels.map(level => [...level]), prefixes: scenario.tracker?.prefixes ?? Object.fromEntries([...kindsFor(ladder), 'category'].map(kind => [kind, prefixOf(kind)])) }, sessions: scenario.presence ?? [], ...(scenario.crew ? { crew: scenario.crew } : {}), ...(scenario.verification ? { verification: scenario.verification } : {}), ...(scenario.coordinator !== undefined ? { coordinator: scenario.coordinator } : {}), ...(scenario.inbox ? { needsYou: inboxValue().needsYou } : {}) });
    }
    case 'events.list': {
      const start = Number(f.before ?? 0);
      const filter = f.filter as import('../../hub/src/protocol.ts').EventsFilter | undefined;
      const all = (scenario.events ?? []).filter(r => {
        if (filter?.kinds?.length && !filter.kinds.includes(r.kind) || filter?.warnings && !r.warning) return false;
        if (filter?.muted?.some(s => s.kind === r.subject.kind && s.id === r.subject.id)) return false;
        const s = filter?.subject;
        if (!s) return true;
        if (s.kind !== 'item') return s.kind === r.subject.kind && s.id === r.subject.id || r[s.kind] === s.id;
        let id = r.item ?? (r.subject.kind === 'item' ? r.subject.id : undefined);
        const seen = new Set<string>();
        while (id && !seen.has(id)) { if (id === s.id) return true; seen.add(id); const parent = scenario.items?.find(i => i.id === id)?.parent; id = typeof parent === 'string' ? parent : undefined; }
        return false;
      });
      const rows = all.slice(start, start + Math.min(200, Number(f.limit ?? 200)));
      return ok(f.id, { rows, before: String(start + rows.length), more: start + rows.length < all.length });
    }
    case 'inbox.list':
      return scenario.inbox ? ok(f.id, inboxValue(f.archive === true)) : fail(f.id, 'the stub hub has no inbox in this scenario');
    case 'inbox.decline':
    case 'inbox.read': {
      const ib = (scenario.inbox ??= {}), section = f.type === 'inbox.decline' ? 'requests' : 'messages';
      const id = f.type === 'inbox.decline' ? f.request : f.message;
      const row = ib[section]?.find(r => r.id === id);
      if (!row) return fail(f.id, `no waiting inbox row "${String(id)}"`);
      depart(section === 'requests' ? 'request' : 'message', row, section === 'requests' ? 'declined' : 'read');
      ib[section] = ib[section]!.filter(r => r !== row);
      write({ type: 'inbox', inbox: inboxValue() });
      return ok(f.id, inboxValue());
    }
    case 'topic.answer':
      return answerAsk(f);
    case 'inbox.dismiss':
    case 'inbox.dismiss_all':
      return fail(f.id, 'Inbox notifications retired: use the events view (events.list) to see what happened.');
    case 'task.list':
      return ok(f.id, { items: scenario.items ?? [] });
    case 'task.rank': {
      if (scenario.rankError) return fail(f.id, scenario.rankError);
      const item = scenario.items?.find(i => i.id === f.item);
      if (!item) return fail(f.id, `no item ${String(f.item)}`);
      const rank = (i: Record<string, unknown>) => typeof i.rank === 'number' ? i.rank : Number(String(i.id).slice(2)) * 10;
      const siblings = (scenario.items ?? []).filter(i => (i.parent ?? '') === (item.parent ?? '')).sort((a,b) => rank(a)-rank(b));
      const other = f.before ?? f.after;
      if (!f.top && !siblings.some(i => i.id === other)) return fail(f.id, 'reference is not a sibling');
      const ordered = siblings.filter(i => i.id !== item.id);
      const at = f.top ? 0 : ordered.findIndex(i => i.id === other) + (f.after ? 1 : 0);
      ordered.splice(at, 0, item);
      const ids = ordered.map(i => i.id);
      if (scenario.rankEvents !== 'manual') {
        for (const [i, sibling] of ordered.entries()) {
          sibling.rank = (i+1)*10;
          write({type:'task',id:sibling.id,item:sibling,siblings:ids});
        }
      }
      return ok(f.id, {item, changed:ids, siblings:ids});
    }
    case 'task.plan': {
      if (f.op !== 'show') return fail(f.id, 'task.plan op must be set or show');
      const item = scenario.items?.find(i => i.id === f.item);
      if (!item) return fail(f.id, `no item ${String(f.item)}`);
      return ok(f.id, { id: item.id, plan: item.plan ?? null, stages: item.stages, approval: item.approval, history: item.planHistory, ...(item.planError ? { planError: item.planError } : {}) });
    }
    case 'rule.list':
      return ok(f.id, { rules: scenario.rules ?? [] });
    case 'task.view': {
      // the whole item: a scenario item may carry `body` and `comments` beside its summary fields
      if (scenario.holdView) return;
      const item = scenario.items?.find((i) => i.id === f.item);
      if (!item) return fail(f.id, `no item ${String(f.item)}`);
      return ok(f.id, { item: { body: '', comments: [], verdicts: [], ...parseCriteria(String(item.body ?? '')), ...item, criteria: Array.isArray(item.criteria) ? item.criteria : parseCriteria(String(item.body ?? '')).criteria, criteriaCounts: summary(item).criteria, path: `.cland/tasks/${String(item.file)}` } });
    }
    default:
      return fail(f.id, `the stub hub does not answer ${String(f.type)}`);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  let nl: number;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (!line.trim()) continue;
    try {
      answer(JSON.parse(line) as Frame);
    } catch (err) {
      process.stderr.write(`stub hub: ${String(err)}\n`);
    }
  }
});

let server: ReturnType<typeof createServer> | null = null;
if (controlPath) {
  rmSync(controlPath, { force: true });
  server = createServer((sock: Socket) => {
    let buf = '';
    sock.setEncoding('utf8');
    sock.on('data', (chunk: string) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const cmd = JSON.parse(line) as Record<string, unknown>;
        if (cmd.emit) write(cmd.emit);
        if (Array.isArray(cmd.emits)) process.stdout.write(cmd.emits.map((f) => `${JSON.stringify(projected(f))}\n`).join(''));
        if (cmd.set) Object.assign(scenario, cmd.set);
        if (Array.isArray(cmd.releaseSnapshots)) {
          for (let i = snapshots.length - 1; i >= 0; i--) {
            const snapshot = snapshots[i];
            if (snapshot && cmd.releaseSnapshots.includes(snapshot.type)) {
              snapshots.splice(i, 1);
              snapshot.release(typeof cmd.snapshotError === 'string' ? cmd.snapshotError : undefined);
            }
          }
        }
        if (cmd.release) {
          const error = (cmd.release as { error?: string }).error;
          for (const f of held.splice(0)) {
            if (error) fail(f.id, error);
            else acceptSend(f);
          }
        }
        const count = typeof cmd.snapshotCount === 'number' ? cmd.snapshotCount : 1;
        if (typeof cmd.waitSnapshot === 'string' && snapshots.filter((s) => s.type === cmd.waitSnapshot).length < count) {
          const deferred = Promise.withResolvers<void>();
          snapshotWaiters.push({ type: cmd.waitSnapshot, count, resolve: deferred.resolve });
          void deferred.promise.then(() => sock.write(`${JSON.stringify({ ok: true })}\n`));
        } else {
          sock.write(`${JSON.stringify({ ok: true, ...(cmd.requests ? { requests } : {}) })}\n`);
        }
        if (cmd.exit) {
          server?.close();
          if (controlPath) rmSync(controlPath, { force: true });
          sock.end(() => process.exit(0));
        }
      }
    });
    sock.on('error', () => {});
  });
  server.listen(controlPath);
}

// the hub stops when its parent closes stdin, like `serve --stdio`
process.stdin.on('end', () => {
  server?.close();
  if (controlPath) rmSync(controlPath, { force: true });
  process.exit(0);
});
