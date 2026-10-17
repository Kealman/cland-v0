// T1: syntax policy uses planted source text and performs no test execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lintTestSource, testLintReport, touchesMachineResources } from '../src/test-lint.ts';

// Shared planted source inputs are data, never executed by these tests.
const sources = JSON.parse(await readFile(new URL('./fixtures/test-lint-sources.json', import.meta.url), 'utf8')) as Record<string, string>;
const input = (name: string): string => { assert.equal(typeof sources[name], 'string', name); return sources[name]!; };

const file = 'hub/test/planted.test.ts';
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
