// T0: seeded sources exercise the same guard used by web typecheck.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function htmlViolations(path: string, source: string): string[] {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const failures: string[] = [];
  const sinks = new Set(['dangerouslySetInnerHTML', 'innerHTML', 'outerHTML', 'insertAdjacentHTML']);
  function propertyKey(node: ts.Node): boolean {
    let parent = node.parent;
    while (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)
      || ts.isTypeAssertionExpression(parent) || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent)) parent = parent.parent;
    return ts.isElementAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isComputedPropertyName(parent);
  }
  // Forbid references to named sinks as well as assignments, so taking a method
  // alias or passing a spread prop cannot evade the write check. Text stays legal.
  function visit(node: ts.Node): void {
    if ((ts.isIdentifier(node) && sinks.has(node.text))
      || (ts.isStringLiteralLike(node) && sinks.has(node.text) && propertyKey(node))) {
      const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      failures.push(`${path}:${line}: raw-HTML sink ${node.text} is forbidden; render text or elements`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return failures;
}

for (const source of [
  'const view = <div dangerouslySetInnerHTML={{ __html: message }} />;',
  'node.innerHTML = message;', 'node.outerHTML += message;',
  'node["innerHTML"] = message;', "node['outerHTML'] = message;",
  'node.innerHTML\n = message;',
  'node.insertAdjacentHTML("beforeend", message);',
  'const props = { dangerouslySetInnerHTML: { __html: message } };',
  'const props = { "dangerouslySetInnerHTML": { __html: message } };',
  'node[`outerHTML`] = message;',
  'const props = { ["dangerouslySetInnerHTML"]: { __html: message } };',
  'const write = node.insertAdjacentHTML;',
  "node[('innerHTML')] = message;",
  "node[(('outerHTML' as string)!)] = message;",
  "node[('insertAdjacentHTML' satisfies string)]('beforeend', message);",
  "const props = { [('dangerouslySetInnerHTML' as const)]: { __html: message } };",
]) assert.ok(htmlViolations('nested/Message.tsx', source).length > 0, source);
assert.ok(htmlViolations('nested/Message.ts', "node[<string>'innerHTML'] = message;").length > 0);
for (const source of [
  'const view = <div>{message}</div>;', 'node.textContent = message;',
  'const explanation = "innerHTML"; // node.outerHTML = message;',
]) assert.deepEqual(htmlViolations('Safe.tsx', source), []);
assert.match(htmlViolations('nested/Message.tsx', '\nnode.innerHTML = message;')[0]!, /^nested\/Message.tsx:2:/);

async function check(root: string): Promise<string[]> {
  const failures: string[] = [];
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    failures.push(...htmlViolations(relative(root, path), await readFile(path, 'utf8')));
  }
  return failures;
}
const failures = await check(fileURLToPath(new URL('./src/', import.meta.url)));
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('web HTML: raw-HTML sinks refused; seeded fixtures passed');
