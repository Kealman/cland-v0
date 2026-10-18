import { sessionOf, type FrameActor } from '../../../shared/frame-actor.ts';
export { sessionOf, type FrameActor } from '../../../shared/frame-actor.ts';
// Who a `cland task` frame acts as (`as`): the launched session whose shell runs the CLI, else the human's `--as`.

/**
 * In a launched session's shell (`$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` set) it is always that session:
 * `--as` and `--role` cannot make it the human or another session, and naming another one only earns a note on
 * stderr; the hub checks the call by the session id. Outside a session (the human) `--as` names who the call is
 * written as and `--role` its role. What remains open: a shell that unsets both variables is the human's, as any
 * process holding the hub's socket is (the CLI's identity is its environment).
 */
/** What a frame says of its actor (`as`); `shell` marks the calling shell's own session, as against a name the human gave with `--as`. */
export function actorOf(values: { as?: unknown; role?: unknown }, env: NodeJS.ProcessEnv, io: { err: (s: string) => void }): FrameActor | undefined {
  const asFlag = typeof values.as === 'string' ? values.as.trim() : undefined;
  const session = sessionOf(env);
  if (session !== undefined) {
    // a session id alone: the name the flag gives is only a label, the hub goes by the id
    const name = env.CLAND_SESSION_NAME?.trim() ? session.name : (asFlag ?? session.name);
    if (asFlag !== undefined && asFlag !== name) io.err(`cland: --as ${JSON.stringify(asFlag)} ignored: this shell is session ${name}'s ($CLAND_SESSION_*), and acts as it\n`);
    return { ...session, name };
  }
  const role = (typeof values.role === 'string' ? values.role : env.CLAND_ROLE)?.trim();
  return asFlag ? { name: asFlag, ...(role ? { role } : {}) } : undefined;
}
