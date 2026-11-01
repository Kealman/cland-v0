// Compatibility for standalone adapters whose AdapterHost predates Host lookup.
// Production Sessions supplies Host lookup. Synthetic process options retain this
// legacy edge for existing component fixtures on local only.
import { execFile } from 'node:child_process';
import type { HostCommand, HostRunResult } from '../host/host.ts';

import { localHost } from '../host/local.ts';
import { processStarted, processAlive, pidAlive as nativePidAlive } from './processes.ts';
import { processIdentityAsync } from '../process-identity.ts';
import type { ClaudeCodeOptions } from './claude-code.ts';

export function claudeLocalRun(command: HostCommand): Promise<HostRunResult> {
  return new Promise((resolve) => {
    const cancel = () => { child.kill('SIGKILL'); };
    const child = execFile(command.command, [...command.args], { cwd: command.cwd, env: command.env, encoding: 'utf8', timeout: command.timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      command.signal?.removeEventListener('abort', cancel);
      resolve({ code: err ? typeof err.code === 'number' ? err.code : null : 0, stdout, stderr, ...(err && typeof err.code !== 'number' ? { error: err.message } : {}) });
    });
    command.signal?.addEventListener('abort', cancel, { once: true });
    if (command.signal?.aborted) cancel();
  });
}

/** Compatibility for synthetic standalone fixtures; production selects the session Host. */
export function claudeLocalHost(options: ClaudeCodeOptions, log: (entry: Record<string, unknown>) => void) {
  const env = options.env ?? process.env;
  const started = options.processStarted ?? ((pid: number) => processStarted(pid, undefined, undefined, undefined, env));
  const identity = options.processIdentity ?? (options.processStarted ? async () => null : (pid: number) => processIdentityAsync(pid, env, (pid, error) => log({ event: 'native-identity-unavailable', harness: 'claude-code', pid, error })));
  const pidAlive = options.pidAlive ?? nativePidAlive;
  return { ...localHost(env, log), run: claudeLocalRun,
    identity: async (pid: number) => ({ pid, pidStarted: await started(pid), pidIdentity: await identity(pid) }),
    alive: (p: import('../host/host.ts').HostProcess) => !p.pidStarted && !p.pidIdentity
      ? Promise.resolve(p.pid !== null && pidAlive(p.pid))
      : processAlive({ pid: p.pid, pidStarted: p.pidStarted ?? null, pidIdentity: p.pidIdentity ?? null }, undefined, env, started, options.processStarted || options.processIdentity ? identity : undefined),
  };
}
