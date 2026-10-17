// Syntax-only test policy. Findings are data; reporting never changes admission.
import type ts from 'typescript';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { posix, join } from 'node:path';
import type { Tier, TierEntry, TierManifest } from './suite-shards.ts';

// Most hub sessions never lint. Do not load the compiler into every daemon or CLI.
let parser: typeof ts | undefined;
const syntax = (): typeof ts => parser ??= createRequire(import.meta.url)('typescript') as typeof ts;

export type TestLintFinding = { file: string; line: number; rule: 'tier-import' | 'tier-process' | 'wall-clock-wait' | 'wall-clock-assertion' | 't3-lifecycle'; message: string };
export type TestLintFile = { file: string; tier: Tier; qualifies: Tier; findings: TestLintFinding[] };
const processHelpers = new Set(['startDaemon', 'killDaemon', 'spawnSpoke', 'fakeClaude', 'fakeCodex', 'fakeOpenCode']);
const socketHelpers = new Set(['projectHub', 'startHub', 'cland', 'clandWithEnv', 'connectUi', 'connectSocket', 'connectWsUi', 'inProcessSpoke']);
const machineModules = new Set(['child_process', 'net', 'http', 'https', 'dgram', 'timers', 'timers/promises']);
const modulePath = (file: string, path: string) => path.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), path)) : path.replace(/^node:/, '');
const nameOf = (node: ts.Node): string => syntax().isIdentifier(node) ? node.text : syntax().isPropertyAccessExpression(node) ? node.name.text : '';
const numeric = (node: ts.Node | undefined): boolean => !!node && (syntax().isNumericLiteral(node) || syntax().isPrefixUnaryExpression(node) && syntax().isNumericLiteral(node.operand));

export function lintTestSource(file: string, text: string, entry: TierEntry): TestLintFile {
  const ts = syntax();
  const virtualFile = '/' + file;
  const source = ts.createSourceFile(virtualFile, text, ts.ScriptTarget.Latest, true);
  const tier = typeof entry === 'string' ? entry : entry.tier;
  const findings: TestLintFinding[] = [];
  let minimum = 1;
  const bindings = new Map<ts.Node, { module: string; name: string }>();
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(source);
  // Use the language's lexical binder, including loop/catch/switch scopes.
  // The virtual host never resolves imports, reads disk or loads lib declarations.
  const host: ts.CompilerHost = {
    getSourceFile: path => path === virtualFile ? source : undefined,
    getDefaultLibFileName: () => '', writeFile: () => {}, getCurrentDirectory: () => '/',
    getDirectories: () => [], fileExists: path => path === virtualFile,
    readFile: path => path === virtualFile ? text : undefined,
    getCanonicalFileName: path => path, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
  };
  const checker = ts.createProgram([virtualFile], { noLib: true, noResolve: true, target: ts.ScriptTarget.Latest }, host).getTypeChecker();
  const declarationOf = (name: ts.Identifier): ts.Identifier | undefined => {
    const symbol = checker.getSymbolAtLocation(name);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    const declared = (declaration as ts.NamedDeclaration | undefined)?.name;
    return declared && ts.isIdentifier(declared) ? declared : undefined;
  };
  const requireTier = (level: number) => { minimum = Math.max(minimum, level); };
  const add = (node: ts.Node, rule: TestLintFinding['rule'], message: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if (rule.startsWith('wall-clock')) {
      const end = text.indexOf('\n', node.getEnd());
      const trailing = text.slice(node.getEnd(), end < 0 ? text.length : end);
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, trailing);
      for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if (token === ts.SyntaxKind.SingleLineCommentTrivia && /^\/\/\s*lint-allow-wall-clock:\s*\S/.test(scanner.getTokenText())) return;
      }
    }
    if (!findings.some(f => f.line === line && f.rule === rule && f.message === message)) findings.push({ file, line, rule, message });
  };
  const resource = (node: ts.Node, level: number, description: string) => {
    requireTier(level);
    if (Number(tier[1]) < level) add(node, level === 3 ? 'tier-process' : 'tier-import', `${description} requires T${level}`);
  };
  for (const node of nodes) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
    const module = modulePath(file, node.moduleSpecifier.text);
    const clause = node.importClause;
    if (clause?.name) { bindings.set(clause.name, { module, name: 'default' }); }
    const named = clause?.namedBindings;
    if (named && ts.isNamespaceImport(named)) { bindings.set(named.name, { module, name: '*' }); }
    if (named && ts.isNamedImports(named)) for (const binding of named.elements) { bindings.set(binding.name, { module, name: binding.propertyName?.text ?? binding.name.text }); }
  }
  const bindingOf = (node: ts.Node, seen = new Set<ts.Node>()): { module: string; name: string } | undefined => {
    if (seen.has(node)) return;
    seen.add(node);
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node);
      if (!declaration) return;
      const imported = bindings.get(declaration);
      if (imported) return imported;
      const parent = declaration.parent;
      if (ts.isVariableDeclaration(parent) && parent.initializer) return bindingOf(parent.initializer, seen);
      if (ts.isBindingElement(parent) && ts.isObjectBindingPattern(parent.parent) && !parent.dotDotDotToken) {
        const owner = parent.parent.parent;
        if (ts.isVariableDeclaration(owner) && owner.initializer) {
          const base = bindingOf(owner.initializer, seen);
          if (base?.name === '*' || base?.name === 'default') return { module: base.module, name: nameOf(parent.propertyName ?? parent.name) };
        }
      }
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isAwaitExpression(node)) return bindingOf(node.expression, seen);
    if (ts.isPropertyAccessExpression(node)) {
      const base = bindingOf(node.expression, seen);
      if (base?.name === '*' || base?.name === 'default') return { module: base.module, name: node.name.text };
    }
    if (ts.isCallExpression(node)) {
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require' && !declarationOf(node.expression)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) return { module: modulePath(file, node.arguments[0].text), name: '*' };
      const wrapper = bindingOf(node.expression, seen);
      if (wrapper?.module === 'util' && wrapper.name === 'promisify' && node.arguments[0]) return bindingOf(node.arguments[0], seen);
    }
  };
  const harness = (module: string) => module === 'hub/test/harness.ts';
  const inspectModule = (node: ts.Node, module: string, names: string[]) => {
    if (machineModules.has(module)) resource(node, 2, module);
    if (module === 'hub/test/process-cleanup.ts' || module === 'nvim/test/harness.ts' || module === 'nvim/test/rpc.ts' || module === 'nvim/test/stub-hub.ts') resource(node, 2, module);
    if (/^hub\/test\/fakes\/(?:claude-code|codex|opencode)(?:\/|$|\.)/.test(module)) resource(node, 3, 'fake harness binary');
    if (harness(module)) for (const name of names) {
      if (processHelpers.has(name)) resource(node, 3, name);
      else if (socketHelpers.has(name)) resource(node, 2, name);
    }
  };
  for (const node of nodes) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
      const named = node.importClause?.namedBindings;
      inspectModule(node, modulePath(file, node.moduleSpecifier.text), named && ts.isNamedImports(named) ? named.elements.map(n => n.propertyName?.text ?? n.name.text) : named ? ['*'] : []);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || nameOf(node.expression) === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) inspectModule(node, modulePath(file, node.arguments[0].text), ['*']);
  }
  const fakeReceivers = new Set<ts.Identifier>();
  for (const node of nodes) if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isNewExpression(node.initializer) && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const)) {
    const binding = bindingOf(node.initializer.expression);
    if (binding?.module === 'hub/test/fake-clock.ts' && binding.name === 'FakeClock') fakeReceivers.add(node.name);
  }
  const mocked = (node: ts.Node) => {
    let scope: ts.Node = node;
    while (scope.parent && !ts.isFunctionLike(scope)) scope = scope.parent;
    return nodes.some(n => n.getStart(source) >= scope.getStart(source) && n.getEnd() <= scope.getEnd() && ts.isCallExpression(n) && /\.mock\.timers\.enable$/.test(n.expression.getText(source)));
  };
  const fakeTimer = (node: ts.CallExpression) => {
    if (ts.isPropertyAccessExpression(node.expression)) {
      if (ts.isIdentifier(node.expression.expression)) {
        const receiver = declarationOf(node.expression.expression);
        if (receiver && fakeReceivers.has(receiver)) return true;
      }
      const receiver = bindingOf(node.expression.expression);
      return receiver?.module === 'hub/src/hub/clock.ts' && receiver.name === 'realClock' && mocked(node);
    }
    const binding = bindingOf(node.expression);
    return ts.isIdentifier(node.expression) && (!binding || binding.module === 'timers' || binding.module === 'timers/promises') && mocked(node);
  };
  const timestamps = new Set<ts.Identifier>(), deltas = new Set<ts.Identifier>();
  const known = (set: Set<ts.Identifier>, node: ts.Node) => { const declaration = ts.isIdentifier(node) ? declarationOf(node) : undefined; return declaration !== undefined && set.has(declaration); };
  const contains = (node: ts.Node, check: (n: ts.Node) => boolean): boolean => check(node) || !!ts.forEachChild(node, n => contains(n, check) || undefined);
  const now = (node: ts.Node) => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'now' && ['Date', 'performance'].includes(node.expression.expression.getText(source));
  const timestamp = (node: ts.Node) => contains(node, n => now(n) || known(timestamps, n));
  const delta = (node: ts.Node) => contains(node, n => known(deltas, n) || ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.MinusToken && timestamp(n));
  // Fixed point handles aliases and declarations in nested callbacks without executing code.
  for (let changed = true; changed;) {
    changed = false;
    for (const node of nodes) if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const set = delta(node.initializer) ? deltas : timestamp(node.initializer) ? timestamps : null;
      if (set && !set.has(node.name)) { set.add(node.name); changed = true; }
    }
  }
  const explicitStub = (node: ts.Node, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node)?.parent;
      return !!declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const) && !!declaration.initializer && explicitStub(declaration.initializer, seen);
    }
    if (ts.isStringLiteralLike(node)) return /(?:^|[\/\s])stub-hub(?:\.ts)?(?:$|[\s'"`])/.test(node.text);
    return !!ts.forEachChild(node, child => explicitStub(child, seen) || undefined);
  };
  const stubEnvironment = (node: ts.Node | undefined, seen = new Set<ts.Node>()): boolean => {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node)?.parent;
      return !!declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const) && stubEnvironment(declaration.initializer, seen);
    }
    if (!ts.isObjectLiteralExpression(node) || node.properties.some(ts.isSpreadAssignment)) return false;
    const command = node.properties.findLast(property => ts.isPropertyAssignment(property) && nameOf(property.name) === 'CLAND_COMMAND');
    return !!command && ts.isPropertyAssignment(command) && explicitStub(command.initializer);
  };
  const sharedLockPath = (node: ts.Node | undefined, seen = new Set<ts.Node>()): boolean => {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (ts.isStringLiteralLike(node)) return /^\/tmp\/cland-suite(?:-nvim)?\.lock$/.test(node.text);
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node)?.parent;
      return !!declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const) && sharedLockPath(declaration.initializer, seen);
    }
    return false;
  };
  const cliEntry = (node: ts.Node | undefined, seen = new Set<ts.Node>()): boolean => {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (ts.isStringLiteralLike(node)) return /(?:^|\/)hub\/bin\/cland\.ts$/.test(node.text);
    if (ts.isIdentifier(node)) {
      const binding = bindingOf(node);
      if (binding && harness(binding.module) && binding.name === 'CLI_ENTRY') return true;
      const declaration = declarationOf(node)?.parent;
      return !!declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const) && cliEntry(declaration.initializer, seen);
    }
    // The test-local CLI constant normally uses this exact URL construction.
    return ts.isCallExpression(node) && nameOf(node.expression) === 'fileURLToPath' && !!node.arguments[0] && ts.isNewExpression(node.arguments[0]) && nameOf(node.arguments[0].expression) === 'URL' && !!node.arguments[0].arguments?.[0] && ts.isStringLiteralLike(node.arguments[0].arguments[0]) && /^(?:\.\.\/)+(?:hub\/)?bin\/cland\.ts$/.test(node.arguments[0].arguments[0].text);
  };
  const cliCall = (node: ts.CallExpression): boolean => {
    const executable = node.arguments[0], args = node.arguments[1];
    return !!executable && (executable.getText(source) === 'process.execPath' || ts.isStringLiteralLike(executable) && executable.text === 'node') && !!args && ts.isArrayLiteralExpression(args) && cliEntry(args.elements[0]);
  };
  for (const node of nodes) if (ts.isCallExpression(node)) {
    const b = bindingOf(node.expression);
    const name = b?.name ?? nameOf(node.expression);
    if (b && ['fs', 'fs/promises'].includes(b.module) && sharedLockPath(node.arguments[0])) resource(node, 2, 'shared suite lock');
    if ((!b || harness(b.module)) && processHelpers.has(name)) resource(node, 3, name);
    if ((!b || harness(b.module)) && socketHelpers.has(name)) resource(node, 2, name);
    if (b?.module === 'nvim/test/harness.ts' && name === 'startClient' && !stubEnvironment(node.arguments[3])) resource(node, 3, 'Neovim without an explicit stub hub command');
    if (name === 'listen') resource(node, 2, 'socket listen');
    if (['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync'].includes(name) && (b?.module === 'child_process' || !b && ts.isIdentifier(node.expression))) {
      const localHelper = !b && ts.isIdentifier(node.expression) && !!declarationOf(node.expression);
      resource(node, localHelper || cliCall(node) ? 2 : 3, 'child process');
      if (node.arguments.some(arg => contains(arg, n => ts.isStringLiteralLike(n) && (/^(?:hub|startDaemon)$/.test(n.text) || /(?:hub\/bin\/cland|hub\/src\/hub\/daemon|fakes\/(?:codex|claude-code|opencode))/.test(n.text))))) resource(node, 3, 'spawned hub or harness binary');
    }
    if (['sleep', 'pause', 'delay', 'setTimeout', 'setInterval'].includes(name) && !fakeTimer(node)) {
      requireTier(2);
      const duration = name.startsWith('set') && b?.module !== 'timers/promises' ? node.arguments[1] : node.arguments[0];
      if (numeric(duration) && name !== 'setInterval') add(node, 'wall-clock-wait', `${name} uses a numeric wall-clock wait`);
    }
    const assertion = ts.isIdentifier(node.expression) ? name === 'assert' || b?.module === 'assert/strict' || b?.module === 'assert'
      : ts.isPropertyAccessExpression(node.expression) && (node.expression.expression.getText(source) === 'assert' || ['assert', 'assert/strict'].includes(bindingOf(node.expression.expression)?.module ?? ''));
    if (assertion && node.arguments.some(delta)) add(node, 'wall-clock-assertion', 'assertion depends on an elapsed wall-clock difference');
  }
  if (tier === 'T3' && typeof entry === 'string') {
    const leading = ts.getLeadingCommentRanges(text, 0) ?? [];
    let end = leading[0]?.end ?? 0;
    for (const comment of leading.slice(1)) {
      if (/\n\s*\n/.test(text.slice(end, comment.pos))) break;
      end = comment.end;
    }
    const header = text.slice(leading[0]?.pos ?? 0, end);
    if (!/\bT3:\s*[^\s*/][^\n]*/.test(header)) add(source, 't3-lifecycle', 'first comment block must name the process behaviour: T3: <behaviour>');
  }
  return { file, tier, qualifies: `T${minimum}` as Tier, findings: findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule)) };
}

/** Hermetic admission uses the same import/call analysis as the tier report. */
export function touchesMachineResources(file: string, text: string): boolean {
  return lintTestSource(file, text, 'T1').qualifies !== 'T1';
}

export async function lintTests(cwd: string): Promise<TestLintFile[]> {
  let manifest: TierManifest;
  try { manifest = JSON.parse(await readFile(join(cwd, 'hub/test/tiers.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  return Promise.all(Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b)).map(async ([file, entry]) => lintTestSource(file, await readFile(join(cwd, file), 'utf8'), entry)));
}

export function testLintReport(files: TestLintFile[]): string[] {
  const findings = files.flatMap(file => file.findings);
  return [`test lint (report only): ${findings.length} findings in ${files.filter(f => f.findings.length).length} files`,
    ...findings.slice(0, 12).map(f => `test lint finding: ${f.file}:${f.line} [${f.rule}] ${f.message}`),
    ...files.map(f => `test lint tier: ${f.file}: ${f.tier}; qualifies ${f.qualifies}`)];
}
