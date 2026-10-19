// Folder trust uses Codex's own config writer; every short-lived server owns a process group.
import type { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { AppServerClient } from '../adapters/codex/app-server.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';
import { VERSION } from '../version.ts';

type TrustClient = { request(method: string, params: Record<string, unknown>): Promise<unknown>; close(): void };
type TrustProcess = Pick<ChildProcessWithoutNullStreams, 'pid' | 'stdin' | 'stdout' | 'stderr'> & Pick<EventEmitter, 'once'>;
export type CodexTrustDependencies = {
  spawn?: (bin: string, args: string[], options: { env: NodeJS.ProcessEnv; detached: true; stdio: ['pipe', 'pipe', 'pipe'] }) => TrustProcess;
  connect?: (output: TrustProcess['stdout'], input: TrustProcess['stdin']) => Promise<TrustClient>;
  kill?: typeof process.kill;
  clock?: Clock;
};

/** One batch per profile; the deadline also bounds an initialization that never answers. */
export async function grantCodexTrust(bin: string, env: NodeJS.ProcessEnv, keys: readonly string[], deps: CodexTrustDependencies = {}): Promise<void> {
  const clock = deps.clock ?? realClock;
  const child = (deps.spawn ?? spawn)(bin, ['app-server'], { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const failed = new Promise<never>((_, reject) => child.once('error', reject));
  let client: TrustClient | undefined;
  let timer: ClockTimer | undefined;
  let finished = false;
  const connecting = Promise.resolve().then(() => (deps.connect ?? ((output, input) => AppServerClient.connectStdio(output, input, { client: { name: 'cland-setup', version: VERSION }, timeoutMs: 15_000 })))(child.stdout, child.stdin)).then(value => {
    // A connection completing after a process error/deadline must not retain its streams.
    if (finished) value.close();
    return value;
  });
  try {
    const deadline = new Promise<never>((_, reject) => { timer = clock.setTimeout(() => reject(new Error('Codex trust app-server timed out')), 15_000); });
    client = await Promise.race([connecting, failed, deadline]);
    await Promise.race([client.request('config/batchWrite', { edits: keys.map(key => ({ keyPath: `projects.${JSON.stringify(key)}.trust_level`, value: 'trusted', mergeStrategy: 'replace' })) }), failed, deadline]);
  } finally {
    finished = true;
    clock.clearTimeout(timer);
    try { client?.close(); }
    finally {
      if (child.pid !== undefined) {
        try { (deps.kill ?? process.kill)(-child.pid, 'SIGKILL'); }
        catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err; }
      }
      let cleanup: ClockTimer | undefined;
      try {
        await Promise.race([closed, new Promise<never>((_, reject) => { cleanup = clock.setTimeout(() => reject(new Error('Codex trust app-server did not close after SIGKILL')), 2000); })]);
      } finally { clock.clearTimeout(cleanup); }
    }
  }
}
