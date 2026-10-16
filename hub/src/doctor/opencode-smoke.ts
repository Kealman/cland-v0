// Release probe: a real, exact-version OpenCode server talks only to a loopback fake provider.
// P1's authenticated HTTP/SSE checks plus P3's isolated provider/database, with an answering provider.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { OpenCodeClient } from '../adapters/opencode/client.ts';

async function until(predicate: () => boolean | Promise<boolean>, label: string, timeout = 30_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`timeout waiting for ${label}`);
}

export class OpenCodeCleanupError extends Error {}

async function stop(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) return;
  const signal = (value: NodeJS.Signals) => {
    try { process.kill(-pid, value); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  const groupAlive = () => {
    try { process.kill(-pid, 0); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
  };
  signal('SIGTERM');
  const timer = setTimeout(() => signal('SIGKILL'), 5000);
  try {
    await until(() => (child.exitCode !== null || child.signalCode !== null) && !groupAlive(), 'server process group to exit', 10_000);
    assert.equal(groupAlive(), false);
  } catch {
    throw new OpenCodeCleanupError('server cleanup incomplete; preserve scratch directory for inspection');
  } finally { clearTimeout(timer); }
}

export async function smokeOpenCode(bin: string, scratch: string, version: string): Promise<void> {
  const dirs = Object.fromEntries(['home', 'data', 'config', 'state', 'cache', 'tmp', 'project'].map(d => [d, join(scratch, d)]));
  for (const dir of Object.values(dirs)) await mkdir(dir, { recursive: true });
  let chats = 0;
  const provider = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.url?.endsWith('/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'smoke', object: 'model' }] }));
      } else if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        chats++;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const base = { id: 'chatcmpl-smoke', object: 'chat.completion.chunk', created: 1, model: 'smoke' };
        res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'cland smoke ok' }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\n`);
        res.end('data: [DONE]\n\n');
      } else { res.writeHead(404); res.end(); }
    });
  });
  const abort = new AbortController();
  let stream: Promise<void> | undefined;
  let child: ChildProcess | undefined;
  try {
    provider.listen(0, '127.0.0.1');
    await once(provider, 'listening');
    const providerAddress = provider.address();
    assert.ok(providerAddress && typeof providerAddress !== 'string');
    const config = join(scratch, 'opencode.json');
    await writeFile(config, JSON.stringify({
      model: 'cland-smoke/smoke', update: 'disable',
      agents: Object.fromEntries(['build', 'plan', 'general', 'explore', 'compaction', 'title', 'summary'].map(name => [name, { model: 'cland-smoke/smoke' }])),
      providers: { 'cland-smoke': { name: 'Local fake provider', package: '@opencode/ai/providers/openai-compatible',
        settings: { baseURL: `http://127.0.0.1:${providerAddress.port}/v1`, apiKey: 'fake-no-secret' },
        models: { smoke: { modelID: 'smoke', capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } } },
    }));
    const password = randomBytes(16).toString('hex');
    const env = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: dirs.home!, USER: 'cland-smoke', LANG: 'en_US.UTF-8', TERM: 'dumb',
      TMPDIR: dirs.tmp!, XDG_DATA_HOME: dirs.data!, XDG_CONFIG_HOME: dirs.config!, XDG_STATE_HOME: dirs.state!, XDG_CACHE_HOME: dirs.cache!,
      OPENCODE_DB: join(dirs.data!, 'smoke.db'), OPENCODE_CONFIG: config, OPENCODE_PASSWORD: password };
    child = spawn(bin, ['serve', '--hostname', '127.0.0.1', '--port', '0'], { cwd: dirs.project!, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const serverChild = child;
    let output = '';
    let spawnError: Error | undefined;
    child.on('error', error => { spawnError = error; });
    child.stdout!.on('data', b => { output = (output + String(b)).slice(-32_000); });
    child.stderr!.on('data', b => { output = (output + String(b)).slice(-32_000); });
    await until(() => {
      if (spawnError) throw spawnError;
      if (serverChild.exitCode !== null || serverChild.signalCode !== null) throw new Error('OpenCode server exited before listening');
      return /listening on (https?:\/\/[^\s]+)/.test(output);
    }, 'isolated server readiness');
    const url = /listening on (https?:\/\/[^\s]+)/.exec(output)![1]!;
    const client = new OpenCodeClient(url, password);
    const info = await client.request<{ version: string; data?: { version: string } }>('GET', '/api/info');
    assert.equal(info.data?.version ?? info.version, version, 'smoke must run the exact newest 2.x binary');
    const noAuth = await fetch(`${url}/api/session/active`, { signal: AbortSignal.timeout(5000) });
    assert.equal(noAuth.status, 401, 'server requires its scratch password');
    const events: Array<{ type: string; data?: Record<string, unknown> }> = [];
    let opened = false;
    let streamError: unknown;
    stream = client.events(event => events.push(event), () => { opened = true; }, abort.signal).catch(error => { if (!abort.signal.aborted) streamError = error; });
    await until(() => { if (streamError) throw streamError; return opened; }, 'authenticated SSE');
    await client.models();
    const session = await client.createSession({ title: 'cland compatibility smoke', model: { providerID: 'cland-smoke', id: 'smoke' }, directory: dirs.project! });
    assert.ok(session.id);
    assert.equal(session.model?.providerID, 'cland-smoke');
    assert.equal(session.model.id, 'smoke');
    assert.equal((await client.session(session.id))?.id, session.id);
    await client.moveSession(session.id, dirs.project!);
    const admitted = await client.prompt(session.id, 'Say hello.', 'queue', 10_000);
    assert.ok(admitted.id, 'prompt admitted into the inbox');
    await until(() => {
      if (streamError) throw streamError;
      const end = events.find(e => e.data?.sessionID === session.id && /^session\.execution\.(succeeded|failed|interrupted)$/.test(e.type));
      if (end && end.type !== 'session.execution.succeeded') throw new Error(`smoke turn ended with ${end.type}: ${JSON.stringify(end.data?.error ?? null).slice(0, 500)}`);
      return chats > 0 && end?.type === 'session.execution.succeeded';
    }, 'fake-provider turn completion');
    for (const type of ['session.execution.started', 'session.step.started', 'session.step.ended', 'session.inbox.delivered'])
      assert.ok(events.some(e => e.type === type && e.data?.sessionID === session.id), `observed ${type}`);
    await until(async () => !(await client.snapshot(session.id)).running, 'session to leave the active snapshot', 5000);
    assert.equal((await client.snapshot(session.id)).running, false);
    const messages = await client.request<{ data: Array<{ id: string; type: string }> }>('GET', `/api/session/${session.id}/message`);
    const assistant = messages.data.find(m => m.type === 'assistant');
    assert.ok(assistant, 'fake provider produced an assistant message');
    await client.request('GET', `/api/session/${session.id}/message/${assistant.id}`);
  } finally {
    abort.abort();
    await stream;
    try { if (child) await stop(child); }
    finally {
      provider.closeAllConnections();
      if (provider.listening) await new Promise<void>((resolve, reject) => provider.close(error => error ? reject(error) : resolve()));
    }
  }
}
