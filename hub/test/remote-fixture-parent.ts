// Subprocess seam: leave a fully started real fixture without relying on its after hook.
import test from 'node:test';
import { fixture } from './remote-fixture.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { spawn } from 'node:child_process';
import { fileBarrierCode } from './file-barrier.ts';

const mode = process.argv[2];
if (mode === 'file-worker') {
  const worker = spawn(process.execPath, ['-e', `${fileBarrierCode};process.send('ready')`], { cwd: process.argv[3], detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  worker.once('message', () => { process.send!({ worker: worker.pid }); worker.disconnect(); });
} else {
  test(`remote fixture owner ${mode}`, { timeout: mode === 'timeout' ? 10000 : undefined }, async t => {
    t.after(() => { if (process.connected) process.disconnect(); });
    // A surviving watchdog cannot hide the signal-cleanup race by noticing a
    // deleted lease on its next fast poll; teardown must actively stop it.
    const f = await fixture(t, mode?.startsWith('watchdog') ? { test: `node -e "setInterval(()=>{},1000)"`, env: { CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '60000' } } : {});
    let watchdogs: number[] = [];
    if (mode?.startsWith('watchdog')) {
      const job = await f.launch();
      await f.remote(job.id);
      watchdogs = (await readLeases(f.root)).map(lease => lease.watchdog!.pid);
    }
    process.send!({ root: f.root, territory: f.territory, api: f.api.stateRoot, hub: f.discovery.pid, guard: f.guard.pid, watchdogs });
    // Give the observer time to capture identities before any fast teardown.
    await new Promise(resolve => process.once('message', resolve));
    if (mode === 'watchdog-teardown') {
      process.disconnect(); return;
    }
    if (mode === 'normal') { process.disconnect(); return; }
    if (mode === 'exit') process.exit(0);
    await new Promise(() => {});
  });
}
