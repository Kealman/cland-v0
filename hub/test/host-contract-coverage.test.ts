// T1: every Host member must be exercised by the reusable contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function missingMembers(contract: string, cases: string): string[] {
  const api = ts.createSourceFile('host.ts', contract, ts.ScriptTarget.Latest, true);
  const suite = ts.createSourceFile('cases.ts', cases, ts.ScriptTarget.Latest, true);
  const exercised = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'host') exercised.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(suite);
  const host = api.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'Host');
  assert.ok(host);
  return host.members.map(member => member.name?.getText(api) ?? '').filter(name => !exercised.has(name));
}
test('Host contract exercises every interface member and detects an uncovered addition', async () => {
  const api = await readFile(new URL('../src/host/host.ts', import.meta.url), 'utf8');
  const cases = await readFile(new URL('./host-contract.ts', import.meta.url), 'utf8');
  assert.deepEqual(missingMembers(api.replace('export interface Host {', 'export interface Host { uncovered(): void;'), cases), ['uncovered']);
  assert.deepEqual(missingMembers(api, cases), []);
});

// T-1547: options, including hub-side callbacks, remain represented in Host.stop cases.
function missingStopOptions(contract: string, cases: string): string[] {
  const api = ts.createSourceFile('host.ts', contract, ts.ScriptTarget.Latest, true);
  const suite = ts.createSourceFile('cases.ts', cases, ts.ScriptTarget.Latest, true);
  const options = api.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === 'HostStopOptions');
  assert.ok(options && ts.isTypeLiteralNode(options.type));
  const exercised = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(suite) === 'host.stop') {
      const argument = node.arguments[1];
      if (argument && ts.isObjectLiteralExpression(argument)) for (const property of argument.properties) {
        if (property.name) exercised.add(property.name.getText(suite));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(suite);
  return options.type.members.map(member => member.name?.getText(api) ?? '').filter(name => !exercised.has(name));
}
test('Host stop option inventory detects an uncovered callback addition', async () => {
  const api = await readFile(new URL('../src/host/host.ts', import.meta.url), 'utf8');
  const cases = await readFile(new URL('./host-contract.ts', import.meta.url), 'utf8');
  assert.deepEqual(missingStopOptions(api.replace('export type HostStopOptions = {', 'export type HostStopOptions = { uncovered?: () => void;'), cases), ['uncovered']);
  assert.deepEqual(missingStopOptions(api, cases), []);
});
