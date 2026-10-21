import type { HubFrame } from '../protocol.ts';
import { MODEL_BYTES } from './model-ring.ts';

type Sink = {
  send: (frame: HubFrame, serialized?: string) => void;
  bufferedBytes?: () => number;
  isOpen: () => boolean;
};

/** Backpressure ends the model stream, keeping request replies and future streams usable. */
export class ModelOutput {
  readonly #sink: Sink;
  #paused = false;
  constructor(sink: Sink) { this.#sink = sink; }
  resume(): void { this.#paused = false; }
  pause(reason: 'queue-limit' | 'snapshot-required'): void {
    if (this.#paused || !this.#sink.isOpen()) return;
    this.#paused = true;
    this.#sink.send({ type: 'resync', reason });
  }
  send(frame: HubFrame, serialized = () => JSON.stringify(frame)): boolean {
    if (this.#paused || !this.#sink.isOpen()) return false;
    return this.#write(serialized(), frame);
  }
  replay(json: string): boolean { return this.#write(json); }
  #write(json: string, frame?: HubFrame): boolean {
    if (this.#paused || !this.#sink.isOpen()) return false;
    if ((this.#sink.bufferedBytes?.() ?? 0) + Buffer.byteLength(json) > MODEL_BYTES) {
      this.pause('queue-limit');
      return false;
    }
    this.#sink.send(frame ?? JSON.parse(json) as HubFrame, json);
    // The transport may add framing bytes not present in the shared JSON.
    if ((this.#sink.bufferedBytes?.() ?? 0) > MODEL_BYTES) { this.pause('queue-limit'); return false; }
    return true;
  }
}
