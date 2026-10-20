// T2: production launch against an in-process HTTP server; native process creation/identity are faked.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import type { SpawnRequest } from '../src/adapters/contract.ts';
import { OpenCodeClient } from '../src/adapters/opencode/client.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, projectHub, tempProject } from './harness.ts';

type Rule = { action: string; resource: string; effect: string };
async function fixture(t: TestContext) {
  const root = await tempProject(t);
  const servers: ReturnType<typeof createServer>[] = [];
  const sessions = new Map<string, Record<string, unknown>>();
  const logs: Record<string, unknown>[] = [];
  const launches: Array<{ args: string[]; env: NodeJS.ProcessEnv }> = [];
  t.mock.method(cp, 'spawn', (bin: string, args: string[], options: cp.SpawnOptions) => {
    if (bin === 'ps') throw new Error('synthetic process identity is absent');
    assert.equal(bin, 'fake-opencode');
    launches.push({ args, env: options.env! });
    const server = createServer(async (req, res) => {
      assert.equal(req.headers.authorization, `Basic ${Buffer.from(`opencode:${options.env!.OPENCODE_PASSWORD}`).toString('base64')}`);
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      let data: unknown = {};
      if (req.method === 'POST' && req.url === '/api/session') {
        data = { ...body, id: `ses_${sessions.size}` };
        sessions.set((data as { id: string }).id, data as Record<string, unknown>);
      } else if (req.url?.startsWith('/api/session/ses_')) data = sessions.get(req.url.split('/')[3]!);
      else if (req.url === '/api/model') data = [{ providerID: 'openai', id: 'gpt-5.2', variants: [{ id: 'high' }, { id: 'low' }] }];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data }));
    });
    server.listen(Number(args[args.indexOf('--port') + 1]), '127.0.0.1');
    servers.push(server);
    return Object.assign(new EventEmitter(), { pid: 99999999, exitCode: 0, signalCode: null, unref() {} });
  });
  syncBuiltinESMExports();
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: '', spoke: '', log: entry => { logs.push(entry); }, signal: () => {}, recordPid: () => {}, exited: () => {} }, { bin: 'fake-opencode', env: { HOME: root }, clock: new FakeClock() });
  t.after(async () => {
    adapter.close();
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(err => err ? reject(err) : resolve()); })));
    t.mock.restoreAll(); syncBuiltinESMExports();
  });
  async function launch(policy: Partial<SpawnRequest>) {
    const process = await adapter.spawn({ name: `impl-${sessions.size}`, cwd: root, role: null, model: 'openai/gpt-5.2', ...policy });
    // Read back through the same authenticated HTTP surface a native client uses.
    const client = new OpenCodeClient(process.harnessId!, (await readFile(join(root, '.cland/opencode', process.name, 'password'), 'utf8')).trim());
    const stored = await client.request<{ data: { permissions?: Rule[]; model?: unknown } }>('GET', `/api/session/${process.harnessSessionId}`);
    return { process, stored: stored.data, log: logs.findLast(entry => entry.event === 'harness-launched')! };
  }
  return { root, launch, adapter, launches };
}

test('OpenCode launches leave native permissions unset even with explicit launch policy', { timeout: 2000 }, async t => {
  const f = await fixture(t);
  for (const policy of [
    {},
    { approval: 'never', sandbox: { mode: 'read-only', writableRoots: [], network: 'none' } },
    { permissions: 'skip', approval: 'untrusted', sandbox: { mode: 'workspace-write', writableRoots: ['/shared'], network: 'full' } },
  ] satisfies Partial<SpawnRequest>[]) {
    const { stored, log } = await f.launch(policy);
    assert.equal(stored.permissions, undefined);
    assert.deepEqual((log.policy as { rules: Rule[] }).rules, []);
  }
});

test('OpenCode effort selects a catalog variant with explicit model variants taking precedence', { timeout: 2000 }, async t => {
  const f = await fixture(t);
  for (const [model, effort, expected, warning] of [
    ['openai/gpt-5.2', 'high', { providerID: 'openai', id: 'gpt-5.2', variant: 'high' }, false],
    ['openai/gpt-5.2#low', 'high', { providerID: 'openai', id: 'gpt-5.2', variant: 'low' }, false],
    ['openai/gpt-5.2', 'missing', { providerID: 'openai', id: 'gpt-5.2' }, true],
  ] as const) {
    const result = await f.launch({ model, effort });
    assert.deepEqual(result.stored.model, expected);
    assert.equal(result.process.model, `openai/gpt-5.2${'variant' in expected ? `#${expected.variant}` : ''}`);
    assert.equal(((result.log.policy as { warnings?: string[] }).warnings ?? []).some(x => x.includes(effort)), warning);
  }
});


test('the item rule confines paths independently of ignored launch policy', { timeout: 2000 }, async t => {
  const f = await fixture(t);
  const effect = (rules: Rule[], action: string, resource: string) => rules.filter(rule => {
    const matches = (pattern: string, value: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(value);
    return matches(rule.action, action) && matches(rule.resource, resource);
  }).at(-1)?.effect;
  for (const permissions of [null, 'skip'] as const) {
    const { stored } = await f.launch({ item: 'T-1', permissions, approval: 'never', sandbox: { mode: 'workspace-write', writableRoots: ['/shared'], network: 'full' } });
    for (const path of ['/shared/file', '/outside/file', `${f.root}-sibling/file`, '../sibling/file']) assert.equal(effect(stored.permissions!, 'edit', path), 'deny', path);
    for (const path of ['file', 'src/file']) assert.equal(effect(stored.permissions!, 'edit', path), undefined, `${path}: native policy governs internal relative paths`);
    assert.equal(effect(stored.permissions!, 'edit', `${f.root}/src/file`), 'allow');
    assert.equal(effect(stored.permissions!, 'external_directory', '/shared/*'), 'deny');
  }
  const readOnly = await f.launch({ item: 'T-1', sandbox: { mode: 'read-only', writableRoots: [], network: 'none' } });
  assert.equal(effect(readOnly.stored.permissions!, 'edit', `${f.root}/file`), 'allow', 'ignored read-only policy does not replace native settings');
});

test('OpenCode role launch frames preserve native policy for inherited and explicit keys', { timeout: 2000 }, async t => {
  const f = await fixture(t);
  const spawn = f.adapter.spawn.bind(f.adapter);
  f.adapter.spawn = async (...args) => ({ ...await spawn(...args), pid: null });
  const { discovery } = await projectHub(t, f.root, {}, { clock: new FakeClock(), adapters: [() => f.adapter] });
  const roles = join(f.root, '.cland/roles.toml');
  const ui = await connectUi(t, discovery);
  for (const [name, policy] of [
    ['inherited', ''],
    ['explicit', 'approval = "untrusted"\nsandbox = "read-only"\nnetwork = "none"\npermissions = "skip"\n'],
  ]) {
    await writeFile(roles, `[implementer.launch]\nharness = "opencode"\nmodel = "openai/gpt-5.2"\neffort = "high"\n${policy}`);
    const result = await ui.request({ type: 'session.launch', name, role: 'implementer' });
    assert.equal(result.ok, true, result.error);
    const process = (result.value as { process: { harnessId: string; harnessSessionId: string } }).process;
    const password = (await readFile(join(f.root, '.cland/opencode', name!, 'password'), 'utf8')).trim();
    const native = await new OpenCodeClient(process.harnessId, password).request<{ data: { permissions?: Rule[]; model: unknown } }>('GET', `/api/session/${process.harnessSessionId}`);
    assert.equal(native.data.permissions, undefined);
    assert.deepEqual(native.data.model, { providerID: 'openai', id: 'gpt-5.2', variant: 'high' });
    const launched = f.launches.at(-1)!;
    assert.deepEqual(launched.args.slice(0, -1), ['serve', '--hostname', '127.0.0.1', '--port']);
    assert.deepEqual(Object.keys(launched.env).filter(key => /approval|sandbox|permission/i.test(key)), []);
    const config = JSON.parse(await readFile(launched.env.OPENCODE_CONFIG!, 'utf8'));
    assert.deepEqual(Object.keys(config).sort(), ['$schema', 'mcp']);
  }
  await ui.request({ type: 'hub.status', flushLogs: true });
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
  const records = journal.filter(row => row.event === 'session-launched');
  assert.equal(records.length, 2);
  for (const record of records) assert.deepEqual(record.policy.rules, []);
});
