// T3: hub/carrier restart with native fake harnesses on two authenticated fake SSH hosts.
// Lifecycle: detached workers, production spokes and Unix forwards survive the hub; all owners join before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, writeFile, symlink, mkdir, rmdir, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import { hostPaths } from '../src/host/records.ts';
import { Store } from '../src/hub/store.ts';
import { projectHub, connectUi, eventually, fakeClaude, fakeCodex } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testHost } from '../src/host/test-host.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss', {timeout:120000}, async t => {
  const f = await sshHostFixture(t, {startTransport:false});
  await f.host.close();
  const second = await createFakeHost(f.root, 'f2');
  const claude = await fakeClaude(t), codex = await fakeCodex(t);
  const fakeHosts = [f.fake, second];
  const env = fixtureEnvironment(f.root, process.env, {...f.env, CLAND_FAKE_HOSTS:'f1,f2'});
  const rec = f.secrets.register({id:'f2',address:'f2',user:'agent',clientKeyPath:join(second.directory,'client-key'),knownHosts:`f2 ${second.key}\n`});
  const agent = await serveAgent({runDir:second.run,secret:f.secrets.readSecret('f2'),version:'test',env:fixtureEnvironment(f.root, process.env, {...env, CLAND_HOST_BOOT_ID_FILE:second.bootId})});
  f.addCleanup(async()=>{
    await agent.close();
    const paths = hostPaths(f.root,'f2');
    // Hub/carrier and agent owners are joined before removing their leftover socket inodes.
    for (const path of [paths.agentSocket,paths.gitSocket,paths.controlSocket]) await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});
    const directory = paths.socketDirectory;
    if (!directory.startsWith(f.root+'/')) await rmdir(directory).catch(error=>{if(error.code!=='ENOENT')throw error;});
  });
  const configurations: Record<string, import('../src/host/registry.ts').HostConfiguration> = {};
  for (const [i, machine] of fakeHosts.entries()) {
    const code = join(machine.home, 'code');
    await symlink(new URL('../../', import.meta.url).pathname, code);
    await mkdir(join(machine.home,'.git'));
    await writeFile(join(machine.directory,'ports.json'), JSON.stringify({'12345':join(machine.home,'session.sock')}));
    configurations[`f${i+1}`] = {home:machine.home,supervisor:f.supervisor,layout:{node:process.execPath,cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts'),modDir:join(code,'hub/mod/cland')}};
  }
  const localCalls: string[] = [], stops: number[] = [];
  const wrap = (machine: import('../src/host/host.ts').Host) => ({...machine,freePort:async()=>12345,stop:async(...args: Parameters<typeof machine.stop>)=>{stops.push(args[0].pid!);return machine.stop(...args);}});
  const boundary = (host: AdapterHost): AdapterHost => ({...host,hostForProcess: p => wrap(host.hostForProcess!(p)),hostForLaunch:p=>wrap(host.hostForLaunch!(p))});
  const start = () => projectHub(t,f.root,env,{hostConfigurations:configurations,hosts:[testHost('local',e=>localCalls.push(String(e.operation)))],adapters:[
    host=>{
      const adapter = new ClaudeCodeAdapter(boundary(host),{bin:new URL('./fakes/claude-code/claude',import.meta.url).pathname,pollMs:100});
      const spawn = adapter.spawn.bind(adapter);
      adapter.spawn = request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,...claude.env,CLAUDE_CONFIG_DIR:claude.home})});
      return adapter;
    },
    host=>{
      const adapter = new CodexAdapter(boundary(host),{bin:new URL('./fakes/codex/codex',import.meta.url).pathname,env:fixtureEnvironment(f.root,process.env,{...env,...codex.env})});
      const spawn = adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,...codex.env})});return adapter;
    },
    host=>{
      const adapter = new OpenCodeAdapter(boundary(host),{bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,env:fixtureEnvironment(f.root,process.env,env)});
      const spawn = adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,FAKE_OPENCODE_HOME:join(second.home,'native'),FAKE_OPENCODE_SOCKET:join(second.home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'})});return adapter;
    },
  ]});
  const store = new Store(join(f.root,'.cland/hub.db'));
  for (const record of [f.records.get('f1')!,rec]) store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret(record.id));
  store.close();
  let hub = await start(); f.addCleanup(()=>hub.stop());
  const rolesFile = join(f.root,'.cland/roles.toml');
  await writeFile(rolesFile,setRoleKey(await readFile(rolesFile,'utf8'),'implementer','launch','writable_roots',['.']));
  let ui = await connectUi(t,hub.discovery); await ui.request({type:'subscribe'});
  const specs = [
    {name:'cc',harness:'claude-code',host:'f1',cwd:f.fake.home},
    {name:'cx',harness:'codex',host:'f2',cwd:second.home},
    {name:'oc',harness:'opencode',host:'f2',cwd:second.home,model:'opencode/fake-paid'},
  ];
  await eventually('both carriers ready', async () => {
    const status = (await ui.request({type:'hub.status'})).value as {hosts:Array<{state:string}>};
    return status.hosts.length === 2 && status.hosts.every(host=>host.state==='up') || undefined;
  },10000);
  const expected = new Map<string,string>();
  for (const spec of specs) {
    const launch = await ui.request({type:'session.launch',role:'implementer',...spec},20000);
    assert.equal(launch.ok,true,launch.error);
    expected.set(spec.name,(launch.value as {process:{sessionId:string}}).process.sessionId);
  }
  const rows = async () => ((await ui.request({type:'session.list'})).value as {processes:HarnessProcessView[]}).processes;
  const welcome = () => eventually('all exact spokes welcomed',async()=>{
    const status = (await ui.request({type:'hub.status'})).value as {sessions:Array<{name:string;sessionId:string}>};
    return specs.every(spec=>status.sessions.some(p=>p.name===spec.name&&p.sessionId===expected.get(spec.name)))||undefined;
  },15000);
  await welcome().catch(async error=>{
    t.diagnostic(JSON.stringify(((await ui.request({type:'hub.status'})).value as {sessions:unknown}).sessions));
    t.diagnostic((await readFile(join(f.root,'.cland/log/hub.log'),'utf8')).split('\n').filter(line=>/refus|hello|connect|spoke|auth|failed/.test(line)).slice(-35).join('\n'));
    for(const server of await codex.servers()) t.diagnostic((await codex.log(server.pid)).slice(-4000));
    for(const job of await claude.sessions()) t.diagnostic((await claude.log(job.id)).slice(-4000));
    t.diagnostic((await readFile(join(second.home,'opencode/oc/serve.log'),'utf8').catch(()=>'' )).slice(-4000));
    throw error;
  });
  const persisted = new ProcessTable(join(f.root,'.cland/hub.db')); f.addCleanup(async()=>persisted.close());
  const before = persisted.all(); assert.equal(before.length,3);
  for (const row of before) assert.ok(row.pidIdentity);
  const deliver = async (tag:string) => {
    for (const spec of specs) {
      const receipt = eventually('persisted spoke response '+spec.name+' '+tag,()=>ui.frames.find(frame=>frame.type==='message'&&JSON.stringify(frame).includes('pong: '+tag+'-'+spec.name)),15000);
      void receipt.catch(()=>{});
      const sent = await ui.request({type:'topic.send',topic:'general',to:[spec.name],text:tag+'-'+spec.name});
      assert.equal(sent.ok,true,sent.error);
      try { await receipt; } catch(error) {
        await ui.request({type:'hub.status',flushLogs:true});
        t.diagnostic((await readFile(join(f.root,'.cland/log/hub.log'),'utf8')).split('\n').filter(line=>/reconnect|inject|turn-|host-tunnel|bridge-|harness-request/.test(line)).slice(-50).join('\n'));
        throw error;
      }
    }
  };
  await deliver('before');
  await hub.stop();
  assert.deepEqual(stops,[],'hub shutdown sends no native stop');
  await delay(20000); // lint-allow-wall-clock: acceptance explicitly requires a real 20s stopped hub interval.
  hub = await start(); ui = await connectUi(t,hub.discovery); await ui.request({type:'subscribe'});
  await welcome(); await deliver('restart');
  for (const old of before) {
    const row = persisted.all().find(p=>p.sessionId===old.sessionId)!;
    assert.equal(row.status,'running');assert.equal(row.pid,old.pid);assert.equal(row.pidIdentity,old.pidIdentity);
  }
  const master = JSON.parse(await readFile(join(second.directory,'master-control'),'utf8')) as {token:string};
  const replacement = eventually('replacement master durable receipt',async()=>{
    try { return (JSON.parse(await readFile(join(second.directory,'master-control'),'utf8')) as {token:string}).token !== master.token || undefined; } catch { return undefined; }
  },15000);
  void replacement.catch(()=>{});
  await hostControl('kill-master','f2',env);
  assert.ok((await rows()).every(p=>p.status==='running'));
  await replacement;
  await welcome(); await deliver('tunnel');
  assert.deepEqual(stops,[]);
  assert.equal(localCalls.some(operation=>operation!=='limitPolls'),false,JSON.stringify(localCalls));
  for (const old of before) {
    const row = persisted.all().find(p=>p.sessionId===old.sessionId)!;
    assert.equal(row.status,'running');assert.equal(row.pidIdentity,old.pidIdentity);
  }
  // T-1678 owns the post-turn Claude stop refusal; preserve its failed variant in A-16593.
  // Survival ends without an explicit stop; the fixture joins every native writer before root removal.
  await hub.stop();
  assert.deepEqual(stops,[], 'final hub shutdown also preserves native workers for fixture-owned cleanup');
});
