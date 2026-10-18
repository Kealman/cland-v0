// T2: template commands use the production runTask parser and real hub frames in-process.
// The real stdin task CLI and jq executable contracts live in skills-tracker-jq.test.ts (T3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from './harness.ts';
import { cland, create, itemFile, list, ok, project, view, type View } from './skills-tracker-support.ts';
const TEMPLATE = fileURLToPath(new URL('../../skills/templates/docs/agents/issue-tracker.md', import.meta.url));

test('tracker and vendored skills defer category filing to the Categories contract', async () => {
  for (const file of [TEMPLATE, new URL('../../docs/agents/issue-tracker.md', import.meta.url)]) {
    const text = await readFile(file, 'utf8');
    assert.match(text, /## Categories/);
    assert.match(text, /--parent C-<n>/);
    assert.match(text, /Bugs.*bug found aside/);
    assert.match(text, /Tech debt.*tech debt/);
    assert.match(text, /Follow-ups.*merged work/);
    assert.match(text, /Ideas.*idea/);
    assert.match(text, /idle_from/);
    assert.match(text, /Promotion is a message to the Coordinator/);
  }
  for (const skill of ['triage', 'to-tickets']) {
    assert.match(await readFile(new URL(`../../.agents/skills/${skill}/SKILL.md`, import.meta.url), 'utf8'), /tracker doc's "Categories" section/);
  }
});

test('ticket and plan skills require size, Summary and landed rework links', async () => {
  for (const skill of ['to-tickets', 'plan-epic']) {
    const text = await readFile(new URL(`../../.agents/skills/${skill}/SKILL.md`, import.meta.url), 'utf8');
    assert.match(text, /XS, S, M or L/);
    assert.match(text, /Split (?:each )?L tasks? into 2–3 M/);
    assert.match(text, /--allow-large <id>=<reason>/);
    assert.match(text, /XL tasks must be split before filing/);
    assert.match(text, /## Summary/);
    assert.match(text, /one to three sentences/);
    assert.match(text, /--regression-of/);
    assert.match(text, /landed tasks/);
  }
});

// ------------------------------------------------------------------ the template's commands are real

test('every `cland task` command the template names parses and reaches its hub or offline preflight', async (t) => {
  const text = await readFile(TEMPLATE, 'utf8');
  const commands = [...text.matchAll(/cland task [a-z]+[^`|\n]*/g)]
    .map((m) => m[0].split('<<')[0]!.trim())
    // prose naming a subcommand (`cland task create`: …) is not a command line
    .filter((c) => c.split(/\s+/).length > 3)
    // placeholders become concrete values; `x` also names a file, for `--body-file <file>`
    .map((c) => c.replace(/([RETQMSC])-<[^>]+>/g, '$1-1').replace(/"[^"]*"/g, 'x').replace(/<[^>]+>/g, 'x'));
  assert.ok(commands.length >= 15, `only ${commands.length} commands found in the template`);
  const subs = new Set(commands.map((c) => c.split(/\s+/)[2]));
  for (const sub of ['create', 'view', 'list', 'comment', 'edit', 'close', 'link', 'claim']) assert.ok(subs.has(sub), `the template never names \`cland task ${sub}\``);
  // No hub/tracker here: ordinary commands reach discovery, migration reaches offline preflight.
  // Either parsed command exits 1; a bad flag is a usage error (2).
  const root = await tempProject(t, 'cland-skills-nohub-');
  await writeFile(join(root, 'x'), 'body\n');
  for (const c of commands) {
    const args = c.split(/\s+/).slice(1);
    const r = await cland(root, '', ...args);
    assert.equal(r.code, 1, `\`${c}\` exits ${r.code}:\n${r.stderr}`);
    assert.match(r.stderr, args[1] === 'migrate' ? /existing tracker.*cland init/ : /no hub running/, c);
  }
});

// ------------------------------------------------------------------ /to-spec and /to-tickets

test('to-spec and to-tickets keep the source spec a leaf while wiring ticket blocking edges', async (t) => {
  const root = await project(t);
  const parent = await create(root, ['Login delivery', '--kind', 'epic'], '## Goal\n\nMagic links.\n');
  const parentArgs = parent ? ['--parent', parent] : [];
  const ticketParent = parent ?? await create(root, ['Ideas', '--kind', 'category']);
  const ticketArgs = ['--parent', ticketParent];
  // to-spec: publish the spec under the planned container, or unscheduled.
  const spec = await create(root, ['Login with a magic link', '--kind', 'spec', ...parentArgs, '--label', 'ready-for-agent'], '## Problem Statement\n\nUsers forget passwords.\n');
  const specBefore = (await itemFile(root, spec)).text;
  const source = `## Parent\n\n${spec}: Login with a magic link\n\n`;
  // to-tickets: the source spec is context in the body. Native parent edges point to its container.
  const schema = await create(root, ['--size', 'M', 'Store one-time login tokens', '--kind', 'task', ...ticketArgs, '--label', 'ready-for-agent'], source + '## What to build\n\nTokens.\n');
  const send = await create(root, ['--size', 'M', 'Send the magic link by email', '--kind', 'task', ...ticketArgs, '--blocked-by', schema, '--label', 'ready-for-agent'], source + '## What to build\n\nThe email.\n');
  const land = await create(root, ['--size', 'M', 'Log in from the link', '--kind', 'task', ...ticketArgs, '--blocked-by', schema, '--blocked-by', send, '--label', 'ready-for-agent'], source + '## What to build\n\nThe landing.\n');

  const specFile = await itemFile(root, spec);
  assert.equal(specFile.fm.kind, 'spec');
  assert.deepEqual(specFile.fm.labels, ['ready-for-agent']);
  assert.equal(specFile.fm.parent, parent);
  assert.match(specFile.text, /## Problem Statement\n\nUsers forget passwords\./);
  const landFile = await itemFile(root, land);
  assert.equal(landFile.fm.parent, ticketParent);
  assert.deepEqual(landFile.fm.blocked_by, [schema, send]);
  assert.deepEqual((await itemFile(root, send)).fm.blocked_by, [schema]);
  assert.deepEqual((await itemFile(root, schema)).fm.blocked_by, []);
  for (const id of [schema, send, land]) assert.equal((await view(root, id)).body.split('\n\n')[1], `${spec}: Login with a magic link`);

  const listed = await list(root);
  assert.deepEqual(listed.filter(i => i.parent === spec), [], 'a spec has no native children');
  assert.deepEqual(
    listed.filter(i => [schema, send, land].includes(i.id)).map(i => [i.parent, i.blocked_by]),
    [[ticketParent, []], [ticketParent, [schema]], [ticketParent, [schema, send]]],
  );
  assert.deepEqual((await list(root, '--state', 'open', '--label', 'ready-for-agent')).map(i => i.id), [spec, schema, send, land]);
  assert.equal((await view(root, spec)).state, 'open');
  assert.equal((await itemFile(root, spec)).text, specBefore, 'to-tickets never modifies its source spec');
});

test('ticket parent resolution preserves each source container or uses Ideas for an unscheduled spec', async t => {
  const root = await project(t);
  for (const kind of ['epic', 'release', 'category', null]) {
    const parent = kind ? await create(root, ['Delivery', '--kind', kind]) : null;
    const spec = await create(root, ['Source', '--kind', 'spec', '--label', 'ready-for-agent', ...(parent ? ['--parent', parent] : [])], '## Problem Statement\n\nUsers forget passwords.\n');
    const before = (await itemFile(root, spec)).text;
    const ticketParent = parent ?? await create(root, ['Ideas', '--kind', 'category']);
    const task = await create(root, ['Ticket', '--size', 'M', '--parent', ticketParent], `## Parent\n\n${spec}: Source\n\n`);
    assert.equal((await itemFile(root, spec)).fm.parent, parent, kind ?? 'unscheduled');
    assert.equal((await itemFile(root, task)).fm.parent, ticketParent);
    assert.deepEqual((await list(root)).filter(item => item.parent === spec), []);
    assert.equal((await view(root, spec)).state, 'open');
    assert.equal((await itemFile(root, spec)).text, before);
  }
});

// ------------------------------------------------------------------ /triage

test('triage: the attention buckets through `task list`, the roles applied through `task edit`', async (t) => {
  const root = await project(t);
  const fresh = await create(root, ['--size', 'M', 'The login page flickers']);
  const evaluating = await create(root, ['--size', 'M', 'Remember the last email used', '--label', 'needs-triage']);
  const waiting = await create(root, ['--size', 'M', 'Links expire too soon', '--label', 'bug', '--label', 'needs-info']);
  const rejected = await create(root, ['--size', 'M', 'Log in with a fax', '--label', 'needs-triage']);

  // "show what needs attention": unlabeled, needs-triage, needs-info (oldest first: id order)
  const open = await list(root, '--state', 'open');
  assert.deepEqual(open.filter((i) => i.labels.length === 0).map((i) => i.id), [fresh]);
  assert.deepEqual((await list(root, '--state', 'open', '--label', 'needs-triage')).map((i) => i.id), [evaluating, rejected]);
  assert.deepEqual((await list(root, '--state', 'open', '--label', 'needs-info')).map((i) => i.id), [waiting]);

  // an unlabeled item enters the machine
  ok(await cland(root, '', 'task', 'edit', fresh, '--add-label', 'bug', '--add-label', 'needs-triage', '--as', 'triager'));
  // needs-triage → ready-for-agent, with the agent brief
  ok(await cland(root, '', 'task', 'edit', evaluating, '--add-label', 'enhancement', '--add-label', 'ready-for-agent', '--remove-label', 'needs-triage', '--as', 'triager'));
  ok(await cland(root, '> *This was generated by AI during triage.*\n\n## Agent Brief\n\nPrefill the email field.\n', 'task', 'comment', evaluating, '--body-file', '-', '--as', 'triager'));
  // needs-info → needs-triage once the reporter answered
  ok(await cland(root, '', 'task', 'edit', waiting, '--add-label', 'needs-triage', '--remove-label', 'needs-info', '--as', 'triager'));
  // wontfix: the role, then the close with its comment
  ok(await cland(root, '', 'task', 'edit', rejected, '--add-label', 'enhancement', '--add-label', 'wontfix', '--remove-label', 'needs-triage', '--as', 'triager'));
  ok(await cland(root, '', 'task', 'close', rejected, '--comment', '> *This was generated by AI during triage.*\n\nOut of scope.', '--as', 'triager'));

  assert.deepEqual((await itemFile(root, fresh)).fm.labels, ['bug', 'needs-triage']);
  assert.deepEqual((await itemFile(root, evaluating)).fm.labels, ['enhancement', 'ready-for-agent']);
  assert.deepEqual((await itemFile(root, waiting)).fm.labels, ['bug', 'needs-triage']);
  const closed = await itemFile(root, rejected);
  assert.deepEqual(closed.fm.labels, ['enhancement', 'wontfix']);
  assert.equal(closed.fm.state, 'closed');
  assert.match((await itemFile(root, evaluating)).text, /### triager · .*\n\n> \*This was generated by AI during triage\.\*\n\n## Agent Brief/);

  assert.deepEqual((await list(root, '--state', 'open', '--label', 'ready-for-agent')).map((i) => i.id), [evaluating]);
  assert.deepEqual((await list(root, '--state', 'open', '--label', 'needs-triage')).map((i) => i.id), [fresh, waiting]);
  assert.deepEqual((await list(root, '--state', 'closed', '--label', 'wontfix')).map((i) => i.id), [rejected]);
});


test('runTask uses its supplied environment for socket attribution', async t => {
  const root = await project(t);
  const saved = process.env.CLAND_SESSION_NAME;
  process.env.CLAND_SESSION_NAME = 'unrelated-shell';
  try {
    // The explicit fixture env is a human shell. A socket fallback to process.env
    // would instead act as the unknown session and refuse task.create.
    const id = await create(root, ['Environment boundary', '--kind', 'spec']);
    assert.equal((await view(root, id)).title, 'Environment boundary');
  } finally {
    if (saved === undefined) delete process.env.CLAND_SESSION_NAME;
    else process.env.CLAND_SESSION_NAME = saved;
  }
});
