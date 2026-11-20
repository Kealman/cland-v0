// T3 helper: a real foreground hub crashes after the writer's durable release.
import assert from 'node:assert/strict';
import cp, { type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TestContext } from 'node:test';
import { CLI_ENTRY, connectUi, readDiscovery } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
import { fixtureEnvironment, scratchGitEnvironment } from './fixture-environment.ts';
import { ownProcess } from './process-cleanup.ts';
import { pruneCase, exactProcessObservation } from './prune-case.ts';
import { eventually } from './until.ts';
import { processIdentityAsync } from '../src/process-identity.ts';
import { processStartedAsync } from '../src/hub/lock.ts';
import { recoverGitCommands, type GitCommandRecord, type GitProcess } from '../src/git-command-owner.ts';
import { remoteRedactor } from '../src/host/agent/redact.ts';
import { askHubFrame } from '../../shared/socket-client.ts';
import { readOwnerTrace } from './prune-owner-trace.ts';

function writerObservation(owner: GitProcess, env: NodeJS.ProcessEnv) {
  return exactProcessObservation(owner, {
    probe: pid => {
      try { process.kill(pid, 0); return 'present'; }
      catch (error) { return (error as NodeJS.ErrnoException).code ?? 'unknown'; }
    },
    birth: pid => processIdentityAsync(pid, env),
  });
}

export function pruneCrashCase(t: TestContext) {
  return pruneCase(t, async (scope, step) => {
    const rows: Array<{ child: ChildProcess; closed: Promise<void>; stop?: () => Promise<void>; tail: string }> = [];
    const sockets: Array<{ socket: net.Socket; closed: Promise<void> }> = [];
    let root = '', recoveryEnv: NodeJS.ProcessEnv = {};
    scope.requireClose(async () => {
      for (const row of sockets) { row.socket.destroy(); await row.closed; }
      for (const row of rows) { await row.stop?.(); await row.closed; }
      if (root) await recoverGitCommands(root, recoveryEnv);
    });
    const setup = await step('complete crash fixture setup and released writer admission', async () => {
    root = await step('crash fixture repository setup', () => preparedProject(scope.fixtures, 'native-territory'));
    scope.adoptRoot(root);
    const storage = join(root, '.cland/crash-writer'), ready = join(storage, 'writer-ready');
    const traceDirectory = join(storage, 'owner-traces');
    const faultApplied = join(storage, 'recovery-disabled');
    const withoutRecovery = process.env.CLAND_TEST_CRASH_RECOVERY_CONTROL === 'without-recovery';
    const bin = join(storage, 'held-writer.mjs'), preload = join(storage, 'hold-writer.mjs');
    await step('crash fixture gate setup', async () => {
      await mkdir(storage);
      await mkdir(traceDirectory);
      await writeFile(bin, `#!${process.execPath}\nimport { writeFileSync } from 'node:fs';\nprocess.on('SIGTERM', () => {});\nwriteFileSync(process.env.FAKE_WRITER_READY, String(process.pid));\nsetInterval(() => {}, 1000);\n`, { mode: 0o755 });
      await writeFile(preload, `
if (process.argv.includes('serve')) {
  if (process.env.FAKE_SKIP_WRITER_RECOVERY === '1') {
    const { registerHooks } = await import('node:module');
    const { writeFileSync } = await import('node:fs');
    registerHooks({ load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (url !== ${JSON.stringify(new URL('../src/git-command-owner.ts', import.meta.url).href)}) return result;
      const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString();
      const signatures = [...source.matchAll(/export async function recoverGitCommands\\([^\\n]*\\)\\s*(?:: Promise<void>)?\\s*\\{/g)];
      if (signatures.length !== 1) throw new Error('unsupported recovery fault-injection boundary');
      const signature = signatures[0][0];
      writeFileSync(${JSON.stringify(faultApplied)}, 'exact recovery boundary disabled');
      return { ...result, source: source.replace(signature, signature + '\\nreturn;\\n') };
    } });
  }
  const { PruneProcesses } = await import(${JSON.stringify(new URL('../src/prune-processes.ts', import.meta.url).href)});
  const { publishOwnerTrace } = await import(${JSON.stringify(new URL('./prune-owner-trace.ts', import.meta.url).href)});
  const { basename } = await import('node:path');
  const { gitCommandPolicy } = await import(${JSON.stringify(new URL('../src/git-command-policy.ts', import.meta.url).href)});
  const observed = new WeakSet();
  let traces = 0;
  const git = PruneProcesses.prototype.git;
  PruneProcesses.prototype.git = function (...args) {
    if (!observed.has(this)) {
      observed.add(this);
      const native = this.native;
      let current;
      const save = trace => { try { publishOwnerTrace(trace.path, trace.value); } catch {} };
      this.native = { ...native, prepare: async (...parameters) => {
        const lease = await native.prepare(...parameters);
        current = lease.path && traces++ < 64 ? { path: ${JSON.stringify(traceDirectory)} + '/' + basename(lease.path), value: { record: basename(lease.path), parent: process.pid } } : undefined;
        const trace = current;
        if (trace) {
          const bind = lease.bind.bind(lease);
          lease.bind = async child => { await bind(child); trace.value.child = child; save(trace); };
        }
        return lease;
      }, launch: (cwd, argv, env, executable, gated) => {
        const trace = current;
        if (trace) { trace.value.command = argv.slice(0, 24).map(value => String(value).slice(0, 128)); trace.value.class = gitCommandPolicy(argv).kind; trace.value.ownedMode = gated ? 'writer' : 'direct'; save(trace); }
        const child = native.launch(cwd, argv, env, executable, gated);
        if (trace) child.once('close', (code, signal) => { trace.value.nativeClose = { code, signal }; save(trace); });
        return child;
      } };
    }
    if (process.env.FAKE_CRASH_HOLD === '1' && args[1][0] === 'push' && args[1].includes('--porcelain')) {
      const native = this.native;
      this.native = { ...native, launch: (cwd, argv, env, _bin, gated) => native.launch(cwd, argv, env, ${JSON.stringify(bin)}, gated) };
    }
    return Reflect.apply(git, this, args);
  };
}
`);
    });
    const environment = (hold: boolean) => scratchGitEnvironment(root, fixtureEnvironment(root, process.env, {
      CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'),
      NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`, FAKE_CRASH_HOLD: hold ? '1' : '', FAKE_WRITER_READY: ready,
      ...(withoutRecovery && !hold ? { NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`, FAKE_SKIP_WRITER_RECOVERY: '1' } : {}),
    }), { excludesFile: join(root, 'excludes') });
    recoveryEnv = environment(false);
    const launch = (hold: boolean) => {
      const redactor = remoteRedactor();
      const env = environment(hold);
      // cland-allow-child-env: environment() seals the final overlay with both shared builders.
      const child = cp.spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
      const row: typeof rows[number] = { child, closed: new Promise(resolve => child.once('close', () => resolve())), tail: '' };
      rows.push(row); // Capture the original child before any observation can yield.
      row.stop = ownProcess(undefined, child.pid);
      const collect = (chunk: Buffer) => { row.tail = redactor.text(row.tail + chunk.toString()).slice(-4096); };
      child.stdout!.on('data', collect); child.stderr!.on('data', collect);
      child.once('error', error => { row.tail = redactor.text(String(error)).slice(-4096); });
      return { row, ready: () => eventually('foreground hub durable discovery', async () => {
        const discovery = await readDiscovery(root).catch(() => undefined);
        if (discovery?.pid === child.pid) return discovery;
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`hub exited before serving: ${child.exitCode}/${child.signalCode}; ${row.tail}`);
        return undefined;
      }, 10_000) };
    };
    const first = launch(true);
    const discovery = await step('first hub serving receipt', first.ready);
    const ui = await step('first hub client setup', () => connectUi(scope.resources, discovery));
    const itemReply = await step('crash fixture item creation', () => ui.request({ type: 'task.create', title: 'Crash writer', kind: 'task', size: 'M' }));
    assert.equal(itemReply.ok, true, itemReply.error);
    const item = (itemReply.value as { item: { id: string } }).item;
    let captureClaim = true, claimSocket: net.Socket | undefined;
    const connect = net.createConnection;
    scope.patch(net, 'createConnection', (...args: unknown[]) => {
      const socket = Reflect.apply(connect, net, args) as net.Socket;
      if (captureClaim && args[0] === discovery.socket) {
        claimSocket = socket;
        sockets.push({ socket, closed: new Promise(resolve => socket.once('close', () => resolve())) });
      }
      return socket;
    });
    // The production one-shot client rejects on native socket error/close and
    // clears its own request timer. The ordinary FrameClient has no abort seam.
    const claiming = askHubFrame(discovery, { type: 'task.claim', item: item.id }, 30_000, recoveryEnv);
    captureClaim = false;
    assert.ok(claimSocket, 'the original claim transport was captured before acquisition yielded');
    const callerClosed = new Error('crash fixture caller explicitly closed');
    let claimReceipt: unknown = 'pending';
    void claiming.then(reply => { claimReceipt = reply; }, error => { claimReceipt = { rejected: String(error) }; });
    void claiming.catch(() => {});
    try {
      const pid = await step('writer effect after gate release', async () => {
        try { return await eventually('released writer ready', async () => Number(await readFile(ready, 'utf8').catch(() => '0')) || undefined, 10_000); }
        catch (error) { throw new Error(`${String(error)}; claim receipt ${remoteRedactor().text(JSON.stringify(claimReceipt)).slice(-4096)}; hub tail ${first.row.tail}`, { cause: error }); }
      });
      const directory = join(root, '.cland/run/git-command-owners');
      const record = await step('released durable writer receipt', () => eventually('exact writer record', async () => {
        for (const name of await readdir(directory)) if (name.endsWith('.json')) {
          const row = JSON.parse(await readFile(join(directory, name), 'utf8')) as GitCommandRecord;
          if (row.child?.pid === pid && row.released) return { row, path: join(directory, name) };
        }
        return undefined;
      }, 3000));
      assert.equal(record.row.parent.pid, first.row.child.pid);
      assert.ok(record.row.child?.pidIdentity);
      const live = await step('released writer exact native birth', () => writerObservation(record.row.child!, recoveryEnv));
      assert.equal(live.state, 'alive'); assert.equal(live.cause, 'same-birth');
      assert.deepEqual(live.owner, record.row.child);
      await step('abort and join the released claim client', async () => {
        ui.close();
        claimSocket!.destroy(callerClosed);
        await assert.rejects(claiming, error => error === callerClosed);
        await sockets[0]!.closed;
      });
      return { first, discovery, ui, claiming, callerClosed, claimSocket, record, directory, launch, withoutRecovery, faultApplied, traceDirectory };
    } catch (error) {
      ui.close(); claimSocket.destroy(callerClosed); await Promise.allSettled([claiming]); throw error;
    }
    });
    const { first, discovery, ui, claiming, callerClosed, claimSocket, record, directory, launch, withoutRecovery, faultApplied, traceDirectory } = setup;
    try {
      const birth = await step('original hub birth capture', () => processIdentityAsync(first.row.child.pid!, recoveryEnv));
      const started = await step('original hub start capture', () => processStartedAsync(first.row.child.pid!, undefined, undefined, undefined, recoveryEnv));
      assert.ok(birth && started);
      await step('crash only the admitted hub root', async () => {
        assert.equal(await processStartedAsync(first.row.child.pid!, undefined, undefined, undefined, recoveryEnv), started);
        const current = await processIdentityAsync(first.row.child.pid!, recoveryEnv);
        assert.equal(current, birth);
        assert.equal(first.row.child.exitCode, null); assert.equal(first.row.child.signalCode, null);
        process.kill(first.row.child.pid!, 'SIGKILL');
        await first.row.closed; // Original native close, not a status/presence change.
      });
      await step('crashed caller joins', () => Promise.allSettled([claiming]));
      assert.equal(first.row.child.signalCode, 'SIGKILL');
      const surviving = await step('exact released writer survives the root-only crash', () => writerObservation(record.row.child!, recoveryEnv));
      assert.equal(surviving.state, 'alive'); assert.equal(surviving.cause, 'same-birth'); assert.deepEqual(surviving.owner, record.row.child);
      assert.equal((JSON.parse(await readFile(record.path, 'utf8')) as GitCommandRecord).id, record.row.id);
      const second = launch(false);
      const recovered = await step('restart serving after writer recovery', second.ready);
      assert.notEqual(recovered.pid, discovery.pid);
      if (withoutRecovery) assert.equal(await readFile(faultApplied, 'utf8'), 'exact recovery boundary disabled', 'the red control positively disabled the production recovery boundary');
      const absent = await step('native writer absence after recovery', async () => {
        let last: Awaited<ReturnType<typeof writerObservation>> | undefined;
        try { return await eventually('exact writer positive native absence', async () => {
          last = await writerObservation(record.row.child!, recoveryEnv);
          return last.state === 'absent' ? last : undefined;
        }, 3000); }
        catch (error) { t.diagnostic(JSON.stringify({ boundary: 'exact-writer-absence-incomplete', receipt: last ?? 'unobserved' })); throw error; }
      });
      assert.equal(absent.state, 'absent'); assert.deepEqual(absent.owner, record.row.child);
      assert.ok(absent.cause === 'native-ESRCH' || absent.cause === 'birth-replaced');
      await assert.rejects(readFile(record.path), { code: 'ENOENT' });
      const remaining = (await readdir(directory)).filter(name => name.endsWith('.json'));
      let remainingDiagnostic: unknown;
      let healthyOwners = remaining.length <= 8;
      if (remaining.length) {
        const diagnostic = [];
        for (const name of remaining.slice(0, 8)) {
          const tracePath = join(traceDirectory, name);
          let trace = await readOwnerTrace(tracePath, trace => !!trace.child);
          let row: GitCommandRecord | undefined;
          try { row = JSON.parse(await readFile(join(directory, name), 'utf8')) as GitCommandRecord; }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
          const parent = row ? await writerObservation(row.parent, recoveryEnv) : undefined;
          const child = row?.child ? await writerObservation(row.child, recoveryEnv) : undefined;
          // A command may close and retire while the observer yields. Re-read
          // its original-child close receipt instead of inventing live proof.
          if (!row || child?.state !== 'alive') trace = await readOwnerTrace(tracePath, trace => !!trace.nativeClose);
          const observed = trace && typeof trace === 'object';
          const sameChild = observed && (!row || trace.child?.pid === row.child?.pid && trace.child?.pidIdentity === row.child?.pidIdentity);
          const close = observed && trace.nativeClose && Object.hasOwn(trace.nativeClose, 'code') && Object.hasOwn(trace.nativeClose, 'signal');
          const belongsReplacement = observed && trace.parent === recovered.pid && (!row || row.parent.pid === recovered.pid);
          const healthy = belongsReplacement && sameChild && second.row.child.exitCode === null && second.row.child.signalCode === null
            && (row ? parent?.state === 'alive' && parent.cause === 'same-birth' && row.phase === 'running' && row.released && (child?.state === 'alive' && child.cause === 'same-birth' || close) : close);
          healthyOwners = healthyOwners && !!healthy;
          diagnostic.push({ record: name, trace, belongsReplacement, healthy: !!healthy, phase: row?.phase ?? 'retired', released: row?.released,
            parent: parent ?? 'retired', child: child ?? 'unobserved' });
        }
        remainingDiagnostic = { boundary: 'remaining-owner-after-crash-recovery', recoveredHub: recovered.pid, originalWriter: record.row.child, owners: diagnostic, omitted: Math.max(0, remaining.length - 8) };
        t.diagnostic(JSON.stringify(remainingDiagnostic));
      }
      assert.equal(healthyOwners, true, remainingDiagnostic ? JSON.stringify(remainingDiagnostic) : 'remaining owner census exceeds its bound');
      const next = await step('restarted hub client setup', () => connectUi(scope.resources, recovered));
      assert.equal((await next.request({ type: 'worktree.list' })).ok, true, 'recovered hub admits territory reads');
      await step('restarted hub normal stop', async () => { await next.request({ type: 'hub.stop' }); await second.row.closed; });
      assert.deepEqual((await readdir(directory)).filter(name => name.endsWith('.json')), [], 'after replacement native close every owner is settled');
    } finally { ui.close(); claimSocket.destroy(callerClosed); await Promise.allSettled([claiming]); }
  }, true);
}
