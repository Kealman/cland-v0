import type { DatabaseSync } from 'node:sqlite';
// The adapters a project's hub runs with, built in one place so the daemon only plugs them in.
// Timings come from the environment, for tests: CLAND_ADAPTER_POLL_MS (the polled fallback and the liveness
// check; Claude's CLI interval is CLAND_CLAUDE_AGENTS_MS, default 30 s), CLAND_INJECT_TIMEOUT_MS (how long an inject waits for its confirmation), CLAND_PUSH_TRUST_MS (how
// long a hook's signal outranks a poll; Claude busy polls remain subordinate after any push), CLAND_STOP_GRACE_MS (how long a stop waits for the process tree to go,
// per step). CLAND_CLAUDE_BIN names the `claude` executable, CLAND_OPENCODE_BIN the `opencode` one,
// CLAND_CODEX_BIN the `codex` one.
import type { AdapterHost, HarnessAdapter } from './contract.ts';
import type { Clock } from '../hub/clock.ts';
import { fileURLToPath } from 'node:url';
import type { HubCore } from '../hub/core.ts';
import type { LogFn } from '../log.ts';
import { ClaudeCodeAdapter } from './claude-code.ts';
import { CodexAdapter } from './codex.ts';
import { OpenCodeAdapter } from './opencode.ts';
import { ProcessTable } from './processes.ts';
import { Sessions } from './sessions.ts';
import type { Tracker } from '../tracker/tracker.ts';
import type { ProjectConfig } from '../init/config.ts';

export const CLI_ENTRY = fileURLToPath(new URL('../../bin/cland.ts', import.meta.url));
export const SPOKE_ENTRY = fileURLToPath(new URL('../../bin/cland-spoke.ts', import.meta.url));

const positive = (raw: string | undefined): number | undefined => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export type AdapterFactory = (host: AdapterHost, clock: Clock) => HarnessAdapter;

export type ProjectSessions = { sessions: Sessions; close: () => void | Promise<void> };

export function projectSessions(options: { transportClock?: Clock; openDatabase?: (path: string) => DatabaseSync; core: HubCore; root: string; db?: string; adapters?: AdapterFactory[]; discoveryFile: string; log: LogFn; env?: NodeJS.ProcessEnv; tracker?: Tracker | undefined; cleanup?: ProjectConfig['sessions'] | undefined }): ProjectSessions {
  const env = options.env ?? process.env;
  const table = new ProcessTable(options.db, options.core.clock, options.openDatabase);
  const pushTrustMs = positive(env.CLAND_PUSH_TRUST_MS);
  const sessions = new Sessions({ ...(options.transportClock ? { transportClock: options.transportClock } : {}), env, core: options.core, table, root: options.root, log: options.log, tracker: options.tracker, cleanup: options.cleanup, ...(pushTrustMs ? { pushTrustMs } : {}) });
  const host = sessions.host({ discoveryFile: options.discoveryFile, node: process.execPath, cli: CLI_ENTRY, spoke: SPOKE_ENTRY });
  // Factories may own resources before registration. Keep ownership through every failure boundary.
  const unregistered = new Set<HarnessAdapter>();
  const own = (adapter: HarnessAdapter) => { unregistered.add(adapter); return adapter; };
  const register = (adapter: HarnessAdapter) => {
    unregistered.delete(adapter);
    sessions.register(adapter);
  };
  const close = (): void | Promise<void> => {
    const failures: unknown[] = [];
    const drains: Promise<void>[] = [];
    const retain = (drain: void | Promise<void>) => { if (drain) drains.push(drain.catch(error => { failures.push(error); })); };
    try { retain(sessions.close()); } catch (error) { failures.push(error); }
    for (const adapter of unregistered) {
      try { retain(adapter.close()); } catch (error) { failures.push(error); }
    }
    unregistered.clear();
    const finish = () => {
      try { table.close(); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, 'adapter cleanup failed');
    };
    if (drains.length) return Promise.all(drains).then(finish);
    finish();
  };

  try {
    const pollMs = positive(env.CLAND_ADAPTER_POLL_MS);
    const reexecGraceMs = positive(env.CLAND_TEST_CLAUDE_REEXEC_GRACE_MS);
    const claudeAgentsMs = positive(env.CLAND_CLAUDE_AGENTS_MS);
    const injectTimeoutMs = positive(env.CLAND_INJECT_TIMEOUT_MS);
    const stopGraceMs = positive(env.CLAND_STOP_GRACE_MS);
    const replacements = new Map<string, HarnessAdapter>();
    for (const factory of options.adapters ?? []) {
      const adapter = own(factory(host, options.core.clock));
      if (replacements.has(adapter.harness)) throw new Error(`duplicate adapter replacement: ${adapter.harness}`);
      replacements.set(adapter.harness, adapter);
    }
    register(replacements.get('claude-code') ?? own(new ClaudeCodeAdapter(host, {
      clock: options.core.clock,
      ...(env.CLAND_CLAUDE_BIN ? { bin: env.CLAND_CLAUDE_BIN } : {}),
      ...(pollMs ? { pollMs } : {}),
      ...(reexecGraceMs ? { reexecGraceMs } : {}),
      ...(claudeAgentsMs ? { agentsMs: claudeAgentsMs } : {}),
      ...(injectTimeoutMs ? { injectTimeoutMs } : {}),
      ...(stopGraceMs ? { stopGraceMs } : {}),
      env,
    })));
    register(replacements.get('opencode') ?? own(new OpenCodeAdapter(host, {
      roleInstructions: env.CLAND_OPENCODE_ROLE_INSTRUCTIONS !== '0',
      ...(stopGraceMs ? { stopGraceMs } : {}),
      ...(env.CLAND_OPENCODE_BIN ? { bin: env.CLAND_OPENCODE_BIN } : {}),
      ...(pollMs ? { pollMs } : {}),
      ...(injectTimeoutMs ? { injectTimeoutMs } : {}),
      env,
    })));
    register(replacements.get('codex') ?? own(new CodexAdapter(host, {
      ...(stopGraceMs ? { stopGraceMs } : {}),
      ...(env.CLAND_CODEX_BIN ? { bin: env.CLAND_CODEX_BIN } : {}),
      ...(pollMs ? { pollMs } : {}),
      ...(injectTimeoutMs ? { injectTimeoutMs } : {}),
      env,
    })));
    for (const adapter of replacements.values()) {
      if (!['claude-code', 'codex', 'opencode'].includes(adapter.harness)) register(adapter);
    }
    // All adapters and core capabilities precede durable launch recovery.
    sessions.releaseInterruptedLaunches();
    return { sessions, close };
  } catch (error) {
    try {
      const draining = close();
      if (draining) void draining.catch(() => options.log({ event: 'adapter-construction-cleanup-failed' }));
    }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'adapter construction and cleanup failed'); }
    throw error;
  }
}
