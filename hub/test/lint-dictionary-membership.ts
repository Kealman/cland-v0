// T0: compiler-typed dictionary membership; finite-key narrowing remains allowed.
import assert from 'node:assert/strict';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function membershipFailures(path: string, source: ts.SourceFile, checker: ts.TypeChecker): string[] {
  const text = source.text;
  // Only real line comments on the expression's line or the immediately preceding
  // line can exempt it. A string containing the marker never disables the guard.
  const exemptions = new Set<number>();
  function comments(node: ts.Node): void {
    for (const range of [...ts.getLeadingCommentRanges(text, node.pos) ?? [], ...ts.getTrailingCommentRanges(text, node.end) ?? []]) {
      if (range.kind === ts.SyntaxKind.SingleLineCommentTrivia && /^\/\/\s*cland-allow-in:\s*\S.*$/.test(text.slice(range.pos, range.end))) {
        exemptions.add(source.getLineAndCharacterOfPosition(range.pos).line);
      }
    }
    ts.forEachChild(node, comments);
  }
  comments(source);
  const failures: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
      const line = source.getLineAndCharacterOfPosition(node.operatorToken.getStart(source)).line;
      const dictionary = (type: ts.Type): boolean => {
        if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.NonPrimitive)) return true;
        if (type.isUnionOrIntersection()) return type.types.some(dictionary);
        return Boolean(checker.getIndexTypeOfType(type, ts.IndexKind.String))
          || (checker.getPropertiesOfType(type).length === 0 && checker.getSignaturesOfType(type, ts.SignatureKind.Call).length === 0);
      };
      const receiver = checker.getTypeAtLocation(node.right);
      const declaredKey = (type: ts.Type): boolean => {
        if (type.isUnion()) return type.types.every(declaredKey);
        if (!type.isStringLiteral() && !type.isNumberLiteral()) return false;
        const alternatives = receiver.isUnion() ? receiver.types : [receiver];
        return alternatives.some(part => checker.getPropertiesOfType(part).some(property => property.name === String(type.value)));
      };
      if ((dictionary(receiver) || !declaredKey(checker.getTypeAtLocation(node.left)))
        && !exemptions.has(line) && !exemptions.has(line - 1)) {
        failures.push(`${path}:${line + 1}: dictionary membership must use Object.hasOwn or Map.has; intentional prototype checks need // cland-allow-in: reason`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return failures;
}

// Guard self-checks share one compiler graph with production, without fixture processes.
const rejected = [
  "declare const someRecord: Record<string, number>; 'x' in someRecord;",
  'declare const dictionary: {[key: string]: boolean}; declare const key: string; key /* comment */ in\n(dictionary);',
  "'constructor' in ({})",
  "declare const dictionary: any; 'x' in dictionary;",
  "declare const dictionary: unknown; 'x' in dictionary;",
  "declare const dictionary: object; 'x' in dictionary;",
  "type Dict = Record<string, number>; declare const dictionary: Dict | {kind: string}; 'x' in dictionary;",
  "declare const key: string; key in {view: true};",
  "'constructor' in {view: true};",
  "// cland-allow-in:\n'x' in {};",
  "const marker = '// cland-allow-in: fake';\n'x' in {};",
  "const marker = `// cland-allow-in: fake`;\n'x' in {};",
  "const marker = /cland-allow-in: fake/;\n'x' in {};",
  "// cland-allow-in: unrelated\n\n'x' in {};",
];
const allowed = [
  'declare const dictionary: Record<string, number>; Object.hasOwn(dictionary, "x"); new Map().has("x");',
  "const text = 'key in dictionary'; // key in dictionary",
  'declare const dictionary: Record<string, number>; for (const key in dictionary) {}',
  "declare const subject: {item: string} | {topic: string}; 'item' in subject;",
  "declare const record: {optional?: string}; 'optional' in record;",
  '// cland-allow-in: inherited Error property\n"code" in {};',
  '"code" in {}; // cland-allow-in: inherited Error property',
  'const marker = `template ${1}`;\n// cland-allow-in: inherited Error property\n"code" in {};',
];
const root = fileURLToPath(new URL('../../', import.meta.url));
const config = ts.readConfigFile(join(root, 'hub/tsconfig.json'), ts.sys.readFile);
assert.equal(config.error, undefined);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, join(root, 'hub')).options;
const files: string[] = [];
for await (const path of glob('hub/src/**/*.ts', { cwd: root })) files.push(join(root, path));
const samples = new Map([...rejected, ...allowed].map((text, index) => [join(root, `hub/src/__membership_case_${index}.ts`), `export {};\n${text}`]));
const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
  const text = samples.get(path);
  return text === undefined ? original(path, languageVersion, onError, shouldCreateNewSourceFile)
    : ts.createSourceFile(path, text, languageVersion, true);
};
const program = ts.createProgram([...files, ...samples.keys()], options, host), checker = program.getTypeChecker();
[...samples.keys()].forEach((path, index) => {
  const failures = membershipFailures('hub/src/scratch.ts', program.getSourceFile(path)!, checker);
  assert.equal(failures.length, index < rejected.length ? 1 : 0, samples.get(path));
  if (index === 0) assert.match(failures[0]!, /^hub\/src\/scratch.ts:2:/);
});
const failures = files.flatMap(path => membershipFailures(path.slice(root.length), program.getSourceFile(path)!, checker));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('dictionary membership lint: own keys or reasoned prototype checks; finite-key narrowing allowed');
