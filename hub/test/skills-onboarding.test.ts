// T1: the skill's documented commands match CLI usage and configuration keys in-process.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as usage from '../src/cli/usage.ts';
import { configKeys } from '../src/init/config-set.ts';

const SKILL = new URL('../../.agents/skills/onboarding/', import.meta.url);
const FILES = ['SKILL.md', 'EMPTY.md', 'EXISTING.md', 'WELCOME.md', 'TOUR.md'];
// Open v0.1.4 work owns these commands. A shipped command makes its exception fail.
const PENDING: Record<string, string> = {};
const HELP = Object.values(usage).join('\n');
const COMMANDS = new Set<string>();
for (const line of HELP.split('\n')) {
  const match = /^  ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?(?=\s|$)/.exec(line);
  if (!match) continue;
  COMMANDS.add(match[1]!);
  if (match[2]) COMMANDS.add(`${match[1]} ${match[2]}`);
}

function commandProblems(markdown: string): string[] {
  const problems: string[] = [];
  const keys = configKeys();
  for (const span of markdown.matchAll(/`([^`]+)`/g)) {
    const command = /^cland\s+([a-z][a-z-]*)(?:\s+([a-z][a-z-]*))?(?=\s|$)/.exec(span[1]!);
    if (!command) continue;
    const name = command[2] ? `${command[1]} ${command[2]}` : command[1]!;
    if (!COMMANDS.has(name) && !Object.hasOwn(PENDING, name)) problems.push(`unknown command: cland ${name}`);
    const config = /^cland\s+config\s+set\s+([^\s`]+)/.exec(span[1]!);
    if (config && !keys.includes(config[1]!)) problems.push(`unknown config key: ${config[1]}`);
  }
  return problems;
}

test('onboarding names only shipped commands or explicitly pending release work', async () => {
  for (const [command, item] of Object.entries(PENDING)) {
    assert.ok(!COMMANDS.has(command), `${item}: cland ${command} now ships; remove its pending entry`);
  }
  for (const file of FILES) {
    const markdown = await readFile(new URL(file, SKILL), 'utf8');
    assert.deepEqual(commandProblems(markdown), [], file);
  }
});

test('the onboarding command check rejects unknown commands and config keys', () => {
  assert.deepEqual(commandProblems('`cland crew add` and `cland nonexistent`'), [
    'unknown command: cland crew add', 'unknown command: cland nonexistent',
  ]);
  assert.deepEqual(commandProblems('`cland config set plan.approval "human"`'), []);
  assert.deepEqual(commandProblems('`cland config set plan.unknown "human"`'), ['unknown config key: plan.unknown']);
});
