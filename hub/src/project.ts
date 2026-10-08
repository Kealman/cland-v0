// A project's `.cland/` folder: where it is, what it holds, and the discovery file a client finds the
// hub through (spec 4.2, 4.9). Everything here is files; no process is started or spoken to.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const CLAND_DIR = '.cland';

/** The discovery file: what a client needs to reach the project's hub. */
export type Discovery = {
  /** The Unix socket the UI and the CLI speak JSON lines on. */
  socket: string;
  /** The 127.0.0.1 port spokes open their WebSocket on. */
  port: number;
  secret: string;
  pid: number;
  version: string;
};

/** The marker every file cland manages starts with; a file without it is the user's and left alone. */
export const MANAGED_MARK = '# managed by cland';

/**
 * `.cland/.gitignore`: everything volatile. What is meant to be committed — `tasks/`, `roles.toml`,
 * `config.toml` and this file — is deliberately absent.
 */
export const GITIGNORE = `${MANAGED_MARK} — rewritten by cland; remove this line to take the file over.
# Volatile hub state: never committed. tasks/, roles.toml and config.toml are.
hub.db*
hub.json
hub.lock*
hub.sock
secret
journal.jsonl
log/
artifacts/
worktrees/
territory.git/
*.tmp
`;

/** Unix socket paths are capped (104 bytes on macOS, 108 on Linux, NUL included). */
export const SOCKET_PATH_MAX = 100;

export type Layout = {
  root: string;
  dir: string;
  db: string;
  secret: string;
  discovery: string;
  /** The hub's lock: held by the one hub serving the project, from before it prepares anything until it is gone. */
  lock: string;
  gitignore: string;
  /** The role definitions (spec 4.4): written with the defaults when missing, then the human's. */
  roles: string;
  logDir: string;
  log: string;
  /** Where the hub binds its Unix socket: inside `.cland/`, or under the temp dir when that path is too long. */
  socket: string;
};

export function layout(root: string): Layout {
  const dir = join(root, CLAND_DIR);
  const inside = join(dir, 'hub.sock');
  const socket = Buffer.byteLength(inside) <= SOCKET_PATH_MAX ? inside : join(tmpdir(), `cland-${createHash('sha256').update(root).digest('hex').slice(0, 16)}.sock`);
  return {
    root,
    dir,
    db: join(dir, 'hub.db'),
    secret: join(dir, 'secret'),
    discovery: join(dir, 'hub.json'),
    lock: join(dir, 'hub.lock'),
    gitignore: join(dir, '.gitignore'),
    roles: join(dir, 'roles.toml'),
    logDir: join(dir, 'log'),
    log: join(dir, 'log', 'hub.log'),
    socket,
  };
}

/**
 * The project a command run in `cwd` belongs to: the nearest ancestor holding `.git` or an existing
 * `.cland/` (a project with no repository), else `cwd` itself.
 */
export function projectRoot(cwd: string): string {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, CLAND_DIR))) return dir;
    if (dirname(dir) === dir) return cwd;
  }
}

/** The nearest ancestor of `cwd` whose `.cland/hub.json` exists — where a spoke finds its hub — or null. */
export function findDiscovery(cwd: string): string | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const file = join(dir, CLAND_DIR, 'hub.json');
    if (existsSync(file)) return file;
    if (dirname(dir) === dir) return null;
  }
}

/**
 * Create `.cland/` and what the hub needs in it: the managed `.gitignore` (rewritten while it carries the
 * mark, left alone once a person removed it) and the secret (kept across restarts, so a spoke holding it
 * reconnects; mode 0600). Idempotent. Returns the secret.
 */
export function ensureSkeleton(l: Layout): string {
  mkdirSync(l.logDir, { recursive: true });
  let current: string | null = null;
  try {
    current = readFileSync(l.gitignore, 'utf8');
  } catch {
    /* absent */
  }
  if (current === null || (current.startsWith(MANAGED_MARK) && current !== GITIGNORE)) writeFileSync(l.gitignore, GITIGNORE);
  let secret = '';
  try {
    secret = readFileSync(l.secret, 'utf8').trim();
  } catch {
    /* absent */
  }
  if (!/^[0-9a-f]{64}$/.test(secret)) {
    secret = randomBytes(32).toString('hex');
    writeFileSync(l.secret, `${secret}\n`, { mode: 0o600 });
  }
  // a secret file someone loosened is tightened again
  if ((statSync(l.secret).mode & 0o777) !== 0o600) chmodSync(l.secret, 0o600);
  return secret;
}

export function readDiscovery(file: string): Discovery | null {
  try {
    const d = JSON.parse(readFileSync(file, 'utf8')) as Partial<Discovery>;
    if (typeof d.socket !== 'string' || typeof d.port !== 'number' || typeof d.secret !== 'string' || typeof d.pid !== 'number' || typeof d.version !== 'string') return null;
    return d as Discovery;
  } catch {
    return null;
  }
}

/** Written whole or not at all (a reader never sees half a file), mode 0600: it carries the secret. */
export function writeDiscovery(file: string, d: Discovery): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(d, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

/** Remove the discovery file only if it still names `pid`: a newer hub's file is never removed by an older one. */
export function removeDiscovery(file: string, pid: number): void {
  if (readDiscovery(file)?.pid === pid) rmSync(file, { force: true });
}

export const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};
