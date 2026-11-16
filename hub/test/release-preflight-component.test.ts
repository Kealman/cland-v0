// T2: hub-machine release inspection with fake executable lookup and commands; no child processes or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRelease } from '../src/release-preflight-native.ts';
import { GITIGNORE } from '../src/project.ts';
import { dispatcherUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { sessionClandWithEnv } from './session-credential-fixture.ts';
import { value } from './validation-support.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('release preflight uses hub PATH absolute tools and pinned dev bytes without a write command', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, { PATH: '/hub/tools' });
  const result = await inspectRelease(root, 'v0.4.1', env, () => {}, {
    lookup: async (tool, candidate, cwd) => { assert.equal(candidate, env); assert.equal(cwd, root); return `/hub/tools/${tool}`; },
    run: async (file, args, cwd, candidate) => {
      assert.equal(cwd, root); assert.equal(candidate, env);
      if (file === '/hub/tools/gh') { assert.deepEqual(args, ['auth', 'status', '--active', '--hostname', 'github.com']); return ''; }
      assert.equal(file, '/hub/tools/git');
      if (args[0] === 'rev-parse') return 'pinned-head';
      if (args[0] === 'status') return '';
      if (args[0] === 'ls-tree') { assert.equal(args[2], 'pinned-head'); return args.at(-1)!; }
      assert.equal(args[0], 'show');
      assert.ok(args[1]!.startsWith('pinned-head:'));
      return args[1]!.endsWith('.gitignore') ? GITIGNORE : '{"version":"0.4.1","packages":{"":{"version":"0.4.1"}}}';
    },
  });
  assert.ok(result.checks.every(check => check.status === 'ok'), JSON.stringify(result));
});

test('authenticated Coordinator CLI can preflight without covers while Implementer CLI is refused', async t => {
  const root = await tempProject(t);
  // No executable exists on the hub PATH; no native command or authentication request can run.
  const hub = await projectHub(t, root, { PATH: '/nonexistent-preflight-tools' });
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  const item = (await value<{ item: { id: string } }>(ui, { type: 'task.create', kind: 'release', title: 'Next release', version: '0.4.1' })).item.id;
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer']] as const) {
    const sessionId = `preflight-${name}`;
    const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name, role, sessionId });
    t.after(() => spoke.close());
    const result = await sessionClandWithEnv(root, { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: sessionId }, 'release', '--item', item, '--preflight', '--json');
    if (role === 'coordinator') {
      assert.equal(result.code, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.preflight, true); assert.equal(report.version, 'v0.4.1');
      assert.equal(report.checks.find((check: { name: string }) => check.name === 'tool:gh').status, 'refused');
    } else { assert.notEqual(result.code, 0); assert.match(result.stderr, /forbidden.*release/); }
  }
});

test('release preflight detects managed ignore byte differences that startup rewrites', async t => {
  const root = await tempProject(t);
  for (const bytes of [GITIGNORE, GITIGNORE.trimEnd(), `${GITIGNORE} `, '# project ignore\n']) {
    const result = await inspectRelease(root, 'v0.4.1', fixtureEnvironment(root, {}), () => {}, {
      lookup: async tool => `/hub/tools/${tool}`,
      run: async (_file, args) => {
        if (args[0] === 'rev-parse') return 'head';
        if (args[0] === 'ls-tree') return args.at(-1)!;
        if (args[0] === 'show') return args[1]!.endsWith('.gitignore') ? bytes : '{"version":"0.4.1"}';
        return '';
      },
    });
    assert.equal(result.checks.find(check => check.name === 'managed-header')?.status, bytes === GITIGNORE || bytes.startsWith('# project') ? 'ok' : 'refused', JSON.stringify(bytes));
  }
});
