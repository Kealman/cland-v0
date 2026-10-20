// The project's side of `cland doctor`: the hub (running or startable, its discovery file, the secret), the
// committed config (`roles.toml`, `config.toml`), and what `cland init` provisioned (the skills and their link
// for Claude Code, the hooks, the mod cland ships, `docs/agents/*`, AGENTS.md's block). Read-only: the hub is
// asked `hub.status` over its socket and nothing else.
import { existsSync, lstatSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { HOOK_EVENTS, MOD_DIR } from '../adapters/claude-code.ts';
import { askHub } from '../cli/socket-client.ts';
import { liveHolderAsync, parseStarted } from '../hub/lock.ts';
import { parseConfig } from '../init/config.ts';
import { isManagedFile, readText } from '../init/files.ts';
import { BLOCK_END, DOCS } from '../init/instructions.ts';
import { MANIFEST, readManifest, SKILLS_SOURCE } from '../init/skills.ts';
import { CLAND_DIR, layout, pidAlive, readDiscovery, type Layout } from '../project.ts';
import type { HubStatus } from '../protocol.ts';
import { KNOWN_GOOD_FREE_MODELS } from '../adapters/opencode/client.ts';
import { parseRoles } from '../roles/config.ts';
import { isSkill, projectSkills } from '../roles/skills.ts';
import { VERSION } from '../version.ts';
import { fail, ok, probeTimeout, run, warn, type Check } from './report.ts';
import { territoryProblems } from '../territory.ts';

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err)).replace(/\s*\n\s*/g, ' ').trim();

/** A TOML error on one line: smol-toml's first line and its position (the code frame it adds is dropped). */
const tomlError = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err);
  const { line, column } = err as Error & { line?: unknown; column?: unknown };
  if (typeof line !== 'number') return errorText(err);
  const first = err.message.split('\n')[0]?.trim() ?? '';
  return `${first} (line ${line}${typeof column === 'number' ? `, column ${column}` : ''})`;
};

/** Native facts are separate from project-file parsing and the hub socket proof. */
export type ProjectReaders = {
  started?: Parameters<typeof liveHolderAsync>[1];
  territoryProblems?: typeof territoryProblems;
};

/** `hub`, `hub.json` and `secret`. */
async function checkHub(l: Layout, readers: ProjectReaders): Promise<Check[]> {
  const rel = (p: string) => relative(l.root, p);
  const text = readText(l.discovery);
  const d = text === null ? null : readDiscovery(l.discovery);
  // the lock's holder, its start time asked of `ps` with a deadline: a hung `ps` cannot hold the doctor up
  const holder = await liveHolderAsync(l.lock, readers.started ?? (async (pid, timezone) => {
    const r = await run('ps', ['-o', 'lstart=', '-p', String(pid)], timezone ? { ...process.env, TZ: timezone, LC_ALL: 'C' } : process.env, probeTimeout(process.env, 3000));
    return r.code === 0 && r.error === undefined ? parseStarted(r.stdout) : null;
  }));
  const out: Check[] = [];
  let running = false;

  if (text === null) {
    if (holder) {
      out.push(fail('hub', `pid ${holder.pid} holds ${rel(l.lock)}, but ${rel(l.discovery)} is missing: sessions and the CLI cannot find the hub`, `stop pid ${holder.pid} (kill ${holder.pid}), then cland hub start`));
      out.push(fail('hub.json', `missing while pid ${holder.pid} holds the hub lock`, `kill ${holder.pid}, then cland hub start (it writes ${rel(l.discovery)})`));
      running = true;
    } else {
      out.push(warn('hub', 'not running (startable: no hub holds the lock)', 'cland hub start'));
      out.push(ok('hub.json', 'absent, as no hub runs'));
    }
  } else if (d === null) {
    const fix = holder ? `kill ${holder.pid}, remove ${rel(l.discovery)}, then cland hub start` : `remove ${rel(l.discovery)}, then cland hub start`;
    out.push(fail('hub', `${rel(l.discovery)} is not a valid discovery file (socket, port, secret, pid, version)`, fix));
    out.push(fail('hub.json', 'not valid JSON with socket, port, secret, pid and version', fix));
    running = holder !== null;
  } else if (holder && holder.pid !== d.pid && !pidAlive(d.pid)) {
    // a live hub holds the lock, but the file names another (dead) pid: nothing can reach the live hub, and
    // `cland hub start` cannot replace it
    const fix = `kill ${holder.pid} (the hub holding the lock, unreachable through the stale file), then rm ${rel(l.discovery)} and cland hub start`;
    out.push(fail('hub', `pid ${holder.pid} holds ${rel(l.lock)}, but ${rel(l.discovery)} names pid ${d.pid}, which is gone: sessions and the CLI cannot find the hub`, fix));
    out.push(fail('hub.json', `stale: names pid ${d.pid}, which is gone, while pid ${holder.pid} holds the hub lock`, fix));
    running = true;
  } else if (!pidAlive(d.pid)) {
    out.push(warn('hub', `not running: ${rel(l.discovery)} names pid ${d.pid}, which is gone`, 'cland hub start (it replaces the stale file)'));
    out.push(warn('hub.json', `stale: pid ${d.pid} is gone`, 'cland hub start'));
  } else {
    let status: HubStatus | null = null;
    let why = '';
    try {
      status = (await askHub(d, 'hub.status', 3000)) as HubStatus;
    } catch (err) {
      why = errorText(err);
    }
    const owns = holder?.pid === d.pid;
    if (status) {
      running = true;
      const lock = owns ? 'holds the lock' : holder ? `but pid ${holder.pid} holds the lock` : 'but no live process holds the lock';
      const sessions = `${status.sessions.length} session${status.sessions.length === 1 ? '' : 's'}`;
      if (!owns) out.push(fail('hub', `pid ${d.pid} answers on ${d.socket} ${lock}`, 'cland hub stop, then cland hub start'));
      else if (status.version !== VERSION) out.push(warn('hub', `running pid ${d.pid}, version ${status.version}; this cland is ${VERSION}`, 'cland hub stop, then cland hub start'));
      else out.push(ok('hub', `running: pid ${d.pid}, ${lock}, answers hub.status on ${d.socket}, port ${d.port}, ${sessions}`));
      if (status.web && !status.web.available) out.push(warn('web edge', `unavailable on 127.0.0.1:${status.web.port}: ${status.web.reason ?? 'unknown reason'}`, `free port ${status.web.port} or set [web] port, then restart the hub`));
      if (status.priority?.warning) out.push(warn('hub priority', status.priority.warning.detail, status.priority.warning.fix));
      out.push(ok('hub.json', `valid, names pid ${d.pid}`));
    } else if (owns) {
      running = true;
      out.push(fail('hub', `pid ${d.pid} holds the lock but does not answer on ${d.socket} (${why})`, 'cland hub stop, then cland hub start'));
      out.push(ok('hub.json', `valid, names pid ${d.pid}`));
    } else if (holder) {
      const fix = `kill ${holder.pid} (the hub holding the lock, unreachable through the stale file), then rm ${rel(l.discovery)} and cland hub start`;
      running = true;
      out.push(fail('hub', `pid ${holder.pid} holds ${rel(l.lock)}, but ${rel(l.discovery)} names pid ${d.pid}, which is not this project's hub: sessions and the CLI cannot find the hub`, fix));
      out.push(fail('hub.json', `stale: names pid ${d.pid} while pid ${holder.pid} holds the hub lock`, fix));
    } else {
      out.push(warn('hub', `not running: pid ${d.pid} named by ${rel(l.discovery)} is not this project's hub (it does not hold the lock)`, 'cland hub start (it replaces the stale file)'));
      out.push(warn('hub.json', `stale: pid ${d.pid} is not this project's hub`, 'cland hub start'));
    }
  }

  // the secret: the hub writes it at its first start, mode 0600, and keeps it across restarts
  let mode: number | null = null;
  try {
    mode = statSync(l.secret).mode & 0o777;
  } catch {
    /* absent */
  }
  const secret = readText(l.secret)?.trim() ?? '';
  if (mode === null) {
    out.push(running ? fail('secret', `${rel(l.secret)} is missing while a hub runs`, 'cland hub stop, then cland hub start (it writes a new one)') : warn('secret', `${rel(l.secret)} is absent: the hub writes it at its first start`, 'cland hub start'));
  } else if (mode !== 0o600) out.push(fail('secret', `${rel(l.secret)} has mode ${mode.toString(8).padStart(4, '0')}, not 0600: other users can read it`, `chmod 600 ${rel(l.secret)}`));
  else if (!/^[0-9a-f]{64}$/.test(secret)) out.push(fail('secret', `${rel(l.secret)} is not a 64-hex-digit secret`, `remove ${rel(l.secret)}, then cland hub stop and cland hub start`));
  else if (d && d.secret !== secret) out.push(fail('secret', `${rel(l.secret)} differs from the one ${rel(l.discovery)} carries`, 'cland hub stop, then cland hub start'));
  else out.push(ok('secret', `present, mode 0600`));
  return out;
}

/** `roles.toml` and `config.toml`: they parse, with the TOML error named when they do not. */
function checkConfig(l: Layout): Check[] {
  const out: Check[] = [];
  const roles = readText(l.roles);
  if (roles === null) out.push(warn('roles.toml', `${CLAND_DIR}/roles.toml is absent: the hub writes the defaults at start`, 'cland init'));
  else {
    try {
      const parsed = parseRoles(roles);
      out.push(ok('roles.toml', `parses: ${[...parsed.keys()].join(', ')}`));
      const available = projectSkills(l.root);
      for (const [role, { launch, skills }] of parsed) {
        const missing = skills.filter(skill => !available.has(skill));
        if (missing.length) out.push(warn(`role skills ${role}`, `${role} names unavailable skills: ${missing.join(', ')}`, `remove unavailable names from ${role}.skills in ${CLAND_DIR}/roles.toml, or restore their folders holding SKILL.md in .agents/skills/`));
        if (launch.harness !== 'opencode') continue;
        const model = launch.model?.split('#')[0];
        if (!model || KNOWN_GOOD_FREE_MODELS.includes(model.includes('/') ? model : `opencode/${model}`) || /[-:]free$/.test(model)) {
          out.push(warn(`opencode model ${role}`, `${role} uses a free OpenCode model (${model || 'automatic free selection'}), which may train on the code it sees`, 'choose a provider/model with suitable data terms before exposing private code'));
        }
        out.push(warn(`opencode sandbox ${role}`, `${role}: OpenCode has no OS sandbox; permission rules do not isolate its processes`, 'run only where the role may access the host files and network'));
      }
    } catch (err) {
      out.push(fail('roles.toml', `does not parse: ${tomlError(err)}`, `fix ${CLAND_DIR}/roles.toml (until then the hub keeps the last good roles, or the defaults)`));
    }
  }
  const config = readText(l.config);
  if (config === null) out.push(warn('config.toml', `${CLAND_DIR}/config.toml is absent: the hub uses the built-in defaults`, 'cland update'));
  else {
    try {
      parseConfig(config, basename(l.root));
      out.push(ok('config.toml', `parses${isManagedFile(config) ? '' : ' (the project\'s own: no managed mark)'}`));
    } catch (err) {
      out.push(fail('config.toml', `does not parse: ${tomlError(err)}`, `fix ${CLAND_DIR}/config.toml (until then the hub uses the built-in defaults)`));
    }
  }
  return out;
}

const kind = (path: string): 'dir' | 'link' | 'file' | null => {
  try {
    const s = lstatSync(path);
    return s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file';
  } catch {
    return null;
  }
};

const real = (path: string): string | null => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

/** `skills` (the link Claude Code reads them through) and `skills manifest`. */
function checkSkills(root: string): Check[] {
  const target = join(root, '.agents', 'skills');
  const link = join(root, '.claude', 'skills');
  const out: Check[] = [];

  // the manifest: what cland installed; cland's own repository is the skills' source and has none
  const own = real(target) !== null && real(target) === real(SKILLS_SOURCE);
  let managed: string[] = [];
  if (own) out.push(ok('skills manifest', "cland's own repository: .agents/skills/ is the skills' source"));
  else {
    const read = readManifest(target);
    if (read.kind === 'absent') out.push(fail('skills manifest', `.agents/skills/${MANIFEST} is missing`, 'cland update'));
    else if (read.kind === 'invalid') out.push(fail('skills manifest', `.agents/skills/${MANIFEST} is not valid: ${read.why}`, `fix it, or remove it and the skills it listed, then cland update`));
    else {
      managed = Object.keys(read.manifest.skills);
      const missing = managed.filter((n) => !isSkill(join(target, n)));
      const legacy = managed.filter(n => Array.isArray(read.manifest.skills[n]));
      if (missing.length) out.push(fail('skills manifest', `lists ${missing.length} skill${missing.length === 1 ? '' : 's'} missing from .agents/skills/: ${missing.join(', ')}`, 'cland update'));
      else if (legacy.length) out.push(warn('skills manifest', `no hashes for ${legacy.join(', ')}: the next cland update overwrites their listed files once, losing prior edits, then records hashes to keep future project edits`, 'cland update'));
      else out.push(ok('skills manifest', `present: ${managed.length} skills`));
    }
  }

  const k = kind(link);
  if (k === null) out.push(fail('skills', '.claude/skills is missing: Claude Code sees no skills', 'cland update'));
  else if (k === 'link') {
    const to = readlinkSync(link);
    const resolved = real(link);
    const ours = resolve(root, '.claude', to) === target;
    if (resolved === null) out.push(fail('skills', `.claude/skills is a broken symlink (to ${to})`, ours ? 'cland update' : 'rm .claude/skills, then cland update'));
    else if (resolved !== real(target)) out.push(warn('skills', `.claude/skills is a symlink of the project's own (to ${to}), not to .agents/skills`, 'rm .claude/skills, then cland update, to see the skills cland installs'));
    else out.push(ok('skills', `.claude/skills → ${to}`));
  } else if (k === 'file') out.push(fail('skills', '.claude/skills is a file: Claude Code sees no skills', 'move it aside, then cland update'));
  else {
    // the project's own folder: one symlink per cland skill
    const broken: string[] = [];
    const absent: string[] = [];
    const unusable: string[] = [];
    for (const name of managed) {
      const each = join(link, name);
      const ek = kind(each);
      if (ek === null) absent.push(name);
      else if (ek === 'link' && real(each) === null) broken.push(name);
      else if (!isSkill(each)) unusable.push(name);
    }
    const own = readdirSync(link).filter((n) => !managed.includes(n)).length;
    if (broken.length) out.push(fail('skills', `.claude/skills/ has broken skill symlinks: ${broken.join(', ')}`, `remove ${broken.map((n) => `.claude/skills/${n}`).join(' ')}, then cland update`));
    else if (unusable.length) out.push(fail('skills', `.claude/skills/ has entries that are not a folder holding SKILL.md: ${unusable.join(', ')}`, `remove ${unusable.map((n) => `.claude/skills/${n}`).join(' ')}, then cland update`));
    else if (absent.length) out.push(fail('skills', `.claude/skills/ (the project's own folder) lacks links to ${absent.join(', ')}`, 'cland update'));
    else out.push(ok('skills', `.claude/skills/ is the project's own folder, with a link per cland skill (${managed.length})${own ? ` and ${own} of its own` : ''}`));
  }
  return out;
}

/** `claude hooks` (the managed ones in `.claude/settings.json`) and `cland mod` (shipped in this package). */
function checkClaude(root: string): Check[] {
  const out: Check[] = [];
  const path = join(root, '.claude', 'settings.json');
  const text = readText(path);
  type Settings = { hooks?: Record<string, unknown> };
  const settings = ((): Settings | null => {
    try {
      return text === null ? null : (JSON.parse(text) as Settings);
    } catch (err) {
      out.push(fail('claude hooks', `.claude/settings.json is not valid JSON (${errorText(err)})`, 'fix it, then cland update'));
      return null;
    }
  })();
  if (text === null) out.push(fail('claude hooks', '.claude/settings.json is missing: a hand-started Claude Code session reports nothing to the hub', 'cland update'));
  else if (settings !== null) {
    const missing: string[] = [];
    const versions = new Set<string>();
    for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
      const listed = settings.hooks?.[hookEvent];
      const entries = Array.isArray(listed) ? (listed as Array<{ hooks?: Array<{ command?: unknown }> }>) : [];
      const command = entries
        .flatMap((e) => (Array.isArray(e?.hooks) ? e.hooks : []))
        .map((h) => (typeof h?.command === 'string' ? h.command : ''))
        .find((c) => c.includes(`cland hook ${event}`) && /# managed by cland\b/.test(c));
      if (!command) missing.push(hookEvent);
      else versions.add(/# managed by cland (\S+)/.exec(command)?.[1] ?? '?');
    }
    const n = Object.keys(HOOK_EVENTS).length;
    if (missing.length) out.push(fail('claude hooks', `.claude/settings.json lacks the managed hook for ${missing.join(', ')}`, 'cland update'));
    else if (versions.size !== 1 || !versions.has(VERSION)) out.push(warn('claude hooks', `all ${n} present, marked by cland ${[...versions].join(', ')}; this cland is ${VERSION}`, 'cland update'));
    else out.push(ok('claude hooks', `all ${n} managed hooks present (cland ${VERSION})`));
  }
  const hooksJson = join(MOD_DIR, 'hooks', 'hooks.json');
  out.push(existsSync(hooksJson) ? ok('cland mod', `shipped at ${MOD_DIR}`) : fail('cland mod', `${hooksJson} is missing from this cland install`, 'reinstall cland'));
  return out;
}

/** `docs/agents` and `AGENTS.md`. */
function checkInstructions(root: string): Check[] {
  const out: Check[] = [];
  const missing = DOCS.filter((rel) => readText(join(root, rel)) === null);
  const theirs = DOCS.filter((rel) => {
    const t = readText(join(root, rel));
    return t !== null && !isManagedFile(t);
  });
  if (missing.length) out.push(fail('docs/agents', `missing: ${missing.join(', ')}`, 'cland update'));
  else out.push(ok('docs/agents', `${DOCS.length} files present${theirs.length ? ` (the project's own: ${theirs.join(', ')})` : ''}`));
  const agents = readText(join(root, 'AGENTS.md'));
  if (agents === null) out.push(fail('AGENTS.md', 'missing: no harness reads cland\'s instructions', 'cland update'));
  else {
    const begin = /<!-- cland:begin managed by cland (\S+)/.exec(agents);
    if (!begin || !agents.includes(BLOCK_END)) out.push(fail('AGENTS.md', begin ? 'the managed block has no cland:end marker' : 'has no cland managed block', begin ? 'fix the block by hand or remove it, then cland update' : 'cland update'));
    else if (begin[1] !== VERSION) out.push(warn('AGENTS.md', `the managed block is cland ${begin[1]}'s; this cland is ${VERSION}`, 'cland update'));
    else out.push(ok('AGENTS.md', `the managed block is present (cland ${VERSION})`));
  }
  return out;
}

/** Every project check; a folder `cland init` never ran in is one failure. */
export async function checkProject(root: string, readers: ProjectReaders = {}): Promise<Check[]> {
  const l = layout(root);
  if (!existsSync(l.dir)) return [fail('project', `${root} has no ${CLAND_DIR}/: not a cland project`, `cland init ${root}`)];
  const problems = (readers.territoryProblems ?? territoryProblems)(root);
  const territory = problems === null ? ok('territory', 'not a git repository: no territory needed') : problems.length ? fail('territory', problems.join('; '), 'cland init (restore origin to .cland/territory.git if it was changed)') : ok('territory', 'origin is the local bare repository; main and dev protected; HEAD on dev');
  return [...(await checkHub(l, readers)), territory, ...checkConfig(l), ...checkSkills(root), ...checkClaude(root), ...checkInstructions(root)];
}
