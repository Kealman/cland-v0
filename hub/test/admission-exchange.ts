// Test-owned installed CLI exchange: acquire only after registering every drain.
import type { TestContext } from 'node:test';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { type Clock } from '../src/hub/clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { guardDirectoryRemoval, onCleanup } from './process-cleanup.ts';

export function admissionExchange(t: TestContext, root: string, inspect: (signal: AbortSignal) => Promise<unknown>, options: { clock?: Clock } = {}) {
  const abort = new AbortController();
  let lastNative = 'pending', diagnostic = '';
  const incomplete = () => new Error(`incomplete admission exchange: inspection/child/socket close missing; native=${lastNative}; tail=${diagnostic.slice(-1000)}; fixture retained`);
  const pending = new Set<Promise<unknown>>();
  const sockets = new Map<Socket, Promise<void>>();
  let closed = false, drained = false, disposal: Promise<void> | undefined;
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  const server = createServer(connection => {
    sockets.set(connection, new Promise<void>(resolve => connection.once('close', () => { sockets.delete(connection); resolve(); })));
    connection.on('error', () => {});
    if (closed) { connection.destroy(); return; }
    connection.setEncoding('utf8');
    let input = '';
    connection.on('data', chunk => {
      input += chunk;
      let at: number;
      while (!closed && (at = input.indexOf('\n')) >= 0) {
        const frame = JSON.parse(input.slice(0, at)); input = input.slice(at + 1);
        if (frame.type === 'hello') connection.write('{"type":"welcome"}\n');
        else if (frame.type === 'suite.start') {
          track(Promise.resolve().then(() => { abort.signal.throwIfAborted(); return inspect(abort.signal); }).then(value => {
            if (!closed) connection.end(JSON.stringify({ type: 'result', id: frame.id, ok: true, value }) + '\n');
          }, (error: Error) => {
            if (!closed) connection.end(JSON.stringify({ type: 'result', id: frame.id, ok: false, error: error.message }) + '\n');
          }));
        }
      }
    });
  });
  const socket = join(root, 'admission.sock');
  const dispose = () => disposal ??= (async () => {
    closed = true;
    abort.abort(new Error('admission exchange closed'));
    const listenerClosed = new Promise<void>((resolve, reject) => server.close(error => {
      if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolve();
    }));
    const nativeClosed = [...sockets.values()];
    for (const connection of sockets.keys()) connection.destroy();
    // Inspection has no cancellation port: stop admission and join its real work.
    // Failure retains the root via the same guard; a timeout never means drained.
    await within(Promise.all([...pending, ...nativeClosed, listenerClosed]), 45_000, options.clock, incomplete);
    drained = true;
    t.signal.removeEventListener('abort', cancel);
  })().catch(error => { disposal = undefined; throw error; });
  const cancel = () => { void dispose().catch(() => {}); };
  onCleanup(t, dispose);
  guardDirectoryRemoval(root, dispose);
  t.signal.addEventListener('abort', cancel, { once: true });
  if (t.signal.aborted) cancel();
  return {
    socket, signal: abort.signal, dispose, drained: () => drained,
    async listen() {
      if (closed) throw new Error('admission exchange closed');
      const ready = new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen({ path: socket, signal: abort.signal }, () => { server.removeListener('error', reject); resolve(); });
        abort.signal.addEventListener('abort', () => reject(abort.signal.reason), { once: true });
      });
      try { await within(ready, 5000, undefined, () => new Error('admission listener setup receipt missing')); }
      catch (error) { await dispose(); throw error; }
    },
    async run(cli: string, project: string) {
      if (closed) throw new Error('admission exchange closed');
      // ExecFile callback observes output; native close is the ownership receipt.
      const completed = Promise.withResolvers<{ stdout: string; stderr: string; code: number | string | null; signal: NodeJS.Signals | null }>();
      const child = execFile(process.execPath, [cli, 'verify', '--dry-run'], {
        cwd: project, env: fixtureEnvironment(root, process.env), timeout: 30_000,
        signal: abort.signal, killSignal: 'SIGKILL',
      }, (error, stdout, stderr) => {
        const result = { stdout, stderr, code: error ? error.code ?? null : 0, signal: error?.signal ?? null };
        lastNative = `${result.code}/${result.signal ?? 'none'}`;
        diagnostic = stderr;
        completed.resolve(result);
      });
      const nativeClosed = new Promise<void>(resolve => child.once('close', () => resolve()));
      const result = track(Promise.all([completed.promise, nativeClosed]).then(([result]) => result));
      try { return await within(result, 35_000, options.clock, () => new Error('installed CLI operation receipt missing')); }
      catch (error) { await dispose(); throw error; }
    },
  };
}
