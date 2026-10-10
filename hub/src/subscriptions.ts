// Session-owned event subscriptions. The UI's connection-scoped `subscribe` is a separate protocol.
import type { Subscription, SubscriptionRequest, SubscriptionSubject } from './protocol.ts';
import { nameRefusal } from './names.ts';

export function isSubscriptionRequest(frame: Record<string, unknown>): frame is SubscriptionRequest {
  return typeof frame.id === 'string' && ['event.subscribe', 'event.unsubscribe', 'event.subscriptions'].includes(String(frame.type));
}

export function subscriptionSubject(value: unknown): SubscriptionSubject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('subject must name exactly one session or item');
  const subject = value as Record<string, unknown>;
  const keys = Object.keys(subject);
  if (keys.length !== 1) throw new Error('subject must name exactly one session or item');
  if (typeof subject.session === 'string') {
    const refusal = nameRefusal(subject.session, new Set(['human']));
    if (refusal) throw new Error(refusal);
    return { session: subject.session };
  }
  if (typeof subject.item === 'string' && /^T-[1-9]\d*$/.test(subject.item)) return { item: subject.item };
  throw new Error('subject must name a session or an item (T-<n>)');
}

export function subscriptionInput(subject: unknown, events: unknown): Pick<Subscription, 'subject' | 'events' | 'digest'> {
  const parsed = subscriptionSubject(subject);
  const expected = 'session' in parsed ? 'session.state' : 'task';
  if (!Array.isArray(events) || !events.length || events.some(e => e !== expected)) throw new Error(`${expected} is the supported event for this subject`);
  return { subject: parsed, events: [expected], digest: 'turn' };
}
