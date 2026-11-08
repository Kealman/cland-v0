// T1: in-memory process publication transaction; no timers, sockets or children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';

test('process publication and wait removal commit together before observers', () => {
  const db = new DatabaseSync(':memory:');
  const table = new ProcessTable(':memory:',undefined,()=>db);
  try {
    const record = {id:'wait-1',row:{name:'queued',role:'implementer',pool:'agents',reason:'waiting for a host',since:'2026-11-08T00:00:00Z'},request:{name:'queued'},actor:null};
    table.saveWaitingLaunch(record);
    const process: HarnessProcess = {name:'queued',harness:'codex',role:'implementer',model:null,cwd:'/fixture',pid:null,harnessId:null,sessionId:'placed-id',harnessSessionId:null,startedAt:'2026-11-08T00:00:00Z',status:'running'};
    table.put({...process,name:'unrelated'});
    assert.deepEqual(table.waitingLaunches(),[record]);
    table.put(process);
    assert.deepEqual(table.waitingLaunches(),[record], 'ordinary publication must not consume an admitted wait');
    assert.throws(()=>table.put({...process,name:'wrong-owner'},undefined,{name:'queued',id:'different-admission'}),/admitted identity/);
    assert.equal(table.get('wrong-owner'),null);
    assert.deepEqual(table.waitingLaunches(),[record]);
    db.exec("create trigger refuse_wait_delete before delete on waiting_launches begin select raise(abort,'injected wait deletion failure'); end");
    assert.throws(()=>table.put({...process,name:"reused-worker"},undefined,{name:"queued",id:"wait-1"}),/injected wait deletion failure/);
    assert.equal(table.get('reused-worker'),null);
    assert.deepEqual(table.waitingLaunches(),[record]);
    db.exec('drop trigger refuse_wait_delete');
    let observed = false;
    table.subscribe(row=>{assert.equal(row.sessionId,'placed-id');assert.deepEqual(table.waitingLaunches(),[]);observed=true;});
    table.put({...process,name:"reused-worker"},undefined,{name:"queued",id:"wait-1"});
    assert.equal(observed,true);
    assert.deepEqual(table.waitingLaunches(),[]);
    assert.equal(table.get('reused-worker')!.sessionId,'placed-id');
  } finally { table.close(); }
});
