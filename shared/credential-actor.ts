// Client-side session credential projection shared by CLI requests and the mod bridge.
import { dirname, join } from 'node:path';
import { sessionOf } from './frame-actor.ts';
import { readSessionCredential } from './session-credential.ts';
import { hubDiscovery } from './project-discovery.ts';
export function clientSessionCredential(discovery: { root?: string; socket: string }, env: NodeJS.ProcessEnv) {
  const actor = sessionOf(env);
  const directory = discovery.root ? join(discovery.root, '.cland') : dirname(hubDiscovery(process.cwd(), env));
  return env.CLAND_LAUNCH_TOKEN ?? (actor?.sessionId ? readSessionCredential(directory, actor.sessionId) : undefined);
}
export function credentialActor(discovery: { root?: string; socket: string }, env: NodeJS.ProcessEnv) {
  const actor = sessionOf(env);
  if (!actor) return undefined;
  const credential = clientSessionCredential(discovery, env);
  return credential === undefined ? undefined : { ...actor, credential };
}
