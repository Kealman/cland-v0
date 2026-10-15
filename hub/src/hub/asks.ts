// Asks (spec 4.5, decisions #7 and #10, #33): a question the Coordinator puts to the human inside a topic, with
// numbered options and room for a free answer. An ask is a message (its text is the question) with a card in the
// `asks` table: open until the human answers it (`topic.answer`), the Coordinator withdraws it (`resolve`), or the
// topic or its item closes (cancelled). While any ask in a topic is open the topic is `waiting for human`.
//
// The answer is a human message carrying `answer_to` (the ask's id), addressed to the session that asked, and
// delivered like any human message. The core (`./core.ts`) owns the topics and the routing; it hands this module
// what it needs through the port below, so its private state stays its own.
import { nameRefusal } from '../names.ts';
import { randomUUID } from 'node:crypto';
import type { AnswerAttribution, AskCard, HubEvent, Message, SendOutcome, Topic, TopicMessage } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { cardOf, type AskRow, type Store } from './store.ts';
import { TopicRefusal, type TopicMove } from './topics.ts';
import { ToolForbidden, type Decision } from '../roles/permissions.ts';

/** At most nine options: the keys 1-9 answer them. */
export const MAX_OPTIONS = 9;
export const MAX_OPTION_CHARS = 200;

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
  /** The permission table's decision on `ask` for a role (spec 4.4: the Coordinator's by default). */
  mayAsk: (role: string | null) => Decision;
  identity: (id: string) => string;
  nextLead: (from: string, topic: Topic, forwarding?: boolean) => string | null;
  sendFromSession: (from: string, topic: string, to: string, text: string, replyTo: string, kind: 'question' | 'decision', answerTo?: string, attribution?: AnswerAttribution) => { message: Message; outcomes: SendOutcome[] };
  /** The human writes into a topic: the answer goes this way. */
  sendFromHuman: (topic: string, text: string, to: string[], answerTo: string, attribution: AnswerAttribution) => { message: TopicMessage; outcomes: SendOutcome[] };
  /** A hub note in a topic to one session: recorded, delivered now or queued. */
  noteTo: (topic: string, session: string, text: string) => void;
};

export class Asks {
  readonly #port: AskPort;

  constructor(port: AskPort) {
    this.#port = port;
  }

  /** Human asks take precedence while any linked questions still await their answer. */
  waitingIn(topic: string): 'waiting for human' | 'waiting for agent' | null {
    const open = this.#port.store.openAsks(topic);
    if (open.some(a => a.to === undefined)) return 'waiting for human';
    return open.length ? 'waiting for agent' : null;
  }

  /** Only questions to the sender's next lead become agent asks. Other questions remain ordinary sends. */
  recordQuestion(message: Message): void {
    const p = this.#port;
    if (message.kind !== 'question' || message.to.length !== 1 || message.fromRole === 'aide' || p.store.roleOf(message.to[0]!) === 'aide') return;
    const topic = p.topic(message.topic!);
    if (topic.id === 'agents' || p.nextLead(message.from, topic) !== message.to[0]) return;
    if (!message.text.trim()) throw new TopicRefusal('an ask needs a question');
    p.store.createAsk({ id: message.id, topic: topic.id, from: message.from, question: message.text, options: [], free: true, ts: message.ts, to: message.to[0]! });
    const parent = message.replyTo ? p.store.ask(message.replyTo) : null;
    if (parent?.state === 'open' && parent.toSessionId && !parent.forwarded && parent.question === message.text && p.identity(parent.toSessionId) === p.identity(`name:${message.from}`)) p.store.forwardAsk(parent.id, message.id);
  }

  /** Called with the recorded answer inside its message transaction, before any delivery. */
  recordAnswer(message: Message): void {
    if (!message.answerTo) return;
    const attribution: AnswerAttribution | undefined = message.answered_as ? {
      answered_as: message.answered_as,
      ...(message.answered_by ? { answered_by: message.answered_by } : {}),
      ...(message.relayed_by ? { relayed_by: message.relayed_by } : {}),
    } : undefined;
    this.#port.store.closeAsk(message.answerTo, 'answered', message.ts, { id: message.id, ...(attribution ? { attribution } : {}) });
  }

  #incoming(from: string, id: string, tool: string): AskRow {
    const p = this.#port;
    const a = p.store.ask(id);
    if (!a) throw new TopicRefusal(`no ask "${id}"`);
    if (a.state !== 'open') throw new TopicRefusal(`the ask is ${a.state}: it takes no action any more`);
    if (!a.to || !a.toSessionId || p.identity(`name:${from}`) !== p.identity(a.toSessionId)) throw new ToolForbidden(p.role(from), tool, 'only the receiving lead may answer or forward this agent ask');
    if (a.forwarded && p.store.ask(a.forwarded)?.state === 'open') throw new TopicRefusal('the forwarded ask still waits for its upstream answer');
    return a;
  }

  forward(from: string, id: string): { ask: string; topic: { id: string; title: string } } {
    const p = this.#port;
    const a = this.#incoming(from, id, 'ask.forward');
    if (a.forwarded) throw new TopicRefusal('this ask was already forwarded; answer it after the upstream answer');
    const topic = p.topic(a.topic);
    const next = p.nextLead(from, topic, true);
    let result: { ask: string; topic: { id: string; title: string } };
    if (next === null) {
      result = this.ask(from, a.topic, a.question, a.options, a.free, a.id);
    } else {
      const sent = p.sendFromSession(from, a.topic, next, a.question, a.id, 'question');
      if (!p.store.ask(sent.message.id)) throw new TopicRefusal('the forward was not delivered to the next lead; the original ask stays open');
      result = { ask: sent.message.id, topic: { id: topic.id, title: topic.title } };
    }
    p.store.forwardAsk(a.id, result.ask);
    this.#changed(a.id);
    p.move(topic, 'between-agents', `ask forwarded by ${from}`);
    p.publishTopics();
    p.log({ event: 'ask-forwarded', id: a.id, forwarded: result.ask, from, to: next ?? 'human', topic: a.topic });
    return result;
  }

  answerFromSession(from: string, id: string, text: string): { message: Message; outcomes: SendOutcome[] } {
    const p = this.#port;
    const a = this.#incoming(from, id, 'ask.answer');
    const body = text.trim();
    if (!body) throw new TopicRefusal('an answer needs a text');
    // Close only after delivery admission succeeds, so a muted pair leaves the ask pending.
    const senderId = a.fromSessionId ?? p.store.senderSessionId(a.id);
    const sender = senderId ? p.store.nameOfSession(p.identity(senderId)) : null;
    const upstream = a.forwarded ? p.store.ask(a.forwarded) : null;
    const attribution: AnswerAttribution | undefined = upstream?.answered_as ? { answered_as: upstream.answered_as, ...(upstream.answered_by ? { answered_by: upstream.answered_by } : {}), relayed_by: from } : undefined;
    const sent = p.sendFromSession(from, a.topic, sender ?? a.from, body, a.id, 'decision', a.id, attribution);
    if (!p.store.message(sent.message.id)) throw new TopicRefusal('the answer was not delivered; the ask stays open');
    p.log({ event: 'ask-answered', id: a.id, topic: a.topic, answer: sent.message.id, from, ...attribution });
    this.#changed(a.id);
    p.move(p.topic(a.topic), 'reply', `ask answered by ${from}`);
    p.publishTopics();
    return sent;
  }

  waitingFor(topic: string): string[] {
    const p = this.#port;
    const waiting = p.store.openAsks(topic).filter(a => !a.forwarded || p.store.ask(a.forwarded)?.state !== 'open');
    return [...new Set(waiting.map(a => {
      if (!a.to) return 'human';
      return a.toSessionId ? p.store.nameOfSession(p.identity(a.toSessionId)) ?? a.to : a.to;
    }))];
  }

  card(id: string): AskCard | null {
    const a = this.#port.store.ask(id);
    return a ? cardOf(a) : null;
  }

  /** Open cards identify the receiving session by its current name. */
  renamed(sessionId: string): void {
    for (const ask of this.#port.store.openAsks()) {
      if (ask.toSessionId === sessionId) this.#changed(ask.id);
    }
  }

  /**
   * `from` asks the human in `topicId`; the topic then waits for the human. Several asks may be open in one topic.
   * Who may ask is the permission table's (`ask`, the Coordinator's by default: `roles/permissions.ts`).
   */
  ask(from: string, topicId: string, question: string, options: string[], free = true, replyTo?: string): { ask: string; topic: { id: string; title: string } } {
    const p = this.#port;
    const role = p.role(from);
    if (role !== 'coordinator') throw new ToolForbidden(role, 'ask', 'only the Coordinator asks the human');
    // the table is the one rule: the dispatcher refuses first on a hub with role definitions, this applies the
    // same table (its defaults) on one without
    const may = p.mayAsk(role);
    if (!may.ok) throw new ToolForbidden(role, may.permission, may.reason);
    const topic = p.topic(topicId);
    if (topic.id === 'agents') throw new TopicRefusal('Agents is a record of what agents send each other: ask the human in General or the topic the question belongs to');
    const q = typeof question === 'string' ? (replyTo === undefined ? question.trim() : question) : '';
    if (!q.trim()) throw new TopicRefusal('an ask needs a question');
    const size = p.sizeRefusal(q);
    if (size) throw new TopicRefusal(size);
    const opts = options.map((o) => o.trim());
    if (opts.length > MAX_OPTIONS) throw new TopicRefusal(`an ask has at most ${MAX_OPTIONS} options (the keys 1-9 answer them)`);
    if (opts.some((o) => !o)) throw new TopicRefusal('an option needs a text');
    if (opts.some((o) => o.length > MAX_OPTION_CHARS || o.includes('\n'))) throw new TopicRefusal(`an option is one line of at most ${MAX_OPTION_CHARS} characters`);
    if (opts.length === 0 && !free) throw new TopicRefusal('an ask needs options or a free answer');
    const now = p.now();
    const message: Message = { id: randomUUID(), from, fromKind: 'agent', ...(role !== null ? { fromRole: role } : {}), via: 'session', to: [], ...(replyTo !== undefined ? { replyTo } : {}), text: q, ts: now.toISOString(), topic: topic.id };
    // the message and its card, then the event: the card rides on it
    p.store.transaction(() => {
      p.store.record(message, [], now.getTime());
      p.store.createAsk({ id: message.id, topic: topic.id, from, question: q, options: opts, free, ts: message.ts });
      if (replyTo !== undefined) p.store.forwardAsk(replyTo, message.id);
    });
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
  answer(id: string, option?: number, text?: string, standIn?: string): { message: TopicMessage; outcomes: SendOutcome[] } {
    const p = this.#port;
    const a = p.store.ask(id);
    if (!a) throw new TopicRefusal(`no ask "${id}"`);
    if (a.state !== 'open') throw new TopicRefusal(`the ask is ${a.state}: "${a.question}" takes no answer any more`);
    if (a.to !== undefined) throw new TopicRefusal('this ask waits for an agent; only its receiving lead may answer it');
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
    if (standIn !== undefined) {
      const refusal = nameRefusal(standIn);
      if (refusal) throw new TopicRefusal(refusal);
    }
    const attribution: AnswerAttribution = standIn === undefined ? { answered_as: 'human' } : { answered_as: 'stand-in', answered_by: standIn };
    // closed first: the topic's status after the answer reads the asks still open
    p.store.closeAsk(a.id, 'answered', p.now().toISOString(), { id: '', attribution, ...(option !== undefined ? { option } : {}) });
    let sent: { message: TopicMessage; outcomes: SendOutcome[] };
    try {
      // to the session that asked, unless it has since handed the role it asked as over (#31): then to the role,
      // whose current holder inherited the question (`role.state` lists it)
      const askedAs = p.store.message(a.id)?.fromRole;
      const to = askedAs !== undefined && p.store.roleOf(a.from) !== askedAs ? askedAs : a.from;
      sent = p.sendFromHuman(a.topic, body, [to], a.id, attribution);
    } catch (err) {
      p.store.reopenAsk(a.id);
      throw err;
    }
    p.store.setAskAnswer(a.id, sent.message.id);
    p.log({ event: 'ask-answered', id: a.id, topic: a.topic, answer: sent.message.id, option: option ?? null, ...attribution });
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
