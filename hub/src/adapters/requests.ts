// The `session.*` frames: launching and managing harness sessions (UI, CLI, spokes), and the signals and
// bridge that come from inside a launched session (`cland hook`). Called from the dispatcher.
//
//   session.launch  {name, role?, model?, harness?, cwd?, effort?} → {process}   anyone may launch until #30; a role's
//                                                              launch defaults (roles.toml) fill what is not given
//   session.list    {}                                         → {processes, adapters: {<harness>: capabilities}, coordinator}
//   session.attach  {session}                                  → {command}
//   session.stop    {session}                                  → {process}
//   session.resume  {session, relaunch?}                       → {found, reason?, process}
//   session.signal  {session?, sessionId?, launch?, event, at?, payload?} → {applied, state?}   clients only (`cland hook`)
//   session.bridge  {session, launch?}                         → {bridged: true}, then `inject` frames  clients only
//
// `launch` is the cland session id the launch gave the session's hooks and mod: a signal or bridge of an
// earlier launch under the same name is ignored or refused.
import type { HubFrame } from '../protocol.ts';
import type { InjectFrame } from './contract.ts';
import type { Sessions } from './sessions.ts';

export type SessionRequest =
  | { type: 'session.launch'; id: string; name: string; role?: string; model?: string; harness?: string; cwd?: string; effort?: string }
  | { type: 'session.list'; id: string }
  | { type: 'session.attach'; id: string; session: string }
  | { type: 'session.stop'; id: string; session: string }
  | { type: 'session.resume'; id: string; session: string; relaunch?: boolean }
  | { type: 'session.signal'; id: string; session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> }
  | { type: 'session.bridge'; id: string; session: string; launch?: string };

/** What a spoke may ask: launching is open to every session until permissions (#30); the rest is the UI's and the hooks'. */
export const SPOKE_SESSION_REQUESTS: ReadonlySet<string> = new Set(['session.launch', 'session.list']);

const optString = (v: unknown) => v === undefined || typeof v === 'string';

export function isSessionRequest(f: Record<string, unknown>): f is SessionRequest {
  if (typeof f.id !== 'string' || typeof f.type !== 'string' || !f.type.startsWith('session.')) return false;
  switch (f.type) {
    case 'session.launch':
      return typeof f.name === 'string' && optString(f.role) && optString(f.model) && optString(f.harness) && optString(f.cwd) && optString(f.effort);
    case 'session.list':
      return true;
    case 'session.attach':
    case 'session.stop':
      return typeof f.session === 'string';
    case 'session.bridge':
      return typeof f.session === 'string' && optString(f.launch);
    case 'session.resume':
      return typeof f.session === 'string' && (f.relaunch === undefined || typeof f.relaunch === 'boolean');
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
export async function answerSession(sessions: Sessions | undefined, frame: SessionRequest, peer: BridgePeer): Promise<HubFrame> {
  const ok = (value: unknown): HubFrame => ({ type: 'result', id: frame.id, ok: true, value });
  if (!sessions) return { type: 'result', id: frame.id, ok: false, error: 'this hub launches no sessions (it serves no project)' };
  try {
    switch (frame.type) {
      case 'session.launch':
        return ok({
          process: await sessions.launch({
            name: frame.name,
            ...(frame.role !== undefined ? { role: frame.role } : {}),
            ...(frame.model !== undefined ? { model: frame.model } : {}),
            ...(frame.harness !== undefined ? { harness: frame.harness } : {}),
            ...(frame.cwd !== undefined ? { cwd: frame.cwd } : {}),
            ...(frame.effort !== undefined ? { effort: frame.effort } : {}),
          }),
        });
      case 'session.list':
        return ok({ processes: sessions.list(), adapters: sessions.capabilities(), coordinator: sessions.coordinator() });
      case 'session.attach':
        return ok({ command: sessions.attachCommand(frame.session) });
      case 'session.stop':
        return ok({ process: await sessions.stop(frame.session) });
      case 'session.resume':
        return ok(await sessions.resume(frame.session, frame.relaunch ?? false));
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
    return { type: 'result', id: frame.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
