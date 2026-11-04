// T3: fake-SSH agent owns Codex version/spawn/stop native lifecycle.
// Lifecycle: scripted native connection, fake executable only; join agent exit before fixture census/removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { ScriptedCodex } from './fakes/scripted-codex.ts';
import { eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';

test('Codex version and stop cross the fake host agent with a joined native exit', async t => {
  const f = await sshHostFixture(t);
  const bin = join(f.fake.home, 'fake-codex');
  const ready = join(f.fake.home, 'codex-started.json');
  await writeFile(bin, `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';\nif(process.argv.includes('--version')) { console.log('codex 0.160.0'); } else { writeFileSync(${JSON.stringify(ready)},JSON.stringify(process.argv.slice(2))); setInterval(()=>{},1000); }\n`, {mode: 0o700});
  const native = new ScriptedCodex();
  native.thread = 'agent-thread';
  native.handlers.set('thread/start', () => ({thread: {id: native.thread, status: {type: 'idle'}}}));
  const forwarded: string[] = [];
  const host = {...f.host, forward: async (...args: Parameters<typeof f.host.forward>) => { const endpoint = await f.host.forward(...args); assert.ok('socket' in endpoint); forwarded.push(endpoint.socket); return endpoint; }};
  const adapter = new CodexAdapter({root: f.root, discoveryFile: join(f.root,'hub.json'), node: process.execPath, cli: '/hub/cli', spoke: '/hub/spoke', hostForLaunch: () => host, hostForProcess: () => host, log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}}, {bin, env: fixtureEnvironment(f.root,process.env), connect: async socket => { assert.equal(socket, forwarded.at(-1)); await eventually('fake Codex durable startup', async () => { try { return JSON.parse(await readFile(ready,'utf8')); } catch { return undefined; } }, 2000); return native; }});
  let row: HarnessProcess | undefined;
  f.addCleanup(async () => { if(row && await f.host.alive(row)) await adapter.stop(row); await adapter.close(); });
  row = await adapter.spawn({name:'worker',role:null,model:null,cwd:f.fake.home});
  const argv = JSON.parse(await readFile(ready,'utf8')) as string[];
  assert.deepEqual(argv.slice(0,3), ['app-server','--listen',`unix://${row.harnessId}`]);
  assert.ok(row.harnessId!.startsWith(f.fake.run+'/'));
  for(const path of [row.harnessId!, ...forwarded]) assert.ok(Buffer.byteLength(path)+1<=104,path);
  assert.match(row.pidIdentity!, /^linux:/);
  await adapter.stop(row);
  assert.equal(await f.host.identity(row.pid!), null, 'stop receipt follows the native exit');
});
