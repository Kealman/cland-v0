// T0: workspace strictness and the verification build order, without running a suite or installer.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const root = await read('package.json');
const web = await read('web/package.json');
const hubConfig = await read('hub/tsconfig.json');
const webConfig = await read('web/tsconfig.json');
const overrides = new Set(['lib', 'module', 'moduleResolution', 'types', 'jsx']);
for (const [flag, value] of Object.entries(hubConfig.compilerOptions)) {
  if (!overrides.has(flag)) assert.deepEqual(webConfig.compilerOptions[flag], value, `web must keep hub flag ${flag}`);
}
assert.deepEqual(webConfig.compilerOptions.types, ['vite/client'], 'browser typecheck must not include Node globals');
assert.deepEqual(webConfig.compilerOptions.lib, ['es2024', 'DOM', 'DOM.Iterable']);
assert.equal(webConfig.compilerOptions.moduleResolution, 'bundler');
assert.equal(webConfig.compilerOptions.jsx, 'react-jsx');
assert.deepEqual(root.workspaces, ['hub', 'web']);
assert.equal(web.devDependencies.typescript, undefined, 'reuse the root compiler');
assert.match(root.scripts.typecheck, /npm run typecheck --workspace web/);
assert.equal(root.scripts.prepare, 'npm run build && npm run test:web:install');
assert.equal(root.scripts.build, 'npm run build --workspace web');
assert.match(root.scripts.check, /^npm run typecheck && npm run build && /, 'verification builds the bundle after typecheck on local and remote executors');
console.log('web workspace: strict flags, shared compiler and post-typecheck build plan');
