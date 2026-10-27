// Authorization fixtures assume an authenticated caller. Authentication itself is
// covered through unmodified clients in cli-session-credential.test.ts.
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type { Store } from '../src/hub/store.ts';
import { cland, clandWithEnv, connectUi, connectWsUi, dispatcherUi, type FrameClient } from './harness.ts';

type CredentialStore = Pick<Store, 'sessionIdOf' | 'roleOf' | 'sessionCredential' | 'rememberSessionCredential'>;

function credentialFor(store: CredentialStore, actor: Record<string, unknown>): Record<string, unknown> {
  const name = typeof actor.name === 'string' ? actor.name : '';
  const id = typeof actor.sessionId === 'string' ? actor.sessionId : store.sessionIdOf(name);
  if (!id && store.roleOf(name) === null) return actor;
  // Provisional-name tests deliberately have no stable id yet; do not adopt it here.
  const sessionId = id ?? 'unknown';
  let credential = store.sessionCredential(sessionId);
  if (credential === null) {
    store.rememberSessionCredential(sessionId, randomUUID());
    credential = store.sessionCredential(sessionId);
  }
  return { ...actor, credential };
}

function actorCredential(source: string | Store, actor: Record<string, unknown>): Record<string, unknown> {
  if (actor.credential !== undefined) return actor;
  if (typeof source !== 'string') return credentialFor(source, actor);
  // The hub owns schema/migrations. A second full Store can request the WAL
  // writer while the fixture has SIGSTOPped that very owner (T-1335).
  // Existing credentials need reads only, even while that writer stays held.
  const projectDb = join(source, '.cland/hub.db');
  const db = new DatabaseSync(existsSync(projectDb) ? projectDb : join(source, 'hub.db'));
  try {
    db.exec('pragma busy_timeout = 5000');
    const read = (sql: string, key: string): string | null => {
      const value = db.prepare(sql).get(key)?.value;
      return typeof value === 'string' ? value : null;
    };
    return credentialFor({
      sessionIdOf: name => read('select session_id as value from sessions where name = ?', name),
      roleOf: name => read('select role as value from sessions where name = ?', name),
      sessionCredential: id => read('select credential as value from session_credentials where session_id = ?', id),
      rememberSessionCredential: (id, credential) => {
        // Another fixture reader or the hub may have provisioned it meanwhile.
        db.prepare('insert into session_credentials (session_id, credential) values (?, ?) on conflict (session_id) do nothing').run(id, credential);
      },
    }, actor);
  } finally { db.close(); }
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
