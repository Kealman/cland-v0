#!/usr/bin/env node
// The pinned Neovim release cland runs in (spec 4.1, ADR 0005): the tag in `nvim/NVIM_VERSION`, the
// official release tarball for this platform, checked against the digest pinned in `nvim/NVIM_SHA256SUMS`
// and unpacked under `.cache/nvim/<tag>/` at the repository root (ignored by git). `CLAND_NVIM` names a
// binary to use instead. Run as a script it prints the binary's path, downloading it first if missing.
//
// Two resolvers may start on an empty cache at once (two test files, two `cland open`): the download is held under
// a lock file in the cache (`.download.lock`, created exclusively, naming its pid); the other waits for the binary
// to appear, or takes the lock over once its holder is gone. Every temporary file is the downloader's own, and the
// unpacked tree is moved into place in one rename.
//
// For tests only: `CLAND_NVIM_CACHE_DIR` moves the cache, `CLAND_NVIM_DOWNLOAD_URL` (http(s) or file:) and
// `CLAND_NVIM_DOWNLOAD_SHA256` replace the release and its pinned digest (both or neither),
// `CLAND_TEST_NVIM_DOWNLOAD_PAUSE_MS` holds a download still before it writes.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

/** `CLAND_NVIM` if set, else the cached release; null when neither exists (nothing is downloaded here). */
export function findNvim(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CLAND_NVIM) return existsSync(env.CLAND_NVIM) ? env.CLAND_NVIM : null;
  const bin = cachedBinary(env);
  return bin && existsSync(bin) ? bin : null;
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

/**
 * Hold the download lock in `dir` while `fn` runs. Another holder: wait until `done()` (its download landed), or until
 * its lock is gone or stale (its pid dead), then try again. Returns null when `done()` turned true while waiting.
 */
async function underLock<T>(dir: string, done: () => boolean, log: (s: string) => void, fn: () => Promise<T>): Promise<T | null> {
  const lock = join(dir, '.download.lock');
  const deadline = Date.now() + WAIT_MS;
  let said = false;
  for (;;) {
    let fd: number | null = null;
    try {
      fd = openSync(lock, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
    if (fd !== null) {
      try {
        writeSync(fd, `${process.pid}\n`);
      } finally {
        closeSync(fd);
      }
      try {
        return await fn();
      } finally {
        rmSync(lock, { force: true });
      }
    }
    if (done()) return null;
    let holder = NaN;
    try {
      holder = Number(readFileSync(lock, 'utf8').trim());
    } catch {
      continue; // released between the two calls: try again at once
    }
    // a holder that died mid-download (or a lock not yet written for a moment) leaves the lock: past a grace, it is broken
    const age = (() => {
      try {
        return Date.now() - statSync(lock).mtimeMs;
      } catch {
        return 0;
      }
    })();
    if ((Number.isInteger(holder) && holder > 0 && !pidAlive(holder)) || (!Number.isInteger(holder) && age > 5000)) {
      rmSync(lock, { force: true });
      continue;
    }
    if (!said) {
      log(`waiting for pid ${Number.isInteger(holder) ? holder : '?'}, which holds the download`);
      said = true;
    }
    if (Date.now() > deadline) throw new Error(`gave up waiting for ${lock} (pid ${holder}) after ${WAIT_MS / 60_000} min`);
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
