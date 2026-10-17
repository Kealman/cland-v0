// T3: execute the documented jq frontier program against real tracker output across claim and close transitions.
// Parser, template and tracker rule coverage stays in skills-tracker.test.ts (T2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cland, create, itemFile, list, ok, project, view, type View } from './skills-tracker-support.ts';
const TEMPLATE = fileURLToPath(new URL('../../skills/templates/docs/agents/issue-tracker.md', import.meta.url));
const hasJq = spawnSync('jq', ['--version']).status === 0;

/** The jq program of the template's frontier query, exactly as the template prints it. */
async function frontierProgram(): Promise<string> {
  const text = await readFile(TEMPLATE, 'utf8');
  const block = /\*\*Frontier query\*\*[\s\S]*?```sh\n([\s\S]*?)```/.exec(text)?.[1];
  assert.ok(block, 'the template has no frontier query block');
  const program = /jq -r --arg map T-<map> '([\s\S]*)'/.exec(block)?.[1];
  assert.ok(program, `the frontier block has no jq program:\n${block}`);
  return program;
}

/** The template's frontier query for `map`: `cland task list --json | jq …`; the ids in the order it prints them. */
async function frontier(root: string, map: string): Promise<string[]> {
  const listed = ok(await cland(root, '', 'task', 'list', '--json')).stdout;
  const jq = spawnSync('jq', ['-r', '--arg', 'map', map, await frontierProgram()], { input: listed, encoding: 'utf8' });
  assert.equal(jq.status, 0, jq.stderr);
  return jq.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[0] as string);
}

const MAP_BODY = `## Destination

A spec for magic-link login.

## Notes

Consult /domain-modeling.

## Decisions so far

## Not yet specified

- Rate limits on link requests

## Out of scope
`;

test('wayfinder: a map item, child tickets wired in a second pass, claim by assignee, the frontier through the CLI', { skip: !hasJq && 'jq is not installed' }, async (t) => {
  const root = await project(t);
  const map = await create(root, ['Magic-link login', '--kind', 'map', '--label', 'wayfinder:map'], MAP_BODY);
  // an item outside the map never reaches its frontier
  await create(root, ['--size', 'M', 'Unrelated chore']);
  // chart: the tickets first…
  const provider = await create(root, ['Which email provider sends the link?', '--kind', 'question', '--parent', map, '--label', 'wayfinder:research'], '## Question\n\nProvider?\n');
  const lifetime = await create(root, ['How long does a link live?', '--kind', 'question', '--parent', map, '--label', 'wayfinder:grilling'], '## Question\n\nLifetime?\n');
  const template = await create(root, ['What does the email say?', '--kind', 'question', '--parent', map, '--label', 'wayfinder:grilling'], '## Question\n\nCopy?\n');
  const account = await create(root, ['--size', 'M', 'Open a sandbox account with the provider', '--kind', 'task', '--parent', map, '--label', 'wayfinder:task'], '## Question\n\nSandbox.\n');
  // …then the blocking edges, once every ticket has its id
  ok(await cland(root, '', 'task', 'link', template, '--blocked-by', provider));
  ok(await cland(root, '', 'task', 'link', account, '--blocked-by', provider, '--blocked-by', lifetime));

  assert.deepEqual((await list(root, '--kind', 'map')).map((i) => i.id), [map]);
  assert.deepEqual((await itemFile(root, account)).fm.blocked_by, [provider, lifetime]);
  assert.deepEqual(await frontier(root, map), [provider, lifetime]);

  // claim: the hub's live hold first, then the assignee the frontier reads
  ok(await cland(root, '', 'task', 'claim', provider, '--as', 'wf-1'));
  ok(await cland(root, '', 'task', 'edit', provider, '--assignee', 'wf-1', '--as', 'wf-1'));
  assert.equal((await itemFile(root, provider)).fm.assignee, 'wf-1');
  assert.deepEqual(await frontier(root, map), [lifetime]);
  // a concurrent session cannot take the same ticket
  const refused = await cland(root, '', 'task', 'claim', provider, '--as', 'wf-2');
  assert.notEqual(refused.code, 0, refused.stdout);

  // resolve: comment, close, then a context pointer in the map's Decisions so far
  ok(await cland(root, 'Postmark: it has a sandbox and a Node client.\n', 'task', 'comment', provider, '--body-file', '-', '--as', 'wf-1'));
  ok(await cland(root, '', 'task', 'close', provider, '--as', 'wf-1'));
  const body = ok(await cland(root, '', 'task', 'view', map, '--json')).stdout;
  const current = (JSON.parse(body) as { item: View }).item.body;
  const pointer = `- [Which email provider sends the link?](${(await view(root, provider)).path}) (${provider}): Postmark`;
  const updated = current.replace('## Decisions so far\n', `## Decisions so far\n\n${pointer}\n`);
  const bodyFile = join(root, 'map-body.md');
  await writeFile(bodyFile, updated);
  ok(await cland(root, '', 'task', 'edit', map, '--body-file', bodyFile, '--as', 'wf-1'));

  const resolved = await view(root, provider);
  assert.equal(resolved.state, 'closed');
  assert.equal(resolved.claim, null, 'closing releases the claim');
  assert.deepEqual(
    resolved.comments.map((c) => [c.author, c.text]),
    [['wf-1', 'Postmark: it has a sandbox and a Node client.']],
  );
  assert.ok((await itemFile(root, map)).text.includes(pointer), 'the map file holds the pointer');
  // the closed blocker unblocks the email-copy ticket; the sandbox still waits on the lifetime
  assert.deepEqual(await frontier(root, map), [lifetime, template]);
});

