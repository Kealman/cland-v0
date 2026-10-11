// What `cland doctor` reports: one check per line, a verdict, what was found, and for anything not ok the fix.
// Plain text by default (pasteable into an item comment); colour only on a terminal; JSON for scripts and tests.
import { spawn } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

export type Verdict = 'ok' | 'warn' | 'fail';

export type Check = {
  /** A stable name: `claude-code`, `claude-code auth`, `hub`, `roles.toml`, … */
  name: string;
  verdict: Verdict;
  /** What was found. */
  detail: string;
  /** What to do about it; set on every warn and fail. */
  fix?: string;
};

export const ok = (name: string, detail: string): Check => ({ name, verdict: 'ok', detail });
export const warn = (name: string, detail: string, fix: string): Check => ({ name, verdict: 'warn', detail, fix });
export const fail = (name: string, detail: string, fix: string): Check => ({ name, verdict: 'fail', detail, fix });

export type Summary = Record<Verdict, number>;

export const summarise = (checks: readonly Check[]): Summary => {
  const s: Summary = { ok: 0, warn: 0, fail: 0 };
  for (const c of checks) s[c.verdict]++;
  return s;
};

const COLOUR: Record<Verdict, string> = { ok: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m' };

/** The report as text: a header, one line per check, a total. `colour` only for a terminal. */
export function render(checks: readonly Check[], header: string, colour: boolean): string {
  const width = Math.max(...checks.map((c) => c.name.length));
  const lines = [header];
  for (const c of checks) {
    const verdict = c.verdict.padEnd(4);
    const shown = colour ? `${COLOUR[c.verdict]}${verdict}\x1b[0m` : verdict;
    lines.push(`${shown}  ${c.name.padEnd(width)}  ${c.detail}${c.fix ? ` — fix: ${c.fix}` : ''}`);
  }
  const s = summarise(checks);
  lines.push(`${s.ok} ok, ${s.warn} warn, ${s.fail} fail`);
  return `${lines.join('\n')}\n`;
}

// ------------------------------------------------------------------ running what is checked

export type RunResult = { code: number | null; stdout: string; stderr: string; error?: string };

/** A probe's deadline: `fallbackMs`, or `CLAND_DOCTOR_PROBE_TIMEOUT_MS` (tests that fake a tool that never answers). */
export const probeTimeout = (env: NodeJS.ProcessEnv, fallbackMs: number): number => {
  const n = Number(env.CLAND_DOCTOR_PROBE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : fallbackMs;
};

/**
 * Run `bin args`, never throwing: a missing binary, a crash or the timeout come back as `error`.
 * Stdin is closed unless explicitly inherited for a tty inspection.
 * The child leads its own process group: past the deadline the whole group is killed and the pipes are closed, so a
 * grandchild holding stdout open (a wrapper script's real tool) neither outlives the check nor keeps it waiting.
 */
export function run(bin: string, args: readonly string[], env: NodeJS.ProcessEnv, timeoutMs = probeTimeout(env, 20_000), inheritStdin = false): Promise<RunResult> {
  return new Promise((done) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(r);
    };
    let child;
    try {
      child = spawn(bin, args, { env, stdio: [inheritStdin ? 0 : 'ignore', 'pipe', 'pipe'], detached: true });
    } catch (err) {
      finish({ code: null, stdout, stderr, error: err instanceof Error ? err.message : String(err) });
      return;
    }
    timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
      finish({ code: null, stdout, stderr, error: `no answer within ${timeoutMs / 1000} s` });
    }, timeoutMs);
    child.stdout?.setEncoding('utf8').on('data', (c: string) => (stdout += c));
    child.stderr?.setEncoding('utf8').on('data', (c: string) => (stderr += c));
    child.on('error', (err) => finish({ code: null, stdout, stderr, error: err.message }));
    child.on('close', (code) => finish({ code, stdout, stderr }));
  });
}

const executable = (path: string): boolean => {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** Where `name` resolves: a path (absolute or relative to `cwd`) as given, else the first executable on `PATH`; null when none. */
export function which(name: string, env: NodeJS.ProcessEnv, cwd: string = process.cwd()): string | null {
  if (name.includes('/')) {
    const path = isAbsolute(name) ? name : resolve(cwd, name);
    return executable(path) ? path : null;
  }
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const path = join(dir, name);
    if (executable(path)) return path;
  }
  return null;
}

/** The first non-empty line of a command's output, for a detail. */
export const firstLine = (text: string): string => text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
