import { within } from '../../../src/executor/droplet/deadline.ts';
import { WebSocketServer, WebSocket } from 'ws';
import type { Socket } from 'node:net';
import type { Server } from 'node:http';
import { DISCORD_IDS, DISCORD_TEST_TOKEN } from './fake-api.ts';

/** Safe receipts exclude Identify's credential, even on invalid payloads. */
export function fakeGateway(server: Server) {
  const wss = new WebSocketServer({ server, perMessageDeflate: false });
  const listening = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  let didListen = false, didClose = false;
  wss.once('listening', () => { didListen = true; listening.resolve(); });
  wss.once('close', () => { didClose = true; closed.resolve(); });
  let closing: Promise<void> | undefined;
  const state = { identifies: 0, heartbeats: 0, payloads: 0, validIdentify: false, closes: [] as number[] };
  const transports = new Set<Socket>();
  let interval = 1000, acknowledge = true, sequence = 0;
  const send = (socket: WebSocket, value: unknown) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); };
  wss.on('connection', (socket, req) => {
    transports.add(req.socket);
    socket.once('close', () => transports.delete(req.socket));
    const url = new URL(req.url!, 'http://127.0.0.1');
    send(socket, { op: 10, d: { heartbeat_interval: interval } });
    socket.on('message', bytes => {
      let frame: { op: number; d: Record<string, unknown> };
      try { frame = JSON.parse(String(bytes)); } catch { socket.close(4002); return; }
      state.payloads++;
      if (frame.op === 2) {
        state.identifies++;
        state.validIdentify = frame.d.token === DISCORD_TEST_TOKEN && frame.d.intents === 33281
          && !('shard' in frame.d) && !('presence' in frame.d) && !frame.d.compress
          && url.searchParams.get('v') === '10' && url.searchParams.get('encoding') === 'json'
          && !url.searchParams.has('compress') && !req.headers['sec-websocket-extensions'];
        if (!state.validIdentify) { socket.close(4002); return; }
        send(socket, { op: 0, t: 'READY', s: ++sequence, d: { session_id: 'fixture-session',
          resume_gateway_url: `ws://127.0.0.1:${(server.address() as { port: number }).port}`, user: { id: DISCORD_IDS.bot } } });
      }
      if (frame.op === 1) { state.heartbeats++; if (acknowledge) send(socket, { op: 11, d: null }); }
    });
    socket.on('close', code => { state.closes.push(code); });
    socket.on('error', () => socket.terminate());
  });
  return { state, listening: listening.promise, closed: closed.promise,
    receipts: () => ({ listening: didListen, closed: didClose, clients: wss.clients.size }),
    configure(body: Record<string, unknown>) { if (typeof body.holdClose === 'boolean') for (const transport of transports) { if (body.holdClose) transport.pause(); else transport.resume(); } if (typeof body.interval === 'number') interval = body.interval; if (typeof body.acknowledge === 'boolean') acknowledge = body.acknowledge; },
    closeCode(code: number) { for (const socket of wss.clients) socket.close(code); },
    dispatch(body: Record<string, unknown>) { for (const socket of wss.clients) send(socket, body); },
    close: () => closing ??= within(new Promise<void>((resolve, reject) => { for (const socket of wss.clients) socket.terminate(); wss.close(error => error ? reject(error) : resolve()); }), 2000),
  };
}
