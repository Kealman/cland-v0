import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import type { TestContext } from 'node:test';

/** Keep the synchronous-I/O trap identical for serving and recovery windows. */
export function noSyncFilesystem(t: TestContext) {
  const originals = Object.fromEntries(Object.entries(fs).filter(([name, fn]) => name.endsWith('Sync') && typeof fn === 'function'));
  const calls: string[] = [];
  for (const name of Object.keys(originals)) Object.assign(fs, { [name]: () => { calls.push(`${name}: ${new Error().stack}`); throw new Error(`synchronous ${name} on serving path`); } });
  syncBuiltinESMExports();
  let restored = false;
  const restore = () => { if (restored) return; restored = true; Object.assign(fs, originals); syncBuiltinESMExports(); };
  t.after(restore);
  return { calls, restore };
}
