// The adapters a project's hub runs with, built in one place so the daemon only plugs them in.
// Timings come from the environment, for tests: CLAND_ADAPTER_POLL_MS (the polled fallback and the liveness
// check), CLAND_INJECT_TIMEOUT_MS (how long an inject waits for its confirmation), CLAND_PUSH_TRUST_MS (how
// long a hook's signal outranks a poll), CLAND_STOP_GRACE_MS (how long a Claude Code stop waits for the pid to go,
// per step). CLAND_CLAUDE_BIN names the `claude` executable, CLAND_OPENCODE_BIN the `opencode` one,
// CLAND_CODEX_BIN the `codex` one.
import { fileURLToPath } from 'node:url';
import type { HubCore } from '../hub/core.ts';
import type { LogFn } from '../log.ts';
import { ClaudeCodeAdapter } from './claude-code.ts';
import { CodexAdapter } from './codex.ts';
import { OpenCodeAdapter } from './opencode.ts';
import { ProcessTable } from './processes.ts';
import { Sessions } from './sessions.ts';

export const CLI_ENTRY = fileURLToPath(new URL('../../bin/cland.ts', import.meta.url));
export const SPOKE_ENTRY = fileURLToPath(new URL('../../bin/cland-spoke.ts', import.meta.url));

const positive = (raw: string | undefined): number | undefined => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export type ProjectSessions = { sessions: Sessions; close: () => void };

export function projectSessions(options: { core: HubCore; root: string; db: string; discoveryFile: string; log: LogFn; env?: NodeJS.ProcessEnv }): ProjectSessions {
  const env = options.env ?? process.env;
  const table = new ProcessTable(options.db);
  const pushTrustMs = positive(env.CLAND_PUSH_TRUST_MS);
  const sessions = new Sessions({ core: options.core, table, root: options.root, log: options.log, ...(pushTrustMs ? { pushTrustMs } : {}) });
  const host = sessions.host({ discoveryFile: options.discoveryFile, node: process.execPath, cli: CLI_ENTRY, spoke: SPOKE_ENTRY });
  const pollMs = positive(env.CLAND_ADAPTER_POLL_MS);
  const injectTimeoutMs = positive(env.CLAND_INJECT_TIMEOUT_MS);
  const stopGraceMs = positive(env.CLAND_STOP_GRACE_MS);
  sessions.register(
    new ClaudeCodeAdapter(host, {
      ...(env.CLAND_CLAUDE_BIN ? { bin: env.CLAND_CLAUDE_BIN } : {}),
      ...(pollMs ? { pollMs } : {}),
      ...(injectTimeoutMs ? { injectTimeoutMs } : {}),
      ...(stopGraceMs ? { stopGraceMs } : {}),
      env,
    }),
  );
  sessions.register(
    new OpenCodeAdapter(host, {
      ...(env.CLAND_OPENCODE_BIN ? { bin: env.CLAND_OPENCODE_BIN } : {}),
      ...(pollMs ? { pollMs } : {}),
      ...(injectTimeoutMs ? { injectTimeoutMs } : {}),
      env,
    }),
  );
  sessions.register(
    new CodexAdapter(host, {
      ...(env.CLAND_CODEX_BIN ? { bin: env.CLAND_CODEX_BIN } : {}),
      ...(pollMs ? { pollMs } : {}),
      ...(injectTimeoutMs ? { injectTimeoutMs } : {}),
      env,
    }),
  );
  return {
    sessions,
    close: () => {
      sessions.close();
      table.close();
    },
  };
}
