// The hub's Unix socket edge, for the UI and the CLI: JSON lines in and out, every frame handed to the
// shared dispatcher. There is no upgrade request here to carry the secret, so the hello carries it (ADR 0003).
import { chmodSync, lstatSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
        sendSerialized: json => { if (!socket.destroyed) socket.write(`${json}\n`); },
        send: (frame) => {
          if (!socket.destroyed) socket.write(`${JSON.stringify(frame)}\n`);
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

  // Bound under a name of this process's own, then renamed into place (replacing a stale file there).
  // Node removes the name it bound when the server closes; that name is gone by then, so the close can
  // never remove a socket another hub has put at `path` since.
  const staging = join(dirname(options.path), `.h${process.pid}`);
  rmSync(staging, { force: true });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(staging, () => resolve());
  });
  try {
    // only this user may even try the secret
    chmodSync(staging, 0o600);
    renameSync(staging, options.path);
  } catch (err) {
    // not in place: nothing this edge bound may outlive the failure
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(staging, { force: true });
    throw err;
  }
  // the file this edge bound: on close, only that file is removed
  const bound = lstatSync(options.path);
  log({ event: 'listening', socket: options.path });

  return {
    close: async () => {
      for (const c of clients) c.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      try {
        const now = lstatSync(options.path);
        if (now.ino === bound.ino && now.dev === bound.dev) rmSync(options.path, { force: true });
        else log({ event: 'socket-kept', socket: options.path, reason: 'the file at the path is no longer the socket this hub bound' });
      } catch {
        /* already gone */
      }
    },
  };
}
