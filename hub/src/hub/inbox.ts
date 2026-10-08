// The inbox (spec 5, Inbox.dc.html, #33): what only the human can unblock, in a fixed order, then what is worth
// the human's eye.
//
//   asks           the open asks, oldest first (the `asks` table)
//   approvals      sessions in `waiting for approval`: the harness's own prompt, answered in the attached session
//   waiting        topics `waiting for human` that carry no open ask
//   notifications  dismissable: verdict comments on items, role changes, session deaths, sessions idle longer
//                  than the configured threshold; stored with a `dismissed` flag. Fed by the hub's own events (the
//                  journal's stand-in until #34) and the tracker's verdicts.
//
// The "needs you" count is asks + approvals + waiting; notifications never count. Subscribers get the whole inbox
// in an `inbox` event whenever any of it changed, coalesced to one per turn of the event loop.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import type { HarnessProcessView, HubEvent, Inbox, InboxApproval, InboxAsk, NotificationKind, Presence, SessionState, Topic } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { ROLE_LABELS, withRole } from '../names.ts';
import type { Store } from './store.ts';

/** A session idle longer than this is worth a notification, unless the project's config says otherwise. */
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
  now: () => Date;
  log: LogFn;
  emit: (event: HubEvent) => void;
  topics: () => Topic[];
  presence: () => Presence[];
  /** A session's state by its session id. */
  stateOf: (sessionId: string) => SessionState;
  /** How long an idle session waits before it is a notification, ms; 0 or less: never. */
  idleNotifyMs: number;
};

export type VerdictNote = { item: string; author: string; verdict: string; result: string; run?: string };

export class InboxBoard {
  readonly #port: InboxPort;
  /** The launched sessions (the adapters' process table): the approvals and their attach commands. */
  #processes: (() => HarnessProcessView[]) | null = null;
  /** When each session entered `waiting for approval`, by name. */
  readonly #since = new Map<string, string>();
  /** One timer per idle session, by session id. */
  readonly #idle = new Map<string, NodeJS.Timeout>();
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
      case 'session.role':
        if (!DEATH_REASONS.has(event.reason)) this.#roleChange(event);
        break;
      case 'delivery':
      case 'inbox':
        return;
      default:
        break;
    }
    this.#changed();
  }

  /** A verdict comment on an item (the tracker's): a notification. */
  verdict(v: VerdictNote): void {
    const text = `${v.item} ${v.verdict} ${v.result} · ${v.author}${v.run ? ` · run ${v.run}` : ''}`;
    this.#notify('verdict', text, { item: v.item, session: v.author, result: v.result });
  }

  #sessionState(e: Extract<HubEvent, { type: 'session.state' }>): void {
    if (e.state === 'waiting for approval') {
      if (!this.#since.has(e.session)) this.#since.set(e.session, e.ts);
    } else this.#since.delete(e.session);
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
    // a harness that died (the process watch): its row says so, its role is vacant
    if (e.source === 'process' && e.state === 'unknown') {
      const role = this.#port.store.roleOf(e.session);
      this.#notify('death', `${withRole(e.session, role)} died: its harness exited${role ? `; the ${ROLE_LABELS[role] ?? role} role it held is vacant` : ''}`, { session: e.session });
    }
  }

  #idleFor(session: string, sessionId: string): void {
    this.#idle.delete(sessionId);
    if (this.#closed) return;
    try {
      if (this.#port.stateOf(sessionId) !== 'idle') return;
      const minutes = Math.max(1, Math.round(this.#port.idleNotifyMs / 60_000));
      this.#notify('idle', `${withRole(session, this.#port.store.roleOf(session))} idle ${minutes} min`, { session });
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
    const seen = new Set<string>();
    for (const proc of this.#processes?.() ?? []) {
      if (proc.status !== 'running' || proc.state !== 'waiting for approval') continue;
      seen.add(proc.name);
      approvals.push({ session: proc.name, label: proc.label ?? withRole(proc.name, proc.role), harness: proc.harness, since: this.#since.get(proc.name) ?? null, attach: proc.attach });
    }
    // a session the adapters did not launch has no state of its own; one that has (a resumed launch under another name) still counts
    for (const s of p.presence()) {
      if (s.state !== 'waiting for approval' || seen.has(s.name)) continue;
      approvals.push({ session: s.name, label: s.label ?? withRole(s.name, s.role), harness: null, since: this.#since.get(s.name) ?? null, attach: null });
    }
    approvals.sort((a, b) => String(a.since ?? '').localeCompare(String(b.since ?? '')));
    return { asks, approvals, waiting, notifications: p.store.notifications(), needsYou: asks.length + approvals.length + waiting.length };
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
