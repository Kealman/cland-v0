// T2: publication and tracking-ref ordering against injected Git facts; no native processes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tempProject } from './harness.ts';
import { pushDev } from '../src/territory-push.ts';
import { territoryPath, type territoryGitAsync } from '../src/territory.ts';

const dev = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const resumed = <T>(work: () => T): T => work();

async function fixture(t: TestContext, outcome: 'accepted' | 'rejected' | 'reply-lost' | 'tracking-locked') {
  const root = await tempProject(t);
  const territory = territoryPath(root);
  await mkdir(territory, { recursive: true });
  const refs = new Map([[root, new Map([['refs/heads/dev', dev], ['refs/remotes/origin/dev', previous]])],
    [territory, new Map([['refs/heads/dev', previous]])]]);
  const run: typeof territoryGitAsync = async (cwd, args) => {
    switch (args[0]) {
      case 'config': assert.deepEqual(args, ['config', '--get', 'cland.managed']); return 'true';
      case 'symbolic-ref': return 'dev';
      case 'rev-parse': return refs.get(cwd)!.get(args.at(-1)!)!;
      case 'fetch': case 'merge-base': return '';
      case 'push':
        assert.equal(refs.get(root)!.get('refs/remotes/origin/dev'), previous, 'tracking ref must wait for publication');
        assert.deepEqual(args, ['push', territory, `${dev}:refs/heads/dev`]);
        if (outcome === 'rejected') throw new Error('push refused');
        refs.get(territory)!.set('refs/heads/dev', dev);
        if (outcome === 'reply-lost') throw new Error('reply lost');
        return '';
      case 'update-ref':
        assert.equal(refs.get(territory)!.get('refs/heads/dev'), dev, 'publication must already be confirmed');
        if (outcome === 'tracking-locked') throw new Error('ref locked');
        refs.get(cwd)!.set(args[1]!, args[2]!);
        return '';
      default: throw new Error(`unexpected Git operation: ${args}`);
    }
  };
  return { refs: refs.get(root)!, publish: () => pushDev(root, resumed, () => {}, run) };
}

test('push refreshes origin/dev only after successful or confirmed publication', async t => {
  for (const outcome of ['accepted', 'reply-lost'] as const) {
    const f = await fixture(t, outcome);
    assert.deepEqual(await f.publish(), { dev, previous });
    assert.equal(f.refs.get('refs/remotes/origin/dev'), dev);
    assert.equal(f.refs.get('refs/heads/dev'), dev);
  }
});

test('a rejected push leaves origin/dev unchanged', async t => {
  const f = await fixture(t, 'rejected');
  await assert.rejects(f.publish(), /push-git: push refused/);
  assert.equal(f.refs.get('refs/remotes/origin/dev'), previous);
});

test('a tracking-ref failure after publication reports a follow-up', async t => {
  const f = await fixture(t, 'tracking-locked');
  const result = await f.publish();
  assert.equal(result.dev, dev);
  assert.equal(result.followUp?.step, 'tracking-ref');
  assert.match(result.followUp!.error, /pushed; follow-up failed: origin\/dev:.*retry cland push/);
  assert.equal(f.refs.get('refs/remotes/origin/dev'), previous);
});
