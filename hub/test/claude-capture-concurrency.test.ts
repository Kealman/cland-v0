// T3: native adopted process births exercise capture/reconciliation interleavings.
// Lifecycle: sealed scratch root; join every owned child and owner writes before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentProcesses } from '../src/host/agent/processes.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownProcess } from './process-cleanup.ts';
import { eventually } from './harness.ts';

for (const mode of ['same birth', 'different capture', 'second descendant', 'legacy direct'] as const) test(mode==='legacy direct'?'Claude direct stop accepts previous frame without captured pins':`Claude concurrent reconciliation: ${mode}`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'claude-capture-'));
  await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') });
  const trigger = join(root, 'trigger'), ready = join(root, 'ready');
  const builder = new URL('./fixture-environment.ts', import.meta.url).href;
  const script = join(root, 'parent.mjs');
  await writeFile(script, `import {watch,existsSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';import {fixtureEnvironment} from ${JSON.stringify(builder)};
const root=process.argv[2];const children=[];let count=0;const watcher=watch(root,()=>{const path=root+'/trigger';if(!existsSync(path))return;const n=Number(requireRead(path));while(count<n){count++;const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{env:fixtureEnvironment(root,process.env),stdio:'ignore'});children.push(child);writeFileSync(root+'/child-'+count,String(child.pid));}});
process.on('SIGTERM',()=>{watcher.close();for(const child of children)child.kill();});
import {readFileSync as requireRead} from 'node:fs';writeFileSync(root+'/ready','ready');`);
  const child = spawn(process.execPath, [script, root], { detached: true, stdio: 'ignore', env: fixtureEnvironment(root, env) });
  let closed = false; child.once('close', () => { closed = true; });
  assert.ok(child.pid);
  const cleanup = [ownProcess(undefined, child.pid)];
  let interleave: (() => Promise<void>) | undefined;
  let injected = 0, signals = 0;
  const owner = new AgentProcesses(join(root, 'agent'), env, () => {}, { beforeSignals: async () => { signals++; if(mode==='second descendant'&&injected===1)await inject(2); }, afterCapture: async () => {
    const work = interleave; interleave = undefined; await work?.();
  } });
  t.after(async () => { for (const clean of cleanup.reverse()) await clean(); await eventually('native parent close receipt', () => closed || undefined, 2000); assert.equal(closed, true); await owner.drain(); await rm(root, { recursive: true, force: true }); });
  await owner.load();
  await eventually('native parent armed receipt', () => readFile(ready, 'utf8').then(() => true).catch(() => undefined), 2000);
  const identity = await owner.identity(child.pid); assert.ok(identity);
  const worker = { pid: child.pid, identity };
  await owner.adopt(worker);
  const approved = (await owner.captureForStop(worker)).targets; assert.ok(approved);
  const inject = async (n: number) => {
    const observed = eventually('injected child native birth', async () => {
      try { const pid = Number(await readFile(join(root, 'child-'+n), 'utf8')); return await owner.identity(pid) ? pid : undefined; } catch { return undefined; }
    }, 2000);
    await writeFile(trigger, String(n)); const pid = await observed; cleanup.push(ownProcess(undefined, pid)); injected = n; return pid;
  };
  const first = await inject(1);
  let reconciled = false;
  interleave = async () => {
    if (mode === 'different capture') await inject(2);
    await owner.reconcile(); reconciled = true;
  };
  const capture = await owner.capture(worker);
  const stopped = capture ? await owner.stop(mode==='legacy direct'?worker:{ ...worker, captured: approved }) : false;
  assert.equal(reconciled, true, 'reconciliation completed inside the native capture boundary');
  if (mode === 'second descendant' || mode === 'legacy direct') {
    assert.equal(stopped, true);assert.equal(injected, mode==='second descendant'?2:1);
    assert.equal(await owner.identity(first), null, 'convergence joins the injected births');
    assert.equal(await owner.confirmedClosed(worker), true);
    return;
  }
  assert.equal(stopped, mode === 'same birth');
  assert.equal(injected, mode === 'same birth' ? 1 : 2, 'the genuine-change controls reach their second native birth');
  if (mode === 'same birth') {
    assert.equal(await owner.identity(first), null, 'the one recapture joins the injected birth');
    assert.equal(await owner.confirmedClosed(worker), true);
  } else {
    assert.equal(signals, 0, 'real membership change sends no signal');
    assert.equal(await owner.identity(worker.pid), identity, 'incomplete capture retains the root');
    assert.ok(await owner.identity(first), 'incomplete capture retains its descendant');
  }
});
