export type FrameActor = { name: string; role?: string; sessionId?: string; shell?: true };

/**
 * The session whose shell this is, from `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` (the adapters set both in a
 * launched session's shell), or undefined in the human's. Every frame the CLI sends carries it as `as`, so the hub
 * answers the call as that session's: what only the human may do is refused, and the audit names the session.
 * `shell` tells the hub the identity is the caller's own: one it does not know is a roleless session, never the human.
 */
export function sessionOf(env: NodeJS.ProcessEnv): FrameActor | undefined {
  const name = env.CLAND_SESSION_NAME?.trim() || undefined;
  const sessionId = env.CLAND_SESSION_ID?.trim() || undefined;
  if (name === undefined && sessionId === undefined) return undefined;
  const role = env.CLAND_ROLE?.trim();
  return { name: name ?? 'session', ...(role ? { role } : {}), ...(sessionId ? { sessionId } : {}), shell: true };
}

