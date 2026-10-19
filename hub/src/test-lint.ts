// Syntax-only test analysis; the policy module decides which findings refuse admission.
import type ts from 'typescript';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { posix, join, relative, resolve, extname } from 'node:path';
import type { Tier, TierEntry, TierManifest } from './suite-shards.ts';

// Most hub sessions never lint. Do not load the compiler into every daemon or CLI.
let parser: typeof ts | undefined;
const syntax = (): typeof ts => parser ??= createRequire(import.meta.url)('typescript') as typeof ts;

export type TestLintFinding = { file: string; line: number; rule: 'tier-import' | 'tier-process' | 'wall-clock-wait' | 'wall-clock-assertion' | 't3-lifecycle'; message: string };
export type TestLintFile = { file: string; tier: Tier; qualifies: Tier; findings: TestLintFinding[]; reachable?: { tier: Tier; resources: TestLintFinding[] } };
const processHelpers = new Set(['startDaemon', 'killDaemon', 'spawnSpoke', 'fakeClaude', 'fakeCodex', 'fakeOpenCode']);
const socketHelpers = new Set(['projectHub', 'startHub', 'cland', 'clandWithEnv', 'connectUi', 'connectSocket', 'connectWsUi', 'inProcessSpoke']);
const machineModules = new Set(['child_process', 'net', 'http', 'https', 'dgram', 'timers', 'timers/promises']);
const modulePath = (file: string, path: string) => path.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), path)) : path.replace(/^node:/, '');
const nameOf = (node: ts.Node): string => syntax().isIdentifier(node) ? node.text : syntax().isPropertyAccessExpression(node) ? node.name.text : '';
const numeric = (node: ts.Node | undefined): boolean => !!node && (syntax().isNumericLiteral(node) || syntax().isPrefixUnaryExpression(node) && syntax().isNumericLiteral(node.operand));

type Resource = { line: number; level: number; description: string };
type LocalImport = { line: number; specifier: string; name: string; fallback?: string };
type ModuleSlice = { resources: Resource[]; imports: LocalImport[] };
type ModuleAnalysis = { calls: TestLintFinding[]; lifecycle: boolean; result: TestLintFile; select: (name: string) => ModuleSlice };

function analyzeTestSource(file: string, text: string, entry: TierEntry): ModuleAnalysis {
  const ts = syntax();
  const virtualFile = '/' + file;
  const source = ts.createSourceFile(virtualFile, text, ts.ScriptTarget.Latest, true);
  const tier = typeof entry === 'string' ? entry : entry.tier;
  const findings: TestLintFinding[] = [];
  const calls: TestLintFinding[] = [];
  const findingSites = new Set<string>();
  const resources: Array<Resource & { node: ts.Node }> = [];
  const runtimeImports = new Map<ts.Node, LocalImport>();
  const runtimeCalls = new Map<ts.Node, LocalImport[]>();
  const imports: LocalImport[] = [];
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
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
  const checker = ts.createProgram([virtualFile], { noLib: true, noResolve: true, allowJs: true, target: ts.ScriptTarget.Latest }, host).getTypeChecker();
  const declarationOf = (name: ts.Identifier, valueReference = false): ts.Identifier | undefined => {
    const symbol = valueReference && ts.isShorthandPropertyAssignment(name.parent)
      ? checker.getShorthandAssignmentValueSymbol(name.parent) : checker.getSymbolAtLocation(name);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    const declared = (declaration as ts.NamedDeclaration | undefined)?.name;
    return declared && ts.isIdentifier(declared) ? declared : undefined;
  };
  const requireTier = (level: number) => { minimum = Math.max(minimum, level); };
  const add = (node: ts.Node, rule: TestLintFinding['rule'], message: string) => {
    const line = lineOf(node);
    if (rule.startsWith('wall-clock')) {
      const end = text.indexOf('\n', node.getEnd());
      const trailing = text.slice(node.getEnd(), end < 0 ? text.length : end);
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, trailing);
      for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if (token === ts.SyntaxKind.SingleLineCommentTrivia && /^\/\/\s*lint-allow-wall-clock:\s*\S/.test(scanner.getTokenText())) return;
      }
    }
    const site = `${node.pos}:${rule}:${message}`;
    if (!findingSites.has(site)) findings.push({ file, line, rule, message });
    findingSites.add(site);
  };
  const resource = (node: ts.Node, level: number, description: string) => {
    requireTier(level);
    resources.push({ node, line: lineOf(node), level, description });
    if (Number(tier[1]) < level) add(node, level === 3 ? 'tier-process' : 'tier-import', `${description} requires T${level}`);
  };
  for (const node of nodes) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
    const module = modulePath(file, node.moduleSpecifier.text);
    const specifier = node.moduleSpecifier.text;
    const clause = node.importClause;
    if (clause?.name) { bindings.set(clause.name, { module, name: 'default' }); }
    const named = clause?.namedBindings;
    if (named && ts.isNamespaceImport(named)) { bindings.set(named.name, { module, name: '*' }); }
    if (named && ts.isNamedImports(named)) for (const binding of named.elements) { bindings.set(binding.name, { module, name: binding.propertyName?.text ?? binding.name.text }); }
    const edge = (name: string, binding?: ts.Node, fallback?: string) => {
      const imported: LocalImport = { line: lineOf(node), specifier, name, ...(fallback ? { fallback } : {}) };
      imports.push(imported);
      if (binding) runtimeImports.set(binding, imported);
    };
    // Loading an imported module always executes its top-level statements.
    edge('$init');
    if (clause?.name) edge('default', clause.name);
    if (named && ts.isNamespaceImport(named)) edge('*', named.name, 'namespace import');
    if (named && ts.isNamedImports(named)) for (const binding of named.elements) if (!binding.isTypeOnly) edge(binding.propertyName?.text ?? binding.name.text, binding.name);
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
    // Declaration-only types disappear under Node's type stripping. Inline type
    // specifiers still execute their module, as do side-effect imports/re-exports.
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require' && !declarationOf(node.expression))) {
      const specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const base = { line: lineOf(node), specifier: specifier.text };
        const edges: LocalImport[] = [{ ...base, name: '$init' }];
        let expression: ts.Node = node;
        if (ts.isAwaitExpression(expression.parent)) expression = expression.parent;
        const declaration = expression.parent;
        if (ts.isVariableDeclaration(declaration) && ts.isObjectBindingPattern(declaration.name)) {
          for (const binding of declaration.name.elements) if (ts.isIdentifier(binding.name)) {
            const imported: LocalImport = binding.dotDotDotToken
              ? { ...base, name: '*', fallback: 'namespace rest import' }
              : { ...base, name: nameOf(binding.propertyName ?? binding.name) };
            edges.push(imported); runtimeImports.set(binding.name, imported);
          }
        } else edges.push({ ...base, name: '*', fallback: 'dynamic/require namespace import' });
        // Unlike static imports, these edges execute only at the reached call.
        runtimeCalls.set(node, edges);
      }
    }
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
  const socketOptions = (node: ts.Node | undefined, seen = new Set<ts.Node>()): boolean => {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node)?.parent;
      return !!declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const) && socketOptions(declaration.initializer, seen);
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return socketOptions(node.expression, seen);
    return ts.isObjectLiteralExpression(node) && node.properties.some(property => {
      if (ts.isSpreadAssignment(property)) return socketOptions(property.expression, seen);
      const name = property.name && (ts.isStringLiteralLike(property.name) ? property.name.text : nameOf(property.name));
      return name === 'port' || name === 'server';
    });
  };
  for (const node of nodes) if (ts.isNewExpression(node)) {
    const binding = bindingOf(node.expression);
    const wsServer = binding?.module === 'ws' && ['WebSocketServer', 'Server'].includes(binding.name)
      || !binding && ts.isIdentifier(node.expression) && node.expression.text === 'WebSocketServer' && !declarationOf(node.expression);
    if (wsServer && socketOptions(node.arguments?.[0])) resource(node, 2, 'socket server');
  }
  for (const node of nodes) if (ts.isCallExpression(node)) {
    const b = bindingOf(node.expression);
    const name = b?.name ?? nameOf(node.expression);
    if (b && ['fs', 'fs/promises'].includes(b.module) && sharedLockPath(node.arguments[0])) resource(node, 2, 'shared suite lock');
    if ((!b || harness(b.module)) && processHelpers.has(name)) {
      resource(node, 3, name);
      if (name !== 'killDaemon') calls.push({ file, line: lineOf(node), rule: 'tier-process', message: name });
    }
    if ((!b || harness(b.module)) && socketHelpers.has(name)) resource(node, 2, name);
    if (b?.module === 'nvim/test/harness.ts' && name === 'startClient' && !stubEnvironment(node.arguments[3])) resource(node, 3, 'Neovim without an explicit stub hub command');
    if (name === 'listen') resource(node, 2, 'socket listen');
    if (['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync'].includes(name) && (b?.module === 'child_process' || !b && ts.isIdentifier(node.expression))) {
      const localHelper = !b && ts.isIdentifier(node.expression) && !!declarationOf(node.expression);
      resource(node, localHelper || cliCall(node) ? 2 : 3, 'child process');
      if (node.arguments.some(arg => contains(arg, n => ts.isStringLiteralLike(n) && (/^(?:hub|startDaemon)$/.test(n.text) || /(?:hub\/bin\/cland|hub\/src\/hub\/daemon|fakes\/(?:codex|claude-code|opencode))/.test(n.text))))) resource(node, 3, 'spawned hub or harness binary');
    }
    // Prompter.pause(message) reads a line, rather than waiting on a clock. Keep
    // bare/helper pauses and numeric method pauses in the timer census.
    const timerPause = name === 'pause' && (ts.isIdentifier(node.expression) || b && harness(b.module) || numeric(node.arguments[0]));
    if ((timerPause || ['sleep', 'delay', 'setTimeout', 'setInterval'].includes(name)) && !fakeTimer(node)) {
      requireTier(2);
      // A reason suppresses the wait policy finding, never the resource tier.
      resources.push({ node, line: lineOf(node), level: 2, description: 'wall-clock timer' });
      const duration = name.startsWith('set') && b?.module !== 'timers/promises' ? node.arguments[1] : node.arguments[0];
      if (numeric(duration) && name !== 'setInterval') add(node, 'wall-clock-wait', `${name} uses a numeric wall-clock wait`);
    }
    const assertion = ts.isIdentifier(node.expression) ? name === 'assert' || b?.module === 'assert/strict' || b?.module === 'assert'
      : ts.isPropertyAccessExpression(node.expression) && (node.expression.expression.getText(source) === 'assert' || ['assert', 'assert/strict'].includes(bindingOf(node.expression.expression)?.module ?? ''));
    if (assertion && node.arguments.some(delta)) add(node, 'wall-clock-assertion', 'assertion depends on an elapsed wall-clock difference');
  }
  let lifecycle = typeof entry !== 'string' && !!('contract' in entry ? entry.contract : entry.scenario);
  {
    const leading = ts.getLeadingCommentRanges(text, 0) ?? [];
    let end = leading[0]?.end ?? 0;
    for (const comment of leading.slice(1)) {
      if (/\n\s*\n/.test(text.slice(end, comment.pos))) break;
      end = comment.end;
    }
    const header = text.slice(leading[0]?.pos ?? 0, end);
    lifecycle ||= /\bT3:\s*[^\s*/][^\n]*/.test(header);
    lifecycle ||= tier === 'T4' && /\bT4:\s*[^\s*/][^\n]*/.test(header);
    if (tier === 'T3' && !lifecycle) findings.push({ file, line: 1, rule: 't3-lifecycle', message: 'first comment block must name the process behaviour: T3: <behaviour>' });
  }
  const exported = new Map<string, ts.Node>();
  const reexports = new Map<string, LocalImport>();
  const stars: LocalImport[] = [];
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
        const names = (binding: ts.BindingName) => {
          if (ts.isIdentifier(binding)) exported.set(binding.text, declaration);
          else for (const element of binding.elements) if (ts.isBindingElement(element)) names(element.name);
        };
        names(declaration.name);
      }
      else {
        const name = (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) ? statement.name : undefined;
        if (name && ts.isIdentifier(name)) exported.set(name.text, statement);
        if (modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) exported.set('default', statement);
      }
    }
    if (ts.isExportAssignment(statement)) exported.set('default', statement.expression);
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const specifier = statement.moduleSpecifier;
      if (specifier && ts.isStringLiteralLike(specifier)) {
        imports.push({ line: lineOf(statement), specifier: specifier.text, name: '$init' });
        if (!statement.exportClause) stars.push({ line: lineOf(statement), specifier: specifier.text, name: '*', fallback: 'export * re-export' });
        else if (ts.isNamedExports(statement.exportClause)) for (const binding of statement.exportClause.elements) {
          if (!binding.isTypeOnly) reexports.set(binding.name.text, { line: lineOf(statement), specifier: specifier.text, name: binding.propertyName?.text ?? binding.name.text });
        }
        else reexports.set(statement.exportClause.name.text, { line: lineOf(statement), specifier: specifier.text, name: '*', fallback: 'namespace re-export' });
      } else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const binding of statement.exportClause.elements) {
        const symbol = checker.getExportSpecifierLocalTargetSymbol(binding);
        const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
        if (!binding.isTypeOnly && declaration) exported.set(binding.name.text, declaration);
      }
    }
  }
  const slices = new Map<string, ModuleSlice>();
  const select = (name: string): ModuleSlice => {
    const cached = slices.get(name);
    if (cached) return cached;
    const reached = new Set<ts.Node>();
    const initialized = new Set<ts.Node>();
    const edges: LocalImport[] = [];
    const walk = (node: ts.Node, executeOnly = false) => {
      if (executeOnly && ts.isIfStatement(node) && ts.isBinaryExpression(node.expression)) {
        const { left, right, operatorToken } = node.expression;
        const mainPath = (value: ts.Node) => ts.isCallExpression(value) && bindingOf(value.expression)?.module === 'url'
          && bindingOf(value.expression)?.name === 'fileURLToPath' && value.arguments[0]?.getText(source) === 'import.meta.url';
        const argv = (value: ts.Node) => ts.isElementAccessExpression(value) && value.expression.getText(source) === 'process.argv' && value.argumentExpression.getText(source) === '1';
        if ((argv(left) && mainPath(right) || argv(right) && mainPath(left)) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(operatorToken.kind)) {
          if (node.elseStatement) walk(node.elseStatement, true);
          return; // A module's CLI entry branch is not executed when imported.
        }
      }
      if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent) && node.parent.token === ts.SyntaxKind.ExtendsKeyword) {
        walk(node.expression, executeOnly); return;
      }
      const visited = executeOnly ? initialized : reached;
      if (visited.has(node) || ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      // Module loading creates functions without running their bodies. Classes
      // do execute static initializers/blocks and computed member names.
      if (executeOnly && ts.isFunctionLike(node)) {
        let expression: ts.Node = node;
        while (ts.isParenthesizedExpression(expression.parent) || ts.isAsExpression(expression.parent) || ts.isNonNullExpression(expression.parent)) expression = expression.parent;
        const call = expression.parent;
        if (ts.isCallExpression(call) || ts.isNewExpression(call)) {
          const wrapper = bindingOf(call.expression);
          if (wrapper?.module !== 'util' || wrapper.name !== 'promisify') walk(node);
        }
        return;
      }
      if (executeOnly && ts.isClassLike(node)) {
        visited.add(node);
        for (const clause of node.heritageClauses ?? []) if (clause.token === ts.SyntaxKind.ExtendsKeyword) for (const type of clause.types) walk(type.expression, true);
        for (const member of node.members) {
          if (member.name && ts.isComputedPropertyName(member.name)) walk(member.name.expression, true);
          if (ts.isClassStaticBlockDeclaration(member)) walk(member.body, true);
          if (ts.isPropertyDeclaration(member) && ts.getModifiers(member)?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) && member.initializer) walk(member.initializer, true);
        }
        return;
      }
      visited.add(node);
      const dynamic = runtimeCalls.get(node);
      if (dynamic) edges.push(...dynamic.filter(edge => !executeOnly || edge.name === '$init'));
      if (ts.isIdentifier(node)) {
        // Property names and declaration names are not lexical value reads.
        const parent = node.parent;
        const property = ts.isPropertyAccessExpression(parent) && parent.name === node
          || (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node;
        if (!property) {
          const declaration = declarationOf(node, true);
          const imported = declaration && runtimeImports.get(declaration);
          let expression: ts.Node = node;
          while (ts.isPropertyAccessExpression(expression.parent) && expression.parent.expression === expression) expression = expression.parent;
          const bound = ts.isPropertyAccessExpression(expression) && expression.name.text === 'bind';
          const parentCall = ts.isCallExpression(expression.parent) ? expression.parent : undefined;
          const wrapper = parentCall && bindingOf(parentCall.expression);
          const wrapped = wrapper?.module === 'util' && wrapper.name === 'promisify' && parentCall?.arguments.includes(expression as ts.Expression);
          const invoked = !executeOnly || !bound && !wrapped && (parentCall !== undefined || ts.isNewExpression(expression.parent));
          if (imported && invoked) edges.push(imported);
          else if (declaration && declaration !== node) {
            const owner = declaration.parent;
            if (ts.isVariableDeclaration(owner) && owner.initializer) walk(owner.initializer, executeOnly && !invoked);
            else if (invoked && (ts.isFunctionDeclaration(owner) || ts.isClassDeclaration(owner))) walk(owner);
            else if (ts.isBindingElement(owner)) {
              const binding = owner.parent.parent;
              if (ts.isVariableDeclaration(binding) && binding.initializer) walk(binding.initializer, executeOnly && !invoked);
            }
          }
        }
      }
      ts.forEachChild(node, child => walk(child, executeOnly));
    };
    if (name === '*') {
      walk(source);
      edges.push(...imports, ...reexports.values(), ...stars);
    } else if (name === '$init') {
      for (const statement of source.statements) walk(statement, true);
      edges.push(...imports.filter(edge => edge.name === '$init'));
    } else {
      const declaration = exported.get(name);
      if (declaration) walk(declaration);
      const reexport = reexports.get(name);
      if (reexport) edges.push(reexport);
      if (!declaration && !reexport) edges.push(...stars);
    }
    const selected = name === '*' ? [...resources] : resources.filter(resource => reached.has(resource.node) || initialized.has(resource.node));
    // A named external binding retains the existing import policy. A local
    // binding is charged by its selected declaration in the dependency instead.
    for (const edge of edges) if (edge.name !== '$init' && !edge.specifier.startsWith('.') && machineModules.has(edge.specifier.replace(/^node:/, ''))) {
      selected.push({ node: source, line: edge.line, level: 2, description: edge.specifier.replace(/^node:/, '') });
    }
    const unique = new Map(selected.map(({ node: _node, ...resource }) => [`${resource.level}:${resource.description}`, resource]));
    const result = { resources: [...unique.values()], imports: edges.filter(edge => edge.specifier.startsWith('.')) };
    slices.set(name, result);
    return result;
  };
  return { calls, lifecycle, result: { file, tier, qualifies: `T${minimum}` as Tier, findings: findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule)) }, select };
}

/** Analyze one source without reading its imports; lintTests adds the local graph. */
export function lintTestSource(file: string, text: string, entry: TierEntry): TestLintFile {
  return testLintFacts(file, text, entry).result;
}

type DirectFacts = Pick<ModuleAnalysis, 'result' | 'calls' | 'lifecycle'>;
// Keep compact facts, never compiler programs/ASTs. Digests cover dirty sources
// as well as immutable blobs; path and tier entry affect the findings too.
const directFacts = new Map<string, DirectFacts>();
const DIRECT_FACT_LIMIT = 1024;
/** Direct policy facts share the lexical binding analysis used by the report. */
export function testLintFacts(file: string, text: string, entry: TierEntry): DirectFacts {
  const key = JSON.stringify([file, entry, createHash('sha256').update(text).digest('hex')]);
  const cached = directFacts.get(key);
  if (cached) {
    directFacts.delete(key); directFacts.set(key, cached);
    return structuredClone(cached);
  }
  const { result, calls, lifecycle } = analyzeTestSource(file, text, entry);
  const facts = { result, calls, lifecycle };
  directFacts.set(key, facts);
  if (directFacts.size > DIRECT_FACT_LIMIT) directFacts.delete(directFacts.keys().next().value!);
  return structuredClone(facts);
}

/** Hermetic admission uses the same import/call analysis as the tier report. */
export function touchesMachineResources(file: string, text: string): boolean {
  return lintTestSource(file, text, 'T1').qualifies !== 'T1';
}

export async function lintTests(cwd: string, options: { reachable?: boolean } = {}): Promise<TestLintFile[]> {
  let manifest: TierManifest;
  try { manifest = JSON.parse(await readFile(join(cwd, 'hub/test/tiers.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const root = await realpath(cwd);
  if (options.reachable === false) return Promise.all(Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b))
    .map(async ([file, entry]) => lintTestSource(file, await readFile(join(root, file), 'utf8'), entry)));
  // Cache syntax/binding analysis per module and slices per requested export.
  // Cache direct edges, not partial closures: cycles retain all resource evidence.
  const modules = new Map<string, Promise<ModuleAnalysis>>();
  const load = (file: string) => {
    let pending = modules.get(file);
    if (!pending) {
      pending = readFile(join(root, file), 'utf8').then(text => {
        try { return analyzeTestSource(file, text, manifest.tests[file] ?? 'T1'); }
        catch (error) { throw new Error(`test lint could not analyze ${file}`, { cause: error }); }
      });
      modules.set(file, pending);
    }
    return pending;
  };
  const resolutions = new Map<string, Promise<string | undefined>>();
  const localModule = (file: string, specifier: string) => {
    const path = modulePath(file, specifier);
    let pending = resolutions.get(path);
    if (!pending) {
      pending = (async () => {
        const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
        const candidates = extname(path) ? extensions.includes(extname(path)) ? [path] : []
          : extensions.map(extension => path + extension).concat(extensions.map(extension => posix.join(path, 'index' + extension)));
        for (const candidate of candidates) {
          if (candidate === '..' || candidate.startsWith('../') || posix.isAbsolute(candidate)) continue;
          try {
            const canonical = relative(root, await realpath(resolve(root, candidate)));
            if (canonical === '..' || canonical.startsWith('../') || canonical.startsWith('..\\')) continue;
            return canonical.split('\\').join('/');
          } catch (error) {
            if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
          }
        }
      })();
      resolutions.set(path, pending);
    }
    return pending;
  };
  return Promise.all(Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b)).map(async ([file]) => {
    const own = await load(file);
    const reachable = { tier: own.result.qualifies, resources: [] as TestLintFinding[] };
    const result: TestLintFile = { ...own.result, reachable };
    const seen = new Set([`${file}:*:false`]);
    const reported = new Set<string>();
    const queue = [{ file, name: '*', chain: [file], line: 0, fallbacks: [] as string[], initialization: false }];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      const analysis = (await load(current.file)).select(current.name);
      for (const resource of analysis.resources) {
        if (Number(reachable.tier[1]) < resource.level) reachable.tier = `T${resource.level}` as Tier;
        const key = `${current.file}:${resource.line}:${resource.level}:${resource.description}:${current.initialization}`;
        if (!reported.has(key)) reachable.resources.push({
          file, line: current.line || resource.line, rule: resource.level === 3 ? 'tier-process' : 'tier-import',
          message: `via ${current.chain.join(' -> ')}:${resource.line} [${current.name}${current.initialization ? '; module initialization' : ''}${current.fallbacks.length ? `; whole-module fallback: ${current.fallbacks.join(', ')}` : ''}]: ${resource.description} requires T${resource.level}`,
        });
        reported.add(key);
      }
      for (const edge of analysis.imports) {
        const dependency = await localModule(current.file, edge.specifier);
        const initialization = current.initialization || edge.name === '$init';
        const key = `${dependency}:${edge.name}:${initialization}`;
        if (!dependency || seen.has(key)) continue;
        seen.add(key);
        queue.push({ file: dependency, name: edge.name, chain: [...current.chain, dependency], line: current.line || edge.line, fallbacks: edge.fallback ? [...current.fallbacks, edge.fallback] : current.fallbacks, initialization });
      }
    }
    reachable.resources.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
    return result;
  }));
}

export function testLintReport(files: TestLintFile[], options: { detailedReachable?: boolean } = {}): string[] {
  const findings = files.flatMap(file => file.findings);
  return [`test lint (report only): ${findings.length} findings in ${files.filter(f => f.findings.length).length} files`,
    ...findings.slice(0, 12).map(f => `test lint finding: ${f.file}:${f.line} [${f.rule}] ${f.message}`),
    ...files.map(f => `test lint tier: ${f.file}: ${f.tier}; qualifies ${f.qualifies}`),
    ...files.flatMap(f => {
      if (!f.reachable) return [];
      // Dry-run replies share the protocol's bounded frame. Summarize resource
      // kinds and retain one highest-tier path; the CLI report lists every path.
      const kinds = [...new Set(f.reachable.resources.map(resource => resource.message.split(']: ').at(-1)))];
      const representative = f.reachable.resources.find(resource => resource.message.endsWith(`requires ${f.reachable!.tier}`));
      const resources = options.detailedReachable ? f.reachable.resources : representative ? [representative] : [];
      return [
        `test lint reachable: ${f.file}: ${f.reachable.tier}; ${f.reachable.resources.length} resources (diagnostic only)${kinds.length ? '; ' + kinds.join(', ') : ''}`,
        ...resources.map(resource => `test lint reachable resource: ${f.file}:${resource.line} [${resource.rule}] ${resource.message}`),
      ];
    })];
}
