// T1: override scope classifies paths without a hub, Git or transport.
import assert from 'node:assert/strict';
import test from 'node:test';
import { refusedOverridePaths } from '../src/merge-override.ts';

test('override scope accepts only tracker and documentation paths', () => {
  const allowed = ['README.md', 'docs/guide.txt', 'GLOSSARY.md', 'hub/README.md', 'qa/briefs/example.txt', '.cland/tasks/archive/note.txt', '.cland/RULES.md'];
  const refused = ['.agents/skills/example/SKILL.md', '.cland/config.toml', '.cland/crew.toml', '.cland/roles.toml', '.claude/skills/example/SKILL.md', 'CHANGELOG.md', 'docs-extra/guide.txt', 'hub/src/parser.ts'];
  assert.deepEqual(refusedOverridePaths(allowed), []);
  assert.deepEqual(refusedOverridePaths([...allowed, ...refused]), refused);
  assert.deepEqual(refusedOverridePaths(['hub/src/deleted.ts', 'hub/src/moved.ts', 'docs/moved.ts', 'docs/from.txt', 'hub/src/renamed.ts']), ['hub/src/deleted.ts', 'hub/src/moved.ts', 'hub/src/renamed.ts']);
});
