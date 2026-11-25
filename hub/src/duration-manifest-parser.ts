import YAML, { isMap, isScalar } from 'yaml';
import type { DurationManifest } from './suite-durations.ts';

export const DURATION_MANIFEST = 'hub/test/durations.json';

/** Internal parser seam. Production constructs one reader with fixed defaults. */
export function createDurationManifestParser(limits = { entries: 32, characters: 4 * 1024 * 1024, facts: 65536 }) {
  type Fact = [section: number, keyStart: number, keyEnd: number, firstStart: number, firstEnd: number, lastStart: number, lastEnd: number];
  const sections = ['files', 'tests', 'allow'];
  const cache = new Map<string, Fact[]>();
  let characters = 0, factCount = 0;
  const emit = (source: string, fact: Fact) => {
    const [section, keyStart, keyEnd, firstStart, firstEnd, lastStart, lastEnd] = fact;
    const key = JSON.stringify(JSON.parse(source.slice(keyStart, keyEnd)));
    const value = (start: number, end: number) => JSON.stringify(JSON.parse(source.slice(start, end)));
    console.warn(`duration duplicate (report only): ${sections[section]}[${key}] first=${value(firstStart, firstEnd)} duplicate=${value(lastStart, lastEnd)}`);
  };
  return {
    retained: () => ({ entries: cache.size, characters, facts: factCount,
      payloadCharacters: ([...cache.values()].flat(2) as unknown[]).reduce<number>((n, value) => n + (typeof value === 'string' ? value.length : 0), 0) }),
    parse(source: string): DurationManifest {
      const manifest = JSON.parse(source) as DurationManifest;
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error(`invalid duration manifest: ${DURATION_MANIFEST}`);
      const cached = cache.get(source);
      if (cached) {
        cache.delete(source); cache.set(source, cached);
        for (const fact of cached) emit(source, fact);
        return manifest;
      }
      const facts: Fact[] = [];
      let cacheable = source.length <= limits.characters;
      const document = YAML.parseDocument(source, { uniqueKeys: false });
      if (isMap(document.contents)) for (const section of document.contents.items) {
        if (!isScalar(section.key) || !['files', 'tests', 'allow'].includes(String(section.key.value)) || !isMap(section.value)) continue;
        const seen = new Map<string, readonly [number, number]>();
        for (const pair of section.value.items) {
          if (!isScalar(pair.key) || !pair.key.range || !pair.value?.range) continue;
          const key = String(pair.key.value);
          const range = [pair.value.range[0], pair.value.range[1]] as const;
          const first = seen.get(key);
          if (first) {
            const fact: Fact = [sections.indexOf(String(section.key.value)), pair.key.range[0], pair.key.range[1], ...first, ...range];
            emit(source, fact); // Never collect rendered notices, even on a cache miss.
            if (cacheable && facts.length < limits.facts) facts.push(fact);
            else { cacheable = false; facts.length = 0; }
          } else seen.set(key, range);
        }
      }
      if (cacheable) {
        cache.set(source, facts); characters += source.length; factCount += facts.length;
        while (cache.size > limits.entries || characters > limits.characters || factCount > limits.facts) {
          const oldest = cache.keys().next().value!;
          characters -= oldest.length; factCount -= cache.get(oldest)!.length; cache.delete(oldest);
        }
      }
      return manifest;
    },
  };
}
