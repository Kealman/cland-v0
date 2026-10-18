// T3 maintenance: hub-side producers record the frames served to real clients.
// Running each existing test whole-file also preserves its assertion contract.
import { spawn } from 'node:child_process';
import { glob, mkdir, mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, loadavg } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordedOutput } from './nvim-frame-source.ts';
import { recordingKey, FRAME_FIXTURES, FRAME_SLICES, frameSlicePath, selectRecordings, serializeRecordings, parseRecordings, type Recording } from '../../nvim/test/frame-fixtures.ts';
const preload = new URL('./nvim-recorder-preload.ts', import.meta.url).href;
function run(file: string, env: NodeJS.ProcessEnv, pattern?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), file], { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`fixture refresh failed: ${file}`)));
  });
}
export async function refresh(files: string[], retain = false, slice = false): Promise<void> {
  const recordings: Record<string, Recording> = retain ? parseRecordings(await readFile(FRAME_FIXTURES, 'utf8').catch(() => '{}')) : {};
  const dir = await mkdtemp(join(tmpdir(), 'cland-nvim-recordings-'));
  const path = join(dir, 'frames.jsonl');
  try {
    for (const file of files) {
      if (loadavg()[0]! >= 15) throw new Error('fixture refresh needs one-minute load below 15');
      await writeFile(path, '');
      await run(file, { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${preload}`, TEST_NVIM_RECORDINGS_PATH: path });
      const keys = new Set<string>();
      for (const line of (await readFile(path, 'utf8')).split('\n').filter(Boolean)) {
        const r = JSON.parse(line) as Recording;
        const key = recordingKey(r.operation, r.input);
        recordings[key] = r;
        keys.add(key);
        if (r.operation === 'config') {
          const input = { ...r.input as object, source: '' };
          recordings[recordingKey('config', input)] = { operation: 'config', input, output: recordedOutput('config', input) };
        }
      }
      await writeFile(FRAME_FIXTURES, serializeRecordings(recordings));
      if (slice || existsSync(frameSlicePath(file))) {
        await mkdir(FRAME_SLICES, { recursive: true });
        await writeFile(frameSlicePath(file), serializeRecordings(selectRecordings(recordings, keys)));
      }
    }
    process.stdout.write(`Recorded ${Object.keys(recordings).length} Neovim protocol frames\n`);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tiers = JSON.parse(await readFile(new URL('./tiers.json', import.meta.url), 'utf8')).tests;
  const files = new Set(Object.keys(tiers).filter(file => file.startsWith('nvim/test/') && tiers[file] === 'T2'));
  for await (const file of glob('nvim/test/**/*.test.ts')) if ((await readFile(file, 'utf8')).includes('stub-hub.ts')) files.add(file);
  const slice = process.argv.includes('--slice');
  const requested = process.argv.slice(2).filter(arg => arg !== '--slice');
  if (requested[0] === '--from-recordings') {
    const recordings = parseRecordings(await readFile(FRAME_FIXTURES, 'utf8'));
    for (const r of Object.values(recordings)) r.output = recordedOutput(r.operation, r.input);
    await writeFile(FRAME_FIXTURES, serializeRecordings(recordings));
    for (const file of await readdir(FRAME_SLICES).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
      const path = new URL(file, FRAME_SLICES);
      const keys = Object.keys(parseRecordings(await readFile(path, 'utf8')));
      await writeFile(path, serializeRecordings(selectRecordings(recordings, keys)));
    }
  } else await refresh(requested.length ? requested : [...files].sort(), requested.length > 0, slice);
  if (!requested.length || requested[0] === '--from-recordings') await run('nvim/test/scenarios/workbench.test.ts', { ...process.env, CLAND_REWRITE_NVIM_FIXTURES: '1' }, 'recorded protocol fixtures');
}
