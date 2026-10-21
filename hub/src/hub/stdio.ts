// The hub's stdio edge: the same frames as JSON lines over a byte stream pair, for a UI (or a QA run)
// that spawned the hub as its child. The parent owns the pipes, so it is trusted: no secret here. One
// conversation for the life of the stream; the stream ending ends it.
import type { Readable, Writable } from 'node:stream';
import type { Dispatcher } from './dispatch.ts';
import { MAX_FRAME_BYTES } from '../protocol.ts';
import { lineReader } from './lines.ts';
import type { LogFn } from '../log.ts';

export type StdioEdgeOptions = {
  input: Readable;
  output: Writable;
  dispatcher: Pick<Dispatcher, 'open'>;
  log?: LogFn;
  /** The input ended or the conversation closed it: the parent is gone or done. */
  onEnd: () => void;
};

export function createStdioEdge(options: StdioEdgeOptions): void {
  const { input, output } = options;
  const log = options.log ?? (() => {});
  let open = true;
  const end = () => {
    if (!open) return;
    open = false;
    conversation.closed();
    options.onEnd();
  };
  const conversation = options.dispatcher.open(
    {
      bufferedBytes: () => output.writableLength,
      send: (frame, serialized) => {
        if (open) output.write(`${serialized ?? JSON.stringify(frame)}\n`);
      },
      close: () => end(),
      isOpen: () => open,
    },
    // the parent spawned us: it is the authentication
    { authenticated: true, edge: 'stdio' },
  );
  input.setEncoding('utf8');
  input.on(
    'data',
    lineReader({
      maxBytes: MAX_FRAME_BYTES,
      onLine: (line) => conversation.receive(line),
      onTooLarge: () => {
        log({ event: 'refused', edge: 'stdio', code: 'frame-too-large' });
        end();
      },
      isOpen: () => open,
    }),
  );
  input.once('end', end);
  input.once('close', end);
  output.on('error', end);
}
