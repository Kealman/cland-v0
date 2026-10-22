// T3 maintenance: hub-side producers record the frames served to real clients.
// Running each existing test whole-file also preserves its assertion contract.
import { spawn } from 'node:child_process';
import { glob, mkdir, mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, loadavg } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordedOutput } from './nvim-frame-source.ts';
import { frameConsumers } from './nvim-frame-consumers.ts';
import { fixtureSource } from './source-fixture.ts';
import { FRAME_FIXTURES, FRAME_SLICES, frameSlicePath, selectRecordings, serializeRecordings, parseRecordings, type Recording } from '../../nvim/test/frame-fixtures.ts';
import { assertRecordingRun, refreshFrameCatalog } from './nvim-frame-refresh.ts';
const preload = new URL('./nvim-recorder-preload.ts', import.meta.url).href;
function run(file: string, env: NodeJS.ProcessEnv, pattern?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), file], { stdio: ['inherit', 'pipe', 'inherit'], env });
    child.stdout.on('data', chunk => { output += chunk.toString(); process.stdout.write(chunk); });
    child.once('error', reject);
    child.once('close', code => {
      try { assertRecordingRun(file, code, output); resolve(); } catch (error) { reject(error); }
    });
  });
}
export async function refresh(files: string[], retain = false, slice = false): Promise<void> {
  const catalog = parseRecordings(await readFile(FRAME_FIXTURES, 'utf8'));
  const slices = new Map<string, Record<string, Recording>>();
  for (const file of files) {
    if (existsSync(frameSlicePath(file))) slices.set(file, parseRecordings(await readFile(frameSlicePath(file), 'utf8')));
    else if (slice) slices.set(file, {});
  }
  const dir = await mkdtemp(join(tmpdir(), 'cland-nvim-recordings-'));
  const path = join(dir, 'frames.jsonl');
  try {
    const count = await refreshFrameCatalog(files, retain, {
      catalog, slices,
      capture: async file => {
        if (loadavg()[0]! >= 15) throw new Error('fixture refresh needs one-minute load below 15');
        await writeFile(path, '');
        // Include soak inputs because a full refresh replaces the catalog.
        await run(file, { ...process.env, CLAND_TEST_SOAK: '1', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${preload}`, TEST_NVIM_RECORDINGS_PATH: path });
        return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as Recording);
      },
      normalize: r => {
        if (r.operation !== 'config') return [r];
        const input = { ...r.input as object, source: '' };
        return [r, { operation: 'config', input, output: recordedOutput('config', input) }];
      },
      publish: async (recordings, capturedSlices) => {
        await writeFile(FRAME_FIXTURES, serializeRecordings(recordings));
        if (capturedSlices.size) await mkdir(FRAME_SLICES, { recursive: true });
        for (const [file, records] of capturedSlices) await writeFile(frameSlicePath(file), serializeRecordings(records));
      },
    });
    process.stdout.write(`Recorded ${count} Neovim protocol frames\n`);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
  } else {
    const candidates: string[] = [];
    if (!requested.length) for await (const file of glob('nvim/test/**/*.test.ts')) candidates.push(file);
    const files = requested.length ? requested : await frameConsumers(
      candidates,
      fixtureSource(fileURLToPath(new URL('../../', import.meta.url))),
    );
    await refresh(files, requested.length > 0, slice);
  }
  if (!requested.length || requested[0] === '--from-recordings') await run('nvim/test/scenarios/workbench.test.ts', { ...process.env, CLAND_REWRITE_NVIM_FIXTURES: '1' }, 'recorded protocol fixtures');
}
