# Stage QA brief: E-1536 stage 1 — mode and identity

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`, the suite's Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-1536 (Users and sign-in modes, under R-1530).
- Exact stage name: mode and identity.
- Items, in plan order: lane 1 T-1558 (Sign-in mode, the users and roles tables, the switch and the reset), then T-1560 (Every human connection acts as a user); lane 2 T-1559 (WebAuthn checks on node:crypto). The run reads the stage's members, counts and state from `task plan show E-1536` (E1536S1-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined user-visible changes of the stage at the tested build.
  - T-1558: `[auth] mode = "single" | "users"` in `.cland/config.toml` (written by `cland init`, default single); `cland auth mode users` switches the project and creates one admin from Git's `user.name` (display name) and its lowercase ASCII slug (name), printing `<name>  <role>`; repeating the switch, reloading or restarting never creates a second first user; `cland auth reset` returns to single, keeps the users rows and revokes every web session and outstanding one-time link; `cland user list` prints name, display name, role and state, and is refused in single mode naming `cland auth mode users`; `cland config set auth.mode` refuses every value naming `cland auth`; the new frames are CLI-only in the web authority table and absent from the gateway's.
  - T-1558, the hand-edit guard (review finding on c5397407, `docs/agents/auth.md`, A-15078 A2): a hand edit of `config.toml` into users mode without the authorized switch is refused at reload and at start; a hand edit from users back to single while users exist is refused at reload and at start; each refusal names its recovery (`cland auth mode users`, or set users, start, `cland auth reset`).
  - T-1560: in users mode a web session row records its user and a web conversation acts as that user, never as a frame field; `cland web` mints a one-time link bound to the CLI's acting (first) user; CLI and Neovim (the local Unix socket) act as the first user; `web.session` returns `user: {id, name, displayName, role}` and the web Profile shows the display name; every audit record of a human request carries `userId`; a web request carrying `as` stays refused. Single mode keeps `human`, today's link and cookie flow, and omits `user` and `userId`.
  - T-1559: a pure hub module (`hub/src/hub/webauthn.ts`) with no surface yet. Covered by its test file only (E1536S1-16), not by a manual check.
- Decisions governing the scope: A-15078 A1 (the switch is `cland auth mode users`), A2 (hand edit back to single refused at reload and start, naming `cland auth reset`), A4 (`cland web` in users mode binds the acting first user), A5 (name slug, OS user fallback, reserved names), A7, A17 (cookies issued before the switch are revoked); `docs/spec/v0.4.md` §3.8; `docs/agents/auth.md`.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1558 C1 (init writes single; update adds the table keeping other values; other modes refused at parse) | E1536S1-02 (init), E1536S1-04 (an invalid mode refused at start), E1536S1-11 (`cland update` half: test only) |
| T-1558 C2 (`users` and `roles` tables) | E1536S1-05 (`db`), E1536S1-11 |
| T-1558 C3 (switch creates one admin from `user.name`, slug name) | E1536S1-05 |
| T-1558 C4 (repeat, reload, restart never add a first user) | E1536S1-06, E1536S1-09, E1536S1-12 |
| T-1558 C5 (`config set auth.mode` refused naming `cland auth`) | E1536S1-02 |
| T-1558 C6 (reset: single, users kept, web sessions revoked; reset hook) | E1536S1-10; the `store.users.onReset` hook by E1536S1-11 only |
| T-1558 C7 (`user list`; single-mode refusal) | E1536S1-02, E1536S1-05, E1536S1-10 |
| T-1558 C8 (CLI-only frames; gateway absence; existing tests unchanged) | E1536S1-03 and E1536S1-07 (web `auth.reset` refused); gateway absence by E1536S1-11 only; E1536S1-15 |
| A-15078 A2 and the hand-edit guard | E1536S1-04, E1536S1-09 |
| T-1559 C1–C4 | E1536S1-16 |
| T-1559 C5 (only `node:` imports; manifests unchanged) | E1536S1-16, E1536S1-17 |
| T-1560 C1 (session row records user; conversation acts as it) | E1536S1-07, E1536S1-13 |
| T-1560 C2 (users-mode link bound to the CLI's user; single unchanged) | E1536S1-07; E1536S1-03 and E1536S1-10 (single) |
| T-1560 C3 (CLI and Neovim act as the first user) | E1536S1-07 (CLI audit; a socket client saying `client: "nvim"` as Neovim does); SHELL-001 (the Neovim workbench, single mode only) |
| T-1560 C4 (`web.session` user; Profile display name) | E1536S1-07, E1536S1-08, E1536S1-14; E1536S1-03 and E1536S1-10 (no user in single) |
| T-1560 C5 (audit `userId` in users mode, none in single) | E1536S1-07; E1536S1-03 and E1536S1-10 |
| T-1560 C6 (web `as` refused; user never from the frame) | E1536S1-03, E1536S1-07 (forged `userId` in `hello` and `web.session`) |
| T-1560 C7 (nothing under `hub/src/adapters/`, `hub/src/spoke/`, `hub/src/hub/socket.ts`) | E1536S1-17 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1536` lists in stage `mode and identity`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. At writing T-1558 had landed as `487bf3371cb925af36c74243e9868985402ff544` and T-1559 as `63802800cf8b5c416217119c3f0699c4156534f3`; T-1560 was in review at branch head `2b83012f140b10a174da8560865bf975b8a188a3` on `t/T-1560-every-human-connection-acts-as-a-user` and had not landed. Its expectations below were read from that branch head; re-check them with grep at the tested build. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). E1536S1-01 builds `$W/web/dist` (ignored by Git): the scratch hub's web edge serves it and `web/test/accounts.test.ts` loads it.

**Isolation (rule 15).** Every check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its `hub.db` or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). The live hub is read only by QA's own shell for E1536S1-00's plan read and `quiet` (cover-quiet admission). **Browser (rule 18):** the only browsers are Chrome Headless Shell instances started by E1536S1-08's probe (its own scratch profile under `$Q/b`) and by `web/test/accounts.test.ts` (its own fixture); no real browser, no GUI, no computer use. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. Selectors, test titles and messages are marked verified or inferred under "Source provenance" below.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays, which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030); only E1536S1-08's probe points `TMPDIR` at `$Q/b`, so its browser profile lands there. Never use `env -i`. The scratch root lives under `/private/tmp/qa-e1536s1-` (its realpath, short enough for the scratch hub's socket).

One scratch project, **p1**: a fresh `cland init` project whose local Git config sets `user.name` to `Jane Q. Doe`, with a CLI-started hub run from the tested worktree (`$W/hub/bin/cland.ts hub start`, so its web edge serves `$W/web/dist`) with the fake `claude`, `codex` and `opencode` binaries of `hub/test/fakes/` first on its `PATH` and the machine-wide orphan sweep off. It launches no session. Its clients are the CLI, socket frame clients (the local human; `client: "nvim"` as Neovim's `hello` says), web conversations over its edge's `/ws` with cookies from one-time links, and one Headless Shell page.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-1536; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1536s1-$RUN          # the clean detached build
EV=$R/.cland/qa/E-1536/$RUN                    # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e1536s1-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e1536s1-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/b" "$Q/p1"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git and account paths; do not merely unset keys absent from it. Remove the broader credential prefixes last. The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports. Under rule 15, check zero credential-prefix names before launching any scratch process (the last line below prints a count only).

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" "$EV" > "$Q/env.sh" <<'JS'
const [m,root,worktree,ev]=process.argv.slice(2);
const {fixtureEnvironment}=await import(m);
const env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root, QA_EV: ev,
});
for(const k of Object.keys(env))if(/^(CLAND_|DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: the frame/web/db/audit/browser probe against p1 (see probe.mjs)
probe() { node "$QA_Q/probe.mjs" "$1" "$QA_Q/p1" "${@:2}"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: start this project's hub with the fake harnesses first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { env PATH="$FCC:$FCX:$FOC:$PATH" CLAND_TEST_SKIP_ORPHAN_SWEEP=1 node "$QA_W/hub/bin/cland.ts" hub start && hp >> "$QA_Q/pids"; }
# amode: the mode line of the [auth] table; setmode <value>: hand-edit that line (the edit under test), then print it
amode() { sed -n '/^\[auth\]/,/^\[/p' .cland/config.toml | grep -E '^mode = '; }
setmode() { sed -i '' -E "/^\[auth\]/,/^\[/ s/^mode = .*/mode = \"$1\"/" .cland/config.toml; amode; }
# off: the current byte size of p1's hub log, the start of an audit window
off() { wc -c < .cland/log/hub.log | tr -d ' '; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
```

The probe. It prints one JSON line per fact and never prints a link token, a cookie or the hub secret; the ones it keeps for later rows stay in `$Q` (mode 600). Its web conversations send `hello` with a forged `userId` field, as the audit test of T-1560 does, so the welcome name proves the user comes from the cookie.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> <p1 root> [arg] [arg2]   (sealed; mode profile runs with TMPDIR=$QA_Q/b, cwd $QA_W)
// sock <client> | web <tag> | again <tag> | pending <tag> | spend <tag> | db | audit <byte offset> | profile <display name> <png>
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, unlinkSync } from 'node:fs';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
const [mode, root, arg, arg2] = process.argv.slice(2);
const W = process.env.QA_W, Q = process.env.QA_Q;
if (!W || !Q || !root || !root.startsWith(`${Q}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const req = createRequire(`${W}/package.json`);
const out = (key, value) => console.log(JSON.stringify({ [key]: value }));
const LINK = /^http:\/\/127\.0\.0\.1:[0-9]+\/auth\?token=[0-9a-f]{64}$/;
// cland web --no-open from p1, as the human's CLI does; only the link's shape is printed
const mint = () => { const url = execFileSync(process.execPath, [`${W}/hub/bin/cland.ts`, 'web', '--no-open'], { cwd: root, encoding: 'utf8' }).trim(); out('linkShape', LINK.test(url)); return url; };
const pick = (type, v) => type === 'web.session' ? { user: v?.user ?? 'absent' }
  : type === 'user.list' ? { users: v.users.map(u => ({ id: u.id, name: u.name, displayName: u.displayName, role: u.role, state: u.state })) } : {};
function talk(send, onLine, close, hello, frames) {
  return new Promise(resolve => {
    const got = { welcome: null, results: {} };
    const finish = extra => { clearTimeout(timer); close(); resolve({ ...got, ...extra }); };
    const timer = setTimeout(() => finish({ timeout: true }), 10000);
    onLine(line => {
      let f; try { f = JSON.parse(line); } catch { return; }
      if (f.type === 'welcome' && got.welcome === null) {
        got.welcome = f.name;
        if (!frames.length) return finish();
        frames.forEach((frame, i) => send({ ...frame, id: `q${i + 1}` }));
      } else if (f.type === 'error') finish({ error: String(f.message) });
      else if (f.type === 'result' && /^q[0-9]+$/.test(f.id)) {
        const frame = frames[Number(f.id.slice(1)) - 1];
        got.results[`${f.id} ${frame.type}${frame.as ? ' as' : ''}`] = f.ok ? { ok: true, ...pick(frame.type, f.value) } : { ok: false, code: f.code, error: f.error };
        if (Object.keys(got.results).length === frames.length) finish();
      }
    });
    send(hello);
  });
}
async function sock(client, frames) {
  const d = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
  const s = createConnection(d.socket); s.setEncoding('utf8'); s.on('error', () => {});
  await once(s, 'connect');
  let buf = '', handler = () => {};
  s.on('data', chunk => { buf += chunk; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); handler(line); } });
  return talk(f => s.write(`${JSON.stringify(f)}\n`), fn => { handler = fn; }, () => s.end(), { type: 'hello', protocol: 2, secret: d.secret, client }, frames);
}
async function web(cookie, origin, frames) {
  const WebSocket = req('ws');
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  ws.on('error', () => {});
  const opened = await new Promise(resolve => {
    ws.once('open', () => resolve(101));
    ws.once('unexpected-response', (_r, res) => { resolve(res.statusCode); ws.terminate(); });
    setTimeout(() => resolve('timeout'), 10000);
  });
  out('upgrade', opened);
  if (opened !== 101) return null;
  return talk(f => ws.send(JSON.stringify(f)), fn => ws.on('message', data => String(data).split('\n').filter(Boolean).forEach(fn)), () => ws.close(),
    { type: 'hello', protocol: 2, client: 'web', userId: 'forged' }, frames);
}
const WEB_FRAMES = [{ type: 'web.session', userId: 'forged' }, { type: 'web.session', as: { name: 'forged' } }, { type: 'auth.reset' }, { type: 'hub.status' }];
switch (mode) {
  case 'sock': out('sock', await sock(arg, [{ type: 'hub.status' }, { type: 'user.list' }])); break;
  case 'web': {
    const url = mint();
    const r = await fetch(url, { redirect: 'manual' });
    out('redeem', r.status);
    const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0], origin = new URL(url).origin;
    writeFileSync(`${Q}/cookie-${arg}.json`, JSON.stringify({ cookie, origin }), { mode: 0o600 });
    out('web', await web(cookie, origin, WEB_FRAMES));
    break;
  }
  case 'again': { const { cookie, origin } = JSON.parse(readFileSync(`${Q}/cookie-${arg}.json`, 'utf8')); out('again', await web(cookie, origin, [{ type: 'web.session' }])); break; }
  case 'pending': writeFileSync(`${Q}/pending-${arg}`, mint(), { mode: 0o600 }); out('pending', 'saved'); break;
  case 'spend': { const url = readFileSync(`${Q}/pending-${arg}`, 'utf8'); out('spend', (await fetch(url, { redirect: 'manual' })).status); unlinkSync(`${Q}/pending-${arg}`); break; }
  case 'db': {
    const db = new DatabaseSync(`${root}/.cland/hub.db`, { readOnly: true });
    try {
      out('usersColumns', db.prepare('pragma table_info(users)').all().map(c => c.name));
      out('roles', db.prepare('select name from roles order by name').all().map(r => r.name));
      out('authState', db.prepare('select mode from auth_state').all().map(r => r.mode));
      out('users', db.prepare('select id, name, display_name, role, state from users order by created, rowid').all().map(r => ({ ...r })));
      out('webSessionUsers', db.prepare('select user_id from web_sessions order by created_at').all().map(r => r.user_id));
    } finally { db.close(); }
    break;
  }
  case 'audit': {
    await new Promise(r => setTimeout(r, 1000));
    const text = readFileSync(`${root}/.cland/log/hub.log`).subarray(Number(arg)).toString('utf8');
    for (const line of text.split('\n')) { let e; try { e = JSON.parse(line); } catch { continue; } if (e.event === 'audit') out('audit', { tool: e.tool, client: e.client, session: e.session, userId: e.userId ?? null, outcome: e.outcome }); }
    break;
  }
  case 'profile': {
    const { webPrerequisite, browserCache } = await import(`${W}/web/test/prerequisite.ts`);
    process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
    const { chromium } = req('playwright-core');
    const pre = await webPrerequisite();
    if (!pre.available) { out('unavailable', pre.reason); process.exit(3); }
    const server = await chromium.launchServer({ executablePath: pre.executablePath, headless: true, timeout: 15000 });
    const child = server.process(), group = child.pid, exited = once(child, 'exit');
    appendFileSync(`${Q}/pids`, `${group}\n`);
    out('profileInScratch', (child.spawnargs.find(a => a.startsWith('--user-data-dir=')) ?? '').startsWith(`--user-data-dir=${process.env.TMPDIR}/`));
    try {
      const browser = await chromium.connect(server.wsEndpoint(), { timeout: 15000 });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
      context.setDefaultTimeout(10000);
      const page = await context.newPage();
      await page.goto(mint());
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      const profile = page.locator('section[aria-label="Profile"]');
      await profile.getByText(arg, { exact: true }).waitFor();
      out('profileDisplayName', await profile.getByText(arg, { exact: true }).count());
      await page.screenshot({ path: arg2 }); out('screenshot', arg2);
      await context.close(); await browser.close();
    } catch (error) { out('step', String(error?.message ?? error)); }
    finally { await server.close(); await exited; }
    out('browserGroupAfter', execFileSync('ps', ['-e', '-o', 'pid=,pgid='], { encoding: 'utf8' }).split('\n').map(l => l.trim().split(/\s+/).map(Number)).filter(([, g]) => g === group).length);
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows that run in p1 call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it.

```sh
m00() {   # QA's own shell: build, membership, landings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1536 --json) > "$EV/E1536S1-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=p.stages.find(x=>x.name==="mode and identity");console.log(JSON.stringify({state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}))' "$EV/E1536S1-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name==="mode and identity").items.join(" "))' "$EV/E1536S1-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
m01() {   # sealed, in $W: build the bundle p1's edge and the Web test serve
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD)"
  ( cd "$QA_W" && npm run build --workspace web > "$QA_EV/E1536S1-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
m02() {   # p1: init, user.name, start; single-mode defaults and the refusals
  echo "PRE: p1 empty: $(ls -A | wc -l | tr -d ' ') entries; web/dist $(ls "$QA_W/web/dist/index.html")"
  git init -q -b dev && git config user.name 'Jane Q. Doe' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1536S1-02-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml) user.name=$(git config user.name)"
  amode
  hubstart; echo "hub start exit $?"
  cland user list; echo "user list exit $?"
  cland config set auth.mode users; echo "config set users exit $?"
  cland config set auth.mode single; echo "config set single exit $?"
  amode
}
m03() {   # p1: single mode unchanged (link, cookie, socket, web, audit); keeps cookie a
  echo "PRE: $(amode); hub $(up)"; o=$(off)
  probe sock nvim
  probe web a
  probe audit "$o"
}
m04() {   # p1: hand edits into users (and an invalid mode) refused at reload and start, then recovery
  echo "PRE: $(amode); hub $(up)"; probe db
  setmode users
  cland hub reload; echo "reload exit $?"
  cland user list; echo "user list exit $?"
  cland hub stop; echo "stop exit $?"
  hubstart > "$QA_EV/E1536S1-04-start-users.txt" 2>&1; echo "start (users) exit $?"
  grep -F 'users mode requires the authorized first admin; set auth.mode = "single" in' "$QA_EV/E1536S1-04-start-users.txt"
  setmode admin
  hubstart > "$QA_EV/E1536S1-04-start-admin.txt" 2>&1; echo "start (admin) exit $?"
  grep -F 'auth.mode must be single or users' "$QA_EV/E1536S1-04-start-admin.txt"
  setmode single
  hubstart; echo "start (single) exit $?"
  probe db
}
m05() {   # p1: the switch; cookie a revoked; the first user and the tables
  echo "PRE: $(amode); hub $(up)"; probe again a
  cland auth mode users; echo "switch exit $?"
  amode
  cland web --sessions; echo "sessions exit $?"
  probe again a
  cland user list; echo "user list exit $?"
  probe db
}
m06() {   # p1: repeat, reload, restart keep the same first user
  cland user list > "$QA_EV/E1536S1-06-before.txt"; echo "PRE: $(amode); hub $(up); $(grep -c '^jane-q-doe  Jane Q. Doe  admin  active$' "$QA_EV/E1536S1-06-before.txt") first-user line"
  cland auth mode users; echo "repeat exit $?"
  cland hub reload; echo "reload exit $?"
  cland hub stop; echo "stop exit $?"; hubstart; echo "start exit $?"
  cland user list > "$QA_EV/E1536S1-06-after.txt"; cmp "$QA_EV/E1536S1-06-before.txt" "$QA_EV/E1536S1-06-after.txt" && echo "user list same"
  probe db
}
m07() {   # p1: users-mode identities on every human edge; keeps cookie b
  echo "PRE: $(amode); hub $(up)"; o=$(off)
  cland hub status > /dev/null; echo "cli status exit $?"
  probe sock nvim
  probe web b
  probe db
  probe audit "$o"
}
m08() {   # p1, cwd $QA_W, TMPDIR $QA_Q/b only here: the Profile in Chrome Headless Shell
  echo "PRE: $(amode); hub $(up); dist $(ls "$QA_W/web/dist/index.html")"
  ( cd "$QA_W" && TMPDIR="$QA_Q/b" node "$QA_Q/probe.mjs" profile "$QA_Q/p1" 'Jane Q. Doe' "$QA_EV/E1536S1-08.png" )
}
m09() {   # p1: hand edit back to single refused at reload and start; the printed recovery
  echo "PRE: $(amode); hub $(up); $(cland user list | grep -c '^jane-q-doe ') first-user line"
  setmode single
  cland hub reload; echo "reload exit $?"
  cland user list; echo "user list exit $?"
  cland hub stop; echo "stop exit $?"
  hubstart > "$QA_EV/E1536S1-09-start-single.txt" 2>&1; echo "start (single) exit $?"
  grep -F 'auth.mode is single but this project is in users mode (' "$QA_EV/E1536S1-09-start-single.txt"
  setmode users
  hubstart; echo "start (users) exit $?"
  cland user list; echo "user list exit $?"
}
m10() {   # p1: the reset; cookie b and a pending link revoked; users kept; single mode again
  echo "PRE: $(amode); hub $(up)"; probe again b
  probe pending p
  o=$(off)
  cland auth reset; echo "reset exit $?"
  amode
  cland web --sessions; echo "sessions exit $?"
  probe again b
  probe spend p
  cland user list; echo "user list exit $?"
  probe db
  probe web c
  probe sock nvim
  probe audit "$o"
}
m17() {   # sealed, in $W: source boundaries of T-1560 and T-1559
  L1560=$(git -C "$QA_W" log --first-parent --format=%H --grep '^Item: T-1560$' HEAD); L1559=$(git -C "$QA_W" log --first-parent --format=%H --grep '^Item: T-1559$' HEAD)
  echo "PRE: T-1560 $L1560 T-1559 $L1559"
  echo "T-1560 forbidden paths: $(git -C "$QA_W" diff --name-only "$L1560^1" "$L1560" -- hub/src/adapters hub/src/spoke hub/src/hub/socket.ts | wc -l | tr -d ' ')"
  echo "T-1559 manifests: $(git -C "$QA_W" diff --name-only "$L1559^1" "$L1559" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
  grep -nE "^import|require\(|import\(" "$QA_W/hub/src/hub/webauthn.ts"
}
m18() {   # p1: cleanup; judge the fixture-owned census only
  cland hub stop > "$QA_EV/E1536S1-18-hubstop.txt" 2>&1; echo "hub stop exit $?"; sleep 2
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e1536s1-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). p1's secret in `$Q/p1/.cland/hub.json`, the sign-in links, the cookies and the files `cookie-*` and `pending-*` are never printed or posted. Record the setup (worktree, `$Q`, the zero credential-name count, `probe checked`) as check `S0` with `qa-record.sh note`.

## Cases

| case | surface | role | command and expected outcome |
| --- | --- | --- | --- |
| SHELL-001 | headless-grid | QA | `( . "$Q/env.sh"; cd "$QA_W" && CLAND="$QA_W/hub/bin/cland.ts" sh .agents/skills/qa/qa-record.sh run E-1536 "$RUN" SHELL-001 )` after E1536S1-01 and `quiet`. PASS (exit 0): the Neovim workbench connects to its own single-mode fixture hub, shows the empty General thread and a typed message shows queued. It is the single-mode regression of the changed `welcome` path for Neovim; it has no users-mode fixture |

### Web cases (when in scope)

none. The Profile check runs in Chrome Headless Shell (E1536S1-08 and E1536S1-14), not in a real browser; no computer use and no GUI.

## Manual checks

Run in this order; a row depends on the p1 state the rows before it leave. Rows E1536S1-11 to E1536S1-16 run one at a time from `$W` after `quiet` (cover-quiet admission; targeted files take no suite lease) and never in parallel with each other or with SHELL-001. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1536 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. "U" below is the first user's id as `probe db` prints it in E1536S1-05.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1536S1-00 | hub-api | QA | `m00 > "$EV/E1536S1-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the stage line names `mode and identity` with `qa` affected/after-stage and every member merged; each member prints exactly one landing SHA. Otherwise BLOCKED, reported to the requester, nothing else run |
| E1536S1-01 | hub-api | QA | `( . "$Q/env.sh"; m01 ) > "$EV/E1536S1-01.txt" 2>&1` | `build exit 0`, `web/dist/index.html` listed, `dirty entries 0` |
| E1536S1-02 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m02 ) > "$EV/E1536S1-02.txt" 2>&1` | PRE: p1 has no entries and the bundle exists. `init exit 0`; `lock 1 executor 1 user.name=Jane Q. Doe`; `mode = "single"` before and after; `hub start exit 0`; `user list exit 1` with `cland: use cland auth mode users before cland user commands`; both `config set` lines exit 1 with `use cland auth mode users or cland auth reset to change auth.mode` |
| E1536S1-03 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m03 ) > "$EV/E1536S1-03.txt" 2>&1` | PRE: `mode = "single"`, hub up. `sock`: welcome `nvim`; `hub.status` ok; `user.list` refused with the single-mode message. `linkShape` true; `redeem` 302; `upgrade` 101; web welcome `web` (the forged `userId` ignored); `q1 web.session` ok with `user` `absent`; `q2 web.session as` refused, code `cli-neovim-only`, error contains `acts as another identity`; `q3 auth.reset` refused, code `cli-neovim-only`, error contains `resets sign-in mode through the local CLI`; `q4 hub.status` ok. Every `audit` line has `userId` null and `session` `human`; lines with clients `cli`, `nvim` and `web` are present |
| E1536S1-04 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m04 ) > "$EV/E1536S1-04.txt" 2>&1` | PRE: single, hub up, `db` shows `users` empty and `authState` empty. `reload exit 1` with `users mode requires the authorized first admin; run cland auth mode users`; `user list exit 1` (still single); `stop exit 0`; `start (users) exit 1` and the grep prints the startup refusal naming p1's `.cland/config.toml` and ending `then run cland auth mode users`; `start (admin) exit 1` and the grep prints `auth.mode must be single or users`; `start (single) exit 0`; the final `db` still shows no users and no auth state |
| E1536S1-05 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m05 ) > "$EV/E1536S1-05.txt" 2>&1` | PRE: single, hub up, `again` with cookie a: `upgrade` 101, welcome `web`. `switch exit 0` printing `jane-q-doe  admin`; `mode = "users"`; `cland web --sessions` prints only `ID  CREATED  LAST USED  SOCKETS`, exit 0; `again` with cookie a: `upgrade` 401 (A-15078 A17); `user list exit 0` printing `NAME  DISPLAY NAME  ROLE  STATE` and `jane-q-doe  Jane Q. Doe  admin  active`; `db`: `usersColumns` `["id","name","display_name","role","state","created"]`, `roles` `["admin"]`, `authState` `["users"]`, `users` holds only the jane-q-doe row (role admin, state active); record its id as U |
| E1536S1-06 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m06 ) > "$EV/E1536S1-06.txt" 2>&1` | PRE: users, hub up, the first-user line counted once. `repeat exit 0` printing `jane-q-doe  admin`; `reload exit 0`; `stop exit 0`; `start exit 0`; `user list same`; `db` `users` holds only the row with id U |
| E1536S1-07 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m07 ) > "$EV/E1536S1-07.txt" 2>&1` | PRE: users, hub up. `cli status exit 0`. `sock` (client `nvim`): welcome `jane-q-doe`; `hub.status` ok; `user.list` ok with only U. `linkShape` true; `redeem` 302; `upgrade` 101; web welcome `jane-q-doe` although `hello` carried `userId: "forged"`; `q1 web.session` ok with `user` `{"id":U,"name":"jane-q-doe","displayName":"Jane Q. Doe","role":"admin"}`; `q2` refused `cli-neovim-only` with `acts as another identity`; `q3 auth.reset` refused `cli-neovim-only`; `q4` ok. `db` `webSessionUsers` is U for the newest row (every row present is U). Every `audit` line (clients `cli`, `nvim` and `web`, the forbidden ones included) has `userId` U and `session` `jane-q-doe` |
| E1536S1-08 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m08 ) > "$EV/E1536S1-08.txt" 2>&1` | PRE: users, hub up, bundle present. `linkShape` true; `profileInScratch` true; `profileDisplayName` 1 inside `section[aria-label="Profile"]` after the `Accounts` button; `screenshot` names `$EV/E1536S1-08.png`; no `step` line; `browserGroupAfter` 0. An `unavailable` line is BLOCKED with its reason |
| E1536S1-09 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m09 ) > "$EV/E1536S1-09.txt" 2>&1` | PRE: users, hub up, the first-user line once. `reload exit 1` with `users mode cannot return to single by editing config.toml; use cland auth reset`; `user list exit 0` (the running mode stays users); `stop exit 0`; `start (single) exit 1` and the grep prints `auth.mode is single but this project is in users mode (<n> users). To return to single mode, set auth.mode = "users" in <p1>/.cland/config.toml, start the hub, then run cland auth reset.` where `<n>` equals the rows `cland user list` printed in E1536S1-06; following that recovery, `start (users) exit 0` and `user list exit 0` with the same jane-q-doe line |
| E1536S1-10 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m10 ) > "$EV/E1536S1-10.txt" 2>&1` | PRE: users, hub up, `again` with cookie b: `upgrade` 101, welcome `jane-q-doe`; `pending` saved with `linkShape` true. `reset exit 0` printing `Sign-in mode: single`; `mode = "single"`; `--sessions` prints only its header; `again` with cookie b: `upgrade` 401; `spend` 401; `user list exit 1` naming `cland auth mode users`; `db`: `users` still holds only the U row unchanged, `authState` `["single"]`, `roles` `["admin"]`. Then single mode again: `web c` `redeem` 302, welcome `web`, `q1` `user` `absent`, `q2` and `q3` refused as in E1536S1-03; `sock` welcome `nvim`. Audit: the `auth.reset` line may carry U; every later line has `userId` null and `session` `human` |
| E1536S1-11 | hub-api | QA | `nt E1536S1-11 hub/test/users.test.ts hub/test/init-config.test.ts` | exit 0, no `not ok`, no skip; `oks` lists Tests: `the first admin is unique and reset retains attribution rows`, `first user rejects reserved and colliding names without creating a user`, `reset joins registered durable revokers in one transaction`, `new auth frames are explicitly local and absent from gateway authority`, `sign-in mode defaults survive managed update and generic settings cannot change it` |
| E1536S1-12 | hub-api | QA | `nt E1536S1-12 hub/test/auth-mode.test.ts` | exit 0, no `not ok`, no skip; `oks` lists Tests: `switch creates one first admin, reload preserves it, and reset retains it behind single-mode refusal`, `hand-edited users mode is refused before startup or reload can skip the authorized switch`, `local and cookie-authenticated human requests audit their user, including web impersonation refusal`; the file's generated reset-drain and failed-transition cases also print `ok` (their titles are template literals: read them from the log, compare with the source loops) |
| E1536S1-13 | hub-api | QA | `nt E1536S1-13 hub/test/web-auth-unit.test.ts hub/test/web-authority-unit.test.ts` | exit 0, no `not ok`, no skip; `oks` lists Tests: `a user-bound link persists its user across store restart and profile reads`, `single-mode profile keeps the previous wire shape without a user` |
| E1536S1-14 | hub-api | QA | `nt E1536S1-14 web/test/accounts.test.ts` | exit 0, no `not ok`, no skip; `oks` lists test: `Accounts profile shows the signed-in user display name in users mode`, and the file's existing single-mode profile tests pass unchanged; every `Web fixture census` line ends `after 0; scratch hub stopped` |
| E1536S1-15 | hub-api | QA | `nt E1536S1-15 hub/test/web-auth.test.ts hub/test/web-authority.test.ts hub/test/config-set.test.ts hub/test/remote-cli.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts` | exit 0, no `not ok`, no skip (T-1558 C8's unchanged single-mode web, config, remote and CLI files, plus the frozen usage and help comparisons both items migrated) |
| E1536S1-16 | hub-api | QA | `nt E1536S1-16 hub/test/webauthn.test.ts` | exit 0, no `not ok`, no skip; `oks` lists Tests: `C2 checks ceremony type, challenge, origin, cross-origin, RP and presence/verification for both ceremonies`, `C3 tampering signed bytes, identity and replay counters are refused; zero counters remain usable`, `C4 bounded CBOR refuses truncation, indefinite lengths, oversize, deep nesting, duplicates and unsupported COSE`, `C4 malformed runtime values and assertion extensions never escape the result boundary`, `C5 verifier imports only node built-ins`, `extension maps are consumed exactly; foreign keys, malformed JSON and non-none attestations are refused`, `assertion key algorithms and malformed signatures fail closed with bounded reasons`; the generated C1 registration and C3 unsigned-mutation cases print `ok` for both COSE algorithms (-7 and -8) |
| E1536S1-17 | hub-api | QA | `( . "$Q/env.sh"; m17 ) > "$EV/E1536S1-17.txt" 2>&1` | PRE line names one landing SHA for each item. `T-1560 forbidden paths: 0`; `T-1559 manifests: 0`; every import line of `hub/src/hub/webauthn.ts` names a `node:` module |
| E1536S1-18 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m18 ) > "$EV/E1536S1-18.txt" 2>&1` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`): `hub stop exit 0`; no `alive` line names a fixture process (a `cland` hub or `hub serve`, `probe.mjs`, a Headless Shell); an `alive` line whose command is unrelated is pid reuse, recorded, not a failure. Then remove `$Q` and the worktree as Build says |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request: a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint qa/briefs/E-1536-stage-1.md` with this filled brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1536-stage-1.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `bda184aadd82652d8c1d1c8877fc2ac3de35e53c` (T-1558, T-1559) and at the T-1560 branch head `2b83012f`; re-check every one at the tested build.

- Verified in source: the CLI outputs `<name>  <role>`, `Sign-in mode: single`, `NAME  DISPLAY NAME  ROLE  STATE` and the user-list row format (`hub/src/cli/auth.ts`); the refusals `use cland auth mode users before cland user commands` (`hub/src/hub/daemon.ts`), `use cland auth mode users or cland auth reset to change auth.mode` (`hub/src/init/config-set.ts`), `auth.mode must be single or users` (`hub/src/init/config.ts`, re-thrown at start by the `auth.` prefix in `daemon.ts`), and the reload and startup texts of `validateMode` (`hub/src/hub/users.ts`); the slug rule giving `jane-q-doe`; the rendered `[auth]` table; the web authority refusal code `cli-neovim-only` with `acts as another identity` and `resets sign-in mode through the local CLI` (`hub/src/hub/web-authority.ts`); upgrade 401 for an unknown cookie (`hub/src/hub/web-edge.ts`); a spent or revoked link answering 401 (asserted in `hub/test/auth-mode.test.ts`); the 64-hex link token (`web-auth.ts` `mint`); the audit line shape in `.cland/log/hub.log` (`hub/src/hub/audit.ts`). T-1560 branch: `welcome` name `humanUser()?.name ?? client`, socket edges taking the first user, `web.session`'s `user` shape, `userId`/`session` in human audit records, `web_sessions.user_id`, the Profile's `<p>` with the display name inside `section[aria-label="Profile"]`. Selector: `section[aria-label="Profile"]` (`web/src/accounts/Profile.tsx`). The `Accounts` button by role and exact name is what `web/test/accounts.test.ts` clicks (verified in that test, not by a `web/src` selector). Every test title named above is a literal title in its file (T-1560's at the branch head).
- Inferred, not verified by a run: that a refused `cland hub start` shows the thrown text in its stderr (the serve child's stderr is `.cland/log/hub.log`, whose last lines `cland hub start` prints) — if the grep in E1536S1-04 or E1536S1-09 prints nothing, read the appended `.cland/log/hub.log` before judging and record which file held the text; that the startup text names p1's absolute `.cland/config.toml` path; that a read-only `node:sqlite` open of the running hub's WAL database reads committed rows; that a Headless Shell launched with `TMPDIR` at `$Q/b` puts its `--user-data-dir` there (E-417 stage 1's walkthrough relied on it); that the `Accounts` button is reachable at a 1440×900 viewport without the More menu; that the hub accepts and ignores the extra `userId` field on `hello` and `web.session` (the audit test of T-1560 sends both); the generated test titles (template literals).

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live sign-in, live `hub.db` and live Neovim behaviour are not evidence for this stage; p1, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- `git config user.name` must be set in p1's local config: the sealed global Git config is empty, and without it the switch falls back to the OS user name (A-15078 A5). A different display name is a setup fault, not a product failure; check the PRE line of E1536S1-02.
- The hub may watch `config.toml`: a hand edit can trigger an automatic reload refusal in `.cland/log/hub.log` before the explicit `cland hub reload`. Judge the explicit command's exit and text.
- Audit lines are written when a call settles, in settle order. The `auth.reset` call itself may be recorded with the user it ran as; judge only the lines after it for single mode. Audit windows start at the byte offset `off` printed before the row's actions, never at a timestamp.
- The web welcome name and `web.session`'s `user` prove the cookie decides the user only because `hello` and `web.session` carry a forged `userId`; a probe without that field proves less.
- Exit 0 from the Node test runner with a name that matches nothing is not a pass: confirm the named tests appear on ok lines.
- Process cleanup probes use the fixture-owned census (`$Q/pids`, the probe's browser group, each Web fixture's census line), registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093).
- Edit existing keys in initialized configs (`lock_path`, `executor`, the `[auth]` `mode` line); never add a second table (A-8634 R12).
- Re-check helper, message and test names with grep at the tested build; renames happen, and T-1560 had not landed at writing.

## Out of scope

The full T3/T4 suites and the stage cover pair (the Coordinator's occasion; `task plan show` lists the cover as missing at writing). Invites and the first user's own invite link (T-1565, A-15078 A4 second half, A16); passkey and password sign-in and the WebAuthn verifier wired to any surface (stage "sign-in and pairing"); `--as <user>` on the CLI (A10) and the attribution of messages, asks, approvals and artifacts (stage "attribution and invites"); pairings and remotes per user (A3's pairing parts, A12–A14, stage "remotes for every user"); `Secure` cookies (E-1538); `cland update` on a real older project (covered by `hub/test/init-config.test.ts` only); the real Neovim workbench in users mode (no headless-grid fixture switches modes; the socket client saying `client: "nvim"` stands in, and SHELL-001 covers the workbench in single mode); a real browser, computer use, the live hub, a live restart and any change to sessions, holds or the tracker. Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. The Headless Shell instances open only p1's scratch edge (E1536S1-08) or their own Web fixtures (E1536S1-14), under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "mode and identity"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1536 stage mode and identity` or `qa not clear E-1536 stage mode and identity` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
