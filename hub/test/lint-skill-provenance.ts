// T0 static gate: every kept upstream skill ships its provenance and MIT notice.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'yaml';
import { pathToFileURL } from 'node:url';

// The kept upstream set from docs/spec/v0.1.4.md §3.6; cland's own skills are excluded.
const upstream = [
  'code-review', 'codebase-design', 'diagnosing-bugs', 'domain-modeling', 'grilling',
  'implement', 'prototype', 'research', 'retro', 'tdd', 'to-spec', 'to-tickets',
  'triage', 'wayfinder', 'writing-for-agents',
];

export async function checkSkillProvenance(folder: URL, skill: string): Promise<void> {
  const source = await readFile(new URL('SKILL.md', folder), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  assert.ok(frontmatter, `${skill}: missing frontmatter`);
  const { metadata } = parse(frontmatter[1]!) as { metadata?: Record<string, unknown> };
  assert.ok(metadata, `${skill}: missing metadata`);
  assert.equal(typeof metadata?.origin, 'string', `${skill}: metadata.origin must be a string`);
  assert.match(metadata.origin as string, new RegExp(`mattpocock/skills skills/(?:engineering|productivity)/${skill} at [a-f0-9]{8,40}\\b`), `${skill}: origin needs its upstream path and commit`);
  assert.ok((metadata.origin as string).includes('MIT, Copyright (c) 2026 Matt Pocock'), `${skill}: origin needs the MIT notice`);
  assert.equal(metadata.changes, 'CHANGES', `${skill}: metadata.changes must point to CHANGES`);
  const entries = await readdir(new URL('CHANGES/', folder));
  assert.ok(entries.length, `${skill}: CHANGES needs a provenance entry or none`);
  for (const entry of entries) {
    assert.match(entry, /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.md$/, `${skill}: CHANGES entry filename`);
    const changes = await readFile(new URL(`CHANGES/${entry}`, folder), 'utf8');
    assert.ok(changes.trim(), `${skill}: CHANGES needs a nonempty entry`);
    assert.doesNotMatch(changes, /^(?:<{7}|={7}|>{7})/m, `${skill}: unresolved CHANGES conflict`);
  }
  const license = await readFile(new URL('LICENSE', folder), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Matt Pocock/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const skill of upstream) await checkSkillProvenance(new URL(`../../.agents/skills/${skill}/`, import.meta.url), skill);
  console.log(`skill provenance lint: ${upstream.length} upstream headers and MIT licenses checked`);
}
