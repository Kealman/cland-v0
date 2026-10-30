import { ImportGraphError } from './suite-import-errors.ts';
export type GraphImport = { specifier: string; base?: string; resolveOnly?: boolean };
/** Kept lazy: installed CLI trees may not include the development compiler. */
export async function graphImports(source: string, file = 'module.ts', load = () => import('typescript')): Promise<GraphImport[]> {
  const unknown = (reason: string): never => { throw new Error(`incomplete import graph: ${reason} [${file}]`); };
  const ts = await load().catch(() => { throw new ImportGraphError('TypeScript parser unavailable', 'scan'); });
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if ((ast as typeof ast & { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length) unknown('source parse diagnostics');
  const imports: GraphImport[] = [];
  const literal = (node: import('typescript').Node | undefined) => {
    if (!node || !ts.isStringLiteralLike(node)) return unknown('non-literal module specifier');
    if (['vm', 'node:vm'].includes(node.text)) unknown('vm loader');
    imports.push({ specifier: node.text });
  };
  const bindings = new Map<string, import('typescript').Identifier>();
  const bases = new Map<string, string | undefined>();
  const creatorCalls = new Set<import('typescript').CallExpression>();
  const creators = new Set<import('typescript').Identifier>();
  const packageBase = (node: import('typescript').Node | undefined): string | undefined => {
    if (!node || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'pathToFileURL' || node.arguments.length !== 1) return;
    const joined = node.arguments[0];
    if (!joined || !ts.isCallExpression(joined) || !ts.isIdentifier(joined.expression) || joined.expression.text !== 'join' || joined.arguments.length !== 2) return;
    const [root, path] = joined.arguments;
    if (!root || !ts.isIdentifier(root) || !path || !ts.isStringLiteral(path) || !/^(?:[a-zA-Z0-9_-]+\/)+package\.json$/.test(path.text)) return;
    // These exact named imports establish the path/URL operation, not arbitrary calls.
    for (const [name, module] of [['join', 'node:path'], ['pathToFileURL', 'node:url']]) {
      if (!ast.statements.some(statement => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === module
        && !statement.importClause?.isTypeOnly && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
        && statement.importClause.namedBindings.elements.some(binding => !binding.isTypeOnly && !binding.propertyName && binding.name.text === name))) return;
    }
    return path.text;
  };
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
      const projectBase = packageBase(base);
      if (node.arguments.length !== 1 || !projectBase && (!base || !ts.isPropertyAccessExpression(base) || base.name.text !== 'url'
        || !ts.isMetaProperty(base.expression) || base.expression.keywordToken !== ts.SyntaxKind.ImportKeyword)) unknown('unsupported createRequire base');
      const parent = node.parent;
      if (ts.isCallExpression(parent) && parent.expression === node) { if (projectBase) unknown('escaping createRequire'); literal(parent.arguments[0]); }
      else if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name)
        && ts.isVariableDeclarationList(parent.parent) && Boolean(parent.parent.flags & ts.NodeFlags.Const)) {
        if (bindings.has(parent.name.text)) unknown('ambiguous require binding');
        bindings.set(parent.name.text, parent.name);
        bases.set(parent.name.text, projectBase);
      } else unknown('escaping createRequire');
      creatorCalls.add(node);
    }
    ts.forEachChild(node, collect);
  };
  collect(ast);
  if ([...bases.values()].some(Boolean)) {
    const check = (node: import('typescript').Node): void => {
      bounded();
      if (ts.isTypeNode(node)) return;
      if (ts.isIdentifier(node) && ['join', 'pathToFileURL', 'createRequire'].includes(node.text)) {
        const parent = node.parent;
        if ((ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) && parent.name === node) unknown('unsupported createRequire base');
      }
      ts.forEachChild(node, check);
    };
    check(ast);
  }
  if (creatorCalls.size && creators.size !== 1) unknown('unproven createRequire binding');
  const binds = (name: import('typescript').BindingName | import('typescript').Identifier | undefined, text: string): boolean => {
    if (!name) return false;
    bounded();
    if (ts.isIdentifier(name)) return name.text === text;
    return name.elements.some(element => ts.isBindingElement(element) && binds(element.name, text));
  };
  const statementBinds = (statement: import('typescript').Statement, text: string): boolean => {
    bounded();
    return ts.isVariableStatement(statement) ? statement.declarationList.declarations.some(declaration => binds(declaration.name, text))
      : (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && binds(statement.name, text);
  };
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
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require' && !bindings.has('require')) literal(node.arguments[0]);
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'vm') unknown('indirect module or vm loader');
    }
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      if (bindings.get(node.text) !== node) {
        const parent = node.parent;
        const base = bases.get(node.text);
        if (base) {
          if (!ts.isPropertyAccessExpression(parent) || parent.expression !== node || parent.name.text !== 'resolve'
            || !ts.isCallExpression(parent.parent) || parent.parent.expression !== parent || parent.parent.arguments.length !== 1) unknown('escaping require binding');
          const call = parent.parent as import('typescript').CallExpression;
          const argument = call.arguments[0]!;
          let names: string[] | undefined;
          if (ts.isStringLiteralLike(argument)) names = [argument.text];
          else if (ts.isIdentifier(argument)) {
            let scope: import('typescript').Node | undefined = call.parent;
            while (scope && !ts.isFunctionLike(scope)) {
              if (ts.isForOfStatement(scope) && ts.isVariableDeclarationList(scope.initializer) && Boolean(scope.initializer.flags & ts.NodeFlags.Const)
                && scope.initializer.declarations.length === 1 && ts.isIdentifier(scope.initializer.declarations[0]!.name)
                && scope.initializer.declarations[0]!.name.text === argument.text && ts.isArrayLiteralExpression(scope.expression)
                && scope.expression.elements.every(ts.isStringLiteralLike)) {
                names = scope.expression.elements.map(element => (element as import('typescript').StringLiteral).text); break;
              }
              // Stop at the nearest binding, even when its initializer is unsupported.
              if ((ts.isForOfStatement(scope) || ts.isForInStatement(scope) || ts.isForStatement(scope))
                && scope.initializer && ts.isVariableDeclarationList(scope.initializer)
                && scope.initializer.declarations.some(declaration => binds(declaration.name, argument.text))) break;
              if (ts.isCatchClause(scope) && binds(scope.variableDeclaration?.name, argument.text)) break;
              if (ts.isBlock(scope) && scope.statements.some(statement => statementBinds(statement, argument.text))) break;
              if (ts.isCaseBlock(scope) && scope.clauses.some(clause => clause.statements.some(statement => statementBinds(statement, argument.text)))) break;
              if ((ts.isClassExpression(scope) || ts.isClassDeclaration(scope)) && binds(scope.name, argument.text)) break;
              scope = scope.parent;
            }
          }
          if (!names) unknown('non-literal module specifier');
          for (const specifier of names!) imports.push({ specifier, base, resolveOnly: true });
        } else if (ts.isCallExpression(parent) && parent.expression === node) literal(parent.arguments[0]);
        else unknown('escaping require binding');
      }
    }
    if (ts.isIdentifier(node) && node.text === 'createRequire' && !creators.has(node)
      && !(ts.isCallExpression(node.parent) && creatorCalls.has(node.parent) && node.parent.expression === node)) unknown('indirect createRequire');
    if (ts.isIdentifier(node) && ['eval', 'Function'].includes(node.text)) unknown('eval or indirect module loader');
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'constructor') unknown('indirect constructor');
    if (ts.isIdentifier(node) && node.text === 'require' && !bindings.has('require') && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) unknown('indirect require');
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      if (ts.isStringLiteralLike(key) && ['createRequire', 'eval', 'Function', 'constructor', 'require'].includes(key.text)
        || ts.isIdentifier(node.expression) && ['globalThis', 'global', 'window', 'self', 'Reflect', 'vm'].includes(node.expression.text)) unknown('computed global or loader access');
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return imports;
}

/** Compatibility projection for callers that only inspect specifier text. */
export async function graphImportSpecifiers(source: string, file = 'module.ts', load = () => import('typescript')): Promise<string[]> {
  return [...new Set((await graphImports(source, file, load)).map(edge => edge.specifier))];
}
