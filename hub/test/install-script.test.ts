// T3: runs the POSIX installer and its native npm/build commands in a sealed scratch prefix.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertTestAdmission } from '../../test-support/admission.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, ownProcess } from './process-cleanup.ts';

async function run(t: test.TestContext, file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number }) {
  let stop: () => Promise<void>;
  let expired = false;
  let fail: (error: unknown) => void;
  const complete = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    fail = reject;
    const child = spawn(file, args, {
      cwd: options.cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: fixtureEnvironment(options.cwd, options.env, {
        REAL_NODE: options.env.REAL_NODE, REAL_NPM: options.env.REAL_NPM,
        FAKE_NODE_VERSION: options.env.FAKE_NODE_VERSION, FAKE_TAG_REFS: options.env.FAKE_TAG_REFS,
        FAKE_RELEASE_MAP: options.env.FAKE_RELEASE_MAP, FAKE_PUBLISH_INTERRUPT: options.env.FAKE_PUBLISH_INTERRUPT,
        FAKE_RESTORE_FAIL: options.env.FAKE_RESTORE_FAIL,
        CLAND_RELEASE_URL: options.env.CLAND_RELEASE_URL,
      }),
    });
    let stdout = '', stderr = '';
    let failure: Error | undefined;
    const append = (stream: 'stdout' | 'stderr', chunk: string) => {
      if (failure) return;
      if (stream === 'stdout') stdout += chunk; else stderr += chunk;
      if (stdout.length + stderr.length > 1024 * 1024) {
        failure = new Error('native command output exceeded 1 MiB');
        void stop().catch(reject);
      }
    };
    child.stdout.setEncoding('utf8').on('data', chunk => append('stdout', chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => append('stderr', chunk));
    child.once('error', error => { failure = error; });
    child.once('close', code => {
      if (failure || code !== 0 || expired) reject(Object.assign(failure ?? new Error(expired ? 'native command deadline exceeded' : 'Command failed'), { stdout, stderr }));
      else resolve({ stdout, stderr });
    });
    const owned = ownProcess(t, child.pid);
    let stopping: Promise<void> | undefined;
    stop = () => stopping ??= owned();
  });
  // lint-allow-wall-clock: native command watchdog kills the owned group before any fixture removal.
  const timer = setTimeout(() => { expired = true; void stop().catch(fail); }, options.timeout);
  try { return await complete; }
  finally { clearTimeout(timer); await stop!(); }
}
const npm = process.env.PATH!.split(':').map(dir => join(dir, 'npm')).find(path => existsSync(path))!;
const installer = fileURLToPath(new URL('../../site/public/install.sh', import.meta.url));

async function fixture(t: test.TestContext) {
  await assertTestAdmission();
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-installer-')));
  ownDirectory(t, root);
  await mkdir(join(root, 'home'));
  await mkdir(join(root, 'bin'));
  await copyFile(installer, join(root, 'install.sh'));
  await writeFile(join(root, 'bin/node'), '#!/bin/sh\nif [ "$1" = --version ]; then [ -n "$FAKE_NODE_VERSION" ] || exit 127; printf "%s\\n" "$FAKE_NODE_VERSION"; else exec "$REAL_NODE" "$@"; fi\n');
  await chmod(join(root, 'bin/node'), 0o755);
  // The curl boundary refuses every URL except explicit fixture mappings/file URLs.
  await writeFile(join(root, 'bin/curl'), `#!/usr/bin/env node
const fs = require('node:fs'), url = require('node:url'), args = process.argv.slice(2);
const out = args[args.indexOf('-o') + 1];
const target = args.find(a => /^(https|file):/.test(a));
const files = JSON.parse(fs.readFileSync(process.env.FAKE_RELEASE_MAP, 'utf8'));
const source = target.startsWith('file:') ? url.fileURLToPath(target) : files[target];
if (!source) { console.error('Network forbidden in installer fixture'); process.exit(98); }
fs.copyFileSync(source, out);
`);
  await chmod(join(root, 'bin/curl'), 0o755);
  await writeFile(join(root, 'release-map.json'), '{}');
  await writeFile(join(root, 'bin/git'), '#!/bin/sh\n[ "$*" = "ls-remote --tags --refs https://github.com/Kealman/cland-v0.git" ] || exit 97\ncat "$FAKE_TAG_REFS"\n');
  await chmod(join(root, 'bin/git'), 0o755);
  await writeFile(join(root, 'bin/npm'), '#!/bin/sh\nexec "$REAL_NPM" --offline --cache "$HOME/.npm" "$@"\n');
  await chmod(join(root, 'bin/npm'), 0o755);
  await writeFile(join(root, 'bin/mv'), `#!/bin/sh
case "$1" in */previous) [ "\${FAKE_RESTORE_FAIL:-}" != 1 ] || exit 42 ;; esac
/bin/mv "$@" || exit $?
if [ "$2" = previous ] && [ "\${FAKE_PUBLISH_INTERRUPT:-}" = 1 ]; then
    printf 'old install moved\\n' > "$HOME/publication-interrupted"
    kill -TERM "$PPID"
fi
`);
  await chmod(join(root, 'bin/mv'), 0o755);
  const env = fixtureEnvironment(root, process.env, {
    PATH: `${join(root, 'bin')}:${process.env.PATH}`, REAL_NODE: process.execPath, REAL_NPM: npm,
    FAKE_TAG_REFS: join(root, 'tags.txt'), FAKE_RELEASE_MAP: join(root, 'release-map.json'), FAKE_NODE_VERSION: 'v24.21.0', PREFIX: join(root, 'prefix with spaces'),
  });
  return { root, env };
}

test('installer rejects absent or unsupported Node before fetching or changing the prefix', async t => {
  const { root, env } = await fixture(t);
  for (const version of ['', 'v22.16.0', 'v24.12.0', 'v25.0.0']) {
    await assert.rejects(run(t, '/bin/sh', ['install.sh'], {
      cwd: root, env: fixtureEnvironment(root, env, { PATH: env.PATH, REAL_NODE: process.execPath, FAKE_RELEASE_MAP: env.FAKE_RELEASE_MAP, FAKE_NODE_VERSION: version }), timeout: 15_000,
    }), (error: unknown) => {
      const result = error as { stderr: string };
      assert.match(result.stderr, /Node.*24\.13.*<25/);
      assert.match(result.stderr, /https:\/\/nodejs\.org/);
      return true;
    });
  }
  await assert.rejects(access(env.PREFIX!));
});

async function release(t: test.TestContext, root: string, version: string, broken = false) {
  const source = join(root, version, 'cland-tag');
  await mkdir(join(source, 'hub/bin'), { recursive: true });
  await mkdir(join(source, 'web'), { recursive: true });
  const helper = join(root, version, 'package');
  await mkdir(helper);
  await writeFile(join(helper, 'package.json'), JSON.stringify({ name: 'build-helper', version: '1.0.0', main: 'index.cjs' }));
  await writeFile(join(helper, 'index.cjs'), "module.exports = 'built';");
  await run(t, 'tar', ['-czf', join(source, 'build-helper.tar.gz'), '-C', join(root, version), 'package'], {
    cwd: root, env: fixtureEnvironment(root, process.env), timeout: 15_000,
  });
  const pkg = { name: 'fake-cland', version, devDependencies: { 'build-helper': 'file:build-helper.tar.gz' }, scripts: {
    prepare: 'node -e "process.exit(93)"',
    build: broken ? 'node -e \"process.exit(42)\"' : `node -e "require('node:fs').mkdirSync('web/dist'); require('node:fs').writeFileSync('web/dist/index.html', require('build-helper')); require('node:fs').writeFileSync('web/dist/lock-mtime', String(require('node:fs').statSync('package-lock.json').mtimeMs))"`,
  } };
  await writeFile(join(source, 'package.json'), JSON.stringify(pkg));
  await writeFile(join(source, 'package-lock.json'), JSON.stringify({ name: pkg.name, version, lockfileVersion: 3, packages: { '': { name: pkg.name, version, devDependencies: pkg.devDependencies }, 'node_modules/build-helper': { version: '1.0.0', resolved: 'file:build-helper.tar.gz', dev: true } } }));
  await writeFile(join(source, 'hub/bin/cland.ts'), `#!/usr/bin/env node\nconsole.log('${version}: ' + process.argv.slice(2).join(' '));`);
  await chmod(join(source, 'hub/bin/cland.ts'), 0o755);
  const archive = join(root, `${version}.tar.gz`);
  await run(t, 'tar', ['-czf', archive, '-C', join(root, version), 'cland-tag'], {
    cwd: root, env: fixtureEnvironment(root, process.env), timeout: 15_000,
  });
  return new URL(`file://${archive}`).href;
}

test('installer builds a tagged release, reports its command and updates on rerun', async t => {
  const { root, env } = await fixture(t);
  for (const version of ['0.1.0', '0.2.0']) {
    const url = await release(t, root, version);
    await writeFile(env.FAKE_TAG_REFS!, `abc refs/tags/v0.0.9\nabc refs/tags/v${version}\nabc refs/tags/v99.0.0-beta\n`);
    await writeFile(env.FAKE_RELEASE_MAP!, JSON.stringify({
      [`https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/v${version}`]: fileURLToPath(url),
    }));
    const result = await run(t, '/bin/sh', ['install.sh'], {
      cwd: root, env: fixtureEnvironment(root, env, {
        PATH: env.PATH, REAL_NODE: process.execPath, FAKE_NODE_VERSION: 'v24.13.0', FAKE_RELEASE_MAP: env.FAKE_RELEASE_MAP, FAKE_TAG_REFS: env.FAKE_TAG_REFS,
      }), timeout: 30_000,
    });
    assert.match(result.stdout, /Installed cland/);
    assert.ok(result.stdout.includes(join(env.PREFIX!, 'bin/cland')));
    const command = await run(t, join(env.PREFIX!, 'bin/cland'), ['--version'], {
      cwd: root, env: fixtureEnvironment(root, process.env), timeout: 15_000,
    });
    assert.equal(command.stdout.trim(), `${version}: --version`);
    assert.equal(await readFile(join(env.PREFIX!, 'lib/cland/web/dist/index.html'), 'utf8'), 'built');
    await assert.rejects(access(join(env.PREFIX!, 'lib/cland/node_modules/build-helper')));
    assert.equal((await stat(join(env.PREFIX!, 'lib/cland/package-lock.json'))).mtimeMs, Number(await readFile(join(env.PREFIX!, 'lib/cland/web/dist/lock-mtime'), 'utf8')), 'pruning must preserve the lockfile build input so the web receipt stays current');
  }
  await assert.rejects(access(join(env.PREFIX!, 'lib/.cland-install-lock')));
});

test('a failed release build preserves the installed command and releases staging', async t => {
  const { root, env } = await fixture(t);
  for (const [version, broken] of [['0.1.0', false], ['0.2.0', true]] as const) {
    const url = await release(t, root, version, broken);
    const attempt = run(t, '/bin/sh', ['install.sh'], {
      cwd: root, env: fixtureEnvironment(root, env, {
        PATH: env.PATH, REAL_NODE: process.execPath, FAKE_NODE_VERSION: 'v24.21.0',
        FAKE_RELEASE_MAP: env.FAKE_RELEASE_MAP, CLAND_RELEASE_URL: url,
      }), timeout: 30_000,
    });
    if (broken) await assert.rejects(attempt, /Command failed/);
    else await attempt;
  }
  const command = await run(t, join(env.PREFIX!, 'bin/cland'), ['--version'], {
    cwd: root, env: fixtureEnvironment(root, process.env), timeout: 15_000,
  });
  assert.equal(command.stdout.trim(), '0.1.0: --version');
  await assert.rejects(access(join(env.PREFIX!, 'lib/.cland-install-lock')));
});

test('interruption after moving the old release restores its working command', async t => {
  const { root, env } = await fixture(t);
  for (const [version, interrupt] of [['0.1.0', false], ['0.2.0', true]] as const) {
    const url = await release(t, root, version);
    const attempt = run(t, '/bin/sh', ['install.sh'], {
      cwd: root, env: fixtureEnvironment(root, env, {
        PATH: env.PATH, REAL_NODE: process.execPath, FAKE_NODE_VERSION: 'v24.21.0',
        FAKE_RELEASE_MAP: env.FAKE_RELEASE_MAP, CLAND_RELEASE_URL: url,
        FAKE_PUBLISH_INTERRUPT: interrupt ? '1' : '0',
      }), timeout: 30_000,
    });
    if (interrupt) await assert.rejects(attempt, /Command failed/);
    else await attempt;
  }
  assert.equal(await readFile(join(env.HOME!, 'publication-interrupted'), 'utf8'), 'old install moved\n');
  const command = await run(t, join(env.PREFIX!, 'bin/cland'), ['--version'], {
    cwd: root, env: fixtureEnvironment(root, process.env), timeout: 15_000,
  });
  assert.equal(command.stdout.trim(), '0.1.0: --version');
});

test('a failed rollback preserves and reports the previous release for recovery', async t => {
  const { root, env } = await fixture(t);
  let backup = '';
  for (const [version, interrupt] of [['0.1.0', false], ['0.2.0', true]] as const) {
    const url = await release(t, root, version);
    const attempt = run(t, '/bin/sh', ['install.sh'], {
      cwd: root, env: fixtureEnvironment(root, env, {
        PATH: env.PATH, REAL_NODE: process.execPath, FAKE_NODE_VERSION: 'v24.21.0',
        FAKE_RELEASE_MAP: env.FAKE_RELEASE_MAP, CLAND_RELEASE_URL: url,
        FAKE_PUBLISH_INTERRUPT: interrupt ? '1' : '0', FAKE_RESTORE_FAIL: '1',
      }), timeout: 30_000,
    });
    if (interrupt) await assert.rejects(attempt, (error: unknown) => {
      backup = /Recover it from: (.+\/previous)/.exec((error as { stderr: string }).stderr)?.[1] ?? '';
      assert.ok(backup.startsWith(join(env.PREFIX!, 'lib/.cland-install.')));
      return true;
    });
    else await attempt;
  }
  const command = await run(t, join(backup, 'hub/bin/cland.ts'), ['--version'], {
    cwd: root, env: fixtureEnvironment(root, process.env), timeout: 15_000,
  });
  assert.equal(command.stdout.trim(), '0.1.0: --version');
});
