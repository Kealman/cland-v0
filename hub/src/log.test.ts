import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLinesLog } from './log.ts';

test('the log writes one JSON object per line with a timestamp first', () => {
  const lines: string[] = [];
  const log = jsonLinesLog((line) => lines.push(line), () => new Date('2026-10-08T12:00:00Z'));
  log({ event: 'hello', name: 'alpha' });
  log({ event: 'bye', name: 'alpha', ts: 'kept' });
  assert.deepEqual(lines, ['{"ts":"2026-10-08T12:00:00.000Z","event":"hello","name":"alpha"}\n', '{"ts":"kept","event":"bye","name":"alpha"}\n']);
});
