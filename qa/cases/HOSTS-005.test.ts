// Native QA controls: original setup/body joins, real guarded root removal,
// and an already-open relay whose producer rejects. No daemon or real account.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { mkdir, mkdtemp, realpath, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createJourneyOwner, ownedJourney, type JourneyScope } from '../support/native-journey.ts';
import { relays } from '../support/live-host-journeys.ts';
import { RelayCloseError, closeRelayResources } from '../support/relay-close.ts';
import { tempProject } from '../../hub/test/harness.ts';
import { ownDirectory, onCleanup, guardDirectoryRemoval, drainFixtureCleanup, fenceFixtureCleanup } from '../../hub/test/process-cleanup.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { within } from '../../hub/src/executor/droplet/deadline.ts';

const bound = <T>(work: Promise<T>, boundary: string) => within(work, 10000, undefined, () => Error(`native control incomplete: ${boundary}`));
function contains(error: unknown, selected: unknown): boolean {
  if (error === selected) return true;
  if (!(error instanceof Error)) return false;
  return (error.cause !== undefined && contains(error.cause, selected))
    || (error instanceof AggregateError && error.errors.some(value => contains(value, selected)));
}
function only(error: unknown, selected: unknown): boolean {
  if (error === selected) return true;
  if (error instanceof AggregateError) return error.errors.length > 0 && error.errors.every(value => only(value, selected))
    && (error.cause === undefined || only(error.cause, selected));
  return error instanceof Error && error.cause !== undefined && only(error.cause, selected);
}
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
}

test('whole journey abort joins a late native acquisition and fences its next step', { timeout: 60000 }, async t => {
  const owner = createJourneyOwner(t);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let root = '', nativeClosed = false, originalSettled = false, nextAdmitted = false, guardedRemoval = false;
  let abortReason: unknown;
  const running = owner.run(async (fixtures, scope) => {
    try {
      await scope.setup('held original acquisition', async () => {
        const aborted = () => { abortReason = scope.signal.reason; release.resolve(); };
        scope.signal.addEventListener('abort', aborted, { once: true });
        entered.resolve(); await release.promise;
        try {
          root = await tempProject(fixtures, 'qabort-', '/tmp'); scope.adoptRoot(root);
          const server = createServer(socket => socket.destroy());
          const closed = new Promise<void>(resolve => server.once('close', () => { nativeClosed = true; resolve(); }));
          onCleanup(fixtures, async () => {
            assert.equal((await stat(root)).isDirectory(), true);
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            await closed; assert.equal(nativeClosed, true);
          });
          await listen(server);
          guardDirectoryRemoval(root, async () => {
            assert.equal(originalSettled, true); assert.equal(nativeClosed, true); guardedRemoval = true;
          });
        } finally { scope.signal.removeEventListener('abort', aborted); }
      });
      await scope.step('must remain fenced', async () => { nextAdmitted = true; });
    } finally { originalSettled = true; }
  });
  const rejected = assert.rejects(running, error => contains(error, abortReason));
  await bound(entered.promise, 'original acquisition admitted');
  await bound(owner.close(), 'late native close and guarded removal');
  await rejected;
  assert.equal(nativeClosed, true); assert.equal(originalSettled, true);
  assert.equal(nextAdmitted, false); assert.equal(guardedRemoval, true);
  await assert.rejects(stat(root), { code: 'ENOENT' });
  t.diagnostic(JSON.stringify({ abortJoinedOriginal: true, lateNativeClosed: true, nextStepFenced: true, guardedRemoval: true }));
});

test('setup failure and rejected close retain the real root and seam until repaired closure', { timeout: 60000 }, async t => {
  const selected = Error('selected setup rejection'), secondary = Error('selected close rejection');
  // Drive the same registered outer hook explicitly, then consume only this
  // deliberately asserted failure from its idempotent final invocation.
  const hooks: Array<() => Promise<unknown>> = [];
  const context = new Proxy(t, { get(target, key) {
    if (key === 'after') return (fn: Parameters<TestContext['after']>[0]) => hooks.push(async () => fn?.(target, () => {}));
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  t.after(async () => { for (const hook of hooks) { try { await hook(); } catch (error) { assert.equal(only(error, secondary), true); } } });
  const owner = createJourneyOwner(context);
  let root = '', nativeClosed = false, originalSettled = false, allowClose = false, seamReleased = false;
  let removeRoot!: () => Promise<void>;
  t.after(async () => { allowClose = true; await drainFixtureCleanup(owner.fixtures); });
  fenceFixtureCleanup(owner.fixtures).release(() => { seamReleased = true; });
  const running = owner.run(async (fixtures, scope) => {
    try {
      await scope.setup('native acquisition before rejection', async () => {
        root = await realpath(await mkdtemp('/tmp/qreject-')); removeRoot = ownDirectory(fixtures, root); scope.adoptRoot(root);
        const server = createServer(socket => socket.destroy());
        const closed = new Promise<void>(resolve => server.once('close', () => { nativeClosed = true; resolve(); }));
        onCleanup(fixtures, async () => {
          if (!allowClose) throw secondary;
          if (!nativeClosed) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
          await closed; assert.equal(nativeClosed, true);
        });
        await listen(server);
        guardDirectoryRemoval(root, async () => { assert.equal(nativeClosed, true); assert.equal(originalSettled, true); });
        throw selected;
      });
    } finally { originalSettled = true; }
  });
  await assert.rejects(running, error => contains(error, selected));
  await assert.rejects(bound(owner.close(), 'rejected close selected'), error => contains(error, secondary));
  await assert.rejects(removeRoot(), error => contains(error, secondary));
  assert.equal((await stat(root)).isDirectory(), true);
  assert.equal(nativeClosed, false); assert.equal(seamReleased, false);
  allowClose = true;
  await bound(drainFixtureCleanup(owner.fixtures), 'repaired positive native close and real root removal');
  assert.equal(nativeClosed, true); assert.equal(seamReleased, true);
  await assert.rejects(stat(root), { code: 'ENOENT' });
  t.diagnostic(JSON.stringify({ setupRejectionPreserved: true, closeRejectionSecondary: true, guardedRemovalRefused: true, repairedNativeClose: true, seamReleasedAfterClose: true }));
});

async function relayFault(t: TestContext, scope: JourneyScope) {
  const root = await scope.setup('relay control root', () => tempProject(t, 'qrelay-', '/tmp')); scope.adoptRoot(root);
  const selected = Error('controlled tick rejection');
  let rejectTick = false, relayClosed = false;
  const opened = Promise.withResolvers<string>();
  let relay: Awaited<ReturnType<typeof relays>> | undefined;
  let relayServer: Server | undefined;
  let client: ReturnType<typeof createConnection> | undefined, clientClosed: Promise<void> | undefined;
  const echoSockets = new Map<Socket, Promise<void>>();
  const echo = createServer(socket => {
    echoSockets.set(socket, new Promise<void>(resolve => socket.once('close', () => resolve())));
    socket.on('error', () => {}); socket.pipe(socket);
  });
  const echoClosed = new Promise<void>(resolve => echo.once('close', resolve));
  onCleanup(t, async () => {
    await closeRelayResources(Promise.resolve(), () => [
      async () => {
        let failure: unknown;
        if (relay) try { await relay.close(); } catch (error) { failure = error; }
        // The control also owns the observed server, so a regression cannot leak
        // it merely because the deliberately asserted close path failed.
        if (relayServer && !relayClosed) await new Promise<void>((resolve, reject) => relayServer!.close(error => error ? reject(error) : resolve()));
        if (failure) assert.ok(failure instanceof RelayCloseError && failure.cause === selected && failure.closed);
      },
      async () => { client?.destroy(); await clientClosed; },
      async () => {
        for (const socket of echoSockets.keys()) socket.destroy();
        await Promise.all(echoSockets.values());
        await new Promise<void>((resolve, reject) => echo.close(error => error ? reject(error) : resolve())); await echoClosed;
      },
    ]);
  });
  await scope.setup('native echo listener', () => listen(echo));
  const address = echo.address(); assert.ok(address && typeof address !== 'string');
  await scope.setup('relay fixture files', async () => {
    await mkdir(join(hostDirectory(root, 'fake-control'), 'home'), { recursive: true });
    await mkdir(join(root, 'fake-opencode'), { recursive: true });
    await writeFile(join(root, 'fake-opencode/serve-ports.jsonl'), address.port + '\n');
  });
  relay = await scope.setup('native relay owner', () => relays({ root, beforeStop: () => {} }, [], {
    afterTick: () => { if (rejectTick) throw selected; },
    opened: (server, path) => { relayServer = server; server.once('close', () => { relayClosed = true; }); opened.resolve(path); },
  }));
  const path = await bound(opened.promise, 'native relay listening');
  client = createConnection(path);
  clientClosed = new Promise<void>(resolve => client!.once('close', () => resolve()));
  client.on('error', () => {});
  await bound(new Promise<void>((resolve, reject) => { client!.once('connect', resolve); client!.once('error', reject); }), 'relay client connected');
  const echoed = new Promise<Buffer>(resolve => client!.once('data', resolve));
  client.write('relay-control');
  assert.equal((await bound(echoed, 'native relay carried bytes')).toString(), 'relay-control');
  rejectTick = true;
  assert.equal(await bound(relay.failed, 'producer rejection receipt'), selected);
  await assert.rejects(bound(relay.close(), 'all native relay close receipts'), error => error instanceof RelayCloseError && error.cause === selected && error.closed);
  await bound(clientClosed, 'relay client native close');
  assert.equal(relayClosed, true);
  t.diagnostic(JSON.stringify({ alreadyOpenRelay: true, bytesForwarded: true, producerCausePreserved: true, nativeServerClosed: true, nativeClientClosed: true }));
}
test('rejected relay tick joins the already-open native socket and server', { timeout: 60000 }, ownedJourney(relayFault));
