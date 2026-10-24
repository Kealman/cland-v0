import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Frozen pre-refactor bytes and export composition, independent of production. */
export function frozenUsage(): Record<string, string> {
  const commands: Record<string, string> = JSON.parse(readFileSync(new URL('./fixtures/cli-usage/commands.json', import.meta.url), 'utf8'));
  const exports: Record<string, string[]> = JSON.parse(readFileSync(new URL('./fixtures/cli-usage/exports.json', import.meta.url), 'utf8'));
  return Object.fromEntries(Object.entries(exports).map(([name, parts]) => [name, parts.map(part => {
    assert.ok(Object.hasOwn(commands, part), `known frozen command block: ${part}`);
    return commands[part]!;
  }).join('')]));
}
