import { randomUUID } from 'node:crypto';
import type { AskPort } from './asks.ts';
import { askOptions } from './asks.ts';
import { cardOf, type AskRow } from './store.ts';
import type { HumanActionVia, Message, SendOutcome } from '../protocol.ts';
import { TopicRefusal } from './topics.ts';

export type CardAnswerContext = { id: string; declined: boolean; option?: number; afterCommit: (work: () => void | Promise<void>) => void };
export type CardHandler = (payload: unknown, answer: string, context: CardAnswerContext) => string;

/** Hub-owned asks use the existing human answer boundary, never session delivery. */
export class HubCards {
  readonly #port: AskPort;
  readonly #handlers = new Map<string, CardHandler>();
  constructor(port: AskPort) { this.#port = port; }

  onAnswer(kind: string, handler: CardHandler): void { this.#handlers.set(kind, handler); }

  raise(kind: string, topicId: string, question: string, options: string[], free: boolean, payload: unknown, secret = false): string {
    const p = this.#port;
    const topic = p.topic(topicId);
    const q = question.trim(), opts = askOptions(options, free);
    if (!kind.trim() || !q) throw new TopicRefusal('a hub card needs a kind and a question');
    if (topic.id === 'agents') throw new TopicRefusal('ask the human in General or an item topic');
    const refusal = p.sizeRefusal(q);
    if (refusal) throw new TopicRefusal(refusal);
    // Validate serializability before any durable write.
    const storedPayload: unknown = JSON.parse(JSON.stringify(payload ?? null));
    const now = p.now();
    const message: Message = { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [], text: q, ts: now.toISOString(), topic: topic.id };
    p.store.transaction(() => {
      p.store.record(message, [], now.getTime());
      p.store.createAsk({ id: message.id, topic: topic.id, from: 'hub', question: q, options: opts, free, ts: message.ts, hubKind: kind, payload: storedPayload, secret });
      p.store.waitInInbox({ kind: 'ask', id: message.id, subject: topic.item ?? topic.id, since: message.ts, text: q });
    });
    p.store.touchTopic(topic.id, message.ts);
    p.emitMessage(message);
    p.move(topic, 'ask', 'a hub card');
    p.publishTopics();
    p.log({ event: 'ask', id: message.id, topic: topic.id, from: 'hub', options: opts.length, free });
    return message.id;
  }

  /** Secret replay identity comes from captured native ingress, never code text. */
  isSecret(id:string):boolean{
    const a=this.#port.store.ask(id);return a?.from==='hub'&&!!a.hubKind&&a.secret===true;
  }
  /** Trusted stored identity and parsed output, never a remote frame's claim. */
  signInLink(id:string):{question:string;harness:unknown;url:unknown}|undefined{
    const a=this.#port.store.ask(id);
    if(a?.from!=='hub'||a.hubKind!=='login-signin-code'||!a.payload||typeof a.payload!=='object')return;
    const {harness,url}=a.payload as {harness?:unknown;url?:unknown};return {question:a.question,harness,url};
  }
  answerDigest(id: string, messageId: string | undefined): string | undefined {
    return this.isSecret(id) ? messageId : undefined;
  }

  answer(a: AskRow, body: string, option: number | undefined, via: HumanActionVia, user?: { id: string; name: string }, declined = false, standIn?: string) {
    const p = this.#port, handler = this.#handlers.get(a.hubKind!);
    if (!handler) {
      p.log({ event: 'hub-card-handler-missing', id: a.id, kind: a.hubKind });
      throw new TopicRefusal('no handler registered for this hub card; it stays open');
    }
    return p.store.transaction(() => {
      const at = p.now().toISOString();
      // Fence reentrant answers; handler failures roll back their durable intent with this answer.
      p.store.closeAsk(a.id, 'answered', at);
      let result: string;
      try {
        result = handler(a.payload, body, { id: a.id, declined, ...(option === undefined ? {} : { option }), afterCommit: work => {
          const failed = () => p.log({ event: 'hub-card-follow-up-failed', id: a.id });
          p.store.afterCommit(() => { void Promise.resolve(work()).catch(failed); }, failed);
        } });
        if (typeof result !== 'string') throw new Error('hub card handler must return an outcome string');
      }
      catch { throw new TopicRefusal('hub card handler failed; the card stays open'); }
      const attribution = standIn === undefined ? { answered_as: 'human' as const } : { answered_as: 'stand-in' as const, answered_by: standIn };
      const visible = a.secret ? 'answered' : body;
      const message: Message = { id: randomUUID(), from: user?.name ?? 'human', fromKind: 'human', via: via === 'telegram' || via === 'discord' ? via : 'hub', to: [], text: visible, ts: at, topic: a.topic, answerTo: a.id, ...attribution, ...(user ? { userId: user.id } : {}) };
      p.store.record(message, [], p.now().getTime());
      const sent = { message: { ...message, topic: a.topic, seq: p.store.messageSeq(message.id) }, outcomes: [] as SendOutcome[] };
      // Replace the provisional closure with its durable handler outcome before publishing it.
      p.store.reopenAsk(a.id);
      p.store.closeAsk(a.id, 'answered', at, { id: sent.message.id, ...(option === undefined ? {} : { option }), attribution, outcome: declined ? { status: 'declined', reason: a.secret ? 'answered' : result, by: user?.name ?? standIn ?? 'human', ...(user ? { userId: user.id } : {}), at, via } : { status: 'answered', text: a.secret ? 'answered' : result, ...(option === undefined ? {} : { option }), by: user?.name ?? standIn ?? 'human', ...(user ? { userId: user.id } : {}), at, via } });
      p.emitMessage(message);
      p.move(p.topic(a.topic), 'reply', 'hub card answered');
      this.#changed(a.id);
      p.publishTopics();
      p.log({ event: 'ask-answered', id: a.id, topic: a.topic, answer: message.id, option: option ?? null });
      return { ...sent, message: { ...sent.message, ask: cardOf(p.store.ask(a.id)!) } };
    });
  }

  withdraw(id: string, reason: string): void {
    const p = this.#port, a = p.store.ask(id);
    if (!a || a.from !== 'hub' || !a.hubKind) throw new TopicRefusal('no hub card');
    if (!reason.trim()) throw new TopicRefusal('withdrawal needs a reason');
    const at = p.now().toISOString();
    if (!p.store.closeAsk(id, 'withdrawn', at, { id: '', outcome: { status: 'answered', text: reason, by: 'hub', at } })) throw new TopicRefusal(`the ask is ${a.state}`);
    this.#changed(id);
    p.move(p.topic(a.topic), 'reply', 'hub card withdrawn');
    p.publishTopics();
  }

  #changed(id: string): void {
    const a = this.#port.store.ask(id)!;
    this.#port.emit({ type: 'ask', topic: a.topic, ask: id, card: cardOf(a) });
  }
}
