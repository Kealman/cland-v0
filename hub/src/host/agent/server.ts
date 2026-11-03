import { createConnection, createServer } from 'node:net';
import type { Socket } from 'node:net';
import { mkdir, chmod, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { totalmem, freemem } from 'node:os';
import type { ProcessHooks } from './processes.ts';
import { AgentProcesses } from './processes.ts';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { agentOperations } from './operations.ts';
import { AGENT_PROTOCOL, MAX_LINE_BYTES, LineDecoder, parseRequest } from './protocol.ts';
export type AgentOptions = { runDir: string; secret: string; version: string; env?: NodeJS.ProcessEnv; memoryIntervalMs?: number; processHooks?: ProcessHooks; socketChmod?: (path: string) => Promise<void> };
export async function serveAgent(options: AgentOptions) {
  if (!options.secret) throw new Error('host secret required');
  await mkdir(options.runDir, { recursive: true, mode: 0o700 });
  await chmod(options.runDir, 0o700);
  const socket = join(options.runDir, 'agent.sock');
  // A killed agent leaves its Unix path behind. Refuse an active listener.
  await new Promise<void>((resolve, reject) => {
    const probe = createConnection(socket);
    probe.once('connect', () => { probe.destroy(); reject(new Error('agent already running')); });
    probe.once('error', error => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') resolve();
      else if (code === 'ECONNREFUSED') void unlink(socket).then(resolve, reject);
      else reject(error);
    });
  });
  const connections = new Set<Socket>();
  const authenticatedConnections = new Set<Socket>();
  const broadcast = (frame: unknown) => { for (const peer of authenticatedConnections) if (!peer.destroyed) peer.write(JSON.stringify(frame) + "\n"); };
  const processes = new AgentProcesses(options.runDir, options.env ?? process.env, broadcast, options.processHooks);
  const operations = agentOperations(options.env ?? process.env);
  await processes.load(); const bootId = await processes.bootId();
  let memoryWork = Promise.resolve();
  let memoryTimer: NodeJS.Timeout | undefined;
  let recoveryTimer: NodeJS.Timeout | undefined;
  let admitting = false;
  const pending = new Set<Promise<void>>();
  const server = createServer(connection => {
    if (!admitting) { connection.destroy(); return; }
    connections.add(connection);
    connection.on('close', () => { connections.delete(connection); authenticatedConnections.delete(connection); });
    connection.on('error', () => {});
    let authenticated = false, chain = Promise.resolve();
    const decoder = new LineDecoder();
    connection.on('data', (chunk: Buffer) => {
      let lines: string[];
      try { lines = decoder.push(chunk); } catch { connection.destroy(); return; }
      for (const line of lines) {
        chain = chain.then(async () => {
          if (connection.destroyed || connection.writableEnded) return;
          let id: string | null = null;
          try {
            const request = parseRequest(line); id = request.id;
            if (request.op === 'hello') {
              const secret = request.args.secret;
              const valid = typeof secret === 'string' && Buffer.byteLength(secret) === Buffer.byteLength(options.secret) && timingSafeEqual(Buffer.from(secret), Buffer.from(options.secret));
              if (!valid || request.args.protocol !== AGENT_PROTOCOL) throw new Error('hello secret or protocol refused');
              authenticated = true; authenticatedConnections.add(connection);
              connection.write(JSON.stringify({ id, ok: true, result: { protocol: AGENT_PROTOCOL, version: options.version, pid: process.pid, bootId } }) + '\n');
            } else {
              if (!authenticated) throw new Error('hello required');
              let result: unknown;
              switch (request.op) {
                case 'spawn': result = await processes.spawn(request.args); break;
                case 'identity': result = await processes.identity(Number(request.args.pid)); break;
                case 'alive': result = await processes.alive(request.args); break;
                case 'signal': result = await processes.signal(request.args); break;
                case 'stop': result = await processes.stop(request.args); break;
                case 'processes': result = await processes.processes(); break;
                default: {
                  const operation = Object.hasOwn(operations, request.op) ? operations[request.op] : undefined;
                  if (!operation) throw new Error('unknown operation');
                  result = await operation(request.args);
                }
              }
              const reply = JSON.stringify({ id, ok: true, result });
              if (Buffer.byteLength(reply) > MAX_LINE_BYTES) throw new Error('agent result exceeds frame cap');
              connection.write(reply + '\n');
            }
          } catch (error) {
            const frame = JSON.stringify({ id, ok: false, error: error instanceof Error ? error.message : 'operation failed' }) + '\n';
            if (!authenticated || /hello secret/.test(error instanceof Error ? error.message : '')) connection.end(frame); else connection.write(frame);
          }
        });
        const work = chain; pending.add(work); void work.finally(() => pending.delete(work));
      }
    });
  });
  const close = async () => {
    admitting = false; clearInterval(memoryTimer); clearTimeout(recoveryTimer);
    for (const connection of connections) connection.destroy();
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await memoryWork; await Promise.all(pending); await processes.drain();
  };
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
    await (options.socketChmod ? options.socketChmod(socket) : chmod(socket, 0o600));
    memoryTimer = setInterval(() => { memoryWork = memoryWork.then(async () => {
      await processes.reconcile();
      let availableBytes = freemem();
      if (process.platform === "linux") { const info = await readFile("/proc/meminfo", "utf8"); const kb = /^MemAvailable:\s+(\d+) kB/m.exec(info)?.[1]; if (!kb) return; availableBytes = Number(kb) * 1024; }
      broadcast({ event: "memory", totalBytes: totalmem(), availableBytes });
    }).catch(() => {}); }, options.memoryIntervalMs ?? 5000);
    admitting = true;
    recoveryTimer = setTimeout(() => { memoryWork = memoryWork.then(() => processes.reconcile()).catch(() => {}); }, 0);
    return { socket, close };
  } catch (error) { await close(); throw error; }
}
