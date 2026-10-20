// P3 from research/opencode-v2: exercise the real boot sweep with a local, hanging provider.
// HOME and all XDG paths are scratch-owned; no model call leaves this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onCleanup, rememberProcess } from './process-cleanup.ts';
import { connectUi, eventually, killDaemon, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { which } from '../src/doctor/report.ts';

// harness.ts prepends the fake executables to PATH; this proof must bypass those entries.
const fakes = fileURLToPath(new URL('./fakes/', import.meta.url));
const binary = which('opencode', { ...process.env, PATH: process.env.PATH?.split(delimiter).filter(dir => !resolve(dir).startsWith(fakes)).join(delimiter) });

test('OpenCode service sweeps its default database without resuming a cland session (P3)', { skip: !binary && 'real opencode binary is not installed', timeout: 90000 }, async t => {
  const root = await tempProject(t, 'cland-opencode-p3-');
  const dirs = Object.fromEntries(['home', 'data', 'config', 'state', 'cache', 'tmp', 'project'].map(key => [key, join(root, key)]));
  for (const dir of Object.values(dirs)) await mkdir(dir, { recursive: true });
  const requests: string[] = [];
  const held: ServerResponse[] = [];
  const writers: Array<() => Promise<unknown>> = [];
  const provider = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.method === 'POST') {
        requests.push(String(req.headers['x-opencode-session-id'] ?? req.headers['x-opencode-session'] ?? req.headers['x-session-id']));
        held.push(res); // Hold execution claims in flight until cleanup.
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'slow', object: 'model' }] }));
      }
    });
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  onCleanup(t, async () => {
    const stopped = await Promise.allSettled(writers.reverse().map(stop => stop()));
    for (const res of held) res.destroy();
    provider.closeAllConnections();
    await new Promise<void>(resolve => provider.close(() => resolve()));
    for (const result of stopped) if (result.status === 'rejected') throw result.reason;
  });
  const address = provider.address();
  assert.ok(address && typeof address !== 'string');
  const config = { model: 'hang/slow', providers: { hang: { name: 'Local hanging provider', package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${address.port}/v1`, apiKey: 'scratch-fake-key' }, models: { slow: { modelID: 'slow', capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } } } };
  await mkdir(join(dirs.config!, 'opencode'));
  await writeFile(join(dirs.config!, 'opencode', 'opencode.json'), JSON.stringify(config));
  const env = { HOME: dirs.home!, XDG_DATA_HOME: dirs.data!, XDG_CONFIG_HOME: dirs.config!, XDG_STATE_HOME: dirs.state!, XDG_CACHE_HOME: dirs.cache!, TMPDIR: dirs.tmp!, OPENCODE_DB: '', OPENCODE_CONFIG: '', OPENCODE_CONFIG_CONTENT: '', CLAND_OPENCODE_BIN: binary!, CLAND_ADAPTER_POLL_MS: '50' };
  const { discovery } = await projectHub(t, dirs.project!, env);
  const ui = await connectUi(t, discovery);
  let clandName: string | undefined;
  writers.push(async () => { if (clandName) assert.equal((await ui.request({ type: 'session.stop', session: clandName }, 30000)).ok, true); });
  const launched = await ui.request({ type: 'session.launch', name: 'isolated', harness: 'opencode', model: 'hang/slow', cwd: dirs.project }, 30000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { name: string; harnessId: string; harnessSessionId: string } }).process;
  clandName = p.name;
  const password = (await readFile(join(dirs.project!, '.cland', 'opencode', p.name, 'password'), 'utf8')).trim();
  const api = (url: string, password: string) => async (method: string, path: string, body?: unknown) => {
    const res = await fetch(url + path, { method, headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    assert.equal(res.ok, true, `${method} ${path}: ${res.status}`);
    return await res.json() as { data: Record<string, unknown> };
  };
  const a = api(p.harnessId, password);
  const info = await a('GET', '/api/info') as unknown as { version: string };
  assert.doesNotMatch(info.version, /fake/);
  t.diagnostic(`real OpenCode ${info.version}; isolated HOME/XDG/database under ${root}`);
  await eventually('scratch config registers the local fake provider', async () => {
    const models = await a('GET', '/api/model') as unknown as { data: Array<{ providerID: string; id: string }> };
    return models.data.some(model => model.providerID === 'hang' && model.id === 'slow') || undefined;
  }, 30000);
  await a('POST', `/api/session/${p.harnessSessionId}/prompt`, { text: 'Say hello.' });
  try {
    await eventually('cland session reaches hanging provider', () => requests.includes(p.harnessSessionId) || undefined, 30000);
  } catch (error) {
    t.diagnostic(`provider session headers: ${JSON.stringify(requests)}`);
    const messages = await a('GET', `/api/session/${p.harnessSessionId}/message?limit=20`) as unknown as { data: Array<{ error?: { type: string; message: string } }> };
    t.diagnostic(`execution errors: ${JSON.stringify(messages.data.flatMap(message => message.error ? [message.error] : []))}`);
    throw error;
  }

  async function start(service: boolean) {
    // cland-allow-child-env: native OpenCode database/service contract supplies a literal scratch HOME/XDG environment and synthetic password
    const child = spawn(binary!, ['serve', ...(service ? ['--service'] : []), '--hostname', '127.0.0.1', '--port', '0'], {
      cwd: dirs.project,
      env: { PATH: '/usr/bin:/bin', HOME: dirs.home, XDG_DATA_HOME: dirs.data, XDG_CONFIG_HOME: dirs.config, XDG_STATE_HOME: dirs.state, XDG_CACHE_HOME: dirs.cache, TMPDIR: dirs.tmp, OPENCODE_PASSWORD: 'scratch-password' },
      stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    rememberProcess(child.pid, root);
    writers.push(async () => { if (child.pid) await killDaemon(child.pid); });
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    child.on('error', error => { output += error.message; });
    if (service) {
      const registration = await eventually('scratch service registers', async () => {
        try { return JSON.parse(await readFile(join(dirs.state!, 'opencode', 'service.json'), 'utf8')) as { url: string; password: string }; }
        catch { return undefined; }
      }, 30000);
      return api(registration.url, registration.password);
    }
    const url = await eventually('scratch OpenCode server listens', () => /listening on (https?:\/\/[^\s]+)/.exec(output)?.[1], 30000);
    return api(url, 'scratch-password');
  }
  // Positive control: the same service must really sweep a suspended execution in its database.
  const seed = await start(false);
  const control = await seed('POST', '/api/session', { title: 'sweep control', model: { providerID: 'hang', id: 'slow' }, location: { directory: dirs.project } });
  const controlId = String(control.data.id);
  await seed('POST', `/api/session/${controlId}/prompt`, { text: 'Say hello.' });
  await eventually('control starts its first request', () => requests.includes(controlId) || undefined, 30000);
  const service = await start(true);
  await eventually('service resumes the default-database control', () => requests.filter(id => id === controlId).length >= 2 || undefined, 30000);
  const active = await service('GET', '/api/session/active');
  assert.ok(Object.hasOwn(active.data, controlId));
  assert.ok(!Object.hasOwn(active.data, p.harnessSessionId));
  assert.equal(requests.filter(id => id === p.harnessSessionId).length, 1, 'service must not issue a second request for the cland session');
  assert.ok(Object.hasOwn((await a('GET', '/api/session/active')).data, p.harnessSessionId));
});
