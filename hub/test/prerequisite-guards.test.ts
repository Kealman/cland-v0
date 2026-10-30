// T2: isolated runtime imports with no hub; site graph checks use in-memory sources.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { siteImportFindings } from './prerequisite-guards.ts';

test('site import guard catches a transitive hub-only package and computed imports', () => {
  const files = new Map([
    ['/repo/site/test/a.ts', "import '../../hub/src/a.ts'"],
    ['/repo/hub/src/a.ts', "import 'smol-toml'"],
  ]);
  assert.match(siteImportFindings(['/repo/site/test/a.ts'], files, new Set()).join(' '), /smol-toml/);
  assert.deepEqual(siteImportFindings(['/repo/site/test/a.ts'], files, new Set(['smol-toml'])), []);
  files.set('/repo/hub/src/a.ts', 'const x = import(variable)');
  assert.match(siteImportFindings(['/repo/site/test/a.ts'], files, new Set()).join(' '), /literal/);
  files.set('/repo/hub/src/a.ts', "import {createRequire as make} from 'node:module'; const load=make(import.meta.url); export const f=()=>load('smol-toml');");
  assert.match(siteImportFindings(['/repo/site/test/a.ts'], files, new Set()).join(' '), /smol-toml/);
  for (const source of ["const target='node:fs'; export const run=target=>import(target)", "let target='node:fs'; target='smol-toml'; export const run=()=>import(target)"]) {
    files.set('/repo/hub/src/a.ts', source);
    assert.match(siteImportFindings(['/repo/site/test/a.ts'], files, new Set()).join(' '), /incomplete/);
  }
  files.set('/repo/hub/src/a.ts', "import {readFile} from 'node:fs'; export const x = 1");
  assert.deepEqual(siteImportFindings(['/repo/site/test/a.ts'], files, new Set()), []);
});

test('install-shaped runtime smoke reports a planted missing CLI runtime dependency', { timeout: 30_000 }, async t => {
  const { cliInstallFindings } = await import('./prerequisite-cli.ts');
  const directory = await mkdtemp(join(tmpdir(), 'cland-install-control-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [path, source] of [
    ['package.json', '{"type":"module"}'],
    ['hub/package.json', '{"type":"module","dependencies":{}}'],
    ['hub/src/cli/command.ts', "export const run = () => import('../lazy.ts')"],
    ['hub/src/lazy.ts', 'export const loaded = true'],
    ['hub/test/process-cleanup.ts', ''], ['test-support/control.ts', ''],
    ['shared/control.ts', ''], ['nvim/bin/control.ts', ''], ['nvim/NVIM_VERSION', '0.11.3'],
  ]) {
    await mkdir(dirname(join(directory, path!)), { recursive: true });
    await writeFile(join(directory, path!), source!);
  }
  await symlink(fileURLToPath(new URL('../../node_modules', import.meta.url)), join(directory, 'node_modules'));
  const root = pathToFileURL(directory + '/');
  assert.deepEqual(await cliInstallFindings(root), []);
  assert.deepEqual(await cliInstallFindings(root, "const name = '../' + 'lazy.ts'; export const lazy = () => import(name);"), []);
  const bad = await cliInstallFindings(root, "export const lazy = () => import('../../test/install-only-defect.ts');");
  assert.match(bad.join(' '), /install-only-defect/);
  assert.match((await cliInstallFindings(root, "import 'typescript';")).join(' '), /not an installed runtime dependency/);
  for (const defect of [
    "import {createRequire} from 'node:module'; export const lazy = () => createRequire(import.meta.url)('../../test/install-only-defect.ts');",
    "import {createRequire as make} from 'node:module'; const load = make(import.meta.url); export const lazy = () => load('typescript');",
    "export const lazy = name => import(name);",
    "const target='node:fs'; export const lazy = target => import(target);",
    "let target='node:fs'; target='typescript'; export const lazy = () => import(target);",
  ]) {
    await t.test(defect, async t => {
      const findings = await cliInstallFindings(root, defect);
      t.diagnostic(JSON.stringify({ defect, findings }));
      assert.match(findings.join(' '), /install-only-defect|not an installed runtime dependency|incomplete.*literal/);
    });
  }
});
