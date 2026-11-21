// T3 lifecycle: real candidate/package completion and native CJS/ESM producer loading.
import { pollerDeadline } from './fakes/finish-poller.ts';
import { beforeDirectories, cleanupProcesses, fixtureProcessCensus, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile, type ChildProcess } from 'node:child_process';
import { caseDeadlines } from './case-deadlines.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testDeadlineMs } from './until.ts';
import { join } from 'node:path';
import { fixture } from './suite-fixture.ts';
import { cacheRepository } from './suite-support.ts';
import { eventually } from './harness.ts';
import type { HubStatus } from '../src/protocol.ts';

const barrier = `import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
${pollerDeadline()}
writeFileSync('.cland/entered', '');
while (!existsSync('.cland/finish')) await new Promise(r => setTimeout(r, 10));
appendFileSync('executions', 'run\\n'); writeFileSync('.cland/completed', '');`;

for (const format of ['cjs', 'mjs'] as const) test(`generated finish producer arms current budgets in ${format} host`, async t => {
  let child: ChildProcess | undefined;
  let completion: Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; callbackCode: number | null; errorCode?: string }> | undefined;
  const owner = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval }, releaseOnClose: () => {
    if (child?.pid && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  } });
  await owner.run(async step => {
    const prepared = await owner.wait('producer fixture and source setup', () => step(async () => {
      const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-producer-host-')));
      ownDirectory(owner.fixtures, root); owner.adoptRoot(root);
      const file = join(root, `producer.${format}`);
      const imports = format === 'mjs' ? "import assert from 'node:assert/strict'; import os from 'node:os';" : "const assert=require('node:assert/strict'); const os=require('node:os');";
      const body = `
delete process.env.CLAND_TEST_LOAD_FACTOR; delete process.env.CLAND_TEST_WAIT_MS; delete process.env.CLAND_SUITE_EXECUTOR;
let load=10; os.loadavg=()=>[load,load,load]; os.availableParallelism=()=>10;
const budgets=[]; let armed; let unrefs=0;
globalThis.setTimeout=(_callback,ms)=>{budgets.push(ms);armed.resolve(ms);return {unref(){unrefs++;return this;}}};
armed=Promise.withResolvers();
${pollerDeadline()}
assert.equal(await armed.promise,600000);
load=20; armed=Promise.withResolvers();
${pollerDeadline()}
assert.equal(await armed.promise,900000);
armed=Promise.withResolvers();
${pollerDeadline(123)}
assert.equal(await armed.promise,123); assert.equal(unrefs,3);
console.log(JSON.stringify({type:'producer-host-receipt',format:${JSON.stringify(format)},budgets,unrefs}));`;
      await writeFile(file, `${imports}\n${format === 'mjs' ? body : `(async()=>{${body}})().catch(error=>{console.error(error);process.exitCode=1;});`}`);
      return { root, file };
    }));
    await step(async () => {
      const result = Promise.withResolvers<{ stdout: string; stderr: string; callbackCode: number | null; errorCode?: string }>();
      child = execFile(process.execPath, [prepared.file], { cwd: prepared.root, env: fixtureEnvironment(prepared.root, process.env), timeout: testDeadlineMs(15000), maxBuffer: 65536, signal: t.signal }, (error, stdout, stderr) => {
        result.resolve({ stdout, stderr, callbackCode: error ? typeof error.code === 'number' ? error.code : null : 0, ...(error && typeof error.code === 'string' ? { errorCode: error.code } : {}) });
      });
      const captured = child;
      const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => captured.once('close', (code, signal) => resolve({ code, signal })));
      completion = owner.wait('original native producer and pipes closed', async () => {
        const [output, close] = await Promise.all([result.promise, closed]);
        assert.ok(captured.stdout?.destroyed && captured.stderr?.destroyed, 'native close includes producer pipes');
        return { ...output, ...close };
      });
      void completion.catch(() => {});
    });
    const receipt = await completion!;
    t.diagnostic(`producer native receipt ${JSON.stringify(receipt)}`);
    assert.equal(receipt.code, 0, receipt.stderr);
    assert.equal(receipt.signal, null);
    assert.equal(receipt.callbackCode, 0);
    assert.deepEqual(JSON.parse(receipt.stdout), { type: 'producer-host-receipt', format, budgets: [600000, 900000, 123], unrefs: 3 });
  });
});

for (const phase of ['queued', 'running'] as const) {
  for (const path of ['.cland/tasks/note.md', '.cland/RULES.md']) {
    test(`integrated ${phase} run covers a new head after committing ${path}`, async t => {
      const f = await fixture(t, 'node barrier.mjs');
      beforeDirectories(t, async () => {
        await cleanupProcesses(f.root, [], undefined, undefined, []);
        assert.deepEqual(fixtureProcessCensus(f.root), [], 'local candidate left live writers');
      });
      await writeFile(join(f.root, 'barrier.mjs'), barrier);
      const git = await cacheRepository(f);
      await git('checkout', 'dev');
      assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
      const head = await git('rev-parse', 'HEAD');
      const lock = join(f.root, 'suite.lock');
      if (phase === 'queued') await mkdir(lock);
      const run = await f.launch();
      if (phase === 'queued') assert.equal(run.pid, null);
      else await eventually('worker entered package test', () => stat(join(f.root, '.cland/entered')).then(() => true, () => undefined));

      await writeFile(join(f.root, path), 'administrative change\n');
      await git('add', '-f', path);
      await git('commit', '-m', 'administrative change');
      const advanced = await git('rev-parse', 'HEAD');
      assert.notEqual(advanced, head);
      if (phase === 'queued') await rm(lock, { recursive: true });
      await writeFile(join(f.root, '.cland/finish'), '');
      if (phase === 'running') await eventually('worker completed package test', () => stat(join(f.root, '.cland/completed')).then(() => true, () => undefined));
      const result = await eventually('integrated result', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
      assert.match(result.text, /auto exit 0/, result.text);
      const status = (await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus;
      const job = status.suites!.find(job => job.id === run.id)!;
      assert.equal(job.integrated, true);
      assert.equal(job.head, head, 'retain the submitted head as provenance');
      assert.equal(job.cover?.status, 'green');

      const reused = await f.launch();
      assert.equal(reused.cached?.run, run.id, 'the completed run covers the advanced head');
      const cached = await eventually('advanced-head cache result', async () => (await f.results()).find(m => m.id === `suite:${reused.id}`));
      assert.ok(cached.text.includes(`head ${advanced}`), cached.text);
      assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\n');
    });
  }
}

test('integrated running run rejects a source commit after package completion', async t => {
  const f = await fixture(t, 'node barrier.mjs');
  beforeDirectories(t, async () => {
    await cleanupProcesses(f.root, [], undefined, undefined, []);
    assert.deepEqual(fixtureProcessCensus(f.root), [], 'local candidate left live writers');
  });
  await writeFile(join(f.root, 'barrier.mjs'), barrier);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch();
  await eventually('worker entered package test', () => stat(join(f.root, '.cland/entered')).then(() => true, () => undefined));
  await writeFile(join(f.root, 'source'), 'changed suite input\n');
  await git('add', 'source');
  await git('commit', '-m', 'source change');
  await writeFile(join(f.root, '.cland/finish'), '');
  await eventually('worker completed package test', () => stat(join(f.root, '.cland/completed')).then(() => true, () => undefined));
  const result = await eventually('source change result', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  assert.match(result.text, /exit 1; cancelled: candidate tree changed/, result.text);
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus;
  assert.equal(status.suites!.find(job => job.id === run.id)!.cover?.cause, 'cancel-head');
});
