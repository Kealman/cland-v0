// T1: syntax-level executor interface contract, without workers or a hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('the executor contract has nine operations and no backend-specific identifiers', async () => {
  const source = await readFile(new URL('../src/executor/executor.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile('executor.ts', source, ts.ScriptTarget.Latest, true);
  const identifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) identifiers.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const forbidden of ['ssh', 'scp', 'host', 'address', 'key']) assert.ok(!identifiers.includes(forbidden), forbidden);
  const contract = file.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'Executor')!;
  assert.deepEqual(contract.members.map(member => member.name!.getText(file)), ['acquire', 'prepare', 'deliver', 'start', 'status', 'log', 'cancel', 'release', 'reap']);
  assert.match(source, /'paused'/);
});
