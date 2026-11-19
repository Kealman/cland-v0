// T2 CLI module boundary. Native binary contracts retain the normal CLI helpers.
import { fixtureLockIdentity, type CliResult } from './harness.ts';
import { runHub } from '../src/cli/hub.ts';
import { captureCli } from './cli-in-process.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

let tail: Promise<unknown> = Promise.resolve();
let context: { env: NodeJS.ProcessEnv; identity: ReturnType<typeof fixtureLockIdentity>; pending: number } | undefined;

/** Capture before sealing; share one environment owner across component commands. */
export async function withFixtureCli<T>(cwd: string, env: Record<string, string>, run: (identity: ReturnType<typeof fixtureLockIdentity>) => Promise<T>): Promise<T> {
  // Capture admission context before an earlier call can install its sealed env.
  // Overlapping callers share the original context and serialize global ownership.
  const captured = context ??= { env: process.env, identity: fixtureLockIdentity(process.env), pending: 0 };
  captured.pending++;
  const running = tail.then(async () => {
    process.env = fixtureEnvironment(cwd, captured.env, {
      // A mocked cold spawn acquires its embedded hub inside this same scope.
      ...env, CLAND_TEST_LOCK_IDENTITY: JSON.stringify(captured.identity),
    });
    try { return await run(captured.identity); }
    finally { process.env = captured.env; }
  });
  tail = running.catch(() => {});
  try { return await running; }
  finally { if (--captured.pending === 0) context = undefined; }
}

export const runFixtureHub: typeof runHub = async (args, cwd, io) => {
  if (!['start', 'status'].includes(args[0] ?? '')) throw new Error('fixture CLI supports start/status only');
  if (!cwd) throw new Error('fixture CLI requires a disposable project root');
  return withFixtureCli(cwd, {}, identity => runHub(args, cwd, io, { hostIdentity: identity }));
};

/** Sealed CLI module invocation for component tests observing hub status. */
export async function fixtureHubCommand(root: string, ...args: string[]): Promise<CliResult> {
  return captureCli(write => runFixtureHub(args, root, { out: write, err: write }));
}
