import { withTerritoryLockAsync } from '../territory.ts';
import { spawn } from 'node:child_process';
import { createServer, type Socket } from 'node:net';
import { chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { localHost } from './local.ts';
import { stopGitDaemon } from './git-daemon-stop.ts';
import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';

/** The only environment admitted to a host's territory daemon. */
export function gitDaemonEnvironment(host: string, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: base.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', CLAND_PUSH_HOST: host, GIT_CONFIG_COUNT: '4' };
  for (const [i, [key, value]] of Object.entries({ 'receive.fsckObjects': 'true', 'receive.autogc': 'false', 'receive.denyDeletes': 'true', 'receive.maxInputSize': '134217728' }).entries()) {
    env[`GIT_CONFIG_KEY_${i}`] = key;
    env[`GIT_CONFIG_VALUE_${i}`] = value;
  }
  return env;
}

export type GitDaemonOptions = {
  host: string;
  /** Parent directory is private and owned by the caller; existing paths are never unlinked. */
  socket: string;
  territory: string;
  env?: NodeJS.ProcessEnv;
  /** Stalled receive ownership cap; production defaults to 30 seconds. */
  receiveTimeoutMs?: number;
  /** Bounded territory acquisition; defaults to 30 seconds. */
  receiveLockWaitMs?: number;
  log: (row: Record<string, unknown>) => void;
};

/** One listener per host, owned and closed by the transport owner. No TCP bind. */
export async function startGitDaemon(options: GitDaemonOptions, chmodSocket: typeof chmod = chmod) {
  const receiveTimeoutMs = options.receiveTimeoutMs ?? HOST_PUSH_TIMEOUT_MS;
  if (!Number.isFinite(receiveTimeoutMs) || receiveTimeoutMs <= 0 || receiveTimeoutMs > 2_147_483_647) throw new Error('receive timeout must be a positive finite timer duration');
  const receiveLockWaitMs = options.receiveLockWaitMs ?? HOST_PUSH_LOCK_WAIT_MS;
  if (!Number.isFinite(receiveLockWaitMs) || receiveLockWaitMs <= 0 || receiveLockWaitMs > HOST_PUSH_LOCK_WAIT_MS) throw new Error('receive lock wait must be between 0 (exclusive) and 30000 ms');
  const env = withoutExecutorCredentials(gitDaemonEnvironment(options.host, options.env ?? process.env));
  const native = localHost(options.env);
  const active = new Set<{ stop: () => Promise<void>; done: Promise<void> }>();
  const sockets = new Set<Socket>();
  const admissions = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  let sequence = 0;
  let ownershipFailure: unknown;
  const log = (row: Record<string, unknown>) => { try { options.log({ ...row, host: options.host }); } catch { /* observers cannot lose child ownership */ } };
  const territory = resolve(options.territory);
  const server = createServer({ allowHalfOpen: true }, socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    if (closing || ownershipFailure || admissions.size >= 8) {
      log({ event: 'host-git-refused', reason: closing ? 'closing' : ownershipFailure ? 'cleanup-incomplete' : 'capacity', limit: 8 });
      socket.destroy();
      return;
    }
    // Inspect the bounded first pkt-line before starting a daemon. Uploads never take
    // the write lock. Retain the exact bytes for git daemon's own protocol parser.
    socket.pause();
    let writeOwned = false;
    const admission = (async () => {
      const packet = await firstPacket(socket);
      const launch = async () => {
        if (closing || socket.destroyed) return;
        socket.unshift(packet);
        const connection = ++sequence;
        const started = performance.now();
        const child = spawn('git', ['-c', 'gc.auto=0', 'daemon', '--inetd', '--strict-paths', `--base-path=${dirname(territory)}`, '--export-all', '--enable=receive-pack', '--log-destination=stderr', territory], { env, cwd: territory, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
        // Capture authority from this native launch, never from stored PID metadata.
        const identity = new Promise<Awaited<ReturnType<typeof native.identity>>>(done => {
          child.once('spawn', () => { log({ event: 'host-git-start', connection, pid: child.pid }); void native.identity(child.pid!).then(done, () => done(null)); });
          child.once('error', () => done(null));
        });
        let completed = false;
        let stopping: Promise<void> | undefined;
        const stop = () => stopping ??= stopGitDaemon({
          disconnect: () => { socket.destroy(); child.stdin.destroy(); },
          identity, completed: () => completed, stop: proof => native.stop(proof), done,
        });
        const done = new Promise<void>(finish => child.once('close', (code, signal) => {
          completed = true;
          socket.end(() => socket.destroy());
          void identity.then(() => {
            active.delete(owner);
            log({ event: 'host-git-exit', connection, durationMs: Math.round(performance.now() - started), code, signal });
            finish();
          });
        }));
        const owner = { stop, done };
        active.add(owner);
        // Never log stderr: Git hooks may echo secrets or client-controlled bytes.
        child.stderr.resume();
        child.on('error', () => { socket.destroy(); });
        child.stdin.on('error', () => {});
        child.stdout.on('error', () => { void stop().catch(() => log({ event: 'host-git-stop-incomplete', connection })); });
        socket.on('close', () => { if (!completed) void stop().catch(() => log({ event: 'host-git-stop-incomplete', connection })); });
        socket.pipe(child.stdin);
        child.stdout.pipe(socket);
        socket.resume();
        return done;
      };
      if (packet.subarray(4).toString().startsWith('git-receive-pack ')) {
        await withTerritoryLockAsync(dirname(dirname(territory)), async () => {
          writeOwned = true;
          const timeout = setTimeout(() => socket.destroy(), receiveTimeoutMs);
          timeout.unref();
          try { await launch(); }
          finally { clearTimeout(timeout); }
        }, undefined, receiveLockWaitMs);
      } else await launch();
    })().catch(error => {
      if (writeOwned) {
        ownershipFailure ??= error;
        log({ event: 'host-git-stop-incomplete', reason: 'write-ownership' });
      }
      if (!socket.destroyed) {
        const message = `ERR cland: host ${options.host}: push retry required: ${error instanceof Error ? error.message : String(error)}\n`;
        socket.end(Buffer.from((Buffer.byteLength(message) + 4).toString(16).padStart(4, '0') + message), () => socket.destroy());
      }
    });
    admissions.add(admission);
    void admission.finally(() => admissions.delete(admission));

  });
  const close = () => closing ??= (async () => {
    const closed = new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
    for (const socket of sockets) socket.destroy();
    await Promise.all([...active].map(owner => owner.stop()));
    await Promise.all([...admissions]);
    await closed;
    if (ownershipFailure) throw new AggregateError([ownershipFailure], 'Git write ownership cleanup incomplete');
  })();
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(options.socket, () => { server.off('error', fail); done(); });
  });
  try { await chmodSocket(options.socket, 0o600); }
  catch (error) {
    try { await close(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'Git socket acquisition cleanup incomplete'); }
    throw error;
  }
  return { address: () => server.address(), close };
}

/** Maximum wait for a prior territory operation, separate from native receive ownership. */
export const HOST_PUSH_LOCK_WAIT_MS = 30_000;

/** Bounds both first-packet admission and a stalled push's ownership of territory.lock. */
export const HOST_PUSH_TIMEOUT_MS = 30_000;
function firstPacket(socket: Socket): Promise<Buffer> {
  return new Promise((done, fail) => {
    let bytes = Buffer.alloc(0);
    const timer = setTimeout(() => finish(new Error('Git request timeout')), HOST_PUSH_TIMEOUT_MS);
    timer.unref();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      socket.off('data', data); socket.off('close', closed); socket.off('error', failed);
      socket.pause();
      if (error) fail(error); else done(bytes);
    };
    const closed = () => finish(new Error('Git client closed before request'));
    const failed = (error: Error) => finish(error);
    const data = (chunk: Buffer) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length < 4) return;
      const header = bytes.subarray(0, 4).toString();
      const size = /^[0-9a-f]{4}$/i.test(header) ? Number.parseInt(header, 16) : 0;
      if (size < 5 || size > 65_520 || bytes.length > 65_536) { finish(new Error('invalid Git request')); return; }
      if (bytes.length >= size) finish();
    };
    socket.on('data', data); socket.once('close', closed); socket.once('error', failed);
    socket.resume();
  });
}
