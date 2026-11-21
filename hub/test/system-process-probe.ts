// Shared isolated native-process boundary; all OS processes and signals inside the child are synthetic.
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory } from './process-cleanup.ts';
import type { TestContext } from 'node:test';
import { fixtureWork } from './fixture-work.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { testWaitMs } from './until.ts';
import { scratchGitEnvironment } from './fixture-environment.ts';

const entry = fileURLToPath(new URL('../src/system-processes.ts', import.meta.url));
export async function systemProcessProbe(body: string, platform: 'darwin' | 'linux' = 'darwin', options: { suiteRoot?: boolean; context?: TestContext } = {}) {
  const owner = options.context ? fixtureWork(options.context) : undefined;
  const source = `
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import nativeFiles from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { syncBuiltinESMExports } from 'node:module';
Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });
const boot = '11111111-2222-3333-4444-555555555555';
const nativeBirth = r => r && process.platform === 'linux' ? 'linux:' + boot + ':' + (r.ticks ?? 90001) : r ? 'darwin:' + Math.floor(Date.parse(r.started + ' UTC') / 1000) + ':' + (r.micros ?? 200001) : null;
const start = 'Mon Oct 5 12:00:00 2026';
const row = (pid, parent, group, started = start) => ({ pid, parent, group, started, state: 'S', command: 'node fixture' });
let onNative = async () => {}, nativeFailure = false, nativePid = pid => pid;
let rows = [], onProbe = () => {}, onSignal = () => {}, onTable = () => {}, onChildren = () => {}, cwdOf = () => '', tableOutput, pgrepStderr = '', pgrepCode = 0;
const signals = []; const listings = []; const liveness = [];
let onStat = async () => {};
if (process.platform === 'linux') {
 const read = nativeFiles.readFile;
 nativeFiles.readFile = async (path, ...args) => {
  if (path === '/proc/sys/kernel/random/boot_id') return boot;
  const match = /^\\/proc\\/(\\d+)\\/stat$/.exec(String(path));
  if (!match) return read(path, ...args);
  const pid = Number(match[1]), error = await onStat(pid);
  if (error) throw Object.assign(new Error('stat unavailable'), { code: error });
  const r = pid === process.pid ? row(pid, 1, pid) : rows.find(r => r.pid === pid);
  if (!r) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
  return r.pid + ' (fixture with ) name) ' + (r.nativeState ?? r.state) + ' ' + r.parent + ' ' + r.group + ' ' + Array(16).fill('0').join(' ') + ' ' + (r.ticks ?? 90001) + ' 0';
 };
}
const bounded = async (promise, ms, label) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out')), ms); })]); } finally { clearTimeout(timer); } };
cp.spawn = (bin, args) => {
  assert.ok(bin === 'ps' || bin === 'lsof' || bin === 'pgrep' || bin === '/usr/bin/perl');
  if (bin === '/usr/bin/perl' && nativeFailure === 'missing') throw Object.assign(new Error('missing perl'), { code: 'ENOENT' });
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  queueMicrotask(async () => {
    let output;
    if (bin === '/usr/bin/perl') {
      if (nativeFailure) { child.stdout.end(); child.stderr.end('native interpreter failed'); child.emit('close', 2); return; }
      await onNative();
      const selected = args.slice(args.indexOf('--') + 1).map(Number);
      const records = [];
      for (const pid of selected) {
        if (selected.length === 1 && pid !== process.pid && await onProbe(pid) === false) continue;
        const r = pid === process.pid ? row(process.pid, 1, process.pid) : rows.find(p => p.pid === pid);
        if (!r || r.micros === null) continue;
        const bytes = Buffer.alloc(648);
        bytes.writeBigInt64LE(BigInt(Math.floor(Date.parse(r.started + ' UTC') / 1000)), 0);
        bytes.writeInt32LE(r.micros ?? 200001, 8); bytes.writeInt32LE(nativePid(pid), 40);
        bytes.writeUInt8(r.nativeState === 'Z' ? 5 : 2, 36);
        records.push(bytes);
      }
      output = Buffer.concat(records);
    } else if (bin === 'pgrep') {
      await onChildren();
      if (pgrepStderr) { child.stdout.end(); child.stderr.end(pgrepStderr); child.emit('close', pgrepCode); return; }
      const parents = args[1].split(',').map(Number);
      output = rows.filter(p => parents.includes(args[0] === '-P' ? p.parent : p.group)).map(p => p.pid).join('\\n');
    } else if (bin === 'lsof') {
      output = 'fcwd\\nn' + cwdOf(Number(args[args.indexOf('-p') + 1]));
    } else if (args.includes('pid=,ppid=,pgid=,lstart=,stat=,command=')) {
      const selection = args.includes('-p') ? ['-p', args[args.indexOf('-p') + 1]] : ['-e'];
      assert.deepEqual(args, ['-ww', ...selection, '-o', 'pid=,ppid=,pgid=,lstart=,stat=,command=']);
      listings.push([...args]);
      if (await onTable() === false) { child.stdout.end(); child.stderr.end(); child.emit('close', 1); return; }
      const selected = args.includes('-p') ? args[args.indexOf('-p') + 1].split(',').map(Number) : null;
      output = tableOutput ?? [row(process.pid, 1, process.pid), ...rows].filter(p => !selected || selected.includes(p.pid)).map(p =>
        p.pid + ' ' + p.parent + ' ' + p.group + ' ' + p.started + ' ' + p.state + ' ' + p.command).join('\\n');
    } else {
      const identities = [];
      for (const pid of args[args.indexOf('-p') + 1].split(',').map(Number)) {
        const verified = undefined;
        const started = verified === false ? undefined : pid === process.pid ? start : rows.find(p => p.pid === pid)?.started;
        if (started) identities.push(args.includes('pid=,lstart=') ? pid + ' ' + started : started);
      }
      output = identities.join('\\n');
    }
    child.stdout.end(output); child.stderr.end(); child.emit('close', 0);
  });
  return child;
};
cp.spawnSync = (bin, args) => {
  assert.ok(bin === 'ps' || bin === 'pgrep');
  if (bin === 'pgrep') return { status: pgrepCode, stdout: pgrepStderr ? '' : rows.filter(p => args[1].split(',').includes(String(p.group))).map(p => p.pid).join('\\n'), stderr: pgrepStderr };
  return { status: 0, stdout: rows.find(p => p.pid === Number(args[args.indexOf('-p') + 1]))?.started ?? '', stderr: '' };
};
syncBuiltinESMExports();
process.kill = (pid, signal) => {
  if (signal === 0) {
    liveness.push(pid);
    if (pid === process.pid || rows.some(p => p.pid === pid)) return true;
    throw Object.assign(new Error('no process'), { code: 'ESRCH' });
  }
  signals.push({ pid, signal });
  if (onSignal(pid, signal) === false) return true;
  if (signal === 'SIGSTOP' || signal === 'SIGCONT') {
    const target = rows.find(p => p.pid === pid);
    if (target) target.state = signal === 'SIGSTOP' ? 'T' : 'S';
    return true;
  }
  const killed = new Set(rows.filter(p => pid < 0 ? p.group === -pid : p.pid === pid).map(p => p.pid));
  rows = rows.filter(p => !killed.has(p.pid)).map(p => ({ ...p, parent: killed.has(p.parent) ? 1 : p.parent }));
  return true;
};
const { endProcess: nativeEndProcess, systemProcesses } = await import(${JSON.stringify(entry)});
const endProcess = (p, ...args) => nativeEndProcess({ ...p, pidIdentity: Object.hasOwn(p, 'pidIdentity') ? p.pidIdentity : nativeBirth(rows.find(r => r.pid === p.pid)) }, ...args);
${body}
`;
  if (owner) return owner.run(async scope => {
    const root = await within(scope.root(async () => mkdtempSync(join(tmpdir(), 'cland-process-identity-'))), testWaitMs(5000));
    if (options.suiteRoot) await within(scope.root(async () => {
      const suiteRoot = join(realpathSync('/tmp'), `cland-suite-${basename(root)}`);
      mkdirSync(suiteRoot, { mode: 0o700 });
      return suiteRoot;
    }), testWaitMs(5000));
    const command = await scope.acquire(async () => {
      const completed = Promise.withResolvers<{ error: Error | null; stderr: string }>();
      const closed = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>();
      const started = Promise.withResolvers<void>();
      let didClose = false, tail = '';
      // cland-allow-child-env: isolated OS override probe uses fixtureEnvironment then scratchGitEnvironment after the final overlay; no accounts or provider calls
      const child = execFile(process.execPath, ['--input-type=module', '-e', source], {
        timeout: 10_000, cwd: root, signal: scope.signal, killSignal: 'SIGKILL',
        env: scratchGitEnvironment(root, fixtureEnvironment(root, process.env), { excludesFile: join(root, 'gitignore') }),
      }, (error, _stdout, stderr) => { tail = stderr.slice(-5000); completed.resolve({ error, stderr: tail }); });
      child.once('spawn', () => started.resolve());
      child.once('error', error => started.reject(error));
      void started.promise.catch(() => {});
      child.once('close', (code, signal) => { didClose = true; closed.resolve({ code, signal }); });
      const result = Promise.all([completed.promise, closed.promise]);
      const incomplete = () => new Error(`process probe incomplete: exit ${child.exitCode}; signal ${child.signalCode}; ${tail}`);
      return { started: started.promise, result, stop: async () => {
        if (!didClose) child.kill('SIGKILL');
        await within(result, testWaitMs(5000), undefined, incomplete);
      }, incomplete };
    }, command => command.stop());
    await scope.step(() => within(command.started, testWaitMs(5000), undefined, command.incomplete));
    await scope.step(async () => {
      const [output, exit] = await within(command.result, 11_000, undefined, command.incomplete);
      if (output.error || exit.code !== 0 || exit.signal) throw new Error(`process probe exit ${exit.code}; signal ${exit.signal}; ${output.stderr || String(output.error)}`);
    });
  });
  // Acquire and register every root before yielding: a signal cleanup must not
  // finish while an asynchronous mkdir can still publish an unowned sibling.
  const root = mkdtempSync(join(tmpdir(), 'cland-process-identity-'));
  const cleanup = ownDirectory(undefined, root);
  let cleanupSuite: (() => Promise<void>) | undefined;
  try {
    if (options.suiteRoot) {
      const suiteRoot = join(realpathSync('/tmp'), `cland-suite-${basename(root)}`);
      mkdirSync(suiteRoot, { mode: 0o700 });
      cleanupSuite = ownDirectory(undefined, suiteRoot);
    }
    await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { timeout: 10_000, cwd: root, env: fixtureEnvironment(root, process.env) });
  } catch (error) {
    throw new Error((error as { stderr?: string }).stderr?.slice(-5000) || String(error));
  } finally {
    // execFile settles after native close, including its timeout kill. Both
    // roots are parent-owned before launch, so child finally blocks are optional.
    try { await cleanupSuite?.(); } finally { await cleanup(); }
  }
}

