// T2: SQLite publication/checkpoint failure and reopen, with no native processes or Git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { fakeHarness } from './fakes/harness.ts';
import { ProcessTable, hostGenerationKey } from '../src/adapters/processes.ts';
import { Store } from '../src/hub/store.ts';
import { hostRelaunchIntentKey, hostRelaunchWarningKey, type HostRelaunchCompletion } from '../src/host/relaunch-state.ts';

test('native publication commits row ready warning and completion atomically across failure and reopen', async t => {
  const root=await tempProject(t); await mkdir(join(root,'.cland'),{recursive:true}); const path=join(root,'.cland/hub.db');
  let store=new Store(path); const table=new ProcessTable(path); const fault=new DatabaseSync(path);
  try {
    const old={...await fakeHarness('codex').spawn({name:'worker',role:'implementer',model:null,cwd:root}),host:'f1',item:'T-1'};
    const next={...old,host:'f2',cwd:join(root,'target'),harnessSessionId:'new-native'};
    const tree={item:'T-1',host:'f2',root,path:next.cwd,branch:'t/task',tip:'a'.repeat(40),phase:'adding' as const};
    const key=hostRelaunchIntentKey(old.sessionId), generation=hostGenerationKey(old), warning=hostRelaunchWarningKey(hostGenerationKey(next));
    const completion:HostRelaunchCompletion={intentKey:key,sourceGeneration:generation,tree,note:'native conversation restarted on f2'};
    table.put(old); table.retainHostGeneration(old,'unknown'); store.saveHostWorktree(tree);
    store.setMeta(key,JSON.stringify({sourceGeneration:generation,sourceHost:'f1',targetHost:'f2',item:'T-1',cause:'host down',phase:'prepared',tree}));
    fault.exec("create trigger fail_warning before insert on meta when NEW.key like 'host-relaunch:%' begin select raise(abort,'injected warning checkpoint failure'); end");
    assert.throws(()=>table.put(next,completion),/injected warning checkpoint failure/);
    assert.equal(table.get('worker')!.host,'f1'); assert.equal(store.hostWorktrees()[0]!.phase,'adding'); assert.ok(store.meta(key)); assert.equal(store.meta(warning),null);
    fault.exec('drop trigger fail_warning');
    const stop=table.subscribe(()=>{
      assert.equal(store.hostWorktrees()[0]!.phase,'ready'); assert.equal(store.meta(key),null); assert.equal(store.meta(warning),completion.note);
      throw Error('injected observer failure after commit');
    });
    assert.throws(()=>table.put(next,completion),/injected observer failure after commit/); stop();
    store.close(); store=new Store(path);
    const reopened=new ProcessTable(path);
    try {
      assert.equal(reopened.get('worker')!.host,'f2'); assert.equal(reopened.get('worker')!.harnessSessionId,'new-native');
      assert.equal(store.hostWorktrees()[0]!.phase,'ready'); assert.equal(store.meta(key),null); assert.equal(store.meta(warning),completion.note);
      assert.equal([...reopened.retainedHostGenerations('f1')][0]!.nativeClosure,'unknown');
    } finally { reopened.close(); }
  } finally { fault.close(); table.close(); store.close(); }
});
