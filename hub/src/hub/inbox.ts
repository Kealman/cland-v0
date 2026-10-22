import { realClock, type Clock, type ClockTimer } from './clock.ts';
import type { Finding, FindingCounts } from '../tracker/findings.ts';
// The inbox (§3.7): asks/command approvals, pending plans, requests and messages.
// Each row records when its wait began; departures persist in hub.db and reach the journal
// through the log tap. Publications are coalesced over 250 ms; explicit reads always settle current waits.
import { messageVerdict, OLD_MESSAGE_MS, type Visibility } from './visibility.ts';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import type { HarnessProcessView, HubEvent, Inbox, InboxApproval, InboxAsk, InboxRequest, InboxMessage, InboxPlan, InboxDeparture, NotificationKind, Presence, SessionState, Topic } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { ROLE_LABELS, withRole } from '../names.ts';
import type { ItemSummary } from '../tracker/tracker.ts';
import type { InboxWait, Store } from './store.ts';

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
};

export class InboxBoard {
  readonly #port: InboxPort;
  readonly #clock: Clock;
  /** Departures accumulated by reads or the coalesced rebuild, published once with the next inbox delta. */
  #departures: InboxDeparture[] = [];
  /** The launched sessions (the adapters' process table): the approvals and their attach commands. */
  #processes: (() => HarnessProcessView[]) | null = null;
  /** When each session entered `waiting for approval`, by session id. */
  readonly #since = new Map<string, string>();
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
        if (event.message.topic === 'agents' && event.message.fromKind === 'hub' && event.message.kind === 'inject-stalled' && event.message.to.length === 0) {
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
    const approvals: InboxApproval[] = [];
    // one approval per session, by its id: a launched session that renamed itself is its process row (the launch
    // name, with the attach command) and its presence (the name it has now) at once
    const presence = p.presence();
    const live = new Map(presence.map((s) => [s.sessionId, s]));
    const seen = new Set<string>();
    this.#approvalProcesses.clear();
    for (const proc of this.#processes?.() ?? []) {
      if (proc.status !== 'running' || proc.state !== 'waiting for approval') continue;
      this.#approvalProcesses.add(proc.sessionId);
      seen.add(proc.sessionId);
      const now = live.get(proc.sessionId);
      const name = now?.name ?? proc.name;
      const role = now?.role ?? proc.role;
      approvals.push({ id: proc.sessionId, session: name, ...(role ? { role } : {}), label: now?.label ?? proc.label ?? withRole(proc.name, proc.role), harness: proc.harness, since: this.#since.get(proc.sessionId) ?? p.now().toISOString(), attach: proc.attach, ...(proc.approvalCommand ? { command: proc.approvalCommand } : {}) });
    }
    // a session the adapters did not launch has no state of its own; one that has (a resumed launch under another name) still counts
    for (const s of presence) {
      if (s.state !== 'waiting for approval' || seen.has(s.sessionId)) continue;
      seen.add(s.sessionId);
      approvals.push({ id: s.sessionId, session: s.name, ...(s.role ? { role: s.role } : {}), label: s.label ?? withRole(s.name, s.role), harness: null, since: this.#since.get(s.sessionId) ?? p.now().toISOString(), attach: null });
    }
    const placedApprovals = approvals.map(a => p.visibility.place('inbox', a, 'approval'));
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
        const proc = this.#processes?.().find(s => s.sessionId === row.id);
        if ((proc?.state ?? p.stateOf(row.id)) !== 'waiting for approval') reason = 'approved';
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
    const needsYou = rows.length;
    const now = p.now(), today = new Date(now);
    // Status polls share the current projection. Time alone can move a message
    // to the old-message layer, so expire at that exact boundary as well.
    let until = Infinity;
    for (const candidate of candidates) {
      const expires = Date.parse(candidate.message.ts) + OLD_MESSAGE_MS + 1;
      if (expires > now.getTime()) until = Math.min(until, expires);
    }
    this.#count = { value: needsYou, until };
    today.setHours(0, 0, 0, 0);
    return { asks, approvals: placedApprovals, plans, requests, messages, waiting, needsYou,
      archiveToday: p.store.inboxDeparturesToday(today.toISOString()),
      ...(archive ? { archive: p.store.inboxDepartures(new Date(now.getTime() - 7 * 86400_000).toISOString()) } : {}) };
  }

  #depart(row: InboxWait, reason: InboxDeparture['reason'], at?: string): void {
    const p = this.#port;
    const text = row.text || (row.kind === 'approval' ? this.#processes?.().find(s => s.sessionId === row.id)?.approvalCommand ?? 'waiting for approval'
      : row.kind === 'plan' ? p.items().find(i => i.id === row.id)?.title
      : p.store.message(row.id)?.text ?? p.store.ask(row.id)?.question) || '';
    const outcome = row.kind === 'ask' ? p.store.ask(row.id)?.outcome : undefined;
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

  needsYou(): number {
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
