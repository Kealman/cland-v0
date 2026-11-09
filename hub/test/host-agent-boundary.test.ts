// T1: agent dependency closure and planted forbidden imports; source parsing only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { agentSourceImportAllowed } from '../src/host/agent/package.ts';
const project=fileURLToPath(new URL('../../',import.meta.url));
const root = fileURLToPath(new URL('../src/host/agent/', import.meta.url));
const credentials = fileURLToPath(new URL('../../shared/executor-credentials.ts', import.meta.url));
const environmentOwner = resolve(root, 'command-environment.ts');
function findings(path: string, source: string, allowCredentials = true): string[] {
  const errors: string[] = [];
  function visit(node: ts.Node) {
    let spec: ts.Expression | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) spec = node.moduleSpecifier;
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText() === 'require')) {
      spec = node.arguments[0]; if (!spec || !ts.isStringLiteral(spec)) errors.push('computed import');
    }
    if (spec && ts.isStringLiteral(spec)) {
      const value = spec.text;
      const target=value.startsWith('.')?resolve(dirname(path),value):value;
      const permitted=agentSourceImportAllowed(relative(project,path),value.startsWith('node:')?value:relative(project,target));
      if(!permitted||(!allowCredentials&&target===credentials))errors.push(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)); return errors;
}
test('agent imports only Node built-ins, agent modules and exact owner-bound shared leaves', async () => {
  for (const source of ["import x from 'ws'", "export * from '../../processes.ts'", "const x = import('../local.ts')", "require(name)"]) assert.ok(findings(resolve(root, 'server.ts'), source).length);
  const ownerSource=await readFile(environmentOwner,'utf8');
  assert.deepEqual(findings(environmentOwner,ownerSource,false),[credentials],'omitting exact leaf authorization names the rejected file');
  assert.deepEqual(findings(credentials,await readFile(credentials,'utf8')),[],'allowed leaf has Node-only transitive closure');
  assert.ok(findings(credentials,"import '../hub/src/host/local.ts'").length);
  assert.ok(findings(credentials,"import './other-shared.ts'").length);
  assert.ok(findings(resolve(root,'server.ts'),"import '../../../../shared/executor-credentials.ts'").length,'only the environment owner may import the leaf');
  for await (const file of glob('**/*.ts', { cwd: root })) assert.deepEqual(findings(resolve(root, file), await readFile(resolve(root, file), 'utf8')), [], file);
});

test('neutral Clock and fake-layout leaves have exact agent owners and no relative dependencies',async()=>{
  for(const leaf of ['clock','fake-layout']) {
    const owner=resolve(root,leaf+'.ts');
    const path=fileURLToPath(new URL('../../shared/'+leaf+'.ts',import.meta.url));
    assert.deepEqual(findings(owner,`export * from '../../../../shared/${leaf}.ts'`),[],'the exact wrapper owns its neutral leaf');
    assert.deepEqual(findings(path,await readFile(path,'utf8')),[],'neutral source remains Node-only');
    for(const spec of ['./other-shared.ts','../hub/src/host/agent/server.ts',`./${leaf}.ts`])assert.ok(findings(path,`import '${spec}'`).length,'no relative edge may escape an admitted leaf');
    assert.ok(findings(resolve(root,'server.ts'),`import '../../../../shared/${leaf}.ts'`).length,'another agent module cannot acquire the leaf');
    assert.ok(findings(owner,`import '../../../../shared/${leaf}-extra.ts'`).length,'a similar shared pathname stays forbidden');
  }
});

import { LineDecoder, MAX_LINE_BYTES } from '../src/host/agent/protocol.ts';
test('JSONL byte limits apply per line across coalesced, fragmented and multibyte chunks', () => {
  const decoder = new LineDecoder();
  const first = 'a'.repeat(MAX_LINE_BYTES);
  assert.deepEqual(decoder.push(Buffer.from(first + '\nnext\n')), [first, 'next']);
  const utf8 = Buffer.from('é'.repeat(MAX_LINE_BYTES / 2) + '\nx\n');
  assert.deepEqual(decoder.push(utf8.subarray(0, 1)), []);
  assert.deepEqual(decoder.push(utf8.subarray(1)), ['é'.repeat(MAX_LINE_BYTES / 2), 'x']);
  assert.throws(() => decoder.push(Buffer.from('x'.repeat(MAX_LINE_BYTES + 1))), /large/);
});
