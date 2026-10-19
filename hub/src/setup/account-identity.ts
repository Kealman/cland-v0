// Display identity through vendor commands; credentials and identity are never persisted by setup.
import { spawn } from 'node:child_process';
import { AppServerClient } from '../adapters/codex/app-server.ts';
import { run } from '../doctor/report.ts';
import { realClock, type ClockTimer } from '../hub/clock.ts';
import { VERSION } from '../version.ts';
import type { CodexTrustDependencies } from './codex-trust.ts';

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
const label = (value: unknown): string => typeof value === 'string' ? value.replace(/[\r\n\x00-\x1f\x7f]/g, ' ') : '';

export async function readClaudeIdentity(bin: string, env: NodeJS.ProcessEnv, probe: typeof run = run): Promise<string | null> {
  const receipt = await probe(bin, ['auth', 'status', '--json'], env);
  if (receipt.error) throw new Error('Claude Code account status could not be read');
  let status: Record<string, unknown>;
  try { status = object(JSON.parse(receipt.stdout)); }
  catch { throw new Error('Claude Code account status was not JSON'); }
  if (status.loggedIn !== true) return null;
  return [label(status.email) || 'signed in', label(status.orgName)].filter(Boolean).join(' — ');
}

/** The deadline covers initialization and the read; cleanup always kills the detached process group. */
export async function readCodexIdentity(bin: string, env: NodeJS.ProcessEnv, deps: CodexTrustDependencies = {}): Promise<string | null> {
  const clock = deps.clock ?? realClock;
  const child = (deps.spawn ?? spawn)(bin, ['app-server'], { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const failed = new Promise<never>((_, reject) => {
    child.once('error', reject);
    child.once('close', () => reject(new Error('Codex account app-server closed')));
  });
  let client: Awaited<ReturnType<NonNullable<CodexTrustDependencies['connect']>>> | undefined;
  let timer: ClockTimer | undefined;
  let finished = false;
  const connecting = Promise.resolve().then(() => (deps.connect ?? ((output, input) => AppServerClient.connectStdio(output, input, { client: { name: 'cland-setup', version: VERSION }, timeoutMs: 15_000 })))(child.stdout, child.stdin)).then(value => {
    if (finished) value.close();
    return value;
  });
  try {
    const deadline = new Promise<never>((_, reject) => { timer = clock.setTimeout(() => reject(new Error('Codex account app-server timed out')), 15_000); });
    client = await Promise.race([connecting, failed, deadline]);
    const response = object(await Promise.race([client.request('account/read', { refreshToken: false }), failed, deadline]));
    const account = object(response.account);
    return response.account == null ? null : label(account.email) || 'signed in';
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
        await Promise.race([closed, new Promise<never>((_, reject) => { cleanup = clock.setTimeout(() => reject(new Error('Codex account app-server did not close after SIGKILL')), 2000); })]);
      } finally { clock.clearTimeout(cleanup); }
    }
  }
}

export const accountIdentity = (harness: 'claude-code' | 'codex', bin: string, env: NodeJS.ProcessEnv): Promise<string | null> =>
  harness === 'claude-code' ? readClaudeIdentity(bin, env) : readCodexIdentity(bin, env);
