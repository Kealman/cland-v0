import { ownDirectory, ownProcess } from '../../hub/test/process-cleanup.ts';
// `cland --headless --qa <case.lua>` as a process (#57): the exit code, the one JSON line and the dump
// files, against the stdio hub and the stub hub, also under sandbox-exec profiles.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

const CLI = fileURLToPath(new URL('../../hub/bin/cland.ts', import.meta.url));
const SHIPPED = fileURLToPath(new URL('../../qa/cases/', import.meta.url));
const CASES = fileURLToPath(new URL('./qa-cases/', import.meta.url));
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

/** A stand-in for the Neovim binary that writes its pid to `pidFile` and becomes the real one: the run's process group leader. */
async function pidWrapper(dir: string): Promise<{ wrapper: string; pid: () => Promise<number> }> {
  const pidFile = join(dir, 'nvim.pid');
  const wrapper = join(dir, 'nvim-wrapper');
  await writeFile(wrapper, `#!/bin/sh\necho $$ > ${JSON.stringify(pidFile)}\nexec ${JSON.stringify(bin)} "$@"\n`);
  await chmod(wrapper, 0o755);
  return {
    wrapper,
    pid: async () => {
      for (let i = 0; i < 200; i++) {
        const pid = Number((await readFile(pidFile, 'utf8').catch(() => '')).trim());
        if (pid > 0) return pid;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error('the Neovim wrapper never wrote its pid');
    },
  };
}

/** Whether no process is left in the process group `pgid`, within two seconds. */
async function groupGone(pgid: number): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    try {
      process.kill(-pgid, 0);
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      return true;
    }
  }
  return false;
}

async function tempDir(t: TestContext, prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  ownDirectory(t, dir);
  return dir;
}

type Line = { case: string; result: string; duration_ms: number; build: string; hub: string; message?: string; evidence: unknown };
type Run = { code: number | null; stdout: string; stderr: string; line: Line };

/** Run `cland --headless --qa …`, optionally under a command prefix (a sandbox); the one JSON line parsed. */
function qa(t: TestContext, args: string[], options: { prefix?: string[]; env?: Record<string, string>; cwd?: string; started?: (child: ChildProcess) => void } = {}): Promise<Run> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  if (process.env.CLAND_NVIM) env.CLAND_NVIM = process.env.CLAND_NVIM;
  Object.assign(env, options.env);
  const argv = [...(options.prefix ?? []), process.execPath, CLI, '--headless', '--qa', ...args];
  const child = spawn(argv[0] as string, argv.slice(1), { cwd: options.cwd ?? process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  t.after(() => void child.kill('SIGKILL'));
  options.started?.(child);
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (c: string) => (stdout += c));
  child.stderr.setEncoding('utf8').on('data', (c: string) => (stderr += c));
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      const lines = stdout.split('\n').filter(Boolean);
      try {
        assert.equal(lines.length, 1, `one JSON line on stdout, got:\n${stdout}\nstderr:\n${stderr}`);
        resolve({ code, stdout, stderr, line: JSON.parse(lines[0] as string) as Line });
      } catch (err) {
        reject(err);
      }
    });
  });
}

for (const name of ['PANELS-005', 'PANELS-006', 'PANELS-007', 'PANELS-008', 'PANELS-009', 'PANELS-010', 'PANELS-011', 'PANELS-012', 'PANELS-013', 'PANELS-014', 'THREAD-001', 'THREAD-002', 'THREAD-003', 'THREAD-004', 'THREAD-005', 'THREAD-006']) {
  test(`${name} passes through the headless stub-hub QA runner`, { skip }, async (t) => {
    const run = await qa(t, [`${SHIPPED}${name}.lua`]);
    assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
    assert.equal(run.code, 0);
  });
}

test('SHELL-001 passes against its own stdio hub: exit 0 and one JSON line with the result, the duration, the build and the evidence inline', { skip }, async (t) => {
  const run = await qa(t, [`${SHIPPED}SHELL-001.lua`]);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
  assert.equal(run.code, 0);
  assert.equal(run.line.case, 'SHELL-001');
  assert.equal(run.line.hub, 'stdio');
  assert.match(run.line.build, /^[0-9a-f]{7,}$/);
  assert.ok(run.line.duration_ms > 0);
  const evidence = run.line.evidence as { screen: string; state: { topics: Array<{ id: string }> } };
  assert.match(evidence.screen, /hello from qa/);
  assert.match(evidence.screen, /⌁ queued/);
  assert.equal(evidence.screen.split('\n').length, 45, 'the fixed 160×45 grid');
  assert.deepEqual(evidence.state.topics.map((x) => x.id), ['general', 'agents']);
});

test('a failed expectation exits 1 with FAIL, its message, and the grid and the state dumped in --out', { skip }, async (t) => {
  const out = join(await tempDir(t, 'cland-qa-out-'), 'evidence');
  const run = await qa(t, [`${CASES}FAIL-001.lua`, '--out', out]);
  assert.equal(run.line.result, 'FAIL', JSON.stringify(run.line));
  assert.equal(run.code, 1);
  assert.equal(run.line.message, 'the board is on screen');
  assert.equal(run.line.hub, 'stub');
  assert.deepEqual(run.line.evidence, [join(out, 'FAIL-001.screen.txt'), join(out, 'FAIL-001.state.json')]);
  assert.deepEqual((await readdir(out)).sort(), ['FAIL-001.screen.txt', 'FAIL-001.state.json']);
  const grid = await readFile(join(out, 'FAIL-001.screen.txt'), 'utf8');
  assert.match(grid, /No messages in General yet\./);
  assert.equal(grid.split('\n').length, 46, '45 rows, each ended by a newline');
  const state = JSON.parse(await readFile(join(out, 'FAIL-001.state.json'), 'utf8')) as { view: unknown; hub: { state: string } };
  assert.deepEqual(state.view, { kind: 'thread', id: 'general' });
  assert.equal(state.hub.state, 'connected');
});

test('a wait_for that times out exits 2 with INCONCLUSIVE and the last screen', { skip }, async (t) => {
  const run = await qa(t, [`${CASES}WAIT-001.lua`]);
  assert.equal(run.line.result, 'INCONCLUSIVE', JSON.stringify(run.line));
  assert.equal(run.code, 2);
  assert.equal(run.line.message, 'wait_for timed out after 300 ms: a row that never shows');
  // the keys typed before the wait were taken: the items panel is open on the last screen
  assert.match((run.line.evidence as { screen: string }).screen, /ITEMS/);
});

test('a Lua error in the case exits 2 with BLOCKED, the error with its line, and the last screen', { skip }, async (t) => {
  const out = await tempDir(t, 'cland-qa-out-');
  const run = await qa(t, [`${CASES}ERROR-001.lua`, '--out', out]);
  assert.equal(run.line.result, 'BLOCKED', JSON.stringify(run.line));
  assert.equal(run.code, 2);
  assert.match(run.line.message ?? '', /ERROR-001\.lua:9: attempt to index local 'missing' \(a nil value\)/);
  assert.match(await readFile(join(out, 'ERROR-001.screen.txt'), 'utf8'), /General/);
});

test('a case that is not there, or does not load, is BLOCKED with exit 2; a bad command line is a usage error', { skip }, async (t) => {
  const missing = await qa(t, [`${CASES}NOPE-001.lua`]);
  assert.equal(missing.line.result, 'BLOCKED');
  assert.equal(missing.code, 2);
  assert.match(missing.line.message ?? '', /no case file .*NOPE-001\.lua/);

  const broken = await qa(t, [fileURLToPath(import.meta.url)]);
  assert.equal(broken.line.result, 'BLOCKED', JSON.stringify(broken.line));
  assert.equal(broken.code, 2);
  assert.match(broken.line.message ?? '', /the case does not load/);

  await assert.rejects(qa(t, [`${CASES}FAIL-001.lua`, '--hub', 'tcp']), /--hub is stdio or stub/);
  // a timer Node cannot keep would fire at once
  await assert.rejects(qa(t, [`${CASES}FAIL-001.lua`, '--timeout', '3000000']), /--timeout needs a number of seconds, at most 2147483/);
});

test('qa.state() holds the stub scenario: the sessions with their states, the roles, and the topics, asks and items the screen shows', { skip }, async (t) => {
  const run = await qa(t, [`${CASES}STATE-001.lua`]);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
  type Snapshot = {
    project: string;
    hub: { state: string };
    view: unknown;
    panels: unknown;
    coordinator: string;
    needs_you: number;
    sessions: Array<Record<string, unknown>>;
    roles: Array<{ role: string }>;
    topics: Array<{ id: string; status: string; item?: string }>;
    asks: Array<{ id: string; question: string; options: string[] }>;
    items: Array<{ id: string; title: string; claim?: { session: string } }>;
  };
  const evidence = run.line.evidence as { screen: string; state: Snapshot; dumps: Record<string, { screen: string; state: Snapshot }> };
  const { state, screen } = evidence;
  assert.equal(state.project, 'qa-state');
  assert.equal(state.hub.state, 'connected');
  assert.deepEqual(state.view, { kind: 'thread', id: 'general' });
  assert.deepEqual(state.panels, { left: true, right: 'inbox', dock: false });
  assert.deepEqual(
    state.sessions.map((s) => [s.name, s.role, s.label, s.harness, s.model, s.state, s.live, s.item ?? null]),
    [
      ['coord-1', 'coordinator', 'coord-1 [Coordinator]', 'claude-code', 'opus', 'busy', true, null],
      ['impl-1', 'implementer', 'impl-1 [Implementer]', 'claude-code', 'sonnet', 'waiting for human', true, 'T-2'],
    ],
  );
  assert.equal(state.coordinator, 'coord-1');
  assert.deepEqual(state.roles.map((r) => r.role), ['coordinator', 'implementer', 'reviewer', 'qa']);
  assert.deepEqual(state.topics.map((x) => [x.id, x.status, x.item ?? null]), [['general', 'open', null], ['agents', 'open', null], ['topic-1', 'waiting for human', 'T-2']]);
  assert.deepEqual(state.asks.map((a) => [a.id, a.question, a.options]), [['a1', 'Which should win?', ['the pid', 'the name']]]);
  assert.equal(state.needs_you, 1);
  assert.deepEqual(state.items.map((i) => [i.id, i.title, i.claim?.session ?? null]), [['T-1', 'Workbench shell', null], ['T-2', 'Items panel', 'impl-1']]);
  // what the state says is what the screen shows
  assert.match(screen, /cland qa-state +Workbench shell │ General/);
  assert.match(screen, /T-1 Workbench shell/);
  assert.match(screen, /T-2 T-1 › Items panel +impl-1/);
  assert.match(screen, /Which should win\?/);
  assert.match(screen, /needs you +1/);
  // a dump the case asked for along the way, inline as no --out was given
  assert.deepEqual(Object.keys(evidence.dumps), ['sessions']);
  assert.match(evidence.dumps.sessions?.screen ?? '', /impl-1 \[Implementer\]/);
  assert.match(evidence.dumps.sessions?.screen ?? '', /WAITING · 1/);
  assert.deepEqual(evidence.dumps.sessions?.state.panels, { left: false, right: 'sessions', dock: false });
});

test('ITEMS-001 passes against its own stdio hub, and against the stub hub with --hub stub', { skip }, async (t) => {
  const real = await qa(t, [`${SHIPPED}ITEMS-001.lua`]);
  assert.equal(real.line.result, 'PASS', JSON.stringify(real.line));
  assert.equal(real.code, 0);
  assert.equal(real.line.hub, 'stdio');
  const screen = (real.line.evidence as { screen: string }).screen;
  assert.match(screen, /T-2 ITEMS PANEL/);
  assert.match(screen, /parent +T-1 Workbench shell/);
  assert.match(screen, /The tree of items, each under its parent\./);

  const stub = await qa(t, [`${SHIPPED}ITEMS-001.lua`, '--hub', 'stub']);
  assert.equal(stub.line.result, 'PASS', JSON.stringify(stub.line));
  assert.equal(stub.line.hub, 'stub');
});

test("the fixture's roles.toml and config.toml are the stdio hub's: the launcher fills in the fixture role's defaults", { skip }, async (t) => {
  const run = await qa(t, [`${CASES}ROLES-001.lua`]);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
  const { screen, state } = run.line.evidence as { screen: string; state: { mode: string; roles: Array<{ role: string; launch: Record<string, string> }> } };
  assert.deepEqual(state.roles.find((r) => r.role === 'coordinator')?.launch, { harness: 'codex', model: 'qa-model', effort: 'low' });
  // the launcher's float is on the grid, with the keys typed into it
  assert.match(screen, /╭ launch a session ─+╮/);
  assert.match(screen, /│name +coord /);
  assert.match(screen, /│model +qa-model /);
  assert.equal(state.mode, 'i');
});

test('every run is given the fixed grid, the pinned TERM, LANG and TZ, paths of its own and no server socket, whatever the caller has', { skip }, async (t) => {
  const run = await qa(t, [`${CASES}ENV-001.lua`], { env: { TERM: 'dumb', LANG: 'ru_RU.UTF-8', TZ: 'Asia/Tokyo', NVIM_APPNAME: 'mine', CLAND_SESSION_NAME: 'impl-1', CLAND_REFRESH_MS: '1' } });
  assert.equal(run.line.message, undefined);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
});

test('fixture values YAML would read as structure reach the client whole, the same under the stdio hub and the stub hub', { skip }, async (t) => {
  for (const hub of ['stdio', 'stub']) {
    const run = await qa(t, [`${CASES}LABELS-001.lua`, '--hub', hub]);
    assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
    const { items } = (run.line.evidence as { state: { items: Array<Record<string, unknown>> } }).state;
    const fields = (i: Record<string, unknown> | undefined) => [i?.id, i?.kind, i?.title, i?.state, i?.labels, i?.assignee ?? null, i?.parent ?? null, i?.blocked_by, i?.branch ?? null];
    assert.deepEqual(fields(items[0]), ['T-1', 'task', 'Labels: "quoted", with a comma [and brackets] # and a hash', 'open', ['priority, high', 'ui: shell'], 'impl-1', null, [], 't/1-labels'], hub);
    assert.deepEqual(fields(items[1]), ['T-2', 'question', 'Blocked', 'closed', [], null, 'T-1', ['T-1'], null], hub);
    const screen = (run.line.evidence as { screen: string }).screen;
    // the fields column is narrow: the labels start there, whole in the state above
    assert.match(screen, /kind +task · priority,/, hub);
    assert.match(screen, /With a rule in it\./, hub);
    assert.match(screen, /COMMENTS · 1/, hub);
  }
});

test('a fixture that would write outside the run directory (its project name, an item id) is BLOCKED before any write', { skip }, async (t) => {
  // the run's temp dir is this test's own, so anything written beside the run directory shows
  const tmp = realpathSync(await tempDir(t, 'cland-qa-tmp-'));
  for (const [name, why] of [['ESCAPE-001', /the fixture's project "\.\.\/live" is not a plain directory name/], ['ESCAPE-002', /the fixture's item id "\.\.\/\.\.\/T-1" is not T-<n>/]] as const) {
    for (const hub of ['stdio', 'stub']) {
      const run = await qa(t, [`${CASES}${name}.lua`, '--hub', hub], { env: { TMPDIR: tmp } });
      assert.equal(run.line.result, 'BLOCKED', JSON.stringify(run.line));
      assert.equal(run.code, 2);
      assert.match(run.line.message ?? '', why);
      assert.deepEqual(await readdir(tmp), [], `${name} on ${hub}: nothing is left in the temp dir, beside the run directory or in it`);
    }
  }
});

test('keys longer than Neovim\'s input buffer are all typed, the last ones too', { skip }, async (t) => {
  const run = await qa(t, [`${CASES}KEYS-001.lua`]);
  assert.equal(run.line.message, undefined);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
});

test('a long sequence is cut only right after <Esc> or <CR>: rev-6\'s x×4084 then <Esc><Space>i, and the cut at every distance from the limit', { skip }, async (t) => {
  const run = await qa(t, [`${CASES}KEYS-002.lua`, '--timeout', '120']);
  assert.equal(run.line.message, undefined);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
});

test('a Normal-mode command after a long stretch arrives whole when there is an <Esc> to cut at; with none in over 4 KiB the keys are refused, never left hanging', { skip }, async (t) => {
  const gi = await qa(t, [`${CASES}KEYS-003.lua`, '--timeout', '60']);
  assert.equal(gi.line.message, undefined);
  assert.equal(gi.line.result, 'PASS', JSON.stringify(gi.line));

  const refused = await qa(t, [`${CASES}KEYS-004.lua`, '--timeout', '60']);
  assert.equal(refused.line.result, 'BLOCKED', JSON.stringify(refused.line));
  assert.equal(refused.code, 2);
  assert.match(refused.line.message ?? '', /^keys: 4097 bytes from byte 1 on hold no <Esc> or <CR> within 4096 bytes, the most typed at once; put an <Esc> or a <CR> where the mode is known/);
  assert.ok(refused.line.duration_ms < 30_000, `refused at once, not after a wait: ${refused.line.duration_ms} ms`);
  const { state } = refused.line.evidence as { state: { mode: string } };
  assert.equal(state.mode, 'n', 'nothing was typed: no command is pending');
});

test('`cland --qa-fixture` writes a new fixture project only: an existing one is refused and left as it was', async (t) => {
  const dir = realpathSync(await tempDir(t, 'cland-qa-fixture-'));
  const fixture = (title: string) => JSON.stringify({ dir, project: 'proj', items: [{ id: 'T-1', title }] });
  const write = (input: string) => spawnSync(process.execPath, [CLI, '--qa-fixture'], { input, encoding: 'utf8' });
  const first = write(fixture('First'));
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim(), join(dir, 'proj'));
  const file = join(dir, 'proj', '.cland', 'tasks', 'T-1-first.md');
  const before = await readFile(file, 'utf8');
  const again = write(fixture('Second'));
  assert.equal(again.status, 1);
  assert.match(again.stderr, /the fixture project .*proj already exists/);
  assert.deepEqual(await readdir(join(dir, 'proj', '.cland', 'tasks')), ['T-1-first.md']);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('a case that never returns is ended by --timeout: BLOCKED, exit 2, and no Neovim left spinning', { skip }, async (t) => {
  const nv = await pidWrapper(await tempDir(t, 'cland-qa-hang-'));
  const run = await qa(t, [`${CASES}HANG-001.lua`, '--timeout', '2'], { env: { CLAND_NVIM: nv.wrapper } });
  assert.equal(run.line.result, 'BLOCKED', JSON.stringify(run.line));
  assert.equal(run.code, 2);
  assert.match(run.line.message ?? '', /^the run did not finish within 2 s/);
  assert.equal(await groupGone(await nv.pid()), true);
});

test('a run that is interrupted (SIGTERM) takes its Neovim with it and still says BLOCKED', { skip }, async (t) => {
  const nv = await pidWrapper(await tempDir(t, 'cland-qa-term-'));
  let runner: ChildProcess | undefined;
  const done = qa(t, [`${CASES}HANG-001.lua`], { env: { CLAND_NVIM: nv.wrapper }, started: (child) => (runner = child) });
  const pid = await nv.pid();
  runner?.kill('SIGTERM');
  const run = await done;
  assert.equal(run.line.result, 'BLOCKED', JSON.stringify(run.line));
  assert.equal(run.code, 2);
  assert.match(run.line.message ?? '', /^interrupted by SIGTERM/);
  assert.equal(await groupGone(pid), true);
});

test(':Cland qa dump <path> writes the grid and the state in an ordinary run', { skip }, async (t) => {
  const dir = await tempDir(t, 'cland-qa-dump-');
  const root = join(dir, 'proj-dump');
  await mkdir(join(root, '.git'), { recursive: true });
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]) });
  await c.waitScreen((s) => s.includes('No messages in General yet.') && s.includes('hub: connected'), 'General, connected');
  await c.input(`<Esc>:Cland qa dump ${join(dir, 'shots', 'now')}<CR>`);
  await c.waitScreen((s) => s.includes('qa dump: '), 'the dump named on the status line');
  const grid = await readFile(join(dir, 'shots', 'now.screen.txt'), 'utf8');
  assert.match(grid, /^ cland proj-dump │ General/);
  assert.match(grid, /No messages in General yet\./);
  const state = JSON.parse(await readFile(join(dir, 'shots', 'now.state.json'), 'utf8')) as { project: string; hub: { state: string }; view: unknown; panels: unknown };
  assert.equal(state.project, 'proj-dump');
  assert.equal(state.hub.state, 'connected');
  assert.deepEqual(state.view, { kind: 'thread', id: 'general' });
  assert.deepEqual(state.panels, { left: false, right: 'sessions', dock: false });
});

// ------------------------------------------------------------------ under sandbox-exec

const SANDBOX = existsSync('/usr/bin/sandbox-exec') && spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)', '/usr/bin/true']).status === 0;
const sandboxSkip = skip || (SANDBOX ? false : 'needs macOS sandbox-exec');
const sandboxed = (profile: string) => ['/usr/bin/sandbox-exec', '-p', `(version 1)(allow default)${profile}`];
const NO_NETWORK = '(deny network*)';
const TMP = realpathSync(tmpdir());

test('with the network denied (no socket to bind or reach), both cases pass', { skip: sandboxSkip }, async (t) => {
  for (const name of ['SHELL-001', 'ITEMS-001']) {
    const run = await qa(t, [`${SHIPPED}${name}.lua`], { prefix: sandboxed(NO_NETWORK) });
    assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
    assert.equal(run.line.hub, 'stdio');
    assert.equal(run.code, 0);
  }
});

test('with file writes also denied outside the temp dir, both cases pass and dump their evidence there', { skip: sandboxSkip }, async (t) => {
  const out = await tempDir(t, 'cland-qa-out-');
  const profile = `${NO_NETWORK}(deny file-write*)(allow file-write* (subpath ${JSON.stringify(TMP)}) (literal "/dev/null"))`;
  for (const name of ['SHELL-001', 'ITEMS-001']) {
    const run = await qa(t, [`${SHIPPED}${name}.lua`, '--out', out], { prefix: sandboxed(profile) });
    assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
    assert.equal(run.line.hub, 'stdio');
    assert.deepEqual(run.line.evidence, [join(out, `${name}.screen.txt`), join(out, `${name}.state.json`)]);
    assert.ok((await readFile(join(out, `${name}.screen.txt`), 'utf8')).includes('cland qa-'));
  }
});

test('with every file write denied, as in a read-only rescue run, a stub-hub case without --out passes; one that needs the stdio hub is BLOCKED and says why', { skip: sandboxSkip }, async (t) => {
  const readOnly = sandboxed(`${NO_NETWORK}(deny file-write*)`);
  const run = await qa(t, [`${CASES}STATE-001.lua`], { prefix: readOnly });
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
  assert.equal(run.code, 0);
  assert.equal(run.line.hub, 'stub');
  const evidence = run.line.evidence as { screen: string; state: { sessions: unknown[] } };
  assert.match(evidence.screen, /cland qa-state +Workbench shell │ General/);
  assert.equal(evidence.state.sessions.length, 2);

  const shipped = await qa(t, [`${SHIPPED}SHELL-001.lua`, '--hub', 'stub'], { prefix: readOnly });
  assert.equal(shipped.line.result, 'PASS', JSON.stringify(shipped.line));

  const real = await qa(t, [`${SHIPPED}SHELL-001.lua`], { prefix: readOnly });
  assert.equal(real.line.result, 'BLOCKED', JSON.stringify(real.line));
  assert.equal(real.code, 2);
  assert.equal(real.line.message, 'no temp dir to build the fixture project in: a read-only run takes a stub-hub case (--hub stub)');
});

// ------------------------------------------------------------------ nothing of the user's, nothing left

/** Every file under `dir` with its content, to tell whether a run touched it. */
async function snapshot(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    files[path.slice(dir.length)] = entry.isFile() ? await readFile(path, 'utf8') : '<dir>';
  }
  return files;
}

test('a run reads no user configuration, leaves the live project it was started in alone, and leaves no process and no fixture behind', { skip }, async (t) => {
  const dir = realpathSync(await tempDir(t, 'cland-qa-live-'));
  // the live project the run is started in: a hub.json naming a hub, an item, and the session's environment
  const live = join(dir, 'live');
  await mkdir(join(live, '.cland', 'tasks'), { recursive: true });
  await mkdir(join(live, '.git'));
  await writeFile(join(live, '.cland', 'hub.json'), JSON.stringify({ root: live, socket: join(live, '.cland', 'hub.sock'), port: 1, secret: 's', pid: process.pid, version: '0' }));
  await writeFile(join(live, '.cland', 'tasks', 'T-1-live.md'), '---\nid: T-1\nkind: task\ntitle: The live item\nstate: open\n---\n');
  const before = await snapshot(live);
  // a user configuration that would leave a mark, under every name Neovim could look for
  const mark = join(dir, 'user-config-was-read');
  const touched = `vim.fn.writefile({ 'read' }, ${JSON.stringify(mark)})\n`;
  for (const app of ['nvim', 'cland', 'cland-qa']) {
    for (const base of [join(dir, 'xdg'), join(dir, 'home', '.config')]) {
      await mkdir(join(base, app, 'plugin'), { recursive: true });
      await writeFile(join(base, app, 'init.lua'), touched);
      await writeFile(join(base, app, 'plugin', 'mark.lua'), touched);
    }
  }
  // a command the client would run instead of the hub, were CLAND_COMMAND honoured
  const rogue = join(dir, 'rogue-hub');
  await writeFile(rogue, `#!/bin/sh\necho ran > ${JSON.stringify(mark)}\n`);
  await chmod(rogue, 0o755);
  // the Neovim the run starts, wrapped to learn its pid: it leads the run's process group
  const nv = await pidWrapper(dir);

  const run = await qa(t, [`${SHIPPED}ITEMS-001.lua`], {
    cwd: live,
    env: {
      CLAND_NVIM: nv.wrapper,
      HOME: join(dir, 'home'),
      XDG_CONFIG_HOME: join(dir, 'xdg'),
      CLAND_HUB_FILE: join(live, '.cland', 'hub.json'),
      CLAND_ROOT: live,
      CLAND_COMMAND: JSON.stringify([rogue]),
      CLAND_HUB_TRANSPORT: 'socket',
      CLAND_SESSION_NAME: 'impl-1',
    },
  });
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
  assert.equal(existsSync(mark), false, 'no user configuration was sourced and no other command was run');
  assert.deepEqual(await snapshot(live), before, 'the live project is as it was: no hub state, no item touched');

  // the case ran on a fixture project of its own in the temp dir, removed with the run
  const { root, items } = (run.line.evidence as { state: { root: string; items: Array<{ id: string; title: string }> } }).state;
  assert.match(root, new RegExp(`^${TMP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/cland-qa-[^/]+/qa-items$`));
  assert.deepEqual(items.map((i) => i.title), ['Workbench shell', 'Items panel']);
  assert.equal(existsSync(join(root, '..')), false);

  // neither Neovim nor the hub it spawned is left: nothing answers in its process group
  const pid = await nv.pid();
  assert.equal(await groupGone(pid), true, `process group ${pid} still has a process`);
});
