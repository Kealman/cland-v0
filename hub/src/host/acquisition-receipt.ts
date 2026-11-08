/** Positive provider non-acquisition receipts shared by spend and occupancy. */
export const HOST_NON_ACQUISITION_KINDS = ['not-called', 'provider-refused'] as const;
export type HostNonAcquisitionReceipt = {kind:typeof HOST_NON_ACQUISITION_KINDS[number];at:string};
export function positiveNonAcquisition(receipt: HostNonAcquisitionReceipt): boolean {
 return Boolean(receipt && HOST_NON_ACQUISITION_KINDS.includes(receipt.kind) && Number.isFinite(Date.parse(receipt.at)));
}
