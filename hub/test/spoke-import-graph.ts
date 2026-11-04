// Source-only eager graph: type imports disappear at runtime; function-scoped import() is deferred.
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

export const spokeStartupDenyList = [
  'node:sqlite', 'sqlite', 'hub/src/hub/journal.ts', 'hub/src/hub/store.ts',
  'hub/src/tracker/', 'hub/src/tool-arguments.ts', 'hub/src/spoke/tools.ts',
] as const;

export function eagerSpecifiers(source: string): string[] {
  const tree = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.isTypeOnly) return;
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(element => element.isTypeOnly)) return;
      if (ts.isStringLiteral(node.moduleSpecifier)) names.push(node.moduleSpecifier.text);
      return;
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (!node.isTypeOnly && !(node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly)) && ts.isStringLiteral(node.moduleSpecifier)) names.push(node.moduleSpecifier.text);
      return;
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) names.push(node.arguments[0].text);
    ts.forEachChild(node, walk);
  };
  walk(tree);
  return names;
}

export function spokeStartupFindings(root: string, read: (file: string) => string = file => readFileSync(file, 'utf8')): string[] {
  const seen = new Set<string>();
  const findings: string[] = [];
  const visit = (file: string, chain: string[]) => {
    const name = file.startsWith(root + '/') ? relative(root, file) : file;
    const path = [...chain, name];
    if (spokeStartupDenyList.some(denied => denied.endsWith('/') ? name.startsWith(denied) : name === denied)) {
      findings.push(path.join(' -> ')); return;
    }
    // Package implementations are outside this repository's import policy; built-ins are terminal.
    if (!file.startsWith(root + '/') || seen.has(file)) return;
    seen.add(file);
    for (const dependency of eagerSpecifiers(read(file))) visit(dependency.startsWith('.') ? resolve(dirname(file), dependency) : dependency, path);
  };
  visit(resolve(root, 'hub/bin/cland-spoke.ts'), []);
  return findings;
}
