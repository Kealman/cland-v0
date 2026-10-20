// T0: every wire dependency stays in the browser leaf, including erased imports.
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import ts from 'typescript';

const leaf = '/shared/wire';
function checkSource(file: string, text: string): void {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const dependency = (node: ts.Node): void => {
    assert.ok(ts.isStringLiteralLike(node), `${file}: wire dependencies must be literal paths inside shared/wire/`);
    const specifier = node.text;
    const target = posix.resolve(posix.dirname(posix.join(leaf, file)), specifier);
    assert.ok(specifier.startsWith('./') || specifier.startsWith('../'), `${file}: wire import ${specifier} must stay inside shared/wire/`);
    assert.ok(target.startsWith(`${leaf}/`), `${file}: wire import ${specifier} leaves shared/wire/`);
  };
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) dependency(node.moduleSpecifier);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) dependency(node.argument.literal);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression) dependency(node.moduleReference.expression);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      assert.ok(node.arguments[0], `${file}: wire dependency is missing its path`);
      dependency(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  assert.equal(source.typeReferenceDirectives.length, 0, `${file}: wire must not load ambient type packages`);
  assert.equal(source.libReferenceDirectives.length, 0, `${file}: wire libraries belong in its DOM-only tsconfig`);
  for (const reference of source.referencedFiles) dependency(ts.factory.createStringLiteral(reference.fileName));
  visit(source);
}

// Negative fixtures: type-only imports and re-exports are dependency edges too.
for (const text of [
  "import type { Topic } from '../../hub/src/protocol.ts';",
  "export type { Topic } from '../../hub/src/protocol.ts';",
  "export * from '../protocol-frame.ts';",
  "export type Bad = import('node:fs').Stats;",
  "import 'node:fs';",
  "import 'fs';",
  "import type { Thing } from 'some-package';",
  "import fs = require('node:fs');",
  "const load = () => import('../outside.ts');",
  "const load = (path: string) => import(path);",
  "const fs = require('node:fs');",
  '/// <reference types="node" />',
  '/// <reference path="../outside.d.ts" />',
  '/// <reference lib="webworker" />',
]) assert.throws(() => checkSource('fixture.ts', text), /wire/);
checkSource('nested/fixture.ts', "import type { Topic } from '../index.ts'; export * from './local.ts'; type Row = import('./local.ts').Row;");
checkSource('fixture.ts', '// import "node:fs";\nconst example = "import(\'node:fs\')";');

const root = new URL('../../shared/wire/', import.meta.url);
let checked = 0;
for await (const file of glob('**/*.{ts,tsx,mts,cts}', { cwd: root })) {
  checkSource(file, await readFile(new URL(file, root), 'utf8'));
  checked++;
}
assert.ok(checked > 0, 'wire leaf must contain TypeScript sources');
console.log(`wire import lint: ${checked} sources stay inside shared/wire/`);
