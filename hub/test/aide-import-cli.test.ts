// T2: CLI remote selection and the UI/shell boundary against an in-process hub; real publication lives in push.test.ts.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FakeClock } from './fake-clock.ts';
import { inProcessSpoke, projectHub, tempProject } from './harness.ts';

async function fakeGithub(root: string) {
  const fixture = join(root, 'github.json');
  await writeFile(fixture, JSON.stringify({
    'repos/acme/widgets/issues?state=open&per_page=100': [],
    'repos/other/project/issues?state=open&per_page=100': [],
  }));
  return {
    PATH: `${fileURLToPath(new URL('./fixtures/fake-gh', import.meta.url))}:${process.env.PATH ?? ''}`,
    FAKE_GH_FIXTURE: fixture,
  };
}

test('import selects the first GitHub remote or explains how to select a repository', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git', 'objects'), { recursive: true });
  await mkdir(join(root, '.git', 'refs'));
  await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/dev\n');
  const env = await fakeGithub(root);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  for (const entry of [
    { github: 'https://github.com/acme/widgets.git', origin: 'https://github.com/other/project.git', repo: 'acme/widgets' },
    { github: '/local/territory.git', origin: 'ssh://git@github.com/other/project.git', repo: 'other/project' },
    { github: '/local/territory.git', origin: '/local/other.git', repo: null },
  ]) {
    await writeFile(join(root, '.git', 'config'), ['[core]\nrepositoryformatversion = 0\nbare = false',
      ...(['github', 'origin'] as const).map(remote => `[remote "${remote}"]\nurl = ${entry[remote]}`),
    ].join('\n'));
    const { code, stdout, stderr } = await clandWithEnv(root, env, 'task', 'import-github', '--json');
    assert.equal(code, entry.repo ? 0 : 1, stderr);
    if (entry.repo) assert.equal(JSON.parse(stdout).repo, entry.repo);
    else assert.match(stderr, /github.*origin.*pass --repo owner\/name/);
  }
});

test('an Aide cannot push through a UI frame even with a shell identity', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const aide = await inProcessSpoke(t, { cwd: root, discover: true, name: 'aide-1', role: 'aide', sessionId: 'aide-id' });
  await aide.waitForPresence(['aide-1']);
  const ui = await connectUi(t, discovery);
  const result = await ui.request({ type: 'push', as: { name: 'aide-1', sessionId: 'aide-id', shell: true } });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /own shell/);
});
