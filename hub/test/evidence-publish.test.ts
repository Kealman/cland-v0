// T2: owned disposable filesystem evidence and a positively controlled native guard.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { publishEvidence, publishEvidenceTransport, publishSessionEvidence, scanEvidence, type EvidenceArgs, type SnapshotLifecycle } from '../src/evidence-publish.ts';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import type { FixtureStep } from '../../test-support/fixture-work.ts';
import { Report } from '../src/init/files.ts';
import { provisionSkills } from '../src/init/skills.ts';
import { HubRefusal } from '../../shared/socket-client.ts';
import { projectHub, inProcessSpoke } from './harness.ts';
import { sessionShell } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { drainFixtureCleanup } from './process-cleanup.ts';

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
  publish: (args: EvidenceArgs, create: (args: EvidenceArgs) => Promise<unknown>, scan?: typeof scanEvidence, options?: Partial<SnapshotLifecycle>, replayUnknown?: boolean) => Promise<unknown>;
}) => Promise<void>, control: {releaseOnClose?: () => void; onOwner?: (scope: ReturnType<typeof guardedLeaseCase>) => void} = {}) {
  const scope = guardedLeaseCase(t, control.releaseOnClose); // Release is enrolled before admission and acquisition.
  control.onOwner?.(scope);
  return scope.run(async step => {
    const root = await step(() => scope.wait('evidence fixture setup', async () => {
      const acquired = await mkdtemp(join(tmpdir(), 'evidence-case-'));
      scope.adoptRoot(acquired);
      scope.fixtures.after(() => rm(acquired, { recursive: true, force: true }));
      return acquired;
    }));
    await step(() => scope.wait('evidence case body', () => body({ root, step,
      publish: (args, create, scan = scanEvidence, options = {}, replayUnknown) => publishEvidence(args, create, scan, {
        createRoot: () => mkdtemp(join(root, 'snapshot-')),
        removeRoot: path => rm(path, { recursive: true, force: true }),
        onDisposition: () => {},
        ...options,
      }, replayUnknown),
    })));
  });
}

test('an older identical artifact cannot release a pending publication snapshot', t => {
  const receipt = Promise.withResolvers<unknown>();
  let cancellationReceipt: unknown;
  return evidenceCase(t, async ({root, step}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'clean'));
  const older = {id: 'A-old', title: 'Report', topic: 'test', kind: 'file', path};
  const current = {artifact: {...older, id: 'A-current'}, id: 'A-current', path};
  cancellationReceipt = current;
  const entered = Promise.withResolvers<void>();
  let first: Record<string, unknown> | undefined, creates = 0, removed = false;
  const work = publishEvidenceTransport({path, title: 'Report', kind: 'file', topic: 'test'}, async frame => {
    if (frame.type === 'artifact.list') return {artifacts: [older]};
    creates++;
    if (!first) { first = frame; throw new Error('lost current reply'); }
    assert.deepEqual(frame, first);
    entered.resolve();
    return receipt.promise;
  }, {
    createRoot: () => mkdtemp(join(root, 'snapshot-')),
    removeRoot: async root => { removed = true; await rm(root, {recursive: true, force: true}); },
    onDisposition: () => {},
  });
  try {
    const boundary = await step(() => Promise.race([entered.promise.then(() => 'replay entered'), work.then(() => 'completed too early')]));
    assert.equal(boundary, 'replay entered');
    assert.equal(removed, false);
    assert.equal(await step(() => readFile(String(first!.path), 'utf8')), 'clean');
    receipt.resolve(current);
    assert.deepEqual(await step(() => work), current);
    assert.equal(creates, 2);
    assert.equal(removed, true);
  } finally { receipt.resolve(current); await work.catch(() => {}); }
  }, {releaseOnClose: () => receipt.resolve(cancellationReceipt)});
});

test('cancelling evidence proof releases its held replay before joining and root removal', async t => {
  const receipt = Promise.withResolvers<unknown>(), entered = Promise.withResolvers<void>(), ownerReleased = Promise.withResolvers<void>();
  const current = {artifact: {id: 'A-current'}};
  let scope!: ReturnType<typeof guardedLeaseCase>;
  let rootPath = '', snapshot = '', released = false, proofComplete = false;
  const order: string[] = [];
  const running = evidenceCase(t, async ({root, step}) => {
    rootPath = root;
    const path = join(root, 'report.md');
    await step(() => writeFile(path, 'clean'));
    let creates = 0;
    const result = await step(() => publishEvidenceTransport({path, title: 'Report', kind: 'file', topic: 'test'}, async frame => {
      snapshot = String(frame.path);
      if (++creates === 1) throw new Error('lost reply');
      entered.resolve();
      return receipt.promise;
    }, {
      createRoot: () => mkdtemp(join(root, 'snapshot-')),
      removeRoot: async path => { order.push('snapshot cleanup'); await rm(path, {recursive: true, force: true}); },
      onDisposition: () => {},
    }));
    assert.deepEqual(result, current);
    assert.equal(creates, 2);
    await assert.rejects(access(snapshot), {code: 'ENOENT'});
    proofComplete = true;
    order.push('complete proof');
  }, {
    onOwner: owner => { scope = owner; },
    releaseOnClose: () => { released = true; order.push('release'); receipt.resolve(current); ownerReleased.resolve(); },
  });
  void running.catch(() => {});
  let closing: Promise<void> | undefined;
  try {
    await scope.wait('held replay admitted', () => Promise.race([entered.promise, running]));
    assert.equal(await readFile(snapshot, 'utf8'), 'clean');
    closing = drainFixtureCleanup(t);
    void closing.catch(() => {});
    await scope.wait('owner released held replay', () => ownerReleased.promise);
    assert.equal(released, true, 'owner releases the receipt before joining');
    await assert.rejects(running, /fixture work admission closed/);
    await closing;
    assert.equal(proofComplete, true);
    await assert.rejects(access(rootPath), {code: 'ENOENT'});
    assert.deepEqual(order, ['release', 'snapshot cleanup', 'complete proof']);
  } finally {
    receipt.resolve(current);
    ownerReleased.resolve();
    closing ??= drainFixtureCleanup(t);
    await running.catch(() => {});
    await closing;
  }
});

test('a lost publication reply returns the reconciled artifact without duplicating it', t => evidenceCase(t, async ({root, step, publish}) => {
  const path = join(root, 'report.md');
  await step(() => writeFile(path, 'clean'));
  const artifact = {artifact: {id: 'A-existing'}};
  let creates = 0;
  const result = await step(() => publish({path, title: 'Report', kind: 'file', topic: 'test'}, async args => {
    creates++;
    assert.ok(args.retryKey);
    if (creates === 1) throw new Error('lost reply');
    return artifact;
  }, undefined, undefined, true));
  assert.deepEqual(result, artifact);
  assert.equal(creates, 2);
}));

for (const mode of ['lost reply', 'lost request', 'late success', 'unknown retry', 'refused retry'] as const) {
  test(`evidence transport reconciles ${mode} with the retained bytes`, t => evidenceCase(t, async ({root, step}) => {
    const source = join(root, 'source');
    const committed = join(root, 'committed');
    const decoy = join(root, 'decoy');
    await step(async () => {
      for (const path of [source, committed, decoy]) {
        await mkdir(join(path, 'nested'), {recursive: true});
        await writeFile(join(path, 'report.md'), 'original');
        await writeFile(join(path, 'nested/fact.txt'), path === decoy ? 'other' : 'fact');
      }
    });
    const artifact = {id: 'A-existing', title: 'Report', topic: 'test', kind: 'file', path: committed, folder: true};
    let creates = 0, lookups = 0;
    const durableArtifacts = new Map<string, typeof artifact>();
    let first: Record<string, unknown> | undefined;
    const dispositions: unknown[] = [];
    const work = () => publishEvidenceTransport({path: source, title: 'Report', topic: 'test', kind: 'file'}, async frame => {
      if (frame.type === 'artifact.list') {
        lookups++;
        return {artifacts: [{...artifact, path: decoy}, ...(mode === 'lost reply' ? [artifact] : [])]};
      }
      creates++;
      assert.equal(frame.type, 'artifact.create');
      if (!first) {
        first = frame;
        if (mode === 'lost reply' || mode === 'late success') durableArtifacts.set(String(frame.retryKey), artifact);
        await writeFile(join(source, 'report.md'), 'changed after admission');
        throw new Error('private transport failure');
      }
      assert.deepEqual(frame, first);
      assert.equal(await readFile(join(String(frame.path), 'report.md'), 'utf8'), 'original');
      if (mode === 'unknown retry') throw new Error('private retry failure');
      if (mode === 'refused retry') throw new HubRefusal('retry forbidden', 'forbidden');
      if (!durableArtifacts.has(String(frame.retryKey))) durableArtifacts.set(String(frame.retryKey), artifact);
      return {artifact: durableArtifacts.get(String(frame.retryKey)), id: artifact.id, path: artifact.path};
    }, {
      createRoot: () => mkdtemp(join(root, 'snapshot-')),
      removeRoot: path => rm(path, {recursive: true, force: true}),
      onDisposition: receipt => { dispositions.push(receipt); },
    });
    if (mode === 'unknown retry' || mode === 'refused retry') {
      await step(() => assert.rejects(work(), {message: mode === 'refused retry'
        ? 'Evidence refused: hub refused (forbidden): retry forbidden'
        : 'Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying'}));
      assert.equal(await step(() => readFile(join(String(first!.path), 'report.md'), 'utf8')), 'original');
      assert.deepEqual(dispositions, [{state: 'retained', cleanup: 'not-needed'}]);
    } else {
      assert.deepEqual(await step(work), {artifact, id: artifact.id, path: artifact.path});
      assert.deepEqual(dispositions, [{state: 'removed', cleanup: 'complete'}]);
    }
    assert.equal(lookups, 0);
    assert.equal(creates, 2);
    assert.equal(durableArtifacts.size, mode === 'lost reply' || mode === 'lost request' || mode === 'late success' ? 1 : 0);
  }));
}

test('single-file reconciliation uses only its keyed receipt and definitive refusal stops before replay', t => evidenceCase(t, async ({root, step}) => {
  const path = join(root, 'report.md'), decoy = join(root, 'decoy.md');
  await step(async () => { await writeFile(path, 'clean'); await writeFile(decoy, 'other'); });
  const artifact = {id: 'A-file', path, title: 'Report', topic: 'test', kind: 'file'};
  const storage = {
    createRoot: () => mkdtemp(join(root, 'snapshot-')),
    removeRoot: (path: string) => rm(path, {recursive: true, force: true}),
    onDisposition: () => {},
  };
  const frames: string[] = [];
  assert.deepEqual(await step(() => publishEvidenceTransport({path, title: 'Report', kind: 'file', topic: 'test'}, async frame => {
    frames.push(frame.type);
    if (frames.length === 1) throw new Error('lost reply');
    assert.equal(frame.type, 'artifact.create');
    return {artifact, id: artifact.id, path: artifact.path};
  }, storage)), {artifact, id: artifact.id, path: artifact.path});
  assert.deepEqual(frames, ['artifact.create', 'artifact.create']);
  frames.length = 0;
  await step(() => assert.rejects(publishEvidenceTransport({path, title: 'Report', kind: 'file', topic: 'test'}, async frame => {
    frames.push(frame.type);
    throw new HubRefusal('not authorized', 'forbidden');
  }, storage), {message: 'Evidence refused: hub refused (forbidden): not authorized'}));
  assert.deepEqual(frames, ['artifact.create']);
}));

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
