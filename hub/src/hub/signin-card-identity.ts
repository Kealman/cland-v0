import type { AskCard } from '../protocol.ts';
import type { AskRow } from './store.ts';

/** Project only the login name from the hub's persisted sign-in card payload.
 * Wire fields, display prose and other native metadata grant no association. */
export function signInCardIdentity(row: Pick<AskRow, 'from' | 'hubKind' | 'payload'>): Pick<AskCard, 'signInLogin'> {
  if (row.from !== 'hub' || row.hubKind !== 'login-signin-code' || !row.payload
    || typeof row.payload !== 'object' || Array.isArray(row.payload) || !Object.hasOwn(row.payload, 'login')) return {};
  const login = (row.payload as { login: unknown }).login;
  return typeof login === 'string' && login.length > 0 ? { signInLogin: login } : {};
}
