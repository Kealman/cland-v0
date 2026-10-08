// The hub's Unix socket edge, for the UI and the CLI: JSON lines in and out, every frame handed to the
// shared dispatcher. There is no upgrade request here to carry the secret, so the hello carries it (ADR 0003).
import { chmodSync, rmSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import type { Dispatcher } from './dispatch.ts';
import { MAX_FRAME_BYTES } from '../protocol.ts';
import type { LogFn } from '../log.ts';

export type SocketEdgeOptions = {
  path: string;
  dispatcher: Dispatcher;
  log?: LogFn;
};

export type SocketEdge = { close: () => Promise<void> };

/** Bind the socket at `path`, replacing a stale file there: the caller has made sure no live hub owns it. */
export async function createSocketEdge(options: SocketEdgeOptions): Promise<SocketEdge> {
  const log = options.log ?? (() => {});
  const clients = new Set<Socket>();

  const server = createServer((socket) => {
    clients.add(socket);
    socket.setEncoding('utf8');
    let buffer = '';
    const conversation = options.dispatcher.open(
      {
        send: (frame) => {
          if (!socket.destroyed) socket.write(`${JSON.stringify(frame)}\n`);
        },
        // end, not destroy: the frame written just before (a refusal, a result) still goes out
        close: () => socket.end(),
      },
      { authenticated: false, edge: 'socket' },
    );

    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_FRAME_BYTES) {
        log({ event: 'refused', edge: 'socket', code: 'frame-too-large' });
        socket.destroy();
        return;
      }
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0 && !socket.destroyed) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) conversation.receive(line);
      }
    });
    socket.on('close', () => {
      clients.delete(socket);
      conversation.closed();
    });
    socket.on('error', () => {
      /* close follows */
    });
  });

  rmSync(options.path, { force: true });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.path, () => resolve());
  });
  // only this user may even try the secret
  chmodSync(options.path, 0o600);
  log({ event: 'listening', socket: options.path });

  return {
    close: async () => {
      for (const c of clients) c.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(options.path, { force: true });
    },
  };
}
