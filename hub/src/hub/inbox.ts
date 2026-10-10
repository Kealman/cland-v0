// The inbox (spec 5, Inbox.dc.html, #33): what only the human can unblock, in a fixed order, then what is worth
// the human's eye.
//
//   asks           the open asks, oldest first (the `asks` table)
//   approvals      sessions in `waiting for approval`: the harness's own prompt, answered in the attached session
//   waiting        topics `waiting for human` that carry no open ask
//   notifications  dismissable: role changes and failed or uncertain turns; stored with a `dismissed` flag. Fed by the hub's own events
//                  (`session.role`, `session.state`), the tracker's verdicts, and for a handover its one `handover`
//                  notice in Agents (#31, #34) rather than its two `session.role` events.
//
// The "needs you" count is the number of inbox entries classified now. Subscribers get the whole inbox
// in an `inbox` event whenever any of it changed, coalesced to one per turn of the event loop.
import { messageVerdict, type Visibility } from './visibility.ts';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import type { HarnessProcessView, HubEvent, Inbox, InboxApproval, InboxAsk, NotificationKind, Presence, SessionState, Topic } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { ROLE_LABELS, withRole } from '../names.ts';
import type { Store } from './store.ts';

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
  /** When each session entered `waiting for approval`, by name. */
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
    this.#port.log({ event: 'notification', id, kind, text });
    this.#changed();
  }

  // ---------------------------------------------------------------- what it shows

  list(): Inbox {
    const p = this.#port;
    const open = p.store.openAsks();
    const topics = p.topics();
    const byId = new Map(topics.map((t) => [t.id, t]));
    const asks: InboxAsk[] = open.map((a) => {
      const t = byId.get(a.topic);
      return {
        id: a.id,
        topic: { id: a.topic, title: t?.title ?? a.topic, ...(t?.item ? { item: t.item } : {}) },
        question: a.question,
        options: a.options,
        free: a.free,
        from: a.from,
        label: withRole(a.from, p.store.roleOf(a.from)),
        ts: a.ts,
      };
    });
    const asked = new Set(open.map((a) => a.topic));
    const waiting = topics.filter((t) => t.status === 'waiting for human' && !asked.has(t.id)).sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0));
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
      approvals.push({ session: name, label: now?.label ?? proc.label ?? withRole(proc.name, proc.role), harness: proc.harness, since: this.#since.get(proc.sessionId) ?? null, attach: proc.attach });
    }
    // a session the adapters did not launch has no state of its own; one that has (a resumed launch under another name) still counts
    for (const s of presence) {
      if (s.state !== 'waiting for approval' || seen.has(s.sessionId)) continue;
      seen.add(s.sessionId);
      approvals.push({ session: s.name, label: s.label ?? withRole(s.name, s.role), harness: null, since: this.#since.get(s.sessionId) ?? null, attach: null });
    }
    approvals.sort((a, b) => String(a.since ?? '').localeCompare(String(b.since ?? '')));
    const notifications = p.store.notifications().map(n => p.visibility.place('inbox', n));
    const needsYou = asks.filter(a => p.visibility.place('inbox', a, 'ask').layer === 'now').length
      + approvals.filter(a => p.visibility.place('inbox', a, 'approval').layer === 'now').length
      + waiting.filter(t => p.visibility.place('inbox', t, 'waiting').layer === 'now').length
      + notifications.filter(n => n.layer === 'now').length;
    return { asks, approvals, waiting, notifications, needsYou };
  }

  needsYou(): number {
    return this.list().needsYou;
  }

  /** Dismiss one notification; an ask, an approval or an unknown id is refused. */
  dismiss(id: string): Inbox {
    if (!this.#port.store.notificationExists(id)) {
      if (this.#port.store.ask(id) || this.list().approvals.some((a) => a.session === id)) throw new Error('asks and approvals are not dismissed: answer them');
      throw new Error(`no notification "${id}"`);
    }
    this.#port.store.dismissNotifications(id);
    this.#changed();
    return this.list();
  }

  dismissAll(): Inbox {
    if (this.#port.store.dismissNotifications() > 0) this.#changed();
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
