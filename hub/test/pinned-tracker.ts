// Test data only: immutable real-world bodies, never the growing checkout tracker.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function copyPinnedTracker(root: string, exclude: string[] = []): Promise<void> {
  const snapshot = JSON.parse(await readFile(new URL('./fixtures/tracker-snapshot/items.json', import.meta.url), 'utf8')) as {
    items: Array<{ name: string; text: string }>;
  };
  assert.equal(snapshot.items.length, 24, 'the pinned shape corpus has a fixed item count');
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  for (const { name, text } of snapshot.items) {
    assert.match(name, /^[A-Z]-\d+-[\w-]+\.md$/);
    if (exclude.some(id => name.startsWith(`${id}-`))) continue;
    await writeFile(join(dir, name), text);
  }
}
