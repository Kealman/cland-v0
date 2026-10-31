// T1: in-memory package scripts and import graphs; no command or installer runs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuardFindings } from './build-guard-tiers.ts';

const pkg = (scripts: Record<string, string>, extra = {}) => JSON.stringify({ scripts, ...extra });
test('build guards reached through prebuild and npm aliases must have a verify tier', () => {
  const files = new Map([
    ['site/package.json', pkg({ prebuild: 'npm test', build: 'astro build', test: 'node --test test/*.test.ts && node scripts/check-links.ts' })],
    ['site/test/onboarding.test.ts', ''], ['site/scripts/check-links.ts', ''],
    ['hub/test/site.test.ts', "import '../../site/test/onboarding.test.ts';"],
  ]);
  assert.deepEqual(buildGuardFindings(files, ['hub/test/site.test.ts']), [
    'site/package.json#prebuild -> test: site/scripts/check-links.ts has no verify tier',
  ]);
  assert.equal(buildGuardFindings(files, []).length, 2);
});

test('workspace build chains and arbitrary prebuild scripts are inventoried without running them', () => {
  const files = new Map([
    ['package.json', pkg({ build: 'npm run build --workspace app' })],
    ['app/package.json', pkg({ prebuild: 'node scripts/validate.ts', build: 'vite build' }, { name: 'app' })],
    ['app/scripts/validate.ts', ''],
  ]);
  assert.ok(buildGuardFindings(files, []).some(line => line.includes('app/scripts/validate.ts has no verify tier')));
});

test('type-only and lazy references cannot cover a build guard', () => {
  const files = new Map([
    ['site/package.json', pkg({ prebuild: 'npm test', test: 'node --test test/*.test.ts' })],
    ['site/test/a.test.ts', ''],
    ['hub/test/site.test.ts', "import type {} from '../../site/test/a.test.ts'; const later = () => import('../../site/test/a.test.ts');"],
  ]);
  assert.equal(buildGuardFindings(files, ['hub/test/site.test.ts']).length, 1);
  files.set('hub/test/site.test.ts', "import '../../site/test/a.test.ts';");
  assert.deepEqual(buildGuardFindings(files, ['hub/test/site.test.ts']), []);
});

test('prefixes, quoted paths, cycles and unmatched targets retain diagnostic evidence', () => {
  const files = new Map([
    ['package.json', pkg({ build: 'npm --prefix site run check' })],
    ['site/package.json', pkg({ check: 'node "scripts/guard links.ts"' })],
    ['site/scripts/guard links.ts', ''],
  ]);
  assert.match(buildGuardFindings(files, []).join('\n'), /site\/scripts\/guard links.ts has no verify tier/);
  files.set('site/package.json', pkg({ check: 'npm run check' }));
  assert.match(buildGuardFindings(files, []).join('\n'), /incomplete script cycle/);
  files.set('site/package.json', pkg({ check: 'node --test missing/*.test.ts' }));
  assert.match(buildGuardFindings(files, []).join('\n'), /incomplete guard target/);
});

test('a guard directly in build needs coverage regardless of its filename', () => {
  const files = new Map([
    ['package.json', pkg({ build: 'node scripts/sanity.ts && vite build' })],
    ['scripts/sanity.ts', ''],
  ]);
  assert.match(buildGuardFindings(files, []).join('\n'), /scripts\/sanity.ts has no verify tier/);
});

test('operand-free and eval launchers report incomplete inventory', () => {
  for (const command of ['node --test', `node -e "import('./scripts/check.ts')"`, 'bash -c "echo check"']) {
    const files = new Map([['package.json', pkg({ build: command })]]);
    assert.match(buildGuardFindings(files, []).join('\n'), /incomplete.*launch/);
  }
});

test('all selected workspaces are inspected and script arguments cannot change routing', () => {
  const files = new Map([
    ['package.json', pkg({ build: 'npm run check -w a -w b', check: 'node guard.ts' })],
    ['guard.ts', ''],
    ['a/package.json', pkg({ check: 'node guard.ts' }, { name: 'a' })],
    ['a/guard.ts', ''],
    ['b/package.json', pkg({ check: 'node guard.ts' }, { name: 'b' })],
    ['b/guard.ts', ''],
  ]);
  const findings = buildGuardFindings(files, ['b/guard.ts']).join('\n');
  assert.match(findings, /a\/guard.ts has no verify tier/);
  files.set('package.json', pkg({ build: 'npm run check -- --workspace b', check: 'node guard.ts' }));
  assert.match(buildGuardFindings(files, ['b/guard.ts']).join('\n'), /: guard.ts has no verify tier/);
});

test('covered decoys cannot disguise unsupported launcher modes or implicit tests', () => {
  for (const command of [
    `node --eval="import('./orphan.ts')" covered.ts`,
    'node scripts/extensionless covered.ts',
    'node --test --import ./covered.ts',
    'node --import ./covered.ts --test',
  ]) {
    const files = new Map([['package.json', pkg({ build: command })], ['covered.ts', '']]);
    assert.match(buildGuardFindings(files, ['covered.ts']).join('\n'), /incomplete.*launch/);
  }
});

test('unsupported shell structure cannot hide a second guard behind a covered first script', () => {
  for (const operator of ['|', '&', '\n']) {
    const files = new Map([
      ['package.json', pkg({ build: `node covered.ts ${operator} node orphan.ts` })],
      ['covered.ts', ''], ['orphan.ts', ''],
    ]);
    assert.match(buildGuardFindings(files, ['covered.ts']).join('\n'), /incomplete shell/);
  }
});
