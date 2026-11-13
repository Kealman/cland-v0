/** Only identities returned by login.add/signin; answers never enter this store.
 * Tab storage survives a view remount and reload, scoped by the hub origin. */
const key = 'cland.hosts.signin-cards.v1';
export function readSignInCards(): Record<string, string> {
  try {
    const rows: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    if (!Array.isArray(rows)) return {};
    return Object.fromEntries(rows.filter((row): row is [string, string] =>
      Array.isArray(row) && row.length === 2 && row.every(value => typeof value === 'string')));
  } catch { return {}; }
}
export function writeSignInCards(cards: Record<string, string>): void {
  try { sessionStorage.setItem(key, JSON.stringify(Object.entries(cards))); }
  catch { /* Unavailable storage must not prevent the active view's sign-in. */ }
}
