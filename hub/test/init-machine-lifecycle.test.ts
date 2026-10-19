// T3: cancelling a test with a held scratch CLI reaps the writer and joins its result before removing its root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { commandIn, scratchMachine } from './init-machine.ts';

test('cancelled scratch CLI closes before its directory is removed', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const receipt = join(machine.root, 'receipt.json');
  const probe = join(machine.root, 'hold.mjs');
  await writeFile(probe, `
    import { createConnection } from 'node:net';
    import { writeFileSync } from 'node:fs';
    writeFileSync(process.env.HOME + '/writer', 'held');
    const socket = createConnection(process.env.READY_SOCKET);
    socket.once('connect', () => socket.write(String(process.pid)));
  `);
  const fixture = join(machine.root, 'cancel.test.mjs');
  await writeFile(fixture, `
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { once } from 'node:events';
    import { createServer } from 'node:net';
    import { existsSync, writeFileSync } from 'node:fs';
    import { pathToFileURL } from 'node:url';
    import { initIn, scratchMachine } from ${JSON.stringify(new URL('./init-machine.ts', import.meta.url).href)};
    import { beforeDirectories } from ${JSON.stringify(new URL('./process-cleanup.ts', import.meta.url).href)};
    const controller = new AbortController();
    test('held CLI', { signal: controller.signal }, async t => {
      const machine = await scratchMachine(t, { identity: true });
      const socketPath = machine.root + '/ready.sock';
      const server = createServer();
      beforeDirectories(t, async () => {
        if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      });
      server.listen(socketPath);
      await once(server, 'listening', { signal: AbortSignal.timeout(5000) });
      const ready = once(server, 'connection', { signal: AbortSignal.timeout(5000) });
      machine.env.READY_SOCKET = socketPath;
      machine.env.NODE_OPTIONS = '--import=' + pathToFileURL(${JSON.stringify(probe)}).href;
      let settled = false;
      const result = initIn(machine, machine.home, 'init');
      void result.then(() => { settled = true; }, () => { settled = true; });
      const [socket] = await ready;
      const [data] = await once(socket, 'data', { signal: AbortSignal.timeout(5000) });
      const pid = Number(String(data));
      assert.ok(pid > 0);
      process.kill(pid, 0);
      beforeDirectories(t, async () => {
        assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
        assert.equal(settled, true, 'command result has settled');
        assert.equal(existsSync(machine.root), true, 'writer reaped before directory removal');
        writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({ root: machine.root, pid, settled }));
      });
      controller.abort(new Error('intentional scratch command cancellation'));
      await new Promise(() => {});
    });
  `);
  delete machine.env.NODE_TEST_CONTEXT;
  const result = await commandIn(machine, machine.root, process.execPath, ['--test', fixture]);
  assert.notEqual(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /intentional scratch command cancellation/);
  const observed = JSON.parse(await readFile(receipt, 'utf8')) as { root: string; pid: number; settled: boolean };
  assert.equal(observed.settled, true);
  assert.throws(() => process.kill(observed.pid, 0), { code: 'ESRCH' });
  await assert.rejects(stat(observed.root), { code: 'ENOENT' });
});
