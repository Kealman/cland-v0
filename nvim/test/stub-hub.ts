#!/usr/bin/env node
import { fixtureOwnership } from '../../shared/fixture-ownership.ts';
import { fileURLToPath } from 'node:url';
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
//                        snapshotOrder: "oldest", snapshotLimit: n optionally release only the oldest n
//   CLAND_STUB_SNAPSHOT_DELAY_MS  delay the first hub.status and task.list answers per connection
//                               for the readiness sweep; explicit holdSnapshots still wins
//   CLAND_STUB_ROLE_DELAY_MS      likewise delay the initial role.list reply for launcher defaults
import { createServer, type Socket } from 'node:net';
import { readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { EventRow, VerificationQueue, EventsFilter } from '../../hub/src/protocol.ts';
import type { Rule } from '../../hub/src/rules/rulebook.ts';
import type { VisibilityOverrides } from '../../hub/src/hub/visibility.ts';
import { replayFrame } from './frame-fixtures.ts';
import { controlRequestName } from './stub-control.ts';
import { parse as parseToml } from 'smol-toml';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createScenarioArtifact, changeScenarioArtifact } from './artifact-scenario.ts';
import { STUB_NOW } from './fixtures/clock.ts';

// Read-only QA uses an inline scenario and needs no files. An unavailable
// receipt leaves this stub unowned for orphan sweeping, without blocking frames.
let fixtureOwner: ReturnType<typeof fixtureOwnership> | undefined;
try {
  fixtureOwner = fixtureOwnership([process.cwd(), fileURLToPath(new URL('../../', import.meta.url))]);
} catch (error) {
  if (!['EACCES', 'EPERM', 'EROFS'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
}
process.once('exit', () => { fixtureOwner?.close(); fixtureOwner?.remove(); });

export type Scenario = {
  // T-902: source-shaped account snapshots for the sessions panel.
  accounts?: Array<Record<string, unknown>>;
  events?: EventRow[];
  verification?: VerificationQueue;
  crew?: { config: Record<string, unknown>; summary: string };
  topics?: Array<Record<string, unknown>>;
  messages?: Record<string, Array<Record<string, unknown>>>;
  processes?: Array<Record<string, unknown>>;
  adapters?: Record<string, unknown>;
  presence?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  artifactPageSize?: number;
  historyPageSize?: number;
  attach?: Record<string, string>;
  send?: 'ok' | 'refuse' | 'hold';
  /** `hub.status`'s `coordinator` (the live holder, or null); absent, the field is left out. */
  coordinator?: string | null;
  /** `role.list`'s roles; absent, the four default roles with their launch defaults. */
  roles?: Array<Record<string, unknown>>;
  tracker?: { levels: string[]; ladder?: string[][]; prefixes?: Record<string, string> };
  /** How `session.launch` answers: absent, it adds an idle running process; a string refuses with it. */
  launchError?: string;
  /** Optional models.list catalog, including an empty or non-default-first answer. */
  models?: Array<{ id: string; default: boolean }>;
  /** How `session.stop` answers: absent, it marks the process stopped; a string refuses with it. */
  stopError?: string;
  resumeReason?: string;
  resumeNotes?: string[];
  resumeBrief?: string | null;
  /** `task.view` never answers (a disconnect while the client waits for it). */
  holdView?: boolean;
  /** Opt into the summary/filter contract; older recorded screen scenarios replay their full rows. */
  summaryLists?: boolean;
  /** Rank results can be delivered without events to test that UI movement waits for the hub. */
  rankEvents?: 'manual';
  rankError?: string;
  /** Capture these snapshot answers now, but deliver them only after `releaseSnapshots` on the control socket. */
  holdSnapshots?: string[];
  /** Keep parent pages pending while testing complete counts before child rows load. */
  holdClosedPages?: boolean;
  rules?: Rule[];
  /** The inbox (#33): `inbox.list` answers it, `topic.answer`, `inbox.decline` and `inbox.read` change it and push an `inbox` event.
   * `needsYou` overrides the stub's row aggregate; null omits the count to model a hub that has not said yet. */
  visibility?: VisibilityOverrides;
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

const configPath = join(process.cwd(), '.cland/config.toml');
const source = (() => { try { return readFileSync(configPath, 'utf8'); } catch { return ''; } })();
const config = parseToml(source);
const preferencesPath = join(process.cwd(), '.cland/ui.json');
let preferences: Record<string, Record<string, string>> = (() => { try { return JSON.parse(readFileSync(preferencesPath, 'utf8')).visibility ?? {}; } catch { return {}; } })();
const fixtureConfig = () => replayFrame<{ keys: unknown; tracker: { ladder: string[][] } }>('config', { source, tracker: scenario.tracker });
const criteria = (item: Record<string, unknown>) => replayFrame<Record<string, unknown>>('criteria', { body: String(item.body ?? ''), criteria: item.criteria });
const context = () => ({ preferences, visibility: scenario.visibility ?? config.visibility ?? {}, presence: scenario.presence ?? [], processes: scenario.processes ?? [], items: scenario.items ?? [], tracker: { ladder: fixtureConfig().tracker.ladder }, at: now() });
const projected = (frame: unknown) => {
  const f = frame as Frame;
  const requestType = requests.find(r => r.id === f.id)?.type;
  const bound = f.type === 'result' ? { ...f, id: '@request@' } : f;
  const output = replayFrame<Frame>('frame', { frame: bound, requestType, ...context() });
  return f.type === 'result' ? { ...output, id: f.id } : output;
};
const rawWrite = (frame: unknown) => process.stdout.write(`${JSON.stringify(frame)}\n`);
const write = (frame: unknown) => rawWrite(projected(frame));
const snapshots: Array<{ type: string; release: (error?: string) => void }> = [];
const snapshotWaiters: Array<{ type: string; count: number; resolve: () => void }> = [];
const initialReplay = new Set(['hub.status', 'task.list', 'role.list']);
const snapshotDelayMs = Number(process.env.CLAND_STUB_SNAPSHOT_DELAY_MS ?? 0);
const roleDelayMs = Number(process.env.CLAND_STUB_ROLE_DELAY_MS ?? 0);
const ok = (id: unknown, value: unknown) => {
  const request = requests.find((f) => f.id === id);
  const type = request?.type;
  const frame = { type: 'result', id, ok: true, value };
  const initial = type && initialReplay.delete(type);
  if (type && (scenario.holdSnapshots?.includes(type) || scenario.holdClosedPages && type === 'task.list' && request?.parent !== undefined)) {
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

// T-902: alternate kind prefixes resolve by tracker identity, not by spelling.
function canonicalItem(reference: unknown) {
  const id = String(reference);
  return scenario.items?.find(item => item.id === id)
    ?? (/^[A-Z]-\d+$/.test(id) ? scenario.items?.find(item => String(item.id).split('-')[1] === id.split('-')[1]) : undefined);
}

// Recorded history rows carry the same explicit facts used by hub filtering.
// Do not search arbitrary metadata: a hygiene rule named loop is not a session.
function filteredHistory(f: Frame) {
  return (scenario.messages?.[String(f.topic)] ?? []).filter(m => {
    const detail = m.detail as Record<string, unknown> | undefined;
    const item = f.item === undefined || detail?.item === canonicalItem(f.item)?.id;
    const session = f.session === undefined || m.from === f.session
      || (m.to as unknown[] | undefined)?.includes(f.session)
      || detail?.session === f.session;
    return item && session;
  });
}

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
  const count = replayFrame<number>('inbox-count', { asks, approvals, plans, requests, messages, ...context() });
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
      try {
        const surface = String(f.surface), target = String(f.target), mode = String(f.mode);
        const next = structuredClone(preferences), choices = next[surface] ??= {};
        if (choices[target] === mode) delete choices[target]; else choices[target] = mode;
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(readFileSync(preferencesPath, 'utf8')); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        mkdirSync(join(process.cwd(), '.cland'), { recursive: true });
        writeFileSync(preferencesPath, JSON.stringify({ ...data, visibility: next }));
        preferences = next;
        write({ type: 'visibility' });
        return ok(f.id, { visibility: preferences });
      } catch (error) { return fail(f.id, String(error)); }
    }
    case 'subscribe':
      return ok(f.id, { subscribed: true });
    // T-903 artifact/prompt screen requests. Hub rules are asserted separately in-process.
    case 'artifact.create': {
      const { artifact, events } = createScenarioArtifact(scenario, process.cwd(), f);
      for (const event of events) write(event);
      return ok(f.id, { artifact });
    }
    case 'artifact.keep':
    case 'artifact.promote':
    case 'artifact.move':
    case 'prompt.send': {
      const { artifact, events } = changeScenarioArtifact(scenario, process.cwd(), f);
      for (const event of events) write(event);
      return ok(f.id, { artifact });
    }
    case 'artifact.list':
      if (f.artifact !== undefined) {
        const artifact = (scenario.artifacts ?? []).find(a => a.id === f.artifact);
        return artifact ? ok(f.id, { artifact, ...(artifact.folder ? { files: artifact.files ?? [] } : {}) }) : fail(f.id, 'no such artifact');
      }
      {
        const all = (scenario.artifacts ?? []).filter(a => !a.movedTo && (f.topic === undefined || a.topic === f.topic));
        if (!scenario.artifactPageSize) return ok(f.id, { artifacts: all });
        const ordered = [...all].sort((a,b) => Number(String(b.id).slice(2)) - Number(String(a.id).slice(2)));
        const start = f.before === undefined ? 0 : ordered.findIndex(a => a.id === f.before) + 1;
        const artifacts = ordered.slice(start, start + scenario.artifactPageSize);
        return ok(f.id, { artifacts, ...(start + artifacts.length < ordered.length ? { more: true, before: artifacts.at(-1)!.id } : {}) });
      }
    case 'topic.list':
      return ok(f.id, { topics: scenario.topics });
    case 'topic.history': {
      const topic = scenario.topics?.find((t) => t.id === f.topic);
      if (!topic) return fail(f.id, `no topic ${String(f.topic)}`);
      const messages = filteredHistory(f);
      const end = f.before === undefined ? messages.length : messages.findIndex(m => m.id === f.before);
      const page = messages.slice(Math.max(0, end - Number(scenario.historyPageSize ?? f.limit ?? 50)), end);
      return ok(f.id, { topic, messages: page, ...(scenario.historyPageSize && end > page.length ? { more: true, before: page[0]!.id } : {}) });
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
    case 'models.list':
      return ok(f.id, { harness: f.harness, account: f.account ?? null, models: scenario.models ?? [{ id: `${f.harness}-listed-default`, default: true }, { id: `${f.harness}-listed-other`, default: false }], source: 'stub catalog', probedAt: now(), cached: false });
    case 'role.list':
      return ok(f.id, { roles: scenario.roles ?? DEFAULT_ROLES, coordinator: scenario.coordinator ?? null });
    case 'hub.status': {
      const recorded = fixtureConfig();
      return ok(f.id, { ...recorded, sessions: scenario.presence ?? [], ...(scenario.crew ? { crew: scenario.crew } : {}), ...(scenario.verification ? { verification: scenario.verification } : {}), ...(scenario.coordinator !== undefined ? { coordinator: scenario.coordinator } : {}), ...(scenario.inbox ? { needsYou: inboxValue().needsYou } : {}) });
    }
    case 'events.list': {
      const start = Number(f.before ?? 0);
      const filter = f.filter as EventsFilter | undefined;
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
    // T-902: accounts use the ordinary snapshot/event projection seam.
    case 'account.list':
      return scenario.accounts ? ok(f.id, { accounts: scenario.accounts }) : fail(f.id, 'the stub hub does not answer account.list');
    case 'task.list': {
      let items = scenario.items ?? [];
      if (scenario.summaryLists) {
        if (f.include_containers && f.state === 'open') {
          const byId = new Map(items.map(item=>[item.id,item]));
          const retained = new Set<unknown>();
          for (const item of items) if (item.state === 'open') {
            let ancestor: Record<string,unknown> | undefined = item;
            while (ancestor && !retained.has(ancestor.id)) {
              retained.add(ancestor.id);
              ancestor = typeof ancestor.parent === 'string' ? byId.get(ancestor.parent) : undefined;
            }
          }
          items = items.filter(item=>retained.has(item.id));
        } else items = items.filter(i => !f.state || i.state === f.state);
        if (f.projection === 'summary') {
          const fields = new Set(['id','kind','title','state','status','size','labels','parent','blocked_by','open_blockers','claim','holds','criteria','updated','closed','version','rank','rank_set','verdicts','child_counts','stages']);
          items = items.map(i => {
            const row = Object.fromEntries(Object.entries(i).filter(([key]) => fields.has(key)));
            const latest = new Map<string, Record<string, unknown>>(), rounds = new Map<string, number>();
            for (const v of Array.isArray(i.verdicts) ? i.verdicts as Array<Record<string, unknown>> : []) {
              const kind = String(v.verdict), round = (rounds.get(kind) ?? 0) + 1;
              rounds.set(kind,round); latest.delete(kind); latest.set(kind,{...v,round});
            }
            row.verdicts = [...latest.values()];
            row.criteria = criteria(i).criteriaCounts;
            return row;
          });
        }
      }
      if (typeof f.parent === 'string') {
        items = items.filter(i => i.state === 'closed' && (i.parent ?? '') === f.parent)
          .sort((a,b)=>Number(String(a.id).slice(2))-Number(String(b.id).slice(2)));
        const total=items.length;
        items=items.filter(i=>!f.cursor || Number(String(i.id).slice(2))>Number(String(f.cursor).slice(2)));
        const rows=items.slice(0,Number(f.limit??100));
        return ok(f.id,{items:rows,next:rows.length<items.length?rows.at(-1)!.id:null,total});
      }
      return ok(f.id, { items });
    }
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
      const item = canonicalItem(f.item);
      if (!item) return fail(f.id, `no item ${String(f.item)}`);
      return ok(f.id, { item: { body: '', comments: [], verdicts: [], ...item, ...criteria(item), path: `.cland/tasks/${String(item.file)}` } });
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
    let request: Frame | undefined;
    try {
      request = JSON.parse(line) as Frame;
      answer(request);
    } catch (err) {
      const error = `stub hub request ${String(request?.type ?? 'invalid frame')}: ${String(err)}`;
      process.stderr.write(`${error}\n`);
      // Error replies bypass projection: an unmatched recording cannot require
      // another recording to report its own failure.
      rawWrite(request?.id !== undefined ? { type: 'result', id: request.id, ok: false, error } : { type: 'error', message: error });
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
        let command: Record<string, unknown> | undefined;
        try {
          const cmd = JSON.parse(line) as Record<string, unknown>;
          command = cmd;
          if (cmd.emit) write(cmd.emit);
          if (Array.isArray(cmd.emits)) process.stdout.write(cmd.emits.map(frame => `${JSON.stringify(projected(frame))}\n`).join(''));
          if (cmd.set) Object.assign(scenario, cmd.set);
          if (Array.isArray(cmd.releaseSnapshots)) {
            const selected = snapshots.filter(snapshot => cmd.releaseSnapshots instanceof Array && cmd.releaseSnapshots.includes(snapshot.type));
            if (cmd.snapshotOrder !== 'oldest') selected.reverse();
            const limit = typeof cmd.snapshotLimit === 'number' ? cmd.snapshotLimit : selected.length;
            for (const snapshot of selected.slice(0, limit)) {
              snapshots.splice(snapshots.indexOf(snapshot), 1);
              snapshot.release(typeof cmd.snapshotError === 'string' ? cmd.snapshotError : undefined);
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
        } catch (error) {
          const operation = controlRequestName(command ?? {});
          process.stderr.write(`stub control ${operation}: ${String(error)}\n`);
          sock.end(`${JSON.stringify({ ok: false, error: String(error), operation })}\n`);
          return;
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
