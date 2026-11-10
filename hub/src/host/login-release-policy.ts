import type { HostRecords } from './records.ts';

export function hasReaderReleaseObligation(records:HostRecords,id:string):boolean {
 return records.logins.readersForHost(id).some(operation=>operation.phase!=='bound');
}
/** Pending native bindings remain owned by startup reconciliation. */
export function hasLoginReleaseObligation(records:HostRecords,id:string):boolean {
 return hasReaderReleaseObligation(records,id)||records.logins.forHost(id).some(binding=>binding.phase!=='pending'&&records.logins.get(binding.login)?.kind==='disk');
}
