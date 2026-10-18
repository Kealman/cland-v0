// T2: the executable CLI is the subject; an in-process hub serves task headings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, projectHub, tempProject } from './harness.ts';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const run = (...args: string[]) => cland(process.cwd(), ...args);

test('cland --version prints the version of the hub package', async () => {
  for (const flag of ['--version', '-v']) {
    const r = await run(flag);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stdout, `${VERSION}\n`);
  }
});

test('cland with no command off a terminal prints the help; an unknown command is a usage error', async () => {
  const help = await run();
  assert.equal(help.code, 0);
  assert.match(help.stdout, /usage: cland \[<command>\]/);
  const bad = await run('serve');
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /unknown command "serve"/);
});

test('task view headings include release versions once, including in a child ancestry', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  for (const [id, title, version] of [
    ['R-228', 'Working with items', '0.1.2'],
    ['R-229', 'v0.1.1', '0.1.1'],
    ['R-230', '0.1.0', '0.1.0'],
    ['R-231', 'Unversioned', ''],
  ]) {
    await writeFile(join(dir, `${id}-release.md`), `---\nid: ${id}\nkind: release\ntitle: ${title}\nstate: open\n${version ? `version: ${version}\n` : ''}---\n`);
  }
  await writeFile(join(dir, 'E-269-epic.md'), '---\nid: E-269\nkind: epic\ntitle: Prefixes and categories\nstate: open\nparent: R-228\n---\n');
  await projectHub(t, root);
  for (const [id, heading] of [
    ['R-228', 'R-228  0.1.2  Working with items'],
    ['R-229', 'R-229  v0.1.1'],
    ['R-230', 'R-230  0.1.0'],
    ['R-231', 'R-231  Unversioned'],
    ['E-269', 'R-228  0.1.2  Working with items › E-269  Prefixes and categories'],
  ]) {
    const result = await cland(root, 'task', 'view', id!);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.split('\n')[0], heading);
  }
});
