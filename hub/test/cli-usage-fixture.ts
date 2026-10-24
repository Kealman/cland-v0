import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { fixtureEnvironment } from './fixture-environment.ts';

/** Frozen pre-refactor bytes and export composition, independent of production. */
export function frozenUsage(): Record<string, string> {
  const commands: Record<string, string> = JSON.parse(readFileSync(new URL('./fixtures/cli-usage/commands.json', import.meta.url), 'utf8'));
  const exports: Record<string, string[]> = JSON.parse(readFileSync(new URL('./fixtures/cli-usage/exports.json', import.meta.url), 'utf8'));
  return Object.fromEntries(Object.entries(exports).map(([name, parts]) => [name, parts.map(part => {
    assert.ok(Object.hasOwn(commands, part), `known frozen command block: ${part}`);
    return commands[part]!;
  }).join('')]));
}

/** No hub or writers; every directory and profile belongs to this fixture. */
export function sealedHelpProject(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'cland-command-help-'));
  const project = join(root, 'project');
  const config = join(project, '.cland');
  mkdirSync(config, { recursive: true });
  writeFileSync(join(config, 'config.toml'), 'not valid TOML = [');
  chmodSync(config, 0o555);
  chmodSync(project, 0o555);
  t.after(() => {
    chmodSync(project, 0o755);
    chmodSync(config, 0o755);
    rmSync(root, { recursive: true, force: true });
  });
  const snapshot = (dir = root): unknown => readdirSync(dir).sort().map(name => {
    const path = join(dir, name);
    const stat = statSync(path);
    return [name, stat.mode, stat.mtimeMs, stat.isDirectory() ? snapshot(path) : readFileSync(path).toString('base64')];
  });
  return { root, project, env: fixtureEnvironment(root, process.env), snapshot: () => snapshot() };
}
