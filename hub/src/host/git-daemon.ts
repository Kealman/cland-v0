import { spawn } from 'node:child_process';
import { createServer, type Socket } from 'node:net';
import { chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { localHost } from './local.ts';
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
  log: (row: Record<string, unknown>) => void;
};

/** One listener per host, owned and closed by the transport owner. No TCP bind. */
export async function startGitDaemon(options: GitDaemonOptions, chmodSocket: typeof chmod = chmod) {
  const env = withoutExecutorCredentials(gitDaemonEnvironment(options.host, options.env ?? process.env));
  const native = localHost(options.env);
  const active = new Set<{ stop: () => Promise<void>; done: Promise<void> }>();
  const sockets = new Set<Socket>();
  let closing: Promise<void> | undefined;
  let sequence = 0;
  const log = (row: Record<string, unknown>) => { try { options.log({ ...row, host: options.host }); } catch { /* observers cannot lose child ownership */ } };
  const territory = resolve(options.territory);
  const server = createServer({ allowHalfOpen: true }, socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    if (closing || active.size >= 8) {
      log({ event: 'host-git-refused', reason: closing ? 'closing' : 'capacity', limit: 8 });
      socket.destroy();
      return;
    }
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
    const stop = () => stopping ??= (async () => {
      socket.destroy(); child.stdin.destroy();
      const proof = await identity;
      if (!completed && (!proof || !await native.stop(proof))) throw new Error('Git daemon termination incomplete');
      await done;
    })();
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
  });
  const close = () => closing ??= (async () => {
    const closed = new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
    for (const socket of sockets) socket.destroy();
    await Promise.all([...active].map(owner => owner.stop()));
    await closed;
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
