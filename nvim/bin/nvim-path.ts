#!/usr/bin/env node
// The pinned Neovim release cland runs in (spec 4.1, ADR 0005): the tag in `nvim/NVIM_VERSION`, the
// official release tarball for this platform, checked against the digest pinned in `nvim/NVIM_SHA256SUMS`
// and unpacked under `.cache/nvim/<tag>/` at the repository root (ignored by git). `CLAND_NVIM` names a
// binary to use instead. Run as a script it prints the binary's path, downloading it first if missing.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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

/** Where the unpacked release's binary lives in the cache. */
export function cachedBinary(): string | null {
  const asset = assetName();
  if (!asset) return null;
  return join(REPO_ROOT, '.cache', 'nvim', NVIM_VERSION, asset.replace(/\.tar\.gz$/, ''), 'bin', 'nvim');
}

/** `CLAND_NVIM` if set, else the cached release; null when neither exists (nothing is downloaded here). */
export function findNvim(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CLAND_NVIM) return existsSync(env.CLAND_NVIM) ? env.CLAND_NVIM : null;
  const bin = cachedBinary();
  return bin && existsSync(bin) ? bin : null;
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
  const expected = pinnedDigest(asset);
  if (!expected) throw new Error(`nvim/NVIM_SHA256SUMS pins no digest for ${asset}`);
  const dir = join(REPO_ROOT, '.cache', 'nvim', NVIM_VERSION);
  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/neovim/neovim/releases/download/${NVIM_VERSION}/${asset}`;
  log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`downloading ${url} failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`${asset}: sha256 ${actual} is not the pinned ${expected}`);
  log(`sha256 ok (${actual})`);
  // unpack beside, then move into place: a half-unpacked tree is never taken for the release
  const tarball = join(dir, `${asset}.part`);
  const staging = join(dir, `.unpack-${process.pid}`);
  writeFileSync(tarball, bytes);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging);
  const tar = spawnSync('tar', ['-xzf', tarball, '-C', staging], { encoding: 'utf8' });
  rmSync(tarball, { force: true });
  if (tar.status !== 0) throw new Error(`unpacking ${asset} failed: ${tar.stderr}`);
  const unpacked = asset.replace(/\.tar\.gz$/, '');
  const target = join(dir, unpacked);
  rmSync(target, { recursive: true, force: true });
  renameSync(join(staging, unpacked), target);
  rmSync(staging, { recursive: true, force: true });
  // the release notes ask macOS users to clear the quarantine attributes
  if (process.platform === 'darwin') spawnSync('xattr', ['-cr', target]);
  const bin = cachedBinary() as string;
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
