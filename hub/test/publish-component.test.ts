// T2: publication planning, path policy and receipts use an injected in-memory Git adapter; no native processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publishReceiptPath } from '../src/territory-publish.ts';
import { publishFixture, tips } from './publish-fixture.ts';

test('allow-list refusal names the path and keeps the whole publication unchanged', async t => {
  const f = await publishFixture(t);
  f.changed.set(tips.first, ['site/index.html', 'code.ts']);
  await assert.rejects(f.publish(), /publish-path:.*code\.ts/);
  assert.equal(f.pushes(), 0);
  assert.equal(f.rootRefs.get('refs/heads/dev'), tips.private);
  assert.equal(f.githubRefs.get('refs/heads/main'), tips.base);
  await assert.rejects(readFile(publishReceiptPath(f.root)), { code: 'ENOENT' });
});

test('dry run computes public and dev tips without publishing refs or leaving a receipt', async t => {
  const f = await publishFixture(t);
  const preview = await f.publish(true);
  assert.deepEqual(preview.commits.map(commit => commit.commit), [tips.first, tips.source]);
  assert.deepEqual(preview.paths, ['site/index.html', 'site/style.css']);
  assert.equal(preview.main, tips.public);
  assert.equal(preview.site, tips.public);
  assert.equal(preview.dev, tips.dev);
  assert.equal(f.pushes(), 0);
  assert.equal(f.rootRefs.get('refs/heads/dev'), tips.private);
  assert.equal(f.territoryRefs.get('refs/heads/dev'), tips.private);
  await assert.rejects(readFile(publishReceiptPath(f.root)), { code: 'ENOENT' });
});

test('a rejected publication receipt revalidates a tightened allow-list before retry can push', async t => {
  const f = await publishFixture(t);
  f.faults.rejectPush = true;
  await assert.rejects(f.publish(), /publish-git:/);
  const original = await readFile(publishReceiptPath(f.root), 'utf8');
  f.faults.rejectPush = false;
  await assert.rejects(f.publish(false, ['README.md']), /publish-path:.*site\/index\.html/);
  assert.equal(f.pushes(), 1, 'only the original rejected push was attempted');
  assert.equal(f.githubRefs.get('refs/heads/main'), tips.base);
  assert.equal(f.rootRefs.get('refs/heads/dev'), tips.private);
  assert.equal(await readFile(publishReceiptPath(f.root), 'utf8'), original);
});

test('an already-published receipt finishes local recovery after policy tightening without another push', async t => {
  const f = await publishFixture(t);
  f.faults.localRefs = true;
  const original = await f.publish();
  assert.equal(original.followUp?.step, 'sync');
  assert.equal(f.githubRefs.get('refs/heads/main'), tips.public);
  f.faults.localRefs = false;
  const recovered = await f.publish(false, ['README.md']);
  assert.equal(recovered.followUp, undefined);
  assert.equal(recovered.main, original.main);
  assert.equal(recovered.dev, original.dev);
  assert.equal(f.rootRefs.get('refs/heads/dev'), tips.dev);
  assert.equal(f.territoryRefs.get('refs/heads/dev'), tips.dev);
  assert.equal(f.pushes(), 1);
});

test('receipt recovery rejects a different item and keeps the original publication identity', async t => {
  const f = await publishFixture(t);
  f.faults.rejectPush = true;
  await assert.rejects(f.publish(), /publish-git:/);
  const receipt = await readFile(publishReceiptPath(f.root), 'utf8');
  await assert.rejects(f.publish(false, ['site/**'], 'T-2'), /publish-changed:.*same branch, source and item/);
  assert.equal(await readFile(publishReceiptPath(f.root), 'utf8'), receipt);
  assert.equal(f.pushes(), 1);
});

test('a lost accepted push reply recovers the pinned tips without repeating publication', async t => {
  const f = await publishFixture(t);
  f.faults.loseReply = true;
  await assert.rejects(f.publish(), /publish-git:.*reply was lost/);
  assert.equal(f.githubRefs.get('refs/heads/main'), tips.public);
  const recovered = await f.publish();
  assert.equal(recovered.followUp, undefined);
  assert.equal(recovered.dev, tips.dev);
  assert.equal(f.pushes(), 1);
});

test('every dev merge publication prepares names its item so the landing is attributable', async t => {
  const f = await publishFixture(t);
  await f.publish();
  assert.deepEqual(f.mergeMessages.map(message => message.split('\n').includes('Item: T-1')), [true, true],
    'both publication merges carry the item trailer a landing receipt points at');
});
