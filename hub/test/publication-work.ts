/** Counts actual JSON results in one explicitly armed publication interval.
 * A replacer observes small, full and nested layer maps on the native traversal. */
export function publicationWork(nativeStringify: typeof JSON.stringify) {
  let active = false;
  let encodedBytes = 0, mapEntriesSerialized = 0;
  const layers = new Set(['now', 'watch', 'background', 'archive', null]);
  return {
    start() { active = true; },
    stop() { active = false; return { encodedBytes, mapEntriesSerialized }; },
    stringify: (function(value: unknown, replacer?: unknown, space?: string | number) {
      if (!active) return Reflect.apply(nativeStringify, JSON, [value, replacer, space]);
      if (Array.isArray(replacer)) throw new Error('publication accounting does not support an array replacer');
      const json = nativeStringify(value, function(key, input: unknown) {
        const output = typeof replacer === 'function' ? replacer.call(this, key, input) : input;
        if (output && typeof output === 'object' && !Array.isArray(output)) {
          const entries = Object.entries(output);
          if (entries.length && entries.every(([id, layer]) => /^[A-Z]+-\d+$/.test(id) && layers.has(layer as string | null))) mapEntriesSerialized += entries.length;
        }
        return output;
      }, space);
      if (json !== undefined) encodedBytes += Buffer.byteLength(json);
      return json;
    }) as typeof JSON.stringify,
  };
}
