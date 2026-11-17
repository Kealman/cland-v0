import { StringDecoder } from 'node:string_decoder';

/** Bounded lexical projection of a JSON-RPC envelope. Bodies and nested ids are
 * discarded; only a top-level id token (at most 8192 characters) is retained.
 * This never admits a frame: it only correlates an already-refused frame. */
export class EnvelopeId {
  id: string | number | null = null;
  invalid = false;
  #decoder = new StringDecoder('utf8');
  #depth = 0;
  #started = false;
  #string = false;
  #escape = false;
  #token = '';
  #overflow = false;
  #primitive = false;
  #phase: 'key' | 'colon' | 'value' | 'after' = 'key';
  #key = '';

  #append(c: string) {
    if (this.#token.length < 8192) this.#token += c;
    else this.#overflow = true;
  }
  #value() {
    if (this.#key === 'id' && !this.#overflow) {
      try {
        const value: unknown = JSON.parse(this.#token);
        if (typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)) this.id = value;
      } catch { this.invalid = true; }
    }
    this.#phase = 'after';
    this.#token = '';
    this.#overflow = false;
  }
  feed(bytes: Buffer) {
    for (const c of this.#decoder.write(bytes)) {
      if (this.invalid) return;
      if (this.#string) {
        if (this.#depth === 1) this.#append(c);
        if (this.#escape) { this.#escape = false; continue; }
        if (c === '\\') { this.#escape = true; continue; }
        if (c !== '"') continue;
        this.#string = false;
        if (this.#depth !== 1) continue;
        if (this.#phase === 'key') {
          try { this.#key = this.#overflow ? '' : JSON.parse(this.#token) as string; }
          catch { this.invalid = true; }
          this.#token = ''; this.#overflow = false; this.#phase = 'colon';
        } else if (this.#phase === 'value') this.#value();
        continue;
      }
      if (this.#primitive) {
        if (!/[\s,}]/.test(c)) { this.#append(c); continue; }
        this.#primitive = false;
        this.#value();
      }
      if (/\s/.test(c)) continue;
      if (!this.#started) {
        this.#started = true;
        if (c !== '{') { this.invalid = true; return; }
      }
      if (c === '"') {
        this.#string = true;
        if (this.#depth === 1) { this.#token = '"'; this.#overflow = false; }
      } else if (c === '{' || c === '[') this.#depth++;
      else if (c === '}' || c === ']') {
        this.#depth--;
        if (this.#depth === 1) this.#phase = 'after';
      } else if (this.#depth === 1) {
        if (c === ':') this.#phase = 'value';
        else if (c === ',') { this.#phase = 'key'; this.#key = ''; }
        else if (this.#phase === 'value') { this.#primitive = true; this.#token = c; this.#overflow = false; }
      }
    }
  }
}
