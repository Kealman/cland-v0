// T2: owned disposable filesystem evidence and a positively controlled native guard.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { publishEvidence, publishSessionEvidence, scanEvidence, type EvidenceArgs, type SnapshotLifecycle } from '../src/evidence-publish.ts';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import { Report } from '../src/init/files.ts';
import { provisionSkills } from '../src/init/skills.ts';
import { HubRefusal } from '../../shared/socket-client.ts';
import { projectHub, inProcessSpoke } from './harness.ts';
import { sessionShell } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('an implementer publishes a scanned Markdown dot-file from its worktree', t => evidenceCase(t, async ({root, step}) => {
  const hub = await step(() => projectHub(t, root));
  try {
    const coord = await step(() => inProcessSpoke(t, {discover: true, cwd: root, name: 'coord', role: 'coordinator'}));
    const worktree = join(root, 'worktree');
    await step(() => mkdir(worktree));
    const impl = await step(() => inProcessSpoke(t, {discover: true, cwd: worktree, name: 'impl-1758', role: 'implementer'}));
    try {
      const made = await step(() => coord.call<{topic: {id: string}}>('topic.create', {title: 'Evidence reproduction'}));
      const topic = made.topic.id;
      await step(() => coord.call('send', {topic, to: ['impl-1758'], text: 'Publish evidence here'}));
      await step(() => impl.waitForEvent(e => e.params.content === 'Publish evidence here'));
      await step(() => writeFile(join(worktree, '.evidence-T-1758.md'), '# Clean reproduction'));
      const env = fixtureEnvironment(root, process.env, sessionShell(root, {CLAND_SESSION_NAME: 'impl-1758', CLAND_ROLE: 'implementer'}));
      const result = await step(() => publishSessionEvidence({path: './.evidence-T-1758.md', kind: 'file', title: 'Reproduction', topic}, {env, cwd: worktree})) as {artifact: {path: string; creatorRole: string}};
      assert.equal(result.artifact.creatorRole, 'implementer');
      assert.equal(await step(() => readFile(result.artifact.path, 'utf8')), '# Clean reproduction');
      await step(() => assert.rejects(publishSessionEvidence({path: './.evidence-T-1758.md', kind: 'file', title: '', topic}, {env, cwd: worktree}), {
        message: 'Evidence refused: hub refused (artifact-title): an artifact needs a title',
        snapshot: {state: 'removed', cleanup: 'complete'},
      }));
    } finally { await step(() => impl.close()); await step(() => coord.close()); }
  } finally { await step(() => hub.stop()); }
}));

test('evidence publication reports a definitive hub refusal and removes its snapshot', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'clean'));
  let snapshot = '';
  await step(() => assert.rejects(publish({path, title: 'Report', kind: 'file', topic: 'test'}, async args => {
    snapshot = args.path;
    throw new HubRefusal('a folder needs a Markdown entry or an explicit entry file', 'artifact-source');
  }), error => {
    assert.equal((error as Error).message, 'Evidence refused: hub refused (artifact-source): a folder needs a Markdown entry or an explicit entry file');
    assert.deepEqual((error as {snapshot?: unknown}).snapshot, {state: 'removed', cleanup: 'complete'});
    return true;
  }));
  await step(() => assert.rejects(access(snapshot), {code: 'ENOENT'}));
}));

test('evidence publication preserves a legacy hub refusal through cleanup failure', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'clean'));
  let snapshot = '';
  await step(() => assert.rejects(publish({path, title: 'Report', kind: 'file', topic: 'test'}, async args => {
    snapshot = args.path;
    throw new HubRefusal('publication not permitted'); // Previous wire shape without code.
  }, undefined, {removeRoot: async () => { throw new Error('private cleanup error'); }}), error => {
    assert.equal((error as Error).message, 'Evidence refused: hub refused (unknown): publication not permitted');
    assert.deepEqual((error as {snapshot?: unknown}).snapshot, {state: 'retained', cleanup: 'failed'});
    return true;
  }));
  assert.equal(await step(() => readFile(snapshot, 'utf8')), 'clean');
}));

function evidenceCase(t: TestContext, body: (fixture: {
  root: string; step: FixtureStep;
  publish: (args: EvidenceArgs, create: (args: EvidenceArgs) => Promise<unknown>, scan?: typeof scanEvidence, options?: Partial<SnapshotLifecycle>) => Promise<unknown>;
}) => Promise<void>) {
  const scope = guardedLeaseCase(t); // Owner precedes guard installation and filesystem acquisition.
  return scope.run(async step => {
    const root = await step(() => scope.wait('evidence fixture setup', async () => {
      const acquired = await mkdtemp(join(tmpdir(), 'evidence-case-'));
      scope.adoptRoot(acquired);
      scope.fixtures.after(() => rm(acquired, { recursive: true, force: true }));
      return acquired;
    }));
    await step(() => scope.wait('evidence case body', () => body({ root, step,
      publish: (args, create, scan = scanEvidence, options = {}) => publishEvidence(args, create, scan, {
        createRoot: () => mkdtemp(join(root, 'snapshot-')),
        removeRoot: path => rm(path, { recursive: true, force: true }),
        onDisposition: () => {},
        ...options,
      }),
    })));
  });
}

test('evidence publication copies every nested file only after scanning', t => evidenceCase(t, async ({root, step, publish}) => {
  const source = join(root, 'evidence');
  await step(() => mkdir(join(source, 'nested'), { recursive: true }));
  await step(() => writeFile(join(source, 'report.md'), 'clean report'));
  await step(() => writeFile(join(source, 'nested', 'capture.bin'), new Uint8Array([0, 1, 2])));
  const result = await step(() => publish({ path: source, title: 'Evidence', kind: 'file', topic: 'test' }, async args => {
    assert.equal(await readFile(join(args.path, 'report.md'), 'utf8'), 'clean report');
    assert.deepEqual(await readFile(join(args.path, 'nested', 'capture.bin')), Buffer.from([0, 1, 2]));
    assert.notEqual(args.path, source);
    return { id: 'fake-artifact' };
  }));
  assert.deepEqual(result, { id: 'fake-artifact' });
}));

for (const mode of ['nonzero', 'missing exit', 'missing control', 'wrong path', 'throw'] as const) {
  test(`evidence publication refuses ${mode} scan receipts`, t => evidenceCase(t, async ({root, step, publish}) => {
    const path = join(root, 'report.md');
    await step(() => writeFile(path, 'clean'));
    let published = false;
    await step(() => assert.rejects(publish({ path, title: 'Report', kind: 'file', topic: 'test' }, async () => { published = true; }, async target => {
      if (mode === 'throw') throw new Error('private scanner detail');
      return { path: mode === 'wrong path' ? 'other' : target, exitCode: mode === 'nonzero' ? 1 : mode === 'missing exit' ? null : 0,
        controlMatched: mode !== 'missing control', matches: [] };
    }), /Evidence refused:/));
    assert.equal(published, false);
  }));
}

test('evidence publication refuses both scanners and cross-line matches without values', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  const fake = 'synthetic'.repeat(5);
  for (const value of [`${['Bear', 'er'].join('')} ${fake}`, `/home/${fake}`, `Authorization:\n${['Bear', 'er'].join('')}\nx`]) {
    await step(() => writeFile(path, `report\n${value}`));
    let published = false;
    await step(() => assert.rejects(publish({ path, title: 'Report', kind: 'file', topic: 'test' }, async () => { published = true; }), error => {
      assert.match((error as Error).message, /report.md:\d+:1/);
      assert.equal((error as Error).message.includes(fake), false);
      assert.equal((error as Error).message.includes(value), false);
      return true;
    }));
    assert.equal(published, false);
  }
}));

test('evidence scan refuses an unplanted control', t => evidenceCase(t, async ({step}) => {
  const result = await step(() => scanEvidence('snapshot', new Map([['report', Buffer.from('clean')]]), ''));
  assert.equal(result.controlMatched, false);
}));

test('evidence publication scans a single file and keeps the snapshot after source changes', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'original'));
  let published = false;
  await step(() => publish({ path, title: 'Report', kind: 'file', topic: 'test' }, async args => {
    assert.equal(await readFile(args.path, 'utf8'), 'original');
    published = true;
  }, async (target, files, control) => {
    assert.match(control, /^Bearer /);
    await writeFile(path, 'changed after snapshot');
    return scanEvidence(target, files, control);
  }));
  assert.equal(published, true);
}));

test('evidence publication keeps diagnostics private when a publisher throws', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'clean'));
  let retained = '';
  await step(() => assert.rejects(publish({ path, title: 'Report', kind: 'file', topic: 'test' }, async args => {
    retained = args.path;
    throw new Error('Evidence refused: private publisher detail');
  }), { message: 'Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying' }));
  assert.equal(await step(() => readFile(retained, 'utf8')), 'clean');
  // Fake transport is settled; the joined case owner may now remove this root.
  await step(() => rm(dirname(dirname(retained)), { recursive: true, force: true }));
}));

test('implement and QA guidance point to the shared publication helper', t => evidenceCase(t, async ({step}) => {
  for (const path of ['.agents/skills/implement/SKILL.md', '.agents/skills/qa/SKILL.md', '.agents/skills/qa/BRIEF.md']) {
    const text = await step(() => readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
    assert.match(text, /EVIDENCE\.md/);
    assert.match(text, /publishSessionEvidence/);
  }
}));

test('evidence publication sanitizes private root setup failure', t => evidenceCase(t, async ({root, step, publish}) => {
  let published = false;
  await step(() => assert.rejects(publish({ path: join(root, 'unused'), title: 'Report', kind: 'file', topic: 'test' }, async () => { published = true; },
    undefined, { createRoot: async () => { throw new Error('private setup diagnostic'); } }), error => {
      assert.equal((error as Error).message, 'Evidence refused: snapshot or scan failed; private diagnostic withheld');
      assert.deepEqual((error as { snapshot?: unknown }).snapshot, { state: 'not-created', cleanup: 'not-needed' });
      return true;
    }));
  assert.equal(published, false);
}));

for (const selected of ['artifact', 'scan refusal'] as const) {
  test(`evidence cleanup failure preserves selected ${selected}`, t => evidenceCase(t, async ({root, step, publish}) => {
    const path = join(root, 'report.md');
    await step(() => writeFile(path, selected === 'artifact' ? 'clean' : `/home/${'synthetic'.repeat(5)}`));
    const dispositions: unknown[] = [];
    let retained = '', calls = 0;
    const work = () => publish({ path, title: 'Report', kind: 'file', topic: 'test' }, async () => { calls++; return { id: 'committed-artifact' }; }, undefined, {
      removeRoot: async path => { retained = path; throw new Error('private removal diagnostic'); },
      onDisposition: receipt => { dispositions.push(receipt); },
    });
    if (selected === 'artifact') assert.deepEqual(await step(work), { id: 'committed-artifact' });
    else await step(() => assert.rejects(work(), error => {
      assert.match((error as Error).message, /report.md:\d+:1/);
      assert.equal((error as Error).message.includes('private removal'), false);
      assert.deepEqual((error as {snapshot?: unknown}).snapshot, { state: 'retained', cleanup: 'failed' });
      return true;
    }));
    assert.equal(calls, selected === 'artifact' ? 1 : 0);
    assert.deepEqual(dispositions, [{ state: 'retained', cleanup: 'failed' }]);
    await step(() => access(retained)); // Positive retained-root receipt after the real cleanup seam failed.
    await step(() => rm(retained, { recursive: true, force: true }));
  }));
}

test('evidence publication refuses an unsafe empty descendant beside a clean file', t => evidenceCase(t, async ({root, step, publish}) => {
  const source = join(root, 'evidence');
  await step(() => mkdir(join(source, `token=${'synthetic'.repeat(5)}`), { recursive: true }));
  await step(() => writeFile(join(source, 'report.md'), 'clean'));
  let published = false;
  await step(() => assert.rejects(publish({path: source, title: 'Report', kind: 'file', topic: 'test'}, async () => {published = true;}), /Evidence refused:/));
  assert.equal(published, false);
}));

test('evidence cleanup reports observed absence after an ancillary removal error', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'clean'));
  const dispositions: unknown[] = [];
  const result = await step(() => publish({path, title: 'Report', kind: 'file', topic: 'test'}, async () => ({id: 'committed-artifact'}), undefined, {
    removeRoot: async path => { await rm(path, {recursive: true, force: true}); throw new Error('private late cleanup failure'); },
    onDisposition: receipt => { dispositions.push(receipt); },
  }));
  assert.deepEqual(result, {id: 'committed-artifact'});
  assert.deepEqual(dispositions, [{state: 'removed', cleanup: 'failed'}]);
}));

test('provisioned QA kit resolves its guide and installed helper outside the host project', t => evidenceCase(t, async ({root, step}) => {
  const project = join(root, 'project'), bin = join(root, 'bin');
  await step(async () => { await mkdir(project); await mkdir(bin); provisionSkills(new Report(project), project); });
  for (const file of ['implement/SKILL.md', 'qa/SKILL.md', 'qa/BRIEF.md']) {
    let path = join(project, '.agents', 'skills', file);
    if (file === 'qa/BRIEF.md') {
      const destination = join(project, 'qa/briefs/T-example.md');
      await step(async () => { await mkdir(dirname(destination), {recursive: true}); await copyFile(path, destination); });
      path = destination; // The documented filled-brief consumer, after an ordinary copy.
    }
    const text = await step(() => readFile(path, 'utf8'));
    const link = /\[[^\]]+\]\(([^)]*EVIDENCE\.md)\)/.exec(text)?.[1];
    assert.ok(link, 'copied skill has a local guide link');
    await step(() => access(join(dirname(path), link)));
  }
  const installedEntry = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  await step(() => symlink(installedEntry, join(bin, 'cland')));
  const locator = await step(() => import(pathToFileURL(join(project, '.agents/skills/qa/publish-evidence.ts')).href)) as typeof import('../../.agents/skills/qa/publish-evidence.ts');
  const publisher = await step(() => locator.loadEvidencePublisher(bin));
  assert.equal(publisher.publishEvidence, publishEvidence);
  assert.equal(typeof publisher.publishSessionEvidence, 'function');
  const policy = await step(() => import(pathToFileURL(join(project, '.agents/skills/qa/qa-demo-policy.ts')).href)) as typeof import('../../.agents/skills/qa/qa-demo-policy.ts');
  const control = ['/', 'home', '/', `fixture-${Math.random().toString(36).slice(2)}`].join('');
  assert.throws(() => policy.assertPublishable(control), { message: 'secret scan refused publication' });
  assert.doesNotThrow(() => policy.assertPublishable('Capture complete: 2 facts'));
}));

test('QA locator resolves a Homebrew wrapper through its adjacent libexec package', t => evidenceCase(t, async ({root, step}) => {
  const prefix = join(root, 'cellar/cland/version'), bin = join(root, 'bin');
  const wrapper = join(prefix, 'bin/cland'), module = join(prefix, 'libexec/hub/src/evidence-publish.ts');
  await step(async () => {
    await mkdir(dirname(wrapper), {recursive: true}); await mkdir(dirname(module), {recursive: true}); await mkdir(bin);
    await writeFile(wrapper, '#!/bin/sh\n# inert write_env_script fixture; never executed\n');
    await symlink(wrapper, join(bin, 'cland'));
    await symlink(fileURLToPath(new URL('../src/evidence-publish.ts', import.meta.url)), module);
  });
  const locator = await step(() => import('../../.agents/skills/qa/publish-evidence.ts'));
  const publisher = await step(() => locator.loadEvidencePublisher(bin));
  assert.equal(publisher.publishEvidence, publishEvidence);
  assert.equal(typeof publisher.publishSessionEvidence, 'function');
}));
