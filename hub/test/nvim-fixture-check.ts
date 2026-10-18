import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { FRAME_FIXTURES, parseRecordings, type Recording } from '../../nvim/test/frame-fixtures.ts';
import { recordedOutput } from './nvim-frame-source.ts';
export function assertRecordings(recordings: Record<string, Recording>, produce = recordedOutput): void {
  assert.ok(Object.keys(recordings).length > 0, 'protocol recording catalog must not be empty');
  for (const [key, { operation, input, output }] of Object.entries(recordings)) {
    assert.deepEqual(produce(operation, input), output, `Neovim ${operation} fixture ${key} drifted; run npm run test:nvim-fixtures`);
  }
}
export async function checkRecordings(): Promise<void> {
  assertRecordings(parseRecordings(await readFile(FRAME_FIXTURES, 'utf8')));
}
export async function checkLiveFrames(frames: unknown): Promise<void> {
  const path = new URL('../../nvim/test/fixtures/live-protocol-frames.json', import.meta.url);
  if (process.env.CLAND_REWRITE_NVIM_FIXTURES === '1') await writeFile(path, JSON.stringify(frames, null, 2) + '\n');
  assert.deepEqual(frames, JSON.parse(await readFile(path, 'utf8')), 'live hub protocol drifted; run npm run test:nvim-fixtures');
}
