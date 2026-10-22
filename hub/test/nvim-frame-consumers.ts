import type { FixtureSource } from './source-fixture.ts';
import { posix } from 'node:path';
import ts from 'typescript';

function dependencies(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly
      || ts.isExportDeclaration(node) && !node.isTypeOnly)
      && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) specifiers.push(node.arguments[0].text);
    // The stdio stub is launched by path, rather than imported into the test.
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
      && node.arguments?.length === 2 && ts.isStringLiteralLike(node.arguments[0]!)
      && node.arguments[1]!.getText(source) === 'import.meta.url') specifiers.push(node.arguments[0]!.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers.filter(value => value.startsWith('.')).map(value => posix.join(posix.dirname(file), value));
}

/** Files to run during a full protocol-frame refresh, including non-T2 consumers. */
export async function frameConsumers(files: readonly string[], read: FixtureSource): Promise<string[]> {
  const selected = new Set<string>();
  const graph = new Map<string, string[]>();
  for (const entry of files) {
    const pending = [entry];
    const seen = new Set<string>();
    while (pending.length) {
      const file = pending.pop()!;
      if (file === 'nvim/test/stub-hub.ts') { selected.add(entry); break; }
      // The shared launcher only compares the stub URL to validate commands;
      // its native clients do not consume or record protocol fixtures.
      if (file === 'nvim/test/client.ts') continue;
      if (seen.has(file) || !/\.[cm]?[jt]sx?$/.test(file)) continue;
      seen.add(file);
      if (!graph.has(file)) {
        const text = await read(file);
        graph.set(file, text === undefined ? [] : dependencies(file, text));
      }
      pending.push(...graph.get(file)!);
    }
  }
  return [...selected].sort();
}
