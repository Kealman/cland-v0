// The real termination API against a deterministic OS boundary. No real process receives a signal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../src/system-processes.ts', import.meta.url));
async function probe(body: string) {
  const source = `
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { syncBuiltinESMExports } from 'node:module';
const start = 'Mon Oct 5 12:00:00 2026';
const row = (pid, parent, group, started = start) => ({ pid, parent, group, started, state: 'S', command: 'node fixture' });
let rows = [], onProbe = () => {}, onSignal = () => {}, onTable = () => {}, cwdOf = () => '';
const signals = [];
cp.spawn = (bin, args) => {
  assert.ok(bin === 'ps' || bin === 'lsof');
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  queueMicrotask(async () => {
    let output;
    if (bin === 'lsof') {
      output = 'fcwd\\nn' + cwdOf(Number(args[args.indexOf('-p') + 1]));
    } else if (args.includes('-axo')) {
      if (await onTable() === false) { child.stdout.end(); child.stderr.end(); child.emit('close', 1); return; }
      output = [row(process.pid, 1, process.pid), ...rows].map(p =>
        p.pid + ' ' + p.parent + ' ' + p.group + ' ' + p.started + ' ' + p.state + ' ' + p.command).join('\\n');
    } else {
      const pid = Number(args[args.indexOf('-p') + 1]);
      const verified = await onProbe(pid);
      const started = verified === false ? undefined : pid === process.pid ? start : rows.find(p => p.pid === pid)?.started;
      output = started ?? '';
    }
    child.stdout.end(output); child.stderr.end(); child.emit('close', 0);
  });
  return child;
};
syncBuiltinESMExports();
process.kill = (pid, signal) => {
  if (signal === 0) {
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
const { endProcess } = await import(${JSON.stringify(entry)});
${body}
`;
  await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { timeout: 10_000 });
}

test('termination preserves an unrelated process joining an owned group during identity probes', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420101, 420101)];
let joined = false;
onProbe = pid => {
  if (pid === 420101 && !joined) { joined = true; rows.push(row(420103, 1, 420101)); }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.equal(joined, true);
assert.ok(rows.some(p => p.pid === 420103), 'the late group joiner is not owned');
assert.ok(signals.every(p => p.pid > 0));
assert.deepEqual(signals.filter(p => p.signal === 'SIGTERM' || p.signal === 'SIGKILL'), [
  { pid: 420100, signal: 'SIGTERM' },
  { pid: 420101, signal: 'SIGKILL' },
  { pid: 420102, signal: 'SIGKILL' }
]);
`);
});

test('termination rechecks authority after the OS probe and before the harness stop', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let allowed = true, harnessStopped = false;
onTable = () => { allowed = false; };
const refusal = new Error('Lead level: outside the subtree');
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0,
  async () => { harnessStopped = true; }, { authorize: () => { if (!allowed) throw refusal; } }), error => error === refusal);
assert.equal(harnessStopped, false);
assert.deepEqual(signals, []);
`);
});

test('termination rechecks authority after each identity probe before signalling', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let allowed = true;
onProbe = () => { allowed = false; };
const refusal = new Error('Lead level: outside the subtree');
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0,
  undefined, { authorize: () => { if (!allowed) throw refusal; } }), error => error === refusal);
assert.deepEqual(signals, []);
`);
});

test('termination discovers and ends an owned child spawned between TERM and KILL', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => {
  if (pid === 420100 && signal === 'SIGTERM') {
    rows.push(row(420101, 420100, 420100));
    return false; // the root survives TERM and spawns a child during its grace period
  }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, []);
assert.deepEqual(signals.filter(p => p.signal === 'SIGTERM' || p.signal === 'SIGKILL'), [
  { pid: 420100, signal: 'SIGTERM' },
  { pid: 420100, signal: 'SIGKILL' },
  { pid: 420101, signal: 'SIGKILL' }
]);
`);
});

test('a pid reused while the TERM identity probe is pending receives no signal', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onProbe = pid => { rows.find(p => p.pid === pid).started = 'Tue Oct 6 12:00:00 2026'; };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(signals, []);
assert.equal(rows.length, 1);
`);
});

test('each KILL target gets a fresh identity probe after signalling the preceding target', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420101, 420101)];
onSignal = (pid, signal) => {
  if (pid === 420101 && signal === 'SIGKILL') Object.assign(rows.find(p => p.pid === 420102), { started: 'Tue Oct 6 12:00:00 2026', state: 'S' });
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), false);
assert.ok(rows.some(p => p.pid === 420102), 'the reused second target survives');
assert.deepEqual(signals.filter(p => p.signal === 'SIGTERM' || p.signal === 'SIGKILL'), [{ pid: 420100, signal: 'SIGTERM' }, { pid: 420101, signal: 'SIGKILL' }]);
assert.equal(signals.some(p => p.pid === 420102 && p.signal === 'SIGCONT'), false, 'the stopped identity is confirmed gone, so its replacement is never resumed');
assert.equal(rows.find(p => p.pid === 420102).state, 'S');
`);
});

test('a reservation refusal at KILL preserves the process without a kill fallback', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
  canSignal: current => !current.some(p => p.pid === 420100 && p.state === 'T')
}), false);
assert.deepEqual(signals, [{ pid: 420100, signal: 'SIGTERM' }, { pid: 420100, signal: 'SIGSTOP' }, { pid: 420100, signal: 'SIGCONT' }]);
assert.equal(rows.length, 1);
assert.equal(rows[0].state, 'S');
`);
});

test('termination captures a child spawned during the parent’s final identity await', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let parentProbes = 0;
onProbe = pid => {
  if (pid === 420100 && ++parentProbes === 2) rows.push(row(420101, 420100, 420100));
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, [], 'the child must be captured before killing its parent');
assert.ok(signals.every(p => p.pid > 0));
`);
});

test('termination re-walks and freezes descendants that appear after their parent is frozen', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') return false;
  if (signal === 'SIGSTOP' && pid < 420102) rows.push(row(pid + 1, pid, 420100));
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, []);
assert.deepEqual(signals.filter(p => p.signal === 'SIGSTOP').map(p => p.pid), [420100, 420101, 420102]);
const firstKill = signals.findIndex(p => p.signal === 'SIGKILL');
assert.equal(signals.slice(firstKill).some(p => p.signal === 'SIGSTOP'), false, 'the entire captured tree is frozen before any kill');
`);
});

test('a frozen process with an unavailable KILL identity probe is resumed and reported', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let probes = 0;
onProbe = pid => ++probes === 3 ? false : undefined;
const entries = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 0), false);
assert.equal(rows[0].state, 'S');
assert.deepEqual(signals, [{ pid: 420100, signal: 'SIGTERM' }, { pid: 420100, signal: 'SIGSTOP' }, { pid: 420100, signal: 'SIGCONT' }]);
assert.ok(entries.some(p => p.event === 'harness-end-incomplete' && p.pids.includes(420100)));
assert.equal(entries.some(p => p.event === 'harness-ended'), false);
`);
});

test('a captured stopped pid is resumed even when every later process inspection fails', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let probes = 0;
onProbe = pid => {
  if (++probes === 3) { onTable = () => false; return false; }
};
const entries = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 0), false);
assert.equal(rows[0].state, 'S', 'failed inspection must not leave our stopped process frozen');
assert.ok(signals.some(p => p.pid === 420100 && p.signal === 'SIGCONT'));
assert.equal(signals.some(p => p.signal === 'SIGKILL'), false);
assert.ok(entries.some(p => p.event === 'harness-end-incomplete' && p.confirmed === false));
assert.equal(entries.some(p => p.event === 'harness-ended'), false);
`);
});

test('a stopped identity confirmed dead receives no later CONT when its pid is reused', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let killed = false;
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') return false;
  if (signal === 'SIGKILL') killed = true;
};
onTable = () => {
  if (killed && rows.length === 0) rows.push(row(420100, 1, 420100, 'Tue Oct 6 12:00:00 2026'));
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.equal(rows.length, 1);
assert.equal(rows[0].started, 'Tue Oct 6 12:00:00 2026');
assert.equal(rows[0].state, 'S');
assert.equal(signals.some(p => p.signal === 'SIGCONT'), false, 'the dead stopped identity was removed before finally');
`);
});

test('confirmed reuse during the KILL probe removes the stopped pid before later inspection failure', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let probes = 0;
onProbe = pid => {
  if (++probes === 3) {
    Object.assign(rows[0], { started: 'Tue Oct 6 12:00:00 2026', state: 'S' });
    onTable = () => false;
  }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), false);
assert.equal(rows[0].started, 'Tue Oct 6 12:00:00 2026');
assert.equal(signals.some(p => p.signal === 'SIGCONT' || p.signal === 'SIGKILL'), false,
  'the final probe already confirmed the stopped identity gone');
`);
});

test('unconfirmed death reports captured survivors and resumes them when the deadline expires', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' || signal === 'SIGKILL' ? false : undefined;
const entries = [];
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 0, undefined,
  { deadline: Date.now() + 100 }), /deadline|surviving/);
assert.equal(rows[0].state, 'S');
assert.ok(signals.some(p => p.signal === 'SIGCONT'));
assert.ok(entries.some(p => p.event === 'harness-end-incomplete' && p.pids.includes(420100)));
assert.equal(entries.some(p => p.event === 'harness-ended'), false);
`);
});

async function sweepProbe(body: string) {
  await probe(`
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
Object.defineProperty(process, 'platform', { value: 'darwin' }); // use the deterministic lsof boundary
const root = mkdtempSync(join(tmpdir(), 'cland-owner-'));
try {
  mkdirSync(join(root, '.cland'));
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.exec('create table harness_processes(name text, pid integer, pid_started text, status text, cwd text)');
  db.prepare('insert into harness_processes values (?, ?, ?, ?, ?)').run('impl', 420100, start, 'offline', root);
  db.close();
  rows = [row(420100, 1, 420100), row(420101, 420110, 420100), row(420110, 420100, 420100)];
  rows[1].command = 'codex app-server --listen unix://' + root + '/.cland/run/cx-fixture.sock';
  cwdOf = pid => pid === 420100 ? root : '/outside';
  onSignal = (pid, signal) => {
    if (signal === 'SIGTERM') return false;
    if (signal === 'SIGCONT' && pid === 420101) rows.push(row(420102, 420101, 420100));
  };
  const { sweepOrphans } = await import(${JSON.stringify(fileURLToPath(new URL('../src/orphans.ts', import.meta.url)))});
  ${body}
} finally { rmSync(root, { recursive: true, force: true }); }
`);
}

test('an orphan sweep gives a wrapper and its server descendant one termination owner', async () => {
  await sweepProbe(`  const ended = await sweepOrphans(root, () => {});
  assert.deepEqual(rows, [], 'no child may escape an overlapping thaw');
  assert.deepEqual(signals.filter(p => p.pid === 420101 && p.signal === 'SIGSTOP'), [{ pid: 420101, signal: 'SIGSTOP' }]);
  assert.deepEqual(ended.map(p => p.process.pid), [420100], 'the root worker owns the entire tree');
  // An unowned ancestor cannot take responsibility for an independently owned child.
  rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
  rows[1].command = 'codex app-server --listen unix://' + root + '/.cland/run/cx-fixture.sock';
  cwdOf = pid => pid === 420101 ? root : '/outside';
  signals.length = 0;
  const childEnded = await sweepOrphans(root, () => {});
  assert.deepEqual(rows.map(p => p.pid), [420100]);
  assert.deepEqual(childEnded.map(p => p.process.pid), [420101]);
  assert.ok(signals.every(p => p.pid === 420101));
`);
});

test('a concurrent public sweep reports busy instead of sharing a frozen tree', async () => {
  await sweepProbe(`
const entered = Promise.withResolvers(), proceed = Promise.withResolvers();
let blocked = false;
onProbe = async pid => {
  if (pid === 420100 && !blocked) { blocked = true; entered.resolve(); await proceed.promise; }
};
const first = sweepOrphans(root, () => {});
await entered.promise;
const before = signals.length;
await assert.rejects(sweepOrphans(root, () => {}), /sweep busy/);
assert.equal(signals.length, before, 'the contending sweep sends no signals');
proceed.resolve();
assert.deepEqual((await first).map(p => p.process.pid), [420100]);
assert.deepEqual(rows, []);
assert.deepEqual(await sweepOrphans(root, () => {}), [], 'the project lock is released after completion');
`);
});

test('a sweep reassesses an independently owned child when its ancestor exits before capture', async () => {
  await sweepProbe(`
rows = rows.filter(p => p.pid !== 420110).map(p => ({ ...p, parent: p.pid === 420101 ? 420100 : p.parent }));
cwdOf = () => root;
let tables = 0;
onTable = () => {
  if (++tables === 3) rows = rows.filter(p => p.pid !== 420100).map(p => ({ ...p, parent: p.parent === 420100 ? 1 : p.parent }));
};
const ended = await sweepOrphans(root, () => {});
assert.deepEqual(rows, [], 'the surviving child is not discarded with its ancestor');
assert.deepEqual(ended.map(p => p.process.pid), [420101]);
`);
});

test('a failed CONT and throwing logger cannot skip later stopped survivors', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') return false;
  if (pid === 420100 && signal === 'SIGCONT') throw Object.assign(new Error('CONT denied'), { code: 'EPERM' });
};
const log = () => { throw new Error('logger unavailable'); };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, log, 0, undefined, {
  canSignal: current => !current.every(p => p.pid === process.pid || p.state === 'T')
}), false);
assert.ok(signals.some(p => p.pid === 420101 && p.signal === 'SIGCONT'));
assert.equal(rows.find(p => p.pid === 420101).state, 'S');
assert.equal(signals.some(p => p.signal === 'SIGKILL'), false);
`);
});
