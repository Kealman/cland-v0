// T3: native attach CLI exec and exit must leave an independently owned session alive.
// Lifecycle: disposable root/HOME, child exit joined before fixture removal.
import test from 'node:test';
import { within } from '../src/executor/droplet/deadline.ts';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { mkdir, writeFile, readFile, stat, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { localHost } from '../src/host/local.ts';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { attachRecordPath, hostAttachPlan, terminalAttachCommand, writeAttachRecord } from '../src/host/attach.ts';
import { remoteHostLayout } from '../src/host/remote-layout.ts';
import { hostPaths } from '../src/host/records.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import type { AdapterHost, HarnessProcess } from '../src/adapters/contract.ts';

for (const [label, Adapter] of Object.entries({ 'claude-code': ClaudeCodeAdapter, codex: CodexAdapter, opencode: OpenCodeAdapter, 'codex-held':CodexAdapter })) test(`${label} host attach uses private environment, refuses foreign records and exit preserves native identity`, {timeout:10000}, async t => {
  const held = label === 'codex-held';
  const harness = held ? 'codex' : label;
  const root = await tempProject(t, 'ha-', '/tmp');
  const bin = join(root, 'bin'); await mkdir(bin);
  const marker = join(root, 'receipt');
  await writeFile(join(bin, 'stty'), '#!/bin/sh\nprintf "%s" "$*" > "$STTY_RECEIPT"\n', {mode:0o700});
  const harnessBin = join(bin, 'harness');
  await writeFile(harnessBin, '#!/bin/sh\nif [ "$ATTACH_EXPECT_PASSWORD" = 1 ]; then [ "$OPENCODE_PASSWORD" = native-password ] || exit 117; fi\nprintf "%s\\n" "$*" "$CODEX_HOME" "$CLAUDE_CONFIG_DIR" "$OPENCODE_DB" "$PWD" > "$ATTACH_RECEIPT"\nif [ "$ATTACH_HOLD" = 1 ]; then exec /bin/sleep 60; fi\n', {mode:0o700});
  const env = fixtureEnvironment(root, process.env, {PATH:bin+':'+process.env.PATH, ATTACH_RECEIPT:marker, STTY_RECEIPT:join(root,'stty'), CLAND_HOST_RUN_DIR:join(root,'run')});
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000);process.stdout.write("ready")'], {cwd:root,env:fixtureEnvironment(root, env, {CLAND_HOST_RUN_DIR:env.CLAND_HOST_RUN_DIR}),stdio:['ignore','pipe','pipe']});
  const closed = once(child, 'close');
  const stopSession = ownProcess(t, child.pid);
  beforeDirectories(t,async()=>{await stopSession();await closed;});
  await once(child.stdout!, 'data', {signal:AbortSignal.timeout(5000)});
  const machine = {...localHost(env),name:'remote'};
  const proof = await machine.identity(child.pid!); assert.ok(proof?.pidIdentity);
  const layout = remoteHostLayout(root, {runDirectory:env.CLAND_HOST_RUN_DIR!});
  machine.layout = () => layout;
  const boundary: AdapterHost = {root,discoveryFile:layout.discoveryFile,node:process.execPath,cli:'',spoke:'',hostForProcess:()=>machine,log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{}};
  const adapter = new Adapter(boundary, {bin:harnessBin,env}); t.after(()=>adapter.close());
  const accountEnv = {CODEX_HOME:join(root,'codex'),CLAUDE_CONFIG_DIR:join(root,'claude'),OPENCODE_DB:join(root,'db'),DIGITALOCEAN_TOKEN:'planted-secret',CLAND_HOST_SECRET:'host-planted-secret',CLAND_LAUNCH_TOKEN:'launch-planted-secret'};
  const p: HarnessProcess = {name:'worker',sessionId:'cland-id',host:'remote',harness,role:null,model:null,cwd:root,...proof!,harnessId:harness==='codex'?join(root,'native.sock'):harness==='opencode'?'http://127.0.0.1:12345':'job-id',harnessSessionId:'conversation',account:'fixture',accountEnv,startedAt:new Date().toISOString(),status:'running'};
  if(harness==='opencode') {const passwordFile=join(dirname(layout.discoveryFile),'opencode/worker/password');await mkdir(dirname(passwordFile),{recursive:true});await writeFile(passwordFile,'native-password');}
  assert.ok(JSON.stringify(accountEnv).includes('planted-secret')); // Positive control before publication.
  const files = new LaunchFiles(undefined,machine);
  await writeAttachRecord(machine,layout.runDirectory,p,adapter.attachCommand(p,true),files);files.commit();
  const path = attachRecordPath(layout.runDirectory,p.name);
  assert.equal((await stat(path)).mode & 0o777,0o600);
  const record = await readFile(path,'utf8');assert.ok(record.includes('conversation')||record.includes('job-id'));
  assert.doesNotMatch(record,/planted-secret|native-password/);
  await assert.rejects(hostAttachPlan(join(root,'foreign'),p.name,env),/not on this host/);
  const envCapture = join(root,'env-argv');
  if (harness === 'opencode') {
    await writeFile(join(bin,'env'), '#!/bin/sh\nprintf "%s" "$*" > "$ENV_ARGV_RECEIPT"\nexit 119\n',{mode:0o700});
    const control = await localHost(env).run({command:join(bin,'env'),args:['OPENCODE_PASSWORD=native-password'],cwd:root,env:fixtureEnvironment(root, env, {ENV_ARGV_RECEIPT:envCapture})});
    assert.equal(control.code,119);assert.ok((await readFile(envCapture,'utf8')).includes('native-password'));
    await unlink(envCapture);
  }
  const attach = spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'host','attach',p.name],{cwd:root,env:fixtureEnvironment(root, env, {CLAND_HOST_RUN_DIR:env.CLAND_HOST_RUN_DIR,ENV_ARGV_RECEIPT:envCapture,ATTACH_HOLD:held ? '1' : '0',ATTACH_EXPECT_PASSWORD:harness === 'opencode' ? '1' : '0'}),stdio:['ignore','pipe','pipe']});
  const attachClosed = once(attach,'close');
  const stopAttach = ownProcess(t,attach.pid);
  beforeDirectories(t,async()=>{await stopAttach();await attachClosed;});
  let stderr='';attach.stderr!.on('data',b=>stderr+=b);
  if (held) {
    await eventually('held attach durable output',async()=>{try{return (await readFile(marker,'utf8')).includes('conversation')||undefined;}catch{return undefined;}},5000);
    await assert.rejects(async()=>{try {throw new Error('forced attach failure');} finally {await stopAttach();await attachClosed;}},/forced attach failure/);
  }
  const [code,signal] = await within(attachClosed,5000,undefined,()=>new Error('attach close incomplete; stderr: '+stderr.slice(-1000)));
  if (held) {assert.equal(code,null);assert.ok(signal);} else {assert.equal(code,0,stderr);assert.equal(signal,null);}
  if (harness === 'opencode') assert.equal(await localHost(env).fileType(envCapture),'missing','no intermediate native env argv receives the password');
  assert.equal(await readFile(join(root,'stty'),'utf8'),'susp undef');
  const receipt = await readFile(marker,'utf8');assert.doesNotMatch(receipt,/native-password/);assert.match(receipt,/job-id|conversation/);assert.ok(receipt.includes(root));
  for (const path of ['codex','claude','db']) assert.ok(receipt.includes(join(root,path)));
  assert.equal(receipt.trim().split('\n').at(-1),root);
  assert.deepEqual(await machine.identity(child.pid!),proof);assert.equal(await machine.alive(p),true);
  await writeFile(path,record.replace(p.pidIdentity!,'foreign-birth'),{mode:0o600});
  await assert.rejects(hostAttachPlan(layout.runDirectory,p.name,env),/not running on this host/);
});

test('printed terminal SSH pins host keys, disables sharing and forwards, and contains no secret',async t=>{
  const root=await tempProject(t);const paths=hostPaths(root,'f1');await mkdir(paths.directory,{recursive:true});
  await writeFile(paths.clientKeyPath,join(root,'key'));
  const command=terminalAttachCommand(root,{id:'f1',transport:'ssh',address:'host.example',user:'agent',state:'registered'},remoteHostLayout('/home/agent'),'worker');
  for(const value of ['-t','-a','-x','ControlPath=none','ClearAllForwardings=yes','StrictHostKeyChecking=yes',paths.knownHosts,'host attach','worker']) assert.ok(command.includes(value),value);
  assert.doesNotMatch(command,/planted-secret|CLAND_HOST_SECRET|CLAND_LAUNCH_TOKEN/);
});
