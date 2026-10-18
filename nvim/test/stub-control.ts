// The stub's newline-delimited control exchange; no hub runtime imports.
import { createConnection } from 'node:net';

export function controlRequestName(command: Record<string, unknown>): string {
  const operations = Object.keys(command).sort().join('+');
  const frame = command.emit as { type?: unknown } | undefined;
  return `${operations}${typeof frame?.type === 'string' ? ` ${frame.type}` : ''}`;
}

export function stubControl(path: string, command: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path);
    socket.setEncoding('utf8');
    let buffer = '';
    let settled = false;
    const finish = (error?: unknown, reply?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(new Error(`stub control ${controlRequestName(command)}: ${error instanceof Error ? error.message : String(error)}`));
      else resolve(reply!);
    };
    socket.on('error', error => finish(error));
    socket.on('end', () => finish(new Error('peer closed before a complete reply')));
    socket.on('close', () => finish(new Error('peer closed before a complete reply')));
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.includes('\n')) {
        try {
          const reply = JSON.parse(buffer.slice(0, buffer.indexOf('\n'))) as Record<string, unknown>;
          if (reply.ok !== true) finish(reply.error ?? 'control request refused');
          else finish(undefined, reply);
        } catch (error) { finish(error); }
      }
    });
    socket.write(JSON.stringify(command) + '\n');
  });
}
