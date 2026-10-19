// T3: real child/grandchild preload propagation and sandbox write denial require native processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The standalone tooling is JavaScript so NODE_OPTIONS can preload it in all children.
// @ts-expect-error test tooling does not publish TypeScript declarations
import { aggregate, compare, knownGaps, report } from './spawn-census/report.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const preload = new URL('./spawn-census/recorder.mjs', import.meta.url).href;

test('census records all spawn methods once, attributes helpers and grandchildren, and compares aggregates', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-census-fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const fixture = join(root, 'hub', 'test');
  const records = join(root, 'records');
  mkdirSync(fixture, { recursive: true });
  mkdirSync(records);
  writeFileSync(join(fixture, 'helper.mjs'), `import { spawnSync } from 'node:child_process'; export function fixtureHelper() { const result = spawnSync('git', ['--version', 'SECRET_LATER_ARGUMENT']); if (result.status !== 0) throw new Error('git failed'); }`);
  writeFileSync(join(fixture, 'grandchild.mjs'), `import { spawnSync } from 'node:child_process'; const result = spawnSync('ps', ['-p', String(process.pid)]); if (result.status !== 0) throw new Error('ps failed');`);
  writeFileSync(join(fixture, 'fixture.test.mjs'), `
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, exec, execSync, execFile, execFileSync, fork } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { fixtureHelper } from './helper.mjs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
test('fixture', async () => {
  const env = { ...process.env, CENSUS_SECRET: 'SECRET_ENV_VALUE' };
  const savedFs = Object.fromEntries(Object.entries(fs).filter(([key, value]) => key.endsWith('Sync') && typeof value === 'function'));
  for (const key of Object.keys(savedFs)) fs[key] = () => { throw new Error('recorder reached patched ' + key); };
  syncBuiltinESMExports();
  try { assert.equal(spawnSync('git', ['--version', 'SECRET_LATER_ARGUMENT'], { env }).status, 0); }
  finally { Object.assign(fs, savedFs); syncBuiltinESMExports(); }
  fixtureHelper();
  assert.equal(await once(spawn('git', ['--version']), 'exit').then(([code]) => code), 0);
  await new Promise((resolve, reject) => exec('git --version # SECRET_SHELL_TEXT', error => error ? reject(error) : resolve()));
  execSync('git --version # SECRET_SHELL_TEXT');
  await new Promise((resolve, reject) => execFile('git', ['--version'], error => error ? reject(error) : resolve()));
  execFileSync('git', ['--version']);
  const promise = promisify(execFile)('git', ['--version']);
  assert.ok(promise.child.pid);
  assert.match((await promise).stdout, /git version/);
  assert.match((await promisify(exec)('git --version')).stdout, /git version/);
  await assert.rejects(promisify(execFile)(process.execPath, ['-e', 'process.stdout.write(\"out\"); process.stderr.write(\"err\"); process.exit(2)']), error => error.stdout === 'out' && error.stderr === 'err');
  const filteredEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  assert.equal(spawnSync(process.execPath, [new URL('./grandchild.mjs', import.meta.url).pathname], { env: filteredEnv }).status, 0);
  const strippedEnv = { ...filteredEnv }; delete strippedEnv.NODE_OPTIONS;
  assert.equal(spawnSync(process.execPath, [new URL('./grandchild.mjs', import.meta.url).pathname], { env: strippedEnv }).status, 0);
  assert.equal(await once(fork(new URL('./grandchild.mjs', import.meta.url)), 'exit').then(([code]) => code), 0);
});`);
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: `--import=${preload}`, TEST_SPAWN_CENSUS_ROOT: records, TEST_SPAWN_CENSUS_REPO: root };
  delete env.TEST_SPAWN_CENSUS_TEST;
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', join(fixture, 'fixture.test.mjs')], { env, encoding: 'utf8', timeout: 20_000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const raw = readdirSync(records).map(file => readFileSync(join(records, file), 'utf8')).join('');
  assert.doesNotMatch(raw, /SECRET_LATER_ARGUMENT|SECRET_ENV_VALUE|SECRET_SHELL_TEXT/);
  const lines = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.ok(lines.every(row => !Number.isNaN(Date.parse(row.timestamp))));
  const git = lines.filter(row => row.command === 'git');
  assert.equal(git.length, 6);
  assert.ok(git.every(row => row.testFile === 'hub/test/fixture.test.mjs'));
  assert.equal(git.filter(row => row.helper === 'hub/test/helper.mjs fixtureHelper').length, 1, JSON.stringify(git));
  const ps = lines.filter(row => row.command === 'ps');
  assert.equal(ps.length, 2);
  assert.ok(ps.every(row => row.testFile === 'hub/test/fixture.test.mjs' && row.helper === 'hub/test/grandchild.mjs'));
  assert.equal(lines.filter(row => row.command === 'sh').length, 3);
  const metadata = { head: 'before', suiteDuration: 'suite duration 1.00s', gaps: [] };
  const before = aggregate(records, metadata);
  assert.ok(before.gaps.includes('hub/test/fixture.test.mjs'));
  assert.equal(before.gapSources.reduce((sum: number, row: { count: number }) => sum + row.count, 0), 1);
  assert.equal(before.commands.find((row: { command: string }) => row.command === 'git').count, 6);
  assert.match(report(before), /Ten largest sources/);
  writeFileSync(join(records, 'extra.jsonl'), JSON.stringify({ timestamp: new Date().toISOString(), command: 'git', firstArgument: 'status', testFile: 'hub/test/fixture.test.mjs', helper: 'hub/test/helper.mjs fixtureHelper' }) + '\n' + '{incomplete');
  const after = aggregate(records, { ...metadata, head: 'after' });
  assert.equal(after.total, before.total + 1);
  assert.equal(after.truncatedLines, 1);
  const diff = compare(before, after);
  assert.match(diff, /\| git \| 6 \| 7 \| 1 \| 16.7% \|/);
  assert.match(diff, /hub\/test\/helper.mjs fixtureHelper \| 1 \| 2 \| 1/);
  // Audit controlled sources so migrations of real tests cannot stale these expectations.
  const nvimFixture = join(root, 'nvim', 'test');
  mkdirSync(nvimFixture, { recursive: true });
  writeFileSync(join(fixture, 'env-gap.test.ts'), 'process.env.NODE_OPTIONS = "";');
  writeFileSync(join(nvimFixture, 'sandbox-gap.test.ts'), 'const sandbox = "sandbox-exec";');
  writeFileSync(join(fixture, 'covered.test.ts'), 'export {};');
  writeFileSync(join(fixture, 'helper.ts'), 'process.env.NODE_OPTIONS = "";');
  assert.deepEqual(knownGaps(root), ['hub/test/env-gap.test.ts', 'nvim/test/sandbox-gap.test.ts']);
});


test('a sandbox denying census log writes preserves child stdout, exit and spawns', t => {
  const sandbox = '/usr/bin/sandbox-exec';
  if (spawnSync(sandbox, ['-p', '(version 1)(allow default)', '/usr/bin/true']).status !== 0) {
    t.skip('needs macOS sandbox-exec');
    return;
  }
  const root = mkdtempSync(join(tmpdir(), 'cland-census-denied-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Node restores a deleted coverage variable when spawning; empty disables writes.
  const env = { ...process.env, NODE_V8_COVERAGE: '', NODE_OPTIONS: `--import=${preload}`, TEST_SPAWN_CENSUS_ROOT: root, TEST_SPAWN_CENSUS_REPO: repo };
  const launcher = join(root, 'launcher.mjs');
  writeFileSync(launcher, `import { spawnSync } from 'node:child_process'; const child = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)(deny file-write*)', process.execPath, '-e', 'const cp = require("node:child_process"); if (cp.spawnSync("/usr/bin/true").status !== 0) process.exit(2); process.stdout.write("unchanged");'], { encoding: 'utf8' }); process.stdout.write(child.stdout); process.stderr.write(child.stderr); process.exit(child.status);`);
  const result = spawnSync(process.execPath, [launcher], { env, encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'unchanged');
  assert.equal(result.stderr, '');
  const data = aggregate(root);
  assert.equal(data.total, 1);
  assert.equal(data.gapSources[0].count, 1);
  assert.match(data.gapSources[0].source, /sandbox may deny census log writes/);
});
