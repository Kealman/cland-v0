// Who a `cland task` frame acts as (`as`): the launched session whose shell runs the CLI, else the human's `--as`.

/**
 * In a launched session's shell (`$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` set) it is always that session:
 * `--as` and `--role` cannot make it the human or another session, and naming another one only earns a note on
 * stderr; the hub checks the call by the session id. Outside a session (the human) `--as` names who the call is
 * written as and `--role` its role. What remains open: a shell that unsets both variables is the human's, as any
 * process holding the hub's socket is (the CLI's identity is its environment).
 */
export function actorOf(values: { as?: unknown; role?: unknown }, env: NodeJS.ProcessEnv, io: { err: (s: string) => void }): { name: string; role?: string; sessionId?: string } | undefined {
  const envName = env.CLAND_SESSION_NAME?.trim() || undefined;
  const envId = env.CLAND_SESSION_ID?.trim() || undefined;
  const asFlag = typeof values.as === 'string' ? values.as.trim() : undefined;
  if (envName !== undefined || envId !== undefined) {
    const name = envName ?? asFlag ?? 'session';
    if (asFlag !== undefined && asFlag !== name) io.err(`cland: --as ${JSON.stringify(asFlag)} ignored: this shell is session ${name}'s ($CLAND_SESSION_*), and acts as it\n`);
    const role = env.CLAND_ROLE?.trim();
    return { name, ...(role ? { role } : {}), ...(envId ? { sessionId: envId } : {}) };
  }
  const role = (typeof values.role === 'string' ? values.role : env.CLAND_ROLE)?.trim();
  return asFlag ? { name: asFlag, ...(role ? { role } : {}) } : undefined;
}

/**
 * The session whose shell this is, from `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` (the adapters set both in a
 * launched session's shell), or undefined in the human's. Every frame the CLI sends carries it as `as`, so the hub
 * answers the call as that session's: what only the human may do is refused, and the audit names the session.
 */
export function sessionOf(env: NodeJS.ProcessEnv): { name: string; role?: string; sessionId?: string } | undefined {
  const name = env.CLAND_SESSION_NAME?.trim() || undefined;
  const sessionId = env.CLAND_SESSION_ID?.trim() || undefined;
  if (name === undefined && sessionId === undefined) return undefined;
  const role = env.CLAND_ROLE?.trim();
  return { name: name ?? 'session', ...(role ? { role } : {}), ...(sessionId ? { sessionId } : {}) };
}
