import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { PATH_EXCEPTIONS } from './state-paths-inventory.ts';

function darwinCondition(node: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(node)) return darwinCondition(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return darwinCondition(node.left) || darwinCondition(node.right);
  return /^process\.platform\s*===\s*['"]darwin['"]$/.test(node.getText());
}
function darwinGuard(node: ts.Node): boolean {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.right === child && darwinCondition(parent.left)) return true;
    const condition = ts.isIfStatement(parent) ? parent.expression : ts.isConditionalExpression(parent) ? parent.condition : undefined;
    if (condition && (ts.isIfStatement(parent) && parent.thenStatement === child || ts.isConditionalExpression(parent) && parent.whenTrue === child)
      && darwinCondition(condition)) return true;
  }
  return false;
}
const exception = (file: string, expression: string, context: string) =>
  PATH_EXCEPTIONS.some(entry => entry.file === file && entry.expression === expression && entry.context === context);
const macCommand = (value: string) => /^(?:\S*\/)?(?:open|caffeinate)(?:\s|$)/.test(value);
const nativeNames = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync'];
function scope(node: ts.Node): ts.Node {
  while (node.parent && !ts.isBlock(node) && !ts.isSourceFile(node)) node = node.parent;
  return node;
}

export function statePathFindings(file: string, source: string): string[] {
  if (file === 'state-paths.ts') return [];
  if (file.endsWith('.sh')) return source.split('\n').flatMap((line, index) => {
    const code = line.trim();
    const path = /(?:\/tmp(?:\/|\b)|\$(?:HOME\b|\{HOME\})|(?:^|[\s="'])~\/|Library(?:\/|["']))/.test(code);
    const command = /(?:^|[;&|]\s*)(?:open|caffeinate)(?:\s|$)/.test(code);
    if (code.startsWith('#') || !path && !command) return [];
    return exception(file, code, 'shell line') ? [] : [`${file}:${index + 1}: unregistered shell runtime path/command: ${code}`];
  });
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings = new Set<string>();
  const resolvers = new Set(['homedir', 'tmpdir']);
  const launchers = new Set(nativeNames);
  const namespaces = new Set<string>();
  const declarations = new Map<ts.Node, Map<string, ts.Expression>>();
  const index = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        if (/^(node:)?os$/.test(module) && ['homedir', 'tmpdir'].includes(imported)) resolvers.add(element.name.text);
        if (/^(node:)?child_process$/.test(module) && nativeNames.includes(imported)) launchers.add(element.name.text);
      }
      if (/^(node:)?child_process$/.test(module)) {
        if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
        if (node.importClause?.name) namespaces.add(node.importClause.name.text);
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const owner = scope(node);
      let names = declarations.get(owner);
      if (!names) { names = new Map(); declarations.set(owner, names); }
      names.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, index);
  };
  index(ast);
  const report = (node: ts.Node, reason: string) => {
    if (exception(file, node.getText(ast), node.parent.getText(ast))) return;
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    findings.add(`${file}:${line}: ${reason}: ${node.getText(ast)}`);
  };
  const lookup = (name: string, node: ts.Node): ts.Expression | undefined => {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
      const value = declarations.get(current)?.get(name);
      if (value) return value;
    }
    return undefined;
  };
  // Follow command constants at the use site, preserving guards on either the
  // native call or a platform-selected initializer. Cycles remain bounded.
  const command = (node: ts.Expression, use: ts.CallExpression, seen = new Set<ts.Node>()) => {
    if (seen.has(node)) return;
    seen.add(node);
    if (ts.isStringLiteralLike(node)) {
      if (macCommand(node.text) && !darwinGuard(node) && !darwinGuard(use)) report(use, 'unguarded macOS command');
    } else if (ts.isIdentifier(node)) {
      const value = lookup(node.text, node);
      if (value) command(value, use, seen);
    } else if (ts.isParenthesizedExpression(node)) command(node.expression, use, seen);
    else if (ts.isConditionalExpression(node)) { command(node.whenTrue, use, seen); command(node.whenFalse, use, seen); }
    else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) command(node.left, use, seen);
  };
  const isLauncher = (expression: ts.Expression) => ts.isIdentifier(expression) ? launchers.has(expression.text)
    : ts.isPropertyAccessExpression(expression) && namespaces.has(expression.expression.getText(ast)) && nativeNames.includes(expression.name.text);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (resolvers.has(node.expression.getText(ast)) || /\.(?:homedir|tmpdir)$/.test(node.expression.getText(ast))) report(node, 'home/temp resolver');
      if (isLauncher(node.expression) && node.arguments[0]) command(node.arguments[0], node);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'HOME'
      || ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'HOME'
      || ts.isBindingElement(node) && (node.propertyName ?? node.name).getText(ast) === 'HOME') report(node, 'HOME access');
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (/\/tmp(?:\/|$)/.test(node.text)) report(node, 'temporary path');
      if (/(?:^|\/)Library(?:\/|$)/.test(node.text) && !darwinGuard(node)) report(node, 'unguarded macOS path');
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...findings];
}
export async function scanStatePaths(root: URL, prefix = ''): Promise<string[]> {
  const findings: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), root);
    if (entry.isDirectory()) findings.push(...await scanStatePaths(path, prefix + entry.name + '/'));
    else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.sh')) && !entry.name.endsWith('.test.ts')) findings.push(...statePathFindings(prefix + entry.name, await readFile(path, 'utf8')));
  }
  return findings;
}
