import type { HostArchitecture } from './provider.ts';

/** USD/hour, keyed by the provider's size name. Address charges apply per host. */
export type HostProviderDeclarationInput = {
  prices: Readonly<Record<string, { livePerHour: number; idleComputePerHour: number }>>;
  stoppedBills: boolean;
  billingGranularityMs: number;
  billingMinimumMs: number;
  tokenConfinement: 'account' | 'project' | 'resource';
  apiRequestsPerMinute: number;
  machineLimit: number;
  architectures: readonly HostArchitecture[];
  extraAddressPerHour: number;
};
export type HostProviderDeclarations = Readonly<Omit<HostProviderDeclarationInput, 'prices'> & {
  prices: Readonly<Record<string, Readonly<{ livePerHour: number; idleComputePerHour: number; idlePerHour: number }>>>;
  stopAction: 'stop' | 'destroy';
}>;
function requireValue(ok: unknown): asserts ok {
  if (!ok) throw new Error('invalid host provider declaration');
}
function object(value: unknown): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
const price = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const positiveInteger = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
function validateInput(value: unknown): asserts value is HostProviderDeclarationInput {
  const d = object(value);
  requireValue(typeof d.stoppedBills === 'boolean');
  requireValue(positiveInteger(d.billingGranularityMs));
  requireValue(positiveInteger(d.billingMinimumMs) && d.billingMinimumMs % d.billingGranularityMs === 0);
  requireValue(d.tokenConfinement === 'account' || d.tokenConfinement === 'project' || d.tokenConfinement === 'resource');
  requireValue(positiveInteger(d.apiRequestsPerMinute) && positiveInteger(d.machineLimit));
  requireValue(Array.isArray(d.architectures) && d.architectures.length > 0 && d.architectures.every(a => a === 'x86_64' || a === 'arm64'));
  requireValue(price(d.extraAddressPerHour));
  const prices = Object.entries(object(d.prices));
  requireValue(prices.length > 0);
  for (const [size, value] of prices) {
    const p = object(value);
    requireValue(size.trim() && price(p.livePerHour) && price(p.idleComputePerHour));
    requireValue(Number.isFinite(p.idleComputePerHour + d.extraAddressPerHour));
  }
}
/** Validate already-normalized declarations without adding address charges again. */
export function validateHostProviderDeclarations(value: unknown): asserts value is HostProviderDeclarations {
  validateInput(value);
  const d = value as HostProviderDeclarations;
  requireValue(d.stopAction === (d.stoppedBills ? 'destroy' : 'stop'));
  for (const p of Object.values(d.prices)) requireValue(p.idlePerHour === p.idleComputePerHour + d.extraAddressPerHour);
}
export function declareHostProvider(input: HostProviderDeclarationInput): HostProviderDeclarations {
  validateInput(input);
  const prices = Object.fromEntries(Object.entries(input.prices).map(([size, p]) => [size, Object.freeze({ ...p, idlePerHour: p.idleComputePerHour + input.extraAddressPerHour })]));
  return Object.freeze({ ...input, prices: Object.freeze(prices), architectures: Object.freeze([...input.architectures]), stopAction: input.stoppedBills ? 'destroy' : 'stop' });
}

/** Epoch milliseconds. The scheduler must satisfy both independent deadlines. */
export function earliestStop(options: {
  created: number; idleSince: number; idleStopMs: number;
  declarations: HostProviderDeclarations;
}): number {
  const { created, idleSince, idleStopMs, declarations } = options;
  requireValue(Number.isSafeInteger(created) && created >= 0);
  requireValue(Number.isSafeInteger(idleSince) && idleSince >= created);
  requireValue(Number.isSafeInteger(idleStopMs) && idleStopMs >= 0);
  validateHostProviderDeclarations(declarations);
  const deadline = Math.max(created + declarations.billingMinimumMs, idleSince + idleStopMs);
  requireValue(Number.isSafeInteger(deadline));
  return deadline;
}
