import { ImportGraphError } from './suite-import-errors.ts';
/** Kept lazy: installed CLI trees may not include the development compiler. */
export async function graphImportSpecifiers(source: string, file = 'module.ts', load = () => import('typescript')): Promise<string[]> {
  const unknown = (reason: string): never => { throw new Error(`incomplete import graph: ${reason} [${file}]`); };
  const ts = await load().catch(() => { throw new ImportGraphError('TypeScript parser unavailable', 'scan'); });
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if ((ast as typeof ast & { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length) unknown('source parse diagnostics');
  const imports = new Set<string>();
  const literal = (node: import('typescript').Node | undefined) => {
    if (!node || !ts.isStringLiteralLike(node)) return unknown('non-literal module specifier');
    if (['vm', 'node:vm'].includes(node.text)) unknown('vm loader');
    imports.add(node.text);
  };
  const bindings = new Map<string, import('typescript').Identifier>();
  const creatorCalls = new Set<import('typescript').CallExpression>();
  const creators = new Set<import('typescript').Identifier>();
  let work = 0;
  const bounded = () => { if (++work > 200_000) unknown('parser node budget exceeded'); };
  const collect = (node: import('typescript').Node): void => {
    bounded();
    if (ts.isTypeNode(node)) return;
    if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return;
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'createRequire') {
      const declaration = node.parent.parent.parent;
      if (!node.isTypeOnly && node.name.text === 'createRequire' && ts.isImportDeclaration(declaration)
        && ts.isStringLiteral(declaration.moduleSpecifier) && ['node:module', 'module'].includes(declaration.moduleSpecifier.text)) creators.add(node.name);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createRequire') {
      const base = node.arguments[0];
      if (node.arguments.length !== 1 || !base || !ts.isPropertyAccessExpression(base) || base.name.text !== 'url'
        || !ts.isMetaProperty(base.expression) || base.expression.keywordToken !== ts.SyntaxKind.ImportKeyword) unknown('unsupported createRequire base');
      const parent = node.parent;
      if (ts.isCallExpression(parent) && parent.expression === node) literal(parent.arguments[0]);
      else if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name)
        && ts.isVariableDeclarationList(parent.parent) && Boolean(parent.parent.flags & ts.NodeFlags.Const)) {
        if (bindings.has(parent.name.text)) unknown('ambiguous require binding');
        bindings.set(parent.name.text, parent.name);
      } else unknown('escaping createRequire');
      creatorCalls.add(node);
    }
    ts.forEachChild(node, collect);
  };
  collect(ast);
  if (creatorCalls.size && creators.size !== 1) unknown('unproven createRequire binding');
  const visit = (node: import('typescript').Node): void => {
    bounded();
    if (ts.isTypeNode(node)) return;
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) return;
      literal(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) return;
      if (node.moduleSpecifier) literal(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (node.isTypeOnly) return;
      if (ts.isExternalModuleReference(node.moduleReference)) literal(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') literal(node.arguments[0]);
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'vm') unknown('indirect module or vm loader');
    }
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      if (bindings.get(node.text) !== node) {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && parent.expression === node) literal(parent.arguments[0]);
        else unknown('escaping require binding');
      }
    }
    if (ts.isIdentifier(node) && node.text === 'createRequire' && !creators.has(node)
      && !(ts.isCallExpression(node.parent) && creatorCalls.has(node.parent) && node.parent.expression === node)) unknown('indirect createRequire');
    if (ts.isIdentifier(node) && ['eval', 'Function'].includes(node.text)) unknown('eval or indirect module loader');
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'constructor') unknown('indirect constructor');
    if (ts.isIdentifier(node) && node.text === 'require' && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) unknown('indirect require');
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      if (ts.isStringLiteralLike(key) && ['createRequire', 'eval', 'Function', 'constructor', 'require'].includes(key.text)
        || ts.isIdentifier(node.expression) && ['globalThis', 'global', 'window', 'self', 'Reflect', 'vm'].includes(node.expression.text)) unknown('computed global or loader access');
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...imports];
}
