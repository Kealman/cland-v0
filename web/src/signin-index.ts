import type { AskCard } from '../../shared/wire/index.ts';

const empty: ReadonlyMap<string, string> = new Map();

/** Update from one admitted card delta; retained card history is never scanned.
 * Copies, when needed, contain only current active sign-in identities. */
export function updateSignInIndex(index: ReadonlyMap<string, string> | undefined, id: string, previous: AskCard | undefined, card: AskCard): ReadonlyMap<string, string> {
  const before = index ?? empty, oldLogin = previous?.signInLogin, login = card.signInLogin;
  const remove = oldLogin !== undefined && before.get(oldLogin) === id && (card.state !== 'open' || login !== oldLogin);
  const add = card.state === 'open' && login !== undefined && before.get(login) !== id;
  if (!remove && !add) return before;
  const next = new Map(before);
  if (remove) next.delete(oldLogin!);
  if (add) next.set(login!, id);
  return next;
}

export function signInCardId(state: { signInCards?: ReadonlyMap<string, string> }, login: string): string | undefined {
  return state.signInCards?.get(login);
}
