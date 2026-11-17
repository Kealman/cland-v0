// T2 CLI module boundary. Native binary contracts retain the normal CLI helpers.
import { fixtureLockIdentity, type CliResult } from './harness.ts';
import { runHub } from '../src/cli/hub.ts';
import { captureCli } from './cli-in-process.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

let tail: Promise<unknown> = Promise.resolve();
let context: { env: NodeJS.ProcessEnv; identity: ReturnType<typeof fixtureLockIdentity>; pending: number } | undefined;

/** Start/status retain production formatting, discovery and socket requests. */
export const runFixtureHub: typeof runHub = async (args, cwd, io) => {
  if (!['start', 'status'].includes(args[0] ?? '')) throw new Error('fixture CLI supports start/status only');
  if (!cwd) throw new Error('fixture CLI requires a disposable project root');
  // Capture admission context before an earlier call can install its sealed env.
  // Overlapping callers share the original context and serialize global ownership.
  const captured = context ??= { env: process.env, identity: fixtureLockIdentity(process.env), pending: 0 };
  captured.pending++;
  const running = tail.then(async () => {
    process.env = fixtureEnvironment(cwd, captured.env, {
      // A mocked cold spawn acquires its embedded hub inside this same scope.
      CLAND_TEST_LOCK_IDENTITY: JSON.stringify(captured.identity),
    });
    try { return await runHub(args, cwd, io, { hostIdentity: captured.identity }); }
    finally { process.env = captured.env; }
  });
  tail = running.catch(() => {});
  try { return await running; }
  finally { if (--captured.pending === 0) context = undefined; }
};

/** Sealed CLI module invocation for component tests observing hub status. */
export async function fixtureHubCommand(root: string, ...args: string[]): Promise<CliResult> {
  return captureCli(write => runFixtureHub(args, root, { out: write, err: write }));
}
