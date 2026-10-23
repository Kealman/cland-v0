// T0: workspace strictness and the verification build order, without running a suite or installer.
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import ts from 'typescript';

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

// Compare parsed expressions so comments, whitespace and receiver names cannot
// hide the install-at-T / pause-at-T race. Already-ahead pauses remain valid.
function checkPageClock(file: string, text: string): void {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ removeComments: true });
  const expression = (node: ts.Node) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  const visit = (node: ts.Node, installed: Map<string, string>): void => {
    if (ts.isBlock(node)) installed = new Map();
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const { name, expression: clock } = node.expression;
      if (ts.isPropertyAccessExpression(clock) && clock.name.text === 'clock') {
        const key = expression(clock);
        const argument = node.arguments[0];
        if (name.text === 'install') {
          installed.delete(key);
          if (argument && ts.isObjectLiteralExpression(argument)) {
            const time = argument.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source) === 'time');
            if (time && ts.isPropertyAssignment(time)) installed.set(key, expression(time.initializer));
          }
        } else if (name.text === 'pauseAt' && argument) {
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          assert.notEqual(installed.get(key), expression(argument), `${file}:${line}: use pausePageClock for same-time install/pauseAt`);
        }
      }
    }
    ts.forEachChild(node, child => visit(child, installed));
  };
  visit(source, new Map());
}

for (const text of [
  'await page.clock.install({ time: new Date("2026-10-23T12:00:00Z") }); await page.clock.pauseAt(new Date("2026-10-23T12:00:00Z"));',
  'await other.clock.install({ time: fixture.clock.now() });\n/* running clock */ await other.clock.pauseAt(fixture.clock.now());',
  'await page.clock.install({ time: target }); await unrelated(); await page.clock.pauseAt( target );',
]) assert.throws(() => checkPageClock('planted.test.ts', text), /use pausePageClock/);
checkPageClock('planted.test.ts', 'await page.clock.install({ time: new Date("2026-10-23T12:00:00Z") }); await page.clock.pauseAt(new Date("2026-10-23T12:00:01Z"));');
checkPageClock('planted.test.ts', 'await pausePageClock(page, fixture.clock.now()); // page.clock.install({ time: T }); page.clock.pauseAt(T);');

const tests = new URL('../../web/test/', import.meta.url);
for await (const file of glob('**/*.test.ts', { cwd: tests })) {
  checkPageClock(`web/test/${file}`, await readFile(new URL(file, tests), 'utf8'));
}
console.log('web page clock: no raw same-time install/pauseAt pairs');
