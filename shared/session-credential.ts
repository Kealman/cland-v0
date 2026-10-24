// Private local session authority; shared by the hub writer and shell reader.
import { readFileSync, lstatSync } from 'node:fs';
import files from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';

export function sessionRunDirectory(clandDir: string, sessionId: string): string {
  return join(clandDir, 'run', 'sessions', createHash('sha256').update(sessionId).digest('hex'));
}

export function sessionCredentialFile(clandDir: string, sessionId: string): string {
  return join(sessionRunDirectory(clandDir, sessionId), 'credential.json');
}

/** Read only the credential explicitly bound to this identity; errors disclose no file contents. */
export function readSessionCredential(clandDir: string, sessionId: string): string | undefined {
  try {
    const file = sessionCredentialFile(clandDir, sessionId);
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) return undefined;
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object') return undefined;
    const record = value as { sessionId?: unknown; credential?: unknown };
    return record.sessionId === sessionId && typeof record.credential === 'string' && record.credential.length > 0 ? record.credential : undefined;
  } catch { return undefined; }
}

export async function writeSessionCredential(clandDir: string, sessionId: string, credential: string): Promise<void> {
  const directory = sessionRunDirectory(clandDir, sessionId);
  await files.mkdir(directory, { recursive: true, mode: 0o700 });
  await files.chmod(directory, 0o700);
  const temporary = join(directory, `credential-${randomUUID()}.tmp`);
  try {
    await files.writeFile(temporary, JSON.stringify({ sessionId, credential }), { mode: 0o600, flag: 'wx' });
    await files.rename(temporary, sessionCredentialFile(clandDir, sessionId));
  } finally { await files.rm(temporary, { force: true }); }
}

/** Archive happens only after the session's writers have stopped. */
export async function removeSessionRunDirectory(clandDir: string, sessionId: string): Promise<void> {
  await files.rm(sessionRunDirectory(clandDir, sessionId), { recursive: true, force: true });
}
