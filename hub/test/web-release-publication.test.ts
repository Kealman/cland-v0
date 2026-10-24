// T3: native release refs and durable asset receipts; GitHub transport is fixture-owned.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildWebRelease, publishWebRelease, WEB_ARCHIVE, WEB_CHECKSUM, type AssetCommand } from '../src/release-web.ts';
import { releaseGit } from '../src/territory-release.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { preparedReleaseProject } from './prepared-project.ts';

const resumed = <T>(fn: () => T) => fn();

test('release pins checksummed Web assets before push and retries the same bytes after a lost upload reply', async t => {
  const { root, github } = await preparedReleaseProject(t, 'web-release-');
  const env = fixtureEnvironment(root, process.env);
  const git = (cwd: string, args: string[]) => territoryGitAsync(cwd, args, false, undefined, fixtureEnvironment(root, env));
  const config = join(root, '.cland/config.toml');
  await writeFile(config, (await readFile(config, 'utf8')).replace('web_bundle = false', 'web_bundle = true'));
  await git(root, ['add', '.']);
  await git(root, ['-c', 'gc.auto=0', 'commit', '-qm', 'Enable prebuilt Web']);
  const head = await git(root, ['rev-parse', 'dev']);
  let builds = 0, uploads = 0, authenticated = false;
  const boundary = { web: {
    check: async () => { if (!authenticated) throw new Error('fixture gh is not logged in'); },
    build: async (project: string, commit: string) => {
      builds++;
      assert.equal(commit, head);
      assert.equal(await git(github, ['rev-parse', 'main']), await git(root, ['rev-parse', 'main']), 'build precedes publication');
      const directory = join(project, '.cland/web-release');
      await mkdir(directory, { recursive: true });
      const archive = join(directory, 'cland-web.tar.gz');
      await writeFile(archive, 'fixture archive bytes');
      const sha256 = createHash('sha256').update('fixture archive bytes').digest('hex');
      await writeFile(`${archive}.sha256`, `${sha256}  cland-web.tar.gz\n`);
      return { directory, sha256, bytes: Buffer.byteLength('fixture archive bytes'), checksumBytes: 83 };
    },
    publish: async (_project: string, plan: { directory: string; sha256?: string }, version: string) => {
      uploads++;
      assert.equal(version, 'v0.2.0');
      assert.equal(await git(github, ['rev-parse', 'v0.2.0^{}']), head);
      assert.equal(await readFile(join(plan.directory, 'cland-web.tar.gz'), 'utf8'), 'fixture archive bytes');
      assert.match(await readFile(join(plan.directory, 'cland-web.tar.gz.sha256'), 'utf8'), new RegExp(`^${plan.sha256}  cland-web.tar.gz\\n$`));
      if (uploads === 1) throw new Error('fixture lost upload reply');
    },
  } };
  const release = (dry = false) => releaseGit(root, 'v0.2.0', dry, async () => null, resumed, () => {}, undefined, env, undefined, boundary);
  await assert.rejects(release(true), /gh is not logged in/);
  assert.equal(builds, 0);
  assert.equal(await git(github, ['tag', '--list']), '');
  authenticated = true;
  const preview = await release(true);
  assert.deepEqual(preview.webBundle, { status: 'planned', repo: github, archive: 'cland-web.tar.gz', checksum: 'cland-web.tar.gz.sha256', sha256: createHash('sha256').update('fixture archive bytes').digest('hex'), bytes: 21, checksumBytes: 83 });
  assert.equal(builds, 1);
  assert.equal(uploads, 0);
  const first = await release();
  assert.equal(first.followUp?.step, 'web-bundle');
  assert.equal(first.webBundle?.status, 'planned');
  assert.match(first.followUp!.error, /lost upload reply/);
  const receipt = JSON.parse(await readFile(join(root, '.cland/release.tmp'), 'utf8'));
  assert.equal(receipt.webBundle.sha256, createHash('sha256').update('fixture archive bytes').digest('hex'));
  await writeFile(config, '[release]\nweb_bundle = false\n');
  await git(root, ['add', '.']);
  await git(root, ['-c', 'gc.auto=0', 'commit', '-qm', 'Later dev']);
  const retry = await release();
  assert.equal(retry.followUp, undefined);
  assert.equal(retry.commit, head);
  assert.equal(retry.webBundle?.status, 'published');
  assert.equal(builds, 2);
  assert.equal(uploads, 2);
});

test('Web release assets contain the pinned build and a reusable checksum, with idempotent remote readback', async t => {
  const { root } = await preparedReleaseProject(t, 'web-release-bytes-');
  const bin = join(root, 'test-bin');
  await mkdir(bin);
  const npm = process.env.PATH!.split(':').map(path => join(path, 'npm')).find(path => existsSync(path))!;
  await writeFile(join(bin, 'npm'), '#!/bin/sh\nexec "$REAL_NPM" --offline --cache "$HOME/.npm" "$@"\n');
  await chmod(join(bin, 'npm'), 0o755);
  const env = fixtureEnvironment(root, process.env, { PATH: `${bin}:${process.env.PATH}`, REAL_NPM: npm });
  const git = (args: string[]) => territoryGitAsync(root, args, false, undefined, fixtureEnvironment(root, env));
  for (const path of ['hub/src', 'web/src', 'web/public', 'shared/wire']) await mkdir(join(root, path), { recursive: true });
  for (const path of ['web/src/fixture.ts', 'web/public/fixture.txt', 'shared/wire/fixture.ts']) await writeFile(join(root, path), 'fixture');
  await copyFile(new URL('../src/web-bundle.ts', import.meta.url), join(root, 'hub/src/web-bundle.ts'));
  for (const path of ['shared/protocol-frame.ts', 'web/package.json', 'web/index.html', 'web/tsconfig.json', 'web/vite.config.ts', 'web/build.ts', 'web/check-assets.ts']) await writeFile(join(root, path), '');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.2.0', type: 'module', scripts: { build: 'node build.mjs' } }));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ name: 'fixture', version: '0.2.0', lockfileVersion: 3, packages: { '': { name: 'fixture', version: '0.2.0' } } }));
  await writeFile(join(root, 'build.mjs'), `import { mkdir, writeFile } from 'node:fs/promises';
import { webSources } from './hub/src/web-bundle.ts';
await mkdir('web/dist', { recursive: true });
await writeFile('web/dist/index.html', 'pinned tagged Web');
await writeFile('web/dist/build-stamp.json', JSON.stringify({ version: 1, sources: (await webSources(process.cwd())).digest, builtAt: Date.now() }));
`);
  await git(['add', '.']);
  await git(['-c', 'gc.auto=0', 'commit', '-qm', 'Pinned build']);
  const head = await git(['rev-parse', 'HEAD']);
  await writeFile(join(root, 'build.mjs'), 'throw new Error("live checkout must not build");');
  const built = await buildWebRelease(root, head, fixtureEnvironment(root, env));
  const bytes = await readFile(join(built.directory, WEB_ARCHIVE));
  assert.equal(built.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(built.bytes, bytes.length);
  assert.equal(await readFile(join(built.directory, WEB_CHECKSUM), 'utf8'), `${built.sha256}  cland-web.tar.gz\n`);
  assert.ok(gunzipSync(bytes).includes(Buffer.from('pinned tagged Web')));
  assert.deepEqual(await buildWebRelease(root, head, fixtureEnvironment(root, env)), built, 'preview and actual release reuse exact bytes');
  const plan = { repo: 'fixture/cland', ...built };
  const remote = join(root, 'remote-assets');
  await mkdir(remote);
  let created = false, published = false, uploads = 0, lost = false;
  const names: string[] = [];
  const commands: string[][] = [];
  const run: AssetCommand = async (file, args) => {
    assert.equal(file, 'gh');
    commands.push(args);
    if (args[0] === 'api') return created ? 'v0.2.0\n' : '';
    if (args[1] === 'create') { created = true; return ''; }
    if (args[1] === 'view') return JSON.stringify({ assets: names.map(name => ({ name })), isDraft: !published });
    if (args[1] === 'edit') { published = true; return ''; }
    if (args[1] === 'upload') {
      const source = args[3]!;
      const name = basename(source);
      uploads++;
      names.push(name);
      await copyFile(source, join(remote, name));
      if (!lost) { lost = true; throw new Error('lost successful upload reply'); }
      return '';
    }
    if (args[1] === 'download') {
      await copyFile(join(remote, args[args.indexOf('--pattern') + 1]!), args[args.indexOf('--output') + 1]!);
      return '';
    }
    throw new Error('unexpected fixture command');
  };
  const publish = () => publishWebRelease(root, plan, 'v0.2.0', 'Approved notes', fixtureEnvironment(root, env), resumed, () => {}, run);
  await assert.rejects(publish(), /lost successful upload reply/);
  await publish();
  await publish();
  assert.equal(published, true);
  assert.equal(uploads, 2, 'retry reads both remote assets without duplicate uploads');
  assert.deepEqual(await readFile(join(remote, WEB_ARCHIVE)), bytes);
  assert.deepEqual(await readFile(join(remote, WEB_CHECKSUM)), await readFile(join(built.directory, WEB_CHECKSUM)));
  assert.ok(commands.some(args => args.includes('--verify-tag')));
  await writeFile(join(remote, WEB_ARCHIVE), 'conflicting remote asset');
  await assert.rejects(publish(), /differs from the approved bytes/);
  assert.equal(uploads, 2);
});
