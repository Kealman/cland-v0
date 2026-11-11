/** Pure placement policy. Callers own reservations and all lifecycle effects. */
export const DEFAULT_HOST_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  'claude-code': 1, codex: 0.5, opencode: 0.75,
});
export type HostWeights = Readonly<Record<string, number>>;
export type HarnessVerdict = 'serves' | 'can-bind' | 'signed-out' | 'no-login';
export type PlacementHost = Readonly<{
  id: string;
  state: 'ready' | 'booting' | 'unavailable';
  /** Capacity uses integer milli-slots; callers sum converted session weights. */
  usedMilli: number;
  /** Capacity reserved for earlier waiting launches, also integer milli-slots. */
  promisedMilli: number;
  slots: number;
}>;
export type PlacementInput = Readonly<{
  hosts: readonly PlacementHost[];
  harness: string;
  pool: Readonly<{ min_hosts: number; max_hosts: number; spread: boolean }>;
  weights?: HostWeights;
  canCreate?: (harness: string) => boolean;
  verdict?: (host: PlacementHost, harness: string) => HarnessVerdict;
}>;
export type PlacementDecision =
  | { kind: 'place'; host: string }
  | { kind: 'create' }
  | { kind: 'wait'; reason: string; host?: string };

/** Compatibility for callers without project login metadata. */
export function defaultHarnessVerdict(_host: PlacementHost, _harness: string): HarnessVerdict {
  return 'serves';
}

/** Overrides are honoured to 0.001 slot, rounded once before accounting. */
export function harnessWeightMilli(harness: string, weights?: HostWeights): number {
  const weight = weights?.[harness] ?? DEFAULT_HOST_WEIGHTS[harness];
  if (weight === undefined || !Number.isFinite(weight) || weight <= 0) {
    throw new Error(`No positive finite host weight for harness ${harness}`);
  }
  const milli = Math.round(weight * 1000);
  if (!Number.isSafeInteger(milli)) throw new Error('Host weight exceeds safe milli-slot capacity');
  return milli;
}

export function decidePlacement(input: PlacementInput): PlacementDecision {
  const weightMilli = harnessWeightMilli(input.harness, input.weights);
  for (const host of input.hosts) {
    if (![host.usedMilli, host.promisedMilli, host.slots * 1000].every(value => Number.isSafeInteger(value) && value >= 0)) {
      throw new Error('Host capacity requires nonnegative safe integer milli-slots');
    }
  }
  const verdict = input.verdict ?? defaultHarnessVerdict;
  const eligible = (state: PlacementHost['state']) => input.hosts
    .filter(host => host.state === state
      && host.usedMilli + host.promisedMilli + weightMilli <= host.slots * 1000
      && ['serves', 'can-bind'].includes(verdict(host, input.harness)))
    .sort((a, b) => Number(verdict(a, input.harness) !== 'serves') - Number(verdict(b, input.harness) !== 'serves') || (input.pool.spread ? (a.usedMilli + a.promisedMilli) - (b.usedMilli + b.promisedMilli)
      : (b.usedMilli + b.promisedMilli) - (a.usedMilli + a.promisedMilli)));
  const ready = eligible('ready')[0];
  if (ready) return { kind: 'place', host: ready.id };
  const booting = eligible('booting')[0];
  if (booting) return { kind: 'wait', host: booting.id, reason: `waiting for host ${booting.id} to boot` };
  const count = input.hosts.filter(host => host.state === 'ready' || host.state === 'booting').length;
  if (input.canCreate && !input.canCreate(input.harness)) return { kind: 'wait', reason: `waiting for a login ${input.harness}` };
  if (count < input.pool.max_hosts) return { kind: 'create' };
  return { kind: 'wait', reason: 'waiting for a host' };
}
