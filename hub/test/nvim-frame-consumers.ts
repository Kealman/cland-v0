import type { FixtureSource } from './source-fixture.ts';
import { posix } from 'node:path';
import ts from 'typescript';

function dependencies(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers = ts.preProcessFile(text, true, true).importedFiles.map(entry => entry.fileName);
  const visit = (node: ts.Node): void => {
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
export async function frameConsumers(files: readonly string[], tiers: Record<string, unknown>, read: FixtureSource): Promise<string[]> {
  const selected = new Set(Object.keys(tiers).filter(file => file.startsWith('nvim/test/') && tiers[file] === 'T2'));
  const graph = new Map<string, string[]>();
  for (const entry of files) {
    const pending = [entry];
    const seen = new Set<string>();
    while (pending.length) {
      const file = pending.pop()!;
      if (file === 'nvim/test/stub-hub.ts') { selected.add(entry); break; }
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
