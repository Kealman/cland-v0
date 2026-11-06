import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

// A checkout matching the build key is still cold until this script installed it.
type Inputs = { lock?: string; provision?: string; nvim?: { tag: string; digest: string } };
const key: Inputs | undefined = process.env.CLAND_PREPARE_KEY ? JSON.parse(process.env.CLAND_PREPARE_KEY) : undefined;
const marker = 'node_modules/.cland-prepare-key';
async function readInputs(path: string): Promise<Inputs> {
  return readFile(path, 'utf8').then(text => JSON.parse(text), error => {
    if (error.code === 'ENOENT') return {};
    throw error;
  });
}
// Images built before this script already carry a successful-install receipt.
// Reuse it only while their installed dependencies still exist.
const hasDependencies = await stat('node_modules').then(info => info.isDirectory(), error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});
const installed = await readInputs(marker);
const legacy = hasDependencies && process.env.HOME ? await readInputs(`${process.env.HOME}/.cland-image.json`) : {};
const inputs = installed.lock ? installed : legacy;
const lock = createHash('sha256').update(await readFile('package-lock.json')).digest('hex');
const tag = (await readFile('nvim/NVIM_VERSION', 'utf8')).trim();
const sums = await readFile('nvim/NVIM_SHA256SUMS', 'utf8');
const digest = sums.split('\n').find(line => /\s+nvim-linux-x86_64\.tar\.gz$/.test(line))?.trim().split(/\s+/)[0];
if (!digest || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('invalid Neovim Linux prepare digest');
const hookPin = await readFile('.cache/nvim/.cland-installed.json', 'utf8').then(text => JSON.parse(text) as { tag: string; digest: string }, error => {
  if (error.code === 'ENOENT') return undefined;
  throw error;
});
const pins = [installed.nvim, hookPin, legacy.nvim];
const installedPin = pins.find(pin => pin?.tag === tag && pin.digest === digest) ?? installed.nvim ?? hookPin ?? legacy.nvim;
if (pins.some(pin => pin?.tag === tag && pin.digest && pin.digest !== digest) || installedPin?.tag === tag && installedPin.digest !== digest) throw new Error('Neovim same-tag digest mismatch; rebuild the prepared snapshot before retrying');
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (key?.lock === lock && inputs.lock === lock) console.log('dependencies match snapshot');
else { console.log('dependencies changed: npm ci'); run('npm', ['ci']); }
if (key !== undefined && installedPin?.tag === tag && installedPin.digest === digest) console.log('Neovim pin matches snapshot');
else { console.log('Neovim pin changed: seed'); run(process.execPath, ['nvim/bin/nvim-path.ts']); }
await mkdir('node_modules', { recursive: true });
await writeFile(marker, `${JSON.stringify({ lock, nvim: { tag, digest } })}\n`);
