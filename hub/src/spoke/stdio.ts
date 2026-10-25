import type { Readable, Writable } from 'node:stream';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { deserializeMessage, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import { MAX_FRAME_BYTES } from '../protocol.ts';

/** Byte framing precedes the SDK's JSON/schema decoding. Refuse once, then
 * discard through that line's newline so subsequent MCP requests remain usable. */
export class SpokeStdioTransport implements Transport {
  onclose?: NonNullable<Transport['onclose']>;
  onerror?: NonNullable<Transport['onerror']>;
  onmessage?: NonNullable<Transport['onmessage']>;
  #started = false;
  #closed = false;
  #parts: Buffer[] = [];
  #bytes = 0;
  #discarding = false;

  readonly input: Readable;
  #output: Writable;
  constructor(input: Readable = process.stdin, output: Writable = process.stdout) {
    this.input = input;
    this.#output = output;
  }

  #error = (error: Error) => { this.onerror?.(error); };
  #data = (chunk: Buffer | string) => {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    let offset = 0;
    while (offset < bytes.length && !this.#closed) {
      const newline = bytes.indexOf(10, offset);
      const end = newline < 0 ? bytes.length : newline;
      if (!this.#discarding) {
        const length = end - offset;
        if (this.#bytes + length > MAX_FRAME_BYTES) {
          this.#parts = [];
          this.#bytes = 0;
          this.#discarding = true;
          // The id is unknown: do not parse untrusted oversized JSON to recover it.
          void this.#write(JSON.stringify({ jsonrpc: '2.0', id: null, error: {
            code: -32700, message: `MCP stdio message exceeds the ${MAX_FRAME_BYTES} byte (1 MiB) cap`,
          } }) + '\n').catch(this.#error);
        } else {
          if (length) this.#parts.push(Buffer.from(bytes.subarray(offset, end)));
          this.#bytes += length;
          if (newline >= 0) {
            const line = Buffer.concat(this.#parts, this.#bytes).toString('utf8').replace(/\r$/, '');
            this.#parts = [];
            this.#bytes = 0;
            try { this.onmessage?.(deserializeMessage(line)); }
            catch (error) { this.#error(error instanceof Error ? error : new Error(String(error))); }
          }
        }
      }
      if (newline < 0) break;
      this.#discarding = false;
      offset = newline + 1;
    }
  };

  async start(): Promise<void> {
    if (this.#started || this.#closed) throw new Error('SpokeStdioTransport already started or closed');
    this.#started = true;
    this.input.on('data', this.#data);
    this.input.on('error', this.#error);
    this.#output.on('error', this.#error);
  }

  #write(line: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#output.write(line, error => error ? reject(error) : resolve());
    });
  }

  send(message: JSONRPCMessage): Promise<void> { return this.#write(serializeMessage(message)); }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.input.off('data', this.#data);
    this.input.off('error', this.#error);
    this.#output.off('error', this.#error);
    if (this.input.listenerCount('data') === 0) this.input.pause();
    this.#parts = [];
    this.#bytes = 0;
    this.onclose?.();
  }
}
