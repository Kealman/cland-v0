// T2: qa-record.sh is the CLI subject; projectHub and inProcessSpoke prove
// verdict rules. Headless output is a protocol fixture; native Neovim/stdio
// execution is covered by nvim/test/qa.test.ts.
import { fixtureEnvironment } from './fixture-environment.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandCliLaunch } from './tier-cli.ts';
import { cland, inProcessSpoke, projectHub, tempProject } from './harness.ts';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SKILL = join(REPO, '.agents', 'skills', 'qa');
const RECORD = join(SKILL, 'qa-record.sh');
// Availability is a PATH/filesystem fact; qa-record.sh itself checks jq at run time.
async function jqOnPath(): Promise<string | undefined> {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const path = resolve(directory || '.', 'jq');
    if (await stat(path).then(info => info.isFile(), () => false)
      && await access(path, constants.X_OK).then(() => true, () => false)) return path;
  }
}
const jq = await jqOnPath();
const skipRun = !jq && 'needs jq';
const HEADLESS = fileURLToPath(new URL('./skills-qa-headless-fixture.ts', import.meta.url));

test('QA filing CLI creates aside findings under the Bugs category', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const category = await cland(root, 'task', 'create', 'Bugs', '--kind', 'category', '--json');
  assert.equal(category.code, 0, category.stderr);
  const parent = (JSON.parse(category.stdout) as { item: { id: string } }).item.id;
  const filed = await cland(root, 'task', 'create', '--size', 'M', 'Aside finding', '--parent', parent, '--label', 'qa-found', '--label', 'needs-triage', '--body', 'CASE-1 at abc123: cland crew show reported an error.', '--json');
  assert.equal(filed.code, 0, filed.stderr);
  const item = (JSON.parse(filed.stdout) as { item: { parent: string; labels: string[] } }).item;
  assert.equal(item.parent, parent);
  assert.deepEqual(item.labels, ['qa-found', 'needs-triage']);
});

type RunLine = { ts: string; item: string; run: string; case: string; build: string; surface: string; method: string; result: string; exit_code: number; evidence: string[]; session: string };

test('QA recorder records real-browser notes with screenshot evidence without launching a browser', { skip: skipRun }, async t => {
  const root = await tempProject(t);
  const evidence = '.cland/qa/T-1011/qa-browser/WEB-001.png';
  await mkdir(join(root, '.cland/qa/T-1011/qa-browser'), { recursive: true });
  const capture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZsAAAAASUVORK5CYII=', 'base64');
  await writeFile(join(root, evidence), capture);
  const method = 'computer use: open local workbench page, capture screenshot, close tab';
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    clandCliLaunch(() => execFile('/bin/sh', [RECORD, 'note', 'T-1011', 'qa-browser', 'WEB-001', 'real-browser', method, 'PASS', evidence], {
      cwd: root, encoding: 'utf8', timeout: 10_000,
      env: fixtureEnvironment(root, { PATH: process.env.PATH }, { CLAND_HUB_FILE: join(root, '.cland/hub.json'), QA_SESSION: 'qa-browser' }),
    }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(error);
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    }));
  });
  assert.equal(result.code, 0, result.stderr);
  const receipt = await readFile(join(root, '.cland/qa/runs.jsonl'), 'utf8');
  assert.equal(receipt, result.stdout);
  const line = JSON.parse(receipt) as RunLine;
  assert.deepEqual([line.item, line.case, line.surface, line.method, line.result, line.exit_code, line.evidence],
    ['T-1011', 'WEB-001', 'real-browser', method, 'PASS', 0, [evidence]]);
  assert.deepEqual(await readFile(join(root, line.evidence[0]!)), capture);
});

/** Run the shipped recorder from a disposable checkout with sealed child environments. */
async function record(hubFile: string, env: Record<string, string>, ...args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const root = dirname(dirname(hubFile));
  return new Promise((resolve, reject) => clandCliLaunch(() => execFile('/bin/sh', [RECORD, ...args], {
    cwd: root, encoding: 'utf8', timeout: 120_000,
    env: fixtureEnvironment(root, process.env, { TMPDIR: root, CLAND: HEADLESS, CLAND_HUB_FILE: hubFile, CLAND_SESSION_NAME: 'qa-1', ...env }),
  }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') reject(error);
    else resolve({ code: error ? error.code as number : 0, stdout, stderr });
  })));
}

async function demoRecord(t: TestContext, result: Record<string, unknown>, captures = [{ name: 'grid.txt', text: 'General' }], extra: Record<string, string> = {}, stderr = '') {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const envelope = join(root, 'envelope.json');
  await writeFile(envelope, JSON.stringify({ result, captures: captures.map(({ name, text }) => ({ name, data: Buffer.from(text).toString('base64') })), code: 0, stderr, out: '/tmp/cland-demo-case-fixture' }));
  const recorded = await record(join(root, '.cland/hub.json'), { QA_DEMO_EPIC: 'E-1', FAKE_DEMO_ENVELOPE: envelope, ...extra }, 'run', 'E-1', 'demo-run', 'DEMO-001');
  const line = JSON.parse(await readFile(join(root, '.cland/qa/runs.jsonl'), 'utf8')) as RunLine;
  assert.deepEqual(JSON.parse(recorded.stdout), line, 'the durable receipt matches stdout');
  return { root, envelope, recorded, line };
}

test('demo recorder withholds PASS for missing independently declared facts and step errors', { skip: skipRun }, async t => {
  const manifestRoot = await tempProject(t);
  const manifest = join(manifestRoot, 'expected.json');
  await writeFile(manifest, JSON.stringify(['connected', 'finished']));
  for (const result of [
    { result: 'PASS', evidence: [], facts: { connected: true } },
    { result: 'PASS', evidence: [], facts: { connected: true, finished: true }, steps: [{ error: 'caught step failure' }] },
  ]) {
    const { line, recorded } = await demoRecord(t, result, [], { QA_EXPECTED_FACTS: manifest });
    assert.equal(recorded.code, 2);
    assert.equal(line.result, 'BLOCKED');
  }
});

test('demo recorder scans every decoded capture before copying or acknowledging publication', { skip: skipRun }, async t => {
  const fake = 'fixture'.repeat(10);
  for (const text of [`http://127.0.0.1/auth?token=${fake}`, ['sk', 'proj', fake].join('-')]) {
    const { root, envelope, recorded, line } = await demoRecord(t, { result: 'PASS', evidence: [] }, [{ name: 'safe.txt', text: 'safe' }, { name: 'unsafe.txt', text }]);
    assert.equal(recorded.code, 2);
    assert.equal(line.result, 'BLOCKED');
    assert.deepEqual(line.evidence, []);
    assert.equal((recorded.stdout + recorded.stderr).includes(fake), false);
    assert.deepEqual(await readdir(join(root, '.cland/qa/E-1/demo-run')), [], 'no partial publication');
    assert.equal(await stat(`${envelope}.cleaned`).then(() => true, () => false), false, 'source is kept for safe recovery');
  }
});

test('demo recorder preserves legacy results and publishes complete declared facts after verified copies', { skip: skipRun }, async t => {
  const manifestRoot = await tempProject(t);
  const manifest = join(manifestRoot, 'expected.json');
  await writeFile(manifest, JSON.stringify(['count', 'replayed']));
  for (const extra of [{}, { QA_EXPECTED_FACTS: manifest }]) {
    const result = { result: 'PASS', evidence: [], ...(extra.QA_EXPECTED_FACTS ? { facts: { count: 0, replayed: false } } : {}) };
    const { root, envelope, recorded, line } = await demoRecord(t, result, undefined, extra, 'safe diagnostic');
    assert.equal(recorded.code, 0, recorded.stderr);
    assert.equal(line.result, 'PASS');
    assert.deepEqual(line.evidence, ['.cland/qa/E-1/demo-run/grid.txt']);
    assert.equal(await readFile(join(root, line.evidence[0]!), 'utf8'), 'General');
    assert.equal(await readFile(`${envelope}.cleaned`, 'utf8'), 'acknowledged');
  }
});

test('demo recorder refuses secret metadata and stderr without leaking diagnostics', { skip: skipRun }, async t => {
  const fake = 'fixture'.repeat(10);
  const secret = `http://127.0.0.1/auth?token=${fake}`;
  for (const [detail, stderr] of [[{ message: secret }, ''], [{}, secret]] as const) {
    const { recorded, line } = await demoRecord(t, { result: 'PASS', evidence: [], ...detail }, [], {}, stderr);
    assert.equal(recorded.code, 2);
    assert.equal(line.result, 'BLOCKED');
    assert.equal((recorded.stdout + recorded.stderr).includes(fake), false);
  }
});

test('demo recorder scans parsed JSON metadata and stderr before publishing safe captures', { skip: skipRun }, async t => {
  const fake = 'opaque-fixture'.repeat(5);
  for (const whitespace of ['\t', '\n']) {
    const secret = `${['Bear', 'er'].join('')}${whitespace}${fake}`;
    for (const [detail, stderr] of [[{ message: secret }, ''], [{}, secret]] as const) {
      const { root, envelope, recorded, line } = await demoRecord(t, { result: 'PASS', evidence: [], ...detail }, undefined, {}, stderr);
      assert.equal(recorded.code, 2);
      assert.equal(line.result, 'BLOCKED');
      assert.deepEqual(line.evidence, []);
      assert.equal((recorded.stdout + recorded.stderr).includes(fake), false);
      assert.deepEqual(await readdir(join(root, '.cland/qa/E-1/demo-run')), [], 'no partial publication');
      assert.equal(await stat(`${envelope}.cleaned`).then(() => true, () => false), false, 'no cleanup acknowledgement');
    }
  }
  const safe = await demoRecord(t, { result: 'PASS', evidence: [], message: 'worker\tconnected' }, undefined, {}, 'safe\ndiagnostic');
  assert.equal(safe.recorded.code, 0);
  assert.equal(safe.line.result, 'PASS');
  assert.equal(await readFile(join(safe.root, safe.line.evidence[0]!), 'utf8'), 'General');
  assert.equal(await readFile(`${safe.envelope}.cleaned`, 'utf8'), 'acknowledged');
});

test('demo recorder collects native case facts sidecars through the actual remote envelope', { skip: skipRun }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await mkdir(join(root, 'bin'));
  await symlink(HEADLESS, join(root, 'bin/cland'));
  const manifest = join(root, 'expected.json');
  await writeFile(manifest, JSON.stringify(['count', 'replayed']));
  const recorded = await record(join(root, '.cland/hub.json'), { QA_DEMO_EPIC: 'E-1', QA_EXPECTED_FACTS: manifest, FAKE_DEMO_EXEC: '1', PATH: `${join(root, 'bin')}:${process.env.PATH ?? ''}` }, 'run', 'E-1', 'native-facts', 'DEMO-001');
  assert.equal(recorded.code, 0, recorded.stderr);
  const line = JSON.parse(await readFile(join(root, '.cland/qa/runs.jsonl'), 'utf8')) as RunLine;
  assert.equal(line.result, 'PASS');
  assert.deepEqual(line.evidence, ['.cland/qa/E-1/native-facts/DEMO-001.facts.json']);
  assert.deepEqual(JSON.parse(await readFile(join(root, line.evidence[0]!), 'utf8')), { facts: { count: 0, replayed: false }, steps: [{ error: null }] });
  const failed = await record(join(root, '.cland/hub.json'), { QA_DEMO_EPIC: 'E-1', QA_EXPECTED_FACTS: manifest, FAKE_DEMO_EXEC: '1', PATH: `${join(root, 'bin')}:${process.env.PATH ?? ''}` }, 'run', 'E-1', 'native-error', 'DEMO-ERROR-001');
  assert.equal(failed.code, 2);
  const receipt = JSON.parse(failed.stdout) as RunLine;
  assert.equal(receipt.result, 'BLOCKED');
  assert.deepEqual(receipt.evidence, []);
});

test('QA recorder preserves two case receipts and publishes their blocked verdict', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await projectHub(t, root);
  const hubFile = join(root, '.cland', 'hub.json');
  // rev-parse only needs a repository/ref; seed those filesystem facts without
  // native Git setup in T2. The recorder CLI still reads the ref through Git.
  const build = '0123456789abcdef0123456789abcdef01234567';
  await mkdir(join(root, '.git/objects'), { recursive: true });
  await mkdir(join(root, '.git/refs/heads'), { recursive: true });
  await writeFile(join(root, '.git/HEAD'), 'ref: refs/heads/dev\n');
  await writeFile(join(root, '.git/refs/heads/dev'), `${build}\n`);
  await writeFile(join(root, '.git/config'), '[core]\nrepositoryformatversion = 0\nbare = false\n');
  const created = await cland(root, 'task', 'create', '--size', 'M', 'A fixture item', '--json');
  assert.equal(created.code, 0, created.stderr);

  const run = 'qa-2026-10-09-1';
  const first = await record(hubFile, {}, 'run', 'T-1', run, 'SHELL-001');
  assert.equal(first.code, 0, first.stderr + first.stdout);
  assert.match(first.stderr, /recorded in .*\.cland\/qa\/runs\.jsonl/);
  // the second case does not exist: BLOCKED, exit 2, still a line
  const second = await record(hubFile, {}, 'run', 'T-1', run, 'NOPE-404');
  assert.equal(second.code, 2, second.stderr + second.stdout);
  const manual = await record(hubFile, {}, 'note', 'T-1', run, 'M1', 'hub-api', 'cland task list --state open', 'PASS', join(root, '.cland', 'qa', 'T-1', run, 'M1.txt'));
  assert.equal(manual.code, 0, manual.stderr);

  const lines = (await readFile(join(root, '.cland', 'qa', 'runs.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as RunLine);
  assert.equal(lines.length, 3);
  for (const line of lines) assert.deepEqual(Object.keys(line), ['ts', 'item', 'run', 'case', 'build', 'surface', 'method', 'result', 'exit_code', 'executor', 'lifetime_ms', 'cost_usd', 'evidence', 'session']);
  const [pass, blocked, note] = lines as [RunLine, RunLine, RunLine];
  assert.match(pass.ts, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual([pass.item, pass.run, pass.case, pass.surface, pass.result, pass.exit_code, pass.session], ['T-1', run, 'SHELL-001', 'headless-grid', 'PASS', 0, 'qa-1']);
  assert.equal(pass.method, 'cland --headless --qa qa/cases/SHELL-001.lua');
  assert.match(pass.build, /^[0-9a-f]{7,}$/);
  assert.equal(pass.build, build);
  assert.deepEqual(pass.evidence, [`.cland/qa/T-1/${run}/SHELL-001.screen.txt`, `.cland/qa/T-1/${run}/SHELL-001.state.json`]);
  assert.match(await readFile(join(root, pass.evidence[0] as string), 'utf8'), /General/);
  assert.deepEqual([blocked.case, blocked.result, blocked.exit_code], ['NOPE-404', 'BLOCKED', 2]);
  assert.deepEqual([note.case, note.surface, note.method, note.result, note.exit_code, note.evidence], ['M1', 'hub-api', 'cland task list --state open', 'PASS', 0, [`.cland/qa/T-1/${run}/M1.txt`]]);

  // the verdict, as the QA session writes it: not clear, naming the case, through the hub
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
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

test('QA recorder prints an unwritable rescue receipt and refuses bad arguments', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  // `qa` is a file, so no directory can be made there
  await writeFile(join(root, '.cland', 'qa'), 'in the way');
  const r = await record(join(root, '.cland', 'hub.json'), { CLAND_SESSION_NAME: '' }, 'note', 'T-9', 'rescue-job-1', 'M1', 'tmux', 'tmux capture-pane -p', 'FAIL');
  assert.equal(r.code, 1);
  const line = JSON.parse(r.stdout.trim()) as RunLine;
  assert.deepEqual([line.item, line.case, line.surface, line.result, line.exit_code, line.evidence], ['T-9', 'M1', 'tmux', 'FAIL', 1, []]);
  assert.match(r.stderr, /NOT recorded/);
  for (const bad of [['run', 'nope', 'r', 'C-1'], ['note', 'T-1', 'r', 'M1', 'phone', 'x', 'PASS'], ['note', 'T-1', 'r', 'M1', 'tmux', 'x', 'MAYBE'], ['run', 'T-1', 'r']]) {
    assert.equal((await record(join(root, '.cland', 'hub.json'), {}, ...bad)).code, 64, bad.join(' '));
  }
});

test('QA verdict retry preserves recorded cases without rerunning them', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await projectHub(t, root);
  const hubFile = join(root, '.cland', 'hub.json');
  assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'A fixture item', '--json')).code, 0);
  const run = 'qa-2026-10-09-2';
  assert.equal((await record(hubFile, {}, 'run', 'T-1', run, 'SHELL-001')).code, 0);
  const runs = join(root, '.cland', 'qa', 'runs.jsonl');
  const before = await readFile(runs, 'utf8');

  // step 3 fails: the writer does not hold the QA role, so the hub refuses the verdict
  const impostor = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-9', sessionId: 'impl-id', role: 'implementer' });
  t.after(() => impostor.close());
  await impostor.waitForPresence(['impl-9']);
  const refused = await impostor.call<{ ok?: boolean; error?: string }>('task.comment', { id: 'T-1', text: 'clear', verdict: 'qa', result: 'clear', run }).catch((err: unknown): { ok?: boolean; error?: string } => ({ error: String(err) }));
  assert.ok(refused.ok !== true, 'the verdict is refused');
  assert.equal(await readFile(runs, 'utf8'), before, 'the line stays, untouched');
  const none = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { verdicts: unknown[] } };
  assert.deepEqual(none.item.verdicts, []);

  // finish from there: only the verdict, by the QA session, with the same run id
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
  t.after(() => qa.close());
  await qa.waitForPresence(['qa-1']);
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: 'T-1', text: '| SHELL-001 | PASS |', verdict: 'qa', result: 'clear', run })).ok, true);
  assert.equal(await readFile(runs, 'utf8'), before, 'no case was rerun: still one line');
  const view = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { verdicts: Array<{ result: string; run: string }> } };
  assert.deepEqual(view.item.verdicts.map((v) => [v.result, v.run]), [['clear', run]]);
});

test('QA recorder names temporary evidence and the rescue session', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'qa'), 'in the way');
  const tmp = await tempProject(t, 'cland-qa-tmp-');
  const r = await record(join(root, '.cland', 'hub.json'), { TMPDIR: tmp, QA_SESSION: 'rescue-job-7' }, 'run', 'T-1', 'rescue-1', 'SHELL-001');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const line = JSON.parse(r.stdout.trim()) as RunLine;
  assert.equal(line.session, 'rescue-job-7');
  assert.deepEqual(line.evidence, [join(tmp, 'cland-qa-evidence', 'T-1', 'rescue-1', 'SHELL-001.screen.txt'), join(tmp, 'cland-qa-evidence', 'T-1', 'rescue-1', 'SHELL-001.state.json')]);
  assert.match(r.stderr, /NOT recorded/);
});

test('QA recorder rejects unsafe identifiers before writing evidence', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  const hubFile = join(root, '.cland', 'hub.json');
  const bad: Array<[string, string, string]> = [
    ['E-1/../../x', 'r1', 'C-1'], ['I-42a', 'r1', 'C-1'], ['E-', 'r1', 'C-1'], ['T-1/../../x', 'r1', 'C-1'], ['T-', 'r1', 'C-1'], ['T-1a', 'r1', 'C-1'], ['T-../x', 'r1', 'C-1'], ['x', 'r1', 'C-1'], ['T-1 ', 'r1', 'C-1'],
    ['T-1', '', 'C-1'], ['T-1', '.', 'C-1'], ['T-1', '..', 'C-1'], ['T-1', '.hidden', 'C-1'], ['T-1', '-r', 'C-1'], ['T-1', 'a/b', 'C-1'], ['T-1', '../x', 'C-1'], ['T-1', 'a b', 'C-1'], ['T-1', 'r*', 'C-1'],
    ['T-1', 'r1', ''], ['T-1', 'r1', '.'], ['T-1', 'r1', '..'], ['T-1', 'r1', '.x'], ['T-1', 'r1', 'a/b'], ['T-1', 'r1', '../../x'],
  ];
  for (const [item, run, id] of bad) {
    for (const args of [['run', item, run, id], ['note', item, run, id, 'hub-api', 'cmd', 'PASS']]) {
      const r = await record(hubFile, {}, ...args);
      assert.equal(r.code, 64, `${JSON.stringify(args)} exits ${r.code}: ${r.stderr}`);
      assert.equal(r.stdout, '', `${JSON.stringify(args)} prints no line`);
    }
  }
  assert.deepEqual(await readdir(join(root, '.cland')), [], 'nothing was created');
  // the accepted shapes
  for (const [item, run, id] of [['T-12', 'qa-2026-10-09-1', 'SHELL-001'], ['E-423', 'r.1_a', 'M1'], ['I-42', '1', '2']]) {
    const result = await record(hubFile, {}, 'note', item as string, run as string, id as string, 'hub-api', 'cmd', 'PASS');
    assert.equal(result.code, 0, `${item} ${run} ${id}: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).item, item);
  }
});

test('QA recorder preserves spaces and glob characters in evidence paths', { skip: skipRun }, async (t) => {
  const base = await tempProject(t, 'cland-qa-skill-');
  const root = join(base, 'a project [x] *glob');
  await mkdir(join(root, '.cland'), { recursive: true });
  const r = await record(join(root, '.cland', 'hub.json'), {}, 'run', 'T-3', 'r1', 'SHELL-001');
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
  const fallback = await record(join(blocked, '.cland', 'hub.json'), { TMPDIR: tmp }, 'run', 'T-3', 'r2', 'SHELL-001');
  assert.equal(fallback.code, 0, fallback.stderr + fallback.stdout);
  for (const e of (JSON.parse(fallback.stdout.trim()) as RunLine).evidence) assert.ok(e.startsWith(join(tmp, 'cland-qa-evidence')) && (await stat(e)).size > 0, e);
});

test('QA serialization failure preserves captures without appending a line', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  // a jq that works until the line is built (the only call with --argjson), then fails like a broken one
  const bin = await tempProject(t, 'cland-qa-fakejq-');
  assert.ok(jq);
  const real = jq;
  await writeFile(join(bin, 'jq'), `#!/bin/sh\ncase " $* " in *" --argjson "*) exit 5;; esac\nexec "${real}" "$@"\n`);
  await chmod(join(bin, 'jq'), 0o755);
  const r = await record(join(root, '.cland', 'hub.json'), { PATH: `${bin}:${process.env.PATH ?? ''}` }, 'run', 'T-4', 'r1', 'SHELL-001');
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

test('QA recovery verifies each copied capture before appending its rewritten receipt', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  const { captures, linesFile } = await rescued(t, 'T-5', 'rescue-1', ['SHELL-001', 'ITEMS-001']);
  const r = await record(join(root, '.cland', 'hub.json'), {}, 'recover', 'T-5', 'rescue-1', captures, linesFile);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /2 line\(s\) appended, 0 not appended/);
  const lines = await appended(root);
  assert.deepEqual(lines.map((l) => l.case), ['SHELL-001', 'ITEMS-001']);
  assert.deepEqual(lines[0]?.evidence, ['.cland/qa/T-5/rescue-1/SHELL-001.screen.txt', '.cland/qa/T-5/rescue-1/SHELL-001.state.json']);
  assert.equal(await readFile(join(root, '.cland/qa/T-5/rescue-1/ITEMS-001.screen.txt'), 'utf8'), 'grid of ITEMS-001\n');
  assert.equal(await readFile(join(captures, 'ITEMS-001.screen.txt'), 'utf8'), 'grid of ITEMS-001\n', 'the source is untouched');
});

test('QA recovery directory failure preserves all source captures and receipts', { skip: skipRun }, async (t) => {
  const root = await tempProject(t, 'cland-qa-skill-');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'qa'), 'in the way');
  const { captures, linesFile } = await rescued(t, 'T-5', 'rescue-1', ['SHELL-001']);
  const r = await record(join(root, '.cland', 'hub.json'), {}, 'recover', 'T-5', 'rescue-1', captures, linesFile);
  assert.equal(r.code, 71, r.stderr);
  assert.match(r.stderr, /nothing appended, nothing copied.*stay in .*lines in /);
  assert.equal(await readFile(join(root, '.cland', 'qa'), 'utf8'), 'in the way');
  assert.equal(await readFile(join(captures, 'SHELL-001.screen.txt'), 'utf8'), 'grid of SHELL-001\n');
});

test('QA partial recovery retains only the good line and names each loss', { skip: skipRun || (process.getuid?.() === 0 && 'root reads anything') }, async (t) => {
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
  const r = await record(join(root, '.cland', 'hub.json'), {}, 'recover', 'T-5', 'rescue-1', captures, linesFile);
  assert.equal(r.code, 73, r.stderr);
  assert.match(r.stderr, /COPY-001: could not copy/);
  assert.match(r.stderr, /GONE-001: capture missing/);
  assert.match(r.stderr, /CLASH-001: .*already exists with other content/);
  assert.match(r.stderr, /line 5 is not a runs line of T-5 rescue-1/);
  assert.match(r.stderr, /1 line\(s\) appended, 4 not appended/);
  assert.deepEqual((await appended(root)).map((l) => l.case), ['GOOD-001']);
  for (const kept of ['GOOD-001.screen.txt', 'COPY-001.state.json', 'GONE-001.state.json', 'CLASH-001.screen.txt']) assert.ok((await stat(join(captures, kept))).size > 0, `${kept} stays`);
});

test('QA recovery rejects failed jq extraction instead of accepting empty output', { skip: skipRun }, async (t) => {
  assert.ok(jq);
  const real = jq;
  // each wrapper works until the call whose program holds `fails`, then fails like a broken jq
  for (const [fails, said] of [['(.evidence // [])[]', /could not read its evidence list/], ['.case', /could not read its case/], ['split("/")', /could not rewrite or append/]] as const) {
    const root = await tempProject(t, 'cland-qa-skill-');
    await mkdir(join(root, '.cland'), { recursive: true });
    const bin = await tempProject(t, 'cland-qa-fakejq-');
    // fails when an argument is, or holds, the marker program text (quoted, so it is literal)
    await writeFile(join(bin, 'jq'), `#!/bin/sh\nfor a in "$@"; do case "$a" in *'${fails}'*) exit 5;; esac; done\nexec "${real}" "$@"\n`);
    await chmod(join(bin, 'jq'), 0o755);
    const { captures, linesFile } = await rescued(t, 'T-6', 'rescue-1', ['SHELL-001']);
    const r = await record(join(root, '.cland', 'hub.json'), { PATH: `${bin}:${process.env.PATH ?? ''}` }, 'recover', 'T-6', 'rescue-1', captures, linesFile);
    assert.equal(r.code, 73, `${fails}: ${r.stderr}`);
    assert.match(r.stderr, said, fails);
    assert.match(r.stderr, /0 line\(s\) appended, 1 not appended/);
    assert.deepEqual(await appended(root), [], `${fails}: no line, in particular not one without its captures`);
    assert.equal(await readFile(join(captures, 'SHELL-001.screen.txt'), 'utf8'), 'grid of SHELL-001\n', 'the source stays');
  }
});
