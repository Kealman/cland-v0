// Session-owned event subscriptions. The UI's connection-scoped `subscribe` is a separate protocol.
import type { Subscription, SubscriptionEvent, SubscriptionRequest, SubscriptionSubject, UsageThreshold } from './protocol.ts';
import { nameRefusal } from './names.ts';

export function isSubscriptionRequest(frame: Record<string, unknown>): frame is SubscriptionRequest {
  return typeof frame.id === 'string' && ['event.subscribe', 'event.unsubscribe', 'event.subscriptions'].includes(String(frame.type));
}

export function subscriptionSubject(value: unknown): SubscriptionSubject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('subject must name exactly one session, item, topic, role or subtree');
  const subject = value as Record<string, unknown>;
  const keys = Object.keys(subject);
  if (keys.length !== 1) throw new Error('subject must name exactly one session, item, topic, role or subtree');
  const key = keys[0]!, target = subject[key];
  if (typeof target !== 'string' || !target.trim()) throw new Error('subject needs a name');
  if (key === 'session') {
    const refusal = nameRefusal(target, new Set(['human']));
    if (refusal) throw new Error(refusal);
    return { session: target };
  }
  if (key === 'role') return { role: target };
  if (key === 'topic') return { topic: target };
  if ((key === 'item' || key === 'subtree') && /^T-[1-9]\d*$/.test(target)) return key === 'item' ? { item: target } : { subtree: target };
  throw new Error('subject must name a session, item (T-<n>), topic, role or subtree (T-<n>)');
}

export function subscriptionInput(subject: unknown, events: unknown, digest: unknown = 'turn', threshold?: unknown): Pick<Subscription, 'subject' | 'events' | 'digest' | 'threshold'> {
  const parsed = subscriptionSubject(subject);
  const supported: SubscriptionEvent[] = 'session' in parsed || 'role' in parsed ? ['session.state', 'usage', 'artifact']
    : 'topic' in parsed ? ['topic', 'artifact'] : ['task', 'session.state', 'topic', 'usage', 'artifact'];
  if (!Array.isArray(events) || !events.length || events.some(e => !supported.includes(e))) throw new Error(`${supported.join(', ')} are the supported events for this subject`);
  if (digest !== 'turn' && digest !== 'now') throw new Error('digest must be turn or now');
  let usage: UsageThreshold | undefined;
  if (events.includes('usage')) {
    if (!threshold || typeof threshold !== 'object' || Array.isArray(threshold) || Object.keys(threshold).length !== 1) throw new Error('usage needs a threshold naming cost or tokens');
    const t = threshold as Record<string, unknown>, n = t.cost ?? t.tokens;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || ('tokens' in t && !Number.isSafeInteger(n))) throw new Error('usage threshold must be a positive cost or integer token count');
    if ('cost' in t) usage = { cost: n };
    else if ('tokens' in t) usage = { tokens: n };
    else throw new Error('usage threshold must name cost or tokens');
  } else if (threshold !== undefined) throw new Error('threshold requires the usage event');
  return { subject: parsed, events: [...new Set(events)] as SubscriptionEvent[], digest, ...(usage ? { threshold: usage } : {}) };
}
