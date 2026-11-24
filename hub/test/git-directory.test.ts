// T2: shared Git metadata parser against an in-memory filesystem; no native launches.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { projectGitDirectory } from '../src/git-maintenance.ts';
import { stageCase } from './stage-case-fixture.ts';
import { testSetupWaitMs } from './until.ts';

function fixture(t: TestContext, files: Record<string, string>, shortRead = 997, closeError?: Error, held = false) {
  const scope = stageCase(t);
  const entered = Promise.withResolvers<void>(), released = Promise.withResolvers<void>();
  scope.releaseOnClose(() => released.resolve());
  const reads: number[] = [], closed: string[] = [];
  let kept = 0;
  const missing = () => Object.assign(new Error('missing fixture metadata'), { code: 'ENOENT' });
  const content = (path: string) => { if (!(path in files)) throw missing(); return Buffer.from(files[path]!); };
  const open = async (path: string) => {
    const bytes = content(path);
    let confirmed = false;
    const close = async () => {
      if (confirmed) return;
      if (closeError) throw closeError;
      confirmed = true;
      closed.push(path);
    };
    scope.requireClose(close);
    return {
      async read(buffer: Buffer, offset: number, length: number, position: number) {
        if (held) { entered.resolve(); await released.promise; }
        reads.push(length);
        const bytesRead = bytes.copy(buffer, offset, position, position + Math.min(length, shortRead));
        kept += bytesRead;
        return { bytesRead, buffer };
      },
      close,
    };
  };
  const f = { scope, entered: entered.promise, reads, closed, kept: () => kept,
    repairClose: () => { closeError = undefined; } };
  return { ...f, run: (body: (value: typeof f) => Promise<void>) => scope.wait('whole metadata case', () => scope.run(async step => {
    await step(() => scope.wait('filesystem seam setup', async () => {
      scope.patch(fs, 'lstat', async () => ({ isDirectory: () => !('/fixture/.git' in files) }));
      scope.patch(fs, 'readFile', async (path: string) => content(path).toString('utf8'));
      scope.patch(fs, 'open', open);
      syncBuiltinESMExports();
    }, testSetupWaitMs()));
    await step(() => body(f));
  }), testSetupWaitMs()) };
}

for (const path of ['/fixture/.git/commondir', '/fixture/.git']) {
  test(`oversized Git metadata is refused before collecting the whole ${path.endsWith('commondir') ? 'commondir' : 'gitdir'} file`, async t => {
    return fixture(t, { [path]: 'x'.repeat(2_000_000) }).run(async f => {
      await assert.rejects(projectGitDirectory('/fixture'), {
        code: 'CLAND_GIT_METADATA_TOO_LARGE', path, limit: 65_536,
      });
      assert.deepEqual(f.closed, [path], 'opened metadata is closed before refusal reaches the caller');
      assert.ok(f.reads.length > 1, 'short reads are joined');
      assert.ok(f.reads.every(length => length <= 65_537));
      assert.equal(f.kept(), 65_537, 'only the bounded prefix and overflow byte were collected');
      assert.ok(f.reads.length < 100, 'refuses after the bounded prefix, without draining the whole file');
    });
  });
}

test('linked worktree metadata parses across short reads and preserves missing commondir fallback', async t => {
  const files = { '/fixture/.git': 'gitdir: private\n', '/fixture/private/commondir': '../common\n' };
  return fixture(t, files, 2).run(async f => {
    assert.equal(await projectGitDirectory('/fixture'), '/fixture/common');
    assert.deepEqual(f.closed, ['/fixture/.git', '/fixture/private/commondir']);
    delete (files as Partial<typeof files>)['/fixture/private/commondir'];
    assert.equal(await projectGitDirectory('/fixture'), '/fixture/private');
  });
});

test('Git metadata accepts the exact byte limit', async t => {
  return fixture(t, { '/fixture/.git/commondir': 'common' + ' '.repeat(65_530) }).run(async () => {
    assert.equal(await projectGitDirectory('/fixture'), '/fixture/.git/common');
  });
});

test('metadata refusal retains its structured cause when close also fails', async t => {
  const closeError = new Error('fixture close failure');
  return fixture(t, { '/fixture/.git/commondir': 'x'.repeat(65_537) }, 997, closeError).run(async f => {
    try {
      await assert.rejects(projectGitDirectory('/fixture'), {
        code: 'CLAND_GIT_METADATA_TOO_LARGE', closeError,
      });
    } finally { f.repairClose(); }
  });
});

test('cancelled held metadata work retains filesystem and native seams until rejected close is repaired', async t => {
  // The outer owner joins the control assertions too; the inner owner is the
  // cancellation subject and owns the guarded filesystem boundary.
  const control = stageCase(t, { native: true });
  return control.wait('whole cancellation control', () => control.run(async () => {
  const originalOpen = fs.open;
  const f = fixture(t, { '/fixture/.git/commondir': 'common' }, 997, new Error('fixture close failure'), true);
  const originalNative = f.scope.nativeBoundary();
  const work = f.run(async () => { await projectGitDirectory('/fixture'); });
  const failed = assert.rejects(work, /fixture close failure/);
  void failed.catch(() => {}); // Retained below, including the setup-failure path.
  try {
  await f.scope.wait('held read entered', () => f.entered, testSetupWaitMs());
  const fakeOpen = fs.open, guardedNative = f.scope.nativeBoundary();
  assert.notEqual(fakeOpen, originalOpen);
  assert.notEqual(guardedNative, originalNative);
    await assert.rejects(f.scope.restore(), /close unconfirmed/);
    await assert.rejects(f.scope.close(), /fixture close failure/);
    await failed;
    assert.deepEqual(f.closed, [], 'rejected close supplies no positive receipt');
    await assert.rejects(f.scope.restore(), /close unconfirmed/);
    assert.equal(fs.open, fakeOpen);
    assert.equal(f.scope.nativeBoundary(), guardedNative);
  } finally { f.repairClose(); await f.scope.close(); await failed; }
  assert.deepEqual(f.closed, ['/fixture/.git/commondir']);
  await f.scope.restore();
  assert.equal(fs.open, originalOpen);
  assert.equal(f.scope.nativeBoundary(), originalNative);
  }), testSetupWaitMs());
});
