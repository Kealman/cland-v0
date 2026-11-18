// T1: producer receipts and uploaded programs use in-memory I/O, never a process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { parseTierReceipts, readTierReceipts, receiptStep, tierReceipt, tierReceiptWriterProgram, type TierReceipt } from '../src/verification-tier-receipts.ts';

const owner = { id: 'run', tree: 'tree' };
const step = { name: 'T1' as const, command: 'unit' };

test('native step outcomes produce receipts on success failure and rejection', async () => {
  const rows: TierReceipt[] = [];
  await receiptStep(rows, owner, step, async () => ({ code: 0 }));
  await receiptStep(rows, owner, step, async () => ({ code: 2 }));
  const rejection = new Error('native command rejected');
  await assert.rejects(receiptStep(rows, owner, step, async () => { throw rejection; }), error => error === rejection);
  assert.deepEqual(rows, [
    { run: 'run', tree: 'tree', tier: 'T1', command: 'unit', exit: 0, completion: 'complete' },
    { run: 'run', tree: 'tree', tier: 'T1', command: 'unit', exit: 2, completion: 'complete' },
    { run: 'run', tree: 'tree', tier: 'T1', command: 'unit', exit: null, completion: 'incomplete' },
  ]);
});

test('receipt grammar rejects missing malformed and oversized inventories', () => {
  const row = tierReceipt(owner, step, 0);
  assert.deepEqual(parseTierReceipts([row]), [row]);
  for (const value of [undefined, {}, [{ ...row, tree: '' }], [{ ...row, exit: -1 }], [{ ...row, completion: 'unknown' }], Array(33).fill(row)]) assert.equal(parseTierReceipts(value), undefined);
});

test('uploaded writer atomically publishes ordered native exits', () => {
  const files = new Map<string, string>();
  const moves: string[][] = [];
  const fs = {
    openSync: (path: string) => { if (!files.has(path)) throw new Error('absent'); return 9; },
    readSync: (_fd: number, bytes: Buffer, offset: number, length: number, position: number) => {
      const chunk = Buffer.from(files.get('/receipt')!).subarray(position, position + length);
      chunk.copy(bytes, offset); return chunk.length;
    },
    closeSync: () => {},
    writeFileSync: (path: string, bytes: string, options: { mode: number }) => { assert.equal(options.mode, 0o600); files.set(path, bytes); },
    renameSync: (from: string, to: string) => { moves.push([from, to]); files.set(to, files.get(from)!); files.delete(from); },
  };
  for (const code of [143, 0]) {
    const process = { argv: ['node', '/receipt', String(code)], exitCode: 0 };
    runInNewContext(tierReceiptWriterProgram(owner, step), { Buffer, process, require: (name: string) => { assert.equal(name, 'fs'); return fs; } });
    assert.equal(process.exitCode, 0);
  }
  assert.deepEqual(JSON.parse(files.get('/receipt')!), [tierReceipt(owner, step, 143), tierReceipt(owner, step, 0)]);
  assert.deepEqual(moves, [['/receipt.tmp', '/receipt'], ['/receipt.tmp', '/receipt']]);
});

test('ingestion enforces its byte limit during reads and closes its descriptor', () => {
  for (const mode of ['valid', 'oversize', 'read failure', 'close failure']) {
    const content = Buffer.from(mode === 'oversize' ? 'x'.repeat(100000) : JSON.stringify([tierReceipt(owner, step, 0)]));
    let kept = 0, closed = 0;
    const fs = {
      openSync: () => 9,
      readSync: (_fd: number, bytes: Buffer, offset: number, length: number, position: number) => {
        if (mode === 'read failure') throw new Error('read denied');
        const chunk = content.subarray(position, position + Math.min(length, 37));
        chunk.copy(bytes, offset); kept += chunk.length; assert.ok(kept <= 65537); return chunk.length;
      },
      closeSync: () => { closed++; if (mode === 'close failure') throw new Error('close denied'); },
    };
    const rows = readTierReceipts(fs, '/receipt', parseTierReceipts);
    if (mode === 'valid') assert.deepEqual(rows, [tierReceipt(owner, step, 0)]);
    else assert.equal(rows, undefined);
    assert.equal(closed, 1);
    if (mode === 'oversize') assert.equal(kept, 65537);
  }
});
