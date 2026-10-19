// T0 static gate: resolve the production TypeScript graph and scan every production TS/Lua source.
// Compiler guard self-checks below pin inference/alias handling without a test worker.
// T-119 source guard: compiler-resolved Kind and default-level literal types survive bindings.
// Compare both operand types for equality, switch cases and includes/has (receiver element types).
// In-place array/Set/Map constructions also expose their literals even when inference widens them.
// Default declaration and the one-off migration bound tracker literals. The exact Lua
// EventKind module may contain only its protocol-validated value list. Operational release
// vocabulary has no Kind type and remains allowed. Mutable variable/object widening to string/string[], any,
// unknown and cast erasure lose literal or Kind types; those residuals remain review matters.
// Epic literals are forbidden outside the defaults and the fixed verification-occasion declaration.
// Operational occasion values remain forbidden in tracker Kind operations.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { EVENT_KINDS } from '../src/protocol.ts';
import { Ladder } from '../src/tracker/kinds.ts';

const DEFAULT_CONTAINERS = new Ladder().containers;

async function check(name: string, scan: () => void | Promise<void>): Promise<void> {
  await scan();
  console.log(`container source lint: ${name}`);
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = ts.readConfigFile(join(root, 'hub/tsconfig.json'), ts.sys.readFile);
assert.equal(config.error, undefined);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, join(root, 'hub')).options;

function containerLiterals(rel: string, source: ts.SourceFile, checker: ts.TypeChecker): string[] {
  // Already-run repository-specific T-118 migration; its fixed kinds are its purpose.
  if (rel === 'hub/bin/migrate-v01-release.ts') return [];
  const failures: string[] = [];
  const contains = (type: ts.Type, match: (type: ts.Type) => boolean, seen = new Set<ts.Type>()): boolean => {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) || seen.has(type)) return false;
    seen.add(type);
    if (match(type)) return true;
    if (type.isUnionOrIntersection() && type.types.some(part => contains(part, match, seen))) return true;
    if (type.aliasTypeArguments?.some(part => contains(part, match, seen))) return true;
    return Boolean(type.flags & ts.TypeFlags.Object) && Boolean((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference)
      && checker.getTypeArguments(type as ts.TypeReference).some(part => contains(part, match, seen));
  };
  const hasKind = (type: ts.Type): boolean => contains(type, part => part.aliasSymbol?.getName() === 'Kind');
  const hasLevel = (type: ts.Type): boolean => contains(type, part => part.isStringLiteral() && DEFAULT_CONTAINERS.includes(part.value));
  const literal = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && DEFAULT_CONTAINERS.includes(node.text);
  const defaults = (node: ts.Node): boolean => {
    if (rel !== 'hub/src/tracker/kinds.ts') return false;
    for (let parent = node.parent; parent && parent !== source; parent = parent.parent) {
      if (ts.isVariableDeclaration(parent) && parent.name.getText(source) === 'DEFAULT_LEVELS') return true;
    }
    return false;
  };
  const operationalOccasion = (node: ts.Node): boolean => {
    // One fixed wire enum may use epic independently of tracker configuration.
    // Only its direct constant initializer is exempt; Kind uses of the value still fail below.
    if (rel !== 'hub/src/protocol.ts' || !ts.isStringLiteral(node) || node.text !== 'epic') return false;
    const contextual = checker.getContextualType(node);
    if (contextual && hasKind(contextual)) return false;
    const property = node.parent;
    if (!ts.isPropertyAssignment(property) || property.initializer !== node || property.name.getText(source) !== 'epic') return false;
    const object = property.parent, assertion = object.parent;
    if (!ts.isObjectLiteralExpression(object) || !ts.isAsExpression(assertion) || assertion.type.getText(source) !== 'const') return false;
    const declaration = assertion.parent;
    return ts.isVariableDeclaration(declaration) && declaration.name.getText(source) === 'VERIFY_OCCASIONS'
      && ts.isVariableDeclarationList(declaration.parent) && Boolean(declaration.parent.flags & ts.NodeFlags.Const);
  };
  const flagged = new Set<ts.Node>();
  const flag = (node: ts.Node): void => {
    // Migration and init deliberately seed this one fixed kind (T-649).
    if (['hub/src/tracker/migrate.ts', 'hub/src/init/provision.ts'].includes(rel) && literal(node) && node.text === 'category') return;
    if (defaults(node) || operationalOccasion(node) || flagged.has(node)) return;
    flagged.add(node);
    failures.push(`${rel}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
  };
  const inlineLevel = (node: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(node)) return inlineLevel(node.expression);
    if (!ts.isArrayLiteralExpression(node) && !(ts.isNewExpression(node) && ts.isIdentifier(node.expression) && ['Set', 'Map'].includes(node.expression.text))) return false;
    const containsLiteral = (part: ts.Node): boolean => literal(part) || Boolean(ts.forEachChild(part, containsLiteral));
    return containsLiteral(node);
  };
  const compare = (left: ts.Expression, right: ts.Expression): void => {
    const leftType = checker.getTypeAtLocation(left);
    const rightType = checker.getTypeAtLocation(right);
    if (hasKind(leftType) && (hasLevel(rightType) || inlineLevel(right))) flag(right);
    if (hasKind(rightType) && (hasLevel(leftType) || inlineLevel(left))) flag(left);
  };
  const visit = (node: ts.Node): void => {
    if (literal(node)) {
      const contextual = checker.getContextualType(node);
      if (node.text === 'epic' || contextual && hasKind(contextual)) flag(node);
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsToken].includes(node.operatorToken.kind)) {
      compare(node.left, node.right);
    }
    if (ts.isSwitchStatement(node) && hasKind(checker.getTypeAtLocation(node.expression))) {
      for (const clause of node.caseBlock.clauses) if (ts.isCaseClause(clause)) compare(node.expression, clause.expression);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ['includes', 'has'].includes(node.expression.name.text)) {
      for (const argument of node.arguments) compare(node.expression.expression, argument);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
}

function luaContainerLiterals(rel: string, source: string): string[] {
  if (rel === 'nvim/lua/cland/event_kinds.lua') {
    // This exact file holds event kinds, not tracker kinds, and may declare only
    // the protocol's operational vocabulary. It
    // cannot contain tracker operations, other literals or executable statements.
    const declaration = source.replace(/--[^\n]*/g, '').trim().match(/^return\s*\{([\s\S]*)\}$/);
    const literal = /(['"])([a-z]+)\1/g;
    const values = declaration ? [...declaration[1]!.matchAll(literal)].map(m => m[2]) : [];
    const rest = declaration?.[1]?.replace(literal, '').replace(/[\s,]/g, '');
    return rest === '' && JSON.stringify(values) === JSON.stringify(EVENT_KINDS) ? [] : [rel + ': invalid EventKind declaration'];
  }
  return [...source.matchAll(/["']([^"']*)["']/g)].filter(m => DEFAULT_CONTAINERS.includes(m[1]!)).map(() => rel);
}

async function productionFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await productionFiles(path));
    else if (path.endsWith('.ts') || path.endsWith('.lua')) found.push(path);
  }
  return found;
}

await check('container names occur only in defaults, never in compiler-typed Kind operations', async () => {
  const files = (await Promise.all(['hub/src', 'hub/bin', 'nvim/lua'].map(dir => productionFiles(join(root, dir))))).flat();
  const program = ts.createProgram(files.filter(path => path.endsWith('.ts')), options);
  const checker = program.getTypeChecker();
  const failures: string[] = [];
  for (const path of files) {
    const rel = relative(root, path);
    if (path.endsWith('.lua')) {
      failures.push(...luaContainerLiterals(rel, await readFile(path, 'utf8')));
    } else {
      const source = program.getSourceFile(path);
      assert.ok(source, path);
      failures.push(...containerLiterals(rel, source, checker));
    }
  }
  assert.deepEqual(failures, [], 'container kind literals must come from [tracker] levels');
});

await check('compiler guard follows aliases and inference while preserving operational release vocabulary', () => {
  const rejected = [
    "new Map([['release', true]]).has(kind);",
    "new Set(['release']).has(kind);",
    "['release'].includes(kind);",
    "kind === ('release');",
    "const literal = 'release'; kind === literal;",
    "const container = { values: ['release'] as const }; container.values.includes(kind);",
    "const container = { values: new Set(['release'] as const) }; container.values.has(kind);",
    "new Map([['release', true]] as const).has(kind);",

    "kind == 'release';",
    "kind != 'release';",
    "(['release'] as const).includes(kind);",
    "new Set(['release'] as const).has(kind);",
    "new Map([['release', true]] as const).has(kind);",
    "const values = ['release'] as const; values.includes(kind);",
    "const values = new Set(['release'] as const); const alias = values; alias.has(kind);",

    "const container = item.kind === 'release';",
    "const LIFECYCLE_KINDS = items.filter(item => item.kind === 'release');",
    "const clearPublicationReceipt = (kind: Kind) => kind === 'release';",
    "const value = kind; value === 'release';",
    "const {kind: value} = item; value !== 'release';",
    "const value = item.kind; switch (value) { case 'release': break; }",
    "const values = [kind]; values.includes('release');",
    "const values = new Set([kind]); values.has('release');",
    "const payload: { kind: Kind } = { kind: 'release' };",
    "function choose(labels: string[]): Kind { if (labels.includes('release')) return 'release'; return 'task'; }",
    "const entries: Kind[] = ['release'];",
    "item.kind = 'release';",
    "const name = 'epic';",
    "kind === 'category';",
  ];
  const allowed = [
    "const values = ['release']; values.includes(kind);",
    "const values = new Set(['release']); values.has(kind);",
    "const values = new Map([['release', true]]); values.has(kind);",

    "const container = { values: ['release'] }; container.values.includes(kind);",
    "let literal = 'release'; kind === literal;",

    "frame.type == 'release';",
    "frame.type != 'release';",
    "['release'].includes(frame.type);",
    "new Set(['release']).has(frame.type);",
    "new Map([['release', true]]).has(frame.type);",

    "frame.type === 'release';",
    "type ReleaseRequest = { type: 'release' };",
    "switch (command) { case 'release': break; }",
    "const PERMISSIONS = ['release'];",
    "const LIFECYCLE_KINDS = ['release'];",
    "const clearPublicationReceipt = (kind: 'release' | 'sync') => kind === 'release';",
    "const value: any = kind; value === 'release';",
    "const value = kind as string; value === 'release';",
  ];
  const samples = [...rejected, ...allowed,
    "export const DEFAULT_LEVELS = ['release', 'epic'];",
    "function isContainer(kind: Kind) { return kind === 'epic'; }",
  ];
  const texts = new Map(samples.map((text, index) => [join(root, `hub/src/__guard_case_${index}.ts`),
    `import type { Kind } from './tracker/item.ts';
     declare const kind: Kind; declare const item: {kind: Kind}; declare const items: {kind: Kind}[];
     declare const frame: {type: 'release' | 'sync'}; declare const command: string;
     ${text}`]));
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
    const text = texts.get(path);
    return text === undefined ? original(path, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(path, text, languageVersion, true);
  };
  const program = ts.createProgram([...texts.keys()], options, host);
  const checker = program.getTypeChecker();
  const checked = [...texts.keys()].map((path, index) => {
    const source = program.getSourceFile(path);
    assert.ok(source);
    const rel = index >= rejected.length + allowed.length ? 'hub/src/tracker/kinds.ts' : 'hub/src/hub/dispatch.ts';
    return containerLiterals(rel, source, checker);
  });
  rejected.forEach((text, index) => assert.ok(checked[index]!.length > 0, text));
  allowed.forEach((text, index) => assert.deepEqual(checked[index + rejected.length], [], text));
  assert.deepEqual(checked.at(-2), [], 'only DEFAULT_LEVELS is exempt');
  assert.ok(checked.at(-1)!.length > 0, 'helpers in the defaults file stay protected');
});

await check('only the operational verification enum declaration is exempt; tracker Kind uses stay protected', () => {
  const declaration = "export const VERIFY_OCCASIONS = { stage: 'stage', epic: 'epic', release: 'release' } as const;";
  const cases = [
    { rel: 'hub/src/protocol.ts', text: declaration, allowed: true },
    { rel: 'hub/src/protocol.ts', text: declaration + ' Object.values(VERIFY_OCCASIONS).some(value => value === input);', allowed: true },
    { rel: 'hub/src/hub/dispatch.ts', text: declaration, allowed: false },
    { rel: 'hub/src/protocol.ts', text: declaration.replace('VERIFY_OCCASIONS', 'OTHER_VALUES'), allowed: false },
    { rel: 'hub/src/protocol.ts', text: "'epic';", allowed: false },
    { rel: 'hub/src/protocol.ts', text: declaration + ' kind === VERIFY_OCCASIONS.epic;', allowed: false },
    { rel: 'hub/src/protocol.ts', text: declaration + ' [VERIFY_OCCASIONS.epic].includes(kind);', allowed: false },
    { rel: 'hub/src/protocol.ts', text: declaration + " const payload: { kind: Kind } = { kind: 'epic' };", allowed: false },
    { rel: 'hub/src/protocol.ts', text: declaration.replace('VERIFY_OCCASIONS =', 'VERIFY_OCCASIONS: {stage: string; epic: Kind; release: string} ='), allowed: false },
  ];
  const texts = new Map(cases.map((sample, index) => [join(root, `hub/src/__occasion_case_${index}.ts`),
    `import type { Kind } from './tracker/item.ts'; declare const kind: Kind; declare const input: unknown; ${sample.text}`]));
  const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
    const text = texts.get(path);
    return text === undefined ? original(path, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(path, text, languageVersion, true);
  };
  const program = ts.createProgram([...texts.keys()], options, host), checker = program.getTypeChecker();
  [...texts.keys()].forEach((path, index) => {
    const sample = cases[index]!, source = program.getSourceFile(path)!;
    const failures = containerLiterals(sample.rel, source, checker);
    assert.equal(failures.length === 0, sample.allowed, sample.text);
  });
});

await check('Lua EventKind declarations match the protocol and cannot hide tracker container operations', () => {
  const rel = 'nvim/lua/cland/event_kinds.lua';
  const declaration = "return { 'session', 'task', 'verdict', 'suite', 'release', 'artifact', 'usage', 'topic', 'heartbeat', 'rule' }";
  assert.deepEqual(luaContainerLiterals(rel, declaration), []);
  for (const source of [
    declaration + "\nif item.kind == 'epic' then open(item) end",
    declaration.replace("'usage'", "'epic'"),
    declaration.replace("'release'", "'milestone'"),
    "return { 'release' }",
  ]) assert.ok(luaContainerLiterals(rel, source).length, source);
  for (const source of ["if item.kind == 'release' then open(item) end", "local containers = { 'epic', 'release' }"]) {
    assert.ok(luaContainerLiterals('nvim/lua/cland/items.lua', source).length, source);
    assert.ok(luaContainerLiterals('nvim/lua/cland/events.lua', source).length, 'other modules retain the full guard');
  }
});
