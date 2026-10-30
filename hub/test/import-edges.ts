// One dependency-edge policy for site declarations and stripped CLI runtime sources.
import ts from 'typescript';
export type ImportEdge = { specifier: string; line: number; kind: 'import' | 'require' };
export function importEdges(file: string, text: string): { edges: ImportEdge[]; findings: string[] } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  // Bind this one in-memory source only: lexical identity needs no libraries,
  // module resolution, filesystem scan or full type analysis.
  const options: ts.CompilerOptions = { noLib: true, noResolve: true, allowJs: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = name => name === file ? source : undefined;
  const checker = ts.createProgram([file], options, host).getTypeChecker();
  const symbol = (node: ts.Node) => checker.getSymbolAtLocation(node);
  const edges: ImportEdge[] = [], findings: string[] = [];
  const factories = new Set<ts.Symbol>(), namespaces = new Set<ts.Symbol>(), requires = new Set<ts.Symbol>();
  const constants = new Map<ts.Symbol, ts.Expression>();
  const add = (set: Set<ts.Symbol>, node: ts.Node) => { const key = symbol(node); if (key) set.add(key); };
  const has = (set: Set<ts.Symbol>, node: ts.Node) => { const key = symbol(node); return key !== undefined && set.has(key); };
  const isRequire = (node: ts.Expression) => ts.isIdentifier(node) && (has(requires, node) || node.text === 'require' && symbol(node) === undefined);
  function declarations(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && ['module', 'node:module'].includes(node.moduleSpecifier.text)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        if ((binding.propertyName ?? binding.name).text === 'createRequire') add(factories, binding.name);
      }
      if (bindings && ts.isNamespaceImport(bindings)) add(namespaces, bindings.name);
      if (node.importClause?.name) add(namespaces, node.importClause.name);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const)) {
      const key = symbol(node.name); if (key) constants.set(key, node.initializer);
    }
    ts.forEachChild(node, declarations);
  }
  declarations(source);
  const factory = (node: ts.Expression) => ts.isIdentifier(node) && has(factories, node)
    || ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && has(namespaces, node.expression) && node.name.text === 'createRequire';
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, value] of constants) {
      if (ts.isIdentifier(value) && has(factories, value) && !factories.has(name)) { factories.add(name); changed = true; }
      if ((ts.isCallExpression(value) && factory(value.expression) || ts.isIdentifier(value) && isRequire(value)) && !requires.has(name)) { requires.add(name); changed = true; }
    }
  }
  function literal(node: ts.Expression, seen = new Set<ts.Symbol>()): string | undefined {
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) {
      const key = symbol(node);
      if (key && !seen.has(key)) { seen.add(key); const value = constants.get(key); if (value) return literal(value, seen); }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = literal(node.left, new Set(seen)), right = literal(node.right, new Set(seen));
      if (left !== undefined && right !== undefined) return left + right;
    }
    return undefined;
  }
  function dependency(node: ts.Node | undefined, owner: ts.Node, kind: ImportEdge['kind']): void {
    const line = source.getLineAndCharacterOfPosition(owner.getStart(source)).line + 1;
    const specifier = node && ts.isExpression(node) ? literal(node) : undefined;
    if (specifier === undefined) findings.push(`${file}:${line}: incomplete dependency: literal path unavailable`);
    else edges.push({ specifier, line, kind });
  }
  function walk(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) dependency(node.moduleSpecifier, node, 'import');
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) dependency(node.argument.literal, node, 'import');
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) dependency(node.moduleReference.expression, node, 'require');
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) dependency(node.arguments[0], node, 'import');
      else if (isRequire(node.expression)
        || ts.isCallExpression(node.expression) && factory(node.expression.expression)) dependency(node.arguments[0], node, 'require');
      if (factory(node.expression)) {
        if (node.arguments[0]?.getText(source) !== 'import.meta.url') findings.push(`${file}: incomplete createRequire base: expected import.meta.url`);
        if (ts.isVariableDeclaration(node.parent) && ts.isVariableDeclarationList(node.parent.parent) && !(node.parent.parent.flags & ts.NodeFlags.Const)) findings.push(`${file}: incomplete mutable createRequire loader binding`);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
  return { edges, findings };
}
