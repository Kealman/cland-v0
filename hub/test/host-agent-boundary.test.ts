// T1: agent dependency closure and planted forbidden imports; source parsing only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../src/host/agent/', import.meta.url));
function findings(path: string, source: string): string[] {
  const errors: string[] = [];
  function visit(node: ts.Node) {
    let spec: ts.Expression | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) spec = node.moduleSpecifier;
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText() === 'require')) {
      spec = node.arguments[0]; if (!spec || !ts.isStringLiteral(spec)) errors.push('computed import');
    }
    if (spec && ts.isStringLiteral(spec)) {
      const value = spec.text;
      if (!value.startsWith('node:') && !(value.startsWith('.') && resolve(dirname(path), value).startsWith(root))) errors.push(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)); return errors;
}
test('agent imports only Node built-ins and agent modules', async () => {
  for (const source of ["import x from 'ws'", "export * from '../../processes.ts'", "const x = import('../local.ts')", "require(name)"]) assert.ok(findings(resolve(root, 'server.ts'), source).length);
  for await (const file of glob('**/*.ts', { cwd: root })) assert.deepEqual(findings(resolve(root, file), await readFile(resolve(root, file), 'utf8')), [], file);
});

import { LineDecoder, MAX_LINE_BYTES } from '../src/host/agent/protocol.ts';
test('JSONL byte limits apply per line across coalesced, fragmented and multibyte chunks', () => {
  const decoder = new LineDecoder();
  const first = 'a'.repeat(MAX_LINE_BYTES);
  assert.deepEqual(decoder.push(Buffer.from(first + '\nnext\n')), [first, 'next']);
  const utf8 = Buffer.from('é'.repeat(MAX_LINE_BYTES / 2) + '\nx\n');
  assert.deepEqual(decoder.push(utf8.subarray(0, 1)), []);
  assert.deepEqual(decoder.push(utf8.subarray(1)), ['é'.repeat(MAX_LINE_BYTES / 2), 'x']);
  assert.throws(() => decoder.push(Buffer.from('x'.repeat(MAX_LINE_BYTES + 1))), /large/);
});
