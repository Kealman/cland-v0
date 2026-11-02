// Built-ins only: git invokes this as <proxy> <socket> <host> <port>.
import { connect } from 'node:net';
import { pathToFileURL } from 'node:url';
import type { Readable, Writable } from 'node:stream';

/** Preserve the request EOF while draining the daemon's response to completion. */
export function gitProxy(path: string, input: Readable, output: Writable): Promise<void> {
  return new Promise((done, fail) => {
    const socket = connect({ path, allowHalfOpen: true });
    let failure: Error | undefined;
    const error = (cause: Error) => { failure ??= cause; socket.destroy(); };
    input.on('error', error); output.on('error', error); socket.on('error', error);
    socket.on('close', () => {
      input.unpipe(socket); socket.unpipe(output);
      input.off('error', error); output.off('error', error);
      input.pause();
      if (failure) fail(failure); else done();
    });
    input.pipe(socket); socket.pipe(output, { end: false });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) { process.stderr.write('cland git-proxy: socket required\n'); process.exitCode = 1; }
  else await gitProxy(path, process.stdin, process.stdout).catch(() => {
    process.stderr.write('cland git-proxy: connection failed\n'); process.exitCode = 1;
  });
}
