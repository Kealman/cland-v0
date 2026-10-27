// Authorization fixtures assume an authenticated caller. Authentication itself is
// covered through unmodified clients in cli-session-credential.test.ts.
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { cland, clandWithEnv, connectUi, connectWsUi, dispatcherUi, type FrameClient } from './harness.ts';

function actorCredential(source: string | Store, actor: Record<string, unknown>): Record<string, unknown> {
  if (actor.credential !== undefined) return actor;
  // Bare socket fixtures keep their owned database directly below the scratch root.
  const projectDb = typeof source === 'string' ? join(source, '.cland/hub.db') : '';
  // T-1335: this second connection can overlap the live hub's startup writes.
  const store = typeof source === 'string' ? new Store(existsSync(projectDb) ? projectDb : join(source, 'hub.db'),
    path => new DatabaseSync(path, { timeout: 10_000 })) : source;
  try {
    const name = typeof actor.name === 'string' ? actor.name : '';
    const id = typeof actor.sessionId === 'string' ? actor.sessionId : store.sessionIdOf(name);
    if (!id && store.roleOf(name) === null) return actor;
    // Provisional-name tests deliberately have no stable id yet; do not adopt it here.
    const sessionId = id ?? 'unknown';
    const credential = store.sessionCredential(sessionId) ?? randomUUID();
    store.rememberSessionCredential(sessionId, credential);
    return { ...actor, credential };
  } finally { if (typeof source === 'string') store.close(); }
}

export function sessionClient(ui: FrameClient, source: string | Store): FrameClient {
  const request = ui.request;
  const authenticated = <T extends Record<string, unknown>>(frame: T): T => frame.as && typeof frame.as === 'object'
    ? { ...frame, as: actorCredential(source, frame.as as Record<string, unknown>) } : frame;
  return { ...ui, request: (frame, timeout) => request(authenticated(frame), timeout), send: frame => ui.send(authenticated(frame)) };
}

/** Opt in only for permission/dispatch tests whose caller authentication is fixture setup. */
export const sessionUi: typeof connectUi = async (t, discovery, ...rest) => sessionClient(await connectUi(t, discovery, ...rest), discovery.root!);
export const sessionDispatcherUi: typeof dispatcherUi = async (t, dispatcher, root) => sessionClient(await dispatcherUi(t, dispatcher, root), root);

export function sessionShell(root: string, env: Record<string, string>): Record<string, string> {
  if (env.CLAND_LAUNCH_TOKEN !== undefined || (!env.CLAND_SESSION_NAME && !env.CLAND_SESSION_ID)) return env;
  const actor = actorCredential(root, { name: env.CLAND_SESSION_NAME, ...(env.CLAND_SESSION_ID ? { sessionId: env.CLAND_SESSION_ID } : {}) });
  return { ...env, ...(typeof actor.credential === 'string' ? { CLAND_LAUNCH_TOKEN: actor.credential } : {}) };
}

export const sessionClandWithEnv: typeof clandWithEnv = (root, env, ...args) => {
  if (!env.CLAND_SESSION_NAME && !env.CLAND_SESSION_ID) {
    const index = args.indexOf('--as');
    const name = index >= 0 ? args[index + 1] : undefined;
    if (name) {
      const actor = actorCredential(root, { name });
      if (typeof actor.credential === 'string') env = { ...env, CLAND_SESSION_NAME: name, CLAND_LAUNCH_TOKEN: actor.credential };
    }
  }
  return clandWithEnv(root, sessionShell(root, env), ...args);
};

/** Known --as labels in authorization fixtures carry the same synthetic shell authority. */
export const sessionCland: typeof cland = (root, ...args) => sessionClandWithEnv(root, {}, ...args);

export const sessionWsUi: typeof connectWsUi = async (t, hub, client) => {
  const store = (hub as { core?: { store: Store } }).core?.store;
  if (!store) throw new Error('an authenticated socket fixture needs its owned core store');
  return sessionClient(await connectWsUi(t, hub, client), store);
};
