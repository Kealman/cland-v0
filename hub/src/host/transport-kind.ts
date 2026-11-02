/** The host carrier shipped in 0.4.0. Providers and transports share this type. */
export type TransportKind = 'ssh';

export function parseTransportKind(value: unknown): TransportKind {
  if (value === 'ssh') return value;
  if (value === 'outbound') throw new Error('outbound transport requires 0.4.x');
  throw new Error('ssh is the only transport 0.4.0 accepts');
}
