import type { ApprovalRequest } from '../adapters/contract.ts';
import { approvalSubject } from './approval-subject.ts';
import { realClock, type Clock, type ClockTimer } from './clock.ts';
import type { Finding, FindingCounts } from '../tracker/findings.ts';
// The inbox (§3.7): asks/command approvals, pending plans, requests and messages.
// Each row records when its wait began; departures persist in hub.db and reach the journal
// through the log tap. Publications are coalesced over 250 ms; explicit reads always settle current waits.
import { messageVerdict, OLD_MESSAGE_MS, type Visibility } from './visibility.ts';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import type { ApprovalChoice, ApprovalOutcome, HumanActionVia, HarnessProcessView, HubEvent, Inbox, InboxApproval, InboxAsk, InboxRequest, InboxMessage, InboxPlan, InboxDeparture, NotificationKind, Presence, SessionState, Topic } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Resumed } from './budget.ts';
import { HygieneError } from './hygiene.ts';
import { ROLE_LABELS, withRole } from '../names.ts';
import type { ItemSummary } from '../tracker/tracker.ts';
import type { InboxWait, Store } from './store.ts';
import { PairingCodes } from '../remote/pairing.ts';

/** A session idle longer than this is worth a background event, unless the project's config says otherwise. */
export const IDLE_NOTIFY_MS = 30 * 60 * 1000;

/**
 * The idle threshold for a project: `CLAND_IDLE_NOTIFY_MS` (tests), else `[inbox] idle_minutes` in
 * `.cland/config.toml`, else 30 minutes. A file that is missing or does not parse leaves the default (logged).
 */
export function idleNotifyMs(configFile: string, env: NodeJS.ProcessEnv = process.env, log: LogFn = () => {}): number {
  const fromEnv = Number(env.CLAND_IDLE_NOTIFY_MS);
  if (env.CLAND_IDLE_NOTIFY_MS !== undefined && Number.isFinite(fromEnv)) return fromEnv;
  let text: string;
  try {
    text = readFileSync(configFile, 'utf8');
  } catch {
    return IDLE_NOTIFY_MS;
  }
  try {
    const minutes = (parse(text) as { inbox?: { idle_minutes?: unknown } }).inbox?.idle_minutes;
    if (minutes === undefined) return IDLE_NOTIFY_MS;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) throw new Error('[inbox] idle_minutes must be a number');
    return minutes * 60_000;
  } catch (err) {
    log({ event: 'config-unreadable', file: configFile, error: err instanceof Error ? err.message : String(err) });
    return IDLE_NOTIFY_MS;
  }
}

/** Role changes that are a session's death: the death's own notification says it. */
const DEATH_REASONS = new Set(['its harness exited', 'its session was stopped']);

export type InboxPort = {
  clock?: Clock;
  store: Store;
  visibility: Visibility;
  now: () => Date;
  log: LogFn;
  emit: (event: HubEvent) => void;
  topics: () => Topic[];
  items: () => ItemSummary[];
  presence: () => Presence[];
  /** A session's state by its session id. */
  stateOf: (sessionId: string) => SessionState;
  /** How long an idle session waits before it is an event, ms; 0 or less: never. */
  idleNotifyMs: number;
  /** Long idle also reaches subscribed sessions, independently of its human inbox layer. */
  idle: (session: string, minutes: number) => void;
  approvalNote: (record: InboxApproval, note: string) => void;
  sizeRefusal: (text: string) => string | null;
};

export class InboxBoard {
  readonly pairingCodes: PairingCodes;
  readonly #port: InboxPort;
  readonly #clock: Clock;
  /** Departures accumulated by reads or the coalesced rebuild, published once with the next inbox delta. */
  #departures: InboxDeparture[] = [];
  /** The launched sessions (the adapters' process table): the approvals and their attach commands. */
  #processes: (() => HarnessProcessView[]) | null = null;
  /** When each session entered `waiting for approval`, by session id. */
  readonly #since = new Map<string, string>();
  readonly #fallbacks = new Map<string, InboxApproval>();
  readonly #approvals = new Map<string, InboxApproval>();
  readonly #reported = new Set<string>();
  readonly #restored = new Set<string>();
  #syncingApprovals = false;
  /** One timer per idle session, by session id. */
  readonly #idle = new Map<string, ClockTimer>();
  readonly #deaths = new Set<string>();
  #scheduled: ClockTimer | null = null;
  #published: string | null = null;
  #count: { value: number; until: number } | null = null;
  readonly #approvalProcesses = new Set<string>();
  #closed = false;

  constructor(port: InboxPort) {
    this.#port = port;
    this.#clock = port.clock ?? realClock;
    this.pairingCodes = new PairingCodes(port.store.remotes, this.#clock, () => this.refresh());
    for (const { record: saved, fallback } of port.store.pendingApprovals()) {
      // A previous delivery attempt is not a native answer receipt.
      const { outcome: _attempt, ...facts } = saved;
      const record: InboxApproval = { ...facts, state: 'pending' };
      this.#approvals.set(record.id, record);
      this.#since.set(record.sessionId, record.since);
      if (fallback) this.#fallbacks.set(record.sessionId, record);
      else { this.#reported.add(record.sessionId); this.#restored.add(record.id); }
    }
  }

  /** Who lists the launched sessions (the adapters' side); null when the hub has none. */
  useProcesses(list: (() => HarnessProcessView[]) | null): void {
    this.#processes = list;
    this.#changed();
  }

  /** Something the inbox lists changed outside the events it observes (a topic deleted, a prune): publish again. */
  refresh(): void {
    this.#changed();
  }

  close(): void {
    this.#closed = true;
    this.pairingCodes.close();
    if (this.#scheduled) this.#clock.clearTimeout(this.#scheduled);
    this.#scheduled = null;
    for (const t of this.#idle.values()) this.#clock.clearTimeout(t);
    this.#idle.clear();
  }

  // ---------------------------------------------------------------- what feeds it

  /** Every hub event passes here: what may change a section schedules a new `inbox` event; informational changes also reach the events journal. */
  observe(event: HubEvent): void {
    if (this.#closed) return;
    let invalidateCount = true;
    switch (event.type) {
      case 'session.state':
        this.#sessionState(event);
        break;
      case 'session.process': {
        const proc = event.process;
        // Non-approval process metadata cannot add or remove an inbox row.
        // Still publish labels/details through the normal coalesced window.
        invalidateCount = this.#approvalProcesses.has(proc.sessionId) || proc.status === 'running' && proc.state === 'waiting for approval';
        const key = `${proc.sessionId}:${proc.startedAt}`;
        if (proc.status === 'exited' && !this.#deaths.has(key)) {
          this.#deaths.add(key);
          this.#notify('death', `${proc.name} died`, { session: proc.name });
        }
        break;
      }
      case 'session.role':
        // a death has its own notification; a handover is one notification, from its Agents notice (below)
        if (!DEATH_REASONS.has(event.reason) && event.reason !== 'handover') this.#roleChange(event);
        break;
      case 'message':
        if (event.message.fromKind === 'hub' && event.message.kind === 'plan') {
          this.#notify('plan', event.message.text, typeof event.message.detail?.item === 'string' ? { item: event.message.detail.item } : {});
        }
        if (event.message.fromKind === 'hub') {
          if (event.message.detail?.event === 'verification-executor-fallback') this.#notify('executor-fallback', event.message.text, typeof event.message.detail.item === 'string' ? { item: event.message.detail.item } : {});
          const result = messageVerdict(event.message);
          if (result) {
            const detail = event.message.detail!;
            this.#notify('verdict', event.message.text.split('\n')[0] ?? '', { ...(typeof detail.item === 'string' ? { item: detail.item } : {}), ...(typeof detail.session === 'string' ? { session: detail.session } : {}), result, ...(detail.findings !== undefined ? { findings: detail.findings as Finding[], findingCounts: detail.findingCounts as FindingCounts } : {}) });
          }
        }
        if (event.message.fromKind === 'hub' && event.message.kind === 'inject-stalled' && (event.message.topic === 'general' || event.message.topic === 'agents' && event.message.to.length === 0)) {
          this.#notify('delivery-stalled', event.message.text, typeof event.message.detail?.session === 'string' ? { session: event.message.detail.session } : {});
        }
        if (event.message.topic === 'agents' && event.message.fromKind === 'hub' && event.message.kind === 'turn-failed') {
          this.#notify('turn-failed', event.message.text, typeof event.message.detail?.session === 'string' ? { session: event.message.detail.session } : {});
        }
        if (event.message.topic === 'agents' && event.message.fromKind === 'hub' && event.message.kind === 'account-limited') {
          this.#notify('account-limited', event.message.text, typeof event.message.detail?.session === 'string' ? { session: event.message.detail.session } : {});
        }
        // a handover (#31) moves a role between two sessions: its `handover` notice in Agents (#34) says who handed
        // what to whom, once, where its two `session.role` events would make two rows
        if (event.message.topic === 'agents' && event.message.fromKind === 'hub' && event.message.kind === 'handover') {
          this.#notify('role', (event.message.text.split('\n')[0] ?? '').replace(/:$/, ''), event.message.detail && typeof event.message.detail.to === 'string' ? { session: event.message.detail.to } : {});
        }
        break;
      case 'delivery':
      case 'inbox':
      case 'event': // Journal projections do not change any inbox section.
        return;
      default:
        break;
    }
    // The sections are recomputed once per publication window by #changed; a synchronous list() here ran the full
    // inbox query on every hub event, which stalled startup for minutes on a project with 200 remembered processes
    const approvalFacts = event.type === 'session.state' && (event.state === 'waiting for approval' || this.#fallbacks.has(event.sessionId))
      || event.type === 'session.process' && (event.process.state === 'waiting for approval' || this.#approvals.size > 0)
      || event.type === 'presence' && (this.#approvals.size > 0 || event.sessions.some(s => s.state === 'waiting for approval'));
    if (approvalFacts) this.#syncApprovals();
    this.#changed(invalidateCount);
  }

  /** An inject whose outcome is unknown: the human decides whether to send it again. */
  uncertain(session: string, label: string, messageId: string, why: string): void {
    this.#notify('delivery-uncertain', `${label}: a message may or may not have reached its harness (${why}); it is not sent again on its own: \`cland session retry ${session} ${messageId}\` sends it again`, { session });
  }

  #sessionState(e: Extract<HubEvent, { type: 'session.state' }>): void {
    if (e.state === 'waiting for approval') {
      if (!this.#since.has(e.sessionId)) this.#since.set(e.sessionId, e.ts);
    } else this.#since.delete(e.sessionId);
    const timer = this.#idle.get(e.sessionId);
    if (timer) {
      this.#clock.clearTimeout(timer);
      this.#idle.delete(e.sessionId);
    }
    if (e.state === 'idle' && this.#port.idleNotifyMs > 0) {
      const t = this.#clock.setTimeout(() => this.#idleFor(e.session, e.sessionId), this.#port.idleNotifyMs);
      t.unref();
      this.#idle.set(e.sessionId, t);
    }
  }

  #idleFor(session: string, sessionId: string): void {
    this.#idle.delete(sessionId);
    if (this.#closed) return;
    try {
      if (this.#port.stateOf(sessionId) !== 'idle') return;
      const minutes = Math.max(1, Math.round(this.#port.idleNotifyMs / 60_000));
      const name = this.#port.store.nameOfSession(sessionId) ?? session;
      this.#port.idle(name, minutes);
      this.#notify('idle', `${name} idle ${minutes} min`, { session: name });
    } catch (err) {
      this.#port.log({ event: 'inbox-failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  #roleChange(e: Extract<HubEvent, { type: 'session.role' }>): void {
    const label = (r: string) => ROLE_LABELS[r] ?? r;
    const how = e.reason === 'launch' ? 'launched for it' : e.reason;
    const text =
      e.role !== null
        ? `${e.session} is ${label(e.role)}${e.previous && e.previous !== e.role ? ` (was ${label(e.previous)})` : ''}: ${how}`
        : `${e.session} is no longer ${e.previous ? label(e.previous) : 'in a role'}: ${how}`;
    this.#notify('role', text, { session: e.session });
  }

  #notify(kind: NotificationKind, text: string, extra: { item?: string; session?: string; result?: string; findings?: Finding[]; findingCounts?: FindingCounts } = {}): void {
    const id = `n-${randomUUID().slice(0, 8)}`;
    this.#port.log({ event: 'notification', id, kind, text, ...extra });
  }

  // ---------------------------------------------------------------- what it shows

  list(archive = false): Inbox {
    const p = this.#port;
    const open = p.store.openAsks().filter(a => a.to === undefined);
    const topics = p.topics();
    const byId = new Map(topics.map((t) => [t.id, t]));
    const asks: InboxAsk[] = open.slice().reverse().map((a) => {
      const t = byId.get(a.topic);
      const fromRole = p.store.roleOf(a.from);
      return p.visibility.place('inbox', {
        id: a.id,
        topic: { id: a.topic, title: t?.title ?? a.topic, ...(t?.item ? { item: t.item } : {}) },
        question: a.question,
        options: a.options,
        free: a.free,
        from: a.from,
        ...(fromRole ? { fromRole } : {}),
        label: withRole(a.from, fromRole),
        ts: a.ts,
        since: a.ts,
      }, 'ask');
    });
    asks.sort((a, b) => b.ts.localeCompare(a.ts));
    const asked = new Set(open.map((a) => a.topic));
    const waiting = topics.filter((t) => t.status === 'waiting for human' && !asked.has(t.id)).sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0))
      .map(t => p.visibility.place('inbox', t, 'waiting'));
    this.#syncApprovals();
    const placedApprovals = [...this.#approvals.values()].map(a => p.visibility.place('inbox', a, 'approval'));
    const candidates = p.store.inboxMessages();
    const requests: InboxRequest[] = [];
    const messages: InboxMessage[] = [];
    for (const candidate of candidates) {
      const m = candidate.message;
      const t = byId.get(m.topic)!;
      const topic = { id: t.id, title: t.title, ...(t.item ? { item: t.item } : {}) };
      if (m.kind === 'request') {
        if (candidate.replied && !p.store.leftInbox('request', m.id)) {
          this.#depart({ kind: 'request', id: m.id, subject: m.subject!, since: m.ts }, 'replied', p.store.inboxReplyAt(m.id, m.topic));
        }
        if (candidate.replied || p.store.leftInbox('request', m.id)) continue;
        requests.push({ id: m.id, from: m.from, ...(m.fromRole ? { fromRole: m.fromRole } : {}),
          request: m.request!, subject: m.subject!, topic, ts: m.ts, since: m.ts, text: m.text, layer: 'now' });
        continue;
      }
      if (candidate.read || candidate.replied || p.store.leftInbox('message', m.id)) continue;
      const latestWaiting = candidate.latest && t.status === 'waiting for human' && !asked.has(t.id);
      const placed = p.visibility.place('messages', m);
      const layer = latestWaiting ? p.visibility.place('inbox', t, 'waiting').layer : placed.layer;
      if (!(candidate.toHuman || latestWaiting) || layer !== 'now') continue;
      messages.push({ id: m.id, from: m.from, ...(m.fromRole ? { fromRole: m.fromRole } : {}),
        subject: t.item ?? t.id, topic, ts: m.ts, since: m.ts, text: m.text, layer, ...(placed.severity ? { severity: placed.severity } : {}) });
    }
    const items = p.items();
    const plans: InboxPlan[] = items.filter(i => i.state === 'open' && i.plan && !i.planError && i.approval?.required && i.approval.state === 'pending')
      .map(i => ({ id: i.id, subject: i.id, title: i.title, stages: i.plan!.stages.length,
        lanes: i.plan!.stages.reduce((n, s) => n + s.lanes.length, 0),
        items: i.plan!.stages.reduce((n, s) => n + s.lanes.reduce((m, lane) => m + lane.length, 0), 0),
        since: i.updated, layer: 'now' as const }));
    const rows: InboxWait[] = [
      ...asks.filter(a => a.layer === 'now').map(a => ({ kind: 'ask' as const, id: a.id, subject: a.topic.item ?? a.topic.id, since: a.ts, text: a.question })),
      ...placedApprovals.filter(a => a.layer === 'now').map(a => ({ kind: 'approval' as const, id: a.id, subject: a.session, since: a.since, text: a.command ?? 'waiting for approval' })),
      ...plans.map(a => ({ kind: 'plan' as const, id: a.id, subject: a.subject, since: a.since, text: a.title })),
      ...requests.map(a => ({ kind: 'request' as const, id: a.id, subject: a.subject, since: a.since, text: a.text })),
      ...messages.map(a => ({ kind: 'message' as const, id: a.id, subject: a.subject, since: a.since, text: a.text })),
    ];
    // Capture the start of every wait before coalescing publication, and settle only a documented leave rule.
    for (const row of p.store.inboxWaits()) {
      let reason: InboxDeparture['reason'] | undefined;
      if (row.kind === 'ask') {
        const ask = p.store.ask(row.id);
        if (ask && ask.state !== 'open') reason = ask.outcome?.status === 'declined' ? 'declined' : ask.state;
      } else if (row.kind === 'approval') {
        // Approval closes settle their own exact record, independently of session state.
      } else if (row.kind === 'plan') {
        const item = items.find(i => i.id === row.id);
        if (item?.state === 'closed') reason = 'closed';
        else if (!item?.plan || item.planError || !item.approval?.required) reason = 'invalidated';
        else if (item.approval.state === 'approved') reason = 'approved';
      } else {
        const candidate = candidates.find(c => c.message.id === row.id);
        if (candidate?.replied) reason = row.kind === 'request' ? 'replied' : 'answered';
        else if (row.kind === 'message' && candidate?.read) reason = 'read';
      }
      if (reason) this.#depart(row, reason);
    }
    for (const row of rows) {
      const since = p.store.waitInInbox(row);
      const section = row.kind === 'plan' ? plans : row.kind === 'request' ? requests : row.kind === 'message' ? messages : row.kind === 'approval' ? placedApprovals : null;
      const result = section?.find(a => a.id === row.id);
      if (result) result.since = since;
    }
    plans.sort((a, b) => b.since.localeCompare(a.since));
    placedApprovals.sort((a, b) => b.since.localeCompare(a.since));
    const pairings = this.pairingCodes.waiting();
    const needsYou = rows.length + pairings.length;
    const now = p.now(), today = new Date(now);
    // Status polls share the current projection. Time alone can move a message
    // to the old-message layer, so expire at that exact boundary as well.
    let until = Math.min(Infinity, ...pairings.map(row => Date.parse(row.expires)));
    for (const candidate of candidates) {
      const expires = Date.parse(candidate.message.ts) + OLD_MESSAGE_MS + 1;
      if (expires > now.getTime()) until = Math.min(until, expires);
    }
    this.#count = { value: needsYou, until };
    today.setHours(0, 0, 0, 0);
    return { asks, approvals: placedApprovals, plans, requests, messages, waiting, needsYou, pairings,
      archiveToday: p.store.inboxDeparturesToday(today.toISOString()),
      ...(archive ? { archive: p.store.inboxDepartures(new Date(now.getTime() - 7 * 86400_000).toISOString()) } : {}) };
  }

  /** Admit one native request or closed-first outcome; return a receipt for idempotent watch replay. */
  requestApproval(sessionId: string, request: ApprovalRequest, correctOutcome = false): boolean {
    const proc = this.#processes?.().find(p => p.sessionId === sessionId);
    if (!proc || (proc.status !== 'running' && !request.outcome)) return false;
    const id = `${sessionId}:${request.id}`;
    const previous = this.#approvals.get(id);
    if (previous && request.outcome) {
      this.closeApproval(sessionId, request.id, request.outcome);
      return true;
    }
    if (this.#port.store.leftInbox('approval', id)) {
      if (!correctOutcome || !request.outcome || this.#port.store.inboxOutcome('approval', id)?.by !== 'human') return true;
    }
    const subject = approvalSubject(request.subject);
    const tui = proc.harness === 'claude-code' || request.answerIn === 'tui';
    const record: InboxApproval = { id, sessionId, session: proc.name, ...(proc.role ? { role: proc.role } : {}),
      label: proc.label ?? withRole(proc.name, proc.role), harness: proc.harness, kind: request.kind, subject,
      ...(subject.command !== undefined ? { command: subject.command } : {}),
      choices: tui ? [] : [...new Set(request.choices.filter(c => c === 'once' || c === 'always' || c === 'deny'))],
      answerIn: tui ? 'tui' : 'hub', attach: proc.attach, since: previous?.since ?? request.since ?? this.#port.now().toISOString(),
      ...(request.topic !== undefined ? { topic: request.topic } : previous?.topic !== undefined ? { topic: previous.topic } : {}),
      state: previous?.state ?? 'pending', ...(previous?.outcome ? { outcome: previous.outcome } : {}) };
    if (correctOutcome && request.outcome && this.#port.store.leftInbox('approval', id)) {
      this.#port.store.correctApprovalOutcome(id, request.outcome);
      this.#port.emit({ type: 'approval', approval: this.#port.visibility.place('inbox', { ...record, state: 'closed', outcome: request.outcome }, 'approval') });
      this.#changed();
      return true;
    }
    this.#reported.add(sessionId);
    const fallback = this.#fallbacks.get(sessionId);
    if (fallback) this.#closeApproval(fallback, { choice: 'withdrawn', by: 'harness', via: 'harness', at: this.#port.now().toISOString() });
    this.#approvals.set(id, record);
    // An adapter can finish subject enrichment after another native client already answered.
    if (request.outcome) { this.#closeApproval(record, request.outcome); return true; }
    if (this.#restored.delete(id)) {
      // This receipt follows current native subject validation, never disk restoration alone.
      this.#port.log({ event: 'approval-rebuilt', session: record.session, approval: id, answerIn: record.answerIn });
    }
    if (isDeepStrictEqual(previous, record)) return true;
    this.#waitApproval(record);
    this.#port.emit({ type: 'approval', approval: this.#port.visibility.place('inbox', record, 'approval') });
    this.#changed();
    return true;
  }

  async answerApproval(id: string, choice: ApprovalChoice, note: string | undefined, via: HumanActionVia, deliver: (sessionId: string, requestId: string, answer: { choice: ApprovalChoice; note?: string }) => Promise<{ noteDelivered: boolean }>, resumed: Resumed): Promise<InboxApproval> {
    const record = this.#approvals.get(id);
    const previous = record?.outcome ?? this.#port.store.inboxOutcome('approval', id);
    if (previous && 'via' in previous) throw new Error(`approval already answered by ${previous.by} via ${previous.via} at ${previous.at}`);
    if (!record) throw new Error('no pending approval');
    if (record.answerIn === 'tui') throw new Error('this approval stays in the harness TUI; answer in Neovim');
    if (record.state !== 'pending') throw new Error('approval is not pending');
    if (!record.choices.includes(choice)) throw new Error(`choice ${choice} is not offered by this approval`);
    const noteRefusal = note === undefined ? null : this.#port.sizeRefusal(note);
    if (noteRefusal) throw new HygieneError(noteRefusal, { code: 'hygiene', rule: 'size' });
    const outcome: ApprovalOutcome = { choice, by: 'human', via, at: this.#port.now().toISOString(), ...(note !== undefined ? { note } : {}) };
    const answering: InboxApproval = { ...record, state: 'answering', outcome };
    this.#approvals.set(id, answering);
    this.#port.emit({ type: 'approval', approval: this.#port.visibility.place('inbox', answering, 'approval') });
    this.#changed();
    let delivery: { noteDelivered: boolean };
    try {
      delivery = await deliver(record.sessionId, id.slice(record.sessionId.length + 1), { choice, ...(note !== undefined ? { note } : {}) });
    } catch (error) {
      const winner = resumed(() => {
        if (this.#closed) return;
        const settled = this.#port.store.inboxOutcome('approval', id);
        if (settled) return settled;
        const current = this.#approvals.get(id);
        if (current?.state === 'answering' && current.outcome === outcome) {
          const { outcome: _attempt, ...facts } = current;
          const pending: InboxApproval = { ...facts, state: 'pending' };
          this.#approvals.set(id, pending);
          this.#port.emit({ type: 'approval', approval: this.#port.visibility.place('inbox', pending, 'approval') });
          this.#changed();
        }
        this.#port.log({ event: 'approval-answer-failed', severity: 'warn', session: record.session, approval: id,
          error: error instanceof Error ? error.message : String(error) });
      });
      if (winner && 'via' in winner) throw new Error(`approval already answered by ${winner.by} via ${winner.via} at ${winner.at}`);
      throw error;
    }
    return resumed(() => {
      if (this.#closed) throw new Error('the hub stopped while answering; check the harness outcome');
      const current = this.#approvals.get(id);
      const winner = this.#port.store.inboxOutcome('approval', id);
      if (!current && winner && 'via' in winner && !isDeepStrictEqual(winner, outcome)) {
        throw new Error(`approval already answered by ${winner.by} via ${winner.via} at ${winner.at}`);
      }
      const closed = current ? this.#closeApproval(current, outcome) : { ...record, state: 'closed' as const, outcome: this.#port.store.inboxOutcome('approval', id) as ApprovalOutcome };
      if (note?.trim() && !delivery.noteDelivered) this.#port.approvalNote(closed, note);
      return closed;
    });
  }

  closeApproval(sessionId: string, requestId: string, outcome: ApprovalOutcome): void {
    const record = this.#approvals.get(`${sessionId}:${requestId}`);
    if (record) this.#closeApproval(record, outcome);
  }

  /** A successful native subscription rebuilds pending identities; absent requests were answered off-stream.
   * A snapshot cannot tell which unobserved choice won, so it must never infer consent. */
  reconcileApprovals(sessionId: string, requestIds: string[]): void {
    const pending = new Set(requestIds.map(id => `${sessionId}:${id}`));
    for (const id of this.#restored) {
      const record = this.#approvals.get(id);
      if (!record || record.sessionId !== sessionId) continue;
      if (pending.has(id)) continue;
      this.#restored.delete(id);
      this.closeApproval(sessionId, record.id.slice(sessionId.length + 1), {
        choice: 'answered in the harness', by: 'harness', via: 'harness', at: this.#port.now().toISOString(),
      });
    }
  }

  #waitApproval(record: InboxApproval): void {
    this.#port.store.waitInInbox({ kind: 'approval', id: record.id, subject: record.session, since: record.since,
      text: record.command ?? record.subject.change ?? 'waiting for approval' });
    this.#port.store.saveApproval(record, this.#fallbacks.get(record.sessionId)?.id === record.id);
  }

  #closeApproval(record: InboxApproval, reported: ApprovalOutcome): InboxApproval {
    // Copy the outcome too: adapters must not smuggle arbitrary native payload into a delta or archive.
    const outcome: ApprovalOutcome = { choice: reported.choice, by: reported.by, via: reported.via, at: reported.at,
      ...(reported.note !== undefined ? { note: reported.note } : {}) };
    const closed: InboxApproval = { ...record, state: 'closed', outcome };
    this.#approvals.set(record.id, closed);
    this.#port.store.transaction(() => {
      this.#waitApproval(record);
      this.#depart({ kind: 'approval', id: record.id, subject: record.session, since: record.since,
        text: record.command ?? record.subject.change ?? 'waiting for approval' }, outcome.choice === 'withdrawn' ? 'withdrawn' : 'answered', outcome.at);
    });
    this.#approvals.delete(record.id);
    this.#restored.delete(record.id);
    if (this.#fallbacks.get(record.sessionId)?.id === record.id) this.#fallbacks.delete(record.sessionId);
    this.#port.emit({ type: 'approval', approval: this.#port.visibility.place('inbox', closed, 'approval') });
    this.#changed();
    return closed;
  }

  #syncApprovals(): void {
    if (this.#syncingApprovals) return;
    this.#syncingApprovals = true;
    try {
      const p = this.#port, presence = p.presence(), live = new Map(presence.map(s => [s.sessionId, s]));
      const processes = this.#processes?.() ?? [];
      const byId = new Map(processes.map(proc => [proc.sessionId, proc]));
      for (const [id, record] of this.#approvals) {
        if (!this.#reported.has(record.sessionId)) continue;
        const current = live.get(record.sessionId), proc = byId.get(record.sessionId);
        const session = current?.name ?? proc?.name ?? record.session;
        const role = current?.role ?? proc?.role;
        const { role: _oldRole, ...facts } = record;
        const updated: InboxApproval = { ...facts, session, ...(role ? { role } : {}),
          label: current?.label ?? proc?.label ?? withRole(session, role), attach: proc?.attach ?? record.attach };
        if (isDeepStrictEqual(updated, record)) continue;
        this.#approvals.set(id, updated);
        p.emit({ type: 'approval', approval: p.visibility.place('inbox', updated, 'approval') });
      }
      const candidates = new Map<string, Pick<InboxApproval, 'sessionId' | 'session' | 'role' | 'label' | 'harness' | 'since' | 'attach' | 'command'>>();
      this.#approvalProcesses.clear();
      for (const proc of processes) {
        if (proc.status !== 'running' || proc.state !== 'waiting for approval') continue;
        this.#approvalProcesses.add(proc.sessionId);
        const current = live.get(proc.sessionId), role = current?.role ?? proc.role;
        candidates.set(proc.sessionId, { sessionId: proc.sessionId, session: current?.name ?? proc.name,
          ...(role ? { role } : {}), label: current?.label ?? proc.label ?? withRole(proc.name, proc.role), harness: proc.harness,
          since: this.#since.get(proc.sessionId) ?? p.now().toISOString(), attach: proc.attach,
          ...(proc.approvalCommand !== undefined ? { command: proc.approvalCommand } : {}) });
      }
      for (const current of presence) {
        if (current.state !== 'waiting for approval' || candidates.has(current.sessionId)) continue;
        candidates.set(current.sessionId, { sessionId: current.sessionId, session: current.name, ...(current.role ? { role: current.role } : {}),
          label: current.label ?? withRole(current.name, current.role), harness: null, attach: null,
          since: this.#since.get(current.sessionId) ?? p.now().toISOString() });
      }
      for (const [sessionId, previous] of this.#fallbacks) if (!candidates.has(sessionId)) {
        const proc = byId.get(sessionId);
        // Startup and a native disconnect have no completion receipt yet.
        if (!this.#processes || proc?.status === 'running' && (live.get(sessionId)?.state ?? proc.state) === 'unknown') continue;
        this.#closeApproval(previous, { choice: 'answered in the harness', by: 'harness', via: 'harness', at: p.now().toISOString() });
      }
      for (const [sessionId, row] of candidates) {
        if (this.#reported.has(sessionId)) continue;
        const previous = this.#fallbacks.get(sessionId), command = row.command ?? previous?.command;
        const subject = approvalSubject(command !== undefined ? { command } : {});
        const record: InboxApproval = { ...row, id: previous?.id ?? `${sessionId}:${randomUUID()}`, since: previous?.since ?? row.since,
          ...(subject.command !== undefined ? { command: subject.command } : {}),
          kind: command ? 'command' : 'other', subject, choices: [], answerIn: 'tui', state: 'pending' };
        this.#fallbacks.set(sessionId, record);
        this.#approvals.set(record.id, record);
        if (!isDeepStrictEqual(previous, record)) {
          this.#waitApproval(record);
          p.emit({ type: 'approval', approval: p.visibility.place('inbox', record, 'approval') });
        }
      }
    } finally { this.#syncingApprovals = false; }
  }

  #depart(row: InboxWait, reason: InboxDeparture['reason'], at?: string): void {
    const p = this.#port;
    const text = row.text || (row.kind === 'approval' ? this.#approvals.get(row.id)?.command ?? 'waiting for approval'
      : row.kind === 'plan' ? p.items().find(i => i.id === row.id)?.title
      : p.store.message(row.id)?.text ?? p.store.ask(row.id)?.question) || '';
    const outcome = row.kind === 'ask' ? p.store.ask(row.id)?.outcome : row.kind === 'approval' ? this.#approvals.get(row.id)?.outcome : undefined;
    const departure = p.store.departInbox(row, reason, at ?? outcome?.at ?? p.now().toISOString(), text.split(/\r?\n/, 1)[0], outcome);
    if (departure) {
      this.#departures.push(departure);
      this.#port.log({ event: 'inbox-departure', ...departure });
    }
  }

  /** Human review/QA verdicts reply to requests on the item, regardless of the request's topic. */
  verdict(subject: string): void {
    this.list();
    for (const row of this.#port.store.inboxWaits()) {
      if (row.kind === 'request' && row.subject === subject) this.#depart(row, 'replied');
    }
    this.#changed();
  }

  needsYou(includePairings = true): number {
    if (!includePairings) {
      // Use the rows and total from one projection even if expiry crosses a clock read.
      const inbox = this.list();
      return inbox.needsYou - (inbox.pairings?.length ?? 0);
    }
    return this.#count && this.#port.now().getTime() < this.#count.until ? this.#count.value : this.list().needsYou;
  }

  /** These actions address one current row; stale and unknown ids are refused by name. */
  decline(id: string): Inbox {
    const row = this.list().requests.find(r => r.id === id);
    if (!row) throw new Error(`no waiting inbox request "${id}" (unknown or already left)`);
    this.#depart({ kind: 'request', id, subject: row.subject, since: row.since }, 'declined');
    this.#changed();
    return this.list();
  }

  read(id: string): Inbox {
    const row = this.list().messages.find(r => r.id === id);
    if (!row) throw new Error(`no waiting inbox message "${id}" (unknown or already left)`);
    this.#port.store.markMessageRead(id);
    this.#depart({ kind: 'message', id, subject: row.subject, since: row.since }, 'read');
    this.#changed();
    return this.list();
  }

  /** A fixed window bounds rebuilds even when steady traffic arrives on separate event-loop turns. */
  #changed(invalidateCount = true): void {
    if (invalidateCount) this.#count = null;
    if (this.#scheduled || this.#closed) return;
    this.#scheduled = this.#clock.setTimeout(() => {
      this.#scheduled = null;
      if (this.#closed) return;
      try {
        const inbox = this.list();
        const signature = JSON.stringify(inbox);
        if (signature === this.#published && !this.#departures.length) return;
        this.#published = signature;
        const departures = this.#departures;
        this.#departures = [];
        this.#port.emit({ type: 'inbox', inbox: { ...inbox, ...(departures.length ? { departures } : {}) } });
      } catch (err) {
        this.#port.log({ event: 'inbox-failed', error: err instanceof Error ? err.message : String(err) });
      }
    }, 250);
    this.#scheduled.unref();
  }
}
