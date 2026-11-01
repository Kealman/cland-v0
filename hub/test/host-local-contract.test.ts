// T3: native local Host process contract; no hub, provider or transport is started.
// Lifecycle: disposable root/environment; stop and observe all children before removal.
import test, { mock } from 'node:test';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import { eventually } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';
import { syncBuiltinESMExports } from 'node:module';
import { hostContract } from './host-contract.ts';
import { localHost } from '../src/host/local.ts';
// Keep Node's generated test location on this executable file for exact-name replay.
const diagnostics: Record<string, unknown>[] = [];
hostContract(env => localHost(env, entry => { diagnostics.push(entry); }), (name, run) => test(name, run), { name: 'local', limitPolls: true }, {
  diagnostics,
  failLogClose: path => {
    const open = fs.open;
    const nativeSpawn = cp.spawn;
    const children: Array<{ stop: () => Promise<void>; exited: Promise<void> }> = [];
    const native = mock.method(cp, 'spawn', (...args: Parameters<typeof nativeSpawn>) => {
      // cland-allow-child-env: read-only/native Host contract passes its sealed disposable environment unchanged.
      const child = nativeSpawn(...args);
      if (args[0] === process.execPath) children.push({ stop: ownProcess(undefined, child.pid), exited: new Promise<void>(resolve => child.once('exit', () => resolve())) });
      return child;
    });
    const intercepted = mock.method(fs, 'open', async (...args: Parameters<typeof open>) => {
      const handle = await open(...args);
      if (args[0] === path) {
        const close = handle.close.bind(handle);
        handle.close = async () => { await close(); throw new Error('synthetic log close failure'); };
      }
      return handle;
    });
    syncBuiltinESMExports();
    return async () => {
      intercepted.mock.restore(); native.mock.restore(); syncBuiltinESMExports();
      for (const child of children) {
        await child.stop();
        let reaped = false;
        void child.exited.then(() => { reaped = true; });
        await eventually('fault owner native exit receipt', () => reaped || undefined);
        await child.exited;
      }
    };
  },
});
