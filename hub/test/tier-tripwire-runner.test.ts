// T3 runner contract: real worker startup proves pre-import resource interception
// and that the worker exit status preserves report-only versus enforcement policy.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory, ownProcess } from './process-cleanup.ts';
import { findNvim } from '../../nvim/bin/nvim-path.ts';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
const harness = fileURLToPath(new URL('./harness.ts', import.meta.url));
const cliBoundary = fileURLToPath(new URL('./tier-cli.ts', import.meta.url));
async function fixture(t: TestContext, tests: Record<string, { tier: string; source: string }>, pkg: 'hub' | 'nvim' = 'hub') {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-tier-runner-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, `${pkg}/test`), { recursive: true });
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  for (const [name, entry] of Object.entries(tests)) await writeFile(join(cwd, `${pkg}/test/${name}.test.ts`), entry.source);
  await writeFile(join(cwd, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: Object.fromEntries(Object.entries(tests).map(([name, entry]) => [`${pkg}/test/${name}.test.ts`, entry.tier])) }));
  return async (mode = 'report-only', loadGate = false, quarantine = false) => {
    if (loadGate) await writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: {artifacts: [], commit: 'fixture'}, budget: {testSeconds: 60, fileSeconds: 60}, files: {}, tests: {}, allow: {} }));
    if (quarantine) {
      const added = new Date().toISOString().slice(0, 10);
      const expires = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      await writeFile(join(cwd, 'hub/test/quarantine.json'), JSON.stringify({ version: 1, tests: Object.fromEntries(Object.keys(tests).map(name => [`${pkg}/test/${name}.test.ts::known flake`, { owner: 'T-748', reason: 'Planted tier violation quarantine.', added, expires }])) }));
    }
    const code = `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', '--test-concurrency=1', ${Object.keys(tests).map(name => JSON.stringify(`${pkg}/test/${name}.test.ts`)).join(',')}]], ${JSON.stringify({ cwd, lockDir: join(cwd, 'lock'), selection: {mode: 'hub-only', files: [], reason: 'fixture', loadGate} })});`;
    const child = exec(process.execPath, ['--input-type=module', '-e', code], { cwd, env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_TIER_MODE: mode }, maxBuffer: 4 * 1024 * 1024 });
    ownProcess(t, child.child.pid);
    return child.then(r => ({ code: 0, output: r.stdout + r.stderr }), (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, output: e.stdout + e.stderr }));
  };
}
function trips(output: string): Array<{ file: string; name: string; tier: string; resource: string; stack: string }> {
  return output.split('\n').filter(line => line.startsWith('tier-mismatch {')).map(line => JSON.parse(line.slice('tier-mismatch '.length)));
}

test('T1 and T2 workers name spawned tests while fake probes and the CLI helper stay clean', async t => {
  const run = await fixture(t, {
    unit: { tier: 'T1', source: `import test from 'node:test'; import { spawnSync } from 'node:child_process'; test('unit child', () => { spawnSync(process.execPath, ['-e', '']); });` },
    component: { tier: 'T2', source: `import test from 'node:test'; import { spawn } from 'node:child_process'; import { once } from 'node:events'; test('component child', async () => { const child = spawn(process.execPath, ['-e', '']); await once(child, 'close'); });` },
    allowed: { tier: 'T2', source: `import test from 'node:test'; import assert from 'node:assert/strict'; import { projectHub, tempProject, cland } from ${JSON.stringify(harness)}; test('fake probes and cland CLI', async t => { const root = await tempProject(t); const hub = await projectHub(t, root, {}, {harnesses:'fake', probes:'fake'}); const result = await cland(root, 'hub', 'status'); assert.equal(result.code, 0, result.stderr); await hub.stop(); });` },
  });
  const result = await run();
  assert.equal(result.code, 0, result.output);
  const rows = trips(result.output).sort((a, b) => b.file.localeCompare(a.file));
  assert.deepEqual(rows.map(({ file, name, tier, resource }) => ({ file, name, tier, resource })), [
    { file: 'hub/test/unit.test.ts', name: 'unit child', tier: 'T1', resource: 'child_process.spawnSync' },
    { file: 'hub/test/component.test.ts', name: 'component child', tier: 'T2', resource: 'child_process.spawn' },
  ]);
  for (const row of rows) assert.match(row.stack, /\.test\.ts:\d+/);
  assert.doesNotMatch(result.output, /tier-mismatch.*fake probes and cland CLI/);
});

test('child-process exports, custom promisifiers and direct ChildProcess starts cannot bypass the worker', async t => {
  const run = await fixture(t, { process: { tier: 'T2', source: `
import test from 'node:test'; import assert from 'node:assert/strict';
import cp, { spawnSync, execFileSync } from 'node:child_process'; import { promisify } from 'node:util'; import { once } from 'node:events'; import { clandCliLaunch } from ${JSON.stringify(cliBoundary)};
const command = JSON.stringify(process.execPath) + ' -e ""';
test('process APIs', async t => {
  const calls = {
    spawn: async () => { await once(cp.spawn(process.execPath, ['-e', '']), 'close'); },
    spawnSync: () => spawnSync(process.execPath, ['-e', '']),
    exec: async () => { await new Promise((resolve, reject) => cp.exec(command, e => e ? reject(e) : resolve())); },
    execSync: () => cp.execSync(command),
    execFile: async () => { await new Promise((resolve, reject) => cp.execFile(process.execPath, ['-e', ''], e => e ? reject(e) : resolve())); },
    execFileSync: () => execFileSync(process.execPath, ['-e', '']),
    fork: async () => { await once(cp.fork('-e', [''], { execArgv: [] }), 'close'); },
    'promisified exec': () => promisify(cp.exec)(command),
    'promisified execFile': () => promisify(cp.execFile)(process.execPath, ['-e', '']),
    'non-CLI through launch boundary': () => clandCliLaunch(() => promisify(cp.execFile)(process.execPath, ['-e', ''])),
    'direct ChildProcess': () => { const child = new cp.ChildProcess(); assert.throws(() => child.spawn({}), TypeError); },
  };
  for (const [name, call] of Object.entries(calls)) await t.test(name, call);
});` } });
  const result = await run();
  assert.equal(result.code, 0, result.output);
  const rows = trips(result.output);
  const names = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork', 'promisified exec', 'promisified execFile', 'non-CLI through launch boundary', 'direct ChildProcess'];
  assert.deepEqual(rows.map(row => row.name), names.map(name => `process APIs > ${name}`));
  assert.deepEqual(rows.map(row => row.resource), ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork', 'exec', 'execFile', 'execFile', 'ChildProcess.spawn'].map(name => `child_process.${name}`));
  // Neither a command nor its environment is part of any trip receipt.
  for (const row of rows) assert.deepEqual(Object.keys(row), ['file', 'name', 'tier', 'resource', 'mode', 'stack']);
});

test('T1 traps real socket entry points for net, HTTP, HTTPS and TLS', async t => {
  const run = await fixture(t, { sockets: { tier: 'T1', source: `
import test, { beforeEach } from 'node:test'; import cp from 'node:child_process';
import net from 'node:net'; import http from 'node:http'; import https from 'node:https'; import tls from 'node:tls'; import { once } from 'node:events';
cp.spawnSync(process.execPath, ['-e', '']);
beforeEach(() => cp.spawnSync(process.execPath, ['-e', '']));
test('socket APIs', async t => {
  for (const [name, server] of [['net', net.createServer()], ['http', http.createServer()], ['https', https.createServer()]]) {
    await t.test(name + ' listen', async () => {
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    });
  }
  for (const protocol of ['net.connect', 'net.createConnection', 'net.Socket.connect', 'http', 'https', 'tls']) await t.test(protocol + ' connect', async () => {
    const server = net.createServer(socket => socket.destroy());
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const options = { port: server.address().port, host: '127.0.0.1' };
      if (protocol === 'http' || protocol === 'https') {
        const request = (protocol === 'http' ? http : https).get(options);
        await once(request, 'error');
      } else {
        const socket = protocol === 'tls' ? tls.connect(options) : protocol === 'net.Socket.connect' ? new net.Socket().connect(options) : net[protocol.split('.')[1]](options);
        if (protocol === 'tls') await once(socket, 'error');
        else { await once(socket, 'connect'); socket.destroy(); }
        if (!socket.closed) await new Promise(resolve => socket.once('close', resolve));
      }
    } finally { await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  });
});` } });
  const result = await run();
  assert.equal(result.code, 0, result.output);
  const rows = trips(result.output);
  assert.ok(rows.some(row => row.name === '(module initialization or file cleanup)' && row.resource === 'child_process.spawnSync'));
  assert.ok(rows.some(row => row.name === '<root>' && row.resource === 'child_process.spawnSync'), result.output);
  for (const protocol of ['net', 'http', 'https']) assert.ok(rows.some(row => row.name === `socket APIs > ${protocol} listen` && row.resource === 'net.Server.listen'), result.output);
  for (const protocol of ['net.connect', 'net.createConnection', 'net.Socket.connect', 'http', 'https', 'tls']) {
    const resource = protocol === 'http' ? 'net.createConnection' : ['https', 'tls'].includes(protocol) ? 'net.Socket.connect' : protocol;
    assert.ok(rows.some(row => row.name === `socket APIs > ${protocol} connect` && row.resource === resource), `missing ${protocol}: ${result.output}`);
  }
});

test('one enforcement setting fails a tripped worker while T3 and T4 remain untouched', async t => {
  const source = `import test from 'node:test'; import { spawnSync } from 'node:child_process'; test('native child', () => { spawnSync(process.execPath, ['-e', '']); });`;
  const run = await fixture(t, { component: { tier: 'T2', source } });
  const report = await run();
  assert.equal(report.code, 0, report.output);
  assert.equal(trips(report.output).length, 1);
  const enforced = await run('enforce');
  assert.equal(enforced.code, 1, enforced.output);
  assert.match(enforced.output, /T2 forbids child_process.spawnSync/);
  assert.match(enforced.output, /fail 1/);
  assert.equal(trips(enforced.output)[0]?.name, 'native child');
  const native = await fixture(t, { integration: { tier: 'T3', source }, soak: { tier: 'T4', source } });
  const untouched = await native('enforce');
  assert.equal(untouched.code, 0, untouched.output);
  assert.deepEqual(trips(untouched.output), []);
});

test('a raw cland CLI launch is still a T2 mismatch outside the documented helper', async t => {
  const cli = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  const run = await fixture(t, { raw: { tier: 'T2', source: `import test from 'node:test'; import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; test('raw CLI lookalike', async () => { await Promise.resolve(); await promisify(execFile)(process.execPath, [${JSON.stringify(cli)}, '--help']); });` } });
  const result = await run();
  assert.equal(result.code, 0, result.output);
  const rows = trips(result.output);
  assert.equal(rows.length, 1, result.output);
  assert.equal(rows[0]?.name, 'raw CLI lookalike');
  assert.equal(rows[0]?.resource, 'child_process.execFile');
});


test('a resource used only by load-gate repetitions survives their quiet reporter', async t => {
  const run = await fixture(t, { repeated: { tier: 'T2', source: `import test from 'node:test'; import { spawnSync } from 'node:child_process'; test('repetition-only child', () => { if (process.execArgv.some(arg => arg.startsWith('--test-name-pattern='))) spawnSync(process.execPath, ['-e', '']); });` } });
  const result = await run('report-only', true);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /load gate: .*repetition-only child 5\/5 passed/);
  const rows = trips(result.output);
  assert.equal(rows.length, 1, result.output);
  assert.equal(rows[0]?.name, 'repetition-only child');
  assert.equal(rows[0]?.resource, 'child_process.spawnSync');
});

test('enforced T1 and T2 trips cannot be excused by assertion quarantine', async t => {
  for (const tier of ['T1', 'T2']) {
    const run = await fixture(t, { quarantined: { tier, source: `import test from 'node:test'; import { spawnSync } from 'node:child_process'; test('known flake', () => spawnSync(process.execPath, ['-e', '']));` } });
    const report = await run('report-only', false, true);
    assert.equal(report.code, 0, report.output);
    assert.equal(trips(report.output)[0]?.tier, tier);
    const result = await run('enforce', false, true);
    assert.equal(result.code, 1, result.output);
    assert.equal(trips(result.output)[0]?.tier, tier);
  }
});

test('a caught enforced trip remains nonzero even if the test resets the worker exit code', async t => {
  for (const quarantine of [false, true]) {
    const run = await fixture(t, { caught: { tier: 'T2', source: `import test from 'node:test'; import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; test('known flake', () => { assert.throws(() => spawnSync(process.execPath, ['-e', '']), /T2 forbids/); process.exitCode = 0; });` } });
    const result = await run('enforce', false, quarantine);
    assert.equal(result.code, 1, result.output);
    assert.equal(trips(result.output)[0]?.name, 'known flake');
  }
});

// Each case proves one mode/catch contract within the existing 5 s runner gate.
for (const caught of [false, true]) for (const mode of ['report-only', 'enforce']) {
  test(`${mode} ${caught ? 'caught' : 'uncaught'} quarantined repetition-only trips retain their policy`, async t => {
    const action = caught ? `try { spawnSync(process.execPath, ['-e', '']); } catch {} process.exitCode = 0;` : `spawnSync(process.execPath, ['-e', '']);`;
    const run = await fixture(t, { repeated: { tier: 'T2', source: `import test from 'node:test'; import { spawnSync } from 'node:child_process'; test('known flake', () => { if (process.execArgv.some(arg => arg.startsWith('--test-name-pattern='))) { ${action} } });` } });
    const result = await run(mode, true, true);
    assert.equal(result.code, mode === 'enforce' ? 1 : 0, result.output);
    assert.equal(trips(result.output).length, 1, result.output);
    if (mode === 'report-only') assert.match(result.output, /load gate: .*known flake 5\/5 passed/);
    else {
      assert.doesNotMatch(result.output, /quarantine load gate:.*known flake/);
      assert.match(result.output, /load gate: .*known flake 0\/5 passed/);
    }
    assert.equal(trips(result.output)[0]?.name, 'known flake');
  });
}

// T3 worker contract: the actual T2 client and its teardown must survive enforcement.
test('documented stub-hub Neovim client stays clean under T2 enforcement', async t => {
  const { nvimOrSkip } = await import('../../nvim/test/harness.ts');
  const nvim = await nvimOrSkip();
  if ('skip' in nvim) return t.skip(nvim.skip);
  const client = fileURLToPath(new URL('../../nvim/test/harness.ts', import.meta.url));
  const stub = fileURLToPath(new URL('../../nvim/test/stub-hub.ts', import.meta.url));
  const run = await fixture(t, { client: { tier: 'T2', source: `
import test from 'node:test'; import { startClient } from ${JSON.stringify(client)};
import { tempProject } from ${JSON.stringify(harness)};
test('headless client', async t => {
  const root = await tempProject(t);
  const c = await startClient(t, ${JSON.stringify(nvim.bin)}, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: ${JSON.stringify(JSON.stringify([process.execPath, stub]))} });
  await c.waitScreen(s => s.includes('hub: connected'), 'stub connection');
});` } }, 'nvim');
  const result = await run('enforce');
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(trips(result.output), []);
  assert.match(result.output, /pass 1/);
});

// T3 runner contract: a Neovim path must not grant general child-process permission.
test('an unrelated child in a planted Neovim T2 worker still trips', async t => {
  const run = await fixture(t, { unrelated: { tier: 'T2', source: `
import test from 'node:test'; import { spawnSync } from 'node:child_process';
test('unrelated child', () => spawnSync(process.execPath, ['-e', '']));` } }, 'nvim');
  for (const mode of ['report-only', 'enforce']) {
    const result = await run(mode);
    assert.equal(result.code, mode === 'enforce' ? 1 : 0, result.output);
    assert.deepEqual(trips(result.output).map(({ file, name, resource }) => ({ file, name, resource })), [
      { file: 'nvim/test/unrelated.test.ts', name: 'unrelated child', resource: 'child_process.spawnSync' },
    ]);
  }
});

test('the Neovim launch exception rejects direct and altered lookalikes', async t => {
  const bin = findNvim();
  if (!bin) return t.skip('pinned Neovim is unavailable for the exact executable contract');
  const boundary = fileURLToPath(new URL('./tier-nvim.ts', import.meta.url));
  const init = fileURLToPath(new URL('../../nvim/init.lua', import.meta.url));
  const run = await fixture(t, { lookalikes: { tier: 'T2', source: `
import test from 'node:test'; import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { headlessNvimLaunch } from ${JSON.stringify(boundary)};
const bin = ${JSON.stringify(bin)}; const socket = '/fixture/nvim.sock';
const args = ['--clean', '-u', ${JSON.stringify(init)}, '--headless', '--listen', socket];
test('lookalikes', async t => {
  const calls = {
    direct: () => spawn(bin, args),
    executable: () => headlessNvimLaunch(bin, socket, () => spawn(process.execPath, args)),
    impostor: () => headlessNvimLaunch(process.execPath, socket, () => spawn(process.execPath, args)),
    arguments: () => headlessNvimLaunch(bin, socket, () => spawn(bin, [...args, '-c', 'qa!'])),
    socket: () => headlessNvimLaunch(bin, socket, () => spawn(bin, [...args.slice(0, -1), '/other.sock'])),
    API: () => headlessNvimLaunch(bin, socket, () => spawnSync(bin, args)),
    async: () => headlessNvimLaunch(bin, socket, async () => { await Promise.resolve(); spawn(bin, args); }),
  };
  for (const [name, call] of Object.entries(calls)) await t.test(name, async () => {
    if (name === 'async') await assert.rejects(call, /T2 forbids/);
    else assert.throws(call, /T2 forbids/);
  });
  process.exitCode = 0;
});` } }, 'nvim');
  const result = await run('enforce');
  assert.equal(result.code, 1, result.output);
  const rows = trips(result.output);
  assert.deepEqual(rows.map(row => row.name), ['direct', 'executable', 'impostor', 'arguments', 'socket', 'API', 'async'].map(name => `lookalikes > ${name}`));
  assert.deepEqual(rows.map(row => row.resource), ['spawn', 'spawn', 'spawn', 'spawn', 'spawn', 'spawnSync', 'spawn'].map(name => `child_process.${name}`));
  assert.match(result.output, /pass 8/);
});

test('the headless Neovim exception stays limited to Neovim T2 workers', async t => {
  const bin = findNvim();
  if (!bin) return t.skip('pinned Neovim is unavailable for the exact executable contract');
  const boundary = fileURLToPath(new URL('./tier-nvim.ts', import.meta.url));
  const init = fileURLToPath(new URL('../../nvim/init.lua', import.meta.url));
  for (const [pkg, tier] of [['nvim', 'T1'], ['hub', 'T2']] as const) {
    const run = await fixture(t, { limited: { tier, source: `
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawn } from 'node:child_process';
import { headlessNvimLaunch } from ${JSON.stringify(boundary)};
test('wrong worker', () => {
  assert.throws(() => headlessNvimLaunch(${JSON.stringify(bin)}, '/fixture/nvim.sock', () => spawn(${JSON.stringify(bin)}, ['--clean', '-u', ${JSON.stringify(init)}, '--headless', '--listen', '/fixture/nvim.sock'])), /${tier} forbids/);
  process.exitCode = 0;
});` } }, pkg);
    const result = await run('enforce');
    assert.equal(result.code, 1, result.output);
    assert.equal(trips(result.output)[0]?.tier, tier);
    assert.equal(trips(result.output).length, 1, result.output);
  }
});

// T3 runner contract: non-stub startClient calls must trip at spawn itself.
test('non-stub Neovim T2 clients cannot borrow the stub launch exception', async t => {
  const bin = findNvim();
  if (!bin) return t.skip('pinned Neovim is unavailable for the exact executable contract');
  const client = fileURLToPath(new URL('../../nvim/test/harness.ts', import.meta.url));
  const stub = fileURLToPath(new URL('../../nvim/test/stub-hub.ts', import.meta.url));
  const run = await fixture(t, { nonstub: { tier: 'T2', source: `
import test from 'node:test'; import assert from 'node:assert/strict';
import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module'; import { once } from 'node:events';
import { startClient } from ${JSON.stringify(client)}; import { tempProject } from ${JSON.stringify(harness)};
// Observe the OS boundary without replacing the tripwire. If a regression
// admits spawn then fails at ps, dispose that live child before fixture removal.
const guardedSpawn = cp.spawn;
let launched, closed;
cp.spawn = (...args) => {
  launched = guardedSpawn(...args); closed = false;
  launched.once('close', () => { closed = true; });
  return launched;
};
syncBuiltinESMExports();
test('non-stub launch', async t => {
  t.after(() => { cp.spawn = guardedSpawn; syncBuiltinESMExports(); });
  const cases = {
    socket: { CLAND_HUB_TRANSPORT: 'socket', CLAND_COMMAND: ${JSON.stringify(JSON.stringify([process.execPath, stub]))} },
    command: { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: ${JSON.stringify(JSON.stringify([process.execPath, '-e', '']))} },
    default: {},
  };
  for (const [name, env] of Object.entries(cases)) await t.test(name, async t => {
    launched = undefined;
    try {
      const root = await tempProject(t);
      await assert.rejects(startClient(t, ${JSON.stringify(bin)}, root, env), /T2 forbids child_process.spawn:/);
    } finally {
      if (launched && !closed) {
        const close = once(launched, 'close', { signal: AbortSignal.timeout(5000) });
        if (launched.exitCode === null && launched.signalCode === null) process.kill(-launched.pid, 'SIGKILL');
        await close;
      }
    }
  });
  process.exitCode = 0;
});` } }, 'nvim');
  const result = await run('enforce');
  assert.equal(result.code, 1, result.output);
  assert.deepEqual(trips(result.output).map(({ name, resource }) => ({ name, resource })), ['socket', 'command', 'default'].map(name => ({ name: `non-stub launch > ${name}`, resource: 'child_process.spawn' })));
  assert.match(result.output, /pass 4/);
});
