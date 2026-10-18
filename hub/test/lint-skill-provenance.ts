// T0 static gate: every kept upstream skill ships its provenance and MIT notice.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

// The kept upstream set from docs/spec/v0.1.4.md §3.6; cland's own skills are excluded.
const upstream = [
  'code-review', 'codebase-design', 'diagnosing-bugs', 'domain-modeling', 'grilling',
  'implement', 'prototype', 'research', 'retro', 'tdd', 'to-spec', 'to-tickets',
  'triage', 'wayfinder', 'writing-for-agents',
];

for (const skill of upstream) {
  const folder = new URL(`../../.agents/skills/${skill}/`, import.meta.url);
  const source = await readFile(new URL('SKILL.md', folder), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  assert.ok(frontmatter, `${skill}: missing frontmatter`);
  const { metadata } = parse(frontmatter[1]!) as { metadata?: Record<string, unknown> };
  assert.ok(metadata, `${skill}: missing metadata`);
  assert.equal(typeof metadata?.origin, 'string', `${skill}: metadata.origin must be a string`);
  assert.match(metadata.origin as string, new RegExp(`mattpocock/skills skills/(?:engineering|productivity)/${skill} at [a-f0-9]{8,40}\\b`), `${skill}: origin needs its upstream path and commit`);
  assert.ok((metadata.origin as string).includes('MIT, Copyright (c) 2026 Matt Pocock'), `${skill}: origin needs the MIT notice`);
  assert.equal(typeof metadata.changes, 'string', `${skill}: metadata.changes must be a string`);
  assert.ok((metadata.changes as string).trim(), `${skill}: changes must describe cland's edits or say none`);
  assert.doesNotMatch(metadata.changes as string, /[\r\n]/, `${skill}: changes must fit on one line`);
  const license = await readFile(new URL('LICENSE', folder), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Matt Pocock/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
}
console.log(`skill provenance lint: ${upstream.length} upstream headers and MIT licenses checked`);
