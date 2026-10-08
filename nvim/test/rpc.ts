// A minimal msgpack-RPC client for Neovim's `--listen` socket: requests and their responses, notifications
// ignored. Enough of msgpack for what the API returns (nil, booleans, integers, floats, strings, binary,
// arrays, maps, and the ext types Neovim uses for buffer, window and tabpage handles).
import { createConnection, type Socket } from 'node:net';

class Incomplete extends Error {}

export function encode(value: unknown): Buffer {
  const parts: Buffer[] = [];
  const put = (v: unknown): void => {
    if (v === null || v === undefined) parts.push(Buffer.from([0xc0]));
    else if (v === true) parts.push(Buffer.from([0xc3]));
    else if (v === false) parts.push(Buffer.from([0xc2]));
    else if (typeof v === 'number' && Number.isInteger(v)) {
      if (v >= 0 && v < 128) parts.push(Buffer.from([v]));
      else if (v < 0 && v >= -32) parts.push(Buffer.from([v & 0xff]));
      else if (v >= 0 && v <= 0xffffffff) {
        const b = Buffer.alloc(5);
        b[0] = 0xce;
        b.writeUInt32BE(v, 1);
        parts.push(b);
      } else if (v < 0 && v >= -0x80000000) {
        const b = Buffer.alloc(5);
        b[0] = 0xd2;
        b.writeInt32BE(v, 1);
        parts.push(b);
      } else {
        const b = Buffer.alloc(9);
        b[0] = 0xd3;
        b.writeBigInt64BE(BigInt(v), 1);
        parts.push(b);
      }
    } else if (typeof v === 'number') {
      const b = Buffer.alloc(9);
      b[0] = 0xcb;
      b.writeDoubleBE(v, 1);
      parts.push(b);
    } else if (typeof v === 'string') {
      const s = Buffer.from(v, 'utf8');
      if (s.length < 32) parts.push(Buffer.from([0xa0 | s.length]));
      else if (s.length < 0x100) parts.push(Buffer.from([0xd9, s.length]));
      else if (s.length < 0x10000) {
        const b = Buffer.alloc(3);
        b[0] = 0xda;
        b.writeUInt16BE(s.length, 1);
        parts.push(b);
      } else {
        const b = Buffer.alloc(5);
        b[0] = 0xdb;
        b.writeUInt32BE(s.length, 1);
        parts.push(b);
      }
      parts.push(s);
    } else if (Array.isArray(v)) {
      if (v.length < 16) parts.push(Buffer.from([0x90 | v.length]));
      else {
        const b = Buffer.alloc(5);
        b[0] = 0xdd;
        b.writeUInt32BE(v.length, 1);
        parts.push(b);
      }
      for (const item of v) put(item);
    } else if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length < 16) parts.push(Buffer.from([0x80 | entries.length]));
      else {
        const b = Buffer.alloc(5);
        b[0] = 0xdf;
        b.writeUInt32BE(entries.length, 1);
        parts.push(b);
      }
      for (const [k, item] of entries) {
        put(k);
        put(item);
      }
    } else throw new Error(`cannot encode ${typeof v}`);
  };
  put(value);
  return Buffer.concat(parts);
}

/** Decode one value at `offset`; throws Incomplete when the buffer ends first. */
export function decode(buf: Buffer, offset = 0): { value: unknown; offset: number } {
  let o = offset;
  const need = (n: number) => {
    if (o + n > buf.length) throw new Incomplete();
  };
  const read = (): unknown => {
    need(1);
    const t = buf[o++] as number;
    const str = (n: number) => {
      need(n);
      const s = buf.toString('utf8', o, o + n);
      o += n;
      return s;
    };
    const arr = (n: number) => {
      const out: unknown[] = [];
      for (let i = 0; i < n; i++) out.push(read());
      return out;
    };
    const map = (n: number) => {
      const out: Record<string, unknown> = {};
      for (let i = 0; i < n; i++) {
        const k = read();
        out[String(k)] = read();
      }
      return out;
    };
    const ext = (n: number) => {
      need(1 + n);
      o += 1; // the ext type: buffer, window or tabpage; the handle is what callers pass back
      const inner = decode(buf.subarray(o, o + n));
      o += n;
      return inner.value;
    };
    const u = (n: number) => {
      need(n);
      const v = n === 1 ? buf.readUInt8(o) : n === 2 ? buf.readUInt16BE(o) : n === 4 ? buf.readUInt32BE(o) : Number(buf.readBigUInt64BE(o));
      o += n;
      return v;
    };
    const i = (n: number) => {
      need(n);
      const v = n === 1 ? buf.readInt8(o) : n === 2 ? buf.readInt16BE(o) : n === 4 ? buf.readInt32BE(o) : Number(buf.readBigInt64BE(o));
      o += n;
      return v;
    };
    if (t < 0x80) return t;
    if (t >= 0xe0) return t - 0x100;
    if ((t & 0xf0) === 0x80) return map(t & 0x0f);
    if ((t & 0xf0) === 0x90) return arr(t & 0x0f);
    if ((t & 0xe0) === 0xa0) return str(t & 0x1f);
    switch (t) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xc4:
        return str(u(1));
      case 0xc5:
        return str(u(2));
      case 0xc6:
        return str(u(4));
      case 0xc7:
        return ext(u(1));
      case 0xc8:
        return ext(u(2));
      case 0xc9:
        return ext(u(4));
      case 0xca: {
        need(4);
        const v = buf.readFloatBE(o);
        o += 4;
        return v;
      }
      case 0xcb: {
        need(8);
        const v = buf.readDoubleBE(o);
        o += 8;
        return v;
      }
      case 0xcc:
        return u(1);
      case 0xcd:
        return u(2);
      case 0xce:
        return u(4);
      case 0xcf:
        return u(8);
      case 0xd0:
        return i(1);
      case 0xd1:
        return i(2);
      case 0xd2:
        return i(4);
      case 0xd3:
        return i(8);
      case 0xd4:
        return ext(1);
      case 0xd5:
        return ext(2);
      case 0xd6:
        return ext(4);
      case 0xd7:
        return ext(8);
      case 0xd8:
        return ext(16);
      case 0xd9:
        return str(u(1));
      case 0xda:
        return str(u(2));
      case 0xdb:
        return str(u(4));
      case 0xdc:
        return arr(u(2));
      case 0xdd:
        return arr(u(4));
      case 0xde:
        return map(u(2));
      case 0xdf:
        return map(u(4));
      default:
        throw new Error(`msgpack type 0x${t.toString(16)} is not supported`);
    }
  };
  const value = read();
  return { value, offset: o };
}

export type Rpc = {
  request: <T = unknown>(method: string, ...params: unknown[]) => Promise<T>;
  /** Called for each notification Neovim sends (`[2, method, params]`), such as a UI's redraw batches. */
  onNotification: (fn: (method: string, params: unknown[]) => void) => void;
  closed: Promise<void>;
  close: () => void;
};

export async function connectRpc(path: string, timeoutMs = 10_000): Promise<Rpc> {
  const socket: Socket = createConnection(path);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  let buffer = Buffer.alloc(0);
  const listeners: Array<(method: string, params: unknown[]) => void> = [];
  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      let decoded: { value: unknown; offset: number };
      try {
        decoded = decode(buffer);
      } catch (err) {
        if (err instanceof Incomplete) return;
        throw err;
      }
      buffer = buffer.subarray(decoded.offset);
      const msg = decoded.value as unknown[];
      // [1, id, error, result]; notifications [2, method, params] go to the listeners
      if (msg[0] === 2) {
        for (const fn of listeners) fn(msg[1] as string, msg[2] as unknown[]);
      } else if (msg[0] === 1) {
        const p = pending.get(msg[1] as number);
        if (!p) continue;
        pending.delete(msg[1] as number);
        clearTimeout(p.timer);
        if (msg[2] !== null) p.reject(new Error(`nvim: ${JSON.stringify(msg[2])}`));
        else p.resolve(msg[3]);
      }
    }
  });
  socket.on('error', () => {});
  let markClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => (markClosed = resolve));
  socket.on('close', () => {
    markClosed();
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('nvim closed the RPC socket'));
    }
    pending.clear();
  });
  return {
    request: <T = unknown>(method: string, ...params: unknown[]) =>
      new Promise<T>((resolve, reject) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`nvim did not answer ${method} within ${timeoutMs} ms (input pending?)`));
        }, timeoutMs);
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
        socket.write(encode([0, id, method, params]));
      }),
    onNotification: (fn) => listeners.push(fn),
    closed,
    close: () => socket.destroy(),
  };
}
