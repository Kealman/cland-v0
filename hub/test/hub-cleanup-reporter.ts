// Negative lifecycle controls consume Node's outcome, independent of its text reporter.
type Event = { type: string; data: { name?: string; details?: { error?: unknown } } };
function outcome(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return {};
  const value = error as Record<string, unknown>;
  const receipt: Record<string, unknown> = {};
  for (const key of ['code', 'failureType', 'operator']) {
    if (typeof value[key] === 'string') receipt[key] = value[key];
  }
  if (value.code === 'ERR_ASSERTION') {
    receipt.actual = value.actual;
    receipt.expected = value.expected;
  }
  if (value.cause && value.cause !== error) receipt.cause = outcome(value.cause);
  return receipt;
}
export default async function* cleanupReporter(events: AsyncIterable<Event>) {
  for await (const event of events) {
    if (event.type === 'test:fail') yield JSON.stringify({ name: event.data.name, error: outcome(event.data.details?.error) }) + '\n';
  }
}
