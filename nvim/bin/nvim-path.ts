#!/usr/bin/env node
// The pinned Neovim release cland runs in (spec 4.1, ADR 0005): the tag in `nvim/NVIM_VERSION`, the
// official release tarball for this platform, checked against the digest pinned in `nvim/NVIM_SHA256SUMS`
// and unpacked under `.cache/nvim/<tag>/` at the repository root (ignored by git). `CLAND_NVIM` names a
// binary to use instead, and a linked worktree with no cache of its own uses the main worktree's. Run as a script it prints the binary's path, downloading it first if missing.
//
// Two resolvers may start on an empty cache at once (two test files, two `cland open`): the download is held under
// a lock file in the cache (`.download.lock`, created whole and exclusively, naming its pid); the other waits for the
// binary to appear, or takes the lock over once its holder is gone (a dead pid, or no pid past a grace). A stale lock
// is broken under a guard (`.download.lock.break`) and only if it still reads as found, so two resolvers breaking it
// at once never remove the lock one of them then took. Every temporary file is the downloader's own, and the
// unpacked tree is moved into place in one rename.
//
// For tests only: `CLAND_NVIM_CACHE_DIR` moves the cache, `CLAND_NVIM_DOWNLOAD_URL` (http(s) or file:) and
// `CLAND_NVIM_DOWNLOAD_SHA256` replace the release and its pinned digest (both or neither),
// `CLAND_TEST_NVIM_DOWNLOAD_PAUSE_MS` holds a download still before it writes, `CLAND_TEST_NVIM_BREAK_PAUSE_MS` a
// breaker between finding a lock stale and removing it.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NVIM_DIR = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = dirname(NVIM_DIR.replace(/\/$/, ''));
export const NVIM_VERSION = readFileSync(join(NVIM_DIR, 'NVIM_VERSION'), 'utf8').trim();

/** The release asset for this machine, or null where Neovim publishes none cland pins. */
export function assetName(platform: string = process.platform, arch: string = process.arch): string | null {
  const os = platform === 'darwin' ? 'macos' : platform === 'linux' ? 'linux' : null;
  const cpu = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'x86_64' : null;
  return os && cpu ? `nvim-${os}-${cpu}.tar.gz` : null;
}

const pinnedDigest = (asset: string): string | null => {
  for (const line of readFileSync(join(NVIM_DIR, 'NVIM_SHA256SUMS'), 'utf8').split('\n')) {
    const [sha, name] = line.trim().split(/\s+/);
    if (name === asset && sha) return sha;
  }
  return null;
};

/** The cache's folder for the pinned release: `.cache/nvim/<tag>/` at the repository root (`CLAND_NVIM_CACHE_DIR/<tag>`). */
export const cacheDir = (env: NodeJS.ProcessEnv = process.env): string => join(env.CLAND_NVIM_CACHE_DIR || join(REPO_ROOT, '.cache', 'nvim'), NVIM_VERSION);

/** Where the unpacked release's binary lives in the cache. */
export function cachedBinary(env: NodeJS.ProcessEnv = process.env): string | null {
  const asset = assetName();
  if (!asset) return null;
  return join(cacheDir(env), asset.replace(/\.tar\.gz$/, ''), 'bin', 'nvim');
}

/** The main worktree's root when this checkout is a linked worktree of it (its `.git` is a file naming
 *  `<main>/.git/worktrees/<name>`), else null. */
function mainWorktree(): string | null {
  try {
    const gitDir = /^gitdir: (.+)$/m.exec(readFileSync(join(REPO_ROOT, '.git'), 'utf8'))?.[1];
    if (!gitDir) return null;
    const worktrees = dirname(resolve(REPO_ROOT, gitDir));
    return basename(worktrees) === 'worktrees' && basename(dirname(worktrees)) === '.git' ? dirname(dirname(worktrees)) : null;
  } catch {
    // `.git` is a directory (this is the main worktree), or there is none
    return null;
  }
}

/**
 * `CLAND_NVIM` if set, else the cached release; null when neither exists (nothing is downloaded here). A linked
 * worktree with no cache of its own uses the main worktree's: the same pinned release, and a session working there
 * with the network closed (a sandboxed session) could not download another.
 */
export function findNvim(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CLAND_NVIM) return existsSync(env.CLAND_NVIM) ? env.CLAND_NVIM : null;
  const bin = cachedBinary(env);
  if (!bin) return null;
  if (existsSync(bin)) return bin;
  if (env.CLAND_NVIM_CACHE_DIR) return null;
  const main = mainWorktree();
  const shared = main && join(main, relative(REPO_ROOT, bin));
  return shared && existsSync(shared) ? shared : null;
}

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** How long a resolver waits for another's download before it gives up. */
const WAIT_MS = 10 * 60_000;

/** A lock naming no positive pid is stale once it is this old. */
const NO_PID_GRACE_MS = 5000;

/** The pid a lock's text names: a positive integer, else null (empty, cut off, junk). */
const holderOf = (text: string): number | null => {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const pid = Number(t);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
};

/** Create `path` with `text`, whole, only if it does not exist yet (written aside, then hard-linked into place, which
 *  fails when the name exists); false when it does. A live holder's lock is never seen empty. */
function createExclusive(path: string, text: string): boolean {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    linkSync(tmp, path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** A breaker that died mid-break leaves its guard behind; past this age the guard is ignored. */
const BREAK_GUARD_STALE_MS = 10_000;

/**
 * Remove the lock if it still reads `stale` (the text found stale), under the break guard (`.download.lock.break`,
 * created the same way), as the hub's lock does: two resolvers that both found the same stale lock cannot each
 * remove what the other created after it. A guard held by another breaker: wait a moment and look again.
 */
async function breakStale(lock: string, stale: string): Promise<void> {
  const guard = `${lock}.break`;
  if (!createExclusive(guard, `${process.pid}\n`)) {
    try {
      if (Date.now() - statSync(guard).mtimeMs > BREAK_GUARD_STALE_MS) rmSync(guard, { force: true });
    } catch {
      /* the other breaker finished */
    }
    await sleep(20);
    return;
  }
  try {
    // a test's pause between finding the lock stale and removing it
    const pause = Number(process.env.CLAND_TEST_NVIM_BREAK_PAUSE_MS ?? 0);
    if (pause > 0) await sleep(pause);
    let now: string | null;
    try {
      now = readFileSync(lock, 'utf8');
    } catch {
      now = null; // already gone
    }
    if (now === stale) rmSync(lock, { force: true });
  } finally {
    rmSync(guard, { force: true });
  }
}

/**
 * Hold the download lock in `dir` while `fn` runs. Another holder: wait until `done()` (its download landed), or until
 * its lock is gone or stale (its pid dead, or no pid past a grace), then try again. Returns null when `done()` turned
 * true while waiting. The lock is created whole and removed only by its holder, or, stale, under the break guard.
 */
async function underLock<T>(dir: string, done: () => boolean, log: (s: string) => void, fn: () => Promise<T>): Promise<T | null> {
  const lock = join(dir, '.download.lock');
  const mine = `${process.pid}\n`;
  const deadline = Date.now() + WAIT_MS;
  let said = false;
  for (;;) {
    if (createExclusive(lock, mine)) {
      try {
        return await fn();
      } finally {
        // only our own lock is removed: one a breaker replaced is left to its holder
        try {
          if (readFileSync(lock, 'utf8') === mine) rmSync(lock, { force: true });
        } catch {
          /* gone already */
        }
      }
    }
    if (done()) return null;
    let text: string;
    try {
      text = readFileSync(lock, 'utf8');
    } catch {
      continue; // released between the two calls: try again at once
    }
    const holder = holderOf(text);
    // a holder that died mid-download leaves the lock; one without a pid (empty, cut off, junk: its writer died
    // before the pid was out) is stale past a grace
    const age = (() => {
      try {
        return Date.now() - statSync(lock).mtimeMs;
      } catch {
        return 0;
      }
    })();
    if ((holder !== null && !pidAlive(holder)) || (holder === null && age > NO_PID_GRACE_MS)) {
      await breakStale(lock, text);
      continue;
    }
    if (!said) {
      log(`waiting for pid ${holder ?? '?'}, which holds the download`);
      said = true;
    }
    if (Date.now() > deadline) throw new Error(`gave up waiting for ${lock} (pid ${holder ?? '?'}) after ${WAIT_MS / 60_000} min`);
    await sleep(100);
  }
}

/** The release's bytes: fetched, or read from a file: URL (tests). */
async function download(url: string): Promise<Buffer> {
  if (url.startsWith('file:')) return readFileSync(fileURLToPath(url));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`downloading ${url} failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The binary to run: found, or downloaded, verified and unpacked. Throws with the reason when it cannot. */
export async function ensureNvim(env: NodeJS.ProcessEnv = process.env, log: (s: string) => void = () => {}): Promise<string> {
  if (env.CLAND_NVIM) {
    if (existsSync(env.CLAND_NVIM)) return env.CLAND_NVIM;
    throw new Error(`CLAND_NVIM names ${env.CLAND_NVIM}, which does not exist`);
  }
  const found = findNvim(env);
  if (found) return found;
  const asset = assetName();
  if (!asset) throw new Error(`Neovim ${NVIM_VERSION} publishes no build cland pins for ${process.platform}/${process.arch}; set CLAND_NVIM to a Neovim ${NVIM_VERSION} binary`);
  const overridden = Boolean(env.CLAND_NVIM_DOWNLOAD_URL);
  if (overridden !== Boolean(env.CLAND_NVIM_DOWNLOAD_SHA256)) throw new Error('CLAND_NVIM_DOWNLOAD_URL and CLAND_NVIM_DOWNLOAD_SHA256 go together');
  const expected = overridden ? (env.CLAND_NVIM_DOWNLOAD_SHA256 as string) : pinnedDigest(asset);
  if (!expected) throw new Error(`nvim/NVIM_SHA256SUMS pins no digest for ${asset}`);
  const dir = cacheDir(env);
  mkdirSync(dir, { recursive: true });
  const bin = cachedBinary(env) as string;
  const url = env.CLAND_NVIM_DOWNLOAD_URL || `https://github.com/neovim/neovim/releases/download/${NVIM_VERSION}/${asset}`;
  const pauseMs = Number(env.CLAND_TEST_NVIM_DOWNLOAD_PAUSE_MS ?? 0);
  const fetched = await underLock(dir, () => existsSync(bin), log, async () => {
    // another resolver may have finished while this one waited for the lock
    if (existsSync(bin)) return bin;
    log(`downloading ${url}`);
    const bytes = await download(url);
    if (pauseMs > 0) await sleep(pauseMs);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected) throw new Error(`${asset}: sha256 ${actual} is not the pinned ${expected}`);
    log(`sha256 ok (${actual})`);
    // unpack beside, then move into place in one rename: a half-unpacked tree is never taken for the release
    const tarball = join(dir, `.${asset}.${process.pid}.part`);
    const staging = join(dir, `.unpack-${process.pid}`);
    try {
      writeFileSync(tarball, bytes);
      rmSync(staging, { recursive: true, force: true });
      mkdirSync(staging);
      const tar = spawnSync('tar', ['-xzf', tarball, '-C', staging], { encoding: 'utf8' });
      if (tar.status !== 0) throw new Error(`unpacking ${asset} failed: ${tar.stderr}`);
      const unpacked = asset.replace(/\.tar\.gz$/, '');
      const target = join(dir, unpacked);
      // the release notes ask macOS users to clear the quarantine attributes
      if (process.platform === 'darwin') spawnSync('xattr', ['-cr', join(staging, unpacked)]);
      rmSync(target, { recursive: true, force: true });
      renameSync(join(staging, unpacked), target);
    } finally {
      rmSync(tarball, { force: true });
      rmSync(staging, { recursive: true, force: true });
    }
    return bin;
  });
  if (fetched === null) log('the other resolver finished the download');
  if (!existsSync(bin)) throw new Error(`${asset} unpacked without ${bin}`);
  return bin;
}

/** Whether this module is the script node runs: compared as URLs of real paths (import.meta.url escapes a
 *  space, `#` or `%`, and names the file after symlinks such as macOS's /var → /private/var). */
const isMain = (): boolean => {
  const script = process.argv[1];
  if (!script) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(script)).href;
  } catch {
    return false;
  }
};

if (isMain()) {
  ensureNvim(process.env, (s) => process.stderr.write(`cland-nvim: ${s}\n`)).then(
    (bin) => process.stdout.write(`${bin}\n`),
    (err: unknown) => {
      process.stderr.write(`cland-nvim: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
