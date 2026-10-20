import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
// `cland --headless --qa <case.lua> [--out <dir>]`: one scripted QA case in one headless Neovim with no
// socket (spec 4.10, #57). The case runs inside Neovim through the Lua QA API (`nvim/lua/cland/qa.lua`),
// against a fixture project in the temp dir with its own stdio hub (`cland hub serve --stdio --no-listen`)
// or the stub hub, never the live project. This side starts Neovim with a pinned environment, waits for
// the case's result, prints it as one JSON line and exits with its code; nothing is left running.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { ensureNvim, NVIM_DIR, REPO_ROOT } from '../../../nvim/bin/nvim-path.ts';
import { VERSION } from '../version.ts';

const SYNOPSIS = 'usage: cland --headless --qa <case.lua> [--out <dir>] [--hub stdio|stub] [--timeout <seconds>]';

import { QA_USAGE } from './usage.ts';
export { QA_USAGE } from './usage.ts';

export type QaResult = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'BLOCKED';
const EXIT: Record<QaResult, number> = { PASS: 0, FAIL: 1, INCONCLUSIVE: 2, BLOCKED: 2 };
const RESULTS = Object.keys(EXIT);

/** The line the case's Neovim prints on stdout when it is done. */
const RESULT_MARK = 'CLAND-QA-RESULT ';
const DEFAULT_TIMEOUT_S = 120;
/** How long Neovim has to leave once it printed the result, before what is left of it is killed. */
const QUIT_GRACE_MS = 3000;
/** The longest timer Node keeps: a longer one would fire at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** The terminal, the locale and the zone every run sees, whatever the caller's are. */
const PINNED = { TERM: 'xterm-256color', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC', SHELL: '/bin/sh' };

type Options = { caseFile: string; out: string | null; hub: 'stdio' | 'stub' | null; timeoutMs: number };

function parse(args: string[]): Options | string {
  let caseFile: string | null = null;
  let out: string | null = null;
  let hub: Options['hub'] = null;
  let timeoutMs = DEFAULT_TIMEOUT_S * 1000;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    const value = (): string | null => {
      const v = args[++i];
      return v === undefined || v.startsWith('--') ? null : v;
    };
    if (a === '--headless') continue;
    if (a === '--qa') {
      caseFile = value();
      if (caseFile === null) return '--qa needs a case file';
    } else if (a === '--out') {
      out = value();
      if (out === null) return '--out needs a directory';
    } else if (a === '--hub') {
      const v = value();
      if (v !== 'stdio' && v !== 'stub') return '--hub is stdio or stub';
      hub = v;
    } else if (a === '--timeout') {
      const seconds = Number(value());
      if (!(seconds > 0 && seconds * 1000 <= MAX_TIMEOUT_MS)) return `--timeout needs a number of seconds, at most ${Math.floor(MAX_TIMEOUT_MS / 1000)}`;
      timeoutMs = seconds * 1000;
    } else return `unknown argument "${a}"`;
  }
  if (caseFile === null) return '--headless needs --qa <case.lua>';
  return { caseFile, out, hub, timeoutMs };
}

/** The build under test: the repository's commit, else the version. */
function build(): string {
  const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const sha = git.status === 0 ? git.stdout.trim() : '';
  return sha || `v${VERSION}`;
}

/** A directory of the run's own in the temp dir, or null where nothing may be written (a read-only run). */
function runDir(): string | null {
  try {
    return mkdtempSync(join(realpathSync(tmpdir()), 'cland-qa-'));
  } catch {
    return null;
  }
}

type Said = { result: QaResult; message?: unknown; hub?: unknown; evidence?: unknown };

/** What the case's Neovim said on stdout: its last marked line, when it names a result. */
function resultOf(stdout: string): Said | null {
  const line = stdout.split('\n').findLast((l) => l.startsWith(RESULT_MARK));
  if (line === undefined) return null;
  try {
    const said = JSON.parse(line.slice(RESULT_MARK.length)) as Said;
    return RESULTS.includes(said.result) ? said : null;
  } catch {
    return null;
  }
}

const tail = (text: string, lines = 15): string => text.trim().split('\n').slice(-lines).join('\n');

/**
 * Kill what is left of the Neovim's process group (it leads one): the hub it spawned. A terminal's job is a
 * session of its own: Neovim stops it when it quits, and the terminal closing hangs it up otherwise.
 */
function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // nothing is left
  }
}

export async function runQa(args: string[], cwd: string = process.cwd()): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${SYNOPSIS}\n\n${QA_USAGE}`);
    return 0;
  }
  const options = parse(args);
  if (typeof options === 'string') {
    process.stderr.write(`cland: ${options}\n\n${SYNOPSIS}\n\n${QA_USAGE}`);
    return 2;
  }
  const started = Date.now();
  const caseFile = resolve(cwd, options.caseFile);
  const name = basename(caseFile).replace(/\.lua$/, '');
  const out = options.out === null ? null : resolve(cwd, options.out);
  const report = (result: QaResult, rest: Record<string, unknown>): number => {
    process.stdout.write(`${JSON.stringify({ case: name, result, duration_ms: Date.now() - started, build: build(), ...rest })}\n`);
    return EXIT[result];
  };
  const blocked = (message: string): number => report('BLOCKED', { ...(options.hub !== null ? { hub: options.hub } : {}), message, evidence: out === null ? {} : [] });

  if (!existsSync(caseFile)) return blocked(`no case file ${caseFile}`);
  let nvim: string;
  try {
    nvim = await ensureNvim(process.env, (s) => process.stderr.write(`${s}\n`));
  } catch (err) {
    return blocked(`no Neovim to run the case with: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (out !== null) {
    try {
      mkdirSync(out, { recursive: true });
    } catch (err) {
      return blocked(`cannot create ${out}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const dir = runDir();
  // nothing of the user's: an environment of its own, every Neovim and XDG path inside the run's directory
  const home = dir ?? '/var/empty';
  const env: Record<string, string> = {
    ...PINNED,
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: join(home, 'home'),
    XDG_CONFIG_HOME: join(home, 'xdg', 'config'),
    XDG_DATA_HOME: join(home, 'xdg', 'data'),
    XDG_STATE_HOME: join(home, 'xdg', 'state'),
    XDG_CACHE_HOME: join(home, 'xdg', 'cache'),
    XDG_RUNTIME_DIR: join(home, 'xdg', 'run'),
    NVIM_APPNAME: 'cland-qa',
    NVIM_LOG_FILE: '/dev/null',
    CLAND_NODE: process.execPath,
    CLAND_QA_CASE: caseFile,
    CLAND_QA_NAME: name,
    CLAND_QA_TMP: dir ?? '',
    CLAND_QA_OUT: out ?? '',
    CLAND_QA_HUB: options.hub ?? '',
  };
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;

  // detached: Neovim leads a process group of its own, so whatever it leaves is found and killed
  const child = spawn(nvim, ['--clean', '-u', join(NVIM_DIR, 'init.lua'), '--headless'], { cwd: dir ?? '/', env: withoutExecutorCredentials(env), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let quitting: NodeJS.Timeout | null = null;
  child.stdout.setEncoding('utf8').on('data', (c: string) => {
    stdout += c;
    // the case is done: a Neovim that then does not quit is not waited for until the timeout
    if (quitting === null && resultOf(stdout) !== null) quitting = setTimeout(() => killGroup(child.pid), QUIT_GRACE_MS);
  });
  child.stderr.setEncoding('utf8').on('data', (c: string) => (stderr = (stderr + c).slice(-16_384)));
  // what ends the run before the case does: its timeout, or a signal to this process (Neovim would not get
  // it, in a group of its own)
  let ended: string | null = null;
  const end = (why: string) => {
    ended ??= why;
    killGroup(child.pid);
  };
  const timer = setTimeout(() => end(`the run did not finish within ${options.timeoutMs / 1000} s`), options.timeoutMs);
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
  const onSignal = (signal: NodeJS.Signals) => end(`interrupted by ${signal}`);
  for (const signal of signals) process.on(signal, onSignal);
  process.stderr.write('cland: QA run started\n');
  const exit = await new Promise<string>((done) => {
    child.on('error', (err) => done(`cannot start ${nvim}: ${err.message}`));
    // whatever Neovim left holds its pipes open: it goes first
    child.on('exit', () => killGroup(child.pid));
    child.on('close', (code, signal) => done(signal ? `signal ${signal}` : `code ${code}`));
  });
  clearTimeout(timer);
  if (quitting !== null) clearTimeout(quitting);
  for (const signal of signals) process.off(signal, onSignal);
  if (dir !== null) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch (err) {
      // the result stands; the directory is named for whoever cleans up
      process.stderr.write(`cland: could not remove ${dir}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  const said = ended === null ? resultOf(stdout) : null;
  if (said === null) {
    const why = ended ?? `Neovim ended (${exit}) without a result`;
    return blocked(`${why}${stderr.trim() ? `:\n${tail(stderr)}` : ''}`);
  }
  // dump files are named the way --out was given
  const asGiven = (p: unknown): unknown => (out !== null && typeof p === 'string' && p.startsWith(out + sep) ? `${(options.out as string).replace(/\/+$/, '')}${p.slice(out.length)}` : p);
  const evidence = Array.isArray(said.evidence) ? said.evidence.map(asGiven) : said.evidence;
  return report(said.result, { hub: said.hub, ...(said.message !== undefined ? { message: said.message } : {}), evidence });
}
