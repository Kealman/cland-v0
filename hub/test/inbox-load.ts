// Manual, quiet-machine comparison: node hub/test/inbox-load.ts
// Not a suite test: five seconds of paced adapter traffic and protocol latency samples.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { serveProject } from '../src/hub/daemon.ts';
import { createStdioEdge } from '../src/hub/stdio.ts';
import { ProcessTable } from '../src/adapters/processes.ts';

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const root = await mkdtemp(join(tmpdir(), 'cland-inbox-load-'));
await mkdir(join(root, '.cland'));
const db = join(root, '.cland/hub.db'), ts = new Date().toISOString();
const seed = new Store(db);
seed.transaction(() => {
  for (let topic = 0; topic < 300; topic++) {
    seed.createTopic(`history-${topic}`, `History ${topic}`, null, ts);
    for (let i = 0; i < 10; i++) seed.record({ id: `old-${topic}-${i}`, topic: `history-${topic}`, from: 'old', fromKind: i === 9 ? 'human' : 'agent', via: 'session', to: [], text: 'Retained history', ts }, [], Date.now());
  }
});
seed.close();
let measuring = false, preparations = 0, executions = 0, rebuilds = 0;
const openDatabase = (path: string) => {
  const db = new DatabaseSync(path), prepare = db.prepare;
  db.prepare = function(sql) {
    if (measuring) preparations++;
    const statement = prepare.call(this, sql);
    for (const method of ['get', 'all', 'run'] as const) {
      const execute = statement[method];
      statement[method] = function(...bindings: unknown[]) {
        if (measuring) {
          executions++;
          if (sql.includes('with latest_messages as')) rebuilds++;
        }
        return Reflect.apply(execute, this, bindings);
      };
    }
    return statement;
  };
  return db;
};
const daemon = await serveProject(root, { openDatabase, log: () => {}, env: { ...process.env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '60000' } });
const clients: Array<() => void> = [];
function client(hello: Record<string, unknown>) {
  const input = new PassThrough(), output = new PassThrough();
  let pending = '', sequence = 0;
  const waiting = new Map<string, (frame: Record<string, unknown>) => void>();
  output.setEncoding('utf8');
  output.on('data', (chunk: string) => {
    pending += chunk;
    let end: number;
    while ((end = pending.indexOf('\n')) >= 0) {
      const frame = JSON.parse(pending.slice(0, end)) as Record<string, unknown>;
      pending = pending.slice(end + 1);
      const done = waiting.get(String(frame.id));
      if (done) { waiting.delete(String(frame.id)); done(frame); }
    }
  });
  createStdioEdge({ input, output, dispatcher: daemon.hub.dispatcher, onEnd: () => {} });
  input.write(JSON.stringify({ type: 'hello', protocol: 2, ...hello }) + '\n');
  clients.push(() => { input.end(); output.end(); });
  return (frame: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const id = `sample-${sequence++}`;
    const deadline = setTimeout(() => { waiting.delete(id); reject(new Error(`protocol request ${id} timed out`)); }, 10_000);
    waiting.set(id, frame => { clearTimeout(deadline); resolve(frame); });
    input.write(JSON.stringify({ ...frame, id }) + '\n');
  });
}
try {
  const human = client({ client: 'ui' });
  const created = await human({ type: 'task.create', title: 'Latency target', size: 'M' });
  assert.equal(created.ok, true);
  const item = (created.value as { item: { id: string } }).item.id;
  await human({ type: 'role.set', session: 'verifier', role: 'reviewer' });
  const verifier = client({ name: 'verifier', sessionId: 'verifier-id', cwd: root });
  await verifier({ type: 'ping' });
  const table = new ProcessTable(db);
  for (let i = 0; i < 20; i++) {
    const name = `fake-${i}`, sessionId = `fake-id-${i}`;
    table.put({ name, sessionId, harness: 'claude-code', role: null, model: null, cwd: root, pid: null, harnessId: null, harnessSessionId: null, startedAt: ts, status: 'running' });
    daemon.hub.core.seedProcess({ name, sessionId, harness: 'claude-code', role: null, model: null, cwd: root, pid: null, harnessId: null, harnessSessionId: null, startedAt: ts, status: 'running', item: null, state: 'idle', attach: null });
  }
  table.close();
  await pause(300);
  const hold: number[] = [], comment: number[] = [], bursts: number[] = [];
  const load1m = loadavg()[0];
  const cpu = process.cpuUsage(), start = performance.now();
  measuring = true;
  try {
    for (let round = 0; round < 5; round++) {
      const before = rebuilds;
      for (let i = 0; i < 20; i++) {
        const due = start + (round * 20 + i) * 50;
        await pause(Math.max(0, due - performance.now()));
        // Each fake launch reports usage and changes state; state also announces through the real hub.
        for (const event of ['mod-turn-start', 'mod-turn-complete']) {
          const result = await human({ type: 'session.signal', session: `fake-${i}`, launch: `fake-id-${i}`, event, payload: { usage: { output_tokens: 1 } } });
          assert.equal(result.ok, true, JSON.stringify(result));
        }
        let at = performance.now();
        assert.equal((await verifier({ type: 'task.hold', item, release: true })).ok, true);
        hold.push(performance.now() - at);
        at = performance.now();
        assert.equal((await human({ type: 'task.comment', item, text: `Sample ${round}-${i}` })).ok, true);
        comment.push(performance.now() - at);
      }
      bursts.push(rebuilds - before);
    }
    await pause(Math.max(0, start + 5000 - performance.now()));
    const elapsedMs = performance.now() - start, used = process.cpuUsage(cpu);
    const p95 = (samples: number[]) => samples.sort((a, b) => a - b)[Math.ceil(samples.length * .95) - 1];
    console.log(JSON.stringify({ requests: 400, preparations, executions, load1m, elapsedMs, cpuMs: (used.user + used.system) / 1000, cpuPercent: (used.user + used.system) / (elapsedMs * 10), holdP95Ms: p95(hold), commentP95Ms: p95(comment), rebuilds, rebuildsPerSecond: bursts }, null, 2));
  } finally { measuring = false; }
} finally {
  for (const close of clients) close();
  await daemon.stop();
  await rm(root, { recursive: true, force: true });
}
