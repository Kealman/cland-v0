import type { LockProcessTable } from '../../src/hub/lock.ts';
/** One owned process namespace for component spend/lease lock lifecycles. */
export function fakeLockProcesses() {
 const reads:Array<{kind:'alive'|'started';pid:number}>=[];
 const processes:LockProcessTable={
  alive:pid=>{reads.push({kind:'alive',pid});return pid===process.pid;},
  started:pid=>{reads.push({kind:'started',pid});return pid===process.pid?'fixture lock birth':null;},
 };
 return {processes,reads};
}
