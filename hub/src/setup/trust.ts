import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { realClock, type Clock } from '../hub/clock.ts';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The global config of the profile the hub launches Claude Code with. */
export const claudeConfigFile = (env: NodeJS.ProcessEnv, home: string): string => (env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, '.claude.json') : join(home, '.claude.json'));

function readJsonObject(file: string): { value: Record<string, unknown>; text: string | null } {
  let text: string | null = null;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  if (text === null || text.trim() === '') return { value: {}, text };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON: Claude Code's trust dialog (claude, in the project) is the way left`);
  }
  if (!record(value)) throw new Error(`${file} does not hold a JSON object`);
  return { value, text };
}

export function claudeTrusted(file: string, key: string): boolean {
  const { value } = readJsonObject(file);
  return trusted(value, key);
}

function trusted(value: Record<string, unknown>, key: string): boolean {
  const projects = value.projects;
  return record(projects) && record(projects[key]) && projects[key].hasTrustDialogAccepted === true;
}

const STALE_MS = 10_000;

/** Claude Code's lock on its config: `<file>.lock`, a folder; a holder that has not refreshed it for 10 s is gone. */
async function withConfigLock<T>(file: string, work: () => T, clock: Clock, waitMs = 5000): Promise<T> {
  const lock = `${file}.lock`;
  const deadline = clock.now().getTime() + waitMs;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      let age = 0;
      try {
        age = clock.now().getTime() - statSync(lock).mtimeMs;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        continue; // released between the two calls
      }
      if (age > STALE_MS) {
        rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (clock.now().getTime() > deadline) throw new Error(`Claude Code holds ${lock}; run cland setup again in a moment`);
      await new Promise<void>(resolve => clock.setTimeout(resolve, 100));
    }
  }
  try {
    return work();
  } finally {
    try {
      rmdirSync(lock);
    } catch {
      /* a stale-lock takeover by another writer */
    }
  }
}

/**
 * Set `projects[key].hasTrustDialogAccepted = true` and keep every other key, under the config's lock: a temporary
 * file beside the target (the real file when the config is a symlink), the original mode (0600 for a new file),
 * renamed over it; the formatting follows the file (two-space JSON, the same trailing newline).
 */
export async function grantClaudeTrust(file: string, key: string, clock: Clock = realClock): Promise<void> {
  mkdirSync(dirname(file), { recursive: true });
  await withConfigLock(file, () => {
    let link = false;
    try { link = lstatSync(file).isSymbolicLink(); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
    const target = link ? realpathSync(file) : file;
    const { value, text } = readJsonObject(target);
    if (trusted(value, key)) return;
    const projects = Object.hasOwn(value, 'projects') ? value.projects : {};
    if (!record(projects)) throw new Error(`${file}: projects must hold a JSON object; use Claude Code's own trust dialog`);
    const entry = Object.hasOwn(projects, key) ? projects[key] : {};
    if (!record(entry)) throw new Error(`${file}: projects[${JSON.stringify(key)}] must hold a JSON object; use Claude Code's own trust dialog`);
    projects[key] = { ...entry, hasTrustDialogAccepted: true };
    value.projects = projects;
    let mode = 0o600;
    try {
      mode = statSync(target).mode & 0o777;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const tmp = join(dirname(target), `.${basename(target)}.cland-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
    try {
      writeFileSync(tmp, `${JSON.stringify(value, null, 2)}${text === null || text.endsWith('\n') ? '\n' : ''}`, { mode, flag: 'wx' });
      chmodSync(tmp, mode);
      renameSync(tmp, target);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    }
  }, clock);
}

