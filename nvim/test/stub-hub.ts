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
    case 'session.list':
      return ok(f.id, { processes: scenario.processes ?? [], adapters: scenario.adapters ?? {} });
    case 'session.attach': {
      const command = scenario.attach?.[String(f.session)];
      return command ? ok(f.id, { command }) : fail(f.id, `no session named ${String(f.session)}`);
    }
    case 'hub.status':
      return ok(f.id, { sessions: scenario.presence ?? [], ...(scenario.coordinator !== undefined ? { coordinator: scenario.coordinator } : {}) });
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
