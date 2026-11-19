// Call from a final named test, so a census failure contributes to the file exit.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { processGroupCensus, type ProcessIdentity } from './process-cleanup.ts';

const sessionGroups = new Set<number>();
const registries = new Set<string>();

export function rememberFakeClaudeRegistry(path: string): void { registries.add(path); }

export function rememberFakeClaudeSessions(writers: Array<ProcessIdentity & { session: boolean }>): void {
  for (const writer of writers) {
    if (writer.session && writer.group === writer.pid) sessionGroups.add(writer.group);
  }
}

export async function assertFakeClaudeCensus(): Promise<void> {
  for (const registry of registries) {
    const files = await readdir(registry).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    rememberFakeClaudeSessions(await Promise.all(files.filter(file => file.endsWith('.json')).map(async file =>
      JSON.parse(await readFile(join(registry, file), 'utf8')) as ProcessIdentity & { session: boolean })));
  }
  if (!sessionGroups.size) return;
  assert.deepEqual(processGroupCensus([...sessionGroups]), [], 'fake-Claude session and spoke groups are empty after the test file');
}
