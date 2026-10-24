// Committed protocol recordings. Unknown inputs fail closed; only the T3 refresh
// process installs the recorder. Ordinary client tests read JSON, never hub code.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';
import { STUB_NOW } from './fixtures/clock.ts';
export type Recording = { operation: string; input: unknown; output: unknown };
export const FRAME_FIXTURES = new URL('./fixtures/protocol-frames.json', import.meta.url);
export const FRAME_SLICES = new URL('./fixtures/protocol-frames/', import.meta.url);
export const frameSlicePath = (file: string): URL => new URL(`${basename(file).replace(/\.test\.ts$/, '')}.json`, FRAME_SLICES);
/** The parent test selects its slice before spawning the stdio stub. Other callers use the catalog. */
export function frameFixturesForTest(file: string | undefined): string {
  const slice = file?.endsWith('.test.ts') ? frameSlicePath(file) : undefined;
  return fileURLToPath(slice && existsSync(slice) ? slice : FRAME_FIXTURES);
}
export function selectRecordings(recordings: Record<string, Recording>, keys: Iterable<string>): Record<string, Recording> {
  return Object.fromEntries([...new Set(keys)].map(key => {
    const record = recordings[key];
    if (!record) throw new Error(`missing recording ${key}; run npm run test:nvim-fixtures`);
    return [key, record];
  }));
}
export function canonical(value: unknown, root: string, at = STUB_NOW) {
  // Neovim may resolve /tmp or /var through /private while the test keeps the
  // other spelling. Bind both without requiring the recorded paths to exist.
  const aliases = (path: string): string[] => /^\/(?:private\/)?(?:tmp|var)(?:\/|$)/.test(path)
    ? [path, path.startsWith('/private/') ? path.slice('/private'.length) : `/private${path}`].sort((a, b) => b.length - a.length) : [path];
  const substitutions: Array<[string, string]> = aliases(root).map(path => ['@root@', path]);
  substitutions.push(['@repo@', fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')], ['@node@', process.execPath]);
  if (basename(dirname(root)).startsWith('cland-')) {
    for (const path of aliases(dirname(root))) substitutions.push(['@parent@', path]);
  }
  const bindings = new Map<string, string>();
  const values = new Map<string, string>();
  let nextBinding = 0;
  function bind(value: string, kind: string, reuse = true): string {
    let token = reuse ? bindings.get(value) : undefined;
    if (!token) { token = `@${kind}:${nextBinding++}@`; if (reuse) bindings.set(value, token); values.set(token, value); }
    return token;
  }
  const encode = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v)) return bind(v, 'uuid');
      if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(v)) {
        const age = new Date(at).getTime() - Date.parse(v);
        // Every occurrence has a stable slot even if two calls share a clock tick.
        return bind(v, age > 7 * 86400000 ? 'old' : 'recent', false);
      }
      let text = v;
      for (const [token, value] of substitutions) {
        if (text.includes(value)) { if (!values.has(token)) values.set(token, value); text = text.replaceAll(value, token); }
      }
      return text;
    }
    if (Array.isArray(v)) return v.map(x => encode(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).filter(([,x]) => x !== undefined).map(([k, x]) => [k, encode(x)]));
    return v;
  };
  const input = encode(value);
  return { input, restore: (output: unknown): unknown => {
    const restore = (v: unknown): unknown => typeof v === 'string' ? (values.get(v) ?? [...new Map([...substitutions, ...values])].reduce((text, [token, value]) => text.replaceAll(token, value), v))
      : Array.isArray(v) ? v.map(restore) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k,restore(x)])) : v;
    return restore(output);
  } };
}
export const recordingKey = (operation: string, input: unknown): string => createHash('sha256').update(JSON.stringify([operation, input])).digest('hex');
type ReadRecording = (key: string, operation: string, input: unknown) => unknown;
let outputFor: ReadRecording | undefined;
export function replayFrame<T>(operation: string, input: unknown): T {
  const at = input && typeof input === 'object' && 'at' in input && typeof input.at === 'string' ? input.at : STUB_NOW;
  const normalized = canonical(input, process.cwd(), at);
  const recorder = Reflect.get(globalThis, Symbol.for('cland.nvim.frameRecorder')) as ((operation: string, input: unknown) => unknown) | undefined;
  if (recorder) return normalized.restore(recorder(operation, normalized.input)) as T;
  if (!outputFor) {
    const main = fileURLToPath(FRAME_FIXTURES);
    const preferred = process.env.CLAND_STUB_FRAME_FIXTURES ?? main;
    const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Packed;
    outputFor = recordingReader(read(preferred), preferred === main ? undefined : () => read(main));
  }
  return normalized.restore(outputFor(recordingKey(operation, normalized.input), operation, normalized.input)) as T;
}

// Intern repeated scenario trees so the JSON catalog stays reviewable in size.
// Every aggregate is explicit data; references cannot execute or import code.
type Atom = string | number | boolean | null | { ref: string };
type Node = { array: Atom[] } | { object: Array<[string, Atom]> } | { text: string };
type Packed = { version: 1; nodes: Record<string, Node>; records: Record<string, { operation: string; input: Atom; output: Atom }> };
/** Scheduling may expose another already-recorded frame. Only a slice miss reads
 * the main committed catalog, once; neither reader can call a hub producer. */
export function recordingReader(data: Packed, fallback?: () => Packed): ReadRecording {
  const decode = fixtureDecoder(data);
  let other: ReadRecording | undefined;
  return (key, operation, input) => {
    const recording = data.records[key];
    if (!recording && fallback) return (other ??= recordingReader(fallback()))(key, operation, input);
    if (!recording) {
      const value = (input && typeof input === 'object' ? input : {}) as { requestType?: unknown; frame?: { type?: unknown } };
      const request = (value.frame?.type === 'result' ? value.requestType : value.frame?.type) ?? operation;
      throw new Error(`unrecorded protocol frame: operation=${operation} request=${String(request)} key=${key}; run npm run test:nvim-fixtures`);
    }
    return decode(recording.output);
  };
}
export function packRecordings(recordings: Record<string, Recording>): Packed {
  const nodes: Record<string, Node> = {};
  const encode = (value: unknown): Atom => {
    if (value === null || typeof value !== 'object' && !(typeof value === 'string' && value.length > 256)) return value as Atom;
    const node: Node = typeof value === 'string' ? { text: value } : Array.isArray(value) ? { array: value.map(encode) } : { object: Object.entries(value).map(([key, value]) => [key, encode(value)]) };
    const ref = createHash('sha256').update(JSON.stringify(node)).digest('hex');
    nodes[ref] = node;
    return { ref };
  };
  const records = Object.fromEntries(Object.entries(recordings).sort(([a], [b]) => a.localeCompare(b)).map(([key, r]) => [key, { operation: r.operation, input: encode(r.input), output: encode(r.output) }]));
  return { version: 1, nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => a.localeCompare(b))), records };
}
function fixtureDecoder(data: Packed): (value: Atom) => unknown {
  const decoded = new Map<string, unknown>();
  const decode = (value: Atom): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (decoded.has(value.ref)) return decoded.get(value.ref);
    const node = data.nodes[value.ref];
    if (!node) throw new Error(`missing recorded fixture node ${value.ref}`);
    const result = 'text' in node ? node.text : 'array' in node ? node.array.map(decode) : Object.fromEntries(node.object.map(([key, value]) => [key, decode(value)]));
    decoded.set(value.ref, result);
    return result;
  };
  return decode;
}
export function unpackRecordings(data: Packed): Record<string, Recording> {
  const decode = fixtureDecoder(data);
  return Object.fromEntries(Object.entries(data.records).map(([key, r]) => [key, { operation: r.operation, input: decode(r.input), output: decode(r.output) }]));
}
export function parseRecordings(text: string): Record<string, Recording> {
  const value = JSON.parse(text);
  return value.version === 1 ? unpackRecordings(value) : value;
}

export function serializeRecordings(recordings: Record<string, Recording>): string {
  const data = packRecordings(recordings);
  const section = (entries: object) => Object.entries(entries).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');
  return `{\n  "version": 1,\n  "nodes": {\n${section(data.nodes)}\n  },\n  "records": {\n${section(data.records)}\n  }\n}\n`;
}
