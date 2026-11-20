export class RelayCloseError extends AggregateError {
  readonly closed: boolean;
  readonly secondary: unknown[];
  readonly producerRejected: boolean;
  constructor(primary: unknown, secondary: unknown[], closed: boolean, producerRejected: boolean) {
    super([...(primary === undefined ? [] : [primary]), ...secondary], 'relay shutdown failed', { cause: primary });
    this.closed = closed; this.secondary = secondary; this.producerRejected = producerRejected;
  }
}

/** A rejected producer cannot skip independent close attempts or replace its cause. */
export async function closeRelayResources(pending: Promise<unknown>, resources: () => Array<() => Promise<void>>) {
  const [producer] = await Promise.allSettled([pending]);
  const rejected = producer!.status === 'rejected';
  const primary = rejected ? (producer as PromiseRejectedResult).reason : undefined;
  let closes: Array<() => Promise<void>>;
  try { closes = resources(); } // Late acquisitions belong to the same close boundary.
  catch (error) { throw new RelayCloseError(primary, [error], false, rejected); }
  const results = await Promise.allSettled(closes.map(close => Promise.resolve().then(close)));
  const secondary = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  if (rejected || secondary.length) throw new RelayCloseError(primary, secondary, secondary.length === 0, rejected);
  return { closed: true as const };
}
