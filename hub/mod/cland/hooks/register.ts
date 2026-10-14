// The cland mod (spec 4.3, 4.9): loaded with `--plugin-dir` into every Claude Code session the hub launches.
// It does nothing in a session cland did not launch (no CLAND_SESSION_NAME).
//
//   inject  a bridge to the hub (`cland hook bridge`, a child process) prints each message for this session;
//           the mod submits it with `$.prompt.submit` — a turn of its own once the session is idle — and,
//           once it entered the session, confirms it (`cland hook injected`): the hub's stage `injected`.
//           A message asked for again (a retry) is never submitted twice.
//   state   `turn.start` and `turn.complete` (which fires on an interrupt too, where the Stop hook does not)
//           are posted as `cland hook mod-turn-start` / `mod-turn-complete`, the latter with the turn's usage.
//
// Its configuration is the session's environment, set by the adapter through `--settings` (`env`):
// CLAND_SESSION_NAME, CLAND_HUB_FILE, CLAND_NODE, CLAND_CLI, and CLAND_SESSION_ID: the launch this session is,
// which every signal and the bridge name (the hub ignores an earlier launch under the same name).
import type { EngineInterface as Engine, Register } from 'claude-code';

type Config = { name: string; hubFile: string; node: string; cli: string; launch: string | null };

let config: Config | null = null;
/** What this module submitted, by hub message id: a retry waits on the same submission and confirms again. */
const submitted = new Map<string, Promise<boolean>>();

async function readConfig($: Engine): Promise<Config | null> {
  let name: string | undefined = await $.env.get('CLAND_SESSION_NAME');
  let hubFile: string | undefined = await $.env.get('CLAND_HUB_FILE');
  let node: string | undefined = await $.env.get('CLAND_NODE');
  let cli: string | undefined = await $.env.get('CLAND_CLI');
  let launch: string | undefined = await $.env.get('CLAND_SESSION_ID');
  if (!name || !hubFile || !node || !cli || !launch) {
    // the variables `--settings` declared, read from the settings when the process environment lacks them
    const settings = await $.settings.read();
    const env = (settings?.env ?? {}) as Record<string, string | undefined>;
    name ||= env.CLAND_SESSION_NAME;
    hubFile ||= env.CLAND_HUB_FILE;
    node ||= env.CLAND_NODE;
    cli ||= env.CLAND_CLI;
    launch ||= env.CLAND_SESSION_ID;
  }
  return name && hubFile && node && cli ? { name, hubFile, node, cli, launch: launch ?? null } : null;
}

/** The arguments every `cland hook` call of this session carries. */
const hookArgs = (c: Config): string[] => ['--session', c.name, ...(c.launch ? ['--launch', c.launch] : []), '--hub-file', c.hubFile];

/** `cland hook <event>` with the payload on stdin; never throws. */
async function post($: Engine, c: Config, event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await $.process.run([c.node, c.cli, 'hook', event, ...hookArgs(c)], { stdin: JSON.stringify(payload), timeoutMs: 15_000 });
  } catch {
    /* the hub is away; the next signal or the poll catches up */
  }
}

function inject($: Engine, c: Config, frame: { message: string; text: string }): void {
  let submission = submitted.get(frame.message);
  if (!submission) {
    // framed as the plugin's (not `asUser`): a message from the hub is not the person's own words
    submission = Promise.resolve($.prompt.submit({ text: frame.text })).then(
      (result) => result.drop === undefined,
      () => false,
    );
    submitted.set(frame.message, submission);
  }
  void submission.then((entered) => {
    if (entered) void post($, c, 'injected', { message: frame.message });
    else submitted.delete(frame.message);
  });
}

/** The bridge for the session's life: restarted when it ends, gone with the module. */
async function bridge($: Engine, c: Config): Promise<void> {
  for (;;) {
    let buffer = '';
    try {
      const child = $.process.spawn({ argv: [c.node, c.cli, 'hook', 'bridge', ...hookArgs(c)] });
      for await (const chunk of child) {
        if (chunk.stream !== 'stdout') continue;
        buffer += chunk.text;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let frame: { type?: string; message?: unknown; text?: unknown };
          try {
            frame = JSON.parse(line);
          } catch {
            continue;
          }
          if (frame.type === 'inject' && typeof frame.message === 'string' && typeof frame.text === 'string') inject($, c, { message: frame.message, text: frame.text });
        }
      }
    } catch {
      /* could not start, or ended: start it again */
    }
    await $.clock.sleep(1000);
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e);
    config = await readConfig($);
    if (config) void bridge($, config);
    return started;
  });

  // each signal carries the time of its event: the hub orders a session's signals by it, and `cland hook`
  // starts as a process of its own, later by an unknown delay
  on('turn.start', async ($, e, next) => {
    const at = Date.now();
    const started = await next(e);
    if (config) void post($, config, 'mod-turn-start', { at, text: e.text, turnId: e.turnId });
    return started;
  });

  on('session.measure', async ($, e, next) => {
    const at = Date.now();
    const measured = await next(e);
    if (config && e.changed.includes('rateLimits')) void post($, config, 'mod-measure', { at, rateLimits: e.rateLimits?.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })) ?? [] });
    return measured;
  });

  on('turn.complete', async ($, e, next) => {
    const at = Date.now();
    const completed = await next(e);
    // a subagent's loop is not the session's turn
    if (config && e.agentId === undefined) void post($, config, 'mod-turn-complete', { at, isAborted: e.isAborted, reason: e.reason, ...(e.usage ? { usage: e.usage } : {}) });
    return completed;
  });
};
