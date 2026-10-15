// Catalog edge cases below the hub frame: only the native transport is replaced.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { once } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { OpenCodeAdapter } from './opencode.ts';
import { OpenCodeClient, type ModelEntry } from './opencode/client.ts';
import { tempProject } from '../../test/harness.ts';

async function catalogAdapter(t: TestContext, catalog: () => ModelEntry[]) {
  const root = await tempProject(t);
  const children: cp.ChildProcess[] = [];
  const spawn = cp.spawn;
  t.mock.method(cp, 'spawn', (bin: string, args: string[], options: cp.SpawnOptions) => {
    if (bin !== 'fake-harness') return spawn(bin, args, options);
    const child = spawn(process.execPath, ['-e', "console.log('server listening on http://127.0.0.1:1');setInterval(()=>{},1000)"], options);
    children.push(child);
    return child;
  });
  syncBuiltinESMExports();
  t.mock.method(OpenCodeClient.prototype, 'models', async () => catalog());
  t.mock.method(OpenCodeClient.prototype, 'createSession', async () => ({ id: 'session-model' }));
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} }, { bin: 'fake-harness' });
  t.after(async () => {
    adapter.close();
    for (const child of children) if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, 'exit'); }
    t.mock.restoreAll(); syncBuiltinESMExports();
  });
  return () => adapter.spawn({ name: 'impl', role: null, model: null, cwd: root });
}

const model = (providerID: string, id: string): ModelEntry => ({ providerID, id, cost: [{ input: 0, output: 0 }], capabilities: { tools: true } });

test('a no-model OpenCode launch waits for big-pickle after a partial cold catalog', async t => {
  let calls = 0;
  const spawn = await catalogAdapter(t, () => ++calls === 1 ? [model('openrouter', 'partial-free')] : [model('opencode', 'big-pickle')]);
  const launched = await spawn();
  assert.equal(launched.model, 'opencode/big-pickle');
  assert.ok(calls >= 2, 'the first partial answer cannot end selection');
});

test('a changing OpenCode catalog falls back to the latest successful list at the deadline', async t => {
  let calls = 0;
  const spawn = await catalogAdapter(t, () => {
    calls++;
    if (calls === 2) t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 10_000 });
    return [model('openrouter', calls === 1 ? 'first-free' : 'latest-free')];
  });
  try {
    const launched = await spawn();
    assert.equal(launched.model, 'openrouter/latest-free');
  } finally { t.mock.timers.reset(); }
});
