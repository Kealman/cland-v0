import type { HarnessProcess } from './contract.ts';
import type { FailedForwardReceipt, LaunchFilesState } from './launch-files.ts';
import type { Host } from '../host/host.ts';
import { boundedSettlement, type LaunchSettled } from './launch-settlement.ts';

type SettlementEntry = {
  receiptIdentity:string;
  processes:Set<HarnessProcess>;
  complete:boolean;
  finish:LaunchSettled;
  work:Promise<void>|undefined;
};

function settlementKey(process:HarnessProcess,generation:string):string {
  return JSON.stringify([process.harness,process.host??'local',process.sessionId,generation]);
}
function receiptIdentity(receipt:FailedForwardReceipt):string {
  return JSON.stringify([receipt.harness,receipt.host,receipt.sessionId,receipt.generation,receipt.forwardId]);
}

/** Fresh adapters have no client to close. Generic rollback proves native closure first;
 * this owner joins the exact remaining Host cancellation before Sessions releases ownership. */
export class FailedForwardSettlement {
  readonly #settlements = new Map<string, SettlementEntry>();
  readonly #retired = new WeakSet<HarnessProcess>();
  get size():number { return this.#settlements.size; }

  settle(process: HarnessProcess, files: LaunchFilesState | undefined, machine: Host): void | Promise<void> {
    if ((process.host ?? 'local') === 'local') return;
    if (this.#retired.has(process)) throw new Error('failed launch generation is retired');
    const receipt = files?.settlement;
    if (!receipt) throw new Error('cleanup-incomplete: failed generation state missing');
    if (receipt.harness !== process.harness || receipt.host !== process.host || machine.name !== receipt.host
      || receipt.sessionId !== process.sessionId || !/^[a-f0-9-]{36}$/.test(receipt.generation)
      || (receipt.forwardId !== null && receipt.forwardId !== receipt.sessionId && receipt.forwardId !== `${receipt.sessionId}:${receipt.generation}`))
      throw new Error('cleanup-incomplete: failed generation state mismatched');
    const key = settlementKey(process,receipt.generation);
    let entry = this.#settlements.get(key);
    if (entry && entry.receiptIdentity !== receiptIdentity(receipt)) throw new Error('cleanup-incomplete: failed generation forward changed');
    if (!entry) {
      const forwardId=receipt.forwardId;
      const owned:SettlementEntry = {receiptIdentity:receiptIdentity(receipt),processes:new Set(),complete:false,work:undefined,
        finish:boundedSettlement(() => {
          owned.work = Promise.resolve().then(async () => {
            if (forwardId !== null) await machine.unforward(forwardId);
            owned.complete = true;
          });
          return owned.work;
        })};
      this.#settlements.set(key, owned);
      entry = owned;
    }
    entry.processes.add(process);
    return entry.finish();
  }

  /** The durable pending-stop clearance acknowledges only completed producers. */
  acknowledge(process:HarnessProcess,files:LaunchFilesState|undefined):void {
    const receipt=files?.settlement;
    if(!receipt)return;
    const key=settlementKey(process,receipt.generation),entry=this.#settlements.get(key);
    if(!entry?.complete||!entry.processes.has(process)||entry.receiptIdentity!==receiptIdentity(receipt))return;
    for (const alias of entry.processes) this.#retired.add(alias);
    this.#settlements.delete(key);
  }

  async drain():Promise<void> {
    const results=await Promise.allSettled([...this.#settlements.values()].flatMap(entry=>entry.work?[entry.work]:[]));
    const failures=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected');
    if(failures.length)throw new AggregateError(failures.map(result=>result.reason),'failed forward settlement incomplete');
  }
}
