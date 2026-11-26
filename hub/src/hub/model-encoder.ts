import type { HubFrame } from '../protocol.ts';

/** Layer projections are immutable and shared by a publication chunk. Encode
 * them once while preserving the exact property order of legacy task frames. */
export class ModelEncoder {
  readonly #layers = new WeakMap<object, string>();

  encode(frame: HubFrame): string {
    if (frame.type !== 'task' || !frame.layers) return JSON.stringify(frame);
    let layers = this.#layers.get(frame.layers);
    if (layers === undefined) {
      layers = JSON.stringify(frame.layers);
      this.#layers.set(frame.layers, layers);
    }
    const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
    let found = false;
    for (const [key, value] of Object.entries(frame)) {
      if (key === 'layers') { found = true; continue; }
      (found ? after : before)[key] = value;
    }
    const prefix = JSON.stringify(before).slice(0, -1);
    const suffix = JSON.stringify(after).slice(1);
    return `${prefix}${prefix.length > 1 ? ',' : ''}"layers":${layers}${suffix.length > 1 ? ',' : ''}${suffix}`;
  }
}
