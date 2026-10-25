// T2: production serving, delayed background maintenance and owned shutdown; no native processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gitMaintenancePath, maintainProjectGit } from '../src/git-maintenance.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { hostname } from 'node:os';
import { readMaintenanceOwner, recoverMaintenanceOwner, writeMaintenanceOwner, type OwnerState } from '../src/git-maintenance-owner.ts';

for (const next of ['gone', 'alive', 'mismatch'] as const) test(`an incomplete native close hands off ownership and next startup recovers ${next}`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const clock = new FakeClock(), returned = Promise.withResolvers<void>();
  const events: string[] = [];
  const owner = { token: 'held-close', root, cwd: root, gitDirectory: join(root, '.git'), host: hostname(), pid: 424242, group: 424242, started: 'Sun Oct 25 11:00:00 2026' };
  const hub = await projectHub(t, root, {}, {
    clock, log: event => { events.push(String(event.event)); },
    gitMaintenance: (project, meta, env, services) => maintainProjectGit(project, meta, env, {
      ...services, lock: async (_root, operation) => operation(),
      run: async (_bin, args) => {
        if (args.includes('gc')) {
          await writeMaintenanceOwner(root, owner);
          return { code: null, stdout: '', stderr: '', error: 'cancelled; cleanup incomplete: child did not close within 1 s of SIGKILL' };
        }
        return { code: 0, stdout: '', stderr: '' };
      },
    }).finally(() => { returned.resolve(); }),
  });
  await clock.advance(30_000);
  await returned.promise;
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(events.includes('git-maintenance-completed'), false, 'incomplete native close is never a completed collector');
  assert.deepEqual(await readMaintenanceOwner(root), owner);
  await hub.stop();
  assert.deepEqual(await readMaintenanceOwner(root), owner, 'bounded stop preserves the transferred owner after the hub closes');
  let observed: OwnerState = next;
  const signals: number[] = [];
  const recovered = Promise.withResolvers<void>();
  const restarted = await projectHub(t, root, {}, {
    clock: new FakeClock(),
    gitMaintenanceRecovery: async (project, env) => {
      await recoverMaintenanceOwner(project, env, { inspect: async () => observed, kill: value => { signals.push(value.pid); observed = 'gone'; }, now: () => 0, wait: async () => {} });
      recovered.resolve();
    },
  });
  const ui = await connectUi(t, restarted.discovery);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true, 'restart serves alongside recovery');
  await recovered.promise;
  assert.equal(await readMaintenanceOwner(root), null);
  assert.deepEqual(signals, next === 'alive' ? [owner.pid] : [], 'a reused PID is never signalled');
  await restarted.stop();
});

test('the hub serves before delayed maintenance and shutdown waits for its cancelled native close', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>(), closed = Promise.withResolvers<void>(), aborted = Promise.withResolvers<void>();
  let locked = false, nativeClosed = false, commands = 0;
  const starting = projectHub(t, root, {}, {
    clock,
    gitMaintenance: (project, meta, env, services) => {
      services?.signal?.addEventListener('abort', () => aborted.resolve(), { once: true });
      return maintainProjectGit(project, meta, env, {
        ...services,
        lock: async (_root, operation) => {
          locked = true;
          try { return await operation(); }
          finally { assert.equal(nativeClosed, true, 'native close precedes territory-lock release'); locked = false; }
        },
        run: async (_bin, args) => {
          commands++;
          if (args.includes('gc')) {
            entered.resolve();
            await closed.promise;
            nativeClosed = true;
            return { code: null, stdout: '', stderr: '', error: 'cancelled' };
          }
          return { code: 0, stdout: '', stderr: '' };
        },
      });
    },
  });
  t.after(async () => { closed.resolve(); await (await starting).stop(); });
  const first = await Promise.race([starting.then(hub => ({ kind: 'serving' as const, hub })), entered.promise.then(() => ({ kind: 'maintenance' as const }))]);
  if (first.kind !== 'serving') assert.fail('maintenance must not delay the serving receipt');
  const hub = first.hub;
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  assert.equal(commands, 0, 'startup does no maintenance Git I/O');
  await clock.advance(29_999);
  assert.equal(commands, 0, 'the startup peak has a separate thirty-second delay');
  await clock.advance(1);
  await entered.promise;
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true, 'serving stays available beside a held collector');
  const stopping = hub.stop();
  await aborted.promise;
  assert.equal(locked, true);
  assert.equal(nativeClosed, false, 'cancellation alone cannot release ownership');
  closed.resolve();
  await stopping;
  assert.equal(locked, false);
  assert.equal(nativeClosed, true);
  const receipt = JSON.parse(await readFile(gitMaintenancePath(root), 'utf8'));
  assert.match(receipt.repositories[0].error, /cancelled/);
});

test('stopping during the delay cancels maintenance before it launches any command', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  let launches = 0;
  const hub = await projectHub(t, root, {}, { clock, gitMaintenance: async () => { launches++; } });
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await hub.stop();
  await clock.advance(30_000);
  assert.equal(launches, 0);
});
