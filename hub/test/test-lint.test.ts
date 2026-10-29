// T1: syntax policy uses planted source text and performs no test execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintTests, lintTestSource, testLintFacts, testLintReport, touchesMachineResources } from '../src/test-lint.ts';

// Shared planted source inputs are data, never executed by these tests.
const sources = JSON.parse(await readFile(new URL('./fixtures/test-lint-sources.json', import.meta.url), 'utf8')) as Record<string, string>;
const input = (name: string): string => { assert.equal(typeof sources[name], 'string', name); return sources[name]!; };

const file = 'hub/test/planted.test.ts';

test('test skips report reasonless boolean conditions and accept platform reason strings', async () => {
  for (const skip of ["process.platform !== 'linux'", "process.platform === 'win32'", 'true', '!available', "'  '"]) {
    const source = `import test from 'node:test';\ntest('platform case', { skip: ${skip} }, () => {});`;
    assert.deepEqual(lintTestSource(file, source, 'T1').findings, [
      { file, line: 2, rule: 'skip-reason', message: 'skip needs a nonblank reason string when enabled' },
    ], skip);
  }
  for (const skip of ['false', "'requires Linux native process identity'", "process.platform !== 'linux' ? 'requires Linux native process identity' : false"]) {
    assert.deepEqual(lintTestSource(file, `import test from 'node:test'; test('platform case', { skip: ${skip} }, () => {});`, 'T1').findings, [], skip);
  }
  assert.deepEqual(lintTestSource(file, "const data = { skip: true }; const text = \"test('case', { skip: true })\";", 'T1').findings, []);
  const aliased = "import { test as check } from 'node:test'; check('case', { 'skip': (process.platform !== 'darwin') }, () => {});";
  assert.equal(lintTestSource(file, aliased, 'T1').findings[0]?.rule, 'skip-reason');
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  assert.deepEqual(await checkTestLint({ manifest: { version: 1, tests: { [file]: 'T1' } }, source: async () => aliased }), [], 'skip reasons are report-only, including new files');
});

test('direct facts keep source, path and tier separate from caller mutations', () => {
  const source = 'sleep(10);';
  const facts = testLintFacts(file, source, 'T1');
  facts.result.findings.length = 0;
  facts.calls.push({ file, line: 99, rule: 'tier-process', message: 'poison' });
  const fresh = testLintFacts(file, source, 'T1');
  assert.ok(fresh.result.findings.some(f => f.rule === 'wall-clock-wait'));
  assert.ok(!fresh.calls.some(f => f.message === 'poison'));
  assert.deepEqual(testLintFacts(file, '// clean', 'T1').result.findings, []);
  assert.ok(testLintFacts('hub/test/other.test.ts', source, 'T1').result.findings.every(f => f.file === 'hub/test/other.test.ts'));
  assert.equal(testLintFacts(file, source, 'T2').result.tier, 'T2');
  assert.ok(testLintFacts(file, '// T3: process fixture\n', { tier: 'T3', contract: 'fixture' }).lifecycle);
});

async function lintFixture(t: import('node:test').TestContext, planted: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), 'cland-lint-imports-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'repo');
  for (const [path, source] of Object.entries(planted)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), source);
  }
  await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests:
    Object.fromEntries(Object.keys(planted).filter(path => path.endsWith('.test.ts')).map(path => [path, 'T1'])),
  }));
  return root;
}

// T1: only source files are read; planted resource calls never execute.
test('local helper resources are charged through their import path', async t => {
  const root = await lintFixture(t, {
    'hub/test/socket.test.ts': "import { fixture } from './fixtures/socket.ts'; fixture();",
    'hub/test/child.test.ts': "import { fixture } from './fixtures/child.ts'; fixture();",
    'hub/test/pure.test.ts': "import { sum } from './fixtures/pure.ts'; sum(1, 2);",
    'hub/test/fixtures/socket.ts': 'export const fixture = () => projectHub(t, root);',
    'hub/test/fixtures/child.ts': "import { spawn } from 'node:child_process'; export const fixture = () => spawn('git');",
    'hub/test/fixtures/pure.ts': 'export const sum = (a, b) => a + b; const data = "projectHub(); spawn()"; // startDaemon() ',
  });
  const results = await lintTests(root);
  const socket = results.find(result => result.file.endsWith('/socket.test.ts'))!;
  assert.equal(socket.reachable!.tier, 'T2');
  assert.ok(socket.reachable!.resources.some(f => f.rule === 'tier-import' && /fixtures\/socket.ts.*projectHub requires T2/.test(f.message)));
  assert.equal(socket.reachable!.resources[0]?.line, 1);
  const child = results.find(result => result.file.endsWith('/child.test.ts'))!;
  assert.equal(child.reachable!.tier, 'T3');
  assert.ok(child.reachable!.resources.some(f => f.rule === 'tier-process' && /fixtures\/child.ts.*child process requires T3/.test(f.message)));
  assert.deepEqual(results.find(result => result.file.endsWith('/pure.test.ts')), {
    file: 'hub/test/pure.test.ts', tier: 'T1', qualifies: 'T1', findings: [], reachable: { tier: 'T1', resources: [] },
  });
});

test('reachable diagnostics leave direct qualification and admission findings unchanged', async t => {
  const root = await lintFixture(t, {
    'hub/test/component.test.ts': "projectHub(t, root); import { child } from './helper.ts'; child();",
    'hub/test/helper.ts': "import { spawn } from 'node:child_process'; export const child = () => spawn('git');",
  });
  const [result] = await lintTests(root);
  const source = await readFile(join(root, 'hub/test/component.test.ts'), 'utf8');
  const direct = lintTestSource('hub/test/component.test.ts', source, 'T1');
  assert.deepEqual(await lintTests(root, { reachable: false }), [direct], 'omitting diagnostics preserves every direct finding and qualifying tier');
  assert.equal(result?.qualifies, 'T2');
  assert.deepEqual(result?.findings, direct.findings);
  assert.equal(result?.qualifies, direct.qualifies);
  assert.equal(result?.reachable?.tier, 'T3');
  const report = testLintReport([result!]);
  assert.equal(report[0], 'test lint (report only): 1 findings in 1 files');
  assert.ok(report.includes('test lint tier: hub/test/component.test.ts: T1; qualifies T2'));
  assert.ok(report.some(line => /^test lint reachable: hub\/test\/component.test.ts: T3;/.test(line)));
  assert.ok(report.some(line => /^test lint reachable resource: .*helper.ts.*child process requires T3/.test(line)));
});

test('named exports follow local calls without charging unused resource helpers', async t => {
  const root = await lintFixture(t, {
    'hub/test/pure.test.ts': "import { pure as calculate } from './helper.ts'; calculate(2);",
    'hub/test/required.test.ts': "const { pure: calculate } = require('./helper.ts'); calculate(2);",
    'hub/test/dynamic.test.ts': "const { pure: calculate } = await import('./helper.ts'); calculate(2);",
    'hub/test/socket.test.ts': "import { fixture } from './barrel.ts'; fixture();",
    'hub/test/process.test.ts': "import run from './helper.ts'; run();",
    'hub/test/namespace.test.ts': "import * as helper from './helper.ts'; helper.pure(2);",
    'hub/test/barrel.ts': "export { component as fixture } from './helper.ts';",
    'hub/test/helper.ts': `import { spawn } from 'node:child_process';
export const pure = value => value * 2;
const boot = () => projectHub(t, root);
function component() { return boot(); }
export { component };
const child = () => spawn('git');
export default function run() { return child(); }`,
  });
  const results = await lintTests(root);
  const result = (name: string) => results.find(result => result.file.endsWith(`/${name}.test.ts`))!;
  assert.equal(result('pure').reachable!.tier, 'T1');
  assert.deepEqual(result('pure').reachable!.resources, []);
  for (const name of ['required', 'dynamic']) {
    assert.equal(result(name).reachable!.tier, 'T1');
    assert.deepEqual(result(name).reachable!.resources, []);
  }
  assert.equal(result('socket').reachable!.tier, 'T2');
  assert.ok(result('socket').reachable!.resources.some(f => /barrel.ts -> hub\/test\/helper.ts.*projectHub requires T2/.test(f.message)));
  assert.ok(result('socket').reachable!.resources.every(f => !/child.process/.test(f.message)));
  assert.equal(result('process').reachable!.tier, 'T3');
  assert.ok(result('process').reachable!.resources.some(f => /child process requires T3/.test(f.message)));
  assert.equal(result('namespace').reachable!.tier, 'T3');
  assert.ok(result('namespace').reachable!.resources.some(f => /whole-module fallback: namespace import/.test(f.message)));
});

test('dynamic dependencies initialize only when their call is reachable', async t => {
  const planted: Record<string, string> = {
    'hub/test/native.ts': "import { spawn } from 'node:child_process'; spawn('git');",
  };
  for (const form of ['import', 'require']) {
    const call = `${form}('./native.ts')`;
    for (const mode of ['pure', 'called', 'guard', 'init']) {
      const helper = mode === 'pure' || mode === 'called' ? 'held' : mode;
      const name = mode === 'called' ? 'run' : 'pure';
      planted[`hub/test/${mode}-${form}.test.ts`] = `import { ${name} } from './${helper}-${form}.ts'; ${name}();`;
    }
    planted[`hub/test/held-${form}.ts`] = `const held = () => ${call}; export const pure = () => 1; export const run = () => held();`;
    planted[`hub/test/guard-${form}.ts`] = `import { fileURLToPath } from 'node:url'; export const pure = () => 1; if (process.argv[1] === fileURLToPath(import.meta.url)) ${call};`;
    planted[`hub/test/init-${form}.ts`] = `${call}; export const pure = () => 1;`;
  }
  const root = await lintFixture(t, planted);
  const results = await lintTests(root);
  for (const form of ['import', 'require']) for (const mode of ['pure', 'called', 'guard', 'init']) {
    const result = results.find(result => result.file.endsWith(`/${mode}-${form}.test.ts`))!;
    const runs = mode === 'called' || mode === 'init';
    assert.equal(result.reachable?.tier, runs ? 'T3' : 'T1', result.file);
    assert.equal(result.reachable?.resources.some(resource => /native.ts.*child process requires T3/.test(resource.message)), runs, result.file);
    assert.equal(result.qualifies, 'T1', result.file);
    assert.deepEqual(result.findings, [], result.file);
  }
});

test('module initialization charges registered callbacks without executing held function values', async t => {
  const root = await lintFixture(t, {
    'hub/test/pure.test.ts': "import { pure } from './held.ts';",
    'hub/test/init.test.ts': "import { pure } from './registered.ts';",
    'hub/test/held.ts': `import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
function worker() { projectHub(t, root); }
const held = { worker };
const bound = worker.bind(null);
export const pure = value => value;
if (process.argv[1] === fileURLToPath(import.meta.url)) worker();`,
    'hub/test/registered.ts': `import { after } from 'node:test';
import { spawn } from 'node:child_process';
const cleanup = () => spawn('ps');
after(cleanup);
after(() => projectHub(t, root));
export const pure = value => value;`,
  });
  const results = await lintTests(root);
  const pure = results.find(result => result.file.endsWith('/pure.test.ts'))!;
  assert.equal(pure.reachable!.tier, 'T1');
  assert.deepEqual(pure.reachable!.resources, []);
  const initialized = results.find(result => result.file.endsWith('/init.test.ts'))!;
  assert.equal(initialized.reachable!.tier, 'T3');
  assert.ok(initialized.reachable!.resources.some(f => /module initialization.*child process requires T3/.test(f.message)));
  assert.ok(initialized.reachable!.resources.some(f => /module initialization.*projectHub requires T2/.test(f.message)));
});

test('importing a class executes its static socket initializer without running instance methods', async t => {
  const root = await lintFixture(t, {
    'hub/test/static.test.ts': "import { pure } from './static.ts';",
    'hub/test/static.ts': `import { WebSocketServer } from 'ws';
export const pure = value => value;
class Server {
  static socket = new WebSocketServer({ port: 0 });
  start() { startDaemon(t, root); }
}`,
  });
  const [result] = await lintTests(root);
  assert.equal(result?.reachable!.tier, 'T2');
  assert.ok(result?.reachable?.resources.some(f => /module initialization.*socket server requires T2/.test(f.message)));
  assert.ok(result?.reachable?.resources.every(f => f.rule === 'tier-import'));
});

test('module initialization follows constructors called after their declarations', async t => {
  const root = await lintFixture(t, {
    'hub/test/constructor.test.ts': "import { pure } from './constructor.ts';",
    'hub/test/constructor.ts': `import { spawn } from 'node:child_process';
class Worker { constructor() { spawn('git'); } }
new Worker();
export const pure = value => value;`,
  });
  const [result] = await lintTests(root);
  assert.equal(result?.reachable!.tier, 'T3');
  assert.ok(result?.reachable?.resources.some(f => /module initialization.*child process requires T3/.test(f.message)));
});

test('transitive cycles retain resource evidence for each importing test', async t => {
  const root = await lintFixture(t, {
    'hub/test/a.test.ts': "import './a.ts';",
    'hub/test/b.test.ts': "import './b.ts';",
    'hub/test/a.ts': "export * from './b.ts'; projectHub(t, root);",
    'hub/test/b.ts': "export * from './a.ts'; import { spawn } from 'node:child_process'; spawn('git');",
  });
  const results = await lintTests(root);
  for (const result of results) {
    assert.equal(result.reachable!.tier, 'T3');
    assert.equal(result.reachable!.resources.filter(f => /projectHub requires T2/.test(f.message)).length, 1);
    assert.equal(result.reachable!.resources.filter(f => /child process requires T3/.test(f.message)).length, 1);
  }
  assert.ok(results[0]!.reachable!.resources.some(f => /a.test.ts -> hub\/test\/a.ts -> hub\/test\/b.ts/.test(f.message)));
  // Results are cached only within a lint run; edits must be visible next time.
  await writeFile(join(root, 'hub/test/b.ts'), "export * from './a.ts';");
  assert.deepEqual((await lintTests(root)).map(result => result.reachable!.tier), ['T2', 'T2']);
});

test('runtime imports follow helpers while erased types and source data stay inert', async t => {
  const forms = [
    ["import './helper.mjs';", 'T1'], ["export * from './helper.mjs';", 'T2'],
    ["export { fixture } from './helper.mjs';", 'T2'], ["await import('./helper.mjs');", 'T2'],
    ["require('./helper.mjs');", 'T2'], ["import { type Fixture } from './helper.mjs';", 'T1'],
    ["export { type Fixture } from './helper.mjs';", 'T1'],
  ];
  const root = await lintFixture(t, {
    ...Object.fromEntries(forms.map(([source], i) => [`hub/test/form-${i}.test.ts`, source!])),
    'hub/test/inert.test.ts': `import type { Fixture } from './helper.mjs';
export type { Fixture } from './helper.mjs';
const source = "import './helper.mjs';"; // require('./helper.mjs');
function check(require) { require('./helper.mjs'); }`,
    // JavaScript must be bound by the syntax host too, including callback scopes.
    'hub/test/helper.mjs': 'export function fixture() { [1].map(value => value); projectHub(t, root); }',
  });
  const results = await lintTests(root);
  for (const [i, [, tier]] of forms.entries()) {
    const result = results.find(result => result.file.endsWith(`/form-${i}.test.ts`))!;
    assert.equal(result.reachable!.tier, tier, result.file);
    if (tier === 'T2') assert.ok(result.reachable!.resources.some(f => /helper.mjs.*projectHub requires T2/.test(f.message)), result.file);
    else assert.deepEqual(result.reachable!.resources, []);
  }
  assert.deepEqual(results.find(result => result.file.endsWith('/inert.test.ts'))?.reachable?.resources, []);
  assert.ok(results.find(result => result.file.endsWith('/form-1.test.ts'))?.reachable?.resources.some(f => /whole-module fallback: export \* re-export/.test(f.message)));
});

test('allowed wait reasons still charge imported real timers', async t => {
  const root = await lintFixture(t, {
    'hub/test/timer.test.ts': "import { wait } from './timer.ts'; wait();",
    'hub/test/timer.ts': 'export const wait = () => setTimeout(done, 5); // lint-allow-wall-clock: intentional deadline',
  });
  const [result] = await lintTests(root);
  assert.equal(result?.reachable!.tier, 'T2');
  assert.ok(result?.reachable?.resources.some(f => /timer.ts.*wall-clock timer requires T2/.test(f.message)));
  assert.ok(result?.reachable?.resources.every(f => f.rule === 'tier-import'));
});

test('local resolution stays inside the repo and ignores data imports', async t => {
  const root = await lintFixture(t, {
    'hub/test/pure.test.ts': `import './fixtures/pure'; import './data.json';
import './absent.ts'; import '../../outside.ts'; import './escape.ts';`,
    'hub/test/fixtures/pure/index.ts': 'export const value = 1;',
    'hub/test/data.json': '{ "source": "projectHub(); spawn()" }',
    'outside.ts': 'projectHub(t, root);',
  });
  await writeFile(join(root, '../outside.ts'), 'projectHub(t, root);');
  await symlink(join(root, '../outside.ts'), join(root, 'hub/test/escape.ts'));
  const [result] = await lintTests(root);
  // ../../outside.ts is still in the repo, unlike the escaping symlink.
  assert.equal(result?.reachable!.tier, 'T2');
  assert.equal(result?.reachable?.resources.length, 1);
  assert.match(result!.reachable!.resources[0]!.message, /-> outside.ts:1 .*projectHub requires T2/);
  await writeFile(join(root, 'outside.ts'), 'export const value = 1;');
  assert.deepEqual((await lintTests(root))[0]?.reachable?.resources, []);
});

test('resource words in reporter data stay T1', () => {
  for (const source of [
    'const log = "nvim/test/x.test.ts harness startDaemon()";',
    "const log = 'nvim/test/x.test.ts harness';",
    'const log = `nvim/test/x.test.ts harness ${"startDaemon()"}`;',
    '// nvim/test/x.test.ts harness startDaemon()\n/* import { spawn } from "node:child_process"; */',
    'const nvim = { harness: "nvim/test/x.test.ts" };',
    'const path = "/tmp/cland-suite.lock";',
    'const path = `/tmp/cland-suite-nvim.lock`;',
  ]) {
    assert.equal(touchesMachineResources(file, source), false, source);
    const result = lintTestSource(file, source, 'T1');
    assert.equal(result.qualifies, 'T1', source);
    assert.deepEqual(result.findings, [], source);
  }
});

test('resource imports and helper calls still prevent T1 admission', () => {
  for (const [source, tier, message] of [
    ["import { startClient as editor } from '../../nvim/test/harness.ts';", 'T2', 'nvim/test/harness.ts requires T2'],
    ["import * as editor from '../../nvim/test/harness.ts'; editor.startClient(t, bin, root);", 'T3', 'Neovim without an explicit stub hub command requires T3'],
    ["await import('../../nvim/test/harness.ts');", 'T2', 'nvim/test/harness.ts requires T2'],
    ["import { startDaemon as boot } from './harness.ts';", 'T3', 'startDaemon requires T3'],
    ['spawnSpoke(t, root);', 'T3', 'spawnSpoke requires T3'],
    ['projectHub(t, root);', 'T2', 'projectHub requires T2'],
    ['const log = `daemon ${startDaemon(t, root)}`;', 'T3', 'startDaemon requires T3'],
  ] as const) {
    assert.equal(touchesMachineResources(file, source), true, source);
    const result = lintTestSource(file, source, 'T1');
    assert.equal(result.qualifies, tier, source);
    assert.ok(result.findings.some(finding => finding.message === message), source);
  }
});

test('servers bound at construction require socket admission', () => {
  for (const source of [
    'new WebSocketServer({ port: 0 });',
    "import { WebSocketServer } from 'ws';\nnew WebSocketServer({ port: 0 });",
    "import { WebSocketServer as Server } from 'ws'; new Server({ server: httpServer });",
    "import * as ws from 'ws'; new ws.WebSocketServer({ port: 0 });",
    "import ws from 'ws'; new ws.Server({ server });",
    "const { WebSocketServer: Server } = require('ws'); const options = { port: 0 }; new Server(options);",
    "const ws = await import('ws'); const Server = ws.WebSocketServer; new Server({ 'port': 0 });",
    "import { WebSocketServer } from 'ws'; const base = { port: 0 }; const options = ({ ...base } as Options) satisfies Options; new WebSocketServer(options);",
  ]) {
    const result = lintTestSource(file, source, 'T1');
    assert.equal(result.qualifies, 'T2', source);
    assert.ok(result.findings.some(f => f.rule === 'tier-import' && f.message === 'socket server requires T2'), source);
    assert.equal(touchesMachineResources(file, source), true, source);
    assert.deepEqual(lintTestSource(file, source, 'T2').findings, [], source);
  }
  const located = lintTestSource(file, "import { WebSocketServer } from 'ws';\nnew WebSocketServer({ port: 0 });", 'T1');
  assert.equal(located.findings[0]?.line, 2);
});

test('unbound server constructors and inert socket text stay T1', () => {
  for (const source of [
    "import { WebSocketServer } from 'ws'; new WebSocketServer({ noServer: true });",
    "import { WebSocketServer } from 'ws';",
    "import { WebSocketServer } from './memory-server.ts'; new WebSocketServer({ port: 0 });",
    'class WebSocketServer {} new WebSocketServer({ port: 0 });',
    "import { WebSocketServer } from 'ws'; function check(WebSocketServer) { new WebSocketServer({ port: 0 }); }",
    "import { WebSocketServer } from 'ws'; const first = second; const second = first; new WebSocketServer(first);",
    'const text = "new WebSocketServer({ port: 0 }); net.createServer().listen(0);";',
    'const text = `new WebSocketServer({ server }); https.createServer().listen(0);`;',
    '// new WebSocketServer({ port: 0 });\n/* http.createServer().listen(0); */',
  ]) {
    assert.deepEqual(lintTestSource(file, source, 'T1').findings, [], source);
    assert.equal(touchesMachineResources(file, source), false, source);
  }
});

test('createServer listen chains keep their socket findings', () => {
  for (const module of ['net', 'http', 'https']) {
    const source = `import * as server from 'node:${module}'; server.createServer(() => {}).listen(0);`;
    const result = lintTestSource(file, source, 'T1');
    assert.equal(result.qualifies, 'T2', module);
    assert.ok(result.findings.some(f => f.message === 'socket listen requires T2'), module);
    assert.equal(touchesMachineResources(file, source), true, module);
  }
});

test('spoke readiness source qualifies for T2 because its WebSocketServer binds a port', async () => {
  const path = 'hub/test/spoke-readiness.test.ts';
  const source = await readFile(new URL('./spoke-readiness.test.ts', import.meta.url), 'utf8');
  const result = lintTestSource(path, source, 'T1');
  assert.equal(result.qualifies, 'T2');
  assert.ok(result.findings.some(f => f.message === 'socket server requires T2'));
  assert.equal(touchesMachineResources(path, source), true);
});

test('filesystem calls on shared suite locks require T2', () => {
  for (const source of [
    "import { existsSync } from 'node:fs'; existsSync('/tmp/cland-suite.lock');",
    "import { existsSync } from 'node:fs'; existsSync('/tmp/cland-suite-nvim.lock');",
    "import { existsSync as present } from 'node:fs'; present('/tmp/cland-suite.lock');",
    "import * as fs from 'node:fs'; fs.statSync(`/tmp/cland-suite-nvim.lock`);",
    "import { stat } from 'node:fs/promises'; const lock = '/tmp/cland-suite.lock'; await stat(lock);",
  ]) {
    assert.equal(touchesMachineResources(file, source), true, source);
    const result = lintTestSource(file, source, 'T1');
    assert.equal(result.qualifies, 'T2', source);
    assert.ok(result.findings.some(finding => finding.message === 'shared suite lock requires T2'), source);
  }
  for (const source of [
    "import { existsSync } from 'node:fs'; const lock = '/tmp/cland-suite.lock';",
    "import { existsSync } from 'node:fs'; existsSync('private.lock');",
    "import { writeFileSync } from 'node:fs'; writeFileSync('report.txt', '/tmp/cland-suite.lock');",
    "import { existsSync } from './memory-fs.ts'; existsSync('/tmp/cland-suite.lock');",
    "const existsSync = () => false; existsSync('/tmp/cland-suite.lock');",
  ]) {
    assert.equal(touchesMachineResources(file, source), false, source);
    assert.deepEqual(lintTestSource(file, source, 'T1').findings, [], source);
  }
});

test('tier rules locate process imports and calls while accepting in-process collaborators', () => {
  assert.deepEqual(lintTestSource(file, input('processImport'), 'T1').findings,
    [{ file, line: 2, rule: 'tier-import', message: 'child_process requires T2' }]);
  assert.deepEqual(lintTestSource(file, input('daemonCall'), 'T2').findings,
    [{ file, line: 2, rule: 'tier-process', message: 'startDaemon requires T3' }]);
  for (const [tier, source] of [
    ['T1', input('unitImports')],
    ['T2', input('componentImports')],
  ] as const) assert.deepEqual(lintTestSource(file, source, tier).findings, []);
  for (const source of [
    input('daemonAlias'),
    input('namespaceProcess'),
    input('spawnedHub'),
    input('dynamicProcessImport'),
  ]) assert.ok(lintTestSource(file, source, 'T1').findings.length, source);
});

test('wrapped child calls retain process findings and hub target classification', () => {
  for (const name of [
    'promisifiedProcess', 'aliasedPromisifiedProcess', 'namespacePromisifiedProcess',
    'destructuredProcess', 'dynamicDestructuredProcess', 'exportedProcessAlias',
  ]) {
    const source = input(name);
    const result = lintTestSource(file, source, 'T1');
    assert.equal(result.qualifies, 'T3', name);
    assert.ok(result.findings.some(f => f.message === 'child process requires T2'), name);
    assert.ok(result.findings.some(f => f.message === 'spawned hub or harness binary requires T3'), name);
    assert.equal(touchesMachineResources(file, source), true, name);
  }
  for (const [name, tier] of [
    ['unusedProcessWrapper', 'T2'], ['foreignProcessWrapper', 'T1'],
    ['shadowedProcessWrapper', 'T2'], ['cyclicProcessAlias', 'T1'],
  ] as const) {
    const result = lintTestSource(file, input(name), tier);
    assert.equal(result.qualifies, tier, name);
    assert.deepEqual(result.findings, [], name);
  }
});

test('generic child processes require T3 while the cland CLI retains T2', () => {
  for (const name of ['genericChild', 'wrappedGenericChild', 'unknownCliChild', 'clandMentionInScript']) {
    const result = lintTestSource(file, input(name), 'T2');
    assert.equal(result.qualifies, 'T3', name);
    assert.ok(result.findings.some(f => f.rule === 'tier-process' && f.message === 'child process requires T3'), name);
  }
  for (const name of ['clandCliChild', 'harnessCliChild']) {
    const result = lintTestSource(file, input(name), 'T2');
    assert.equal(result.qualifies, 'T2', name);
    assert.deepEqual(result.findings, [], name);
  }
});

test('wall-clock waits and elapsed assertions require a reason on their line', () => {
  for (const wait of [input('sleepWait'), input('pauseWait'), input('delayWait'), input('timeoutWait'), input('promiseTimerWait')]) {
    assert.ok(lintTestSource(file, wait, 'T2').findings.some(f => f.rule === 'wall-clock-wait'), wait);
    assert.deepEqual(lintTestSource(file, wait + input('reasonedWaitSuffix'), 'T2').findings, []);
    assert.ok(lintTestSource(file, wait + input('blankWaitSuffix'), 'T2').findings.length);
  }
  for (const elapsed of [
    input('elapsedDate'),
    input('elapsedPerformance'),
    input('assertionAlias'),
  ]) {
    assert.ok(lintTestSource(file, elapsed, 'T2').findings.some(f => f.rule === 'wall-clock-assertion'), elapsed);
    assert.deepEqual(lintTestSource(file, elapsed + input('reasonedAssertionSuffix'), 'T2').findings, []);
  }
  assert.deepEqual(lintTestSource(file, input('timestampOnly'), 'T2').findings, []);
  assert.ok(lintTestSource(file, input('quotedReasonMarker'), 'T2').findings.length);
});

test('prompter pause methods stay hermetic while timer pauses require T2', () => {
  for (const source of ["prompter.pause('Press Enter');", 'prompter.pause(message);']) {
    assert.equal(lintTestSource(file, source, 'T1').qualifies, 'T1', source);
    assert.equal(touchesMachineResources(file, source), false, source);
  }
  for (const source of [
    'pause(50);',
    'pause(duration);',
    "import { pause } from './harness.ts'; pause(duration);",
    "import * as harness from './harness.ts'; harness.pause(duration);",
    "import { setTimeout as pause } from 'node:timers/promises'; pause(duration);",
    'timer.pause(50);',
  ]) {
    assert.equal(lintTestSource(file, source, 'T1').qualifies, 'T2', source);
    assert.equal(touchesMachineResources(file, source), true, source);
  }
  assert.ok(lintTestSource(file, 'pause(50);', 'T2').findings.some(f => f.rule === 'wall-clock-wait'));
});

test('FakeClock receivers and source literals stay hermetic without hiding real timers', () => {
  const fake = input('fakeClock');
  assert.equal(touchesMachineResources(file, fake), false);
  assert.equal(touchesMachineResources(file, input('sqlCall')), false);
  assert.deepEqual(lintTestSource(file, fake, 'T1').findings, []);
  assert.equal(touchesMachineResources(file, input('fakeAdapter')), false);
  assert.equal(touchesMachineResources(file, input('sourceLiteral')), false);
  const shadowed = input('callbackShadowing');
  const scoped = lintTestSource(file, shadowed, 'T1');
  assert.equal(scoped.qualifies, 'T2');
  assert.deepEqual(scoped.findings.map(f => [f.line, f.rule]), [[4, 'wall-clock-wait']]);
  assert.equal(touchesMachineResources(file, shadowed), true);
  for (const inner of [
    input('loopInitializer'),
    input('loopIteration'),
    input('blockShadowing'),
    input('catchBlock'),
  ]) {
    const source = input('scopePrefix') + inner + input('scopeSuffix');
    assert.equal(touchesMachineResources(file, source), true, inner);
    assert.equal(lintTestSource(file, source, 'T1').qualifies, 'T2', inner);
  }
  const caught = input('catchShadowing');
  assert.equal(touchesMachineResources(file, caught), true, 'catch parameter shadows an outer fake receiver');

  assert.equal(touchesMachineResources(file, input('mutableClock')), true);
  for (const source of [input('realTimeout'), input('realInterval'), input('unknownReceiver'), input('foreignClock')]) assert.equal(touchesMachineResources(file, source), true, source);
});

test('lifecycle headers apply to T3 while stub-only Neovim qualifies for T2', () => {
  assert.deepEqual(lintTestSource(file, input('missingHeader'), 'T3').findings.map(f => f.rule), ['t3-lifecycle']);
  assert.deepEqual(lintTestSource(file, input('commentBlockHeader'), 'T3').findings, []);
  assert.deepEqual(lintTestSource(file, input('lineHeader'), 'T3').findings, []);
  assert.deepEqual(lintTestSource(file, input('genericHeader'), { tier: 'T3', contract: 'codex' }).findings, []);
  assert.deepEqual(lintTestSource(file, input('genericHeader'), { tier: 'T3', scenario: 'launch' }).findings, []);
  const stub = lintTestSource(input('editorFile'), input('stubClient'), 'T2');
  assert.equal(stub.qualifies, 'T2'); assert.deepEqual(stub.findings, []);
  for (const environment of [input('emptyEnvironment'), input('emptyObjectEnvironment'), input('unknownEnvironment'), input('realEnvironment')]) {
    const real = lintTestSource(input('editorFile'), input('editorPrefix') + environment + input('editorSuffix'), 'T2');
    assert.equal(real.qualifies, 'T3', environment);
    assert.ok(real.findings.some(f => f.rule === 'tier-process'));
  }
  const aliased = lintTestSource(input('editorFile'), input('aliasedStubClient'), 'T2');
  assert.equal(aliased.qualifies, 'T2'); assert.deepEqual(aliased.findings, []);

  assert.equal(lintTestSource(input('editorFile'), input('realClient'), 'T3').qualifies, 'T3');
});

test('report names findings and every file qualifying tier without refusing', () => {
  const result = testLintReport([lintTestSource(file, input('reportWait'), 'T2'), lintTestSource('hub/test/clean.test.ts', input('emptySource'), 'T1')]);
  assert.equal(result[0], 'test lint (report only): 1 findings in 1 files');
  assert.match(result[1]!, /planted.test.ts:1 \[wall-clock-wait\]/);
  assert.ok(result.includes('test lint tier: hub/test/clean.test.ts: T1; qualifies T1'));
});

// T1: report formatting over source facts; resources are inert planted data.
test('summary counts finding kinds without repeating resource paths', () => {
  const planted = lintTestSource(file, input('reportWait'), 'T2');
  planted.reachable = { tier: 'T3', resources: [
    { file, line: 1, rule: 'tier-process', message: 'first path requires T3' },
    { file, line: 2, rule: 'tier-process', message: 'second path requires T3' },
    { file, line: 3, rule: 'tier-import', message: 'socket path requires T2' },
  ] };
  assert.deepEqual(testLintReport([planted], { summaryOnly: true }), [
    'test lint (report only): 1 findings in 1 files',
    'test lint finding kinds: wall-clock-wait 1',
    'test lint reachable (diagnostic only): 3 resources; tier-import 1; tier-process 2',
  ]);
  assert.equal(testLintReport([planted], { detailedReachable: true }).filter(line => line.startsWith('test lint reachable resource:')).length, 3);
  assert.deepEqual(testLintReport([], { summaryOnly: true }), [
    'test lint (report only): 0 findings in 0 files',
    'test lint finding kinds: none',
    'test lint reachable (diagnostic only): 0 resources; none',
  ]);
});

test('numeric waits cannot grow and shrinking retires their allowance', async () => {
  const { checkTestLint, shrinkLintBaseline } = await import('../src/test-lint-policy.ts');
  const manifest = { version: 1 as const, tests: { [file]: 'T2' as const } };
  const baseline = { version: 1 as const, files: { [file]: { 'wall-clock-wait': 1 } } };
  const source = async () => 'sleep(10);\nsleep(20);';
  const findings = await checkTestLint({ manifest, source, baseline, base: { manifest, baseline } });
  assert.equal(findings[0]?.rule, 'wall-clock-wait');
  assert.equal(findings[0]?.line, 2);
  assert.equal((await checkTestLint({ manifest, source: async () => 'sleep(10); sleep(20);', baseline, base: { manifest, baseline } }))[0]?.rule, 'wall-clock-wait', 'two sites on one line must not collapse into one allowance');
  assert.deepEqual(await checkTestLint({ manifest, source: async () => 'sleep(10);\nsleep(20); // lint-allow-wall-clock: waits for native timeout boundary', baseline, base: { manifest, baseline } }), []);
  const shrunk = await shrinkLintBaseline(manifest, async () => '', baseline);
  assert.deepEqual(shrunk.files[file], {});
  assert.equal((await checkTestLint({ manifest, source: async () => 'sleep(10);', baseline: shrunk, base: { manifest, baseline: shrunk } }))[0]?.rule, 'wall-clock-wait');
});

test('existing lifecycle files report a displaced header before process allowances', async () => {
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  for (const tier of ['T3', 'T4'] as const) {
    const manifest = { version: 1 as const, tests: { [file]: tier } };
    for (const startDaemon of [0, 3]) {
      const baseline = { version: 1 as const, files: { [file]: { startDaemon } } };
      const body = "import { startDaemon } from './harness.ts';\n" +
        `// ${tier}: native crash and restart\nstartDaemon(); startDaemon(); startDaemon();`;
      assert.deepEqual(await checkTestLint({ manifest, source: async () => body, baseline, base: { manifest, baseline, source: async () => `// ${tier}: native crash and restart\n` + body } }), [
        { file, line: 1, rule: 't3-lifecycle', message: `first comment block must name the process behaviour: ${tier}: <behaviour>` },
      ]);
    }
  }
});

test('losing a lifecycle declaration is refused even without process helper growth', async () => {
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  for (const tier of ['T3', 'T4'] as const) {
    const manifest = { version: 1 as const, tests: { [file]: tier } };
    const baseline = { version: 1 as const, files: {} };
    assert.deepEqual(await checkTestLint({ manifest, baseline, source: async () => '// ordinary comment',
      base: { manifest, baseline, source: async () => `// ${tier}: native crash and restart` } }), [
      { file, line: 1, rule: 't3-lifecycle', message: `first comment block must name the process behaviour: ${tier}: <behaviour>` },
    ]);
  }
});

test('never-headed lifecycle debt and headed files keep their lint result', async () => {
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  for (const tier of ['T3', 'T4'] as const) {
    const manifest = { version: 1 as const, tests: { [file]: tier } };
    const baseline = { version: 1 as const, files: { [file]: { startDaemon: 1 } } };
    for (const header of ['', `// ${tier}: native crash and restart\n`]) {
      const source = async () => header + 'startDaemon();\nsleep(10);';
      assert.deepEqual(await checkTestLint({ manifest, source, baseline, base: { manifest, baseline, source } }), [
        { file, line: header ? 3 : 2, rule: 'wall-clock-wait', message: 'wall-clock-wait count 1 exceeds frozen allowance 0' },
      ]);
    }
  }
});

test('process helper growth requires lifecycle evidence for each category', async () => {
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  const manifest = { version: 1 as const, tests: { [file]: 'T3' as const } };
  const baseline = { version: 1 as const, files: {} };
  for (const helper of ['startDaemon', 'spawnSpoke', 'fakeClaude', 'fakeCodex', 'fakeOpenCode']) {
    const source = async () => `import { ${helper} as run } from './harness.ts'; run(t, root);`;
    assert.equal((await checkTestLint({ manifest, source, baseline, base: { manifest, baseline } }))[0]?.rule, 't3-lifecycle');
    assert.deepEqual(await checkTestLint({ manifest, source: async () => '// T3: native child shutdown and reaping\n' + await source(), baseline, base: { manifest, baseline } }), []);
  }
});

test('shrinking a retired spawnSpoke allowance refuses a planted call in an existing T2 file', async () => {
  const { checkTestLint, shrinkLintBaseline } = await import('../src/test-lint-policy.ts');
  const manifest = { version: 1 as const, tests: { [file]: 'T2' as const } };
  const baseline = { version: 1 as const, files: { [file]: { spawnSpoke: 1 } } };
  const base = { manifest, baseline };
  const planted = async () => "import { spawnSpoke } from './harness.ts'; spawnSpoke({ name: 'planted' });";
  assert.deepEqual(await checkTestLint({ manifest, source: planted, baseline, base }), []);
  const shrunk = await shrinkLintBaseline(manifest, async () => '', baseline);
  assert.deepEqual(shrunk.files[file], {});
  assert.deepEqual(await checkTestLint({ manifest, source: planted, baseline: shrunk, base }), [
    { file, line: 1, rule: 'spawnSpoke', message: 'spawnSpoke count 1 exceeds frozen allowance 0' },
  ]);
});

test('T4 lifecycle headers exempt process helpers while preserving wait and tier rules', async () => {
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  const source = async () => '// T4: resistant native process deadlines and reaping\nstartDaemon(t, root);';
  const manifest = { version: 1 as const, tests: { [file]: 'T4' as const } };
  assert.deepEqual(await checkTestLint({ manifest, source }), []);
  assert.equal((await checkTestLint({ manifest, source: async () => 'startDaemon(t, root);' }))[0]?.rule, 'startDaemon');
  assert.equal((await checkTestLint({ manifest, source: async () => await source() + '\nsleep(10);' }))[0]?.rule, 'wall-clock-wait');
  for (const tier of ['T1', 'T2', 'T3'] as const) {
    const findings = await checkTestLint({ manifest: { version: 1, tests: { [file]: tier } }, source });
    assert.ok(findings.some(f => f.rule === (tier === 'T3' ? 't3-lifecycle' : 'tier-process')), tier);
    assert.ok(findings.some(f => f.rule === 'startDaemon'), 'T4 header cannot exempt another tier');
  }
});

test('new files require tier rules or a T3 lifecycle declaration', async () => {
  const { checkTestLint } = await import('../src/test-lint-policy.ts');
  for (const entry of ['T3', { tier: 'T3', contract: 'codex' }, { tier: 'T3', scenario: 'flow' }] as const) {
    const manifest = { version: 1 as const, tests: { [file]: entry } };
    const findings = await checkTestLint({ manifest, source: async () => '' });
    assert.equal(findings.some(f => f.rule === 't3-lifecycle'), typeof entry === 'string' || !('contract' in entry || 'scenario' in entry));
    assert.deepEqual(await checkTestLint({ manifest, source: async () => '// T3: process crash and restart' }), []);
  }
  const findings = await checkTestLint({ manifest: { version: 1, tests: { [file]: 'T2' } }, source: async () => 'startDaemon(t, root);' });
  assert.ok(findings.some(f => f.rule === 'tier-process'));
});

test('baseline counts cannot grow or disappear with the frozen file', async () => {
  const { checkTestLint, LINT_BASELINE } = await import('../src/test-lint-policy.ts');
  const manifest = { version: 1 as const, tests: { [file]: 'T3' as const } };
  const baseline = { version: 1 as const, files: { [file]: { startDaemon: 1 } } };
  const source = async () => '// T3: lifecycle\nstartDaemon(); startDaemon();';
  const grown = { version: 1 as const, files: { [file]: { startDaemon: 2 } } };
  const findings = await checkTestLint({ manifest, source, baseline: grown, base: { manifest, baseline } });
  assert.equal(findings[0]?.file, LINT_BASELINE);
  assert.match(findings[0]!.message, /baseline grew.*startDaemon/);
  assert.equal((await checkTestLint({ manifest, source, base: { manifest, baseline } }))[0]?.rule, 'lint-baseline');
});
