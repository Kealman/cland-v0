import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import { bounded, speechExchange } from './exchange.ts';

export type SpeechReply = { status?: number; body?: unknown; retryAfter?: string; delayMs?: number; location?: string };
export type SpeechRequest = { method: string; path: string; keyPresent: boolean; fields: Record<string, string>; file?: { bytes: Buffer; mime: string; filename: string } };

/** Loopback only, no key values in captured requests or diagnostics. */
export async function fakeSpeech(t: TestContext, replies: SpeechReply[] = [],
  setup: { signal?: AbortSignal; timeoutMs?: number; listen?: (server: Server, signal: AbortSignal) => void } = {}) {
  const requests: SpeechRequest[] = [];
  const closedRequests: number[] = [];
  const timers = new Set<NodeJS.Timeout>();
  const handlers = new Set<Promise<void>>();
  const server = createServer((req, res) => {
    const work = handle();
    handlers.add(work);
    void work.finally(() => handlers.delete(work));
    async function handle() {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': req.headers['content-type'] ?? '' } }).formData();
        const row: SpeechRequest = { method: req.method!, path: req.url!, keyPresent: Boolean(req.headers['xi-api-key']), fields: {} };
        for (const [name, value] of form) {
          if (typeof value === 'string') row.fields[name] = value;
          else row.file = { bytes: Buffer.from(await value.arrayBuffer()), mime: value.type, filename: value.name };
        }
        requests.push(row);
        const ordinal = requests.length;
        res.once('close', () => closedRequests.push(ordinal));
        const reply = replies[Math.min(requests.length - 1, replies.length - 1)] ?? {};
        const respond = () => {
          res.writeHead(reply.status ?? 200, { 'content-type': 'application/json', ...(reply.retryAfter ? { 'retry-after': reply.retryAfter } : {}), ...(reply.location ? { location: reply.location } : {}) });
          res.end(JSON.stringify(reply.body ?? { text: 'Привет', language_code: 'rus' }));
        };
        if (reply.delayMs) {
          const timer = setTimeout(() => { timers.delete(timer); respond(); }, reply.delayMs);
          timers.add(timer);
          res.once('close', () => { clearTimeout(timer); timers.delete(timer); });
        } else respond();
      } catch { if (!res.destroyed) { res.writeHead(400); res.end('{}'); } }
    }
  });
  const exchange = speechExchange(t, async () => {
    for (const timer of timers) clearTimeout(timer);
    const closed = new Promise<void>((resolve, reject) => server.close(error => error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    await Promise.allSettled([...handlers]);
  }, true);
  const setupController = new AbortController();
  const setupSignal = setup.signal ? AbortSignal.any([setupController.signal, setup.signal]) : setupController.signal;
  try {
    setupSignal.throwIfAborted();
    const listening = once(server, 'listening', { signal: setupSignal });
    void listening.catch(() => {}); // Also observe synchronous listen failure before the bounded await.
    if (setup.listen) setup.listen(server, setupSignal);
    else server.listen(0, '127.0.0.1');
    await bounded(listening, setup.timeoutMs ?? 2_000, 'fake speech setup incomplete');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fake speech bind failed');
    return { url: `http://127.0.0.1:${address.port}`, requests, closedRequests, ...exchange };
  } catch (error) {
    setupController.abort();
    await exchange.close();
    throw error;
  }
}
