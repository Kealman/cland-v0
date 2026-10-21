// Local diagnostic, not a suite: copy only tracker files; execute in a sealed disposable hub.
// node hub/scripts/measure-idle.ts /absolute/project/.cland/tasks
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { projectHub, tempProject } from '../test/harness.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { queueWaitMetrics } from '../src/hub/verification-wait.ts';

if (process.argv.length !== 3) throw new Error('usage: node hub/scripts/measure-idle.ts /absolute/project/.cland/tasks');
const source = resolve(process.argv[2]!);
test('ten-minute copied-tracker idle CPU diagnostic', { timeout: 660_000 }, async t => {
  const root = await tempProject(t, 'cland-idle-copy-');
  const tasks = join(root, '.cland/tasks');
  await mkdir(tasks, { recursive: true });
  const names = (await readdir(source)).filter(name => /^[A-Z]-\d+-.*\.md$/.test(name));
  for (const name of names) await cp(join(source, name), join(tasks, name));
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  const ts = new Date().toISOString();
  for (let i = 0; i < 250; i++) table.put({ name: `crew-${i}`, role: null,
    stoppedAt: ts, harness: 'codex', model: null, cwd: root,
    pid: null, harnessId: null, sessionId: `crew-id-${i}`, harnessSessionId: null,
    startedAt: ts, status: 'stopped' });
  table.close();
  const sweeps: Array<Record<string, unknown>> = [];
  const hub = await projectHub(t, root, {}, { log: entry => {
    if (entry.event === 'session-archive-sweep') sweeps.push(entry);
  } });
  try {
    // Setup/startup is excluded; no client requests are sent in the sample.
    await delay(1000);
    assert.equal(sweeps.length, 1);
    assert.equal(sweeps[0]!.rows, 250);
    console.log(JSON.stringify({ event: 'idle-start', at: new Date().toISOString(), platform: `${process.platform}/${process.arch}`, source, trackerFiles: names.length, sessionRows: 250, pid: process.pid,
      note: 'Embedded projectHub with real clock and socket edges; fixture adapters/native probes and scratch HOME/XDG/Git/accounts. CPU includes sampler/test worker; no native harness process or live workbench. No suite/gate claim.' }));
    const started = performance.now(), cpu = process.cpuUsage();
    let previous = started, previousCpu = cpu;
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await delay(Math.max(0, started + (i + 1) * 60_000 - performance.now()));
      const now = performance.now(), usage = process.cpuUsage();
      const sample = { event: 'idle-minute', minute: i + 1, elapsedMs: now - previous,
        cpuPercent: (usage.user + usage.system - previousCpu.user - previousCpu.system) / ((now - previous) * 10), rssBytes: process.memoryUsage().rss, sweeps: sweeps.length };
      samples.push(sample); console.log(JSON.stringify(sample));
      previous = now; previousCpu = usage;
    }
    const elapsedMs = previous - started;
    const meanCpuPercent = (previousCpu.user + previousCpu.system - cpu.user - cpu.system) / (elapsedMs * 10);
    console.log(JSON.stringify({ event: 'idle-result', at: new Date().toISOString(), elapsedMs, meanCpuPercent, sweepCountIncludingStartup: sweeps.length, samples }));
    assert.ok(meanCpuPercent < 2, `mean process CPU ${meanCpuPercent.toFixed(3)}% must be under 2%`);
    assert.equal(sweeps.length, 1, 'only the startup scan ran');
    // Separate CPU work, after the quiet sample. Exercise the actual hourly metric function.
    const now = Date.now();
    const jobs = Array.from({ length: 10_000 }, (_, i) => ({ executor: i % 2 ? 'local' as const : 'droplet' as const,
      queued: new Date(now - i * 60_000 - 2000).toISOString(), admittedAt: new Date(now - i * 60_000 - 1000).toISOString(), finished: new Date(now - i * 60_000).toISOString() }));
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const metrics = queueWaitMetrics(jobs, now, 1_200_000);
      times.push(performance.now() - start);
      assert.equal(metrics.last50Runs.local.count, 50);
      assert.equal(metrics.last50Runs.local.p90Ms, 1000);
    }
    console.log(JSON.stringify({ event: 'hourly-p90-diagnostic', rows: jobs.length, samplesMs: times, maxMs: Math.max(...times), note: 'Separate pure computation; excluded from idle CPU sample; not a suite timing gate.' }));
  } finally { await hub.stop(); await hub.stopped; console.log('SCRATCH HUB STOPPED'); }
});
