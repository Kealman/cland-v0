// The qa skill and the QA brief (T-62, spec 4.10): the shipped cases carry their catalogue header, the skill is in the
// QA and Coordinator skill lists, and the skill's command sequence — `qa-record.sh` running cases and noting checks,
// then the verdict through the hub — runs for real: the headless workbench for the cases, a real hub daemon in a
// temporary project for the verdict. No LLM runs; the skill's text is the contract, and the live run (a Codex QA
// session, a rescue run) is recorded on the item.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { nvimOrSkip } from '../../nvim/test/harness.ts';
import { CLI_ENTRY, cland, spawnSpoke, startDaemon, tempProject } from './harness.ts';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SKILL = join(REPO, '.agents', 'skills', 'qa');
const RECORD = join(SKILL, 'qa-record.sh');
const hasJq = spawnSync('jq', ['--version']).status === 0;
const nvim = await nvimOrSkip();
const skipRun = 'skip' in nvim ? nvim.skip : !hasJq && 'needs jq';

const HEADER_FIELDS = ['id', 'title', 'preconditions', 'expected', 'since', 'regression'];

test('QA findings outside the tested item are filed into Bugs by the Coordinator', async t => {
  const text = await readFile(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(text, /outside the item under test.*bug found aside/);
  assert.match(text, /--parent C-<n> --label qa-found --label needs-triage/);
  assert.match(text, /category Bugs/);
  const root = await tempProject(t);
  await startDaemon(t, root);
  const category = await cland(root, 'task', 'create', 'Bugs', '--kind', 'category', '--json');
  assert.equal(category.code, 0, category.stderr);
  const parent = (JSON.parse(category.stdout) as { item: { id: string } }).item.id;
  const filed = await cland(root, 'task', 'create', 'Aside finding', '--parent', parent, '--label', 'qa-found', '--label', 'needs-triage', '--body', 'CASE-1 at abc123: cland crew show reported an error.', '--json');
  assert.equal(filed.code, 0, filed.stderr);
  const item = (JSON.parse(filed.stdout) as { item: { parent: string; labels: string[] } }).item;
  assert.equal(item.parent, parent);
  assert.deepEqual(item.labels, ['qa-found', 'needs-triage']);
});

type RunLine = { ts: string; item: string; run: string; case: string; build: string; surface: string; method: string; result: string; exit_code: number; evidence: string[]; session: string };

/** `qa-record.sh <args>` from the repository root, as a QA session would run it from the item's worktree. */
function record(hubFile: string, env: Record<string, string>, ...args: string[]): { code: number | null; stdout: string; stderr: string } {
  // as `sh <script>`, as the skill says: `cland init` copies the skill without its executable bit
  const r = spawnSync('sh', [RECORD, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 120_000,
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '', CLAND: CLI_ENTRY, CLAND_HUB_FILE: hubFile, CLAND_SESSION_NAME: 'qa-1', ...env },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('every shipped case opens with its catalogue header: id (the file name), title, preconditions, expected, since, regression', async () => {
  const dir = join(REPO, 'qa', 'cases');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.lua'));
  assert.ok(files.length >= 2, 'the shipped cases');
  for (const file of files) {
    const text = await readFile(join(dir, file), 'utf8');
    const header = new Map<string, string>();
    for (const line of text.split('\n')) {
      const m = /^-- ([a-z]+): (.+)$/.exec(line);
      if (!m) break;
      header.set(m[1] as string, m[2] as string);
    }
    assert.deepEqual([...header.keys()], HEADER_FIELDS, `${file} opens with the header fields, in order`);
    assert.equal(header.get('id'), file.replace(/\.lua$/, ''), `${file}: id is the file name`);
    assert.match(header.get('regression') as string, /^(yes|no)$/, `${file}: regression is yes or no`);
  }
});

test('the qa skill is in the QA and Coordinator skill lists of the default roles.toml, and its files are there', async () => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  assert.ok(roles.get('qa')?.skills.includes('qa'), 'QA has the qa skill');
  assert.ok(roles.get('coordinator')?.skills.includes('qa'), 'the Coordinator has the qa skill');
  for (const role of ['qa', 'coordinator']) assert.match(roles.get(role)?.clause ?? '', /qa\/briefs\/T-<n>\.md/, `the ${role} clause names the brief`);
  assert.match(await readFile(join(SKILL, 'SKILL.md'), 'utf8'), /^---\nname: qa\n/);
  accessSync(RECORD, constants.R_OK);
  // the brief template and the shipped brief have the same sections, and the shipped brief names cases that exist
  const section = (text: string) => [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const template = await readFile(join(SKILL, 'BRIEF.md'), 'utf8');
  const brief = await readFile(join(REPO, 'qa', 'briefs', 'T-62.md'), 'utf8');
  assert.deepEqual(section(brief), section(template));
  // self-contained: the build is resolved by a rule in the brief, never by what a request says
  for (const text of [brief, template]) {
    assert.match(text, /tip of that branch when the run starts/);
    assert.doesNotMatch(text, /commit the request names/);
  }
  for (const id of [...brief.matchAll(/^\| `([A-Z]+-\d+)` \|/gm)].map((m) => m[1])) accessSync(join(REPO, 'qa', 'cases', `${id}.lua`), constants.R_OK);
});

test('a brief of two cases: runs.jsonl gets one full line per case, a BLOCKED case makes the verdict not clear and names it, the item shows it', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await startDaemon(t, root);
  const hubFile = join(root, '.cland', 'hub.json');
  const created = await cland(root, 'task', 'create', 'A fixture item', '--json');
  assert.equal(created.code, 0, created.stderr);

  const run = 'qa-2026-10-09-1';
  const first = record(hubFile, {}, 'run', 'T-1', run, 'SHELL-001');
  assert.equal(first.code, 0, first.stderr + first.stdout);
  assert.match(first.stderr, /recorded in .*\.cland\/qa\/runs\.jsonl/);
  // the second case does not exist: BLOCKED, exit 2, still a line
  const second = record(hubFile, {}, 'run', 'T-1', run, 'NOPE-404');
  assert.equal(second.code, 2, second.stderr + second.stdout);
  const manual = record(hubFile, {}, 'note', 'T-1', run, 'M1', 'hub-api', 'cland task list --state open', 'PASS', join(root, '.cland', 'qa', 'T-1', run, 'M1.txt'));
  assert.equal(manual.code, 0, manual.stderr);

  const lines = (await readFile(join(root, '.cland', 'qa', 'runs.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as RunLine);
  assert.equal(lines.length, 3);
  for (const line of lines) assert.deepEqual(Object.keys(line), ['ts', 'item', 'run', 'case', 'build', 'surface', 'method', 'result', 'exit_code', 'evidence', 'session']);
  const [pass, blocked, note] = lines as [RunLine, RunLine, RunLine];
  assert.match(pass.ts, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual([pass.item, pass.run, pass.case, pass.surface, pass.result, pass.exit_code, pass.session], ['T-1', run, 'SHELL-001', 'headless-grid', 'PASS', 0, 'qa-1']);
  assert.equal(pass.method, 'cland --headless --qa qa/cases/SHELL-001.lua');
  assert.match(pass.build, /^[0-9a-f]{7,}$/);
  assert.deepEqual(pass.evidence, [`.cland/qa/T-1/${run}/SHELL-001.screen.txt`, `.cland/qa/T-1/${run}/SHELL-001.state.json`]);
  assert.match(await readFile(join(root, pass.evidence[0] as string), 'utf8'), /General/);
  assert.deepEqual([blocked.case, blocked.result, blocked.exit_code], ['NOPE-404', 'BLOCKED', 2]);
  assert.deepEqual([note.case, note.surface, note.method, note.result, note.exit_code, note.evidence], ['M1', 'hub-api', 'cland task list --state open', 'PASS', 0, [`.cland/qa/T-1/${run}/M1.txt`]]);

  // the verdict, as the QA session writes it: not clear, naming the case, through the hub
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
  t.after(() => qa.close());
  await qa.waitForPresence(['qa-1']);
  const text = '| case | surface | result |\n| --- | --- | --- |\n| SHELL-001 | headless-grid | PASS |\n| NOPE-404 | headless-grid | BLOCKED |\n\nnot clear: NOPE-404 is BLOCKED (no such case).';
  const written = await qa.call<{ ok: boolean }>('task.comment', { id: 'T-1', text, verdict: 'qa', result: 'not clear', run });
  assert.equal(written.ok, true);
  const view = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { verdicts: Array<{ verdict: string; result: string; run: string; by: string }>; comments: Array<{ text: string }> } };
  assert.deepEqual(view.item.verdicts.map((v) => [v.verdict, v.result, v.run, v.by]), [['qa', 'not clear', run, 'qa-1 [qa]']]);
  assert.match(view.item.comments.at(-1)?.text ?? '', /NOPE-404/);
  const listed = JSON.parse((await cland(root, 'task', 'list', '--verdict', 'qa=not clear', '--json')).stdout) as { items: Array<{ id: string }> };
  assert.deepEqual(listed.items.map((i) => i.id), ['T-1']);
});

test('a run that cannot write .cland/qa (a rescue run) still prints the line and says it was not recorded; bad arguments are refused', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  // `qa` is a file, so no directory can be made there
  await writeFile(join(root, '.cland', 'qa'), 'in the way');
  const r = record(join(root, '.cland', 'hub.json'), { CLAND_SESSION_NAME: '' }, 'note', 'T-9', 'rescue-job-1', 'M1', 'tmux', 'tmux capture-pane -p', 'FAIL');
  assert.equal(r.code, 1);
  const line = JSON.parse(r.stdout.trim()) as RunLine;
  assert.deepEqual([line.item, line.case, line.surface, line.result, line.exit_code, line.evidence], ['T-9', 'M1', 'tmux', 'FAIL', 1, []]);
  assert.match(r.stderr, /NOT recorded/);
  for (const bad of [['run', 'nope', 'r', 'C-1'], ['note', 'T-1', 'r', 'M1', 'phone', 'x', 'PASS'], ['note', 'T-1', 'r', 'M1', 'tmux', 'x', 'MAYBE'], ['run', 'T-1', 'r']]) {
    assert.equal(record(join(root, '.cland', 'hub.json'), {}, ...bad).code, 64, bad.join(' '));
  }
});

test('a verdict that fails after the lines are appended leaves the lines; the verdict is written again with the same run, and the cases are not rerun', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await startDaemon(t, root);
  const hubFile = join(root, '.cland', 'hub.json');
  assert.equal((await cland(root, 'task', 'create', 'A fixture item', '--json')).code, 0);
  const run = 'qa-2026-10-09-2';
  assert.equal(record(hubFile, {}, 'run', 'T-1', run, 'SHELL-001').code, 0);
  const runs = join(root, '.cland', 'qa', 'runs.jsonl');
  const before = await readFile(runs, 'utf8');

  // step 3 fails: the writer does not hold the QA role, so the hub refuses the verdict
  const impostor = await spawnSpoke({ discover: true, cwd: root, name: 'impl-9', sessionId: 'impl-id', role: 'implementer' });
  t.after(() => impostor.close());
  await impostor.waitForPresence(['impl-9']);
  const refused = await impostor.call<{ ok?: boolean; error?: string }>('task.comment', { id: 'T-1', text: 'clear', verdict: 'qa', result: 'clear', run }).catch((err: unknown): { ok?: boolean; error?: string } => ({ error: String(err) }));
  assert.ok(refused.ok !== true, 'the verdict is refused');
  assert.equal(await readFile(runs, 'utf8'), before, 'the line stays, untouched');
  const none = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { verdicts: unknown[] } };
  assert.deepEqual(none.item.verdicts, []);

  // finish from there: only the verdict, by the QA session, with the same run id
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
  t.after(() => qa.close());
  await qa.waitForPresence(['qa-1']);
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: 'T-1', text: '| SHELL-001 | PASS |', verdict: 'qa', result: 'clear', run })).ok, true);
  assert.equal(await readFile(runs, 'utf8'), before, 'no case was rerun: still one line');
  const view = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { verdicts: Array<{ result: string; run: string }> } };
  assert.deepEqual(view.item.verdicts.map((v) => [v.result, v.run]), [['clear', run]]);
});

test('where .cland/qa cannot be written the evidence goes to the temp dir and the line names it; QA_SESSION names the session', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'qa'), 'in the way');
  const tmp = await tempProject(t, 'cland-qa-tmp-');
  const r = record(join(root, '.cland', 'hub.json'), { TMPDIR: tmp, QA_SESSION: 'rescue-job-7' }, 'run', 'T-1', 'rescue-1', 'SHELL-001');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const line = JSON.parse(r.stdout.trim()) as RunLine;
  assert.equal(line.session, 'rescue-job-7');
  assert.deepEqual(line.evidence, [join(tmp, 'cland-qa-evidence', 'T-1', 'rescue-1', 'SHELL-001.screen.txt'), join(tmp, 'cland-qa-evidence', 'T-1', 'rescue-1', 'SHELL-001.state.json')]);
  assert.match(r.stderr, /NOT recorded/);
});

test('ids that could leave the evidence tree or name nothing are refused before anything is written', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  const hubFile = join(root, '.cland', 'hub.json');
  const bad: Array<[string, string, string]> = [
    ['T-1/../../x', 'r1', 'C-1'], ['T-', 'r1', 'C-1'], ['T-1a', 'r1', 'C-1'], ['T-../x', 'r1', 'C-1'], ['x', 'r1', 'C-1'], ['T-1 ', 'r1', 'C-1'],
    ['T-1', '', 'C-1'], ['T-1', '.', 'C-1'], ['T-1', '..', 'C-1'], ['T-1', '.hidden', 'C-1'], ['T-1', '-r', 'C-1'], ['T-1', 'a/b', 'C-1'], ['T-1', '../x', 'C-1'], ['T-1', 'a b', 'C-1'], ['T-1', 'r*', 'C-1'],
    ['T-1', 'r1', ''], ['T-1', 'r1', '.'], ['T-1', 'r1', '..'], ['T-1', 'r1', '.x'], ['T-1', 'r1', 'a/b'], ['T-1', 'r1', '../../x'],
  ];
  for (const [item, run, id] of bad) {
    for (const args of [['run', item, run, id], ['note', item, run, id, 'hub-api', 'cmd', 'PASS']]) {
      const r = record(hubFile, {}, ...args);
      assert.equal(r.code, 64, `${JSON.stringify(args)} exits ${r.code}: ${r.stderr}`);
      assert.equal(r.stdout, '', `${JSON.stringify(args)} prints no line`);
    }
  }
  assert.deepEqual(await readdir(join(root, '.cland')), [], 'nothing was created');
  // the accepted shapes
  for (const [run, id] of [['qa-2026-10-09-1', 'SHELL-001'], ['r.1_a', 'M1'], ['1', '2']]) {
    assert.equal(record(hubFile, {}, 'note', 'T-12', run as string, id as string, 'hub-api', 'cmd', 'PASS').code, 0, `${run} ${id}`);
  }
});

test('a project path with spaces and a glob character stays one argument: the case runs and its evidence is where the line says', { skip: skipRun }, async (t) => {
  const base = await tempProject(t, 'cland-qa-skill-');
  const root = join(base, 'a project [x] *glob');
  await mkdir(join(root, '.cland'), { recursive: true });
  const r = record(join(root, '.cland', 'hub.json'), {}, 'run', 'T-3', 'r1', 'SHELL-001');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const line = JSON.parse(r.stdout.trim()) as RunLine;
  assert.deepEqual(line.evidence, ['.cland/qa/T-3/r1/SHELL-001.screen.txt', '.cland/qa/T-3/r1/SHELL-001.state.json']);
  for (const e of line.evidence) assert.ok((await stat(join(root, e))).size > 0, e);
  assert.equal((await readFile(join(root, '.cland', 'qa', 'runs.jsonl'), 'utf8')).trim().split('\n').length, 1);
  // ... and the temp-dir fallback, whose path has them too
  const blocked = join(base, 'another project [y]');
  await mkdir(join(blocked, '.cland'), { recursive: true });
  await writeFile(join(blocked, '.cland', 'qa'), 'in the way');
  const tmp = join(base, 'tmp dir [z] ?');
  await mkdir(tmp, { recursive: true });
  const fallback = record(join(blocked, '.cland', 'hub.json'), { TMPDIR: tmp }, 'run', 'T-3', 'r2', 'SHELL-001');
  assert.equal(fallback.code, 0, fallback.stderr + fallback.stdout);
  for (const e of (JSON.parse(fallback.stdout.trim()) as RunLine).evidence) assert.ok(e.startsWith(join(tmp, 'cland-qa-evidence')) && (await stat(e)).size > 0, e);
});

test('a line that cannot be serialized is never appended: exit 70, the outcome and the captures named on stderr, the captures kept', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  // a jq that works until the line is built (the only call with --argjson), then fails like a broken one
  const bin = await tempProject(t, 'cland-qa-fakejq-');
  const real = spawnSync('sh', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
  await writeFile(join(bin, 'jq'), `#!/bin/sh\ncase " $* " in *" --argjson "*) exit 5;; esac\nexec "${real}" "$@"\n`);
  await chmod(join(bin, 'jq'), 0o755);
  const r = record(join(root, '.cland', 'hub.json'), { PATH: `${bin}:${process.env.PATH ?? ''}` }, 'run', 'T-4', 'r1', 'SHELL-001');
  assert.equal(r.code, 70, r.stderr + r.stdout);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /could not serialize.*nothing appended.*T-4 r1 SHELL-001 PASS \(exit 0\).*\.cland\/qa\/T-4\/r1/);
  assert.ok((await stat(join(root, '.cland', 'qa', 'T-4', 'r1', 'SHELL-001.screen.txt'))).size > 0, 'the captures stay');
  assert.equal(await readFile(join(root, '.cland', 'qa', 'runs.jsonl'), 'utf8').catch(() => null), null, 'no line, not even an empty one');
});

/** A rescue run's output for a recovery: a captures directory with the files, and the lines file naming them. */
async function rescued(t: TestContext, item: string, run: string, cases: string[]) {
  const captures = await tempProject(t, 'cland-qa-captures-');
  const lines: string[] = [];
  for (const c of cases) {
    await writeFile(join(captures, `${c}.screen.txt`), `grid of ${c}\n`);
    await writeFile(join(captures, `${c}.state.json`), '{}\n');
    lines.push(JSON.stringify({ ts: '2026-10-09T15:26:18Z', item, run, case: c, build: 'abc1234', surface: 'headless-grid', method: `cland --headless --qa qa/cases/${c}.lua`, result: 'PASS', exit_code: 0, evidence: [join(captures, `${c}.screen.txt`), join(captures, `${c}.state.json`)], session: 'rescue-job' }));
  }
  const linesFile = join(captures, 'lines.jsonl');
  await writeFile(linesFile, lines.join('\n') + '\n');
  return { captures, linesFile, lines };
}
const appended = async (root: string): Promise<RunLine[]> => (await readFile(join(root, '.cland', 'qa', 'runs.jsonl'), 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as RunLine);

test('recover: every capture is copied and verified before its line is appended, with the evidence paths rewritten into the durable tree; sources stay', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  const { captures, linesFile } = await rescued(t, 'T-5', 'rescue-1', ['SHELL-001', 'ITEMS-001']);
  const r = record(join(root, '.cland', 'hub.json'), {}, 'recover', 'T-5', 'rescue-1', captures, linesFile);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /2 line\(s\) appended, 0 not appended/);
  const lines = await appended(root);
  assert.deepEqual(lines.map((l) => l.case), ['SHELL-001', 'ITEMS-001']);
  assert.deepEqual(lines[0]?.evidence, ['.cland/qa/T-5/rescue-1/SHELL-001.screen.txt', '.cland/qa/T-5/rescue-1/SHELL-001.state.json']);
  assert.equal(await readFile(join(root, '.cland/qa/T-5/rescue-1/ITEMS-001.screen.txt'), 'utf8'), 'grid of ITEMS-001\n');
  assert.equal(await readFile(join(captures, 'ITEMS-001.screen.txt'), 'utf8'), 'grid of ITEMS-001\n', 'the source is untouched');
});

test('recover: the evidence directory cannot be made: exit 71, nothing copied or appended, the sources and the lines named', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'qa'), 'in the way');
  const { captures, linesFile } = await rescued(t, 'T-5', 'rescue-1', ['SHELL-001']);
  const r = record(join(root, '.cland', 'hub.json'), {}, 'recover', 'T-5', 'rescue-1', captures, linesFile);
  assert.equal(r.code, 71, r.stderr);
  assert.match(r.stderr, /nothing appended, nothing copied.*stay in .*lines in /);
  assert.equal(await readFile(join(root, '.cland', 'qa'), 'utf8'), 'in the way');
  assert.equal(await readFile(join(captures, 'SHELL-001.screen.txt'), 'utf8'), 'grid of SHELL-001\n');
});

test('recover: a copy that fails, a capture that is missing, a conflicting file and a line of another run each leave that line out, name it, keep the sources and exit 73; the good line is still appended', { skip: skipRun || (process.getuid?.() === 0 && 'root reads anything') }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland', 'qa', 'T-5', 'rescue-1'), { recursive: true });
  const { captures, linesFile, lines } = await rescued(t, 'T-5', 'rescue-1', ['GOOD-001', 'COPY-001', 'GONE-001', 'CLASH-001']);
  await chmod(join(captures, 'COPY-001.screen.txt'), 0o000);
  t.after(() => chmod(join(captures, 'COPY-001.screen.txt'), 0o644).catch(() => undefined));
  await writeFile(join(captures, 'GONE-001.state.json'), '{}\n');
  await rm(join(captures, 'GONE-001.screen.txt'));
  await writeFile(join(root, '.cland/qa/T-5/rescue-1/CLASH-001.screen.txt'), 'someone else\n');
  const other = JSON.stringify({ ...JSON.parse(lines[0] as string), run: 'other-run', case: 'OTHER-001' });
  await writeFile(linesFile, [...lines, other].join('\n') + '\n');
  const r = record(join(root, '.cland', 'hub.json'), {}, 'recover', 'T-5', 'rescue-1', captures, linesFile);
  assert.equal(r.code, 73, r.stderr);
  assert.match(r.stderr, /COPY-001: could not copy/);
  assert.match(r.stderr, /GONE-001: capture missing/);
  assert.match(r.stderr, /CLASH-001: .*already exists with other content/);
  assert.match(r.stderr, /line 5 is not a runs line of T-5 rescue-1/);
  assert.match(r.stderr, /1 line\(s\) appended, 4 not appended/);
  assert.deepEqual((await appended(root)).map((l) => l.case), ['GOOD-001']);
  for (const kept of ['GOOD-001.screen.txt', 'COPY-001.state.json', 'GONE-001.state.json', 'CLASH-001.screen.txt']) assert.ok((await stat(join(captures, kept))).size > 0, `${kept} stays`);
});

test('recover: a jq that fails where its empty output would read as "nothing to do" (the case, the evidence list, the rewrite) loses that line: exit 73, named, nothing copied or appended', { skip: skipRun }, async (t) => {
  const real = spawnSync('sh', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
  // each wrapper works until the call whose program holds `fails`, then fails like a broken jq
  for (const [fails, said] of [['(.evidence // [])[]', /could not read its evidence list/], ['.case', /could not read its case/], ['split("/")', /could not rewrite or append/]] as const) {
    const root = await tempProject(t, 'cland-qa-skill-');
    await mkdir(join(root, '.cland'), { recursive: true });
    const bin = await tempProject(t, 'cland-qa-fakejq-');
    // fails when an argument is, or holds, the marker program text (quoted, so it is literal)
    await writeFile(join(bin, 'jq'), `#!/bin/sh\nfor a in "$@"; do case "$a" in *'${fails}'*) exit 5;; esac; done\nexec "${real}" "$@"\n`);
    await chmod(join(bin, 'jq'), 0o755);
    const { captures, linesFile } = await rescued(t, 'T-6', 'rescue-1', ['SHELL-001']);
    const r = record(join(root, '.cland', 'hub.json'), { PATH: `${bin}:${process.env.PATH ?? ''}` }, 'recover', 'T-6', 'rescue-1', captures, linesFile);
    assert.equal(r.code, 73, `${fails}: ${r.stderr}`);
    assert.match(r.stderr, said, fails);
    assert.match(r.stderr, /0 line\(s\) appended, 1 not appended/);
    assert.deepEqual(await appended(root), [], `${fails}: no line, in particular not one without its captures`);
    assert.equal(await readFile(join(captures, 'SHELL-001.screen.txt'), 'utf8'), 'grid of SHELL-001\n', 'the source stays');
  }
});

test('the skill documents the recovery command and both evidence-directory failures', async () => {
  const text = await readFile(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(text, /qa-record\.sh recover T-<n> <run> <captures-dir> lines\.jsonl/);
  assert.match(text, /Neither directory can be written/);
  assert.match(text, /cannot be written: the script keeps the captures/);
  assert.match(text, /every block the script printed on stderr after `no evidence directory could be made`, verbatim/);
});

test('the build rule honours a request naming the tip and blocks one naming another commit, in the template and the brief', async () => {
  for (const file of [join(SKILL, 'BRIEF.md'), join(REPO, 'qa', 'briefs', 'T-62.md')]) {
    assert.match(await readFile(file, 'utf8'), /honoured when it equals HEAD; when it differs, record `BLOCKED` naming both commits/);
  }
});
