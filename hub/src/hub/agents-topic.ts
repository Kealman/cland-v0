// The Agents topic as the record (spec 4.5, decision #7): besides every agent-to-agent message (a session's `send`
// with addressees lands there by default), the lifecycle events of the project, each a hub notice with a `kind`.
// They come from the hub's domain events, as logged: `lifecycleNotice` maps one log entry to a notice (or to
// nothing), and `agentsRecord` taps the log closure so the daemon's tracker, adapters and core all feed it through
// `HubCore.noticeInTopic`, the one path into the record. The loop breaker's mute (core) and the permission
// refusals (#30) call `noticeInTopic` themselves.
//
// Tool-level noise never enters: commands, outputs, hook signals, state changes, acks and deliveries are not
// lifecycle events, so nothing maps them.
//
// A notice is recorded after the event's own write (a microtask later), so a hub dying in between would lose it. The
// journal closes that gap: an event that makes a notice is journalled with the notice's id (`agentsNotice`), and at
// the next start `replayAgentsRecord` records every journalled notice after the last one recorded (the store's
// checkpoint, which retention never prunes), under that id (once: `noticeInTopic` skips an id it already holds).
import { randomUUID } from 'node:crypto';
import { ROLE_LABELS, withRole } from '../names.ts';
import type { LogEntry, LogFn } from '../log.ts';
import { AGENTS, AGENTS_JOURNAL_CHECKPOINT, type HubCore, type TopicNotice } from './core.ts';

/** The kinds of the lifecycle notices this module records (the handover, mute, unmute and refusal kinds are posted directly). */
export const LIFECYCLE_KINDS = ['session-start', 'session-stop', 'session-death', 'spoke-joined', 'turn-failed', 'redelivered', 'role-assign', 'role-revoke', 'claim', 'release', 'merge', 'worktree', 'handover', 'mute', 'unmute', 'refusal'] as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const roleName = (role: string | null): string => (role ? (ROLE_LABELS[role] ?? role) : 'no role');

/** The notice a domain event makes in Agents, or null. `label` shows a session as `name [Role]`. */
export function lifecycleNotice(entry: LogEntry, label: (name: string) => string): TopicNotice | null {
  const session = str(entry.session);
  switch (entry.event) {
    case 'turn-failed':
      return session ? { kind: 'turn-failed', text: str(entry.text) ?? `${label(session)}: its turn failed: ${str(entry.error) ?? 'unknown error'}`, detail: { session } } : null;
    case 'harness-redelivered':
      // a steer its turn accepted and ended without (T-50): handed over again, so nothing is lost; the record says why it may come twice
      return session ? { kind: 'redelivered', text: `${label(session)}: its turn ended without a message it had accepted; the message was delivered again ${entry.intoActiveTurn === true ? 'into a running turn' : 'as a new turn'}`, detail: { session, message: str(entry.id) } } : null;
    case 'harness-redelivery-failed':
      return session ? { kind: 'turn-failed', text: `${label(session)}: its turn ended without a message it had accepted, and delivering it again failed: ${str(entry.error) ?? 'unknown error'}`, detail: { session, message: str(entry.id) } } : null;
    case 'replaced': {
      // another spoke of a connected session said hello (T-51): nothing is lost, and the record says why there are two
      const name = str(entry.name);
      return name ? { kind: 'spoke-joined', text: `${label(name)}: another spoke of the session connected (${Number(entry.spokes) || 2} now); each is answered, and deliveries go to the newest`, detail: { session: name, spokes: Number(entry.spokes) || 2 } } : null;
    }
    case 'session-launched':
      // the role it was launched for: its spoke has not said hello yet
      return session ? { kind: 'session-start', text: `${str(entry.role) ? withRole(session, entry.role as string) : label(session)} started (${str(entry.harness) ?? 'harness'}${str(entry.model) ? `, ${String(entry.model)}` : ''})`, detail: { session, harness: entry.harness ?? null } } : null;
    case 'session-resumed':
      return session ? { kind: 'session-start', text: `${label(session)} re-found after a hub restart${entry.relaunched ? ' (relaunched)' : ''}`, detail: { session, resumed: true } } : null;
    case 'session-stopped':
      return session ? { kind: 'session-stop', text: `${label(session)} stopped`, detail: { session } } : null;
    case 'harness-exited':
      return session ? { kind: 'session-death', text: `${label(session)} died: ${str(entry.detail) ?? 'its harness exited'}`, detail: { session } } : null;
    case 'role-assigned': {
      if (!session) return null;
      const role = str(entry.role);
      const previous = str(entry.previous);
      const moved = previous && previous !== role ? ` (was ${roleName(previous)})` : '';
      return { kind: 'role-assign', text: `${session} assigned ${roleName(role)}${moved}`, detail: { session, role, previous } };
    }
    case 'role-clause':
      // a launch hands the role over at the session's first hello; a plain hello only re-sends the clause
      return session && /^assigned at launch/.test(String(entry.reason ?? '')) ? { kind: 'role-assign', text: `${session} took ${roleName(str(entry.role))} at launch`, detail: { session, role: entry.role ?? null } } : null;
    case 'role-cleared': {
      if (!session) return null;
      const previous = str(entry.previous);
      return { kind: 'role-revoke', text: `${session} no longer holds ${roleName(previous)}: ${str(entry.reason) ?? 'revoked'}`, detail: { session, previous, reason: entry.reason ?? null } };
    }
    case 'task-claimed': {
      const id = str(entry.id);
      if (!session || !id) return null;
      const took = str(entry.took);
      return { kind: 'claim', text: `${label(session)} claimed ${id}${took ? ` (taken over from ${took})` : ''}`, detail: { item: id, session } };
    }
    case 'task-released': {
      const id = str(entry.id);
      if (!id) return null;
      const by = str(entry.by);
      const why = entry.reason === 'closed' ? ': the item closed' : by && by !== session ? ` by ${by}` : '';
      return { kind: 'release', text: `${id} released${session ? ` (held by ${session})` : ''}${why}`, detail: { item: id, session } };
    }
    case 'task-merged':
      return { kind: 'merge', text: `${String(entry.id)}: merged ${String(entry.commit)} onto ${String(entry.base)} by ${session ? label(session) : 'human'}${entry.override ? ` (human override: ${String(entry.override)})` : ''}`, detail: { item: entry.id, commit: entry.commit, base: entry.base, session, override: entry.override ?? null } };
    case 'merge-resumed':
    case 'merge-follow-up-failed':
    case 'merge-recovery-pending':
      return { kind: 'merge', text: `${String(entry.id)}: ${entry.event === 'merge-resumed' ? `finishing merged ${String(entry.commit)}` : String(entry.error)}`, detail: { item: entry.id, commit: entry.commit, base: entry.base, step: entry.step ?? null } };
    case 'merge-refused':
    case 'merge-cleanup-failed':
      return { kind: 'refusal', text: `${String(entry.id)}: ${entry.event === 'merge-refused' ? 'merge refused' : 'merge cleanup kept'}: ${String(entry.error)}`, detail: { item: entry.id, session, code: entry.code ?? null } };
    case 'task-worktree': {
      const id = str(entry.id);
      const branch = str(entry.branch);
      const path = str(entry.path);
      if (!id || !branch || !path) return null;
      const base = str(entry.base);
      const made = entry.createdBranch === true ? `branch ${branch} from ${base ?? 'its base'} and worktree ${path}` : `worktree ${path} on its branch ${branch}`;
      return { kind: 'worktree', text: `${id}: ${made} created${session ? ` for ${label(session)}` : ''}`, detail: { item: id, branch, path, ...(session ? { session } : {}) } };
    }
    case 'task-worktree-removed': {
      const id = str(entry.id);
      const path = str(entry.path);
      if (!id || !path) return null;
      const branch = str(entry.branch);
      return { kind: 'worktree', text: `${id}: worktree ${path}${branch ? ` and branch ${branch}` : ''} removed (prune)`, detail: { item: id, path, ...(branch ? { branch } : {}) } };
    }
    case 'worktree-refused': {
      if (!session) return null;
      const worktree = str(entry.worktree);
      const item = str(entry.item);
      return { kind: 'worktree', text: `${label(session)}: its harness's own worktree was refused; it works in ${worktree ?? 'its task worktree'}`, detail: { session, ...(item ? { item } : {}) } };
    }
    default:
      return null;
  }
}

/**
 * The Agents record as a tap on the log closure: `tap(log)` logs every entry and records the lifecycle ones in
 * Agents once a core is attached (the daemon builds the log before the hub, then attaches the hub's core).
 */
export function agentsRecord(): { tap: (log: LogFn) => LogFn; attach: (core: HubCore) => void } {
  let core: HubCore | null = null;
  return {
    attach: (c) => {
      core = c;
    },
    tap: (log) => (entry) => {
      const notice = core ? lifecycleNotice(entry, (name) => (core as HubCore).label(name)) : null;
      if (!core || !notice) {
        log(entry);
        return;
      }
      // the journal line carries the notice's id: a notice lost to a crash is found and recorded at the next start
      notice.id = randomUUID();
      log({ ...entry, agentsNotice: notice.id });
      const target = core;
      // after the logging call returns: the event's own write (a tracker transaction on another connection to the
      // same file, a core method half-way through) is complete before the record is written
      queueMicrotask(() => {
        if (target.store.message(notice.id as string) !== null) return;
        try {
          target.noticeInTopic(AGENTS.id, notice);
        } catch (err) {
          log({ event: 'agents-record-failed', kind: notice.kind, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}

/**
 * At start: the journalled lifecycle events (`records`, oldest first) whose notices Agents lacks, recorded now. Only
 * those after the newest one recorded: notices are recorded in order, so a gap is at the end of the previous run.
 * The newest one recorded is the store's checkpoint (`meta`, written with each journalled notice), which retention
 * never prunes, else the newest one Agents still holds: once every notice is past the window, nothing comes back.
 */
export function replayAgentsRecord(core: HubCore, records: ReadonlyArray<Record<string, unknown>>, log: LogFn = () => {}): number {
  const noticed = records.filter((r) => typeof r.agentsNotice === 'string');
  const checkpoint = core.store.meta(AGENTS_JOURNAL_CHECKPOINT);
  let from = 0;
  for (let i = noticed.length - 1; i >= 0; i--) {
    const id = noticed[i]?.agentsNotice as string;
    if (id === checkpoint || core.store.message(id) !== null) {
      from = i + 1;
      break;
    }
  }
  let replayed = 0;
  for (const r of noticed.slice(from)) {
    const notice = lifecycleNotice(r as LogEntry, (name) => core.label(name));
    if (!notice) continue;
    try {
      core.noticeInTopic(AGENTS.id, { ...notice, id: r.agentsNotice as string });
      replayed++;
    } catch (err) {
      log({ event: 'agents-record-failed', kind: notice.kind, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (replayed) log({ event: 'agents-record-replayed', notices: replayed });
  return replayed;
}
