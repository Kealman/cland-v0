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
let loadGuardMs = 0;
function checkLoadRaces(file: string, text: string): void {
  const started = performance.now();
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const unwrap = (node: ts.Node): ts.Node => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const negated = (node: ts.Node): boolean => {
    node = unwrap(node);
    let count = 0;
    while (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      count++;
      node = unwrap(node.operand);
    }
    return count % 2 === 1;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      // Any raw resize may cross the breakpoint: variables and initial phone
      // contexts make a reliable static width history impossible.
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
      const resizeHelper = file === 'web/test/harness.ts' && owner && ts.isFunctionDeclaration(owner) && owner.name?.text === 'resizePage';
      if (!resizeHelper) assert.notEqual(name, 'setViewportSize', `${file}:${line}: use resizePage to await the rendered [data-phone] layout`);
      if (['pageUntil', 'until', 'waitForFunction'].includes(name)) {
        const predicate = node.arguments[name === 'pageUntil' ? 1 : 0];
        if (predicate && (ts.isArrowFunction(predicate) || ts.isFunctionExpression(predicate))) {
          const check = (body: ts.Node): void => {
            if (ts.isReturnStatement(body) && body.expression) assert.equal(negated(body.expression), false, `${file}:${line}: wait for a positive receipt before asserting absence`);
            // A nested callback owns a different return value.
            if (!ts.isFunctionLike(body)) ts.forEachChild(body, check);
          };
          if (ts.isBlock(predicate.body)) check(predicate.body);
          else assert.equal(negated(predicate.body), false, `${file}:${line}: wait for a positive receipt before asserting absence`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  loadGuardMs += performance.now() - started;
}

for (const text of [
  'await page.setViewportSize({ width: 390, height: 844 });',
  'await other.setViewportSize(size);',
  'await pageUntil(page, () => !document.querySelector("article"), "gone");',
  'await until(() => { return !retrying; }, { what: "done" });',
  'await page.waitForFunction(() => !(window.ready));',
  'await pageUntil(page, function () { return !!!document.querySelector("article"); }, "gone");',
]) assert.throws(() => checkLoadRaces('planted.test.ts', text), /resizePage|positive receipt/);
checkLoadRaces('planted.test.ts', 'await resizePage(page, { width: 390, height: 844 }); await pageUntil(page, () => !!document.querySelector("article"), "present");');
checkLoadRaces('planted.test.ts', 'await pageUntil(page, () => document.querySelectorAll("article").length === 0, "departure applied"); // page.setViewportSize(size)');

for await (const file of glob('**/*.ts', { cwd: tests })) {
  const text = await readFile(new URL(file, tests), 'utf8');
  if (file.endsWith('.test.ts')) checkPageClock(`web/test/${file}`, text);
  checkLoadRaces(`web/test/${file}`, text);
}
console.log('web page clock: no raw same-time install/pauseAt pairs');
console.log(`web load guards: resizePage boundary and positive wait predicates; shared AST scan ${loadGuardMs.toFixed(1)} ms; no browser work`);
