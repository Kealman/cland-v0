// T0: syntax-only copied-tracker assertions, with in-memory planted controls.
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';

function failures(file: string, text: string): string[] {
  if (!/\.cland[\\/]tasks/.test(text) || !/\bcp(?:Sync)?\b/.test(text)) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); node.getChildren(source).forEach(visit); };
  visit(source);
  const literals = nodes.filter((node): node is ts.StringLiteralLike | ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail | ts.RegularExpressionLiteral => ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isRegularExpressionLiteral(node));
  const copyNames = new Set(['cp', 'cpSync']);
  for (const node of nodes) if (ts.isImportSpecifier(node) && ['cp', 'cpSync'].includes((node.propertyName ?? node.name).text)) copyNames.add(node.name.text);
  const contains = (outer: ts.Node, inner: ts.Node) => inner.pos >= outer.pos && inner.end <= outer.end;
  const copied = (body: ts.Node) => nodes.some(node => contains(body, node) && ts.isCallExpression(node)
    && copyNames.has(ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : node.expression.getText(source))
    && node.arguments[0] && literals.some(literal => contains(node.arguments[0]!, literal) && /(?:^|[\\/])\.cland[\\/]tasks(?:$|[\\/])/.test(literal.text)));
  const exemptions = new Set<number>();
  for (const node of nodes) for (const comment of [...ts.getLeadingCommentRanges(text, node.pos) ?? [], ...ts.getTrailingCommentRanges(text, node.end) ?? []]) {
    if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia && /^\/\/\s*cland-allow-tracker-id:\s*\S/.test(text.slice(comment.pos, comment.end))) {
      exemptions.add(source.getLineAndCharacterOfPosition(comment.pos).line + 1);
    }
  }
  const flagged = new Set<number>();
  for (const node of nodes) if (ts.isCallExpression(node) && /^(?:test|it)(?:\.|$)/.test(node.expression.getText(source))) {
    const body = node.arguments.find(arg => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
    if (!body || !copied(body)) continue;
    for (const literal of literals) if (contains(body, literal) && /\b[ET]-\d+\b/.test(literal.text)) {
      const line = source.getLineAndCharacterOfPosition(literal.getStart(source)).line + 1;
      if (!exemptions.has(line) && !exemptions.has(line - 1)) flagged.add(line);
    }
  }
  return [...flagged].sort((a, b) => a - b).map(line => `${file}:${line}: copied-tracker-id: derive live ids from the copy; seeded literals need // cland-allow-tracker-id: reason`);
}

const copy = "await cp(resolve(repo, '.cland/tasks'), join(root, '.cland/tasks'), {recursive:true});";
for (const assertion of [
  "assert.ok(ids.includes('E-1196'));",
  "assert.match(text, /T-1204/);",
  "/E-1196/.test(text);",
  'await tree.locator(`[data-object-id="T-1204"]`).waitFor();',
  'await tree.locator(`T-1204/${suffix}`).waitFor();',
  "const expected = 'T-1204'; assert.equal(actual, expected);",
]) {
  const planted = `test('copied tracker', async () => {\n${copy}\n${assertion}\n});`;
  assert.match(failures('web/test/planted.test.ts', planted)[0] ?? '', /^web\/test\/planted.test.ts:3: copied-tracker-id:/, assertion);
}

assert.equal(failures('fixture.test.ts', `import {cp as copyTracker} from 'node:fs/promises'; test('copied', async () => { ${copy.replace('cp(', 'copyTracker(')} assert.equal(id, 'T-1204'); });`).length, 1);
assert.equal(failures('fixture.test.ts', `test('copied', async () => { ${copy} const note = \`template with \${1}\`;\n// cland-allow-tracker-id: fixture seeds this row\nassert.equal(id, 'T-900001'); });`).length, 0);

for (const allowed of [
  `test('synthetic', () => { assert.equal(id, 'T-1'); assert.match(text, /T-1/); });`,
  `test('copied', async () => { ${copy} assert.equal(id, chosen.id); });`,
  `test('copied', async () => { ${copy}\n// cland-allow-tracker-id: seeded below in this fixture\nassert.equal(id, 'T-900001'); });`,
  `test('copied', async () => { ${copy}\n// cland-allow-tracker-id: seedItem owns the regexp row\nassert.match(text, /T-900001/); });`,
  `test('copied', async () => { ${copy} }); test('synthetic sibling', () => { assert.equal(id, 'E-1'); });`,
]) assert.deepEqual(failures('fixture.test.ts', allowed), [], allowed);
for (const fake of ["// cland-allow-tracker-id:", "const text = '// cland-allow-tracker-id: fake';", '// cland-allow-tracker-id: unrelated\n']) {
  assert.equal(failures('fixture.test.ts', `test('copied', async () => { ${copy}\n${fake}\nassert.equal(id, 'T-1204'); });`).length, 1, fake);
}

if (process.argv.includes('--help')) {
  console.log('Usage: node hub/test/lint-copied-tracker.ts [--help]\nScan hub/web/nvim tests that copy .cland/tasks for literal E-/T- ids. Seeded ids need a same/previous-line // cland-allow-tracker-id: reason. In-memory controls always run.');
  process.exit(0);
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const found: string[] = [];
for (const dir of ['hub/test', 'web/test', 'nvim/test']) {
  for await (const file of glob(`${dir}/**/*.test.ts`, { cwd: root })) found.push(...failures(file, await readFile(join(root, file), 'utf8')));
}
if (found.length) { console.error(found.join('\n')); process.exitCode = 1; }
else console.log('copied-tracker lint: no unowned literal live E-/T- ids');
