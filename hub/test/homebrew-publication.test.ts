// T3: native Git objects, remote leases and release receipt recovery; no daemon starts.
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { publishFormula, renderFormula } from '../src/homebrew.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { releaseGit } from '../src/territory-release.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tempProject } from './harness.ts';
import { preparedReleaseProject } from './prepared-project.ts';

const resumed = <T>(fn: () => T) => fn();
const authorize = () => {};

test('release preview, download failure and lost tap reply recover the pinned formula once', async t => {
  const { root, github } = await preparedReleaseProject(t, 'homebrew-release-');
  const tap = await tempProject(t, 'homebrew-tap-');
  const env = fixtureEnvironment(root, process.env);
  const git = (cwd: string, args: string[], marked = false, input?: string) => territoryGitAsync(cwd, args, marked, input, fixtureEnvironment(root, env));
  await git(tap, ['init', '--bare']);
  const config = join(root, '.cland/config.toml');
  await writeFile(config, (await readFile(config, 'utf8')).replace('tap = ""', 'tap = "Kealman/homebrew-tap"'));
  await mkdir(join(root, 'packaging/homebrew'), { recursive: true });
  await copyFile(new URL('../../packaging/homebrew/cland.rb.in', import.meta.url), join(root, 'packaging/homebrew/cland.rb.in'));
  await git(root, ['add', '.']);
  await git(root, ['-c', 'gc.auto=0', 'commit', '-qm', 'Prepare formula']);
  const head = await git(root, ['rev-parse', 'dev']);
  let downloads = 0, pushes = 0, failDownload = true, loseReply = true;
  const sha = 'c'.repeat(64);
  const run: typeof territoryGitAsync = (cwd, args, marked, input) => {
    if (args[0] === 'push') pushes++;
    return git(cwd, args.map(arg => arg === 'https://github.com/Kealman/homebrew-tap.git' ? tap : arg), marked, input);
  };
  const boundary = {
    sha256: async (url: string) => {
      downloads++;
      assert.equal(url, 'https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/v0.2.0');
      if (failDownload) throw new Error('fixture download unavailable');
      return sha;
    },
    publish: async (...args: Parameters<typeof publishFormula>) => {
      const commit = await publishFormula(args[0], args[1], args[2], args[3], args[4], args[5], run);
      if (loseReply) { loseReply = false; throw new Error('fixture lost successful tap reply'); }
      return commit;
    },
  };
  const release = (dry = false) => releaseGit(root, 'v0.2.0', dry, async () => null, resumed, authorize, undefined, env, undefined, boundary);
  const preview = await release(true);
  assert.deepEqual(preview.homebrew, { status: 'planned', tap: 'Kealman/homebrew-tap', branch: 'main', file: 'Formula/cland.rb', version: 'v0.2.0', url: 'https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/v0.2.0' });
  assert.equal(downloads, 0);
  assert.equal(pushes, 0);
  const first = await release();
  assert.equal(first.followUp?.step, 'homebrew');
  assert.match(first.followUp!.error, /fixture download unavailable/);
  assert.equal(await git(github, ['rev-parse', 'v0.2.0^{}']), head);
  failDownload = false;
  const lost = await release();
  assert.match(lost.followUp!.error, /fixture lost successful tap reply/);
  const receiptPath = join(root, '.cland/release.tmp');
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  assert.equal(receipt.homebrew.sha256, sha);
  const published = await git(tap, ['rev-parse', 'refs/heads/main']);
  // A retry must not read later dev configuration or republish the product tip.
  await writeFile(config, '[release.homebrew]\ntap = "Other/homebrew-tap"\n');
  await git(root, ['add', '.']);
  await git(root, ['-c', 'gc.auto=0', 'commit', '-qm', 'Later dev']);
  const retry = await release();
  assert.equal(retry.followUp, undefined);
  assert.equal(retry.commit, head);
  assert.equal(retry.homebrew?.status, 'published');
  assert.equal(retry.homebrew && 'sha256' in retry.homebrew ? retry.homebrew.sha256 : null, sha);
  assert.equal(downloads, 2, 'retry with a recorded digest does not download again');
  assert.equal(pushes, 1, 'remote file receipt recovers the lost push reply without another commit');
  assert.equal(await git(tap, ['rev-parse', 'refs/heads/main']), published);
  const formula = await git(tap, ['show', 'refs/heads/main:Formula/cland.rb']);
  assert.ok(formula.includes(`sha256 "${sha}"`));
  assert.ok(formula.includes('version "0.2.0"'));
});

test('formula publication preserves tap files and refuses a concurrent branch change', async t => {
  const root = await tempProject(t, 'homebrew-object-');
  const tap = await tempProject(t, 'homebrew-remote-');
  const env = fixtureEnvironment(root, process.env);
  const git = (cwd: string, args: string[], marked = false, input?: string) => territoryGitAsync(cwd, args, marked, input, fixtureEnvironment(root, env));
  await git(root, ['init']);
  await git(tap, ['init', '--bare']);
  const plan = { tap: 'Kealman/homebrew-tap', branch: 'main' as const, file: 'Formula/cland.rb' as const, version: 'v0.2.0', url: 'https://example.test/v0.2.0.tar.gz', sha256: 'b'.repeat(64) };
  const template = await readFile(new URL('../../packaging/homebrew/cland.rb.in', import.meta.url), 'utf8');
  const formula = renderFormula(template, { ...plan, sha256: plan.sha256 });
  let race = false;
  const run: typeof territoryGitAsync = async (cwd, args, marked, input) => {
    if (race && args[0] === 'push') {
      const changed = await git(tap, ['commit-tree', 'refs/heads/main^{tree}', '-p', 'refs/heads/main'], false, 'concurrent tap change\n');
      await git(tap, ['update-ref', 'refs/heads/main', changed]);
    }
    return git(cwd, args.map(arg => arg === 'https://github.com/Kealman/homebrew-tap.git' ? tap : arg), marked, input);
  };
  await publishFormula(root, plan, formula, resumed, authorize, env, run);
  const blob = await git(tap, ['hash-object', '-w', '--stdin'], false, 'keep me\n');
  const entries = await git(tap, ['ls-tree', 'main']);
  const tree = await git(tap, ['mktree'], false, `${entries}\n100644 blob ${blob}\tREADME.md\n`);
  const unrelated = await git(tap, ['commit-tree', tree, '-p', 'main'], false, 'Add tap README\n');
  await git(tap, ['update-ref', 'refs/heads/main', unrelated]);
  const updated = formula.replace('version "0.2.0"', 'version "0.2.1"');
  await publishFormula(root, { ...plan, version: 'v0.2.1' }, updated, resumed, authorize, env, run);
  assert.equal(await git(tap, ['show', 'main:README.md']), 'keep me');
  race = true;
  await assert.rejects(publishFormula(root, { ...plan, version: 'v0.2.2' }, formula, resumed, authorize, env, run), /stale info|rejected/);
  assert.equal(await git(tap, ['show', 'main:Formula/cland.rb']), updated.trim());
});
