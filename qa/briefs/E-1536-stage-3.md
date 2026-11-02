# Stage QA brief: E-1536 stage 3 — sign-in and pairing

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`, Neovim on PATH, the suite's Chrome Headless Shell from the installed `playwright-core`). No real harness and no launched session: the scratch hub starts the fake `claude`, `codex` and `opencode` of `hub/test/fakes/` as its only harnesses and this stage launches none of them (stage 2's driver and `qa-oc` are not needed: no ask, approval or artifact is raised here).

## Stage

- Epic: E-1536 (Users and sign-in modes, under R-1530).
- Exact stage name: sign-in and pairing.
- Items, in plan order by lane: lane 1 T-1566 (The invite page with a password), then T-1567 (The sign-in page and sign-out), then T-1568 (Passkeys on the invite and sign-in pages); lane 2 T-1572 (Remote pairings belong to a user); lane 3 T-1584 (Users-mode withdrawal checks message ownership by user id). The run reads the stage's members, counts and state from `task plan show E-1536` (E1536S3-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage at the tested build.
  - T-1566, the invite page: in users mode an invite link `…/invite?token=<64 hex>` opens a page showing the user's display name and name; a password of at least 12 characters set there is stored only as a scrypt record (`scrypt$<64 hex salt>$<128 hex>`, an independent salt per user), travels only in an HTTP POST body to `/invite/register`, spends the invite, activates the user and signs the browser in with a cookie bound to that user. Refusal pages: a used, revoked, expired or unknown invite answers 400 with the reason (`used invite`, `revoked invite`, `expired invite`, `unknown invite`) and no cookie; a short password answers 400 `Password must contain at least 12 characters and at most 1024 bytes` and does not spend the invite. Every invite and sign-in path checks Host and the exact Origin (a foreign Origin is 403 `Foreign Origin`). Every cookie the edge sets (`/auth`, invite, sign-in) comes from `webSessionCookie`: `Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`, `Secure` only for a configured HTTPS origin. In single mode every invite and sign-in path answers 404 and the printed `cland web` link flow is unchanged. ADR 0003 carries the amendment "2026-11-02 amendment: users-mode browser admission".
  - T-1567, sign-in and sign-out: in users mode a page load without a valid cookie is redirected from `/` to `/signin`; the form takes a name and password (`POST /signin/password`). A wrong password, an unknown name and an invited-only name all answer 401 `Name or password is incorrect` with no cookie. `Sign out` in Profile (`POST /signout`) revokes that browser's web session, closes its sockets and returns to the sign-in page; other browsers stay signed in. `GET /signin/status` answers `{"required":<bool>}`. Single mode behaves as before.
  - T-1568 (not landed at writing; read from its branch head, see Build): the invite page offers `Create passkey` and the sign-in page `Use passkey` where WebAuthn is available (a secure context with `PublicKeyCredential`); challenges are volatile, single-use (every attempt spends one, malformed ones too) and live 120 s; the hub stores only credential id, public key and counter in `passkeys (user_id, credential_id, public_key, counter)`; a refusal answers 400 `Passkey refused` and no cookie. Where WebAuthn is unavailable the invite page offers only the password and its label carries the tooltip `Passkeys are unavailable in this browser or connection. Use a password.`. Interface note (Coordinator decision 7c5514bf, recorded on T-1568): in users mode with no HTTPS origin configured, `GET /invite` and `GET /signin` on Host `127.0.0.1:<port>` answer 302 to `http://localhost:<same port><same path and query>` with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`; the Host allow-list already accepts `localhost`; the exact-Origin checks refuse 127.0.0.1 against localhost in both directions; `GET /signin` with a valid cookie answers 302 to `/`; single mode and the printed `cland web` link flow are untouched. The printed invite URLs keep the `http://127.0.0.1:<port>/invite?token=…` shape.
  - T-1572, remote pairings: in users mode `cland remote approve <telegram|discord> <code> --user <name>` pairs the chat with that user (approval without `--user` is refused naming the flag), `cland remote unpair <messenger> --user <name>` removes only that user's binding (without `--user` it is refused naming the paired users), a new pairing of the same user and messenger replaces only that user's old one, input from a paired chat arrives as that user (the user comes from the pairing, never from the frame), the `pairing-approved` journal record carries the paired user's id and the approving user's id and never the code, and `cland auth reset` keeps the first user's pairing per messenger (moving it to the single-mode `remote_pairings` row) and drops the others. Outbound fan-out is stage 4. The Neovim pairing card asks for the user.
  - T-1584, withdrawal: in users mode `topic.withdraw` compares the persisted message user id with the trusted caller's user id, never the display name; another user's message is refused with `cannot withdraw: message ownership requires its author (legacy messages require admin)`; a message with no persisted user id (written in single mode) reads as the first user's with `legacyUser` true and is withdrawable by an admin only; the web message block offers `Withdraw` only for the viewer's own messages (and legacy messages to an admin). Single mode keeps the `from` `human` fence.
- Decisions governing the scope: A-15078 A3 (reset revokes open invites and other users' pairings), A9 (sign-in failure delay), A12 (the `--user` selector, extended to unpair by the Coordinator on T-1572); `docs/spec/v0.4.md` §3.8; `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md` (the 2026-11-02 amendment); `docs/agents/auth.md`; the coordinator decisions recorded on T-1568 (7c5514bf, the 127→localhost redirect) and T-1572 (2026-11-02 05:38Z, `remote.unpair` requires `--user`).

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1566 C1 (invite page shows the user; the password signs the browser in as that user) | E1536S3-09 (Headless Shell, `Jane Q. Doe`); E1536S3-11 (`Alex Smith`, no WebAuthn); E1536S3-03; E1536S3-04 |
| T-1566 C2 (scrypt with a per-user salt; POST body only; never a frame, log line or journal) | E1536S3-03; E1536S3-09 and E1536S3-11 (`passwords`: scrypt shape, distinct salts; `frameSecretHits` 0); E1536S3-17 and E1536S3-18 (scan: zero hits) |
| T-1566 C3 (used, expired, unknown invite: refusal naming which, no cookie) | E1536S3-08 (unknown, revoked, expired); E1536S3-09 (used); E1536S3-03 |
| T-1566 C4 (Host and exact Origin, foreign Origin 403) | E1536S3-08; E1536S3-03 |
| T-1566 C5 (one cookie helper, existing flags) | E1536S3-01 (no other `Set-Cookie` writer); E1536S3-07 (`/auth`); E1536S3-09; E1536S3-13 (invite, sign-in and link flags equal) |
| T-1566 C6 (single mode: invite paths 404, link flow unchanged) | E1536S3-07; E1536S3-16; E1536S3-04 (unedited `web-auth` file) |
| T-1566 C7 (ADR 0003 amendment) | E1536S3-01 |
| T-1567 C1 (users mode: sign-in page without a cookie; correct credentials sign in) | E1536S3-12; E1536S3-08 (`/` redirect); E1536S3-04 |
| T-1567 C2 (one refusal for wrong password, unknown name, invited-only name) | E1536S3-12; E1536S3-03 |
| T-1567 C3 (sign-out revokes that browser, closes its sockets, others stay) | E1536S3-12 (browser); E1536S3-13 (sockets, other session); E1536S3-04 |
| T-1567 C4 (single mode unchanged; connection and phone-disconnected tests unchanged) | E1536S3-07; E1536S3-16; E1536S3-04; E1536S3-01 (files unedited) |
| T-1567 C5 (colour and contrast, no key listener outside `keymap.ts`) | E1536S3-01; E1536S3-02 |
| T-1568 C1 (passkey registered on the invite page, signed in, invite consumed) | E1536S3-10; E1536S3-04 |
| T-1568 C2 (passkey sign-in from a fresh context) | E1536S3-10; E1536S3-04 |
| T-1568 C3 (replay, challenge used twice or expired, other user's credential refused) | E1536S3-10 (including a real 125 s wait); E1536S3-04 |
| T-1568 C4 (`hub.db` holds only id, public key, counter; no frame, log or journal carries a response) | E1536S3-10 (`passkeys`, `frameSecretHits`); E1536S3-17 and E1536S3-18 (scan); E1536S3-04 |
| T-1568 C5 (no WebAuthn: password only, tooltip) | E1536S3-11; E1536S3-04 |
| T-1568 C6 (`package.json` and lockfiles unchanged) | E1536S3-01 |
| T-1568 interface (127→localhost redirect, no-store, no-referrer, exact-Origin) | E1536S3-08; E1536S3-09; E1536S3-10; E1536S3-07 and E1536S3-16 (single mode untouched) |
| T-1572 C1 (`remote approve … --user`; approval without it refused naming the flag) | E1536S3-06 only (a live pairing code needs a messenger; the scratch hub has none); E1536S3-15 (the unpair selector and the code-lookup refusal) |
| T-1572 C2 (Neovim pairing card asks for the user) | E1536S3-06 only (headless Neovim test; no Neovim surface on the scratch hub) |
| T-1572 C3 (two users, two Telegram chats, input as each user) | E1536S3-06 only (fake native Telegram in the test) |
| T-1572 C4 (a new pairing replaces only that user's old one) | E1536S3-06 |
| T-1572 C5 (`pairing-approved` journal record: both ids, never the code) | E1536S3-06 |
| T-1572 C6 (gateway authority table unchanged; the user comes from the pairing) | E1536S3-06 |
| T-1572 C7 (single-mode pairing, replacement, inbound tests unchanged) | E1536S3-06; E1536S3-01 (additions only) |
| T-1572 C8 (`auth reset` keeps the first user's pairing, drops the others) | E1536S3-06; E1536S3-15 and E1536S3-16 (planted pairings, fixture) |
| T-1584 C1 (author can withdraw; id compared with the trusted caller) | E1536S3-14; E1536S3-05 |
| T-1584 C2 (another user's withdrawal refused naming ownership; message unchanged) | E1536S3-14; E1536S3-05 |
| T-1584 C3 (web offers Withdraw only on own messages; single mode unchanged) | E1536S3-14 (desktop and phone); E1536S3-07 and E1536S3-16 (single mode); E1536S3-05 |
| T-1584 C4 (message without a user id withdrawable only by an admin) | E1536S3-14 (a stored non-admin role is refused naming the role; admin succeeds); E1536S3-05 |
| T-1584 C5 (no decision reads the display name) | E1536S3-14 (alex and dana share `Alex Smith`); E1536S3-05 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1536` lists in stage `sign-in and pairing`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. At writing, dev was `b8b1a95be01a62cba4a0d986d677b1bb2dbb9c0a` and these had landed: T-1566 `bc8c9a73cfb2bede9f1192bdc416dc61bcabd68d`, T-1567 `bb2302625dc6f2bb562c1302b573f3f87a9c0ff0`, T-1572 `114afd57ae3ca982efd4f2ade06cb794a408dab6`, T-1584 `2f034f402cd510160dcb9e33dcb61334aa0c988c`. T-1568 had not landed: its branch `t/T-1568-passkeys-on-the-invite-and-sign-in-pages` stood at head `188081c8656cb5560369361aca6ccd9391e44bcc` (reviewed clear on source and evidence), and the passkey expectations below were read from that head. The request names a dev SHA that includes the T-1568 landing; a dev SHA without it is BLOCKED (E1536S3-00). Re-check every string with grep at the tested build, and re-read T-1568's landing (`git show --stat`) before judging, since review may still change it. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). E1536S3-02 builds `$W/web/dist` (ignored by Git): the scratch hub's web edge serves it and the Web test files load it.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its `hub.db` or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). The live hub is read only by QA's own shell for E1536S3-00's plan read and `quiet` (cover-quiet admission). **Harnesses:** only the fakes in `$W/hub/test/fakes/` are named (`CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, first on the scratch hub's `PATH`); no session is launched; no real Claude Code, Codex or OpenCode, no login, no provider. **Browser (rule 18):** the only browsers are Chrome Headless Shell instances started by the probe's browser modes (each with its own scratch profile under `$Q/b`, and for passkeys Chromium's CDP virtual authenticator, `WebAuthn.enable` and `WebAuthn.addVirtualAuthenticator`, exactly as `web/test/passkeys.test.ts` does) and by the Web test files (their own fixtures); no real browser, no GUI, no computer use. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. Messages, selectors and test titles are marked verified or inferred under "Source provenance" below. **Secrets:** the hub secret, sign-in links, cookies, invite tokens, passwords, challenges and assertion parts are never printed, posted or written under `$EV`; the probe prints a token's length and the first 12 hex of its SHA-256 digest, a Location with its token masked as `<t64>`, and counts only. The values it must keep for the later scan stay in `$Q` (mode 600).

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, runs the named test files through `nt` (which seals each run) and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. That file holds the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays, then `scratchGitEnvironment` (same module) with a scratch `core.excludesFile`. It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable, and keeps `PATH`, `SHELL`, `TERM` and `TMPDIR`. It synthesizes its own scratch values under `$Q`: HOME, XDG, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, the `FAKE_*_HOME` directories, `CLAND_EXECUTOR_STATE`, the messenger sentinels and `CLAND_TEST_OWNED_ROOT`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030); only the probe's browser modes point `TMPDIR` at `$Q/b`. Never use `env -i`. The scratch root lives under `/private/tmp/qa-e1536s3-` (its realpath, short enough for the scratch hub's socket).

One scratch project, **p1**: a fresh `cland init` project whose local Git config sets `user.name` to `Jane Q. Doe`, with a CLI-started hub run from the tested worktree (`$W/hub/bin/cland.ts hub start`, so its web edge serves `$W/web/dist`), the fakes first on its `PATH` and authoritative through `CLAND_*_BIN`, and the machine-wide orphan sweep off. It has no `[web] origin`, so the edge has no HTTPS origin and no `Secure` cookie. Its actors:
- the local human (the CLI, and socket frame clients saying `client: "nvim"` as Neovim does), which acts as the first user `jane-q-doe` in users mode;
- web conversations over the edge's `/ws` with cookies the sign-in and invite pages issued;
- Headless Shell pages (the sign-in, invite and withdraw checks).

No coordinator session exists, so a human message addressed to `coordinator` stays queued, which is what makes it withdrawable (the withdrawal tests do the same). Users, created with `cland auth mode users` (the first user, active from the switch) and `cland user add`, and given a credential and a session only through the pages built in this stage (nothing is planted active this time): **jane-q-doe** (`Jane Q. Doe`, the switch's invite, which gives it a password), **alex** (`Alex Smith`, activated by a passkey), **dana** (`Alex Smith` too, activated by a password in a browser without WebAuthn), **bob** (`bob`, stays invited), **cleo** (`cleo`, two invites: the first revoked by the second, the second then expired by a fixture write).

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-1536; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1536s3-$RUN          # the clean detached build
EV=$R/.cland/qa/E-1536/$RUN                    # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e1536s3-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e1536s3-…
chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/b" "$Q/p1" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be 10 or below before each test file (docs/agents/tests.md load rule); prints free disk space too
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l; free kB $(df -k "${TMPDIR:-/var/tmp}" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10 after 10 minutes: $l"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet and ld; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git, account and fake-harness paths; do not merely unset keys absent from it. Then apply `scratchGitEnvironment`, and remove the broader credential prefixes last. The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports. Under rule 15, check zero credential-prefix names before launching any scratch process (the last lines below print a count and variable names only, never values).

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" "$EV" > "$Q/env.sh" <<'JS'
const [m,root,worktree,ev]=process.argv.slice(2);
const {fixtureEnvironment,scratchGitEnvironment}=await import(m);
let env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root, QA_EV: ev,
});
env=scratchGitEnvironment(root,env,{excludesFile:`${root}/home/.gitignore-global`});
for(const k of Object.keys(env))if(/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: the frame/http/db/scan probe against p1 (see probe.mjs); bprobe: the browser modes (cwd $QA_W, TMPDIR=$QA_Q/b)
probe() { node "$QA_Q/probe.mjs" "$1" "$QA_Q/p1" "${@:2}"; }
bprobe() { ( cd "$QA_W" && TMPDIR="$QA_Q/b" node "$QA_Q/probe.mjs" "$1" "$QA_Q/p1" "${@:2}" ); }
# pick <expr> [args…]: evaluate <expr> on the JSON read from stdin as v, with the extra args as A
pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const A=process.argv.slice(2);const r=eval(process.argv[1]);console.log(typeof r==="string"?r:JSON.stringify(r))})' "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: start this project's hub with the fakes authoritative and first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { env PATH="$FCC:$FCX:$FOC:$PATH" CLAND_CLAUDE_BIN="$FCC/claude" CLAND_CODEX_BIN="$FCX/codex" CLAND_OPENCODE_BIN="$FOC/opencode" CLAND_TEST_SKIP_ORPHAN_SWEEP=1 CLAND_ADAPTER_POLL_MS=200 CLAND_CLAUDE_AGENTS_MS=500 node "$QA_W/hub/bin/cland.ts" hub start && hp >> "$QA_Q/pids"; }
amode() { sed -n '/^\[auth\]/,/^\[/p' .cland/config.toml | grep -E '^mode = '; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
# run <label> <cland args…>: exit status, stdout and stderr of one CLI call (used only where no token can print: never for user add, user invite or auth mode users)
run() { l=$1; shift; cland "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; sed 's/^/  out: /' "$QA_Q/r.out"; sed 's/^/  err: /' "$QA_Q/r.err"; }
# ishape <file>: an invite URL line's shape, its token length and the first 12 hex of the token's SHA-256 (never the token)
ishape() { node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8").trim();const m=t.match(/^http:\/\/127\.0\.0\.1:[0-9]+\/invite\?token=([0-9a-f]+)$/);console.log(m?"shape ok, token length "+m[1].length+", digest12 "+require("crypto").createHash("sha256").update(m[1]).digest("hex").slice(0,12):"shape mismatch")' "$1"; }
# idsj <out> <label>=<saved name>…: write {"label":"<id saved in $QA_Q/<saved name>>"} to $QA_Q/<out>; a missing file is skipped and named
idsj() { node -e 'const fs=require("fs"),Q=process.env.QA_Q,r={};for(const a of process.argv.slice(2)){const i=a.indexOf("="),f=Q+"/"+a.slice(i+1);if(fs.existsSync(f))r[a.slice(0,i)]=fs.readFileSync(f,"utf8").trim();else console.log("missing "+a)}fs.writeFileSync(Q+"/"+process.argv[1],JSON.stringify(r));console.log(Object.keys(r).join(", "))' "$@"; }
# uinv <label> <user args…>: cland user add|invite; prints exit, the first stdout line and stderr; the URL line goes to $QA_Q/invite-<label> (mode 600), only its shape is printed
uinv() { f=$1; shift; cland user "$@" > "$QA_Q/u.out" 2> "$QA_Q/u.err"; x=$?; echo "user $1 $2 exit $x: $(head -n 1 "$QA_Q/u.out") err: $(cat "$QA_Q/u.err")"; sed -n 2p "$QA_Q/u.out" > "$QA_Q/invite-$f"; chmod 600 "$QA_Q/invite-$f"; echo "  invite-$f line: $(ishape "$QA_Q/invite-$f")"; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
```

The probe. It prints one JSON line per fact and never prints a link, an invite token, a cookie, a password, a challenge, an assertion part or the hub secret; the ones it keeps for later rows stay in `$Q` (mode 600: `invite-*`, `cookie-*.json`, `pw-*`, `secrets3.json`). Frame lists are JSON arrays. A string value `"@file:<name>"` becomes the trimmed text of `$QA_Q/<name>`, `"@pw:<user>"` the password the probe generated for that user, and `@token:<invite label>` inside a path or body string that invite's token. `"@random64"` is a fresh random 64-hex token. A `topic.send` frame's `qaSave: [<name>, <dotted path>]` is not sent: after the send succeeds the probe reads `topic.history` for that topic and saves the id of the newest message with exactly that text to `$QA_Q/<name>`, one id per file with a trailing newline (rule 22: created ids come from topic history, never from a `send` result); it prints `saved` with `matches` and `found`, and saves nothing when no message matches. The dotted path is kept for reference only. Web conversations send `hello` with a forged `userId` field, so the welcome name proves the user comes from the cookie. The `facts()` order is the corrected one of commit 8807f67a (the `inbox.list` branch before the `messages` branch); keep it.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> <p1 root> [args…]   (sealed; the browser modes run with cwd $QA_W and TMPDIR=$QA_Q/b)
// sock <frames> | web <tag> [frames] | wsend <tag> <frames> | h <requests> | expire <invite label> | db | scan3
// invpage <invite label> <user> <display> <png> <noWebAuthn 0|1> | passkeys <invite label> <user> <display> <png>
// signinshot <png> <phone 0|1> | session <user> <display> <png> | wsout <tag A> <tag B> | withdrawui <ids file> <png> <phone 0|1> <cookie tag|link>
// plantpair <names> | pairdb
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const [mode, root, a1, a2, a3, a4, a5] = process.argv.slice(2);
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV;
if (!W || !Q || !root || !root.startsWith(`${Q}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const req = createRequire(`${W}/package.json`);
const out = (key, value) => console.log(JSON.stringify({ [key]: value }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const LINK = /^http:\/\/127\.0\.0\.1:[0-9]+\/auth\?token=[0-9a-f]{64}$/;
const general = 'general';
const token = label => (readFileSync(`${Q}/invite-${label}`, 'utf8').trim().match(/\/invite\?token=([0-9a-f]{64})$/) ?? [])[1] ?? '';
const sub = s => s.replace(/@token:([A-Za-z0-9-]+)/g, (_, l) => token(l)).replace(/@random64/g, () => randomBytes(32).toString('hex'));
const fill = v => typeof v === 'string' ? (v.startsWith('@file:') ? readFileSync(`${Q}/${v.slice(6)}`, 'utf8').trim() : v.startsWith('@pw:') ? readFileSync(`${Q}/pw-${v.slice(4)}`, 'utf8').trim() : sub(v))
  : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
// secrets kept only for the scan: kind, label, value (never printed)
const addSecret = (kind, label, value) => {
  if (typeof value !== 'string' || value.length < 12) return;
  const file = `${Q}/secrets3.json`, list = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  list.push({ kind, label, value }); writeFileSync(file, JSON.stringify(list), { mode: 0o600 });
};
const newPassword = user => { const pw = `qa3-${user}-${randomBytes(12).toString('hex')}`; writeFileSync(`${Q}/pw-${user}`, pw, { mode: 0o600 }); addSecret('password', user, pw); return pw; };
// the web edge port, from `cland hub status` (the line `web      http://127.0.0.1:<port>/`)
const port = () => { const m = execFileSync(process.execPath, [`${W}/hub/bin/cland.ts`, 'hub', 'status'], { cwd: root, encoding: 'utf8' }).match(/web\s+http:\/\/[^\s:/]+:(\d+)\//); if (!m) throw new Error('no web edge address in hub status'); return Number(m[1]); };
const mask = s => s === undefined || s === null ? null : String(s).replace(/[0-9a-f]{64}/g, '<t64>');
const shape = header => { const first = [].concat(header ?? [])[0]; if (!first) return null; const [pair, ...attrs] = first.split(';').map(s => s.trim()); const [name, value = ''] = pair.split('='); return { nameOk: /^cland_[0-9a-f]{12}$/.test(name), valueLength: value.length, attrs }; };
// one raw HTTP request to the edge on 127.0.0.1 with a chosen Host and Origin
const call = (p, { method = 'GET', path, host, origin, json, cookie }) => new Promise((resolve, reject) => {
  const body = json === undefined ? null : JSON.stringify(json);
  const headers = { Host: host ?? `localhost:${p}`, ...(origin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) };
  const r = httpRequest({ host: '127.0.0.1', port: p, method, path, headers, timeout: 10000 }, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })); });
  r.on('timeout', () => r.destroy(new Error('timeout'))); r.on('error', reject); if (body) r.write(body); r.end();
});
// cland web --no-open from p1, as the human's CLI does; only the link's shape is printed
const mint = () => { const url = execFileSync(process.execPath, [`${W}/hub/bin/cland.ts`, 'web', '--no-open'], { cwd: root, encoding: 'utf8' }).trim(); out('linkShape', LINK.test(url)); return url; };
const msg = m => ({ id: m.id, text: m.text, from: m.from, fromKind: m.fromKind, userId: m.userId ?? null, userDisplayName: m.userDisplayName ?? null, legacyUser: m.legacyUser ?? null, stage: m.stage ?? null, withdrawable: m.withdrawable ?? null, answerTo: m.answerTo ?? null });
const facts = v => {
  if (!v || typeof v !== 'object') return { value: v ?? null };
  if (v.message) return { message: msg(v.message) };
  if (Array.isArray(v.approvals) && Array.isArray(v.archive)) return { approvals: v.approvals.map(r => r.id), archive: v.archive.filter(r => r.outcome).map(r => r.id), messages: (v.messages ?? []).filter(m => String(m.text ?? '').startsWith('QA')).map(msg) };  // inbox.list: before the messages branch, or approvals, asks and archive are lost
  if (Array.isArray(v.messages)) return { messages: v.messages.filter(m => String(m.text ?? '').startsWith('QA')).map(msg) };
  if (Array.isArray(v.users)) return { users: v.users.map(u => ({ id: u.id, name: u.name, displayName: u.displayName, role: u.role, state: u.state })) };
  if (v.user) return { user: { id: v.user.id, name: v.user.name, displayName: v.user.displayName, role: v.user.role, state: v.user.state } };
  if (v.topic) return { topic: { id: v.topic.id, title: v.topic.title } };
  return { keys: Object.keys(v).sort() };
};
const setRole = (name, role) => {
  const db = new DatabaseSync(`${root}/.cland/hub.db`);
  try {
    db.prepare('insert or ignore into roles (name) values (?)').run(role);
    db.prepare('update users set role=? where name=?').run(role, name);
    if (role === 'admin') db.prepare("delete from roles where name='qa-test-role'").run();
    out('role', { name, role: db.prepare('select role from users where name=?').get(name)?.role ?? null, roles: db.prepare('select name from roles order by name').all().map(r => r.name) });
  } finally { db.close(); }
};
// one conversation: hello, then each frame in order, waiting for its result
async function converse(send, onLine, close, hello, frames) {
  const waiters = [];
  onLine(line => { let f; try { f = JSON.parse(line); } catch { return; } for (const w of [...waiters]) if (w.test(f)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(f); } });
  const wait = (test, ms) => new Promise(resolve => { const w = { test, resolve }; waiters.push(w); setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); resolve(null); } }, ms); });
  const welcomed = wait(f => f.type === 'welcome' || f.type === 'error', 15000);
  send(hello);
  const w = await welcomed;
  out('welcome', w?.type === 'welcome' ? w.name : { error: w?.message ?? 'timeout' });
  if (w?.type !== 'welcome') { close(); return; }
  for (let i = 0; i < frames.length; i++) {
    const { qaSave, ...frame } = { ...fill(frames[i]), id: `q${i + 1}` };
    if (frame.type === 'qa.role') { setRole(frame.name, frame.role); continue; }
    const got = wait(f => f.type === 'result' && f.id === frame.id, 30000);
    send(frame);
    const r = await got;
    out(`${frame.id} ${frame.type}`, r === null ? { timeout: true } : r.ok ? { ok: true, ...facts(r.value) } : { ok: false, code: r.code ?? null, error: r.error ?? null });
    if (qaSave && r?.ok) {  // rule 22: the created id comes from topic history, never from the send result
      const hid = `${frame.id}h`, hist = wait(f => f.type === 'result' && f.id === hid, 30000);
      send({ type: 'topic.history', topic: frame.topic, id: hid });
      const h = await hist, mine = (h?.ok ? h.value.messages ?? [] : []).filter(m => m.text === frame.text);
      const id = mine.length ? mine[mine.length - 1].id : null;
      out('saved', { name: qaSave[0], fromHistory: true, matches: mine.length, found: id !== null });
      if (id !== null) writeFileSync(`${Q}/${qaSave[0]}`, `${id}\n`);
    }
  }
  close();
}
async function sock(frames) {
  const d = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
  const s = createConnection(d.socket); s.setEncoding('utf8'); s.on('error', () => {});
  await once(s, 'connect');
  let buf = '', handler = () => {};
  s.on('data', chunk => { buf += chunk; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); handler(line); } });
  await converse(f => s.write(`${JSON.stringify(f)}\n`), fn => { handler = fn; }, () => s.end(), { type: 'hello', protocol: 2, secret: d.secret, client: 'nvim' }, frames);
}
async function web(tag, frames) {
  const { cookie, origin } = JSON.parse(readFileSync(`${Q}/cookie-${tag}.json`, 'utf8'));
  const WebSocket = req('ws');
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  ws.on('error', () => {});
  const opened = await new Promise(resolve => {
    ws.once('open', () => resolve(101));
    ws.once('unexpected-response', (_r, res) => { resolve(res.statusCode); ws.terminate(); });
    setTimeout(() => resolve('timeout'), 10000);
  });
  out('upgrade', opened);
  if (opened !== 101) return;
  await converse(f => ws.send(JSON.stringify(f)), fn => ws.on('message', data => String(data).split('\n').filter(Boolean).forEach(fn)), () => ws.close(),
    { type: 'hello', protocol: 2, client: 'web', userId: 'forged' }, frames);
}
// a raw socket for the sign-out check: hello, then lines collected
async function wsOpen(tag) {
  const { cookie, origin } = JSON.parse(readFileSync(`${Q}/cookie-${tag}.json`, 'utf8'));
  const WebSocket = req('ws');
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  const lines = []; ws.on('error', () => {});
  ws.on('message', d => String(d).split('\n').filter(Boolean).forEach(l => { try { lines.push(JSON.parse(l)); } catch { /* not a frame */ } }));
  const closed = new Promise(resolve => ws.once('close', code => resolve(code)));
  const status = await new Promise(resolve => { ws.once('open', () => resolve(101)); ws.once('unexpected-response', (_r, res) => { resolve(res.statusCode); ws.terminate(); }); setTimeout(() => resolve('timeout'), 10000); });
  return { ws, lines, closed, status };
}
const waitLine = async (c, test, ms = 10000) => { const until = Date.now() + ms; while (Date.now() < until) { const f = c.lines.find(test); if (f) return f; await sleep(100); } return null; };
// a Headless Shell instance with its own scratch profile; body(browser) does the checks
async function withBrowser(body) {
  const { webPrerequisite, browserCache } = await import(`${W}/web/test/prerequisite.ts`);
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
  const { chromium } = req('playwright-core');
  const pre = await webPrerequisite();
  if (!pre.available) { out('unavailable', pre.reason); process.exit(3); }
  const server = await chromium.launchServer({ executablePath: pre.executablePath, headless: true, timeout: 15000 });
  const child = server.process(), group = child.pid, exited = once(child, 'exit');
  appendFileSync(`${Q}/pids`, `${group}\n`);
  out('profileInScratch', (child.spawnargs.find(a => a.startsWith('--user-data-dir=')) ?? '').startsWith(`--user-data-dir=${process.env.TMPDIR}/`));
  try { const browser = await chromium.connect(server.wsEndpoint(), { timeout: 15000 }); await body(browser); await browser.close(); }
  catch (error) { out('step', String(error?.message ?? error)); }
  finally { await server.close(); await exited; }
  out('browserGroupAfter', execFileSync('ps', ['-e', '-o', 'pid=,pgid='], { encoding: 'utf8' }).split('\n').map(l => l.trim().split(/\s+/).map(Number)).filter(([, g]) => g === group).length);
}
const newContext = async (browser, phone) => {
  const c = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } }), serviceWorkers: 'block' });
  c.setDefaultTimeout(15000); return c;
};
const track = (page, bucket) => page.on('websocket', ws => { ws.on('framesent', e => bucket.push(String(e.payload))); ws.on('framereceived', e => bucket.push(String(e.payload))); });
const frameHits = (bucket, secrets) => { const text = bucket.join('\n'); return secrets.filter(s => typeof s === 'string' && s.length >= 12 && text.includes(s)).length; };
const cookieFacts = async ctx => (await ctx.cookies()).filter(c => /^cland_[0-9a-f]{12}$/.test(c.name)).map(c => { addSecret('cookie', 'browser', c.value); return { host: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, days: Math.round((c.expires - Date.now() / 1000) / 86400) }; });
const profile = async (page, display) => { await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('region', { name: 'Profile', exact: true }).getByText(display, { exact: true }).waitFor(); out('profileShows', display); };
const signIn = page => page.getByRole('button', { name: 'Sign in', exact: true });
const PASSKEY = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true };
switch (mode) {
  case 'sock': await sock(JSON.parse(a1)); break;
  case 'web': {
    const url = mint();
    const r = await fetch(url, { redirect: 'manual' });
    out('redeem', r.status);
    out('cookie', shape(r.headers.getSetCookie()));
    writeFileSync(`${Q}/cookie-${a1}.json`, JSON.stringify({ cookie: (r.headers.get('set-cookie') ?? '').split(';')[0], origin: new URL(url).origin }), { mode: 0o600 });
    out('redeemAgain', (await fetch(url, { redirect: 'manual' })).status);
    await web(a1, a2 ? JSON.parse(a2) : []);
    break;
  }
  case 'wsend': await web(a1, JSON.parse(a2)); break;
  case 'h': {
    // h <requests>: {label, method, path, host: localhost|127|foreign, origin: localhost|127|foreign, json, cookie: <tag>, save: <tag>, expectLocal}
    const p = port();
    const hosts = { localhost: `localhost:${p}`, 127: `127.0.0.1:${p}`, foreign: 'foreign.example' };
    const origins = { localhost: `http://localhost:${p}`, 127: `http://127.0.0.1:${p}`, foreign: 'https://foreign.example' };
    for (const item of JSON.parse(a1)) {
      const f = fill(item);
      const cookie = f.cookie ? JSON.parse(readFileSync(`${Q}/cookie-${f.cookie}.json`, 'utf8')).cookie : undefined;
      const r = await call(p, { method: f.method ?? 'GET', path: f.path, host: hosts[f.host ?? 'localhost'], origin: f.origin ? origins[f.origin] : undefined, json: f.json, cookie });
      let error = null, fields = null;
      try { const j = JSON.parse(r.body); error = j.error ?? null; if (j.name !== undefined) fields = { name: j.name, displayName: j.displayName ?? null }; if (typeof j.required === 'boolean') fields = { required: j.required }; if (j.ok === true) fields = { ok: true }; } catch { /* not JSON */ }
      const type = String(r.headers['content-type'] ?? '');
      out(f.label, { status: r.status, location: mask(r.headers.location), sameTarget: f.expectLocal ? r.headers.location === `http://localhost:${p}${f.path}` : undefined, cache: r.headers['cache-control'] ?? null, referrer: r.headers['referrer-policy'] ?? null, allow: r.headers.allow ?? null, cookie: shape(r.headers['set-cookie']), error: error ?? (type.startsWith('text/plain') ? r.body.slice(0, 80) : null), fields, html: /^\s*<!doctype html/i.test(r.body) });
      const set = [].concat(r.headers['set-cookie'] ?? [])[0];
      if (f.save && set) { writeFileSync(`${Q}/cookie-${f.save}.json`, JSON.stringify({ cookie: set.split(';')[0], origin: origins.localhost }), { mode: 0o600 }); addSecret('cookie', f.save, set.split(';')[0].split('=')[1]); out(`${f.label} saved`, f.save); }
    }
    break;
  }
  case 'expire': {
    // fixture: an invite whose 24 h passed (the hub reads hub.db on its next request); the hub's own clock cannot be advanced from a scratch run
    const db = new DatabaseSync(`${root}/.cland/hub.db`);
    try { out('expired', { label: a1, changes: Number(db.prepare('update user_invites set expires=0 where digest=?').run(createHash('sha256').update(token(a1)).digest('hex')).changes) }); } finally { db.close(); }
    break;
  }
  case 'db': {
    const db = new DatabaseSync(`${root}/.cland/hub.db`, { readOnly: true });
    try {
      const names = Object.fromEntries(db.prepare('select id, name from users').all().map(r => [r.id, r.name]));
      out('users', db.prepare('select id, name, display_name, role, state from users order by created, rowid').all().map(r => ({ ...r })));
      out('roles', db.prepare('select name from roles order by name').all().map(r => r.name));
      out('authState', db.prepare('select mode from auth_state').all().map(r => r.mode));
      out('invites', db.prepare('select u.name as name, i.digest as digest, i.expires as expires, i.state as state from user_invites i join users u on u.id = i.user_id order by i.rowid').all()
        .map(r => ({ name: r.name, digestLength: String(r.digest).length, digest12: String(r.digest).slice(0, 12), state: r.state, hoursLeft: Math.round((Number(r.expires) - Date.now()) / 36e3) / 100 })));
      const pw = db.prepare('select user_id, hash from user_passwords').all();
      out('passwords', { rows: pw.length, users: pw.map(r => names[r.user_id]), allScryptShape: pw.every(r => /^scrypt\$[0-9a-f]{64}\$[0-9a-f]{128}$/.test(String(r.hash))), distinctSalts: new Set(pw.map(r => String(r.hash).split('$')[1])).size === pw.length, columns: db.prepare('pragma table_info(user_passwords)').all().map(c => c.name) });
      out('passkeyColumns', db.prepare('pragma table_info(passkeys)').all().map(c => c.name));
      out('passkeys', db.prepare('select user_id, credential_id, public_key, counter from passkeys').all().map(r => ({ user: names[r.user_id], credentialIdLength: String(r.credential_id).length, publicKeyPem: String(r.public_key).startsWith('-----BEGIN PUBLIC KEY-----'), counter: Number(r.counter) })));
      out('webSessions', db.prepare('select user_id, count(*) as n from web_sessions group by user_id').all().map(r => ({ user: names[r.user_id] ?? null, n: Number(r.n) })));
      out('tables', db.prepare("select name from sqlite_master where type='table' order by name").all().map(r => r.name));
    } finally { db.close(); }
    break;
  }
  case 'plantpair': {
    // fixture: telegram pairings for the named users, as a hub that had paired them would hold (no messenger exists in the scratch run)
    const db = new DatabaseSync(`${root}/.cland/hub.db`);
    try {
      let n = 1000;
      for (const name of JSON.parse(a1)) { n += 1; db.prepare('insert into user_remote_pairings values (?,?,?,?,?,?)').run('telegram', db.prepare('select id from users where name=?').get(name).id, String(n), String(n), null, `QA ${name}`); }
      out('planted', db.prepare('select u.name as name, p.messenger_user_id as native from user_remote_pairings p join users u on u.id = p.user_id order by p.messenger_user_id').all().map(r => ({ ...r })));
    } finally { db.close(); }
    break;
  }
  case 'pairdb': {
    const db = new DatabaseSync(`${root}/.cland/hub.db`, { readOnly: true });
    try {
      out('userPairings', db.prepare('select u.name as name, p.messenger as messenger, p.messenger_user_id as native from user_remote_pairings p join users u on u.id = p.user_id order by p.messenger_user_id').all().map(r => ({ ...r })));
      out('singlePairing', db.prepare('select messenger, user_id as native, chat_id as chat from remote_pairings').all().map(r => ({ ...r })));
    } finally { db.close(); }
    break;
  }
  case 'invpage': {
    const [label, user, display, png, none] = [a1, a2, a3, a4, a5];
    await withBrowser(async browser => {
      const ctx = await newContext(browser, false), page = await ctx.newPage();
      if (none === '1') await page.addInitScript(() => { Object.defineProperty(window, 'PublicKeyCredential', { value: undefined }); });
      const frames = [], password = newPassword(user);
      track(page, frames);
      await page.goto(readFileSync(`${Q}/invite-${label}`, 'utf8').trim());
      await page.getByRole('heading', { name: display, exact: true }).waitFor();
      out('landed', { host: new URL(page.url()).hostname, path: new URL(page.url()).pathname });
      out('nameShown', await page.getByText(user, { exact: true }).count());
      out('createPasskeyButton', await page.getByRole('button', { name: 'Create passkey', exact: true }).count());
      out('passwordTooltip', await page.getByText('Set password', { exact: true }).getAttribute('title'));
      await page.getByLabel('Set password').fill(password);
      const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/invite/register') && r.request().method() === 'POST'), signIn(page).click()]);
      out('register', { status: response.status() });
      await profile(page, display);
      out('cookie', await cookieFacts(ctx));
      out('frameSecretHits', frameHits(frames, [password]));
      await page.screenshot({ path: png }); out('screenshot', png);
      await ctx.close();
    });
    break;
  }
  case 'passkeys': {
    const [label, user, display, png] = [a1, a2, a3, a4];
    await withBrowser(async browser => {
      const p = port(), origin = `http://localhost:${p}`, seen = [];
      const keep = (kind, value) => { seen.push(value); addSecret(kind, user, value); };
      const ctx1 = await newContext(browser, false), page = await ctx1.newPage();
      const cdp = await ctx1.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: PASSKEY });
      const frames = [], finishBodies = [];
      track(page, frames);
      page.on('request', r => { if (r.url().includes('/passkey/finish')) finishBodies.push(r.postData()); });
      await page.goto(readFileSync(`${Q}/invite-${label}`, 'utf8').trim());
      await page.getByRole('heading', { name: display, exact: true }).waitFor();
      out('landed', { host: new URL(page.url()).hostname, path: new URL(page.url()).pathname });
      out('createPasskeyButton', await page.getByRole('button', { name: 'Create passkey', exact: true }).count());
      await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
      await profile(page, display);
      out('registeredCookie', await cookieFacts(ctx1));
      const own = (await ctx1.cookies()).find(c => /^cland_[0-9a-f]{12}$/.test(c.name));
      writeFileSync(`${Q}/cookie-a.json`, JSON.stringify({ cookie: `${own.name}=${own.value}`, origin }), { mode: 0o600 });
      const registration = JSON.parse(finishBodies[0]);
      for (const key of ['clientDataJSON', 'attestationObject']) keep('passkey-response', registration.response[key]);
      keep('challenge', registration.challenge);
      const replay = await page.request.post(`${origin}/invite/passkey/finish`, { headers: { Origin: origin }, data: registration });
      out('registrationReplay', { status: replay.status(), setCookie: replay.headers()['set-cookie'] ? 'present' : 'absent' });
      const reuse = await page.request.get(readFileSync(`${Q}/invite-${label}`, 'utf8').trim().replace('127.0.0.1', 'localhost'));
      out('inviteAfter', { status: reuse.status(), error: (await reuse.json().catch(() => ({}))).error ?? null });
      const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
      out('authenticatorCredentials', credentials.length);
      // a fresh browser context, with the credential imported into its own authenticator
      const ctx2 = await newContext(browser, false), login = await ctx2.newPage();
      track(login, frames);
      const assertions = [];
      login.on('request', r => { if (r.url().endsWith('/signin/passkey/finish')) assertions.push(r.postData()); });
      const cdp2 = await ctx2.newCDPSession(login);
      await cdp2.send('WebAuthn.enable');
      const added = await cdp2.send('WebAuthn.addVirtualAuthenticator', { options: PASSKEY });
      await cdp2.send('WebAuthn.addCredential', { authenticatorId: added.authenticatorId, credential: credentials[0] });
      await login.goto(`${origin}/signin`);
      out('usePasskeyButton', await login.getByRole('button', { name: 'Use passkey', exact: true }).count());
      await login.getByLabel('Name', { exact: true }).fill(user);
      await login.getByRole('button', { name: 'Use passkey', exact: true }).click();
      await profile(login, display);
      out('freshContextCookie', await cookieFacts(ctx2));
      out('assertionRequests', assertions.length);
      const previous = JSON.parse(assertions[0]);
      for (const value of Object.values(previous.response)) if (value !== previous.response.credentialId) keep('passkey-response', value);
      keep('challenge', previous.challenge);
      // negatives from a context with no cookie
      await ctx2.clearCookies();
      const ctx3 = await newContext(browser, false);
      const post = (path, data) => ctx3.request.post(origin + path, { headers: { Origin: origin }, data });
      const refused = async (name, data) => { const r = await post('/signin/passkey/finish', data); out(name, { status: r.status(), setCookie: r.headers()['set-cookie'] ? 'present' : 'absent', error: (await r.json().catch(() => ({}))).error ?? null }); };
      await refused('replayedAssertion', previous);
      const next = await (await post('/signin/passkey/options', { name: user })).json(); keep('challenge', next.challenge);
      await refused('oldAssertionOnFreshChallenge', { ...previous, challenge: next.challenge });
      await refused('challengeUsedTwice', { ...previous, challenge: next.challenge });
      const other = await (await post('/signin/passkey/options', { name: 'jane-q-doe' })).json(); keep('challenge', other.challenge);
      const expired = await (await post('/signin/passkey/options', { name: user })).json(); keep('challenge', expired.challenge);
      await login.goto(`${origin}/signin`);
      const sign = options => login.evaluate(async o => {
        const decode = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const encode = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const credential = await navigator.credentials.get({ publicKey: { ...o, challenge: decode(o.challenge), allowCredentials: o.allowCredentials.map(r => ({ ...r, id: decode(r.id) })) } });
        const response = credential.response;
        return { credentialId: encode(credential.rawId), clientDataJSON: encode(response.clientDataJSON), authenticatorData: encode(response.authenticatorData), signature: encode(response.signature) };
      }, options);
      // an assertion made with this user's credential for a challenge issued to another user
      const foreign = await sign({ ...other, allowCredentials: expired.allowCredentials });
      for (const [k, value] of Object.entries(foreign)) if (k !== 'credentialId') keep('passkey-response', value);
      await refused('otherUsersCredential', { challenge: other.challenge, response: foreign });
      // an assertion for a challenge that then outlives its 120 s
      const signed = await sign(expired);
      for (const [k, value] of Object.entries(signed)) if (k !== 'credentialId') keep('passkey-response', value);
      const t0 = Date.now(); await sleep(125000);
      out('waitedMs', Date.now() - t0);
      await refused('expiredChallenge', { challenge: expired.challenge, response: signed });
      // control: a fresh challenge and a fresh assertion still sign this user in
      const fresh = await (await post('/signin/passkey/options', { name: user })).json(); keep('challenge', fresh.challenge);
      const good = await sign(fresh);
      for (const [k, value] of Object.entries(good)) if (k !== 'credentialId') keep('passkey-response', value);
      const control = await post('/signin/passkey/finish', { challenge: fresh.challenge, response: good });
      out('positiveControl', { status: control.status(), setCookie: control.headers()['set-cookie'] ? 'present' : 'absent' });
      out('frameSecretHits', frameHits(frames, seen));
      await page.screenshot({ path: png }); out('screenshot', png);
      await ctx1.close(); await ctx2.close(); await ctx3.close();
    });
    break;
  }
  case 'signinshot': {
    await withBrowser(async browser => {
      const ctx = await newContext(browser, a2 === '1'), page = await ctx.newPage();
      await page.goto(`http://localhost:${port()}/`);
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      out('path', new URL(page.url()).pathname);
      out('usePasskeyButton', await page.getByRole('button', { name: 'Use passkey', exact: true }).count());
      const box = await signIn(page).boundingBox(), vp = page.viewportSize();
      out('signInButtonInViewport', !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height);
      out('horizontalOverflow', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
      await page.screenshot({ path: a1 }); out('screenshot', a1);
      await ctx.close();
    });
    break;
  }
  case 'session': {
    const [user, display, png] = [a1, a2, a3], password = readFileSync(`${Q}/pw-${user}`, 'utf8').trim();
    await withBrowser(async browser => {
      const p = port(), origin = `http://localhost:${p}`;
      const ctxA = await newContext(browser, false), page = await ctxA.newPage(), frames = [];
      track(page, frames);
      await page.goto(origin);
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      out('redirectedTo', new URL(page.url()).pathname);
      const attempt = async (name, pw) => {
        await page.getByLabel('Name', { exact: true }).fill(name); await page.getByLabel('Password', { exact: true }).fill(pw);
        const [r] = await Promise.all([page.waitForResponse(x => x.url().endsWith('/signin/password')), signIn(page).click()]);
        return r;
      };
      const texts = [];
      for (const [label, name, pw] of [['unknownName', 'unknown', 'qa3-wrong-one-x'], ['invitedOnlyName', 'bob', 'qa3-wrong-two-x'], ['wrongPassword', user, 'qa3-wrong-three-x']]) {
        const r = await attempt(name, pw);
        await page.getByRole('alert').waitFor();
        const text = await page.getByRole('alert').textContent(); texts.push(text);
        out(label, { status: r.status(), alert: text, setCookie: (await r.allHeaders())['set-cookie'] ? 'present' : 'absent' });
      }
      out('refusalsIdentical', new Set(texts).size === 1);
      const ok = await attempt(user, password);
      out('signIn', { status: ok.status() });
      await profile(page, display);
      const ctxB = await newContext(browser, false);
      const login = await ctxB.request.post(`${origin}/signin/password`, { headers: { Origin: origin }, data: { name: user, password } });
      out('otherContextLogin', { status: login.status() });
      const pageB = await ctxB.newPage(); track(pageB, frames);
      await pageB.goto(origin); await profile(pageB, display);
      const sibling = await ctxA.newPage(); await sibling.goto(origin);
      await sibling.getByRole('button', { name: 'Accounts', exact: true }).waitFor();
      const [out1] = await Promise.all([page.waitForResponse(x => x.url().endsWith('/signout')), page.getByRole('button', { name: 'Sign out', exact: true }).click()]);
      out('signOut', { status: out1.status() });
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      await sibling.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      out('returnedToSignIn', { page: new URL(page.url()).pathname, sibling: new URL(sibling.url()).pathname });
      out('revokedBrowserStatus', await page.evaluate(async () => (await (await fetch('/signin/status')).json()).required));
      out('otherBrowserStatus', await pageB.evaluate(async () => (await (await fetch('/signin/status')).json()).required));
      await pageB.reload(); await profile(pageB, display);
      out('frameSecretHits', frameHits(frames, [password]));
      await page.screenshot({ path: png }); out('screenshot', png);
      await ctxA.close(); await ctxB.close();
    });
    break;
  }
  case 'wsout': {
    const p = port(), origin = `http://localhost:${p}`, host = `localhost:${p}`;
    const cookieOf = tag => JSON.parse(readFileSync(`${Q}/cookie-${tag}.json`, 'utf8')).cookie;
    const status = async tag => JSON.parse((await call(p, { path: '/signin/status', host, cookie: cookieOf(tag) })).body).required;
    const A = await wsOpen(a1), B = await wsOpen(a2);
    out('upgrade', { A: A.status, B: B.status });
    const hello = async c => { c.ws.send(JSON.stringify({ type: 'hello', protocol: 2, client: 'web', userId: 'forged' })); return (await waitLine(c, f => f.type === 'welcome'))?.name ?? null; };
    out('welcome', { A: await hello(A), B: await hello(B) });
    out('before', { A: await status(a1), B: await status(a2) });
    const foreign = await call(p, { method: 'POST', path: '/signout', host, origin: 'https://foreign.example', json: {}, cookie: cookieOf(a2) });
    out('foreignOriginSignOut', { status: foreign.status, otherStillValid: (await status(a2)) === false });
    const none = await call(p, { method: 'POST', path: '/signout', host, origin, json: {} });
    out('noCookieSignOut', { status: none.status, error: JSON.parse(none.body).error });
    const signOut = await call(p, { method: 'POST', path: '/signout', host, origin, json: {}, cookie: cookieOf(a1) });
    out('signOutA', { status: signOut.status });
    out('socketAClosed', await Promise.race([A.closed, sleep(5000).then(() => 'still open')]));
    B.ws.send(JSON.stringify({ type: 'web.session', id: 'w1' }));
    const alive = await waitLine(B, f => f.type === 'result' && f.id === 'w1');
    out('socketB', { open: B.ws.readyState === 1, webSessionOk: alive?.ok ?? null });
    const reuse = await wsOpen(a1); out('reuseOfA', reuse.status); reuse.ws.terminate();
    out('after', { A: await status(a1), B: await status(a2) });
    out('signOutB', { status: (await call(p, { method: 'POST', path: '/signout', host, origin, json: {}, cookie: cookieOf(a2) })).status });
    out('socketBClosed', await Promise.race([B.closed, sleep(5000).then(() => 'still open')]));
    break;
  }
  case 'withdrawui': {
    const ids = JSON.parse(readFileSync(`${Q}/${a1}`, 'utf8'));
    await withBrowser(async browser => {
      const ctx = await newContext(browser, a3 === '1'), page = await ctx.newPage();
      if (a4 === 'link') await page.goto(mint());
      else { const { cookie, origin } = JSON.parse(readFileSync(`${Q}/cookie-${a4}.json`, 'utf8')), i = cookie.indexOf('='); await ctx.addCookies([{ name: cookie.slice(0, i), value: cookie.slice(i + 1), url: origin }]); await page.goto(origin); }
      await page.locator('[data-phone]').first().waitFor();
      out('layoutPhone', await page.locator('[data-phone]').first().getAttribute('data-phone'));
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      await page.locator(`[data-object-id="${general}"]`).first().click();
      for (const id of Object.values(ids)) await page.locator(`[data-message-id="${id}"]`).waitFor();
      await page.waitForTimeout(1500);
      for (const [name, id] of Object.entries(ids)) out('withdraw', { message: name, buttons: await page.locator(`[data-message-id="${id}"]`).getByRole('button', { name: 'Withdraw', exact: true }).count() });
      await page.screenshot({ path: a2 }); out('screenshot', a2);
      await ctx.close();
    });
    break;
  }
  case 'scan3': {
    // every secret the run made or saw, searched for byte for byte in p1's .cland tree (hub.db, its WAL, hub.log, the journal) and under $EV; counts only
    const secrets = existsSync(`${Q}/secrets3.json`) ? JSON.parse(readFileSync(`${Q}/secrets3.json`, 'utf8')) : [];
    for (const f of readdirSync(Q)) {
      const text = () => readFileSync(`${Q}/${f}`, 'utf8').trim();
      if (/^pw-/.test(f)) secrets.push({ kind: 'password', label: f, value: text() });
      else if (/^invite-[A-Za-z0-9-]+$/.test(f)) secrets.push({ kind: 'invite-token', label: f, value: (text().match(/token=([0-9a-f]{64})$/) ?? [])[1] ?? '' });
      else if (/^cookie-.*\.json$/.test(f)) secrets.push({ kind: 'cookie', label: f, value: JSON.parse(text()).cookie.split('=')[1] });
    }
    const files = [];
    const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const q = `${dir}/${e.name}`; if (e.isDirectory()) walk(q); else if (e.isFile()) files.push(q); } };
    walk(`${root}/.cland`); walk(EV);
    const contents = files.map(f => [f, readFileSync(f)]);
    const kinds = {};
    for (const s of secrets) {
      const k = kinds[s.kind] ??= { kind: s.kind, sentinels: 0, tooShort: 0, hits: [] };
      if (!s.value || s.value.length < 12) { k.tooShort += 1; continue; }
      k.sentinels += 1;
      for (const [f, buf] of contents) if (buf.includes(s.value)) k.hits.push(`${s.label}: ${f.replace(root, '<p1>').replace(EV, '<EV>')}`);
    }
    out('filesScanned', files.length);
    for (const k of Object.values(kinds)) out('scan', k);
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
process.exit(0);
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows that run in p1 call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it. The long row E1536S3-10 holds one 125 s wait: run it with a command timeout of at least 600000 ms.

```sh
m00() {   # QA's own shell: build, membership, landings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1536 --json) > "$EV/E1536S3-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=p.stages.find(x=>x.name==="sign-in and pairing");console.log(JSON.stringify({state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}))' "$EV/E1536S3-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name==="sign-in and pairing").items.join(" "))' "$EV/E1536S3-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
m01() {   # QA's own shell, read-only in $W: preserved tests, additions only, boundaries, web style rules, source strings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  for id in T-1566 T-1567 T-1568 T-1572 T-1584; do
    L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD)
    echo "$id ($L) edited preserved files: $(git -C "$W" diff --name-only "$L^1" "$L" -- hub/test/web-auth.test.ts hub/test/web-authority.test.ts hub/test/webauthn.test.ts hub/test/invites.test.ts hub/test/user-invites.test.ts hub/test/users.test.ts hub/test/pairing-codes.test.ts hub/test/remote-cli.test.ts hub/test/telegram-pairing.test.ts hub/test/discord-pairing.test.ts hub/test/human-routing.test.ts web/test/connection.test.ts web/test/phone-disconnected.test.ts web/test/message-users.test.ts | wc -l | tr -d ' ')"
    echo "$id deleted lines in additive test files: $(git -C "$W" diff --numstat "$L^1" "$L" -- hub/test/passwords.test.ts hub/test/web-signin.test.ts web/test/signin.test.ts web/test/passkeys.test.ts hub/test/pairing-approval.test.ts hub/test/pairing-service.test.ts hub/test/host-records.test.ts hub/test/telegram-inbound.test.ts hub/test/discord-inbound-media.test.ts hub/test/discord-cards.test.ts hub/test/topic-withdraw.test.ts hub/test/web-authority-unit.test.ts web/test/withdraw.test.ts | awk '{d+=$2} END{print d+0}')"
    echo "$id deleted lines in migrated test files (read before judging): $(git -C "$W" diff --numstat "$L^1" "$L" -- hub/test/artifact-user.test.ts hub/test/discord-cards-fixture.ts nvim/test/remotes.test.ts | awk '{d+=$2} END{print d+0}')"
    echo "$id package.json and lockfiles changed: $(git -C "$W" diff --name-only "$L^1" "$L" -- ':(glob)**/package.json' ':(glob)**/package-lock.json' ':(glob)**/yarn.lock' ':(glob)**/pnpm-lock.yaml' | wc -l | tr -d ' ')"
    echo "$id web colour literals outside tokens.css: $(git -C "$W" diff "$L^1" "$L" -- web/src ':!web/src/tokens.css' | grep -E '^\+[^+]' | grep -cE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(')"
    echo "$id key listeners outside keymap.ts: $(git -C "$W" diff "$L^1" "$L" -- web/src ':!web/src/keymap.ts' | grep -E '^\+[^+]' | grep -cE "addEventListener\(['\"]key|onKey(Down|Up|Press)")"
  done
  ( cd "$W"
    echo "Set-Cookie writers outside webSessionCookie: $(grep -rn 'Set-Cookie' hub/src | grep -v webSessionCookie | wc -l | tr -d ' ')"
    echo "webSessionCookie call sites: $(grep -rn 'webSessionCookie(' hub/src | grep -v 'export function' | wc -l | tr -d ' ')"
    echo "ADR amendment: $(grep -c -F '2026-11-02 amendment: users-mode browser admission' docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md)"
    echo "uniform refusal: $(grep -c -F 'Name or password is incorrect' hub/src/hub/web-signin.ts)"
    echo "foreign origin: $(grep -c -F "error: 'Foreign Origin'" hub/src/hub/web-signin.ts)"
    echo "passkey refusal: $(grep -c -F "Passkey refused" hub/src/hub/web-passkeys.ts)"
    echo "passkey tooltip: $(grep -c -F 'Passkeys are unavailable in this browser or connection. Use a password.' web/src/SignIn.tsx)"
    echo "localhost redirect: $(grep -c -F 'http://localhost:' hub/src/hub/web-signin.ts)"
    echo "withdraw ownership refusal: $(grep -c -F 'cannot withdraw: message ownership requires its author (legacy messages require admin)' hub/src/hub/core.ts)"
    echo "pairing approve flag refusal: $(grep -c -F 'users mode pairing approval requires --user <name>' hub/src/hub/dispatch.ts)"
    echo "unpair flag refusal: $(grep -c -F 'users mode unpair requires --user <name>; paired users:' hub/src/hub/dispatch.ts)"
    echo "unknown pairing user: $(grep -c -F 'unknown pairing user' hub/src/hub/dispatch.ts)"
    echo "remote help --user lines: $(node hub/bin/cland.ts remote 2>&1 | grep -c -E 'remote (approve|unpair) .*\[--user <name>\]')" )
}
m02() {   # sealed, in $W: build the bundle the scratch edge and Web tests serve; the typecheck's colour and contrast checks
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD) node $(node --version) nvim $(nvim --version 2>/dev/null | head -n 1)"
  ( cd "$QA_W" && npm run build --workspace web > "$QA_EV/E1536S3-02-build.log" 2>&1; echo "build exit $?"; ls web/dist/index.html
    npm run typecheck > "$QA_EV/E1536S3-02-typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
m07() {   # p1: init, hub start; single-mode baseline: invite and sign-in paths 404, the printed link flow, single-mode withdrawal
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' '); dist $(ls "$QA_W/web/dist/index.html")"
  git init -q -b dev && git config user.name 'Jane Q. Doe' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1536S3-07-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml) user.name=$(git config user.name)"
  amode
  hubstart; echo "hub start exit $?"
  probe h '[{"label":"single GET /signin/status","path":"/signin/status"},{"label":"single GET /","path":"/"},{"label":"single GET /invite","path":"/invite?token=@random64"},{"label":"single POST /invite/details","method":"POST","path":"/invite/details?token=@random64","origin":"localhost"},{"label":"single POST /invite/register","method":"POST","path":"/invite/register","origin":"localhost","json":{"token":"@random64","password":"qa3 single password x"}},{"label":"single GET /signin","path":"/signin"},{"label":"single POST /signin/password","method":"POST","path":"/signin/password","origin":"localhost","json":{"name":"jane-q-doe","password":"qa3 single password x"}},{"label":"single POST /signout","method":"POST","path":"/signout","origin":"localhost","json":{}},{"label":"single POST /invite/passkey/options","method":"POST","path":"/invite/passkey/options","origin":"localhost","json":{"token":"@random64"}},{"label":"single POST /signin/passkey/options","method":"POST","path":"/signin/passkey/options","origin":"localhost","json":{"name":"jane-q-doe"}}]'
  probe web a '[{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 single web words","qaSave":["m3-single-web","message.id"]}]'
  probe sock '[{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 single words","qaSave":["m3-single","message.id"]},{"type":"topic.withdraw","topic":"general","message":"@file:m3-single"},{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 legacy words","qaSave":["m3-legacy","message.id"]},{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 legacy two","qaSave":["m3-legacy2","message.id"]}]'
  idsj ids-single3.json "legacy=m3-legacy" "legacy two=m3-legacy2"
  bprobe withdrawui ids-single3.json "$QA_EV/E1536S3-07-single.png" 0 link
}
m08() {   # p1: the switch, every invite, the users-mode gates, the redirect, Host and Origin, the refusal pages
  echo "PRE: $(amode); hub $(up); users $(cland user list | tail -n +2 | wc -l | tr -d ' ')"
  cland auth mode users > "$QA_Q/switch.out" 2> "$QA_EV/E1536S3-08-switch.err"; echo "switch exit $?"
  head -n 1 "$QA_Q/switch.out"
  sed -n 2p "$QA_Q/switch.out" > "$QA_Q/invite-jane"; chmod 600 "$QA_Q/invite-jane"
  echo "invite line: $(ishape "$QA_Q/invite-jane"); stdout lines $(wc -l < "$QA_Q/switch.out" | tr -d ' ')"
  amode
  uinv alex add alex --display "Alex Smith"
  uinv dana add dana --display "Alex Smith"
  uinv bob add bob
  uinv cleo-1 add cleo
  uinv cleo-2 invite cleo
  cland user list
  probe db
  probe h '[{"label":"GET / without a cookie","path":"/"},{"label":"HEAD / without a cookie","method":"HEAD","path":"/"},{"label":"GET /signin/status without a cookie","path":"/signin/status"},{"label":"GET invite on 127.0.0.1","path":"/invite?token=@token:jane","host":"127","expectLocal":true},{"label":"GET signin on 127.0.0.1","path":"/signin","host":"127","expectLocal":true},{"label":"GET invite on localhost","path":"/invite?token=@token:jane"},{"label":"GET signin on localhost","path":"/signin"},{"label":"GET /auth on 127.0.0.1 is not redirected","path":"/auth?token=@random64","host":"127"},{"label":"POST invite details","method":"POST","path":"/invite/details?token=@token:jane","origin":"localhost"},{"label":"POST invite details on 127 with the 127 origin (per source)","method":"POST","path":"/invite/details?token=@token:jane","host":"127","origin":"127"},{"label":"POST invite details, host 127 origin localhost","method":"POST","path":"/invite/details?token=@token:jane","host":"127","origin":"localhost"},{"label":"POST invite details, host localhost origin 127","method":"POST","path":"/invite/details?token=@token:jane","origin":"127"},{"label":"POST invite details, foreign origin","method":"POST","path":"/invite/details?token=@token:jane","origin":"foreign"},{"label":"POST invite register, foreign origin","method":"POST","path":"/invite/register","origin":"foreign","json":{"token":"@token:jane","password":"qa3 foreign password x"}},{"label":"POST signin password, foreign origin","method":"POST","path":"/signin/password","origin":"foreign","json":{"name":"jane-q-doe","password":"qa3 foreign password x"}},{"label":"POST signout, foreign origin","method":"POST","path":"/signout","origin":"foreign","json":{}},{"label":"POST invite passkey options, foreign origin","method":"POST","path":"/invite/passkey/options","origin":"foreign","json":{"token":"@token:jane"}},{"label":"POST signin passkey options, foreign origin","method":"POST","path":"/signin/passkey/options","origin":"foreign","json":{"name":"jane-q-doe"}},{"label":"GET invite with a foreign Origin header","path":"/invite?token=@token:jane","origin":"foreign"},{"label":"POST invite register without an Origin","method":"POST","path":"/invite/register","json":{"token":"@token:jane","password":"qa3 no origin password x"}},{"label":"GET invite with a foreign Host","path":"/invite?token=@token:jane","host":"foreign"},{"label":"GET invite register","path":"/invite/register","origin":"localhost"},{"label":"POST invite page","method":"POST","path":"/invite","origin":"localhost","json":{}},{"label":"POST signin page","method":"POST","path":"/signin","origin":"localhost","json":{}},{"label":"unknown invite","path":"/invite?token=@random64"},{"label":"two token parameters","path":"/invite?token=@random64&token=@random64"},{"label":"revoked invite (cleo-1)","path":"/invite?token=@token:cleo-1"},{"label":"short password (bob)","method":"POST","path":"/invite/register","origin":"localhost","json":{"token":"@token:bob","password":"short"}},{"label":"bob invite after the short password","path":"/invite?token=@token:bob"}]'
  probe expire cleo-2
  probe h '[{"label":"expired invite (cleo-2)","path":"/invite?token=@token:cleo-2"},{"label":"expired invite details (cleo-2)","method":"POST","path":"/invite/details?token=@token:cleo-2","origin":"localhost"}]'
}
m09() {   # p1, Headless Shell: jane-q-doe's invite page with a password; then the used-invite refusals
  echo "PRE: $(amode); hub $(up); dist $(ls "$QA_W/web/dist/index.html"); jane $(cland user list | grep -c '^jane-q-doe  Jane Q. Doe  admin  active$') active with an open invite"
  bprobe invpage jane jane-q-doe "Jane Q. Doe" "$QA_EV/E1536S3-09-invite.png" 0
  probe db
  cland user list
  probe h '[{"label":"used invite","path":"/invite?token=@token:jane"},{"label":"used invite details","method":"POST","path":"/invite/details?token=@token:jane","origin":"localhost"},{"label":"used invite register again","method":"POST","path":"/invite/register","origin":"localhost","json":{"token":"@token:jane","password":"@pw:jane-q-doe"}}]'
}
m10() {   # p1, Headless Shell with a CDP virtual authenticator: alex registers a passkey, signs in from a fresh context, the refusals (one real 125 s wait)
  echo "PRE: $(amode); hub $(up); alex $(cland user list | grep -c '^alex  Alex Smith  admin  invited$') invited; dist $(ls "$QA_W/web/dist/index.html")"
  bprobe passkeys alex alex "Alex Smith" "$QA_EV/E1536S3-10-passkey.png"
  probe db
  probe h '[{"label":"used invite (alex)","path":"/invite?token=@token:alex"},{"label":"passkey options on a used invite","method":"POST","path":"/invite/passkey/options","origin":"localhost","json":{"token":"@token:alex"}}]'
}
m11() {   # p1, Headless Shell with WebAuthn made unavailable: dana registers by password only
  echo "PRE: $(amode); hub $(up); dana $(cland user list | grep -c '^dana  Alex Smith  admin  invited$') invited; dist $(ls "$QA_W/web/dist/index.html")"
  bprobe invpage dana dana "Alex Smith" "$QA_EV/E1536S3-11-nowebauthn.png" 1
  probe db
  cland user list
}
m12() {   # p1, Headless Shell: the sign-in page on desktop and phone; wrong credentials, sign-in, sign-out
  echo "PRE: $(amode); hub $(up); jane $(cland user list | grep -c '^jane-q-doe  Jane Q. Doe  admin  active$') active, bob $(cland user list | grep -c '^bob  bob  admin  invited$') invited"
  bprobe signinshot "$QA_EV/E1536S3-12-signin-desktop.png" 0
  bprobe signinshot "$QA_EV/E1536S3-12-signin-phone.png" 1
  bprobe session jane-q-doe "Jane Q. Doe" "$QA_EV/E1536S3-12-signed-out.png"
}
m13() {   # p1: cookie flags from every issuer; sign-out revokes one session and its sockets only
  echo "PRE: $(amode); hub $(up); jane $(cland user list | grep -c '^jane-q-doe  Jane Q. Doe  admin  active$') active"
  probe h '[{"label":"sign in A","method":"POST","path":"/signin/password","origin":"localhost","json":{"name":"jane-q-doe","password":"@pw:jane-q-doe"},"save":"jA"},{"label":"sign in B","method":"POST","path":"/signin/password","origin":"localhost","json":{"name":"jane-q-doe","password":"@pw:jane-q-doe"},"save":"jB"},{"label":"signin page with a cookie","path":"/signin","cookie":"jA"},{"label":"root with a cookie","path":"/","cookie":"jA"}]'
  probe web k '[{"type":"web.session"}]'
  probe wsout jA jB
}
m14() {   # p1: withdrawal ownership by user id, in frames and in the web message block
  echo "PRE: $(amode); hub $(up); active users $(cland user list | grep -c -E '^(jane-q-doe|alex|dana)  .*  admin  active$'); legacy ids $(cat "$QA_Q/m3-legacy" "$QA_Q/m3-legacy2" 2>/dev/null | wc -l | tr -d ' ')"
  probe h '[{"label":"sign in jane","method":"POST","path":"/signin/password","origin":"localhost","json":{"name":"jane-q-doe","password":"@pw:jane-q-doe"},"save":"j"},{"label":"sign in dana","method":"POST","path":"/signin/password","origin":"localhost","json":{"name":"dana","password":"@pw:dana"},"save":"d"}]'
  probe sock '[{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 jane words","qaSave":["m3-jane","message.id"]}]'
  probe wsend a '[{"type":"web.session"},{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 alex words","qaSave":["m3-alex","message.id"]}]'
  probe wsend d '[{"type":"web.session"},{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 dana words","qaSave":["m3-dana","message.id"]},{"type":"topic.withdraw","topic":"general","message":"@file:m3-jane"}]'
  probe wsend a '[{"type":"topic.withdraw","topic":"general","message":"@file:m3-dana"}]'
  probe wsend d '[{"type":"qa.role","name":"dana","role":"qa-test-role"},{"type":"topic.withdraw","topic":"general","message":"@file:m3-legacy"},{"type":"topic.withdraw","topic":"general","message":"@file:m3-dana"},{"type":"qa.role","name":"dana","role":"admin"}]'
  probe sock '[{"type":"topic.history","topic":"general"}]'
  idsj ids-withdraw.json "dana=m3-dana" "alex=m3-alex" "jane=m3-jane" "legacy=m3-legacy"
  bprobe withdrawui ids-withdraw.json "$QA_EV/E1536S3-14-dana-desktop.png" 0 d
  bprobe withdrawui ids-withdraw.json "$QA_EV/E1536S3-14-dana-phone.png" 1 d
  bprobe withdrawui ids-withdraw.json "$QA_EV/E1536S3-14-jane-desktop.png" 0 j
  probe wsend a '[{"type":"topic.withdraw","topic":"general","message":"@file:m3-alex"}]'
  probe wsend d '[{"type":"topic.withdraw","topic":"general","message":"@file:m3-legacy"}]'
  probe sock '[{"type":"topic.history","topic":"general"}]'
}
m15() {   # p1: pairing selectors on the CLI, with planted pairings as a fixture (no messenger exists in the scratch run)
  echo "PRE: $(amode); hub $(up); users $(cland user list | tail -n +2 | wc -l | tr -d ' ')"
  probe plantpair '["jane-q-doe","alex","dana"]'
  run "unpair without --user" remote unpair telegram
  run "unpair --user nobody" remote unpair telegram --user nobody
  run "approve without a live code" remote approve telegram 000000 --user alex
  run "unpair --user alex" remote unpair telegram --user alex
  probe pairdb
}
m16() {   # p1: reset; single mode again: sessions revoked, 404 paths, the link flow, the pairing rule, single-mode withdrawal
  echo "PRE: $(amode); hub $(up); pairings $(probe pairdb | tr '\n' ' ')"
  run "reset" auth reset
  amode
  probe db
  probe h '[{"label":"after reset GET /signin/status","path":"/signin/status"},{"label":"after reset GET /","path":"/"},{"label":"after reset GET invite","path":"/invite?token=@token:bob"},{"label":"after reset POST invite details","method":"POST","path":"/invite/details?token=@token:bob","origin":"localhost"},{"label":"after reset POST signin password","method":"POST","path":"/signin/password","origin":"localhost","json":{"name":"jane-q-doe","password":"@pw:jane-q-doe"}},{"label":"after reset POST signout","method":"POST","path":"/signout","origin":"localhost","json":{},"cookie":"j"},{"label":"after reset POST signin passkey options","method":"POST","path":"/signin/passkey/options","origin":"localhost","json":{"name":"alex"}},{"label":"after reset GET signin","path":"/signin"}]'
  probe wsend j '[]'
  probe pairdb
  idsj ids-reset3.json "legacy two=m3-legacy2" "jane=m3-jane"
  bprobe withdrawui ids-reset3.json "$QA_EV/E1536S3-16-single.png" 0 link
  probe web s '[{"type":"topic.withdraw","topic":"general","message":"@file:m3-jane"},{"type":"topic.withdraw","topic":"general","message":"@file:m3-legacy2"},{"type":"topic.send","topic":"general","to":["coordinator"],"text":"QA3 single after reset"},{"type":"topic.history","topic":"general"}]'
}
m17() {   # p1: the secret scan with the hub up (counts only)
  echo "PRE: hub $(up); secrets file $( [ -f "$QA_Q/secrets3.json" ] && echo present || echo missing ); passwords $(ls "$QA_Q" | grep -c '^pw-') invites $(ls "$QA_Q" | grep -c '^invite-[a-z0-9-]*$') cookie files $(ls "$QA_Q" | grep -c '^cookie-')"
  probe scan3
}
m18() {   # p1: cleanup; judge the fixture-owned census only; the scan again after the hub stops (hub.db checkpointed)
  cland hub stop > "$QA_EV/E1536S3-18-hubstop.txt" 2>&1; echo "hub stop exit $?"; sleep 2
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
  ps -Ao pid=,command= > "$QA_Q/ps.txt"; echo "processes naming the scratch root: $(grep -c -F "$QA_Q" "$QA_Q/ps.txt")"; grep -F "$QA_Q" "$QA_Q/ps.txt" | head -20
  probe scan3
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e1536s3-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). p1's secret in `$Q/p1/.cland/hub.json`, the sign-in links, the cookies, the files `cookie-*`, `invite-*`, `pw-*` and `secrets3.json`, and every password, challenge and assertion part are never printed or posted. Record the setup (worktree, `$Q`, the zero credential-name count, the `CLAND_` name list, `probe checked`) as check `S0` with `qa-record.sh note`. The name list must hold no `CLAND_SESSION_*`, `CLAND_LAUNCH_TOKEN` or `CLAND_ROLE` from QA's own session.

## Cases

none. No headless-grid case covers this stage. The Neovim pairing card (T-1572 C2) is proven by the headless-Neovim test file in E1536S3-06, and the web by Headless Shell checks (E1536S3-07 to E1536S3-14, E1536S3-16). Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. Under rule 18 the web surfaces this stage changed run in Chrome Headless Shell, not in a real browser:
- the invite page with a password (E1536S3-09, screenshot `$EV/E1536S3-09-invite.png`) and with WebAuthn unavailable (E1536S3-11, `$EV/E1536S3-11-nowebauthn.png`);
- the invite and sign-in pages with passkeys through the CDP virtual authenticator (E1536S3-10, `$EV/E1536S3-10-passkey.png`);
- the sign-in page on desktop and phone, sign-in and Profile sign-out (E1536S3-12, `$EV/E1536S3-12-signin-desktop.png`, `$EV/E1536S3-12-signin-phone.png`, `$EV/E1536S3-12-signed-out.png`);
- the message block's Withdraw action (E1536S3-14 desktop and phone, `$EV/E1536S3-14-*.png`) and the single-mode baselines (E1536S3-07, E1536S3-16).

No computer use, no GUI. Screenshots are taken after the secret fields are gone from the page (after sign-in or after the redirect), so none shows a password or token.

## Manual checks

Run in this order. Rows E1536S3-03 to E1536S3-06 run their test files serially from `$W` through `nt`: cover-quiet admission before each row, the one-minute load at or below 10 and the free disk space printed before each file. Targeted files take no suite lease. They never run in parallel with each other or with the scratch rows. Rows E1536S3-07 to E1536S3-18 depend on the p1 state the rows before them leave. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1536 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. For every `nt` row "clean" means: every `exit` line reads `exit 0 <file>`, no `not ok` line and no `# SKIP` line (Neovim and the Headless Shell are present on this run, so a skip is FAIL, not a platform skip).

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1536S3-00 | hub-api | QA | `m00 > "$EV/E1536S3-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the stage line names `sign-in and pairing` with `qa` affected/after-stage and every member merged; each member, T-1568 included, prints exactly one landing SHA. Otherwise BLOCKED, reported to the requester, nothing else run |
| E1536S3-01 | hub-api | QA | `m01 > "$EV/E1536S3-01.txt" 2>&1` (QA's own shell, read-only) | Every `edited preserved files:` line ends `0`. Every `deleted lines in additive test files:` line ends `0` (T-1572 C7: additions only); `deleted lines in migrated test files` is read before judging (the reviewed T-1572 migrations of `artifact-user.test.ts`, `discord-cards-fixture.ts` and `nvim/test/remotes.test.ts` delete a few lines; any other nonzero count is FAIL). Every `package.json and lockfiles changed:` line ends `0` (T-1568 C6). Every `web colour literals outside tokens.css:` and `key listeners outside keymap.ts:` line ends `0`; a nonzero count is read and is FAIL only when the added line is a colour or key listener. `Set-Cookie writers outside webSessionCookie: 0` and `webSessionCookie call sites:` 3 or more (T-1566 C5); `ADR amendment: 1` (C7); `uniform refusal: 1`; `foreign origin: 1`; `passkey refusal: 1` or more; `passkey tooltip: 1`; `localhost redirect: 1` or more; `withdraw ownership refusal: 1`; `pairing approve flag refusal: 1`; `unpair flag refusal: 1`; `unknown pairing user: 2`; `remote help --user lines: 2` |
| E1536S3-02 | hub-api | QA | `( . "$Q/env.sh"; m02 ) > "$EV/E1536S3-02.txt" 2>&1` | PRE shows Node 24 and a Neovim version line. `build exit 0`, `web/dist/index.html` listed, `typecheck exit 0` (the web typecheck holds the colour-token and 4.5:1 contrast checks; AGENTS.md), `dirty entries 0` |
| E1536S3-03 | hub-api | QA | `nt E1536S3-03 hub/test/passwords.test.ts hub/test/web-signin.test.ts hub/test/web-auth.test.ts hub/test/web-authority.test.ts hub/test/webauthn.test.ts` | clean. `oks` lists Tests: `scrypt records have independent salts and verify only the supplied password`, `credential commit rolls back invite and activation when session issuance fails; expired invites stay refused`, `an invite registers a password and issues a user-bound cookie exactly once`, `invite admission refuses foreign origins, wrong methods, short passwords and unknown tokens without cookies`, `password sign-in hides credential failures and sign-out revokes only its browser`; the byte-verifier file and the unedited `web-auth` and `web-authority` files (E1536S3-01) pass whole |
| E1536S3-04 | hub-api | QA | `nt E1536S3-04 web/test/signin.test.ts web/test/passkeys.test.ts web/test/connection.test.ts web/test/phone-disconnected.test.ts` | clean. `oks` lists Tests: `invite view shows the user and signs in with a password POST without sending a password frame`, `users-mode password form and Profile sign-out isolate browser sessions and return revoked tabs to sign-in`, `passkey invite registration and fresh-context sign-in consume the invite and persist only public credential facts`, `WebAuthn unavailable leaves only password registration and explains it in a tooltip`; the unedited connection and phone-disconnected files pass whole (their nested cases print `ok` too); every `Web fixture census` line ends `after 0; scratch hub stopped`. A skip of the passkey file (no Headless Shell) is FAIL |
| E1536S3-05 | hub-api | QA | `nt E1536S3-05 hub/test/topic-withdraw.test.ts hub/test/web-authority-unit.test.ts web/test/withdraw.test.ts web/test/message-users.test.ts` | clean. `oks` lists Tests: `users withdraw only their persisted messages despite identical display names; admins can withdraw legacy input`, `message ownership uses ids, preserves single mode and limits unattributed input to admins`, `users see Withdraw only for their own messages and legacy admin input with equal display names`; the unedited message-users file passes whole; every `Web fixture census` line ends `after 0; scratch hub stopped` |
| E1536S3-06 | hub-api | QA | `nt E1536S3-06 hub/test/pairing-approval.test.ts hub/test/pairing-service.test.ts hub/test/pairing-codes.test.ts hub/test/host-records.test.ts hub/test/telegram-inbound.test.ts hub/test/discord-inbound-media.test.ts hub/test/discord-cards.test.ts hub/test/artifact-user.test.ts hub/test/remote-cli.test.ts hub/test/cli-usage-compatibility.test.ts nvim/test/remotes.test.ts` | clean. `oks` lists Tests: `users approval requires a named owner, preserves other pairings and resolves input only from native pairing`, `users pairings replace only their owner and reset retains the first user without touching single rows`, `captured pairing cannot acquire a new owner and unpair cannot resurrect inherited bindings`, `two native Telegram chats retain their paired user on messages and answers`, `pairing card chooses a users-mode owner with native key presses`. The cases with template-literal titles (`Store upgrades existing remote tables alongside host records (existing host: …)`, the Discord held-media and modal cases) are generated: read their names from the log, compare with the source loops, and confirm every one prints `ok`. The unedited pairing-codes, remote-cli and frozen-help files pass whole (T-1572 C7) |
| E1536S3-07 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m07 ) > "$EV/E1536S3-07.txt" 2>&1` | PRE: p1 has no entries, `fakes 3`, the bundle exists. `init exit 0`; `lock 1 executor 1 user.name=Jane Q. Doe`; `mode = "single"`; `hub start exit 0`. Single-mode HTTP (T-1566 C6, T-1567 C4): `GET /signin/status` 200 with `required` false; `GET /` 200, `html` true, `location` null; every other line (`GET /invite`, `POST /invite/details`, `POST /invite/register`, `GET /signin`, `POST /signin/password`, `POST /signout`, `POST /invite/passkey/options`, `POST /signin/passkey/options`) 404 with `error` `Not found` and no cookie. Link flow (`web a`): `linkShape` true; `redeem` 302; `cookie` `nameOk` true, `valueLength` 64, `attrs` exactly `["Path=/","HttpOnly","SameSite=Strict","Max-Age=2592000"]` (no `Secure`: no HTTPS origin); `redeemAgain` 401; `upgrade` 101; welcome `human`; `q1 topic.send` ok, `from` `human`, `userId` null, `stage` `queued`. Single-mode withdrawal over the socket: the first send `from` `human`; `q2 topic.withdraw` ok with `stage` `withdrawn`; `QA3 legacy words` and `QA3 legacy two` ok and queued. `withdrawui`: `layoutPhone` `false`, both messages `buttons` 1, no `step` line, `browserGroupAfter` 0 (T-1584 C3 single mode: today's fence) |
| E1536S3-08 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m08 ) > "$EV/E1536S3-08.txt" 2>&1` | PRE: single, hub up, one user. `switch exit 0`; first line `jane-q-doe  admin`; `invite line: shape ok, token length 64, digest12 <x>`; `stdout lines 2`; `mode = "users"`. Each `user add` prints `<name>  admin  invited` and `shape ok` (alex, dana, bob, cleo-1); `user invite cleo` prints `cleo  admin  invited` with a `digest12` different from cleo-1's. `user list` shows `jane-q-doe  Jane Q. Doe  admin  active`, `alex  Alex Smith  admin  invited`, `dana  Alex Smith  admin  invited`, `bob  bob  admin  invited`, `cleo  cleo  admin  invited`. `db`: `authState` `["users"]`; `passwords` `rows` 0; `invites`: jane, alex, dana, bob `open`, cleo's first `revoked`, cleo's second `open`, every `digestLength` 64 and `hoursLeft` between 23.9 and 24. Gates (T-1567 C1, T-1568 interface): `GET / without a cookie` and `HEAD /` 302 with `location` `/signin` and `cache` `no-store`; `GET /signin/status` 200 `required` true; `GET invite on 127.0.0.1` and `GET signin on 127.0.0.1` 302 with `sameTarget` true (`location` `http://localhost:<port>/invite?token=<t64>`), `cache` `no-store`, `referrer` `no-referrer`; on localhost `GET invite` and `GET signin` 200 with `html` true and no redirect; `GET /auth on 127.0.0.1` 401, `error` `Invalid or expired sign-in link`, no `location`. `POST invite details` 200 with `fields` `{"name":"jane-q-doe","displayName":"Jane Q. Doe"}`; the 127 host with the 127 origin 200 (per source). Host/Origin (T-1566 C4): host 127 with the localhost origin, host localhost with the 127 origin, every foreign origin (`invite details`, `register`, `signin password`, `signout`, both passkey options paths, and a `GET invite` with a foreign Origin header), `POST register without an Origin` and `GET invite with a foreign Host` answer 403 with no cookie (`Foreign Origin`, and for the Host `Host must name an allowed web address`). Methods: `GET invite register` 405 with `allow` `POST`; `POST invite page` and `POST signin page` 405 with `allow` `GET`. Refusal pages (T-1566 C3), each with no cookie: `unknown invite` 400 `unknown invite` (and the same for `two token parameters`); `revoked invite (cleo-1)` 400 `revoked invite`; `short password (bob)` 400 with an `error` starting `Password must contain at least 12 characters`, then `bob invite after the short password` 200 (not spent). After the `expire` fixture (`changes` 1): `expired invite (cleo-2)` and its details call 400 `expired invite` |
| E1536S3-09 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m09 ) > "$EV/E1536S3-09.txt" 2>&1` | PRE: users, hub up, bundle present, jane `active` (the first user is active from the switch) with an open invite. `invpage`: `landed` host `localhost` and path `/invite` (the 127.0.0.1 link was redirected: T-1568 interface); `nameShown` 1; `createPasskeyButton` 1; `passwordTooltip` null; `register` 200; `profileShows` `Jane Q. Doe`; `cookie` one entry with `httpOnly` true, `secure` false, `sameSite` `Strict`, `path` `/`, `days` 30 (T-1566 C1, C5); `frameSecretHits` 0; `screenshot` named; no `step` line; `browserGroupAfter` 0. `db`: `users` jane `active`; `invites` jane `used`; `passwords` `rows` 1, `users` `["jane-q-doe"]`, `allScryptShape` true, `distinctSalts` true; `webSessions` one row for jane-q-doe (C2). `user list` shows `jane-q-doe  Jane Q. Doe  admin  active`. The used invite: `GET invite`, its details call and a second `POST invite register` 400 with `error` `used invite` and no cookie (C3) |
| E1536S3-10 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m10 ) > "$EV/E1536S3-10.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: users, hub up, alex invited, bundle present. `landed` host `localhost`, path `/invite`; `createPasskeyButton` 1; `profileShows` `Alex Smith`; `registeredCookie` one entry (`httpOnly` true, `secure` false, `sameSite` `Strict`, `days` 30); `registrationReplay` 400 with `setCookie` `absent`; `inviteAfter` 400 `used invite`; `authenticatorCredentials` 1 (T-1568 C1). Fresh context: `usePasskeyButton` 1, `profileShows` `Alex Smith`, `freshContextCookie` one entry, `assertionRequests` 1 (C2). Refusals, each 400, `setCookie` `absent` and `error` `Passkey refused` (C3): `replayedAssertion`, `oldAssertionOnFreshChallenge`, `challengeUsedTwice`, `otherUsersCredential`, and `expiredChallenge` after `waitedMs` of at least 125000 (real time; the hub's 120 s). Control: `positiveControl` 200 with `setCookie` `present`, so the refusals were for their reasons. `frameSecretHits` 0; `screenshot` named; no `step` line; `browserGroupAfter` 0. `db`: `passkeyColumns` `["user_id","credential_id","public_key","counter"]`; `passkeys` one row, `user` `alex`, `publicKeyPem` true, `counter` above 0; `tables` lists no table named for challenges or assertions (C4); `users` alex `active`; `invites` alex `used`; `webSessions` has rows for jane-q-doe and alex. The last `h` lines: used invite 400 `used invite`; `passkey options on a used invite` 400 |
| E1536S3-11 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m11 ) > "$EV/E1536S3-11.txt" 2>&1` | PRE: users, hub up, dana invited, bundle present. `landed` host `localhost`; `nameShown` 1; `createPasskeyButton` 0 (T-1568 C5); `passwordTooltip` starting `Passkeys are unavailable in this browser or connection. Use a password.`; `register` 200; `profileShows` `Alex Smith`; `cookie` one entry (30 days); `frameSecretHits` 0; no `step` line; `browserGroupAfter` 0. `db`: dana `active`, her invite `used`; `passwords` `rows` 2, `users` jane-q-doe and dana, `allScryptShape` true, `distinctSalts` true (T-1566 C2). `user list` shows `dana  Alex Smith  admin  active` |
| E1536S3-12 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1536S3-12.txt" 2>&1` | PRE: users, hub up, jane active, bob invited. Both `signinshot` runs: `path` `/signin`; `usePasskeyButton` 1; `signInButtonInViewport` true; `horizontalOverflow` false; screenshots named; no `step` line; `browserGroupAfter` 0. `session`: `redirectedTo` `/signin`; `unknownName`, `invitedOnlyName` and `wrongPassword` each `status` 401, `alert` `Name or password is incorrect`, `setCookie` `absent`, and `refusalsIdentical` true (T-1567 C2); `signIn` 200; `profileShows` `Jane Q. Doe` (C1); `otherContextLogin` 200 and the second browser's `profileShows`; `signOut` 200; `returnedToSignIn` path `/signin` for both `page` and `sibling` (the sibling tab shares the revoked cookie); `revokedBrowserStatus` true; `otherBrowserStatus` false and, after its reload, `profileShows` again (C3); `frameSecretHits` 0; screenshot `$EV/E1536S3-12-signed-out.png`; no `step` line; `browserGroupAfter` 0 |
| E1536S3-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1536S3-13.txt" 2>&1` | PRE: users, hub up, jane active. `sign in A` and `sign in B` 200 with `cookie` `nameOk` true, `valueLength` 64, `attrs` exactly `["Path=/","HttpOnly","SameSite=Strict","Max-Age=2592000"]`, each `saved`; `signin page with a cookie` 302 with `location` `/`; `root with a cookie` 200. `web k` (users-mode link flow): `linkShape` true, `redeem` 302 with the same `attrs` as the sign-in cookie (T-1566 C5: one helper, equal flags from `/auth`, invite and sign-in), `redeemAgain` 401, `upgrade` 101, welcome `jane-q-doe`, `web.session` ok. `wsout`: both `upgrade` 101 and `welcome` `jane-q-doe`; `before` `{"A":false,"B":false}`; `foreignOriginSignOut` 403 with `otherStillValid` true; `noCookieSignOut` 401 with `error` `Sign-in required`; `signOutA` 200; `socketAClosed` a close code (not `still open`); `socketB` `open` true and `webSessionOk` true; `reuseOfA` 401; `after` `{"A":true,"B":false}`; `signOutB` 200; `socketBClosed` a close code (T-1567 C3) |
| E1536S3-14 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1536S3-14.txt" 2>&1` | PRE: users, hub up, jane, alex and dana active, two legacy ids saved. Sign-ins `saved` j and d. Sends ok: `QA3 jane words` `from` `jane-q-doe`; alex's `from` `alex` and dana's `from` `dana`, each with its own `userId` (the welcome names are `alex` and `dana` despite the forged hello field). Refusals (T-1584 C2, C5), `ok` false with `error` `cannot withdraw: message ownership requires its author (legacy messages require admin)`: dana withdrawing jane's message, and alex withdrawing dana's (both display names are `Alex Smith`). With dana's stored role `qa-test-role` (`role` line shows `["admin","qa-test-role"]`): withdrawing the legacy message and dana's own message are refused with `code` `forbidden` and an `error` naming `User role qa-test-role cannot request topic.withdraw` (C4: a non-admin cannot withdraw legacy input; the authority table runs first); the restore line shows `role` `admin`. The history shows jane's, alex's, dana's and the legacy message still `queued`, `withdrawable` true, and `QA3 legacy words` with `legacyUser` true, `from` `jane-q-doe`, `userDisplayName` `Jane Q. Doe`. `withdrawui` as dana, desktop (`layoutPhone` `false`) then phone (`true`): `withdraw` buttons `dana` 1, `alex` 0, `jane` 0, `legacy` 1; as jane: `jane` 1, `alex` 0, `dana` 0, `legacy` 1 (C3, C5); screenshots named; no `step` line; `browserGroupAfter` 0 each. Then alex withdraws alex's own message: ok, `stage` `withdrawn` (C1); dana (an admin) withdraws the legacy message: ok, `stage` `withdrawn` (C4). The final history shows alex's and the legacy message `withdrawn`, jane's and dana's still `queued` |
| E1536S3-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m15 ) > "$EV/E1536S3-15.txt" 2>&1` | PRE: users, hub up, every user created. `planted` lists jane-q-doe 1001, alex 1002, dana 1003 (a fixture: no messenger pairs in the scratch run; the pairing round trip is E1536S3-06). `unpair without --user` exit 1 with `cland: users mode unpair requires --user <name>; paired users: ` naming jane-q-doe, alex and dana (any order); `unpair --user nobody` exit 1 `cland: unknown pairing user`; `approve without a live code` exit 1 `cland: no live pairing code for this messenger` (the code lookup comes first, so the `--user` refusal of T-1572 C1 needs a live code: E1536S3-06); `unpair --user alex` exit 0 `unpaired telegram`. `pairdb`: `userPairings` jane-q-doe 1001 and dana 1003 only, `singlePairing` empty |
| E1536S3-16 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m16 ) > "$EV/E1536S3-16.txt" 2>&1` | PRE: users, hub up, the two planted pairings listed. `reset exit 0` printing `Sign-in mode: single`; `mode = "single"`. `db`: `authState` `["single"]`, all the users retained, no `invites` row in state `open`, `webSessions` empty. Single mode again: `GET /signin/status` 200 `required` false; `GET /` 200 with `html` true and no `location`; every other line (`GET invite`, `POST invite details`, `POST signin password`, `POST signout` with the old cookie, `POST signin passkey options`, `GET signin`) 404 `Not found` (T-1566 C6, T-1567 C4). `wsend j`: `upgrade` 401 (the reset revoked the web sessions). `pairdb`: `userPairings` empty and `singlePairing` holding telegram with `native` 1001 (jane-q-doe's, kept) and none of dana's (T-1572 C8; fixture). `withdrawui` through a fresh link: `layoutPhone` `false`, `legacy two` `buttons` 1 and `jane` `buttons` 0, no `step` line, `browserGroupAfter` 0. `web s` (the printed link flow in single mode): `linkShape` true, `redeem` 302, `cookie` `attrs` exactly the four of E1536S3-07, `redeemAgain` 401, `upgrade` 101, welcome `human`; jane's message is refused with `error` `only the human’s own ordinary messages can be withdrawn` (the single-mode `from` `human` fence, T-1584 C3), the legacy message is withdrawn (`stage` `withdrawn`), the new send is ok with `from` `human` and `userId` null, and the history shows every `userDisplayName` null |
| E1536S3-17 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m17 ) > "$EV/E1536S3-17.txt" 2>&1` | PRE: hub up, the secret files present. `filesScanned` above 0. For each `scan` line, kinds `password`, `invite-token`, `cookie`, `challenge` and `passkey-response`: `sentinels` above 0, `tooShort` 0, `hits` `[]` — no password, invite token, cookie, challenge or assertion part is in p1's `.cland` tree (`hub.db` and its WAL, `hub.log`, the journal) or under `$EV` (T-1566 C2, T-1568 C4). A hit under `<EV>` is a QA fault to fix before publication (never print the value); a hit under `<p1>` is a FAIL naming the kind and file only |
| E1536S3-18 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m18 ) > "$EV/E1536S3-18.txt" 2>&1` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`): `hub stop exit 0`. No `alive` line names a fixture process: a `cland` hub or `hub serve`, `probe.mjs` or a Headless Shell. An `alive` line whose command is unrelated is pid reuse, recorded, not a failure. `processes naming the scratch root: 0` (any listed process is a leftover finding). The second scan, with the hub stopped and `hub.db` checkpointed, reads like E1536S3-17 (`hits` `[]` for every kind). Then remove `$Q` and the worktree as Build says |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request: a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint qa/briefs/E-1536-stage-3.md` with this filled brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1536-stage-3.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `b8b1a95be01a62cba4a0d986d677b1bb2dbb9c0a`, and for T-1568 at its branch head `188081c8656cb5560369361aca6ccd9391e44bcc` (not landed). Re-check every string at the tested build.

- Verified in source:
  - Invite and sign-in HTTP (`hub/src/hub/web-signin.ts`): the path list; the 404 `Not found` in single mode ahead of any other check; the exact-Origin rule (`Foreign Origin`, 403; a navigation GET of `/invite` or `/signin` may omit Origin); `405` with `Allow` (`GET` for `/invite` and `/signin`, `POST` for the rest); `GET /` and `HEAD /` 302 to `/signin` without a cookie, `Cache-Control: no-store`; `/signin/status` `{required}`; the 12-character rule and its message (`hub/src/hub/passwords.ts`); the uniform 401 `Name or password is incorrect`; the invite reasons and the safe-message list (adding `Passkey refused` at the T-1568 head); `/signout` 401 `Sign-in required` without a cookie, 200 `{ok:true}` with one; the per-name and per-address failure delay (five failures, then a growing refusal window, cleared by a success).
  - Cookie: `webSessionCookie` (`hub/src/hub/web-auth.ts`) writes `Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000` and `Secure` only for a configured origin; `/auth` calls it (`hub/src/hub/web-edge.ts`); the cookie name `cland_<12 hex>`.
  - Storage (`hub/src/hub/users.ts`): `user_passwords (user_id, hash)`; `registerPassword` spends the invite, writes the hash, activates the user and issues the session in one savepoint; at the T-1568 head `passkeys (user_id, credential_id, public_key, counter)`, `registerPasskey`, `advancePasskey`.
  - Passkeys at the T-1568 head (`hub/src/hub/web-passkeys.ts`, `web-signin.ts`, `web/src/SignIn.tsx`): the four `/passkey/` paths and their `options`/`finish` bodies; the 120 000 ms challenge lifetime, spent by every attempt; `Passkey refused`; the RP id `localhost` without a configured HTTPS origin and the `http://localhost:` origin requirement; the 302 to `http://localhost:<port><url>` with `Referrer-Policy: no-referrer` and `Cache-Control: no-store` when no origin is configured and the Host matches `127.0.0.1:<port>`; `GET /signin` with a cookie 302 to `/`; the button labels `Create passkey` and `Use passkey`; the tooltip text on the password label. The virtual-authenticator options and the flows (register, fresh context with `WebAuthn.addCredential`, replay, a challenge issued to another user signed with this user's credential, expiry) are those of `web/test/passkeys.test.ts` at that head.
  - Web labels: the `Name`, `Password`, `Set password` labels, the `Sign in` button, the `alert` role, `Accounts`, the `Profile` region and the `Sign out` button (`web/src/SignIn.tsx`, `web/src/accounts/Profile.tsx`, the tests above); `Topics` and the `data-object-id`, `data-message-id` and `data-phone` attributes (`web/src/MessageBlock.tsx`, `Shell.tsx`; stage 2's probe used them).
  - Withdrawal (`hub/src/hub/core.ts` `withdrawHumanMessage`, `#withdrawalReason`; `shared/wire/message-ownership.ts`; `web/src/MessageBlock.tsx`): the ownership refusal text; `legacyUser` set by the Store for a persisted null user id; a delivery that is still queued is what makes a message withdrawable; the role check runs first through `userAuthorityRefusal` (`topic.withdraw` is a classified request).
  - Pairing (`hub/src/hub/dispatch.ts`, `hub/src/remote/state.ts`, `hub/src/cli/remote.ts`): `users mode pairing approval requires --user <name>`, `unknown pairing user`, `users mode unpair requires --user <name>; paired users: …`, `no live pairing code for this messenger`, `unpaired <messenger>`; `user_remote_pairings (messenger, user_id, messenger_user_id, chat_id, guild_id, name)`; the reset hook keeps the first user's row in `remote_pairings` and empties `user_remote_pairings`; the `pairing-approved` journal event. The CLI error print is `cland: <message>` with exit 1.
  - Setup shared with stage 2: the `cland hub status` line `web      http://127.0.0.1:<port>/`; `cland web --no-open` prints one `/auth?token=` link; `cland user add|invite` and `auth mode users` print the name line then the invite URL; `auth reset` prints `Sign-in mode: single`.
  - Every literal test title named above is a literal title in its file at dev (the two passkey titles at the T-1568 head).
- Inferred, not verified by a run:
  - **T-1568**: any change review makes after the branch head above; that `Use passkey` shows on the sign-in page of the default Headless Shell at `http://localhost:<port>` (a secure context); that the CDP `WebAuthn.getCredentials` result is accepted unchanged by `WebAuthn.addCredential` (the test does exactly that); that the virtual authenticator's own counter exceeds the stored one for the control assertion after the unsent expired one.
  - **The scratch hub**: that a human message to `coordinator` with no coordinator session is accepted and stays `queued` and `withdrawable` (the withdrawal test files do this in-process); that the hub reads writes to its `hub.db` (the `expire` and `plantpair` fixtures) on its next request, and that a second connection can write while the hub holds the database (stage 2's plant did); that the status line parse in `port()` matches the build's `hub status` text; that `ws` to `localhost` reaches the IPv4 edge (comments in the tests of T-1568 say native clients resolve it).
  - **Pairing**: that the planted `user_remote_pairings` rows are read as real pairings (the unpair selector lists their users, the reset keeps jane's); the exact order of the names in the unpair refusal (by user id).
  - **The browser**: that a cookie added with `ctx.addCookies({name, value, url})` for the localhost origin is accepted for an `HttpOnly` cookie (Playwright accepts it); that the General thread renders every `QA3` message within the page timeout; that `[data-phone]`'s first match is the application root; the generated test titles (template literals); the close code of a revoked socket (any number is expected, not a particular one).

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live sign-in, the live `hub.db` and live Neovim behaviour are not evidence for this stage; p1, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- **Credentials are secrets.** Never print a password, invite token, cookie, challenge, assertion part or the hub secret; never put one in a screenshot, a capture or a topic. The probe prints lengths, digests, masked Locations and counts; `uinv` writes the URL line to `$Q/invite-*`; the screenshots are taken after sign-in or redirect, when no secret field is on the page. The scan proves the secrets are absent from the evidence too; a hit under `<EV>` is a QA fault to fix before publication, not a product failure.
- **127.0.0.1 is not localhost.** The printed invite URLs and the `cland web` link are on `127.0.0.1:<port>`; with this build's redirect (T-1568) the invite and sign-in pages live on `localhost:<port>`, and WebAuthn works only there. Every exact-Origin request must pair its Host and Origin (`localhost` with `http://localhost:<port>`); a 127/localhost mismatch is a 403 by design. A browser landing on host `127.0.0.1` for an invite page is a FAIL for the redirect, not a probe fault. API paths (`POST`) are never redirected, only the two navigation GETs.
- **The sign-in failure delay is a feature.** Five failures for one name or one address make the next attempts, a correct one included, wait a growing window (one second after the fifth). The rows never make more than three wrong attempts in a row before a correct one, and a success clears the counters. A 401 on a correct password right after a burst of wrong ones is the delay, not a product fault; wait and retry once and record both.
- The invite check order is: Host, Origin, method, then the invite. A request that fails an earlier check never reaches a later reason, so a foreign-Origin request with an unknown token is `Foreign Origin`, not `unknown invite`.
- The challenge lifetime is the hub's own 120 s of real time; the Web test file advances a fake clock, the scratch run cannot, hence the 125 s wait in E1536S3-10 and the `expire` fixture (a write of `expires=0` to `hub.db`, for the 24 h invite expiry; stage 2 proved the invite check on a database copy). Both are fixtures of time, not evidence about other clocks.
- Users are activated by the pages this stage built. Nothing is planted active; the only fixtures are the invite expiry (E1536S3-08), the stored-role change of E1536S3-14 (the evidence is the hub's answer to the next request on the same conversation, as in stage 2) and the planted pairings (E1536S3-15, E1536S3-16). A planted pairing proves the selector and reset rules, not that a messenger pairs.
- The messages are `queued` because no coordinator session exists: that is the precondition of withdrawal, not a delivery fault. Authorship is decided by user id: alex and dana share a display name on purpose, so read `userId` and the buttons, never the label.
- After the reset, single mode still names a user in `from` for messages that stored a user id, and the web shows "you" for every human message (stage 2 lesson); Withdraw follows the old `from` `human` fence, so a former user's queued message is not withdrawable there and a legacy one is. Judge E1536S3-16 by the stated refusal and buttons.
- `cland hub status` and the process census: judge only the fixture-owned pids and the processes naming `$Q`; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093).
- Edit existing keys in initialized configs (`lock_path`, `executor`); never add a second table (A-8634 R12). Second-client checks allow only defaults the new client writes itself.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays and add `scratchGitEnvironment` for Git; a hand-written shell `unset` filter keeps inherited `GIT_*` variables (E-1212 stage 1). Under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- An accessibility-tree count does not prove visible reachability: the sign-in page check reads the button's bounding box against the viewport and the horizontal overflow (A-9063 R6; T-1095, T-1097).
- Process cleanup probes use the fixture-owned census (`$Q/pids`: the hub pid, the probe and each browser group; plus processes whose command line names `$Q`), registered at launch and checked through exit.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: here the Neovim and Web files must run on this macOS run.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

- Remotes for every user (stage 4: T-1573, T-1574) and outbound fan-out to per-user pairings. Real Telegram and Discord: no bot, token or messenger runs; the pairing round trips (live code, `--user` refusal, two chats, the Neovim card) are proven by the named test files in E1536S3-06 with their fake messengers.
- A configured HTTPS origin (`[web] origin`), the tunnel (T-1624) and the `Secure` cookie flag: the scratch run has none, so the redirect and the RP id are exercised only for the no-origin case the interface note describes.
- Attribution, invites by CLI and the Accounts users list (stage 2, QA'd separately); `cland user` name rules.
- The T4 soak and load repetitions; the full T3/T4 suites and the stage cover pair (the Coordinator's occasion); a live restart.
- The Neovim workbench on the scratch hub: no headless-grid fixture switches modes; the headless-Neovim test file stands in for the pairing card.
- A real browser, computer use, the live hub and any change to live sessions, holds or the tracker.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. The Headless Shell instances open only p1's scratch edge (E1536S3-07 to E1536S3-16) or their own Web fixtures (the Web test files), under the crew browser rule (rule 18); the virtual authenticator is a Chromium CDP feature of that Headless Shell and needs no other grant. Every other check uses the rule 15 sealed environment with credentials filtered and only the fake harnesses.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "sign-in and pairing"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1536 stage sign-in and pairing` or `qa not clear E-1536 stage sign-in and pairing` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
