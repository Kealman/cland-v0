import { remoteRedactor } from './host/agent/redact.ts';

export const COMMAND_CAPTURE_BYTES = 1024 * 1024;
export const COMMAND_TAIL_BYTES = 16 * 1024;

/** Captures are protected before a suffix is released. */
export class ProtectedCommandCapture {
  #chunks: Buffer[] = [];
  #bytes = 0;
  #withheld = false;
  #result: string | undefined;
  write(chunk: string): void {
    if (this.#withheld || this.#result !== undefined) return;
    const bytes = Buffer.byteLength(chunk);
    if (!bytes) return;
    if (bytes > COMMAND_CAPTURE_BYTES - this.#bytes) {
      this.#withheld = true;
      this.#chunks = [];
      this.#bytes = 0;
      return;
    }
    this.#chunks.push(Buffer.from(chunk));
    this.#bytes += bytes;
  }
  get retainedBytes(): number { return this.#bytes; }
  finish(cause = '', tailBytes = COMMAND_TAIL_BYTES): string {
    if (this.#result !== undefined) return this.#result;
    if (this.#withheld || Buffer.byteLength(cause) > COMMAND_CAPTURE_BYTES - this.#bytes) {
      this.#chunks = [];
      this.#bytes = 0;
      return this.#result = '[check output withheld: protected capture exceeded 1 MiB]';
    }
    const text = Buffer.concat(this.#chunks, this.#bytes).toString('utf8');
    this.#chunks = [];
    this.#bytes = 0;
    // Complete contexts, including chunk/newline splits, reach the shared policy
    // before any tail bytes are discarded. Oversized contexts release no suffix.
    const protectedText = remoteRedactor().text(cause && text ? cause + '\n' + text : cause || text);
    const bytes = Buffer.from(protectedText);
    let start = Math.max(0, bytes.length - tailBytes);
    // Start at a complete UTF-8 character; replacement bytes must not grow the
    // published tail beyond its byte bound.
    while (start < bytes.length && (bytes[start]! & 0xc0) === 0x80) start++;
    return this.#result = bytes.toString('utf8', start);
  }
}

/** The same bounded protection policy for thrown diagnostic messages. */
export function protectedCommandText(text: string, tailBytes = COMMAND_TAIL_BYTES): string {
  const capture = new ProtectedCommandCapture();
  capture.write(text);
  return capture.finish('', tailBytes);
}
