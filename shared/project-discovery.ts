// Read-only project discovery, shared by clients and fixture admission.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
const CLAND_DIR = '.cland';

/** The discovery file: what a client needs to reach the project's hub. */
export type Discovery = {
  /** The hub's project root, independent of where this file is copied. Absent in older files. */
  root?: string;
  /** The Unix socket the UI and the CLI speak JSON lines on. */
  socket: string;
  /** The 127.0.0.1 port spokes open their WebSocket on. */
  port: number;
  /** Stable browser origin port; may be unavailable (see hub.status.web). Absent on older hubs. */
  webPort?: number;
  secret: string;
  pid: number;
  version: string;
};

/**
 * The project a command run in `cwd` belongs to. Linked worktrees share the main worktree's project;
 * their gitdir's `commondir` points back to its `.git/`. A copied `.cland/` without a hub does not
 * hide that repository. Otherwise use the nearest `.git` or `.cland/`, else `cwd` itself.
 */
export function projectRoot(cwd: string): string {
  let cland: string | null = null;
  for (let dir = cwd; ; dir = dirname(dir)) {
    const git = join(dir, '.git');
    if (existsSync(git)) {
      if (statSync(git).isFile()) {
        const gitdir = /^gitdir: (.+)$/m.exec(readFileSync(git, 'utf8'))?.[1]?.trim();
        if (gitdir) {
          const admin = resolve(dir, gitdir);
          const common = join(admin, 'commondir');
          if (existsSync(common)) return dirname(resolve(admin, readFileSync(common, 'utf8').trim()));
        }
      }
      return cland ?? dir;
    }
    if (existsSync(join(dir, CLAND_DIR))) {
      cland ??= dir;
      if (existsSync(join(dir, CLAND_DIR, 'hub.json'))) return cland;
    }
    if (dirname(dir) === dir) return cland ?? cwd;
  }
}

/** The CLI's hub discovery: an explicit file wins, including when it is absent or invalid. */
export function hubDiscovery(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAND_HUB_FILE?.trim() ? resolve(cwd, env.CLAND_HUB_FILE.trim()) : join(projectRoot(cwd), '.cland', 'hub.json');
}

export function readDiscovery(file: string): Discovery | null {
  try {
    const d = JSON.parse(readFileSync(file, 'utf8')) as Partial<Discovery>;
    if (typeof d.socket !== 'string' || typeof d.port !== 'number' || typeof d.secret !== 'string' || typeof d.pid !== 'number' || typeof d.version !== 'string') return null;
    if (d.root !== undefined && (typeof d.root !== 'string' || !isAbsolute(d.root))) return null;
    return d as Discovery;
  } catch {
    return null;
  }
}

