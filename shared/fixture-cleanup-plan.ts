/** Names select census rows only; they never confer deletion authority. */
export const fixturePatterns = {
  socket: '^cland-h-[a-f0-9]{20}$', alias: '^ct-[a-f0-9]{32}$',
  host: '^hc-[A-Za-z0-9]+$', suite: '^cland-suite-[A-Za-z0-9-]+$',
  account: '^cland-account-fixture-[A-Za-z0-9]+$',
};
export function fixtureClass(name: string): string | undefined {
  return Object.entries(fixturePatterns).find(([, pattern]) => new RegExp(pattern).test(name))?.[0];
}
export type AliasClosure = {
  version: 1; boundary: 'listeners-peers-children-drained'; path: string; target: string;
  alias: { dev: number; ino: number }; storage: { dev: number; ino: number };
};
export function planFixtureEntry(name: string, proof: AliasClosure | null) {
  return fixtureClass(name) === 'alias' && proof
    ? { eligible: true, reason: 'positive alias closure proof' }
    : { eligible: false, reason: 'no positive alias closure proof' };
}
