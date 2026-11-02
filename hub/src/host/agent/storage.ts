import { open, rename } from 'node:fs/promises';
/** Private atomic checkpoint; return only after the new file's bytes are synced. */
export async function checkpoint(path: string, value: unknown): Promise<void> {
  const file = await open(path + '.new', 'w', 0o600);
  try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
  await rename(path + '.new', path);
}
