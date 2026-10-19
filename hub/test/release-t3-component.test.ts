// T2: release CLI framing and hub evidence policy, with in-process publication facts and fake native probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, dispatcherUi, projectHub, tempProject } from './harness.ts';
import { recordReleaseCover } from './release-cover-fixture.ts';

// Native verification-tree production is covered in release.test.ts; no native Git runs here.
test('release dry-run and publication require green T3 at the pinned release tree', async t => {
  const root = await tempProject(t, 'release-t3-');
  const head = 'a'.repeat(40), tree = 'd'.repeat(40);
  let publications = 0;
  const hub = await projectHub(t, root, {}, { publishRelease: async (_root, version, dryRun, _title, resumed, authorize, _item, _env, requireT3) => {
    resumed(() => { authorize(); assert.ok(requireT3); requireT3(head, tree); });
    if (!dryRun) publications++;
    return { version: version!, commit: head, notes: '', refs: [`${head}:refs/heads/main`], dryRun };
  } });
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  const missing = await cland(root, 'release', 'v0.1.0', '--dry-run');
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /release-t3:.*no green T3.*needs cland verify all --occasion release/);
  assert.ok(missing.stderr.includes(head));
  assert.equal((await ui.request({ type: 'release', version: 'v0.1.0' })).ok, false);
  for (const overrides of [{ outcome: { code: 1, cause: 'failed' } }, { tree: 'f'.repeat(40) }, { reported: false },
    { occasion: 'batch' as const }, { selection: { mode: 'full' as const, tiers: ['T1' as const], files: [], reason: 'T1 only' } }]) {
    recordReleaseCover(root, head, tree, overrides);
    assert.equal((await ui.request({ type: 'release', version: 'v0.1.0', dryRun: true })).ok, false);
  }
  recordReleaseCover(root, 'b'.repeat(40), tree); // Equivalent build at another commit covers release.
  assert.equal((await cland(root, 'release', 'v0.1.0', '--dry-run')).code, 0);
  assert.equal(publications, 0, 'dry-run and refusals never publish');
});
