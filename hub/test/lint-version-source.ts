// T0 static gate: the root package owns cland's version; production consumers share VERSION.
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
function checkSource(path: string, source: string): void {
  assert.doesNotMatch(source, /['"`]0\.1\.0['"`]/, `${path}: import VERSION instead of the old version literal`);
  for (const [, , reference] of source.matchAll(/(['"`])([^'"`\n]*package\.json)\1/g)) {
    const target = resolve(dirname(join(root, path)), reference!);
    assert.ok(target !== join(root, 'hub/package.json') && reference !== 'hub/package.json', `${path}: do not read the hub package version (${reference})`);
  }
}

// A nested consumer's ../../package.json is the hub package, not the root package.
assert.throws(() => checkSource('hub/src/spoke/spoke.ts', "readFileSync(new URL('../../package.json', import.meta.url), 'utf8')"), /do not read the hub package version/);
assert.throws(() => checkSource('hub/src/version.ts', "readFileSync(new URL('../package.json', import.meta.url), 'utf8')"), /do not read the hub package version/);
checkSource('hub/src/version.ts', "readFileSync(new URL('../../package.json', import.meta.url), 'utf8')");
checkSource('hub/src/spoke/spoke.ts', "readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')");

for await (const path of glob('hub/src/**/*.ts', { cwd: root })) {
  const source = await readFile(join(root, path), 'utf8');
  checkSource(path, source);
}
const pkg = JSON.parse(await readFile(join(root, 'hub/package.json'), 'utf8')) as Record<string, unknown>;
assert.equal(Object.hasOwn(pkg, 'version'), false, 'hub/package.json must not own a version');
console.log('version source lint: root package is the only version source');
