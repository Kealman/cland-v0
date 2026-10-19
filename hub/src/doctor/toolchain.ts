// The machine's side of `cland doctor`: the three harnesses (installed, version for information, signed in),
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
import { formatVersion, parseVersion, TESTED_RANGES, type HarnessId, type Version } from './ranges.ts';
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
        const providers = Array.isArray(v) ? (v as Array<{ id?: unknown; name?: unknown; connections?: unknown }>) : null;
        if (r.code !== 0 || providers === null) return warn(name, `cannot check: \`opencode auth list\` gave ${r.code !== 0 ? `exit ${r.code}` : 'no JSON list'}${firstLine(r.stderr) ? ` (${firstLine(r.stderr)})` : ''}`, 'opencode auth list, by hand');
        const credentials = providers.filter(p => Array.isArray(p?.connections) && p.connections.some(c => c?.type === 'credential'));
        if (credentials.length === 0) return warn(name, 'no stored credentials: only the free OpenCode models are usable', 'opencode auth login');
        const names = credentials.map((p) => String(p.name ?? p.id ?? '?'));
        return ok(name, `credentials for ${names.join(', ')}`);
      },
    },
  },
];

/** Shared doctor/setup detection. Command and executable lookup boundaries can be supplied without running tools. */
export type HarnessProbe = { id: HarnessId; bin: string | null; version: Version | null; checks: Check[] };
export async function probeHarness(id: HarnessId, env: NodeJS.ProcessEnv, probe: typeof run = run, installation: typeof harnessInstallation = harnessInstallation): Promise<HarnessProbe> {
  const h = HARNESSES.find(h => h.id === id)!;
  const { bin, missing } = await installation(id, env);
  if (!bin) return { id, bin, version: null, checks: [missing!, fail(authName(id), 'not checked: not installed', `install ${h.bin} first`)] };
  const out: Check[] = [];
  const database = clandOpenCodeDatabase(env);
  const probeEnv = id === 'opencode' ? accountEnvironment(env, { OPENCODE_DB: database }) : env;
  const v = await probe(bin, ['--version'], probeEnv);
  const version = v.error === undefined && v.code === 0 ? parseVersion(v.stdout || v.stderr) : null;
  if (v.error !== undefined || v.code !== 0) out.push(fail(id, `${bin} --version failed: ${v.error ?? (firstLine(v.stderr) || `exit ${v.code}`)}`, `reinstall ${h.bin}`));
  else if (!version) out.push(fail(id, `${bin}: cannot read a version from "${firstLine(v.stdout || v.stderr)}"`, `check ${h.bin} --version by hand`));
  else out.push(ok(id, `${formatVersion(version)} at ${bin} (tested with ${formatVersion(TESTED_RANGES[id].min)}${id === 'opencode' ? "; cland speaks OpenCode's v2 API" : ''})`));
  const a = await probe(bin, h.auth.args, probeEnv);
  if (a.error !== undefined) out.push(warn(authName(h.id), `cannot check: ${h.bin} ${h.auth.args.join(' ')}: ${a.error}`, `run ${h.bin} ${h.auth.args.join(' ')} by hand`));
  else {
    const check = h.auth.read(a);
    if (h.id === 'opencode' && check.fix) check.fix = openCodeLogin(database);
    out.push(check);
  }
  return { id, bin, version, checks: out };
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

async function checkGh(env: NodeJS.ProcessEnv, probe: typeof run): Promise<Check[]> {
  const bin = which('gh', env);
  if (!bin) return [fail('gh', '`gh` is not on the PATH', 'install the GitHub CLI (https://cli.github.com)'), fail('gh auth', 'not checked: gh is not installed', 'install gh first')];
  const v = await probe(bin, ['--version'], env);
  const version = parseVersion(v.stdout);
  const out: Check[] = [v.code === 0 && version ? ok('gh', `${formatVersion(version)} at ${bin}`) : fail('gh', `${bin} --version failed: ${v.error ?? (firstLine(v.stderr) || `exit ${v.code}`)}`, 'reinstall gh')];
  const a = await probe(bin, ['auth', 'status'], env);
  // gh writes its status to stdout or stderr depending on the version
  const said = `${a.stdout}\n${a.stderr}`;
  const account = /Logged in to (\S+) account (\S+)/.exec(said);
  if (a.code === 0) out.push(ok('gh auth', account ? `logged in to ${account[1]} as ${account[2]}` : firstLine(said) || 'logged in'));
  else out.push(fail('gh auth', a.error ?? (firstLine(said) || `gh auth status exited ${a.code}`), 'gh auth login'));
  return out;
}

async function checkNvim(env: NodeJS.ProcessEnv, probe: typeof run): Promise<Check> {
  const fetch = 'run `cland open` (its launcher downloads and verifies the pinned build), or set CLAND_NVIM to a Neovim binary';
  const bin = findNvim(env);
  if (!bin) {
    if (env.CLAND_NVIM) return fail('neovim', `CLAND_NVIM names ${env.CLAND_NVIM}, which does not exist`, `point CLAND_NVIM at a Neovim ${NVIM_VERSION} binary, or unset it to use the pinned build`);
    return fail('neovim', `the pinned standalone build ${NVIM_VERSION} is not downloaded`, fetch);
  }
  const v = await probe(bin, ['--version'], env);
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

export type ToolchainRequirements = {
  harnesses: readonly string[];
  github: boolean;
  installation?: typeof harnessInstallation;
};

/** Every toolchain check, run concurrently, reported in a fixed order. */
export async function checkToolchain(env: NodeJS.ProcessEnv, probe: typeof run = run, requirements: ToolchainRequirements = { harnesses: [], github: false }): Promise<Check[]> {
  const [harnesses, gh, nvim, databases] = await Promise.all([
    Promise.all(HARNESSES.map(h => probeHarness(h.id, env, probe, requirements.installation))),
    requirements.github ? checkGh(env, probe) : [ok('gh', 'not needed: no github remote')],
    checkNvim(env, probe), checkOpenCodeDatabases(env),
  ]);
  const checks = harnesses.flatMap(h => {
    if (requirements.harnesses.includes(h.id)) return h.checks;
    if (!h.bin) return [ok(h.id, 'not installed; no role uses it')];
    return h.checks.map(c => c.verdict === 'ok' ? c : ok(c.name, `${c.detail}; no role uses it${c.fix ? `; ${c.fix}` : ''}`));
  });
  if (requirements.harnesses.length === 0 && !harnesses.some(h => h.bin !== null)) {
    checks.push(fail('harnesses', 'cland needs at least one harness', HARNESSES.map(h => h.install).join('; ')));
  }
  return [...checks, ...gh, nvim, ...databases];
}
