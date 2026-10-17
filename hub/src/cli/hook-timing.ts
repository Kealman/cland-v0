// Production reconnect grace; tests may shorten the real bridge lifecycle.
export const BRIDGE_GRACE_MS = 60_000;
export function bridgeGraceMs(env: NodeJS.ProcessEnv): number {
  const ms = Number(env.CLAND_TEST_BRIDGE_GRACE_MS);
  return Number.isFinite(ms) && ms > 0 ? ms : BRIDGE_GRACE_MS;
}
