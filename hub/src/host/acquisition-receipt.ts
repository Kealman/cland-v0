/** Positive provider non-acquisition receipts shared by spend and occupancy. */
export const HOST_NON_ACQUISITION_KINDS = ['not-called', 'provider-refused'] as const;
export type HostNonAcquisitionReceipt = {kind:typeof HOST_NON_ACQUISITION_KINDS[number];at:string;lease?:string;pool?:string;project?:string;key?:{id:number;read:string};droplet?:'never-posted'|'post-refused';orphan?:{keyName:string;keyId?:number;reason:string}};
export function positiveNonAcquisition(receipt: HostNonAcquisitionReceipt): boolean {
 return Boolean(receipt && HOST_NON_ACQUISITION_KINDS.includes(receipt.kind) && Number.isFinite(Date.parse(receipt.at)));
}

export type ProviderNonAcquisitionReceipt=HostNonAcquisitionReceipt & {lease:string;pool:string;project:string};
export function positiveProviderNonAcquisition(receipt:HostNonAcquisitionReceipt,scope:{lease:string;pool:string;project:string}):receipt is ProviderNonAcquisitionReceipt {
 const key=receipt.key;
 const confirmed=Boolean(key&&Number.isSafeInteger(key.id)&&key.id>0&&key.read===`GET /account/keys/${key.id}: 404`);
 const orphan=Boolean(receipt.orphan&&typeof receipt.orphan.keyName==='string'&&receipt.orphan.keyName&&typeof receipt.orphan.reason==='string'&&receipt.orphan.reason&&['never-posted','post-refused'].includes(receipt.droplet??'')&&(receipt.orphan.keyId===undefined||Number.isSafeInteger(receipt.orphan.keyId)&&receipt.orphan.keyId>0));
 return positiveNonAcquisition(receipt)&&receipt.kind==='provider-refused'&&receipt.lease===scope.lease&&receipt.pool===scope.pool&&receipt.project===scope.project&&(confirmed||orphan);
}
