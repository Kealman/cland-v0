// T3: native Codex review and QA request/verdict round trip.
import { ownDirectory } from './process-cleanup.ts';

// Review and QA through the roles (spec 4.10 and 6 (g), #41): the Coordinator sends a review or QA request through
// the hub to the session holding Reviewer or QA; that session, a Codex launched for the role (its first turn is the
// role's clause from roles.toml), writes its verdict on the item with `task.comment` and reports back with `send`.
// A session holding neither role is refused the verdict by the hub. Against a real daemon in a temporary project:
// the fake Codex (`test/fakes/codex`, first on the PATH) in its scripted review/QA mode, the Coordinator as a
// scripted spoke over MCP, the UI on the Unix socket, the `cland task` CLI as its own process.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cland, connectUi, killDaemon, pidAlive, spawnSpoke, startDaemon, tempProject, type ChannelEvent, type FrameClient, type Session } from './harness.ts';

const FAKE_CODEX_DIR = fileURLToPath(new URL('./fakes/codex', import.meta.url));

type Verdict = { verdict: string; result: string; by: string; run: string };

type ItemView = { item: { id: string; verdicts: Verdict[]; comments: Array<{ author: string; text: string; verdict?: Verdict }> } };

type Launched = { name: string; harness: string; model: string | null; pid: number | null; role: string | null };

type Script = { result: 'clear' | 'not clear'; text: string; run: string };

const ok = (r: { code: number | null; stdout: string; stderr: string }) => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

const view = async (root: string, id: string) => JSON.parse(ok(await cland(root, 'task', 'view', id, '--json')).stdout) as ItemView;

const listed = async (root: string, filter: string) => (JSON.parse(ok(await cland(root, 'task', 'list', '--verdict', filter, '--json')).stdout) as { items: Array<{ id: string }> }).items.map((i) => i.id);

/** The fake Codex on the PATH, with its scripted verdicts written to `verdicts.json`. */
async function fakeCodex(t: TestContext, verdicts: Partial<Record<'review' | 'qa', Script>>) {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-codex-')));
  const cleanupHome = ownDirectory(undefined, home);
  await writeFile(join(home, 'verdicts.json'), JSON.stringify(verdicts));
  const env = { PATH: `${FAKE_CODEX_DIR}:${process.env.PATH ?? ''}`, FAKE_CODEX_HOME: home, FAKE_CODEX_TURN_MS: '30', FAKE_CODEX_REFUSE_MS: '150', CLAND_ADAPTER_POLL_MS: '50', CLAND_INJECT_TIMEOUT_MS: '5000' };
  const pids = async () => {
    const files = await readdir(join(home, 'servers')).catch(() => [] as string[]);
    return (await Promise.all(files.map(async (f) => (JSON.parse(await readFile(join(home, 'servers', f), 'utf8')) as { pid: number }).pid))).filter(pidAlive);
  };
  t.after(async () => {
    for (const pid of await pids()) await killDaemon(pid);
    await cleanupHome();
  });
  return { env, log: (pid: number) => readFile(join(home, 'log', `${pid}.log`), 'utf8').catch(() => '') };
}

async function setup(t: TestContext, verdicts: Partial<Record<'review' | 'qa', Script>>) {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, verdicts);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Review and QA smoke: the cland task CLI', '--body', 'Check that `cland task list --state open` lists this item.'));
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'sess-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  return { root, fake, ui, coord };
}

/** A launch for the role through the hub, as the Coordinator's `session.launch` or the UI would: roles.toml fills the rest. */
async function launch(ui: FrameClient, name: string, role: string, extra: Record<string, unknown> = {}): Promise<Launched> {
  const r = await ui.request({ type: 'session.launch', name, role, ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Launched }).process;
}

/** The Coordinator's request: the conventional first line, then what to check. */
async function request(coord: Session, kind: 'review' | 'qa', to: string, item: string, what: string): Promise<void> {
  const r = await coord.call<{ ok: boolean; error?: string }>('send', { to: [to], text: `${kind} request ${item}\n${what}` });
  assert.equal(r.ok, true, JSON.stringify(r));
}

const reportFrom = (coord: Session, from: string, prefix: string) =>
  coord.waitForEvent((e: ChannelEvent) => e.params.meta?.from === from && e.params.content.includes(prefix), 20_000);

test('a review request from the Coordinator reaches the Codex session holding Reviewer; its verdict lands on the item with the header and the report comes back; the same for QA', async (t) => {
  const { root, fake, ui, coord } = await setup(t, {
    review: { result: 'clear', run: 'rev-run-1', text: 'Findings, by severity:\n- low: hub/src/cli/task.ts:12 the help line is long' },
    qa: { result: 'not clear', run: 'qa-run-1', text: 'Ran: cland task list --state open; a headless Neovim.\nFindings, by severity:\n- high: nvim/lua/cland/init.lua:40 General is not shown' },
  });

  // launched for its role: harness and model come from roles.toml, the first turn is the role's clause
  const rev = await launch(ui, 'rev', 'reviewer');
  assert.deepEqual([rev.harness, rev.model, rev.role], ['codex', 'gpt-6.1-sol', 'reviewer']);
  const qa = await launch(ui, 'qa-1', 'qa');
  assert.deepEqual([qa.harness, qa.model, qa.role], ['codex', 'gpt-6-astra', 'qa']);
  await coord.waitForPresence(['rev', 'qa-1']);
  const revLog = await fake.log(rev.pid as number);
  assert.match(revLog, /item: cland hub: you hold the role Reviewer in this project, shown to others as rev \[Reviewer\]/);
  assert.match(revLog, /verdict: review/, 'the Reviewer clause carries the verdict header');
  assert.match(await fake.log(qa.pid as number), /item: cland hub: you hold the role QA[\s\S]*Follow the `qa` skill’s verdict procedure/);

  // review: addressed to the role, as the Coordinator would; the report comes back to the Coordinator
  await request(coord, 'review', 'reviewer', 'T-1', 'Check that `cland task list --state open` lists the item.');
  const reviewReport = await reportFrom(coord, 'rev', 'review ');
  assert.match(reviewReport.params.content, /(?:^|\n)review clear T-1 \(run rev-run-1\)(?:\n|$)/);
  assert.match(reviewReport.params.content, /event · task · T-1 verdict posted review clear · full · rev-run-1/);
  assert.equal(reviewReport.params.meta?.from_role, 'reviewer');
  let item = (await view(root, 'T-1')).item;
  assert.deepEqual(item.verdicts.map((v) => [v.verdict, v.result, v.by, v.run]), [['review', 'clear', 'rev [reviewer]', 'rev-run-1']]);
  assert.match(item.comments.at(-1)?.text ?? '', /^Findings, by severity:\n- low: hub\/src\/cli\/task\.ts:12/);
  assert.deepEqual(await listed(root, 'review=clear'), ['T-1']);
  assert.deepEqual(await listed(root, 'review=not clear'), []);

  // QA: addressed by name this time
  await request(coord, 'qa', 'qa-1', 'T-1', 'Check the CLI and that a headless Neovim shows General.');
  const qaReport = await reportFrom(coord, 'qa-1', 'qa ');
  assert.match(qaReport.params.content, /(?:^|\n)qa not clear T-1 \(run qa-run-1\)(?:\n|$)/);
  assert.match(qaReport.params.content, /event · task · T-1 verdict posted qa not clear · qa-run-1/);
  item = (await view(root, 'T-1')).item;
  assert.deepEqual(item.verdicts.map((v) => [v.verdict, v.result, v.by]), [['review', 'clear', 'rev [reviewer]'], ['qa', 'not clear', 'qa-1 [qa]']]);
  assert.deepEqual(await listed(root, 'qa=not clear'), ['T-1']);
  assert.deepEqual(await listed(root, 'review=clear'), ['T-1'], 'the QA verdict leaves the review verdict standing');

  // `cland task view` shows both; the item's file holds the header as the hub wrote it
  const shown = ok(await cland(root, 'task', 'view', 'T-1')).stdout;
  assert.match(shown, /rev · \S+ {2}\[verdict review: clear, by rev \[reviewer\], run rev-run-1, scope full\]/);
  assert.match(shown, /qa-1 · \S+ {2}\[verdict qa: not clear, by qa-1 \[qa\], run qa-run-1\]/);
  const files = await readdir(join(root, '.cland', 'tasks'));
  const file = await readFile(join(root, '.cland', 'tasks', files.find((f) => f.startsWith('T-1-')) as string), 'utf8');
  assert.match(file, /\nverdict: review\nresult: clear\nby: rev \[reviewer\]\nrun: rev-run-1\nscope: full\n\nFindings, by severity:/);
  assert.match(file, /\nverdict: qa\nresult: not clear\nby: qa-1 \[qa\]\nrun: qa-run-1\n\nRan:/);
});
