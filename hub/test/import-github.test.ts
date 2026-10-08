// `cland task import-github` (#38): the CLI against a real hub daemon in a temporary project, with GitHub
// replaced by a fake `gh` on PATH that answers the exact `gh api` calls from a JSON fixture
// (`fixtures/github-acme-widgets.json`: an epic with two sub-issues, a blocked-by edge to an open and to a
// closed issue, comments, a pull request to skip, a closed issue and a map).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { CLI_ENTRY, startDaemon, tempProject, type CliResult } from './harness.ts';

const FAKE_GH_DIR = fileURLToPath(new URL('./fixtures/fake-gh', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/github-acme-widgets.json', import.meta.url));
const REPO = 'acme/widgets';

type Env = { fixture: string; log: string };

function cland(cwd: string, env: Env, ...args: string[]): Promise<CliResult> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) vars[k] = v;
  vars.PATH = [FAKE_GH_DIR, dirname(process.execPath), process.env.PATH ?? ''].join(':');
  vars.FAKE_GH_FIXTURE = env.fixture;
  vars.FAKE_GH_LOG = env.log;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], { cwd, env: vars, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => (stdout += String(c)));
    child.stderr.on('data', (c: Buffer) => (stderr += String(c)));
    const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

type Summary = {
  repo: string;
  pulls_skipped: number;
  created: number;
  updated: number;
  unchanged: number;
  comments_added: number;
  items: Array<{ number: number; id: string; outcome: string; comments_added: number }>;
};

const runImport = async (root: string, env: Env, ...args: string[]): Promise<Summary> => JSON.parse(ok(await cland(root, env, 'task', 'import-github', ...args, '--json')).stdout) as Summary;

/** Every item file in the project, by name. */
async function snapshot(root: string): Promise<Map<string, string>> {
  const dir = join(root, '.cland', 'tasks');
  const names = (await readdir(dir)).filter((n) => /^T-\d+-.*\.md$/.test(n)).sort();
  return new Map(await Promise.all(names.map(async (n) => [n, await readFile(join(dir, n), 'utf8')] as const)));
}

const frontmatter = (text: string): Record<string, unknown> => parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '') as Record<string, unknown>;

/** The file of the item imported from issue `n`. */
function byIssue(files: Map<string, string>, n: number): { name: string; text: string; fm: Record<string, unknown> } {
  for (const [name, text] of files) {
    const fm = frontmatter(text);
    if ((fm.github as { number?: number } | undefined)?.number === n) return { name, text, fm };
  }
  assert.fail(`no item for issue #${n}`);
}

/** A temporary project with a GitHub origin, a running hub and a private copy of the fixture. */
async function setup(t: TestContext): Promise<{ root: string; env: Env }> {
  const root = await tempProject(t, 'cland-import-');
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['remote', 'add', 'origin', `git@github.com:${REPO}.git`], { cwd: root }).status, 0);
  const fixture = join(root, 'gh-fixture.json');
  await copyFile(FIXTURE, fixture);
  await startDaemon(t, root);
  return { root, env: { fixture, log: join(root, 'gh-calls.log') } };
}

test('import-github writes items with parents, blockers, comments and the issue reference; a re-run is a no-op; a change updates in place', async (t) => {
  const { root, env } = await setup(t);

  // ---- the first run: open issues of the repository named by origin
  const first = await runImport(root, env);
  assert.equal(first.repo, REPO);
  assert.equal(first.pulls_skipped, 1);
  assert.deepEqual([first.created, first.updated, first.unchanged, first.comments_added], [4, 0, 0, 3]);
  assert.deepEqual(
    first.items.map((i) => i.number),
    [1, 2, 3, 6],
    'oldest issue first, the pull request skipped',
  );
  const calls = await readFile(env.log, 'utf8');
  assert.doesNotMatch(calls, /issues\/5\//, 'nothing is fetched for a pull request');

  let files = await snapshot(root);
  assert.equal(files.size, 4);
  const epic = byIssue(files, 1);
  const parse = byIssue(files, 2);
  const render = byIssue(files, 3);
  const map = byIssue(files, 6);
  const idOf = (x: { fm: Record<string, unknown> }): string => x.fm.id as string;

  assert.equal(epic.fm.kind, 'epic');
  assert.equal(map.fm.kind, 'map');
  assert.equal(parse.fm.kind, 'task');
  assert.deepEqual(epic.fm.labels, ['epic', 'slice-1']);
  assert.deepEqual(epic.fm.github, { repo: REPO, number: 1, url: `https://github.com/${REPO}/issues/1` });
  assert.equal(epic.fm.created, '2026-01-01T10:00:00Z');
  assert.equal(parse.fm.assignee, 'alice');
  assert.equal(render.fm.assignee, null);
  assert.equal(parse.fm.parent, idOf(epic));
  assert.equal(render.fm.parent, idOf(epic));
  assert.equal(epic.fm.parent, null);
  assert.deepEqual(render.fm.blocked_by, [idOf(parse), 'github:#4'], 'the closed blocker is not imported without --all: kept as its issue reference');
  assert.equal(epic.fm.state, 'open');

  // the body verbatim, with the lines the file format would mistake for structure escaped
  assert.match(epic.text, /The widgets epic\.\n\n\\## Comments\n\nThat heading is part of the body\./);
  assert.match(parse.text, /\n\\### bob · 2026-01-01T00:00:00Z\n/);
  // comments with author and GitHub time, each carrying its GitHub comment id
  assert.match(parse.text, /## Comments\n\n### bob · 2026-01-03T09:00:00Z\n\n<!-- github-comment: 2001 -->\n\nStarted\.\nverdict: review\n\n### alice · 2026-01-03T10:30:00Z\n\n<!-- github-comment: 2002 -->\n\nLooks good\.\n$/);
  assert.doesNotMatch(render.text, /## Comments/);

  // the hub indexed them: `task view` reads the same, comments are not verdicts
  const view = JSON.parse(ok(await cland(root, env, 'task', 'view', idOf(parse), '--json')).stdout) as { item: { comments: Array<{ author: string; at: string; verdict?: unknown }>; github: unknown; parent: string } };
  assert.deepEqual(
    view.item.comments.map((c) => [c.author, c.at, c.verdict ?? null]),
    [
      ['bob', '2026-01-03T09:00:00Z', null],
      ['alice', '2026-01-03T10:30:00Z', null],
    ],
  );
  assert.deepEqual(view.item.github, { repo: REPO, number: 2, url: `https://github.com/${REPO}/issues/2` });
  assert.equal(view.item.parent, idOf(epic));

  // ---- a re-run with GitHub unchanged: nothing written
  const second = await runImport(root, env, '--repo', REPO);
  assert.deepEqual([second.created, second.updated, second.unchanged, second.comments_added], [0, 0, 4, 0]);
  assert.deepEqual(await snapshot(root), files, 'byte-identical files');

  // a local change the import does not own survives (the hub writes it; the item keeps its topic)
  ok(await cland(root, env, 'task', 'link', idOf(map), '--topic', 'mapping'));
  files = await snapshot(root);
  const third = await runImport(root, env);
  assert.deepEqual([third.created, third.updated, third.unchanged], [0, 0, 4]);
  assert.deepEqual(await snapshot(root), files);

  // ---- GitHub changed: a new comment on #2, a new label on #3
  const fixture = JSON.parse(await readFile(env.fixture, 'utf8')) as Record<string, Array<Record<string, unknown>>>;
  const open = fixture[`repos/${REPO}/issues?state=open&per_page=100`] ?? [];
  const i2 = open.find((i) => i.number === 2) as Record<string, unknown>;
  const i3 = open.find((i) => i.number === 3) as Record<string, unknown>;
  i2.comments = 3;
  fixture[`repos/${REPO}/issues/2/comments?per_page=100`]?.push({ id: 2003, user: { login: 'carol' }, created_at: '2026-01-05T08:00:00Z', body: 'One more thing.' });
  (i3.labels as Array<{ name: string }>).push({ name: 'ui' });
  await writeFile(env.fixture, JSON.stringify(fixture));

  const fourth = await runImport(root, env);
  assert.deepEqual([fourth.created, fourth.updated, fourth.unchanged, fourth.comments_added], [0, 2, 2, 1]);
  const after = await snapshot(root);
  assert.deepEqual([...after.keys()], [...files.keys()], 'updated in place: same ids, same files');
  const parse2 = byIssue(after, 2);
  const render2 = byIssue(after, 3);
  assert.equal(parse2.text.split('### ').length - 1, 4, 'the escaped body line, two old comments and the new one');
  assert.match(parse2.text, /### alice · 2026-01-03T10:30:00Z\n\n<!-- github-comment: 2002 -->\n\nLooks good\.\n\n### carol · 2026-01-05T08:00:00Z\n\n<!-- github-comment: 2003 -->\n\nOne more thing\.\n$/);
  assert.deepEqual(render2.fm.labels, ['ready-for-agent', 'ui']);
  assert.notEqual(render2.fm.updated, render.fm.updated);
  assert.equal(render2.fm.created, render.fm.created);
  assert.equal(after.get(epic.name), files.get(epic.name), 'an unchanged issue keeps its file byte for byte');
  assert.equal(after.get(map.name), files.get(map.name));

  // ---- --all brings the closed issue in, and the loose edge to it resolves
  const fifth = await runImport(root, env, '--all');
  assert.deepEqual([fifth.created, fifth.updated, fifth.unchanged, fifth.comments_added], [1, 1, 3, 1]);
  const final = await snapshot(root);
  const spike = byIssue(final, 4);
  assert.equal(spike.fm.state, 'closed');
  assert.equal(spike.fm.kind, 'question');
  assert.match(spike.text, /### carol · 2026-01-04T12:00:00Z\n\n<!-- github-comment: 4001 -->\n\nDone, see the notes\.\n$/);
  assert.deepEqual(byIssue(final, 3).fm.blocked_by, [idOf(parse), spike.fm.id]);
});

test('import-github needs a running hub, and a GitHub repository to read', async (t) => {
  const root = await tempProject(t, 'cland-import-');
  const env = { fixture: join(root, 'none.json'), log: join(root, 'gh-calls.log') };
  const noHub = await cland(root, env, 'task', 'import-github', '--repo', REPO);
  assert.equal(noHub.code, 1);
  assert.match(noHub.stderr, /no hub running/);

  await startDaemon(t, root);
  const noRemote = await cland(root, env, 'task', 'import-github');
  assert.equal(noRemote.code, 1);
  assert.match(noRemote.stderr, /pass --repo owner\/name/);

  const ghFails = await cland(root, env, 'task', 'import-github', '--repo', REPO);
  assert.equal(ghFails.code, 1);
  assert.match(ghFails.stderr, /reading acme\/widgets from GitHub/);
});
