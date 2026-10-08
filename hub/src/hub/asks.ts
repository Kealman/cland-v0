// Asks (spec 4.5, decisions #7 and #10, #33): a question the Coordinator puts to the human inside a topic, with
// numbered options and room for a free answer. An ask is a message (its text is the question) with a card in the
// `asks` table: open until the human answers it (`topic.answer`), the Coordinator withdraws it (`resolve`), or the
// topic or its item closes (cancelled). While any ask in a topic is open the topic is `waiting for human`.
//
// The answer is a human message carrying `answer_to` (the ask's id), addressed to the session that asked, and
// delivered like any human message. The core (`./core.ts`) owns the topics and the routing; it hands this module
// what it needs through the port below, so its private state stays its own.
import { randomUUID } from 'node:crypto';
import type { AskCard, HubEvent, Message, SendOutcome, Topic, TopicMessage } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { ROLE_LABELS } from '../names.ts';
import { cardOf, type AskRow, type Store } from './store.ts';
import { TopicRefusal, type TopicMove } from './topics.ts';

/** Only the Coordinator asks the human (spec 4.4, decision #10). */
export const ASKING_ROLE = 'coordinator';
/** At most nine options: the keys 1-9 answer them. */
export const MAX_OPTIONS = 9;
export const MAX_OPTION_CHARS = 200;

/**
 * A session that may not ask, refused with the typed shape the permission table (#30) answers with: the missing
 * permission, the caller's role at call time, and why.
 */
export class AskForbidden extends Error {
  readonly permission = 'ask';
  readonly role: string | null;
  readonly reason: string;
  constructor(role: string | null) {
    const who = role === null ? 'a session with no role' : (ROLE_LABELS[role] ?? role);
    const reason = `only the Coordinator asks the human: ${who} may not ask; send the question to the coordinator instead`;
    super(`forbidden: ask (${reason})`);
    this.role = role;
    this.reason = reason;
  }
}

/** What the asks need from the core. */
export type AskPort = {
  store: Store;
  now: () => Date;
  log: LogFn;
  emit: (event: HubEvent) => void;
  /** A recorded topic message to the subscribers. */
  emitMessage: (message: Message) => void;
  /** Tell subscribers about topics whose status changed. */
  publishTopics: () => void;
  /** Move a topic's status (the core keeps an open ask's topic waiting for the human). */
  move: (topic: Topic, move: TopicMove, why: string) => void;
  /** The topic, or a thrown "no topic". */
  topic: (id: string) => Topic;
  /** Why a text is too large, or null. */
  sizeRefusal: (text: string) => string | null;
  /** The role a live session holds, or null. */
  role: (name: string) => string | null;
  /** The human writes into a topic: the answer goes this way. */
  sendFromHuman: (topic: string, text: string, to: string[], answerTo: string) => { message: TopicMessage; outcomes: SendOutcome[] };
  /** A hub note in a topic to one session: recorded, delivered now or queued. */
  noteTo: (topic: string, session: string, text: string) => void;
};

export class Asks {
  readonly #port: AskPort;

  constructor(port: AskPort) {
    this.#port = port;
  }

  /** Whether a topic has an open ask: it then waits for the human. */
  openIn(topic: string): boolean {
    return this.#port.store.openAsks(topic).length > 0;
  }

  card(id: string): AskCard | null {
    const a = this.#port.store.ask(id);
    return a ? cardOf(a) : null;
  }

  /**
   * `from` asks the human in `topicId`. Only a session holding the Coordinator may; the topic then waits for the
   * human. Several asks may be open in one topic.
   */
  ask(from: string, topicId: string, question: string, options: string[], free = true): { ask: string; topic: { id: string; title: string } } {
    const p = this.#port;
    const role = p.role(from);
    if (role !== ASKING_ROLE) throw new AskForbidden(role);
    const topic = p.topic(topicId);
    if (topic.id === 'agents') throw new TopicRefusal('Agents is a record of what agents send each other: ask the human in General or the topic the question belongs to');
    const q = typeof question === 'string' ? question.trim() : '';
    if (!q) throw new TopicRefusal('an ask needs a question');
    const size = p.sizeRefusal(q);
    if (size) throw new TopicRefusal(size);
    const opts = options.map((o) => o.trim());
    if (opts.length > MAX_OPTIONS) throw new TopicRefusal(`an ask has at most ${MAX_OPTIONS} options (the keys 1-9 answer them)`);
    if (opts.some((o) => !o)) throw new TopicRefusal('an option needs a text');
    if (opts.some((o) => o.length > MAX_OPTION_CHARS || o.includes('\n'))) throw new TopicRefusal(`an option is one line of at most ${MAX_OPTION_CHARS} characters`);
    if (opts.length === 0 && !free) throw new TopicRefusal('an ask needs options or a free answer');
    const now = p.now();
    const message: Message = { id: randomUUID(), from, fromKind: 'agent', fromRole: role, via: 'session', to: [], text: q, ts: now.toISOString(), topic: topic.id };
    // the message and its card, then the event: the card rides on it
    p.store.record(message, [], now.getTime());
    p.store.createAsk({ id: message.id, topic: topic.id, from, question: q, options: opts, free, ts: message.ts });
    p.store.touchTopic(topic.id, message.ts);
    p.emitMessage(message);
    p.move(topic, 'ask', `an ask from ${from}`);
    p.publishTopics();
    p.log({ event: 'ask', id: message.id, topic: topic.id, from, options: opts.length, free });
    return { ask: message.id, topic: { id: topic.id, title: topic.title } };
  }

  /**
   * The human answers an ask: with option `option` (1-based) or a free `text`. The answer is a human message
   * carrying `answer_to`, addressed to the session that asked; the ask is answered. With no other ask open the topic
   * no longer waits for the human: the human spoke last, so it waits for the agent.
   */
  answer(id: string, option?: number, text?: string): { message: TopicMessage; outcomes: SendOutcome[] } {
    const p = this.#port;
    const a = p.store.ask(id);
    if (!a) throw new TopicRefusal(`no ask "${id}"`);
    if (a.state !== 'open') throw new TopicRefusal(`the ask is ${a.state}: "${a.question}" takes no answer any more`);
    let body: string;
    if (option !== undefined) {
      if (!Number.isInteger(option) || option < 1 || option > a.options.length) {
        throw new TopicRefusal(a.options.length ? `option ${option} is not one of 1-${a.options.length}` : 'this ask has no options: answer it with a text');
      }
      body = a.options[option - 1] as string;
    } else {
      body = typeof text === 'string' ? text.trim() : '';
      if (!body) throw new TopicRefusal('an answer needs an option or a text');
      if (!a.free && a.options.length) throw new TopicRefusal(`this ask takes one of its options (1-${a.options.length}), not a free answer`);
    }
    // closed first: the topic's status after the answer reads the asks still open
    p.store.closeAsk(a.id, 'answered', p.now().toISOString(), { id: '', ...(option !== undefined ? { option } : {}) });
    let sent: { message: TopicMessage; outcomes: SendOutcome[] };
    try {
      sent = p.sendFromHuman(a.topic, body, [a.from], a.id);
    } catch (err) {
      p.store.reopenAsk(a.id);
      throw err;
    }
    p.store.setAskAnswer(a.id, sent.message.id);
    p.log({ event: 'ask-answered', id: a.id, topic: a.topic, answer: sent.message.id, option: option ?? null });
    this.#changed(a.id);
    return sent;
  }

  /**
   * `resolve` withdraws the open asks of a topic: the Coordinator's (it took the question back), or the human's
   * `topic.resolve` (the human waved it off; the asker is told). Returns how many.
   */
  withdraw(topicId: string, by: string): number {
    return this.#close(topicId, 'withdrawn', by, (a) => (a.from === by ? null : `the human withdrew your ask "${a.question}" in this topic (resolved)`));
  }

  /** The topic or its unit of work closed: its open asks are cancelled, and each asker is told. */
  cancel(topicId: string, why: string): number {
    return this.#close(topicId, 'cancelled', why, (a) => `your ask "${a.question}" was cancelled: ${why}`);
  }

  #close(topicId: string, state: 'withdrawn' | 'cancelled', by: string, note: (a: AskRow) => string | null): number {
    const p = this.#port;
    const open = p.store.openAsks(topicId);
    const at = p.now().toISOString();
    let n = 0;
    for (const a of open) {
      if (!p.store.closeAsk(a.id, state, at)) continue;
      n++;
      p.log({ event: `ask-${state}`, id: a.id, topic: topicId, by });
      this.#changed(a.id);
      const text = note(a);
      if (text !== null) {
        try {
          p.noteTo(topicId, a.from, `cland hub: ${text}`);
        } catch (err) {
          p.log({ event: 'ask-note-failed', id: a.id, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    return n;
  }

  #changed(id: string): void {
    const a = this.#port.store.ask(id);
    if (a) this.#port.emit({ type: 'ask', topic: a.topic, ask: a.id, card: cardOf(a) });
  }
}
