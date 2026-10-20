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

// Pure environment policy: no process or real credential is needed.
test('executor credentials are stripped by name without reading values or changing the API environment', async () => {
  const { withoutExecutorCredentials } = await import('../../shared/executor-credentials.ts');
  const { machineEnv } = await import('../src/executor/droplet/machine.ts');
  const { suiteTestEnv } = await import('../src/verification-occasion.ts');
  const base = { PATH: '/fixture/bin', ANTHROPIC_API_KEY: 'test-harness-key' };
  Object.defineProperty(base, 'DIGITALOCEAN_TOKEN', { enumerable: true, get: () => { throw new Error('credential value must not be read'); } });
  for (const filter of [withoutExecutorCredentials, machineEnv, suiteTestEnv.bind(null, undefined)]) {
    const env = filter(base);
    assert.equal(Object.hasOwn(env, 'DIGITALOCEAN_TOKEN'), false);
    assert.equal(env.PATH, '/fixture/bin');
    assert.equal(env.ANTHROPIC_API_KEY, 'test-harness-key', 'harness authentication remains available');
    assert.equal(Object.hasOwn(base, 'DIGITALOCEAN_TOKEN'), true, 'hub API environment is intact');
  }
});
