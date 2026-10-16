// Writable settings come from the managed template, including optional parser vocabulary.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse, stringify } from 'smol-toml';
import { DEFAULT_VISIBILITY } from '../hub/visibility.ts';
import { defaultConfig, parseConfig, renderConfig } from './config.ts';
import { isManagedFile, symlinkNote, symlinkOnPath, writeAtomic } from './files.ts';

type Table = Record<string, unknown>;

export function configKeys(): string[] {
  const example = defaultConfig('');
  example.verification.droplet.workers = example.verification.workers;
  example.visibility = DEFAULT_VISIBILITY;
  let section = '';
  const keys: string[] = [];
  for (const line of renderConfig(example).split('\n')) {
    const heading = /^\[([^\]]+)\]$/.exec(line);
    if (heading) section = heading[1]!;
    const assignment = /^([\w.]+)\s*=/.exec(line);
    if (assignment) keys.push(`${section}.${assignment[1]}`);
  }
  return keys;
}

function tableAt(doc: Table, parts: string[]): Table {
  let table = doc;
  for (const part of parts) {
    if (!Object.hasOwn(table, part)) table[part] = {};
    const next = table[part];
    if (!next || typeof next !== 'object' || Array.isArray(next) || next instanceof Date) throw new Error(`${parts.join('.')} must be a table`);
    table = next as Table;
  }
  return table;
}

/** Validate and atomically replace only a managed config; return the value the hub reads back. */
export function setConfigValue(root: string, path: string, key: string, value: unknown, env: NodeJS.ProcessEnv): unknown {
  const known = configKeys();
  if (!known.includes(key)) {
    const section = key.split('.').slice(0, -1).join('.');
    const keys = known.filter(k => k.startsWith(`${section}.`));
    throw new Error(`unknown config key ${key}; known keys${section && keys.length ? ` in ${section}` : ''}: ${(keys.length ? keys : known).join(', ')}`);
  }
  const link = symlinkOnPath(root, path);
  if (link !== null) throw new Error(symlinkNote(link));
  const original = readFileSync(path, 'utf8');
  if (!isManagedFile(original)) throw new Error('config.toml has no managed by cland mark: it is the project\'s own; left unchanged');
  const name = basename(root);
  const doc = parse(original) as Table;
  const parts = key.split('.');
  const field = parts.pop()!;
  tableAt(doc, parts)[field] = value;
  const candidate = parseConfig(stringify(doc), name, env, { strict: true });
  const text = renderConfig(candidate);
  // Validate the rendered candidate too, before publishing any bytes.
  parseConfig(text, name, env, { strict: true });
  const readback = tableAt(parse(text) as Table, parts)[field];
  const refused = writeAtomic(root, path, text, original);
  if (refused !== null) throw new Error(symlinkNote(refused));
  return readback;
}
