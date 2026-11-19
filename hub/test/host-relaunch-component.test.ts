// T2: public resume frames with in-process harnesses and registered Hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectHub, tempProject } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';

test.beforeEach(t => fixtureNativeGuard(t as test.TestContext, { fenced: true }));

test('C1 live host relaunch reuses placement and refuses a different requested host', async t => {
  const root = await tempProject(t);
  const files = localHost(fixtureEnvironment(root, process.env));
  const remote = (name: string) => ({ ...testHost(name, () => {}), realpath: files.realpath, statDirectory: async () => ({ refusal: null, identity: null }) });
  const hub = await projectHub(t, root, {}, { hosts: [remote('f1'), remote('f2')] });
  const ui = await sessionUi(t, hub.discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex', host: 'f1' });
  assert.equal(launch.ok, true, launch.error);
  const refused = await ui.request({ type: 'session.resume', session: 'worker', relaunch: true, host: 'f2' });
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /task stays on its host/);
  assert.equal(hub.fakes.codex!.resumes.length, 0);
  const local = await ui.request({ type: 'session.resume', session: 'worker', relaunch: true, host: 'local' });
  assert.equal(local.ok, false);
  assert.match(String(local.error), /relaunch to local from a remote host is not supported yet/);
  const resumed = await ui.request({ type: 'session.resume', session: 'worker', relaunch: true, host: 'f1' });
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal(hub.fakes.codex!.resumes[0]?.process.host, 'f1');
  assert.equal(hub.fakes.codex!.resumes[0]?.process.cwd, root);
});

for (const release of ['missing', 'wrong-generation', 'not-released'] as const) {
  test(`cross-host admission refuses ${release} generation receipt before destination effects`, async t => {
    const { mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { ProcessTable, hostGenerationKey } = await import('../src/adapters/processes.ts');
    const { fakeHarness } = await import('./fakes/harness.ts');
    const { Store } = await import('../src/hub/store.ts');
    const root = await tempProject(t);
    await mkdir(join(root,'.cland/territory.git'),{recursive:true});
    const table = new ProcessTable(join(root,'.cland/hub.db'));
    const original = {...await fakeHarness('codex').spawn({name:'worker',role:'implementer',model:null,cwd:root}),host:'lost',item:'T-1',status:'stopped' as const};
    table.put(original); table.close();
    const operations:unknown[]=[];
    const remote = testHost('f2', e => operations.push(e));
    operations.length=0;
    let nativeSpawns=0;
    const hub=await projectHub(t,root,{}, {hasTerritory:async()=>true,hosts:[remote],adapters:[() => {
      const adapter=fakeHarness('codex');
      adapter.spawn=async()=>{nativeSpawns++; throw Error('unexpected native spawn');};
      if (release==='missing') return adapter;
      return new Proxy(adapter,{get:(target,key)=>{
        if(key==='releaseUnreachableGeneration')return async()=>({generation:release==='wrong-generation'?'other':hostGenerationKey(original),released:release!=='not-released',dropped:[],forwardIds:[]});
        const value:unknown=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      }});
    }]});
    const ui=await sessionUi(t,hub.discovery);
    const task=await ui.request({type:'task.create',size:'M',title:'receipt target'}); assert.equal(task.ok,true,task.error);
    const setup=new Store(join(root,'.cland/hub.db'));
    const owner={item:'T-1',host:'lost',root,path:root,branch:'t/T-1-task',tip:'a'.repeat(40),phase:'ready' as const};
    setup.hosts.insert({id:'f2',address:'f2',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
    setup.saveHostWorktree(owner); setup.close();
    const result=await ui.request({type:'session.resume',session:'worker',relaunch:true,host:'f2'});
    assert.equal(result.ok,false);
    assert.match(String(result.error),release==='missing'?/generation handoff is unavailable/:/generation release receipt does not match captured process/);
    assert.equal(nativeSpawns,0); assert.deepEqual(operations,[]);
    const records=new Store(join(root,'.cland/hub.db'));
    try { assert.deepEqual(records.hostWorktrees(),[owner]); } finally { records.close(); }
  });
}
