// Receipt policy is pure; native readers provide explicit observations.
export type CapturedWriter = { pid: number; birth: string; group: number };
export type WriterObservation = { kind: 'absent' } | { kind: 'present'; birth?: string };
export type WriterReceipt = CapturedWriter & { kind: 'reaped' };
export function writerReceipt(owner: CapturedWriter, observation: WriterObservation): WriterReceipt | undefined {
  return observation.kind === 'absent' ? { ...owner, kind: 'reaped' } : undefined;
}
