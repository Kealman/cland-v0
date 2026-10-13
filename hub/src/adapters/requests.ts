// The `session.*` frames: launching and managing harness sessions (UI, CLI, spokes), and the signals and
// bridge that come from inside a launched session (`cland hook`). Called from the dispatcher.
//
//   session.launch  {name, role?, model?, harness?, cwd?, effort?, item?, brief?} → {process}   the human, and a spoke whose role grants it; a role's
//                                                              launch defaults (roles.toml) fill what is not given; with `item`
//                                                              (an Implementer's task or a Lead's epic/release): {process, claim, worktree, reason?}, in the
//                                                              item's worktree (`src/hub/worktrees.ts`)
//   session.list    {archived?: true}                                         → {processes, archived: count, adapters: {<harness>: capabilities}, coordinator}
//   session.attach  {session}                                  → {command}
//   session.archive {session}                                  → {process}   human and Coordinator; stopped/exited only
//   session.stop    {session}                                  → {process}
//   session.resume  {session, relaunch?, fresh?}               → {found, reason?, process, role, claim, notes[], fresh?: {brief}}
//   session.retry   {session, message}                         → {retried: true}   the human: an `uncertain` delivery sent again
//   session.signal  {session?, sessionId?, launch?, event, at?, payload?} → {applied, state?}   clients only (`cland hook`)
//   session.bridge  {session, launch?}                         → {bridged: true}, then `inject` frames  clients only
//
// `launch` is the cland session id the launch gave the session's hooks and mod: a signal or bridge of an
// earlier launch under the same name is ignored or refused.
import type { HubFrame } from '../protocol.ts';
import type { InjectFrame } from './contract.ts';
import { InvalidLaunchCwd, type Sessions } from './sessions.ts';
import type { Resumed, TaskWorktrees } from '../hub/worktrees.ts';
import { ToolForbidden } from '../roles/permissions.ts';

export type SessionRequest =
  | { type: 'session.launch'; id: string; name: string; role?: string; model?: string; harness?: string; cwd?: string; effort?: string; item?: string; brief?: string }
  | { type: 'session.list'; id: string; archived?: boolean }
  | { type: 'session.attach'; id: string; session: string }
  | { type: 'session.archive'; id: string; session: string }
  | { type: 'session.prune'; id: string; olderThan: string; dryRun?: boolean }
  | { type: 'session.stop'; id: string; session: string }
  | { type: 'session.resume'; id: string; session: string; relaunch?: boolean; fresh?: boolean }
  | { type: 'session.retry'; id: string; session: string; message: string }
  | { type: 'session.signal'; id: string; session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> }
  | { type: 'session.bridge'; id: string; session: string; launch?: string };

/** Spoke session requests are still checked by the role permission table; stop/resume remain shell-only. */
export const SPOKE_SESSION_REQUESTS: ReadonlySet<string> = new Set(['session.launch', 'session.list', 'session.archive', 'session.prune']);

const optString = (v: unknown) => v === undefined || typeof v === 'string';

export function isSessionRequest(f: Record<string, unknown>): f is SessionRequest {
  if (typeof f.id !== 'string' || typeof f.type !== 'string' || !f.type.startsWith('session.')) return false;
  switch (f.type) {
    case 'session.launch':
      return typeof f.name === 'string' && optString(f.role) && optString(f.model) && optString(f.harness) && optString(f.cwd) && optString(f.effort) && optString(f.item) && optString(f.brief);
    case 'session.list':
      return f.archived === undefined || typeof f.archived === 'boolean';
    case 'session.prune':
      return typeof f.olderThan === 'string' && (f.dryRun === undefined || typeof f.dryRun === 'boolean');
    case 'session.attach':
    case 'session.archive':
    case 'session.stop':
      return typeof f.session === 'string';
    case 'session.bridge':
      return typeof f.session === 'string' && optString(f.launch);
    case 'session.resume':
      return typeof f.session === 'string' && (f.relaunch === undefined || typeof f.relaunch === 'boolean') && (f.fresh === undefined || typeof f.fresh === 'boolean');
    case 'session.retry':
      return typeof f.session === 'string' && typeof f.message === 'string';
    case 'session.signal':
      return (
        typeof f.event === 'string' &&
        optString(f.session) &&
        optString(f.sessionId) &&
        optString(f.launch) &&
        (f.at === undefined || typeof f.at === 'number') &&
        (f.payload === undefined || (typeof f.payload === 'object' && f.payload !== null))
      );
    default:
      return false;
  }
}

/** The transport side a bridge needs: send frames while open, and learn when the connection ends. */
export type BridgePeer = { send: (frame: HubFrame) => void; isOpen: () => boolean; onClose: (fn: () => void) => void };

/** Answer one session request; the result frame comes when the work is done (a launch waits for the harness). */
/** `resumed` times the synchronous lifecycle work after adapter or Git awaits: the hub's guard. */
export async function answerSession(sessions: Sessions | undefined, frame: SessionRequest, peer: BridgePeer, worktrees?: TaskWorktrees, resumed?: Resumed, authorize?: () => void, actor = 'human'): Promise<HubFrame> {
  const ok = (value: unknown): HubFrame => ({ type: 'result', id: frame.id, ok: true, value });
  if (!sessions) return { type: 'result', id: frame.id, ok: false, error: 'this hub launches no sessions (it serves no project)' };
  try {
    switch (frame.type) {
      case 'session.launch': {
        const request = {
          name: frame.name,
          ...(frame.role !== undefined ? { role: frame.role } : {}),
          ...(frame.model !== undefined ? { model: frame.model } : {}),
          ...(frame.harness !== undefined ? { harness: frame.harness } : {}),
          ...(frame.cwd !== undefined ? { cwd: frame.cwd } : {}),
          ...(frame.effort !== undefined ? { effort: frame.effort } : {}),
          ...(frame.brief !== undefined ? { brief: frame.brief } : {}),
        };
        if (frame.item === undefined) return ok({ process: await sessions.launch(request, resumed, authorize) });
        if (!worktrees) throw new Error('this hub has no tracker: a launch with an item needs a project');
        return ok(await worktrees.launch(sessions, { ...request, item: frame.item }, resumed, authorize));
      }
      case 'session.list':
        return ok({ processes: sessions.list(frame.archived ?? false), archived: sessions.archivedCount(), pendingStops: sessions.pendingStops(), adapters: sessions.capabilities(), coordinator: sessions.coordinator() });
      case 'session.attach':
        return ok({ command: sessions.attachCommand(frame.session) });
      case 'session.archive':
        return ok({ process: await sessions.archive(frame.session, actor, resumed, authorize) });
      case 'session.prune':
        authorize?.();
        return ok(sessions.prune(frame.olderThan, frame.dryRun ?? false));
      case 'session.stop':
        return ok({ process: await sessions.stop(frame.session, resumed, authorize) });
      case 'session.resume':
        return ok(await sessions.resume(frame.session, frame.relaunch ?? false, resumed, authorize, frame.fresh ?? false));
      case 'session.retry':
        return ok(sessions.retry(frame.session, frame.message));
      case 'session.signal':
        return ok(
          sessions.signal({
            event: frame.event,
            ...(frame.session !== undefined ? { session: frame.session } : {}),
            ...(frame.sessionId !== undefined ? { sessionId: frame.sessionId } : {}),
            ...(frame.launch !== undefined ? { launch: frame.launch } : {}),
            ...(frame.at !== undefined ? { at: frame.at } : {}),
            ...(frame.payload !== undefined ? { payload: frame.payload } : {}),
          }),
        );
      case 'session.bridge': {
        const disconnect = sessions.bridge(
          frame.session,
          (inject: InjectFrame) => {
            if (!peer.isOpen()) return false;
            peer.send(inject);
            return true;
          },
          frame.launch,
        );
        peer.onClose(disconnect);
        return ok({ bridged: true });
      }
    }
  } catch (err) {
    if (err instanceof ToolForbidden) return { type: 'result', id: frame.id, ok: false, error: err.message, code: 'forbidden', permission: err.permission, role: err.role, reason: err.reason };
    if (err instanceof InvalidLaunchCwd) return { type: 'result', id: frame.id, ok: false, error: err.message, code: 'invalid-cwd' };
    return { type: 'result', id: frame.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
