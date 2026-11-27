import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable, Writable } from 'node:stream';
import assert from 'node:assert/strict';
import type { stageCase } from './stage-case-fixture.ts';

/** A synthetic Git object database: full diff capture fails, streaming drains it. */
export function largePatchFixture(scope: ReturnType<typeof stageCase>, mode: 'large' | 'empty' | 'missing identity' | 'oversize' | 'diff failure' | 'spawn failure' | 'abort' = 'large', closeGate?: Promise<void>) {
  const root = '/large-patch-fixture';
  let bytes = 0, peak = 0;
  let source: Readable | undefined;
  const total = mode === 'empty' ? 0 : 20 * 1024 * 1024;
  let launched = 0, closedCount = 0;
  const started = Promise.withResolvers<void>(), stopped = Promise.withResolvers<void>();
  const abort = new AbortController();
  const children: Array<{ kill: (signal?: string) => boolean }> = [];
  let stopping = false;
  // Enrol cancellation before installing/acquiring a native fake. The owner
  // invokes releases before joining the entire original callback.
  scope.releaseOnClose(() => {
    stopping = true;
    abort.abort(new Error('fixture patch cancelled'));
    for (const child of children) child.kill();
  });
  scope.requireClose(async () => { assert.equal(closedCount, launched, 'every launched fake Git child closed before fixture release'); });
  scope.patch(cp, 'execFile', (_file: string, args: string[], options: { maxBuffer: number }, callback: Function) => {
    if (stopping) throw new Error('fixture native acquisition closed');
    assert.equal(args[0], 'diff');
    assert.ok(total > options.maxBuffer, 'the synthetic rewritten blob exceeds the native capture limit');
    const child = new EventEmitter();
    Object.assign(child, { stdin: new PassThrough(), kill: () => true });
    queueMicrotask(() => callback(Object.assign(new RangeError('stdout maxBuffer length exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }), ''));
    return child;
  });
  scope.patch(cp, 'spawn', (file: string, args: string[]) => {
    if (stopping) throw new Error('fixture native acquisition closed');
    assert.equal(file, 'git');
    assert.ok(['diff', 'patch-id'].includes(args[0]!));
    if (mode === 'spawn failure' && args[0] === 'diff') throw new Error('diff launch failed');
    launched++;
    const child = new EventEmitter();
    const stderr = new PassThrough();
    const stdout = mode === 'abort' ? new Readable({ read() {} }) : args[0] === 'diff' ? Readable.from((function* () {
      for (let sent = 0; sent < total; sent += 65536) yield Buffer.alloc(65536, 120);
    })(), { objectMode: false, highWaterMark: 65536 }) : new PassThrough();
    if (args[0] === 'diff') source = stdout;
    const stdin = new Writable({ write(chunk, _encoding, done) {
      bytes += chunk.length;
      peak = Math.max(peak, chunk.length + (source?.readableLength ?? 0));
      queueMicrotask(done);
    }, final(done) {
      if (args[0] === 'patch-id') {
        if (mode !== 'empty' && mode !== 'missing identity') stdout.push(mode === 'oversize' ? Buffer.alloc(8192, 120) : 'stable-patch\n');
        stdout.push(null);
      }
      done();
    } });
    let closing = false;
    const close = (signal: string | null = null) => {
      if (closing) return;
      closing = true;
      const emit = () => { closedCount++; stderr.end(); child.emit('close', signal ? null : mode === 'diff failure' && args[0] === 'diff' ? 1 : 0, signal); };
      if (closeGate) void closeGate.then(emit); else emit();
    };
    stdout.on('end', () => close());
    const owner = { kill: (signal = 'SIGTERM') => { stdout.destroy(); stdin.destroy(); stopped.resolve(); close(signal); return true; } };
    children.push(owner);
    Object.assign(child, { stdin, stdout, stderr, ...owner });
    if (launched === 2) started.resolve();
    return child;
  });
  return { root, signal: abort.signal, abort: () => abort.abort(new Error('fixture patch cancelled')),
    started: started.promise, stopped: stopped.promise, closed: () => closedCount,
    bytes: () => bytes, peak: () => peak };
}
