// T1: Web admission, cadence, workers and budget decisions on scratch source facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chooseSuiteMode, selectionFromEnv, sameSuiteSelection, taskSuiteSelection, tierSuiteSelection, WEB_SMOKE, HUB_SMOKE, NVIM_SMOKE } from '../src/suite-selection.ts';
import { hubShards, packageShards, serializeTierManifest, type TierManifest } from '../src/suite-shards.ts';
import { occasionSelection } from '../src/verification-occasion.ts';
import { verificationCommands } from '../src/verification-commands.ts';
import { pinVerificationPlan } from '../src/verification-plan.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { checkDurations, TIER_BUDGETS } from '../src/suite-durations.ts';
import { webPhaseAvailable, unavailableWebPhase, webUnavailableLine } from '../src/web-phase.ts';
import { suiteEvidence } from '../src/suite-log.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { planTierReport, tierPlanWorkers } from '../src/suite-tier-report.ts';

async function sources(t: import('node:test').TestContext, web = true) {
  const root = await mkdtemp(join(tmpdir(), 'web-plan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tests: TierManifest['tests'] = {
    ...Object.fromEntries(HUB_SMOKE.map(file => [file, 'T3' as const])),
    'hub/test/unit.test.ts': 'T1', 'hub/test/component.test.ts': 'T2',
    ...Object.fromEntries(NVIM_SMOKE.map(file => [file, 'T3' as const])),
    ...(web ? { 'web/test/feature.test.ts': 'Web' as const, [WEB_SMOKE[0]!]: 'Web' as const } : {}),
  };
  for (const file of Object.keys(tests)) { await mkdir(join(root, file, '..'), { recursive: true }); await writeFile(join(root, file), ''); }
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  return root;
}

test('tier lint accepts Web and rejects an unknown classification', async t => {
  const root = await sources(t);
  await hubShards(root);
  const path = join(root, 'hub/test/tiers.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.tests['web/test/feature.test.ts'] = 'Unknown';
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(hubShards(root), /invalid tier or tier object for test: web\/test\/feature.test.ts/);
});

test('web diffs select web-only and protocol, edge and mixed diffs force full', () => {
  assert.equal(chooseSuiteMode(['web/src/Shell.tsx', 'web/test/smoke.test.ts']), 'web-only');
  for (const path of ['web/package.json', 'web/tsconfig.tools.json']) assert.equal(chooseSuiteMode([path]), 'web-only', path);
  for (const path of ['hub/src/protocol.ts', 'shared/wire/index.ts', 'hub/src/hub/web-edge.ts', 'hub/src/hub/web-auth.ts', 'hub/src/web-bundle.ts', 'hub/src/cli/web.ts']) assert.equal(chooseSuiteMode([path]), 'full', path);
  assert.equal(chooseSuiteMode(['web/src/Shell.tsx', 'hub/src/store.ts']), 'full');
  const selection = { mode: 'web-only' as const, files: ['web/src/Shell.tsx'], reason: 'web' };
  assert.deepEqual(selectionFromEnv({ CLAND_SUITE_SELECTION: JSON.stringify(selection) }), selection);
  assert.equal(sameSuiteSelection(selection, { ...selection, web: 'none' }), false);
});

test('Web is a separate machine phase after hub with two local and four remote workers', async t => {
  const root = await sources(t);
  for (const executor of ['local', 'droplet'] as const) {
    const phases = await packageShards(root, 'web-only', undefined, undefined, { executor, workers: 7 });
    assert.deepEqual(phases.map(phase => phase.name), ['hub machine smoke', 'Web', 'Neovim smoke']);
    assert.deepEqual(phases[0]!.targets, [...HUB_SMOKE].sort());
    assert.deepEqual(phases[2]!.targets, NVIM_SMOKE);
    assert.deepEqual(phases[1], { name: 'Web', targets: ['web/test/feature.test.ts', 'web/test/smoke.test.ts'], resource: 'machine', workers: executor === 'local' ? 2 : 4 });
    const plan = await planTierReport(root, { mode: 'web-only', files: [], reason: 'web' }, 7, phases);
    assert.equal(plan.find(row => row.tier === 'Web')!.workers, executor === 'local' ? 2 : 4);
    assert.equal(tierPlanWorkers(plan, 9).find(row => row.tier === 'Web')!.workers, executor === 'local' ? 2 : 4);
  }
  for (const mode of ['hub-only', 'nvim-only'] as const) assert.deepEqual((await packageShards(root, mode)).find(phase => phase.name === 'Web smoke')!.targets, WEB_SMOKE);
});

test('tasks keep Web through T0-T2 caps; web-touching batches include it', async t => {
  const root = await sources(t);
  const full = { mode: 'full' as const, files: [], reason: 'shared' };
  const task = taskSuiteSelection(full, 't/T-991', 'auto', true);
  const phases = await packageShards(root, task.mode, undefined, task);
  assert.ok(phases.some(phase => phase.name === 'Web'));
  const split = [];
  for (const tier of ['T1', 'T2', 'Web'] as const) { const narrowed = tierSuiteSelection(task, tier); split.push(...await packageShards(root, narrowed.mode, undefined, narrowed)); }
  assert.deepEqual(split.flatMap(phase => phase.targets).sort(), phases.flatMap(phase => phase.targets).sort());
  for (const occasion of ['batch', 'dev-t3', 'stage', 'epic', 'release', 'soak'] as const) {
    const selection = occasionSelection(full, occasion, ['T1']);
    const phases = await packageShards(root, selection.mode, undefined, selection);
    assert.equal(phases.some(phase => phase.name === 'Web'), occasion !== 'batch', occasion);
  }
  const webBatch = occasionSelection({ ...full, files: ['web/src/Shell.tsx', 'hub/src/parser.ts'] }, 'batch', ['T1']);
  assert.ok((await packageShards(root, webBatch.mode, undefined, webBatch)).some(phase => phase.name === 'Web'));
  assert.equal(loadGateRepetitions('web/test/smoke.test.ts::browser fact', { ...full, loadGate: true }, {}), 0);
  assert.deepEqual(TIER_BUDGETS.Web, { testSeconds: 4, fileSeconds: 40, wallSeconds: 40 });
});

test('candidate Web capability pins Web after batch T1 only for web-touching diffs', async t => {
  const root = await sources(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest_unit="unit"\ntest_component="component"\ntest_integration="integration"\n');
  await writeFile(join(root, 'hub/test/run-suite.ts'), "export const supportsWebPhase = true; // candidate capability");
  const commands = await verificationCommands(root, root, {});
  assert.equal(commands.tiers?.Web, 'node hub/test/run-suite.ts --tier Web');
  assert.deepEqual(pinVerificationPlan(commands, { branch: 't/T-991', mode: 'auto' }).plan!.map(step => step.name), ['T1', 'T2', 'Web']);
  assert.deepEqual(pinVerificationPlan(commands, { branch: 'dev', mode: 'all', occasion: 'batch' }).plan!.map(step => step.name), ['T1', 'T3']);
  const selection = occasionSelection({ mode: 'full', files: ['web/src/Shell.tsx'], reason: 'candidate diff' }, 'batch');
  assert.deepEqual(pinVerificationPlan(commands, { branch: 'dev', mode: 'all', occasion: 'batch', selection }).plan!.map(step => step.name), ['T1', 'Web', 'T3']);
  await writeFile(join(root, 'hub/test/run-suite.ts'), '// old runner');
  assert.equal((await verificationCommands(root, root, {})).tiers?.Web, undefined);
});

test('without Web files task, batch, periodic and stage commands and phases stay unchanged', async t => {
  const root = await sources(t, false);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ncheck="check"\ntest_unit="unit"\ntest_component="component"\ntest_integration="integration"\ntest_soak="soak"\n');
  await writeFile(join(root, 'hub/test/run-suite.ts'), 'export const supportsWebPhase = true;');
  const commands = await verificationCommands(root, root, {});
  assert.deepEqual(commands.tiers, { T1: 'unit', T2: 'component', T3: 'integration', T4: 'soak' });
  const full = { mode: 'full' as const, files: [], reason: 'compatibility' };
  const task = taskSuiteSelection(full, 't/T-1025', 'auto', true);
  const unit = { name: 'hub free', resource: 'free', workers: 1, targets: ['hub/test/unit.test.ts'] };
  const component = { name: 'hub machine', resource: 'machine', workers: 4, targets: ['hub/test/component.test.ts'] };
  assert.deepEqual(await packageShards(root, task.mode, undefined, task, { workers: 4 }), [{ ...unit, name: 'T1 whole' }, component]);
  const batch = occasionSelection(full, 'batch', ['T1']);
  assert.deepEqual(await packageShards(root, batch.mode, undefined, batch, { workers: 4 }), [unit]);
  for (const [occasion, names] of [[undefined, ['check', 'T1', 'T2']], ['batch', ['check', 'T1']], ['dev-t3', ['check', 'T2', 'T3']], ['stage', ['check', 'T1', 'T2', 'T3', 'T4']]] as const) {
    const selection = occasion ? occasionSelection(full, occasion, ['T1']) : task;
    assert.deepEqual(pinVerificationPlan(commands, { branch: 't/T-1025', mode: 'auto', ...(occasion ? { occasion } : {}), selection }).plan!.map(step => step.name), names);
    assert.ok(!(await packageShards(root, selection.mode, undefined, selection)).some(phase => phase.name.startsWith('Web')));
  }
});

test('Web per-test budgets use four seconds in enforce mode', () => {
  const manifest = { version: 1 as const, source: { artifacts: [], commit: 'fixture' }, budget: { mode: 'enforce' as const, testSeconds: 5, fileSeconds: 60, Web: TIER_BUDGETS.Web }, files: {}, tests: {}, allow: {} };
  assert.deepEqual(checkDurations([{ file: 'web/test/smoke.test.ts', name: 'fact', seconds: 4 }], manifest, { 'web/test/smoke.test.ts': 'Web' }).failures, []);
  assert.match(checkDurations([{ file: 'web/test/smoke.test.ts', name: 'fact', seconds: 4.1 }], manifest, { 'web/test/smoke.test.ts': 'Web' }).failures[0]!, /4.1 s > 4 s \(Web\)/);
});

test('missing browser libraries report Web not run in durable evidence and result without failing other phases', async () => {
  const lines: string[] = [];
  const canRun = await webPhaseAvailable(async () => ({ available: false, reason: 'libnss3.so => not found' }), line => lines.push(line));
  assert.equal(canRun, false);
  const evidence = suiteEvidence(lines.join('\n'));
  const receipt = unavailableWebPhase(evidence)!;
  assert.deepEqual(receipt, { status: 'not-run', reason: 'libnss3.so => not found' });
  assert.match(evidence, /suite web phase /);
  const summary = suiteSummary('# tests 3\n# pass 3\n# fail 0\n' + evidence + '\ntier Web: files 1; tests 1 planned; observed unavailable\n');
  assert.ok(summary.includes(webUnavailableLine(receipt)), summary);
  assert.doesNotMatch(summary, /tier Web: exit 0/);
  assert.match(summary, /pass 3; fail 0/);
  const availableLines: string[] = [];
  assert.equal(await webPhaseAvailable(async () => ({ available: true, executablePath: '/scratch/headless-shell' }), line => availableLines.push(line)), true);
  assert.deepEqual(availableLines, [], 'availability alone never supplies passing browser evidence');
  await assert.rejects(webPhaseAvailable(async () => { throw new Error('broken prerequisite probe'); }, () => {}), /broken prerequisite probe/);
});
