// The machine's side of `cland doctor`: the three harnesses (installed, version in the tested range, signed in),
// `gh` (installed, signed in) and the pinned Neovim. Everything is asked of the tools themselves, through their own
// non-interactive commands; nothing is started that outlives the check.
//
//   Claude Code  `claude --version`; `claude auth status --json` → `{"loggedIn": true, "authMethod": …}`
//   Codex        `codex --version`; `codex login status` → exit 0 and "Logged in using …"
//   OpenCode     `opencode --version`; `opencode auth list --standalone --format json` → the providers with
//                credentials (`--standalone`: a private server for the call, not the background service)
//   gh           `gh --version`; `gh auth status` → exit 0
//   Neovim       `CLAND_NVIM`, else the pinned release in the launcher's cache; `<nvim> --version`
import { findNvim, NVIM_VERSION } from '../../../nvim/bin/nvim-path.ts';
import { fail, firstLine, ok, run, warn, which, type Check } from './report.ts';
import { compareVersions, formatRange, formatVersion, inRange, parseVersion, TESTED_RANGES, type Version } from './ranges.ts';
import { accountEnvironment, accountLocation, clandOpenCodeDatabase, openCodeDatabase, openCodeLogin, readAccounts } from '../accounts/registry.ts';
import { realpath } from 'node:fs/promises';
import { HARNESS_INSTALLATIONS, harnessInstallation, type HarnessInstallation } from './harnesses.ts';
import { basename, dirname, join, resolve } from 'node:path';

type Harness = HarnessInstallation & {
  /** The auth probe: its arguments and how to read its result. */
  auth: { args: string[]; read: (r: { code: number | null; stdout: string; stderr: string }) => Check; };
};

const authName = (id: string) => `${id} auth`;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const HARNESSES: readonly Harness[] = [
  {
    ...HARNESS_INSTALLATIONS['claude-code'],
    auth: {
      args: ['auth', 'status', '--json'],
      read: (r) => {
        const name = authName('claude-code');
        // not JSON: read the exit code
        const status = parseJson(r.stdout) as { loggedIn?: unknown; authMethod?: unknown } | null;
        if (status && typeof status.loggedIn === 'boolean') {
          return status.loggedIn ? ok(name, `logged in${typeof status.authMethod === 'string' ? ` (${status.authMethod})` : ''}`) : fail(name, 'not logged in', 'claude auth login');
        }
        if (r.code === 0) return ok(name, firstLine(r.stdout) || 'logged in');
        return fail(name, firstLine(r.stderr || r.stdout) || `claude auth status exited ${r.code}`, 'claude auth login');
      },
    },
  },
  {
    ...HARNESS_INSTALLATIONS['codex'],
    auth: {
      args: ['login', 'status'],
      read: (r) => {
        const said = firstLine(r.stdout || r.stderr);
        return r.code === 0 ? ok(authName('codex'), said || 'logged in') : fail(authName('codex'), said || `codex login status exited ${r.code}`, 'codex login');
      },
    },
  },
  {
    ...HARNESS_INSTALLATIONS['opencode'],
    auth: {
      args: ['auth', 'list', '--standalone', '--format', 'json'],
      read: (r) => {
        const name = authName('opencode');
        const v = parseJson(r.stdout);
        const providers = Array.isArray(v) ? (v as Array<{ id?: unknown; name?: unknown }>) : null;
        if (r.code !== 0 || providers === null) return warn(name, `cannot check: \`opencode auth list\` gave ${r.code !== 0 ? `exit ${r.code}` : 'no JSON list'}${firstLine(r.stderr) ? ` (${firstLine(r.stderr)})` : ''}`, 'opencode auth list, by hand');
        if (providers.length === 0) return warn(name, 'no credentials: only the free OpenCode models are usable', 'opencode auth login');
        const names = providers.map((p) => String(p.name ?? p.id ?? '?'));
        return ok(name, `credentials for ${names.join(', ')}`);
      },
    },
  },
];

/** OpenCode follows 2.x; another major cannot speak the adapter's v2 API. */
function checkOpenCodeVersion(version: Version, bin: string): Check {
  const range = TESTED_RANGES.opencode;
  const found = `${formatVersion(version)} at ${bin}`;
  const tested = `tested range ${formatRange(range)}`;
  if (version[0] < 2) return fail('opencode', `${found}: OpenCode v2 is required (${tested})`, 'opencode upgrade --major');
  if (version[0] > 2) return fail('opencode', `${found}: unsupported major; refusing compatibility (${tested})`, `install OpenCode ${formatVersion(range.min)} (https://opencode.ai/v2/install)`);
  if (inRange(version, range)) return ok('opencode', `${found} (tested ${formatRange(range)})`);
  return warn('opencode', `${found}, ${compareVersions(version, range.below) >= 0 ? 'newer than tested' : 'older than tested'} (${tested}); cland follows OpenCode 2.x`, `if a session misbehaves, install ${formatVersion(range.min)} or report it`);
}

/** One harness: `<id>` (installed, version, range) and `<id> auth`. */
async function checkHarness(h: Harness, env: NodeJS.ProcessEnv): Promise<Check[]> {
  const range = TESTED_RANGES[h.id];
  const { bin, missing } = await harnessInstallation(h.id, env);
  if (!bin) return [missing!, fail(authName(h.id), 'not checked: not installed', `install ${h.bin} first`)];
  const out: Check[] = [];
  const database = clandOpenCodeDatabase(env);
  const probeEnv = h.id === 'opencode' ? accountEnvironment(env, { OPENCODE_DB: database }) : env;
  const v = await run(bin, ['--version'], probeEnv);
  const version = v.error === undefined && v.code === 0 ? parseVersion(v.stdout || v.stderr) : null;
  if (v.error !== undefined || v.code !== 0) out.push(fail(h.id, `${bin} --version failed: ${v.error ?? (firstLine(v.stderr) || `exit ${v.code}`)}`, `reinstall ${h.bin}`));
  else if (!version) out.push(warn(h.id, `${bin}: cannot read a version from "${firstLine(v.stdout)}"; cland is tested with ${formatRange(range)}`, `check ${h.bin} --version by hand`));
  else if (h.id === 'opencode') {
    out.push(checkOpenCodeVersion(version, bin));
    if (version[0] !== 2) return [...out, warn(authName(h.id), 'not checked: incompatible OpenCode major', 'install OpenCode v2 first')];
  }
  else if (!inRange(version, range)) {
    const newer = version[0] > range.below[0] || (version[0] === range.below[0] && version[1] >= range.below[1]);
    out.push(warn(h.id, `${formatVersion(version)} at ${bin}, outside the tested range ${formatRange(range)}`, newer ? `it may work; if a session misbehaves, install ${formatVersion(range.min)} or report it` : `upgrade ${h.bin} to ${formatVersion(range.min)} or later`));
  } else out.push(ok(h.id, `${formatVersion(version)} at ${bin} (tested ${formatRange(range)})`));
  const a = await run(bin, h.auth.args, probeEnv);
  if (a.error !== undefined) out.push(warn(authName(h.id), `cannot check: ${h.bin} ${h.auth.args.join(' ')}: ${a.error}`, `run ${h.bin} ${h.auth.args.join(' ')} by hand`));
  else {
    const check = h.auth.read(a);
    if (h.id === 'opencode' && check.fix) check.fix = openCodeLogin(database);
    out.push(check);
  }
  return out;
}

/** Database paths are shared with launch selection; credentials are never inspected here. */
async function checkOpenCodeDatabases(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const database = clandOpenCodeDatabase(env);
  const out = [ok('opencode database', `${database}; no login needed for the free default opencode/big-pickle (fresh database tested on 2.0.24); paid providers need the standalone login into cland's database: ${openCodeLogin(database)}`)];
  const registry = await readAccounts(env);
  if (registry.error) return [...out, warn('opencode databases', registry.error, `repair ${registry.registry}`)];
  // Canonicalise existing parents as well, so a symlinked account still warns before its database exists.
  const canonical = async (path: string): Promise<string> => {
    try { return await realpath(path); }
    catch {
      const absolute = resolve(path);
      const parent = dirname(absolute);
      if (parent === absolute) return absolute;
      return join(await canonical(parent), basename(absolute));
    }
  };
  const defaults = await Promise.all([openCodeDatabase({ ...env, OPENCODE_DB: '' }), openCodeDatabase(env)].map(canonical));
  for (const account of registry.accounts.filter(a => a.harness === 'opencode')) {
    const { variable, path } = accountLocation(account, env);
    const selected = openCodeDatabase({ HOME: env.HOME, [variable]: path });
    const name = `opencode database ${account.name}`;
    const detail = `${selected}; login: ${openCodeLogin(selected)}`;
    out.push(defaults.includes(await canonical(selected))
      ? warn(name, `${detail}; OpenCode's background service can resume this account's running sessions`, 'choose a separate data_home or db in the accounts registry')
      : ok(name, detail));
  }
  return out;
}

async function checkGh(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const bin = which('gh', env);
  if (!bin) return [fail('gh', '`gh` is not on the PATH', 'install the GitHub CLI (https://cli.github.com)'), fail('gh auth', 'not checked: gh is not installed', 'install gh first')];
  const v = await run(bin, ['--version'], env);
  const version = parseVersion(v.stdout);
  const out: Check[] = [v.code === 0 && version ? ok('gh', `${formatVersion(version)} at ${bin}`) : fail('gh', `${bin} --version failed: ${v.error ?? (firstLine(v.stderr) || `exit ${v.code}`)}`, 'reinstall gh')];
  const a = await run(bin, ['auth', 'status'], env);
  // gh writes its status to stdout or stderr depending on the version
  const said = `${a.stdout}\n${a.stderr}`;
  const account = /Logged in to (\S+) account (\S+)/.exec(said);
  if (a.code === 0) out.push(ok('gh auth', account ? `logged in to ${account[1]} as ${account[2]}` : firstLine(said) || 'logged in'));
  else out.push(fail('gh auth', a.error ?? (firstLine(said) || `gh auth status exited ${a.code}`), 'gh auth login'));
  return out;
}

async function checkNvim(env: NodeJS.ProcessEnv): Promise<Check> {
  const fetch = 'run `cland open` (its launcher downloads and verifies the pinned build), or set CLAND_NVIM to a Neovim binary';
  const bin = findNvim(env);
  if (!bin) {
    if (env.CLAND_NVIM) return fail('neovim', `CLAND_NVIM names ${env.CLAND_NVIM}, which does not exist`, `point CLAND_NVIM at a Neovim ${NVIM_VERSION} binary, or unset it to use the pinned build`);
    return fail('neovim', `the pinned standalone build ${NVIM_VERSION} is not downloaded`, fetch);
  }
  const v = await run(bin, ['--version'], env);
  const said = firstLine(v.stdout);
  if (v.code !== 0 || v.error !== undefined) return fail('neovim', `${bin} --version failed: ${v.error ?? (firstLine(v.stderr) || `exit ${v.code}`)}`, env.CLAND_NVIM ? 'fix or unset CLAND_NVIM' : `remove ${bin}'s folder, then ${fetch}`);
  const found = /NVIM\s+(v\S+)/.exec(said)?.[1] ?? said;
  if (found !== NVIM_VERSION) {
    return env.CLAND_NVIM
      ? warn('neovim', `CLAND_NVIM is ${found} at ${bin}; cland pins ${NVIM_VERSION}`, `point CLAND_NVIM at Neovim ${NVIM_VERSION}, or unset it to use the pinned build`)
      : fail('neovim', `${bin} is ${found}, not the pinned ${NVIM_VERSION}`, `remove ${bin}'s folder, then ${fetch}`);
  }
  return ok('neovim', `${NVIM_VERSION} at ${bin}${env.CLAND_NVIM ? ' (CLAND_NVIM)' : ''}`);
}

/** Every toolchain check, run concurrently, reported in a fixed order. */
export async function checkToolchain(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const parts = await Promise.all([...HARNESSES.map((h) => checkHarness(h, env)), checkGh(env), checkNvim(env).then((c) => [c]), checkOpenCodeDatabases(env)]);
  return parts.flat();
}
