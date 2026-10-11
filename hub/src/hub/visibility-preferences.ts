// Human-only placement choices share ui.json with Neovim's layout. Each writer
// holds the same lock across read and atomic replacement, preserving both owners' fields.
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { acquireUiLock } from './ui-lock.ts';
import type { Resumed } from './worktrees.ts';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export type PreferenceSurface = 'topics' | 'sessions' | 'artifacts';
export type VisibilityPreferences = Partial<Record<PreferenceSurface, Record<string, 'pin' | 'mute'>>>;
const defaultLayout = () => ({ version: 2, plan_seen: {}, preset: null, panels: { left: false, right: 'sessions', dock: false }, sizes: {}, items_filter: 'board', current_release: null });
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parsePreferences(value: unknown): VisibilityPreferences {
  if (value === undefined) return {};
  if (!object(value)) throw new Error('invalid visibility preferences');
  const result: VisibilityPreferences = {};
  for (const [surface, choices] of Object.entries(value)) {
    if (!['topics', 'sessions', 'artifacts'].includes(surface) || !object(choices)) throw new Error('invalid visibility preference surface');
    const entries: Array<[string, 'pin' | 'mute']> = [];
    for (const [id, mode] of Object.entries(choices)) {
      if (!id || (mode !== 'pin' && mode !== 'mute')) throw new Error('invalid visibility preference');
      entries.push([id, mode as 'pin' | 'mute']);
    }
    result[surface as PreferenceSurface] = Object.fromEntries(entries);
  }
  return result;
}

export class VisibilityPreferenceFile {
  #value: VisibilityPreferences = {};
  #queue: Promise<unknown> = Promise.resolve();
  readonly path: string;
  constructor(path: string) {
    this.path = path;
    try { this.#value = parsePreferences(this.#read().visibility); }
    catch { /* An invalid UI file cannot prevent the hub starting. Writes still refuse it. */ }
  }
  #read(): Record<string, unknown> {
    try {
      const data: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
      if (!object(data)) throw new Error('invalid ui.json');
      return data;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return defaultLayout();
      throw err;
    }
  }
  get(): VisibilityPreferences { return this.#value; }
  toggle(surface: PreferenceSurface, target: string, mode: 'pin' | 'mute', resumed: Resumed = work => work()): Promise<VisibilityPreferences> {
    const operation = this.#queue.then(() => this.#toggle(surface, target, mode, resumed));
    this.#queue = operation.catch(() => resumed(() => {}));
    return operation;
  }
  async #toggle(surface: PreferenceSurface, target: string, mode: 'pin' | 'mute', resumed: Resumed): Promise<VisibilityPreferences> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    const release = await acquireUiLock(`${this.path}.lock`, resumed);
    try {
      let data: Record<string, unknown>;
      try {
        const text = await fs.readFile(this.path, 'utf8');
        data = resumed(() => {
          const value: unknown = JSON.parse(text);
          if (!object(value)) throw new Error('invalid ui.json');
          return value;
        });
      } catch (err) {
        data = resumed(() => {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
          return defaultLayout();
        });
      }
      const { choices, text, temporary } = resumed(() => {
        const choices = parsePreferences(data.visibility);
        const entries = new Map(Object.entries(choices[surface] ?? {}));
        if (entries.get(target) === mode) entries.delete(target); else entries.set(target, mode);
        choices[surface] = Object.fromEntries(entries);
        data.visibility = choices;
        return { choices, text: `${JSON.stringify(data)}\n`, temporary: `${this.path}.${randomUUID()}.tmp` };
      });
      try {
        await fs.writeFile(temporary, text, { mode: 0o600, flag: 'wx' });
        await fs.rename(temporary, this.path);
      } finally { await fs.rm(temporary, { force: true }); }
      return resumed(() => { this.#value = choices; return choices; });
    } finally { await release(); }
  }
}
