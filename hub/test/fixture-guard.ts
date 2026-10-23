// Test-only reaper. IPC closure observes even SIGKILL/process.exit in the owner;
// this process remains alive until its fixture writers and directories are gone.
import { fixtureEnvironment } from './fixture-environment.ts';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import type { TestContext } from 'node:test';
import { afterCleanup, cleanupProcesses, ownDirectory } from './process-cleanup.ts';

export async function fixtureGuard(t: TestContext, root: string) {
  const child = fork(fileURLToPath(import.meta.url), [], { env: fixtureEnvironment(root, process.env), detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`fixture guard exited ${code}`)));
  });
  // Teardown still awaits the original promise and reports startup/exit errors.
  void exited.catch(() => {});
  // A normal worker exit must close IPC, rather than wait for its own reaper.
  child.unref(); child.channel!.unref();
  const register = (path: string) => new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer); child.off('message', ready); child.off('exit', stopped);
      if (error) reject(error); else resolve();
    };
    const ready = (message: unknown) => { if (message === path) finish(); };
    const stopped = () => finish(new Error('fixture guard exited before registering its directory'));
    const timer = setTimeout(() => finish(new Error('fixture guard registration exceeded 10 seconds')), 10000);
    child.on('message', ready);
    child.once('exit', stopped);
    child.send(path, error => { if (error) finish(error); });
  });
  afterCleanup(t, async () => {
    child.ref();
    if (child.connected) child.disconnect();
    await exited;
  });
  await register(root);
  return { register, pid: child.pid! };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const roots = new Map<string, { dev: number; ino: number; remove: () => Promise<void> }>();
  process.on('message', (path: string) => {
    const { dev, ino } = statSync(path);
    roots.set(path, { dev, ino, remove: ownDirectory(undefined, path) });
    if (process.connected) process.send!(path, () => {});
  });
  process.once('disconnect', async () => {
    for (const [path, identity] of roots) {
      try {
        let current;
        try { current = statSync(path); } catch { continue; }
        if (current.dev !== identity.dev || current.ino !== identity.ino) continue;
        // Discover only within an inode-verified fixture root. This finds hubs,
        // watchdogs and detached fake machines even after their owner is dead.
        await cleanupProcesses(path, [], undefined, undefined, []);
        await identity.remove();
      } catch { process.exitCode = 1; }
    }
  });
}
