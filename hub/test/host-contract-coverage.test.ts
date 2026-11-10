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

// Spawn's command/result fields are nested contract members too.
test('Host spawn contract inventory includes logFile and exited with positive omission controls', async () => {
  const cases = await readFile(new URL('./host-contract.ts', import.meta.url), 'utf8');
  const fields = (source: string) => {
    const tree = ts.createSourceFile('cases.ts', source, ts.ScriptTarget.Latest, true);
    const names = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAccessExpression(node)) names.add(node.name.text);
      if (ts.isShorthandPropertyAssignment(node)) names.add(node.name.text);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return ['logFile', 'exited'].filter(name => !names.has(name));
  };
  assert.deepEqual(fields(cases), []);
  assert.deepEqual(fields(cases.replaceAll('logFile', 'omittedLog')), ['logFile']);
  assert.deepEqual(fields(cases.replaceAll('exited', 'omittedExit')), ['exited']);
});

// T-1547: options, including hub-side callbacks, remain represented in Host.stop cases.
function missingOperationOptions(contract: string, cases: string, type = 'HostStopOptions', operation = 'stop'): string[] {
  const api = ts.createSourceFile('host.ts', contract, ts.ScriptTarget.Latest, true);
  const suite = ts.createSourceFile('cases.ts', cases, ts.ScriptTarget.Latest, true);
  const options = api.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === type);
  assert.ok(options && ts.isTypeLiteralNode(options.type));
  const exercised = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(suite) === `host.${operation}`) {
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
  assert.deepEqual(missingOperationOptions(api.replace('export type HostStopOptions = {', 'export type HostStopOptions = { uncovered?: () => void;'), cases), ['uncovered']);
  assert.deepEqual(missingOperationOptions(api, cases), []);
});

test('Host spawn option inventory detects an uncovered callback addition', async () => {
  const api = await readFile(new URL('../src/host/host.ts', import.meta.url), 'utf8');
  const cases = await readFile(new URL('./host-contract.ts', import.meta.url), 'utf8');
  assert.deepEqual(missingOperationOptions(api.replace('export type HostSpawnOptions = {', 'export type HostSpawnOptions = { uncovered?: () => void;'), cases, 'HostSpawnOptions', 'spawn'), ['uncovered']);
  assert.deepEqual(missingOperationOptions(api, cases, 'HostSpawnOptions', 'spawn'), []);
});

test('local Host retains no optional Claude launch or adoption implementation', async () => {
  const { optionalClaudeHostContract } = await import('./host-contract.ts');
  const { localHost } = await import('../src/host/local.ts');
  optionalClaudeHostContract(localHost());
});

test('optional login-disk contract covers absence, refusal and exact input with planted failures',async()=>{
  const {optionalLoginDiskHostContract}=await import('./host-contract.ts');
  const {localHost}=await import('../src/host/local.ts');
  const input={op:'mount' as const,volume:'volume',path:'/tmp/invalid-login'};
  await optionalLoginDiskHostContract({});
  await optionalLoginDiskHostContract(localHost(),{input,code:'wrong-volume'});
  const recording={loginDisk:async(received:typeof input)=>{assert.deepEqual(received,input);}};
  await optionalLoginDiskHostContract(recording,{input});
  await assert.rejects(optionalLoginDiskHostContract(recording),/undefined/);
  await assert.rejects(optionalLoginDiskHostContract(recording,{input,code:'wrong-volume'}),/Missing expected rejection/);
  await assert.rejects(optionalLoginDiskHostContract({loginDisk:async()=>{throw Object.assign(new Error('planted'),{code:'wrong-code'});}},{input,code:'wrong-volume'}));
});


test('optional terminal printer contract covers absence and its exact session command', async () => {
  const { optionalTerminalHostContract } = await import('./host-contract.ts');
  const { localHost } = await import('../src/host/local.ts');
  const local = localHost();
  optionalTerminalHostContract(local);
  const supplied = { ...local, terminalAttachCommand: (name: string) => {
    assert.equal(name, 'worker');
    return 'ssh fixture';
  } };
  optionalTerminalHostContract(supplied, 'ssh fixture');
  assert.throws(() => optionalTerminalHostContract(supplied, 'wrong command'), /ssh fixture/);
});

test('optional capacity contract covers absence, report delivery and unsubscribe with positive controls', async () => {
  const { optionalCapacityHostContract } = await import('./host-contract.ts');
  const { localHost } = await import('../src/host/local.ts');
  await optionalCapacityHostContract(localHost());
  const listeners = new Set<(bytes: number) => void>();
  const publish = (bytes: number) => { for (const listener of listeners) listener(bytes); };
  const observed = (condition: () => boolean, what: string) => { assert.ok(condition(), what); };
  const host = { onCapacityChanged(listener: (bytes: number) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  await optionalCapacityHostContract(host, { publish, observed });
  assert.equal(listeners.size, 0);
  await assert.rejects(optionalCapacityHostContract(host, { publish: () => {}, observed }), /first capacity report/);
  assert.equal(listeners.size, 0);
  const leaky = { onCapacityChanged(listener: (bytes: number) => void) { listeners.add(listener); return () => {}; } };
  try { await assert.rejects(optionalCapacityHostContract(leaky, { publish, observed }), /unsubscribed capacity listener/); }
  finally { listeners.clear(); }
});

test('optional login-disk reachability preserves absent Hosts and exact boolean observations',async()=>{
 const {optionalLoginDiskReachabilityContract}=await import('./host-contract.ts');
 optionalLoginDiskReachabilityContract({});
 optionalLoginDiskReachabilityContract({loginDiskReachable:()=>true},true);
 optionalLoginDiskReachabilityContract({loginDiskReachable:()=>false},false);
 assert.throws(()=>optionalLoginDiskReachabilityContract({loginDiskReachable:()=>true},false));
});
