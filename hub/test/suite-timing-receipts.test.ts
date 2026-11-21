// T1: receipt contracts use in-memory bytes and no native boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimingReceipts, parseReporterTimings, publishTimingReceipt, readTimingReceipts, type TimingReceipt } from '../src/suite-timing-receipts.ts';

test('timing receipts retain exact producer identity and reject malformed samples', () => {
  const row = { run: 'run', head: 'head', tree: 'tree', command: 'unit', step: 'T1', platform: 'linux', samples: [{ file: 'hub/test/unit.test.ts', name: 'case', seconds: 4, outcome: 'pass' }] };
  assert.deepEqual(parseTimingReceipts([row]), [row]);
  for (const value of [undefined, {}, [{ ...row, head: '' }], [{ ...row, platform: '' }], [{ ...row, samples: [{ ...row.samples[0], seconds: -1 }] }], [{ ...row, samples: [{ ...row.samples[0], outcome: 'unknown' }] }]]) assert.equal(parseTimingReceipts(value), undefined);
});

test('runner sidecars atomically retain outcomes across ordered package phases', () => {
  const files = new Map<string, string>();
  const fs = {
    existsSync: (path: string) => files.has(path),
    openSync: (path: string) => { if (!files.has(path)) throw new Error('missing'); return 1; },
    readSync: (_fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
      const bytes = Buffer.from(files.get('/timings')!).subarray(position, position + length);
      bytes.copy(buffer, offset); return bytes.length;
    },
    closeSync: () => {},
    writeFileSync: (path: string, text: string, options: { mode: number }) => { assert.equal(options.mode, 0o600); files.set(path, text); },
    renameSync: (from: string, to: string) => { files.set(to, files.get(from)!); files.delete(from); },
  };
  const receipt: TimingReceipt = { run: 'r', head: 'h', tree: 't', command: 'unit', step: 'T1', platform: 'linux', samples: [{ file: 'unit', name: 'first', seconds: 4, outcome: 'pass' }] };
  publishTimingReceipt(fs, '/timings', receipt);
  const failed: TimingReceipt = { ...receipt, samples: [{ file: 'unit', name: 'second', seconds: 2, outcome: 'fail' }] };
  publishTimingReceipt(fs, '/timings', failed);
  assert.deepEqual(readTimingReceipts(fs, '/timings', parseTimingReceipts), [receipt, failed]);
  files.set('/timings', 'damaged');
  assert.throws(() => publishTimingReceipt(fs, '/timings', receipt), /unusable earlier/);
  files.clear();
  const sample = { file: 'unit', name: 'x'.repeat(8192), seconds: 4, outcome: 'pass' as const };
  assert.throws(() => publishTimingReceipt(fs, '/timings', { ...receipt, samples: Array(2100).fill(sample) }), /exceeds byte limit/);
  assert.equal(files.size, 0, 'oversize output never mutates the sidecar or its temporary file');
  assert.deepEqual(parseReporterTimings([{ overheadMs: 1 }, ...receipt.samples]), [{ overheadMs: 1 }, ...receipt.samples]);
  assert.equal(parseReporterTimings([{ overheadMs: -1 }]), undefined);
  assert.equal(parseReporterTimings([{ file: 'unit', name: 'missing outcome', seconds: 1 }]), undefined);
});

test('timing ingestion caps collected bytes and closes on oversized or failed reads', () => {
  for (const mode of ['oversize', 'missing', 'read failure', 'close failure']) {
    let kept = 0, closed = 0;
    const fs = {
      openSync: () => { if (mode === 'missing') throw new Error('absent'); return 1; },
      readSync: (_fd: number, bytes: Buffer, _offset: number, length: number) => {
        if (mode === 'read failure') throw new Error('denied');
        if (mode === 'close failure') return 0;
        kept += length; assert.ok(kept <= 16777217); bytes.fill(32); return length;
      },
      closeSync: () => { closed++; if (mode === 'close failure') throw new Error('denied'); },
    };
    assert.equal(readTimingReceipts(fs, '/timings', parseTimingReceipts), undefined);
    assert.equal(closed, mode === 'missing' ? 0 : 1);
    assert.equal(kept, mode === 'oversize' ? 16777217 : 0);
  }
});
