// The hub's Unix socket edge, for the UI and the CLI: JSON lines in and out, every frame handed to the
// shared dispatcher. There is no upgrade request here to carry the secret, so the hello carries it (ADR 0003).
import { bindUnixSocket } from './unix-bind.ts';
import { createServer, type Socket } from 'node:net';
import type { Dispatcher } from './dispatch.ts';
import { MAX_FRAME_BYTES } from '../protocol.ts';
import { lineReader } from './lines.ts';
import type { LogFn } from '../log.ts';

export type SocketEdgeOptions = {
  path: string;
  dispatcher: Dispatcher;
  log?: LogFn;
};

export type SocketEdge = { close: () => Promise<void> };

/** Bind the socket at `path`, replacing a stale file there: the caller holds the project's lock, so no live hub owns it. */
export async function createSocketEdge(options: SocketEdgeOptions): Promise<SocketEdge> {
  const log = options.log ?? (() => {});
  const clients = new Set<Socket>();

  const server = createServer((socket) => {
    clients.add(socket);
    socket.setEncoding('utf8');
    const conversation = options.dispatcher.open(
      {
        bufferedBytes: () => socket.writableLength,
        send: (frame, serialized) => {
          if (!socket.destroyed) socket.write(`${serialized ?? JSON.stringify(frame)}\n`);
        },
        // end, not destroy: the frame written just before (a refusal, a result) still goes out
        close: () => socket.end(),
        isOpen: () => !socket.destroyed && socket.writable,
      },
      { authenticated: false, edge: 'socket' },
    );

    socket.on(
      'data',
      lineReader({
        maxBytes: MAX_FRAME_BYTES,
        onLine: (line) => conversation.receive(line),
        onTooLarge: () => {
          log({ event: 'refused', edge: 'socket', code: 'frame-too-large' });
          socket.destroy();
        },
        isOpen: () => !socket.destroyed,
      }),
    );
    socket.on('close', () => {
      clients.delete(socket);
      conversation.closed();
    });
    socket.on('error', () => {
      /* close follows */
    });
  });

  const removeBound = await bindUnixSocket(server, options.path);
  log({ event: 'listening', socket: options.path });

  return {
    close: async () => {
      for (const c of clients) c.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (!removeBound()) log({ event: 'socket-kept', socket: options.path, reason: 'the file at the path is no longer the socket this hub bound' });
    },
  };
}
