import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

// A checkout matching the build key is still cold until this script installed it.
type Inputs = { lock?: string; nvim?: { tag: string } };
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
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (key?.lock === lock && inputs.lock === lock) console.log('dependencies match snapshot');
else { console.log('dependencies changed: npm ci'); run('npm', ['ci']); }
if (key?.nvim?.tag === tag && inputs.nvim?.tag === tag) console.log('Neovim pin matches snapshot');
else { console.log('Neovim pin changed: seed'); run(process.execPath, ['nvim/bin/nvim-path.ts']); }
await mkdir('node_modules', { recursive: true });
await writeFile(marker, `${JSON.stringify({ lock, nvim: { tag } })}\n`);
