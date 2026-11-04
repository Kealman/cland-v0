import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';

/** Native implementation edges, not session orchestration. Keep reasons reviewable. */
export const hostBoundaryExceptions = {
  'processes.ts': 'Native local liveness/birth helpers used by the local Host.',
  'session-cwd.ts': 'Native directory identity/refusal implementation used by the local Host.',
  'claude-code-local.ts': 'Standalone local Host compatibility, including synthetic legacy fixtures.',
};
const helpers = new Set(['pidAlive', 'processAlive', 'sameProcess', 'endProcess', 'processIdentityAsync', 'systemProcesses', 'sessionCwdRefusal']);
const metadata = new Set(['stat', 'lstat', 'realpath', 'statSync', 'lstatSync', 'realpathSync', 'writeFile', 'mkdir', 'rm', 'chmod']);
const nativeModule = (name: string) => name.replace(/^node:/, '');

export function hostBoundaryFindings(file: string, source: string): string[] {
  if (/\.test\.[cm]?[jt]sx?$/.test(file) || Object.hasOwn(hostBoundaryExceptions, file)) return [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const helperNamespaces = new Set<string>();
  const fsBindings = new Map<string, string>();
  const fsNamespaces = new Set<string>(['fs']);
  const report = (node: ts.Node, use: string) => {
    findings.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}: ${use} bypasses Host`);
  };
  const text = (node: ts.Node) => node.getText(tree).replace(/\s+/g, '');
  const crashSelfKill = (node: ts.CallExpression) => {
    if (file !== 'sessions.ts' || text(node) !== "process.kill(process.pid,'SIGKILL')") return false;
    let parent: ts.Node = node.parent;
    if (!ts.isExpressionStatement(parent)) return false;
    if (ts.isBlock(parent.parent) && parent.parent.statements.length === 1) parent = parent.parent;
    if (!ts.isIfStatement(parent.parent) || parent.parent.thenStatement !== parent) return false;
    return ["this.#env.CLAND_TEST_CRASH_AT==='launch-reserved'", "this.#env.CLAND_TEST_CRASH_AT==='stop-recorded'"].includes(text(parent.parent.expression));
  };
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const module = nativeModule(node.moduleSpecifier.text);
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    if (clause?.name) helperNamespaces.add(clause.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) helperNamespaces.add(bindings.name.text);
    const named = bindings && ts.isNamedImports(bindings) ? bindings.elements.filter(x => !x.isTypeOnly) : [];
    const hasValue = !clause || !!clause.name || !!(bindings && ts.isNamespaceImport(bindings)) || named.length > 0;
    if (module === 'child_process' && hasValue) report(node, 'child_process value import');
    for (const binding of named) {
      const name = (binding.propertyName ?? binding.name).text;
      if (module === 'fs' && name === 'promises') fsNamespaces.add(binding.name.text);
      if (helpers.has(name)) report(binding, `${name} import`);
      if ((module === 'fs' || module === 'fs/promises') && metadata.has(name)) {
        fsBindings.set(binding.name.text, name);
        report(binding, `${name} import`);
      }
    }
    if (module === 'fs' || module === 'fs/promises') {
      if (clause?.name) fsNamespaces.add(clause.name.text);
      if (bindings && ts.isNamespaceImport(bindings)) fsNamespaces.add(bindings.name.text);
    }
  }
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (text(node.expression) === 'process.kill' || text(node.expression) === 'process["kill"]' || text(node.expression) === "process['kill']") {
        if (!crashSelfKill(node)) report(node, 'process.kill');
      }
      if (ts.isIdentifier(node.expression) && fsBindings.has(node.expression.text)) report(node, `${fsBindings.get(node.expression.text)} call`);
      // Dynamic/require native imports cannot use the static type-only exemption.
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword || text(node.expression) === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const module = nativeModule(node.arguments[0].text);
        if (['child_process', 'fs', 'fs/promises'].includes(module)) report(node, `${module} dynamic value import`);
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const name = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : '';
      if (helperNamespaces.has(text(node.expression)) && helpers.has(name)) report(node, `${name} native helper namespace access`);
      const root = text(node.expression).replace(/\.promises$/, '');
      if (fsNamespaces.has(root) && metadata.has(name)) report(node, `fs.${name}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return findings;
}

/** Discover new adapter modules recursively; Host implementations live outside this root. */
export async function scanHostBoundary(root: URL, prefix = ''): Promise<string[]> {
  const findings: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = prefix + entry.name;
    if (entry.isDirectory()) findings.push(...await scanHostBoundary(new URL(`${entry.name}/`, root), `${file}/`));
    else if (/\.[cm]?[jt]sx?$/.test(file)) findings.push(...hostBoundaryFindings(file, await readFile(new URL(entry.name, root), 'utf8')));
  }
  return findings;
}
