// T0: imported native child launches need a sealed environment or a reasoned seam.
import assert from 'node:assert/strict';
import { glob } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

if (process.argv.includes('--help')) {
  console.log('Usage: node hub/test/lint-child-environment.ts [--inventory]\nChecks hub/test and nvim/test native child launches (TypeScript and JavaScript, including helpers). --inventory lists sealed sites and reasoned exemptions; environment values are never printed.');
  process.exit(0);
}

const launches = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
// Each trusted builder declares its extras position; null means it accepts only
// a filtered inherited base. Keep trust and argument semantics in one registry.
const builders = new Map([
  ['fixture-environment.ts', new Map<string, number | null>([['fixtureEnvironment', 2], ['runnerFixtureEnvironment', null]])],
  ['account-fixture-env.ts', new Map<string, number | null>([['accountFixtureEnvironment', 0]])],
]);

function inspect(path: string, source: ts.SourceFile, checker: ts.TypeChecker) {
  const failures: string[] = [], inventory: string[] = [];
  const exemptions = new Map<number, string>();
  function comments(node: ts.Node): void {
    for (const range of [...ts.getLeadingCommentRanges(source.text, node.pos) ?? [], ...ts.getTrailingCommentRanges(source.text, node.end) ?? []]) {
      if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
      const match = /^\/\/\s*cland-allow-child-env:\s*(\S.*)$/.exec(source.text.slice(range.pos, range.end));
      if (match) exemptions.set(source.getLineAndCharacterOfPosition(range.pos).line, match[1]!);
    }
    // Include tokens such as else, whose leading comments are not child nodes.
    for (const child of node.getChildren(source)) comments(child);
  }
  comments(source);
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isAwaitExpression(node) || ts.isSatisfiesExpression(node) ? unwrap(node.expression) : node;
  const symbol = (node: ts.Node) => {
    let sym = ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression)
        ? checker.getTypeAtLocation(node.expression).getProperty(node.argumentExpression.text) : checker.getSymbolAtLocation(node);
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    return sym;
  };
  function builder(expression: ts.Expression): { extras: number | null } | undefined {
    const sym = symbol(expression);
    for (const declaration of sym?.declarations ?? []) {
      const file = declaration.getSourceFile().fileName;
      const name = file.split('/').at(-1)!;
      const methods = builders.get(name);
      if ((file.endsWith('/hub/test/' + name) || name === 'fixture-environment.ts' && file.endsWith('/test-support/' + name)) && methods?.has(sym!.name)) return { extras: methods.get(sym!.name) ?? null };
    }
    return;
  }
  function childModule(node: ts.Expression, seen = new Set<ts.Node>()): boolean {
    node = unwrap(node);
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      const name = node.arguments[0];
      return !!name && ts.isStringLiteral(name) && ['node:child_process', 'child_process'].includes(name.text);
    }
    const sym = symbol(node);
    if (sym?.declarations?.some(part => ts.isModuleDeclaration(part) && part.getSourceFile().fileName.endsWith('/child_process.d.ts'))) return true;
    const declaration = sym?.valueDeclaration;
    return !!declaration && ts.isVariableDeclaration(declaration) && !!declaration.initializer && childModule(declaration.initializer, seen);
  }
  function native(node: ts.Expression, seen = new Set<ts.Node>()): string | undefined {
    node = unwrap(node);
    if (seen.has(node)) return;
    seen.add(node);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const name = ts.isPropertyAccessExpression(node) ? node.name.text
        : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
      if (name && launches.has(name) && childModule(node.expression)) return name;
      if (!name && ts.isElementAccessExpression(node) && childModule(node.expression)) return 'dynamic child_process';
    }
    const sym = symbol(ts.isPropertyAccessExpression(node) ? node.name : node);
    for (const declaration of sym?.declarations ?? []) {
      if (/(?:^|\/)child_process\.d\.ts$/.test(declaration.getSourceFile().fileName) && launches.has(sym!.name)) return sym!.name;
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) return native(declaration.initializer, seen);
      if (ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent)
        && ts.isVariableDeclaration(declaration.parent.parent) && declaration.parent.parent.initializer) {
        const property = checker.getTypeAtLocation(declaration.parent.parent.initializer).getProperty((declaration.propertyName ?? declaration.name).getText());
        if (property?.declarations?.some(part => part.getSourceFile().fileName.endsWith('/child_process.d.ts')) && launches.has(property.name)) return property.name;
        const name = (declaration.propertyName ?? declaration.name).getText();
        if (launches.has(name) && childModule(declaration.parent.parent.initializer)) return name;
      }
    }
    // promisify retains the native function's options position.
    if (ts.isCallExpression(node) && node.arguments[0] && symbol(node.expression)?.name === 'promisify') return native(node.arguments[0], seen);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'bind') return native(node.expression.expression, seen);
    return;
  }
  function sealed(node: ts.Expression, seen = new Set<ts.Node>()): boolean {
    node = unwrap(node);
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isConditionalExpression(node)) return sealed(node.whenTrue, new Set(seen)) && sealed(node.whenFalse, new Set(seen));
    if (ts.isIdentifier(node)) {
      const sym = symbol(node), declaration = sym?.valueDeclaration;
      // Const protects the binding, not the object. Only aliases used directly
      // as a native launch's env are accepted; mutation or escape needs review.
      let escapes = false;
      function references(part: ts.Node): void {
        if (ts.isIdentifier(part) && part !== (declaration && ts.isVariableDeclaration(declaration) ? declaration.name : undefined) && symbol(part) === sym) {
          const property = part.parent;
          const literal = property.parent;
          const call = literal.parent;
          if (!((ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property) && property.initializer === part)
            && property.name.getText(source) === 'env' && ts.isObjectLiteralExpression(literal)
            && ts.isCallExpression(call) && native(call.expression))) escapes = true;
        }
        ts.forEachChild(part, references);
      }
      references(source);
      return !!declaration && ts.isVariableDeclaration(declaration) && !!declaration.initializer
        && !escapes && (declaration.parent.flags & ts.NodeFlags.Const) !== 0 && sealed(declaration.initializer, seen);
    }
    if (!ts.isCallExpression(node)) return false;
    const contract = builder(node.expression);
    if (!contract) return false;
    // A builder's extras are explicit inputs. A full ambient environment in
    // that slot can restore inherited XDG/account paths after scratch defaults.
    function ambient(extra: ts.Expression, visited = new Set<ts.Node>()): boolean {
      extra = unwrap(extra);
      if (visited.has(extra)) return false;
      visited.add(extra);
      if (ts.isPropertyAccessExpression(extra) && extra.expression.getText(source) === 'process' && extra.name.text === 'env') return true;
      if (ts.isIdentifier(extra)) {
        const declaration = symbol(extra)?.valueDeclaration;
        return !!declaration && ts.isVariableDeclaration(declaration) && !!declaration.initializer && ambient(declaration.initializer, visited);
      }
      if (ts.isObjectLiteralExpression(extra)) return extra.properties.some(property => ts.isSpreadAssignment(property) && ambient(property.expression, visited));
      if (ts.isCallExpression(extra)) {
        const nested = builder(extra.expression);
        if (nested) {
          const extras = nested.extras === null ? undefined : extra.arguments[nested.extras];
          return !!extras && ambient(extras, visited);
        }
        return extra.arguments.some(argument => ambient(argument, visited))
          || ts.isPropertyAccessExpression(extra.expression) && ts.isCallExpression(extra.expression.expression) && ambient(extra.expression.expression, visited);
      }
      return false;
    }
    const extras = contract.extras === null ? undefined : node.arguments[contract.extras];
    return !extras || !ambient(extras);
  }
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      let method = native(node.expression);
      let args: readonly ts.Expression[] = node.arguments;
      if (ts.isPropertyAccessExpression(node.expression) && ['call', 'apply'].includes(node.expression.name.text)) {
        method = native(node.expression.expression);
        args = node.expression.name.text === 'call' ? node.arguments.slice(1)
          : node.arguments[1] && ts.isArrayLiteralExpression(node.arguments[1]) ? node.arguments[1].elements : [];
        if (!method && node.expression.getText(source) === 'Reflect.apply' && node.arguments[0]) {
          method = native(node.arguments[0]);
          args = node.arguments[2] && ts.isArrayLiteralExpression(node.arguments[2]) ? node.arguments[2].elements : [];
        }
      }
      if (method) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
        const reason = exemptions.get(line) ?? exemptions.get(line - 1);
        // Arguments arrays are optional; exec/execSync always place options second.
        const options = args[(method === 'exec' || method === 'execSync' || !args[1] || !checker.isArrayLikeType(checker.getTypeAtLocation(args[1]))) ? 1 : 2];
        const env = options && ts.isObjectLiteralExpression(unwrap(options))
          ? (unwrap(options) as ts.ObjectLiteralExpression).properties.findLast(property => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'env') : undefined;
        const expression = env && ts.isPropertyAssignment(env) ? env.initializer : env && ts.isShorthandPropertyAssignment(env) ? env.name : undefined;
        const properties: readonly ts.ObjectLiteralElementLike[] = options && ts.isObjectLiteralExpression(unwrap(options)) ? (unwrap(options) as ts.ObjectLiteralExpression).properties : [];
        const overridden = env && properties.slice(properties.indexOf(env) + 1).some(ts.isSpreadAssignment);
        const safe = method !== 'dynamic child_process' && expression && !overridden && sealed(expression);
        inventory.push(`${path}:${line + 1}: ${method}: ${reason ? `exempt: ${reason}` : safe ? 'sealed builder' : 'UNSEALED'}`);
        if (!reason && !safe) failures.push(`${path}:${line + 1}: ${method} requires a sealed fixture builder with explicit extras; intentional seams need // cland-allow-child-env: reason`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { failures, inventory };
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = ts.readConfigFile(join(root, 'hub/tsconfig.json'), ts.sys.readFile);
assert.equal(config.error, undefined);
const options = { ...ts.parseJsonConfigFileContent(config.config, ts.sys, join(root, 'hub')).options, allowJs: true, checkJs: false };
const files: string[] = [];
const sourcePattern = '{hub,nvim}/test/**/*.{ts,mts,cts,js,mjs,cjs}';
// These scope controls exercise the same pattern as repository discovery without
// writing fixtures into the checkout or launching any native children.
for (const path of ['hub/test/launch.ts', 'nvim/test/launch.ts', 'nvim/test/helpers/launch.js', 'nvim/test/launch.mts', 'nvim/test/launch.cts', 'nvim/test/launch.mjs', 'nvim/test/launch.cjs']) {
  assert.ok(matchesGlob(path, sourcePattern), `child environment scan includes ${path}`);
}
for (const path of ['nvim/src/launch.ts', 'hub/src/launch.ts', 'nvim/test/fixture.lua', 'web/test/launch.ts']) {
  assert.ok(!matchesGlob(path, sourcePattern), `child environment scan excludes ${path}`);
}
for await (const path of glob(sourcePattern, { cwd: root })) files.push(join(root, path));
const rejected = [
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';\nspawn('tool', [], {env: fixtureEnvironment('/scratch', process.env, process.env)});",
  "import { spawn } from 'node:child_process';\nspawn('tool');",
  "import { spawn } from 'node:child_process';\nspawn('tool', [], { env: process.env });",
  "import { execFile as run } from 'child_process';\nrun('tool', { env: {...process.env} });",
  "import cp from 'node:child_process';\ncp.spawnSync('tool', [], {});",
  "import * as cp from 'node:child_process';\ncp.fork('tool', { env: process.env });",
  "import { execFile } from 'node:child_process'; import { promisify } from 'node:util';\nconst run = promisify(execFile); run('tool', [], { env: process.env });",
  "import { exec } from 'node:child_process';\n// cland-allow-child-env:\nexec('tool');",
  "import { execSync } from 'node:child_process'; const marker = '// cland-allow-child-env: fake';\nexecSync('tool');",
  "import { spawn } from 'node:child_process'; import { accountFixtureEnvironment } from './account-fixture-env.ts';\nspawn('tool', [], {env: await accountFixtureEnvironment(process.env)});",
  "import { spawn } from 'node:child_process'; import { accountFixtureEnvironment } from './account-fixture-env.ts';\nspawn('tool', [], {env: await accountFixtureEnvironment({...process.env})});",
  "import { spawn } from 'node:child_process'; import { accountFixtureEnvironment as build } from './account-fixture-env.ts';\nconst extras = {...process.env}; spawn('tool', [], {env: await build(extras)});",
  "import { spawn } from 'node:child_process'; import { accountFixtureEnvironment as build } from './account-fixture-env.ts';\nconst inherited = process.env; const extras = {...inherited}; const env = await build(extras); spawn('tool', [], {env});",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nspawn('tool', [], {env: fixtureEnvironment('/scratch', process.env, {...process.env})});",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nconst env = {...process.env}; spawn('tool', [], {env: fixtureEnvironment('/scratch', process.env, env)});",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nspawn('tool', [], { env: { ...fixtureEnvironment('/scratch', process.env), ...process.env } });",
  "import cp from 'node:child_process'; const method = process.argv[2];\ncp[method]('tool');",
  "import cp from 'node:child_process';\ncp.spawn.call(cp, 'tool', [], {env: process.env});",
  "import { fork } from 'node:child_process';\nReflect.apply(fork, null, ['tool']);",
  "const cp = require('node:child_process');\ncp.spawn('tool');",
  "const { fork: launch } = require('child_process');\nlaunch('tool');",
  "const { spawn: launch } = await import('node:child_process');\nlaunch('tool');",
  "import cp from 'node:child_process';\ncp['spawn']('tool');",
  "import cp from 'node:child_process'; const launch = cp.spawn.bind(cp);\nlaunch('tool');",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nconst env = fixtureEnvironment('/scratch', process.env); Object.assign(env, process.env); spawn('tool', [], {env});",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nconst env = fixtureEnvironment('/scratch', process.env); env.DIGITALOCEAN_TOKEN = 'synthetic'; spawn('tool', [], {env});",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nspawn('tool', [], {env: fixtureEnvironment('/scratch', process.env), ...{env: process.env}});",
  "import { spawn } from 'node:child_process'; const marker = `// cland-allow-child-env: fake`;\nspawn('tool');",
  "import { spawn } from 'node:child_process';\n/* cland-allow-child-env: fake */ spawn('tool');",
  "import { spawn } from 'node:child_process';\n// cland-allow-child-env: unrelated\n\nspawn('tool');",
  "import { spawn } from 'node:child_process'; const fixtureEnvironment = (...args: unknown[]) => process.env;\nspawn('tool', [], {env: fixtureEnvironment('/scratch', process.env)});",
];
const allowed = [
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';\nspawn('tool', [], {env: fixtureEnvironment('/scratch', process.env)});",
  "import { spawn } from 'node:child_process'; import { accountFixtureEnvironment as build } from './account-fixture-env.ts';\nspawn('tool', [], {env: await build({CODEX_HOME: '/scratch/codex'})});",
  "import { spawn } from 'node:child_process'; import { runnerFixtureEnvironment } from './fixture-environment.ts';\nspawn('tool', [], {env: runnerFixtureEnvironment('/scratch', process.env)});",
  "import { spawn } from 'node:child_process'; import { fixtureEnvironment } from './fixture-environment.ts';\nspawn('tool', [], { env: fixtureEnvironment('/scratch', process.env) });",
  "import { execFile } from 'node:child_process'; import { accountFixtureEnvironment as build } from './account-fixture-env.ts';\nconst env = await build(); execFile('tool', [], {env});",
  "import { exec } from 'node:child_process';\n// cland-allow-child-env: typed native credential contract\nexec('tool');",
  "import { execSync } from 'node:child_process';\nexecSync('tool'); // cland-allow-child-env: sealed lifecycle helper",
  "const spawn = () => {}; spawn(); /x/.exec('x');",
];
const samples = new Map(['hub/test', 'nvim/test'].flatMap(directory => [...rejected, ...allowed].map((text, index) => [
  join(root, `${directory}/__child_env_case_${index}.ts`),
  `export {};\n${directory === 'nvim/test' ? text.replaceAll("from './", "from '../../hub/test/") : text}`,
])));
const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
  const text = samples.get(path);
  return text === undefined ? original(path, languageVersion, onError, shouldCreateNewSourceFile) : ts.createSourceFile(path, text, languageVersion, true);
};
const program = ts.createProgram([...files, ...samples.keys()], options, host), checker = program.getTypeChecker();
[...samples.keys()].forEach((path, index) => {
  const relative = path.slice(root.length);
  assert.ok(matchesGlob(relative, sourcePattern), `child environment self-check selected: ${relative}`);
  const { failures } = inspect(relative, program.getSourceFile(path)!, checker);
  const caseIndex = index % (rejected.length + allowed.length);
  assert.equal(failures.length, caseIndex < rejected.length ? 1 : 0, `child environment self-check ${relative}`);
  if (caseIndex === 0) assert.ok(failures[0]!.startsWith(`${relative}:3:`));
});
const results = files.sort().map(path => inspect(path.slice(root.length), program.getSourceFile(path)!, checker));
if (process.argv.includes('--inventory')) console.log(results.flatMap(result => result.inventory).join('\n'));
const failures = results.flatMap(result => result.failures);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('child environment lint: sealed builders or reasoned launch seams');
