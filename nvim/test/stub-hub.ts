#!/usr/bin/env node
// A stub hub for the shell's tests: it speaks the UI's frames (hub/README.md, "The UI's frames" and the
// `session.*` frames) as JSON lines on stdin and stdout, the way `cland hub serve --stdio` does, from a
// scripted scenario. The client spawns it through CLAND_COMMAND as `<stub> hub serve --stdio`.
//
//   CLAND_STUB_SCENARIO  a JSON file: topics, messages per topic, processes, adapters, presence, items,
//                        attach commands per session, and how topic.send answers (ok | refuse | hold)
//   CLAND_STUB_CONTROL   a Unix socket the test drives it through, one JSON line per command:
//                        {"emit": frame}       push an event frame to the client
//                        {"set": {...}}        replace parts of the scenario (processes, items, send, …)
//                        {"requests": true}    answer with every request frame received so far
//                        {"release": {"error"?: "…"}}  answer the held topic.send requests
import { createServer, type Socket } from 'node:net';
import { readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export type Scenario = {
  topics?: Array<Record<string, unknown>>;
  messages?: Record<string, Array<Record<string, unknown>>>;
  processes?: Array<Record<string, unknown>>;
  adapters?: Record<string, unknown>;
  presence?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  attach?: Record<string, string>;
  send?: 'ok' | 'refuse' | 'hold';
  /** `hub.status`'s `coordinator` (the live holder, or null); absent, the field is left out. */
  coordinator?: string | null;
  /** The inbox (#33): `inbox.list` answers it, `topic.answer` and `inbox.dismiss*` change it and push an `inbox` event. */
  inbox?: { asks?: Array<Record<string, unknown>>; approvals?: Array<Record<string, unknown>>; waiting?: Array<Record<string, unknown>>; notifications?: Array<Record<string, unknown>> };
};

type Frame = Record<string, unknown> & { type?: string; id?: string };

const scenarioFile = process.env.CLAND_STUB_SCENARIO;
const controlPath = process.env.CLAND_STUB_CONTROL;
const scenario: Scenario = scenarioFile ? (JSON.parse(readFileSync(scenarioFile, 'utf8')) as Scenario) : {};
const now = () => new Date().toISOString();
scenario.topics ??= [
  { id: 'general', title: 'General', status: 'open', standing: true, createdAt: now(), updatedAt: now() },
  { id: 'agents', title: 'Agents', status: 'open', standing: true, createdAt: now(), updatedAt: now() },
];

const requests: Frame[] = [];
const held: Frame[] = [];

const write = (frame: unknown) => process.stdout.write(`${JSON.stringify(frame)}\n`);
const ok = (id: unknown, value: unknown) => write({ type: 'result', id, ok: true, value });
const fail = (id: unknown, error: string) => write({ type: 'result', id, ok: false, error });

function topicMessage(f: Frame): Record<string, unknown> {
  return { id: randomUUID(), from: 'human', fromKind: 'human', via: 'ui', to: ['coordinator'], text: f.text, ts: now(), topic: f.topic, stage: 'queued' };
}

function acceptSend(f: Frame) {
  const message = topicMessage(f);
  const topic = scenario.topics?.find((t) => t.id === f.topic);
  write({ type: 'message', topic: { id: f.topic, title: topic?.title ?? f.topic }, message });
  ok(f.id, { message, outcomes: [] });
}

/** The inbox as the hub answers it, with its "needs you" count. */
function inboxValue(): Record<string, unknown> {
  const ib = scenario.inbox ?? {};
  const asks = ib.asks ?? [];
  const approvals = ib.approvals ?? [];
  const waiting = ib.waiting ?? [];
  return { asks, approvals, waiting, notifications: ib.notifications ?? [], needsYou: asks.length + approvals.length + waiting.length };
}

/** The human answers an ask: the answer message (with answerTo, to the asker), the card answered, the row gone. */
function answerAsk(f: Frame) {
  const id = String(f.ask);
  let topicId: string | undefined;
  let ask: Record<string, unknown> | undefined;
  for (const [topic, list] of Object.entries(scenario.messages ?? {})) {
    const found = list.find((m) => m.id === id);
    if (found) {
      topicId = topic;
      ask = found;
    }
  }
  const row = scenario.inbox?.asks?.find((a) => a.id === id);
  topicId ??= (row?.topic as { id?: string } | undefined)?.id;
  const card = (ask?.ask ?? { question: row?.question, options: row?.options ?? [], free: row?.free ?? true, state: 'open' }) as Record<string, unknown>;
  if (!topicId || card.state !== 'open') return fail(f.id, `the ask "${id}" takes no answer`);
  const options = (card.options as string[]) ?? [];
  const option = typeof f.option === 'number' ? f.option : undefined;
  const text = option !== undefined ? options[option - 1] : typeof f.text === 'string' ? f.text.trim() : '';
  if (!text) return fail(f.id, option !== undefined ? `option ${option} is not one of 1-${options.length}` : 'an answer needs an option or a text');
  const from = String(ask?.from ?? row?.from ?? 'coordinator');
  const message = { id: randomUUID(), from: 'human', fromKind: 'human', via: 'hub', to: [from], text, ts: now(), topic: topicId, answerTo: id, stage: 'queued' };
  const answered = { ...card, state: 'answered', answer: message.id, ...(option !== undefined ? { option } : {}) };
  if (ask) ask.ask = answered;
  (scenario.messages ??= {})[topicId] = [...(scenario.messages?.[topicId] ?? []), message];
  if (scenario.inbox?.asks) scenario.inbox.asks = scenario.inbox.asks.filter((a) => a.id !== id);
  const topic = scenario.topics?.find((t) => t.id === topicId);
  write({ type: 'message', topic: { id: topicId, title: topic?.title ?? topicId }, message });
  write({ type: 'ask', topic: topicId, ask: id, card: answered });
  write({ type: 'inbox', inbox: inboxValue() });
  ok(f.id, { message, outcomes: [] });
}

function answer(f: Frame) {
  requests.push(f);
  switch (f.type) {
    case 'hello':
      return write({ type: 'welcome', protocol: 2, client: 'nvim' });
    case 'subscribe':
      return ok(f.id, { subscribed: true });
    case 'topic.list':
      return ok(f.id, { topics: scenario.topics });
    case 'topic.history': {
      const topic = scenario.topics?.find((t) => t.id === f.topic);
      if (!topic) return fail(f.id, `no topic ${String(f.topic)}`);
      return ok(f.id, { topic, messages: scenario.messages?.[String(f.topic)] ?? [] });
    }
    case 'topic.send':
      if (scenario.send === 'refuse') return fail(f.id, 'the message is larger than 8192 bytes');
      if (scenario.send === 'hold') return void held.push(f);
      return acceptSend(f);
    case 'topic.create': {
      if (typeof f.title !== 'string' || !f.title.trim()) return fail(f.id, 'a topic needs a title');
      const topic = { id: `topic-${(scenario.topics?.length ?? 0) + 1}`, title: f.title.trim(), status: 'open', standing: false, createdAt: now(), updatedAt: now(), item: null, unread: 0, lastMessageAt: null };
      scenario.topics?.push(topic);
      write({ type: 'topic', topic });
      return ok(f.id, { topic });
    }
    case 'topic.close':
    case 'topic.resolve':
    case 'topic.read': {
      const topic = scenario.topics?.find((t) => t.id === f.topic);
      if (!topic) return fail(f.id, `no topic "${String(f.topic)}"`);
      if (f.type === 'topic.close') topic.status = 'closed';
      if (f.type === 'topic.resolve') topic.status = 'open';
      if (f.type === 'topic.read') topic.unread = 0;
      write({ type: 'topic', topic });
      return ok(f.id, { topic });
    }
    case 'session.list':
      return ok(f.id, { processes: scenario.processes ?? [], adapters: scenario.adapters ?? {} });
    case 'session.attach': {
      const command = scenario.attach?.[String(f.session)];
      return command ? ok(f.id, { command }) : fail(f.id, `no session named ${String(f.session)}`);
    }
    case 'hub.status':
      return ok(f.id, { sessions: scenario.presence ?? [], ...(scenario.coordinator !== undefined ? { coordinator: scenario.coordinator } : {}), ...(scenario.inbox ? { needsYou: inboxValue().needsYou } : {}) });
    case 'inbox.list':
      return scenario.inbox ? ok(f.id, inboxValue()) : fail(f.id, 'the stub hub has no inbox in this scenario');
    case 'topic.answer':
      return answerAsk(f);
    case 'inbox.dismiss':
    case 'inbox.dismiss_all': {
      const ib = (scenario.inbox ??= {});
      if (f.type === 'inbox.dismiss') {
        if (!(ib.notifications ?? []).some((n) => n.id === f.notification)) return fail(f.id, `no notification "${String(f.notification)}"`);
        ib.notifications = (ib.notifications ?? []).filter((n) => n.id !== f.notification);
      } else ib.notifications = [];
      write({ type: 'inbox', inbox: inboxValue() });
      return ok(f.id, inboxValue());
    }
    case 'task.list':
      return ok(f.id, { items: scenario.items ?? [] });
    default:
      return fail(f.id, `the stub hub does not answer ${String(f.type)}`);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  let nl: number;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (!line.trim()) continue;
    try {
      answer(JSON.parse(line) as Frame);
    } catch (err) {
      process.stderr.write(`stub hub: ${String(err)}\n`);
    }
  }
});

let server: ReturnType<typeof createServer> | null = null;
if (controlPath) {
  rmSync(controlPath, { force: true });
  server = createServer((sock: Socket) => {
    let buf = '';
    sock.setEncoding('utf8');
    sock.on('data', (chunk: string) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const cmd = JSON.parse(line) as Record<string, unknown>;
        if (cmd.emit) write(cmd.emit);
        if (cmd.set) Object.assign(scenario, cmd.set);
        if (cmd.release) {
          const error = (cmd.release as { error?: string }).error;
          for (const f of held.splice(0)) {
            if (error) fail(f.id, error);
            else acceptSend(f);
          }
        }
        sock.write(`${JSON.stringify({ ok: true, ...(cmd.requests ? { requests } : {}) })}\n`);
      }
    });
    sock.on('error', () => {});
  });
  server.listen(controlPath);
}

// the hub stops when its parent closes stdin, like `serve --stdio`
process.stdin.on('end', () => {
  server?.close();
  if (controlPath) rmSync(controlPath, { force: true });
  process.exit(0);
});
