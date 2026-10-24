// The Claude Code hooks in the project's `.claude/settings.json` (spec 4.9, decision #17), merged into whatever the
// file already holds. Each cland entry is one hook whose command ends in the mark (`# managed by cland <v>`, a shell
// comment), which is how `cland update` finds and replaces them. The other managed key is worktree.bgIsolation:
// "none" lets Claude Code 2.1.143+ background sessions edit the project's working copy without EnterWorktree.
// `update` restores it; a human can override it in settings.local.json, which cland never reads or writes.
// Every other hook and setting, including other worktree keys, is left as it is.
//
// What a hook runs is `cland hook <event>` found on the PATH: no machine path in a committed file. It does nothing
// in a session the hub launched (CLAND_SESSION_NAME is set there): that session already has the same hooks,
// with its name and hub file, injected at launch with `--settings`, along with the cland mod (`--plugin-dir`) and
// the spoke. The project hooks are for a session the human starts by hand, and do nothing when `cland` is not on
// the PATH. The mod is not provisioned into the project: it needs the session's identity, which only a launch has.
import { join } from 'node:path';
import { BG_ISOLATION, HOOK_EVENTS } from '../adapters/claude-code.ts';
import { MANAGED_BY } from '../project.ts';
import { readText, writeIfChanged, type Report } from './files.ts';

type Hook = { type?: string; command?: string; [k: string]: unknown };
type Entry = { matcher?: string; hooks?: Hook[]; [k: string]: unknown };

/** The command one project hook runs. */
export const hookCommand = (event: string): string => `[ -n "$CLAND_SESSION_NAME" ] || ! command -v cland >/dev/null 2>&1 || cland hook ${event} # ${MANAGED_BY}`;

const isOurs = (h: Hook): boolean => typeof h.command === 'string' && /# managed by cland\b/.test(h.command);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The settings with every cland hook replaced by the current ones; everything else as it was, in its order. */
export function mergeHooks(settings: Record<string, unknown>): Record<string, unknown> {
  const hooks: Record<string, unknown> = isRecord(settings.hooks) ? { ...settings.hooks } : {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const kept: unknown[] = [];
    let changed = false;
    for (const entry of entries as unknown[]) {
      if (!isRecord(entry) || !Array.isArray((entry as Entry).hooks)) {
        kept.push(entry);
        continue;
      }
      const own = ((entry as Entry).hooks as Hook[]).filter((h) => !isRecord(h) || !isOurs(h));
      if (own.length === ((entry as Entry).hooks as Hook[]).length) kept.push(entry);
      else {
        changed = true;
        if (own.length) kept.push({ ...entry, hooks: own });
      }
    }
    if (changed && kept.length === 0) delete hooks[event];
    else hooks[event] = kept;
  }
  for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
    const entries = Array.isArray(hooks[hookEvent]) ? (hooks[hookEvent] as unknown[]) : [];
    // The Bash guard must finish before the tool runs; signal hooks stay async.
    hooks[hookEvent] = [...entries, { ...(hookEvent === 'PreToolUse' ? { matcher: 'Bash' } : {}), hooks: [{ type: 'command', command: hookCommand(event), ...(hookEvent === 'PreToolUse' ? {} : { async: true }), timeout: 10 }] }];
  }
  return { ...settings, hooks };
}

/** Set cland's background isolation policy while preserving the project's other worktree settings. */
export function mergeWorktree(settings: Record<string, unknown>): Record<string, unknown> {
  const worktree = isRecord(settings.worktree) ? settings.worktree : {};
  return { ...settings, worktree: { ...worktree, bgIsolation: BG_ISOLATION } };
}

/** Merge the cland hooks and worktree policy into `.claude/settings.json`; write only when content changes. */
export function provisionClaudeSettings(report: Report, root: string): void {
  const path = join(root, '.claude', 'settings.json');
  const current = readText(path);
  let settings: Record<string, unknown> = {};
  if (current !== null && current.trim() !== '') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(current);
    } catch (err) {
      report.add(path, 'kept', `not valid JSON (${err instanceof Error ? err.message : String(err)}): no hooks added`);
      return;
    }
    if (!isRecord(parsed)) {
      report.add(path, 'kept', 'not a JSON object: no hooks added');
      return;
    }
    settings = parsed;
  }
  const merged = mergeWorktree(mergeHooks(settings));
  // the same content in the project's own formatting is left byte for byte
  if (current !== null && current.trim() !== '' && JSON.stringify(merged) === JSON.stringify(settings)) {
    report.add(path, 'unchanged');
    return;
  }
  writeIfChanged(report, path, `${JSON.stringify(merged, null, 2)}\n`, current);
}
