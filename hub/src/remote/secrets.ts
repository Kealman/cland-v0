// Project-local credential storage. Values never cross the hub's frame boundary.
import { constants, closeSync, fchmodSync, fstatSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';
import { symlinkOnPath } from '../init/files.ts';
import type { RemoteRedactor } from './redact.ts';

export const SECRET_NAMES = ['telegram.token', 'discord.token', 'speech.elevenlabs_key', 'speech.xai_key'] as const;
export type SecretName = typeof SECRET_NAMES[number];
export type Secrets = Partial<Record<SecretName, string>>;

const SECRET_ENV: Record<SecretName, string> = {
  'telegram.token': 'CLAND_TELEGRAM_TOKEN',
  'discord.token': 'CLAND_DISCORD_TOKEN',
  'speech.elevenlabs_key': 'ELEVENLABS_API_KEY',
  'speech.xai_key': 'XAI_API_KEY',
};

/** Hub/provider resolution: explicit environment values override stored values. */
export function resolveSecrets(root: string, env: NodeJS.ProcessEnv = process.env): Secrets {
  const secrets = readSecretsFile(root);
  for (const name of SECRET_NAMES) {
    const value = env[SECRET_ENV[name]];
    if (value !== undefined) secrets[name] = value;
  }
  validateSecrets(secrets);
  return secrets;
}

/** Stored values only: CLI edits must never copy environment overrides into the file. */
export function readSecretsFile(root: string): Secrets {
  const path = join(root, '.cland/secrets.toml');
  if (symlinkOnPath(root, path) !== null) throw new Error('.cland/secrets.toml: symlink refused; replace it with a regular file');
  let fd: number;
  try { fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error('.cland/secrets.toml: cannot open a regular file (symlinks refused)');
  }
  let text: string;
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.nlink !== 1) throw new Error('.cland/secrets.toml: expected a regular file with one link');
    if ((info.mode & 0o7777) !== 0o600) fchmodSync(fd, 0o600);
    if (info.size > 65_536) throw new Error('.cland/secrets.toml: file too large');
    text = readFileSync(fd, 'utf8');
  } catch {
    throw new Error('.cland/secrets.toml: cannot read a private regular file (mode 600, one link, at most 64 KiB)');
  } finally { closeSync(fd); }
  let parsed: Record<string, unknown>;
  try { parsed = parse(text); }
  catch { throw new Error('.cland/secrets.toml: invalid TOML; fix the file without sharing its contents'); }
  const secrets: Secrets = {};
  for (const [section, table] of Object.entries(parsed)) {
    if (!['telegram', 'discord', 'speech'].includes(section) || !table || typeof table !== 'object' || Array.isArray(table)) {
      throw new Error('.cland/secrets.toml: unsupported secret section');
    }
    for (const [key, value] of Object.entries(table)) {
      const name = `${section}.${key}`;
      if (!isSecretName(name) || typeof value !== 'string') throw new Error('.cland/secrets.toml: expected supported dotted names with string values');
      secrets[name] = value;
    }
  }
  return secrets;
}

/** Validate before any provider constructs a credential-bearing URL. Discord is opaque. */
export function validateSecrets(secrets: Secrets): void {
  const token = secrets['telegram.token'];
  if (token !== undefined && (token.length > 80 || !/^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$/.test(token) || /[\r\n]/.test(token))) {
    throw new Error('telegram.token: invalid token format (at most 80 characters)');
  }
}

/** Startup/reload boundary: validate the complete resolution before registering any value. */
export function validateAndRegisterSecrets(secrets: Secrets, redactor: RemoteRedactor): void {
  validateSecrets(secrets);
  redactor.register(Object.values(secrets));
}

export function isSecretName(name: string): name is SecretName {
  return (SECRET_NAMES as readonly string[]).includes(name);
}

/** Public diagnostics use a short SHA-256 fingerprint, never a value. */
export function secretFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/** One credential per input line; no terminal control bytes or unbounded input. */
export function validateSecretValue(value: string): void {
  if (!value || Buffer.byteLength(value) > 4096 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error('secret value must be a nonempty single line of at most 4096 bytes without control characters');
  }
}

export function setSecret(root: string, name: SecretName, value: string): void {
  validateSecretValue(value);
  const secrets = readSecretsFile(root);
  secrets[name] = value;
  saveSecrets(root, secrets);
}

export function unsetSecret(root: string, name: SecretName): void {
  const secrets = readSecretsFile(root);
  if (!Object.hasOwn(secrets, name)) return;
  delete secrets[name];
  saveSecrets(root, secrets);
}

function saveSecrets(root: string, secrets: Secrets): void {
  const path = join(root, '.cland/secrets.toml');
  if (symlinkOnPath(root, path) !== null) throw new Error('.cland/secrets.toml: symlink refused; replace it with a regular file');
  const tables: Record<string, Record<string, string>> = {};
  for (const name of SECRET_NAMES) {
    const value = secrets[name];
    if (value === undefined) continue;
    const [section, key] = name.split('.') as [string, string];
    (tables[section] ??= {})[key] = value;
  }
  const tmp = join(root, '.cland', `.secrets-${randomBytes(12).toString('hex')}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(tmp, 'wx', 0o600);
    fchmodSync(fd, 0o600);
    writeFileSync(fd, stringify(tables));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    if (symlinkOnPath(root, path) !== null) throw new Error('symlink');
    renameSync(tmp, path);
  } catch {
    throw new Error('.cland/secrets.toml: cannot save private file; check permissions and symlinks');
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(tmp, { force: true });
  }
}
