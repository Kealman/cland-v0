// The inbox (§3.7): asks/command approvals, pending plans, requests and messages.
// Each row records when its wait began; departures persist in hub.db and reach the journal
// through the log tap. Publications are coalesced, but waits settle on every observed change.
import { messageVerdict, warningSeverity, type Visibility } from './visibility.ts';
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
  /** The launched sessions (the adapters' process table): the approvals and their attach commands. */
  #processes: (() => HarnessProcessView[]) | null = null;
  /** When each session entered `waiting for approval`, by session id. */
  readonly #since = new Map<string, string>();
  /** One timer per idle session, by session id. */
  readonly #idle = new Map<string, NodeJS.Timeout>();
  readonly #deaths = new Set<string>();
  #scheduled = false;
  #published: string | null = null;
  #closed = false;

  constructor(port: InboxPort) {
    this.#port = port;
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
    for (const t of this.#idle.values()) clearTimeout(t);
    this.#idle.clear();
  }

  // ---------------------------------------------------------------- what feeds it

  /** Every hub event passes here: what may change a section schedules a new `inbox` event; some are notifications. */
  observe(event: HubEvent): void {
    if (this.#closed) return;
    switch (event.type) {
      case 'session.state':
        this.#sessionState(event);
        break;
      case 'session.process': {
        const proc = event.process;
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
          const result = messageVerdict(event.message);
          if (result) {
            const detail = event.message.detail!;
            this.#notify('verdict', event.message.text.split('\n')[0] ?? '', { ...(typeof detail.item === 'string' ? { item: detail.item } : {}), ...(typeof detail.session === 'string' ? { session: detail.session } : {}), result });
          }
        }
        if (event.message.topic === 'agents' && event.message.fromKind === 'hub' && event.message.kind === 'turn-failed') {
          this.#notify('turn-failed', event.message.text, typeof event.message.detail?.session === 'string' ? { session: event.message.detail.session } : {});
        }
        // a handover (#31) moves a role between two sessions: its `handover` notice in Agents (#34) says who handed
        // what to whom, once, where its two `session.role` events would make two rows
        if (event.message.topic === 'agents' && event.message.fromKind === 'hub' && event.message.kind === 'handover') {
          this.#notify('role', (event.message.text.split('\n')[0] ?? '').replace(/:$/, ''), event.message.detail && typeof event.message.detail.to === 'string' ? { session: event.message.detail.to } : {});
        }
        break;
      case 'delivery':
      case 'inbox':
        return;
      default:
        break;
    }
    // the sections are recomputed once per tick by #changed (coalesced); a synchronous list() here ran the full
    // inbox query on every hub event, which stalled startup for minutes on a project with 200 remembered processes
    this.#changed();
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
      clearTimeout(timer);
      this.#idle.delete(e.sessionId);
    }
    if (e.state === 'idle' && this.#port.idleNotifyMs > 0) {
      const t = setTimeout(() => this.#idleFor(e.session, e.sessionId), this.#port.idleNotifyMs);
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

  #notify(kind: NotificationKind, text: string, extra: { item?: string; session?: string; result?: string } = {}): void {
    const id = `n-${randomUUID().slice(0, 8)}`;
    this.#port.store.addNotification({ id, kind, text, ts: this.#port.now().toISOString(), ...extra });
    this.#port.log({ event: 'notification', id, kind, text, ...extra });
    this.#changed();
  }

  // ---------------------------------------------------------------- what it shows

  list(): Inbox {
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
    for (const proc of this.#processes?.() ?? []) {
      if (proc.status !== 'running' || proc.state !== 'waiting for approval') continue;
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
    const notifications = p.store.notifications().map(n => p.visibility.place('inbox', n));
    const candidates = p.store.inboxMessages();
    const requests: InboxRequest[] = [];
    const messages: InboxMessage[] = [];
    for (const candidate of candidates) {
      const m = candidate.message;
      const t = byId.get(m.topic)!;
      const topic = { id: t.id, title: t.title, ...(t.item ? { item: t.item } : {}) };
      if (m.kind === 'request') {
        if (candidate.replied || p.store.leftInbox('request', m.id)) continue;
        requests.push({ id: m.id, from: m.from, ...(m.fromRole ? { fromRole: m.fromRole } : {}),
          request: m.request!, subject: m.subject!, topic, ts: m.ts, since: m.ts, text: m.text, layer: 'now' });
        continue;
      }
      if (candidate.read || candidate.replied || p.store.leftInbox('message', m.id)) continue;
      const latestWaiting = candidate.latest && t.status === 'waiting for human' && !asked.has(t.id);
      const layer = latestWaiting ? p.visibility.place('inbox', t, 'waiting').layer : p.visibility.place('messages', m).layer;
      if (!(candidate.toHuman || latestWaiting) || layer !== 'now') continue;
      messages.push({ id: m.id, from: m.from, ...(m.fromRole ? { fromRole: m.fromRole } : {}),
        subject: t.item ?? t.id, topic, ts: m.ts, since: m.ts, text: m.text, layer });
    }
    const items = p.items();
    const plans: InboxPlan[] = items.filter(i => i.state === 'open' && i.plan && !i.planError && i.approval?.required && i.approval.state === 'pending')
      .map(i => ({ id: i.id, subject: i.id, title: i.title, stages: i.plan!.stages.length,
        lanes: i.plan!.stages.reduce((n, s) => n + s.lanes.length, 0),
        items: i.plan!.stages.reduce((n, s) => n + s.lanes.reduce((m, lane) => m + lane.length, 0), 0),
        since: i.updated, layer: 'now' as const }));
    const rows: InboxWait[] = [
      ...asks.filter(a => a.layer === 'now').map(a => ({ kind: 'ask' as const, id: a.id, subject: a.topic.item ?? a.topic.id, since: a.ts })),
      ...placedApprovals.filter(a => a.layer === 'now').map(a => ({ kind: 'approval' as const, id: a.id, subject: a.session, since: a.since })),
      ...plans.map(a => ({ kind: 'plan' as const, id: a.id, subject: a.subject, since: a.since })),
      ...requests.map(a => ({ kind: 'request' as const, id: a.id, subject: a.subject, since: a.since })),
      ...messages.map(a => ({ kind: 'message' as const, id: a.id, subject: a.subject, since: a.since })),
    ];
    // Capture the start of every wait before coalescing publication, and settle only a documented leave rule.
    for (const row of p.store.inboxWaits()) {
      let reason: InboxDeparture['reason'] | undefined;
      if (row.kind === 'ask') {
        const state = p.store.ask(row.id)?.state;
        if (state && state !== 'open') reason = state;
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
    return { asks, approvals: placedApprovals, plans, requests, messages, waiting, notifications, needsYou };
  }

  #depart(row: InboxWait, reason: InboxDeparture['reason']): void {
    const departure = this.#port.store.departInbox(row, reason, this.#port.now().toISOString());
    if (departure) this.#port.log({ event: 'inbox-departure', ...departure });
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
    return this.list().needsYou;
  }

  /** Dismiss an ordinary notification; warnings, asks, approvals and unknown ids are refused. */
  dismiss(id: string): Inbox {
    if (!this.#port.store.notificationExists(id)) {
      if (this.#port.store.ask(id) || this.list().approvals.some((a) => a.session === id)) throw new Error('asks and approvals are not dismissed: answer them');
      throw new Error(`no notification "${id}"`);
    }
    const note = this.#port.store.notifications().find(n => n.id === id);
    if (note && warningSeverity('inbox', note)) throw new Error('warn events are informational and are not dismissed');
    this.#port.store.dismissNotifications(id);
    this.#changed();
    return this.list();
  }

  dismissAll(): Inbox {
    let dismissed = 0;
    for (const note of this.#port.store.notifications()) {
      if (!warningSeverity('inbox', note)) dismissed += this.#port.store.dismissNotifications(note.id);
    }
    if (dismissed > 0) this.#changed();
    return this.list();
  }

  /** Publish the inbox once this turn's changes are in, and only when it differs from what subscribers last got. */
  #changed(): void {
    if (this.#scheduled || this.#closed) return;
    this.#scheduled = true;
    setImmediate(() => {
      this.#scheduled = false;
      if (this.#closed) return;
      try {
        const inbox = this.list();
        const signature = JSON.stringify(inbox);
        if (signature === this.#published) return;
        this.#published = signature;
        this.#port.emit({ type: 'inbox', inbox });
      } catch (err) {
        this.#port.log({ event: 'inbox-failed', error: err instanceof Error ? err.message : String(err) });
      }
    });
  }
}
