import { memoryFloorDetails } from './agent/memory.ts';
import { REF_WATCH_CAPABILITY, REF_WATCH_STATUS_CAPABILITY } from './agent/watch.ts';
import { createConnection } from 'node:net';
import type { Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { AGENT_PROTOCOL, LineDecoder } from './agent/protocol.ts';
import { CLAUDE_RESTORE_CAPABILITY, parseClaudeRestoreOutcome, type ClaudeRestoreOutcome } from './agent/claude.ts';
import type { AgentHello } from './agent/protocol.ts';
import { signInRefusalFields } from './agent/signin-types.ts';
/** Owns one authenticated stream; callers reconnect explicitly after native close. */
export class AgentClient extends EventEmitter {
  hello!: AgentHello;
  #socket: Socket;
  #next = 0;
  #pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  constructor(socket: Socket) {
    super(); this.#socket = socket;
    const decoder = new LineDecoder();
    socket.on('data', (chunk: Buffer) => {
      let lines: string[];
      try { lines = decoder.push(chunk); } catch { socket.destroy(new Error('agent frame too large')); return; }
      for (const line of lines) {
        try {
          const frame = JSON.parse(line);
          if (frame.event) { this.emit('event', frame); continue; }
          const pending = this.#pending.get(frame.id);
          if (pending) { this.#pending.delete(frame.id); clearTimeout(pending.timer); if (frame.ok) pending.resolve(frame.result); else pending.reject(Object.assign(new Error(frame.error), typeof frame.code === 'string' ? {code:frame.code,...memoryFloorDetails(frame),...signInRefusalFields(frame)} : {})); }
        } catch { socket.destroy(new Error('malformed agent reply')); }
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => { for (const pending of this.#pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('agent closed')); } this.#pending.clear(); this.emit('closed'); });
  }
  static async connect(path: string, secret: string): Promise<AgentClient> {
    const socket = createConnection(path); const client = new AgentClient(socket);
    try {
      const hello = await client.request('hello', { protocol: AGENT_PROTOCOL, secret }) as AgentHello;
      if (!hello || hello.protocol !== AGENT_PROTOCOL || typeof hello.version !== 'string' || !Number.isSafeInteger(hello.pid) || typeof hello.bootId !== 'string') throw new Error('incompatible agent hello');
      client.hello = hello; return client;
    }
    catch (error) { await client.close(); throw error; }
  }
  request(op: string, args: Record<string, unknown>, timeoutMs = 10000): Promise<unknown> {
    if (this.#socket.destroyed) return Promise.reject(new Error('agent closed'));
    const id = String(++this.#next);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error('agent request timed out; outcome unknown')); }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.write(JSON.stringify({ id, op, args }) + '\n');
    });
  }
  async close(): Promise<void> { if (this.#socket.closed) return; const closed = new Promise<void>(resolve => this.#socket.once('close', resolve)); this.#socket.destroy(); await closed; }
}

/** Additive recovery handshake: older agents retain their prior table contract. */
export async function restoreAdoptedWorkers(client:Pick<AgentClient,'hello'|'request'>,report?:(outcome:ClaudeRestoreOutcome|null)=>void):Promise<void>{
  if(!client.hello.capabilities?.includes(CLAUDE_RESTORE_CAPABILITY))return;
  const outcome=parseClaudeRestoreOutcome(await client.request('restore-claude',{report:true}));
  report?.(outcome);
}

/** Additive watch lifecycle: an older agent receives no new requests. */
export async function updateRefWatch(client:Pick<AgentClient,'hello'|'request'>,op:'watch'|'unwatch',args:Record<string,unknown>):Promise<void>{
  if(client.hello.capabilities?.includes(REF_WATCH_CAPABILITY))await client.request(op,args);
}

/** Status is separately additive to watch-v1; absence remains unavailable, not an invented empty result. */
export async function readRefWatchStatus(client:Pick<AgentClient,'hello'|'request'>,report?:(rows:Array<{path:string;branch:string;state:string;cause?:string}>)=>void):Promise<void>{
  if(!client.hello.capabilities?.includes(REF_WATCH_STATUS_CAPABILITY))return;
  report?.(await client.request('watch-status',{}) as Array<{path:string;branch:string;state:string;cause?:string}>);
}
