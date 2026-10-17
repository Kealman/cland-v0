// T2: template commands use the production runTask argv parser and real hub frames in-process.
// The jq frontier query remains an executable contract. Parent variants share one delivery scenario.
// One real CLI proves --body-file - reads unchanged stdin bytes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { projectHub, tempProject, type CliResult } from './harness.ts';

import { runTask } from '../src/cli/task.ts';
import { ownProcess, onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
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

const hasJq = spawnSync('jq', ['--version']).status === 0;

/** `cland <args>` in `cwd` with `input` on stdin (for `--body-file -`), with no `CLAND_*` variable from the test's environment. */
async function cland(cwd: string, input: string, ...args: string[]): Promise<CliResult> {
  assert.equal(args.shift(), 'task');
  args = args.map((arg, i) => args[i - 1] === '--body-file' && arg !== '-' ? resolve(cwd, arg) : arg);
  let stdout = '';
  let stderr = '';
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  const code = await runTask(args, cwd, { out: text => { stdout += text; }, err: text => { stderr += text; }, stdin: () => input }, env);
  return { code, stdout, stderr };
}

const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

type Item = {
  id: string;
  kind: string;
  title: string;
  state: string;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  claim: { session: string } | null;
};
type View = Item & { path: string; body: string; comments: Array<{ author: string; text: string }> };

/** `cland task <args> --json`, parsed. */
const task = async <T>(root: string, args: string[], input = ''): Promise<T> => JSON.parse(ok(await cland(root, input, 'task', ...args, '--json')).stdout) as T;
const create = async (root: string, args: string[], body = ''): Promise<string> => (await task<{ item: View }>(root, ['create', ...args, '--body-file', '-'], body)).item.id;
const list = async (root: string, ...args: string[]): Promise<Item[]> => (await task<{ items: Item[] }>(root, ['list', ...args])).items;
const view = async (root: string, id: string): Promise<View> => (await task<{ item: View }>(root, ['view', id])).item;

const frontmatter = (text: string): Record<string, unknown> => parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '') as Record<string, unknown>;
async function itemFile(root: string, id: string): Promise<{ fm: Record<string, unknown>; text: string }> {
  const dir = join(root, '.cland', 'tasks');
  const name = (await readdir(dir)).find((n) => n.startsWith(`${id}-`) && n.endsWith('.md'));
  assert.ok(name, `no file for ${id} in .cland/tasks`);
  const text = await readFile(join(dir, name), 'utf8');
  return { fm: frontmatter(text), text };
}

async function project(t: TestContext): Promise<string> {
  const root = await tempProject(t, 'cland-skills-');
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake' });
  return root;
}

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

// ------------------------------------------------------------------ /wayfinder

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

test('task CLI reads --body-file - from real stdin without changing its UTF-8 body', async t => {
  const root = await project(t);
  const input = '## Summary\n\nπ, quotes "here", and literal $HOME.\nA second line.';
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), 'task', 'create', 'Stdin spec', '--kind', 'spec', '--body-file', '-', '--json'], { cwd: root, env, timeout: 10_000, signal: t.signal, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const stop = ownProcess(t, child.pid);
  onCleanup(t, async () => { await stop(); await closed; });
  child.stdin.end(input);
  assert.equal(await exited, 0, stderr);
  assert.equal((JSON.parse(stdout) as { item: View }).item.body, input);
});
