// The Agents topic as the record (spec 4.5, decision #7): besides every agent-to-agent message (a session's `send`
// with addressees lands there by default), the lifecycle events of the project, each a hub notice with a `kind`.
// They come from the hub's domain events, as logged: `lifecycleNotice` maps one log entry to a notice (or to
// nothing), and `agentsRecord` taps the log closure so the daemon's tracker, adapters and core all feed it through
// `HubCore.noticeInTopic`, the one path into the record. The loop breaker's mute (core) and the permission
// refusals (#30) call `noticeInTopic` themselves.
//
// Tool-level noise never enters: commands, outputs, hook signals, state changes, acks and deliveries are not
// lifecycle events, so nothing maps them.
import { ROLE_LABELS, withRole } from '../names.ts';
import type { LogEntry, LogFn } from '../log.ts';
import { AGENTS, type HubCore, type TopicNotice } from './core.ts';

/** The kinds of the lifecycle notices this module records (the handover, mute, unmute and refusal kinds are posted directly). */
export const LIFECYCLE_KINDS = ['session-start', 'session-stop', 'session-death', 'role-assign', 'role-revoke', 'claim', 'release', 'handover', 'mute', 'unmute', 'refusal'] as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const roleName = (role: string | null): string => (role ? (ROLE_LABELS[role] ?? role) : 'no role');

/** The notice a domain event makes in Agents, or null. `label` shows a session as `name [Role]`. */
export function lifecycleNotice(entry: LogEntry, label: (name: string) => string): TopicNotice | null {
  const session = str(entry.session);
  switch (entry.event) {
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
      log(entry);
      if (!core) return;
      const notice = lifecycleNotice(entry, (name) => (core as HubCore).label(name));
      if (!notice) return;
      const target = core;
      // after the logging call returns: the event's own write (a tracker transaction on another connection to the
      // same file, a core method half-way through) is complete before the record is written
      queueMicrotask(() => {
        try {
          target.noticeInTopic(AGENTS.id, notice);
        } catch (err) {
          log({ event: 'agents-record-failed', kind: notice.kind, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
