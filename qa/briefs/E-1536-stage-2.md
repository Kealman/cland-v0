# Stage QA brief: E-1536 stage 2 — attribution and invites

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`, the pinned Neovim of `node nvim/bin/nvim-path.ts` first on the sealed PATH, the suite's Chrome Headless Shell from the installed `playwright-core`).

## Changes since the last run

The stage ran clear at c14994a2 (A-15579). This version folds in the corrections the E-1536 Definition-of-done run (A-16246) applied to the blocks it reuses, and its launch pattern:

- `topic.send` frames with `qaSave` read the sent message's id back from the topic's history (the newest exact-text match), print `saved`, and save the id with a trailing newline; no match is BLOCKED (rule 22; correction 2e2038e4). Other `qaSave` frames are unchanged.
- `facts()` tests approvals OR asks OR archive, each defaulting to empty, before the messages branch, so `inbox.list` without `archive` no longer falls through (correction 9cc2bb99).
- The regular expressions and the one source-provenance line that the publication scanner (`assertPublishable`, `.agents/skills/qa/qa-demo-policy.ts`) flagged are reworded with the same meaning (`token[=]` in the patterns).
- The hub start, the browser modes and qa-oc's shell launch through `$Q/launch.mjs` (`fixtureEnvironment`, then `scratchGitEnvironment`), as stage 3 does; no `env …`, `TMPDIR=…` or `eval`-export overlay is left after the seal (correction a54f9472). The sealed `PATH` begins with the pinned Neovim (correction 76c6412f).

No assertion of a row changed. No real harness: the scratch hub runs the fake `claude`, `codex` and `opencode` of `hub/test/fakes/`.

## Stage

- Epic: E-1536 (Users and sign-in modes, under R-1530).
- Exact stage name: attribution and invites.
- Items, in plan order by lane: lane 1 T-1561 (Human messages carry their user, and deliveries name the author), then T-1564 (Both workbenches show who wrote); lane 2 T-1562 (Ask answers and approvals record who answered), then T-1571 (`--as <user>` in users mode); lane 3 T-1563 (Artifacts a person created carry their user); lane 4 T-1570 (The authority seam: a user-role column); lane 5 T-1565 (Invites: `cland user add` and the one-time invite link), then T-1569 (The admin's users list and invites from the web). The run reads the stage's members, counts and state from `task plan show E-1536` (E1536S2-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage at the tested build.
  - T-1561 and T-1564, human messages carry the user: in users mode a human message stores its user's id, reads back with `from` set to the user's name and `fromKind` `human`, and a delivery to an agent carries `from="<user name>" from_kind="human"` through the unchanged envelope. Messages written in single mode read as the first user's after the switch (A-15078 A7). The journal's `human-send` record carries the user id and never the text. Read time adds `userDisplayName` (users mode only; coord decision on T-1564, 2026-11-01 22:32Z). The web and Neovim threads show "you" for the viewer's own user and the display name for another user, deciding by user id; single mode shows "you" for every human message.
  - T-1562, ask and approval answers: the outcome records `by` (the user's name) and `userId`. The first answer wins; a second answer is refused naming the first answerer. The journal's `ask-answered` and `inbox-departure` records carry the user id. C7 (coord decision): the answer message an ask answer posts carries the same user as the outcome. Both workbenches show the answering name; single mode keeps "the human" and stand-in attribution.
  - T-1563: an artifact a person creates or uploads in users mode records `creatorUserId` and has the user's name as `creator`; agent artifacts carry no user id; audit and journal records of a human artifact carry the user id; single mode keeps `creator` `human`.
  - T-1570: every web request in users mode passes `userAuthorityRefusal`, which reads the acting user's role from the users table at request time. A role absent from a row's grant is refused with `User role <role> cannot request <request type>`. `roles` holds only `admin`; single mode is unchanged.
  - T-1565: `cland user add <name> [--display <name>]` creates an `invited` admin and prints `<name>  admin  invited`, then an invite URL `…/invite?token=<64 hex>` on the web edge's address. `cland user invite <name>` replaces that user's open invite. `cland auth mode users` prints the first user's invite. Invites are stored as SHA-256 digests with a 24-hour expiry, and the token appears only in the minting result. The invite check (a Users store API; its page is stage 3) accepts an open invite within 24 h and refuses `unknown invite`, `used invite`, `revoked invite` and `expired invite`. `cland auth reset` revokes open invites. C7 (coord decision): `auth.mode`, `auth.reset`, `user.list`, `user.add` and `user.invite` refuse a session shell with `auth and user commands require a local human shell`.
  - T-1569: in users mode the web's Accounts area holds a `Users` section whose fold header shows the row count and whose table lists name, display name, role and state. An admin creates a user there and sees its invite link once (`Invite link`, `Copy invite`, `Dismiss invite`). Coord decision: authenticated web admins pass the T-1565 guard; sessions are still refused. In single mode the section is absent, and web `user.add` and `user.list` are refused with `web user commands require users mode`.
  - T-1571 (not landed at writing; read from its branch head, see Build): in users mode `--as <user>` on `cland topic answer`, `cland topic create` and `cland artifact create` must name an existing active user, and the request is recorded as that user's: the outcome, `ask-answered`, `topic-created` (`by` and `userId`), the artifact's `creator`/`creatorUserId` and the audit `userId`. Unknown and invited-only users are refused before the write with `cannot act as user "<name>": user is unknown or not active`. Without `--as` the CLI acts as the first user. In single mode `--as` keeps its meaning: `topic answer` records a stand-in (`answered_as: stand-in`, `answered_by`), while `topic create`, `artifact create` and `approval.answer` stay `human` with no user id. A shell with `CLAND_SESSION_*` set still acts as its session (`--as … ignored`). Per A-15078 A10 and the coord correction of 2026-11-02, `topic.send` and `approval.answer` take the user at the hub frame seam (`as: {name}` on the frame; `hub/src/hub/cli-user.ts` `HUMAN_USER_WRITES`), since the CLI has no `topic send` or `approval answer` verb.
- Decisions governing the scope: A-15078 A3 (reset revokes open invites), A4 (the switch prints the first user's invite), A5 (name rules), A6 (the author travels in `from`; adapters and spoke untouched), A7 (null user ids read as the first user), A10 (`--as <user>` for human writes), A11 (one role-check seam), A16 (`cland user invite`); `docs/spec/v0.4.md` §3.8; `docs/agents/auth.md`; the coord decisions recorded in the comments of T-1562, T-1564, T-1565 and T-1569.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1561 C1 (stored user id; `from` the name, `fromKind` human) | E1536S2-03; E1536S2-17 (`messageUsers`, history) |
| T-1561 C2 (delivery carries the name; envelope and spoke unchanged) | E1536S2-03; E1536S2-17 (the driver's channel events); E1536S2-01 (no adapters or spoke path in any landing) |
| T-1561 C3 (two authors in history and in the Coordinator's deliveries) | E1536S2-03; E1536S2-17 |
| T-1561 C4 (single-mode messages read as the first user after the switch) | E1536S2-03; E1536S2-14 |
| T-1561 C5 (`human-send` carries the user id, never the text) | E1536S2-03; E1536S2-17 (journal window) |
| T-1561 C6 (single mode keeps `human`, no user id; existing tests unchanged) | E1536S2-03; E1536S2-11; E1536S2-01 (preserved files unedited) |
| T-1564 C1 (web: "you" and the display name, desktop and phone) | E1536S2-04; E1536S2-21 (Headless Shell, live included) |
| T-1564 C2 (Neovim: "you" and the display name) | E1536S2-04 only (headless Neovim test files; no Neovim surface on the scratch hub) |
| T-1564 C3 (single mode "you" everywhere; thread tests unchanged) | E1536S2-04; E1536S2-12; E1536S2-24; E1536S2-01 |
| T-1564 C4 (colour, contrast, key listeners) | E1536S2-01; E1536S2-02 (typecheck) |
| T-1562 C1 (ask outcome `by` and `userId`) | E1536S2-05; E1536S2-18 |
| T-1562 C2 (approval outcome `by` and `userId`) | E1536S2-05; E1536S2-19 |
| T-1562 C3 (first answer wins; second refused naming the first) | E1536S2-05; E1536S2-18 (ask), E1536S2-19 (approval) |
| T-1562 C4 (journal `ask-answered`, `inbox-departure` user id) | E1536S2-05; E1536S2-18; E1536S2-19 |
| T-1562 C5 (workbench outcome names) | E1536S2-05 only (the generated web and Neovim renderer cases) |
| T-1562 C6 (single mode and stand-in unchanged) | E1536S2-05; E1536S2-23 |
| T-1562 C7 (the answer message carries the answering user) | E1536S2-05; E1536S2-18 (answer message and saved history agree with the outcome) |
| T-1563 C1 (human create and upload record the user) | E1536S2-06; E1536S2-18 |
| T-1563 C2 (agent artifacts carry no user id) | E1536S2-06; E1536S2-18 (driver `artifact.create`) |
| T-1563 C3 (audit and journal carry the user id) | E1536S2-06; E1536S2-18 |
| T-1563 C4 (single mode `creator` `human`, no user id) | E1536S2-06; E1536S2-11 |
| T-1563 C5 (path reading unchanged) | E1536S2-06 (unedited path tests); E1536S2-01 |
| T-1570 C1, C3 (one table; a test-only role omitted from one request) | E1536S2-07 (the omitted-request table exists only in the test); E1536S2-17 (a stored role with no grant is refused naming role and request) |
| T-1570 C2 (role read from the users table per request) | E1536S2-07; E1536S2-17 (same conversation: allowed, refused after the stored role changes, allowed after it returns) |
| T-1570 C4 (`admin` the only shipped role) | E1536S2-07; E1536S2-14 (`roles`) |
| T-1570 C5 (single mode unchanged) | E1536S2-07 |
| T-1565 C1 (`user add`: invited admin, URL on the edge) | E1536S2-08; E1536S2-15 |
| T-1565 C2 (name rules, each refusal names its rule) | E1536S2-08; E1536S2-15; E1536S2-17 (the same rule from the web) |
| T-1565 C3 (digest and expiry only; token only in the minting result) | E1536S2-08; E1536S2-15 (`invites`, `scan`); E1536S2-22 (web mint, the token never in evidence) |
| T-1565 C4 (accepted within 24 h; used, expired and unknown refused distinctly) | E1536S2-08; E1536S2-15 (`invcheck` on a copy of the scratch `hub.db`) |
| T-1565 C5 (`user invite` replaces; the switch prints the first user's invite) | E1536S2-08; E1536S2-14; E1536S2-15 |
| T-1565 C6 (`auth reset` revokes open invites) | E1536S2-08; E1536S2-23 |
| T-1565 C7 (session-shell refusal on each of the guarded frames) | E1536S2-08; E1536S2-16 |
| T-1569 C1 (users listed with a count) | E1536S2-09; E1536S2-22 |
| T-1569 C2 (web creation, one-time invite link, CLI name rules) | E1536S2-09; E1536S2-22; E1536S2-17 |
| T-1569 C3 (single mode: list absent, web frames refused naming users mode) | E1536S2-09; E1536S2-11; E1536S2-23 |
| T-1569 C4 (colour, contrast, key listeners) | E1536S2-01; E1536S2-02; E1536S2-09 |
| T-1571 C1 (`topic answer --as <user>` recorded in outcome and journal) | E1536S2-10; E1536S2-18 |
| T-1571 C2 (unknown or invited-only `--as` refused naming the user) | E1536S2-10; E1536S2-18 (CLI and `topic.send` frame); E1536S2-19 (`approval.answer` frame) |
| T-1571 C3 (without `--as`: the first user) | E1536S2-10; E1536S2-18; E1536S2-19 |
| T-1571 C4 (single-mode stand-in unchanged) | E1536S2-10; E1536S2-23 |
| T-1571 C5 (a session shell acts as its session) | E1536S2-10; E1536S2-20 |
| A-15078 A10 (`topic create`, `artifact create`, `topic.send`, `approval.answer` with `--as`/`as`) | E1536S2-10; E1536S2-18; E1536S2-19 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1536` lists in stage `attribution and invites`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. At writing, dev was `ca366370d596c27c6859a15f86edf44cfcb7a0df` and these had landed: T-1561 `ed81ac0be15848b2944a77aedc97e152b62efb7f`, T-1562 `ca366370d596c27c6859a15f86edf44cfcb7a0df`, T-1563 `0488a63cb039bc16214f0da2ad2592d0f2f6c155`, T-1564 `040146338b147d102b0cceb8616bbde8efbe17aa`, T-1565 `9de0552f8e6b886bc6dedb2e55b02d33808fce0e`, T-1569 `91a4aaf36aeb58c39d84e50d4a079bd5242d4e83`, T-1570 `9980aea795211836796c543872033c6033e08fdc`. T-1571 had not landed: its branch `t/T-1571-as-user-in-users-mode` stood at head `90717aea72320079295b31fdd9d503f63b0e6979` (commits `cd8a091fc` and `90717aea7` on top of dev), and its expectations below were read from that head. Re-check them with grep at the tested build, and re-read its landing (`git show --stat` and its help text) before judging, since review may still change it. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). E1536S2-02 builds `$W/web/dist` (ignored by Git): the scratch hub's web edge serves it and the Web test files load it.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its `hub.db` or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). The live hub is read only by QA's own shell for E1536S2-00's plan read and `quiet` (cover-quiet admission). **Harnesses:** only the fakes in `$W/hub/test/fakes/` run, named by `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN` and `CLAND_OPENCODE_BIN` and first on the scratch hub's `PATH`; no real Claude Code, Codex or OpenCode, no login, no provider. **Browser (rule 18):** the only browsers are Chrome Headless Shell instances started by the probe's `page` and `users` modes (each with its own scratch profile under `$Q/b`) and by the Web test files (their own fixtures); no real browser, no GUI, no computer use. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. Messages, selectors and test titles are marked verified or inferred under "Source provenance" below. **Secrets:** the hub secret, sign-in links, cookies and invite tokens are never printed, posted or written under `$EV`; the probe and helpers print a token's length and the first 12 hex of its SHA-256 digest only.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, runs the named test files through `nt` (which seals each run) and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. That file holds the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays, then `scratchGitEnvironment` (same module) with a scratch `core.excludesFile`. It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable, and keeps `PATH`, `SHELL`, `TERM` and `TMPDIR`. It synthesizes its own scratch values under `$Q`: HOME, XDG, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, the `FAKE_*_HOME` directories, `CLAND_EXECUTOR_STATE`, the messenger sentinels and `CLAND_TEST_OWNED_ROOT`. Its `PATH` begins with the build's pinned Neovim (`node nvim/bin/nvim-path.ts`, the release of `nvim/NVIM_VERSION`), never an inherited or Homebrew `nvim`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030); only the probe's browser modes point `TMPDIR` at `$Q/b`. A launch that needs variables of its own (the scratch hub's fake-harness `PATH` and `CLAND_*` inputs, the browser modes' `TMPDIR`, qa-oc's session identity for its shell) goes through `$Q/launch.mjs`, which passes them as overlays to `fixtureEnvironment(Q, base, overlays)` and then `scratchGitEnvironment(Q, …)`: never an `env …` prefix, a variable assignment before the command, an `export` or `eval` after sourcing `env.sh` or a spread of `process.env` (the E-1536 stage-3 pattern; E-1536 DoD run correction a54f9472). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e1536s2-` (its realpath, short enough for the scratch hub's socket).

One scratch project, **p1**: a fresh `cland init` project whose local Git config sets `user.name` to `Jane Q. Doe`, with a CLI-started hub run from the tested worktree (`$W/hub/bin/cland.ts hub start`, so its web edge serves `$W/web/dist`), the fakes first on its `PATH` and authoritative through `CLAND_*_BIN`, and the machine-wide orphan sweep off. Its actors:
- the local human (the CLI, and socket frame clients saying `client: "nvim"` as Neovim does), which acts as the first user `jane-q-doe` in users mode;
- web conversations over the edge's `/ws` with cookies from one-time links;
- one launched session **qa-oc** (role implementer, fake OpenCode). Its shell environment (`CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_LAUNCH_TOKEN`, `CLAND_ROLE`, `CLAND_HUB_FILE`, read from the `mcp.servers.cland.environment` of `.cland/opencode/qa-oc/opencode.json`) is the session shell. It raises an approval when a message containing `needs approval` reaches it.
- one driver session **qa-coord** (role coordinator): a real spoke started through `hub/test/harness.ts`'s `spawnSpoke`, as E-413 stage 2's driver was. It raises the asks, creates the agent artifact and records every channel event it receives.

A second user **alex** (`Alex Smith`) is created with `cland user add` and then planted active with a web session row in the scratch `hub.db`, the way `hub/test/answer-users.test.ts` does. Stage 3's sign-in pages, which would activate an invited user, are not in this build. **bob** stays invited.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-1536; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1536s2-$RUN          # the clean detached build
EV=$R/.cland/qa/E-1536/$RUN                    # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e1536s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e1536s2-…
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

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git, account and fake-harness paths; do not merely unset keys absent from it. Then apply `scratchGitEnvironment`, and remove the broader credential prefixes last. The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports. Under rule 15, check zero credential-prefix names before launching any scratch process (the last lines below print a count and variable names only, never values). The block also writes `$Q/launch.mjs`, the only launcher of the hub, the browser modes and qa-oc's shell.

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" "$EV" > "$Q/env.sh" <<'JS'
const [m,root,worktree,ev]=process.argv.slice(2);
const {fixtureEnvironment,scratchGitEnvironment}=await import(m);
const {execFileSync}=await import('node:child_process'), {dirname}=await import('node:path');
// the pinned Neovim of the build (nvim/NVIM_VERSION, nvim/bin/nvim-path.ts), first on the sealed PATH; never the inherited PATH or Homebrew
const nvim=execFileSync(process.execPath,[`${worktree}/nvim/bin/nvim-path.ts`],{encoding:'utf8'}).trim();
let env=fixtureEnvironment(root,process.env,{
  PATH: `${dirname(nvim)}:${process.env.PATH}`,
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
# probe <mode> [args…]: the frame/web/db/journal/invite probe against p1 (see probe.mjs); bprobe: its browser modes page and users (cwd $QA_W, TMPDIR $QA_Q/b) through the launcher
probe() { node "$QA_Q/probe.mjs" "$1" "$QA_Q/p1" "${@:2}"; }
bprobe() { node "$QA_Q/launch.mjs" browser "$@"; }
# pick <expr> [args…]: evaluate <expr> on the JSON read from stdin as v, with the extra args as A
pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const A=process.argv.slice(2);const r=eval(process.argv[1]);console.log(typeof r==="string"?r:JSON.stringify(r))})' "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: start this project's hub with the fakes authoritative and first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { node "$QA_Q/launch.mjs" hub && hp >> "$QA_Q/pids"; }
amode() { sed -n '/^\[auth\]/,/^\[/p' .cland/config.toml | grep -E '^mode = '; }
# off / joff: the byte sizes of p1's hub log and journal, the start of an audit or journal window
off() { wc -c < .cland/log/hub.log | tr -d ' '; }
joff() { if [ -f .cland/journal.jsonl ]; then wc -c < .cland/journal.jsonl | tr -d ' '; else echo 0; fi; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
srow() { cland session list --json | pick 'const p=v.processes.find(p=>p.name===A[0]);p?[p.status,p.state,p.pid??"none"].join(" "):"absent"' "$1"; }
waitrun() { n=0; while [ "$n" -lt "$2" ]; do r=$(srow "$1"); case "$r" in "running "*" none") ;; "running "*) echo "${r##* }" >> "$QA_Q/pids"; echo "$1: $r"; return 0;; esac; sleep 1; n=$((n+1)); done; echo "$1: timeout after $2 s, last $r"; return 1; }
waitstop() { n=0; while [ "$n" -lt "$2" ]; do r=$(srow "$1"); p=${r##* }; case "$r" in "stopped "*) if [ "$p" = none ] || ! kill -0 "$p" 2>/dev/null; then echo "$1: stopped, process gone"; return 0; fi;; esac; sleep 1; n=$((n+1)); done; echo "$1: not stopped after $2 s, last $r"; return 1; }
# sesh <session> <cland args…>: the CLI run in that launched OpenCode session's shell identity, through the launcher (never prints the credential)
sesh() { node "$QA_Q/launch.mjs" session "$@"; }
# run <label> <cland args…> / srun <label> <session> <cland args…>: exit status, stdout and stderr of one CLI call
# (used only where no token can print: never for user add, user invite or auth mode users)
run() { l=$1; shift; cland "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; sed 's/^/  out: /' "$QA_Q/r.out"; sed 's/^/  err: /' "$QA_Q/r.err"; }
srun() { l=$1; s=$2; shift 2; sesh "$s" "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; sed 's/^/  out: /' "$QA_Q/r.out"; sed 's/^/  err: /' "$QA_Q/r.err"; }
# artc <label> [--as <name>] --title <title>: a note artifact in General from the CLI; exit, stderr and the creator facts
artc() { l=$1; shift; cland artifact create --kind note --content qa --topic general --json "$@" > "$QA_Q/a.out" 2> "$QA_Q/a.err"; x=$?; echo "$l exit $x err: $(head -n 2 "$QA_Q/a.err" | tr '\n' ' ')"; [ "$x" = 0 ] && pick '({id:v.artifact.id,title:v.artifact.title,creator:v.artifact.creator,creatorKind:v.artifact.creatorKind??null,creatorUserId:v.artifact.creatorUserId??null})' < "$QA_Q/a.out"; }
# ishape <file>: an invite URL line's shape, its token length and the first 12 hex of the token's SHA-256 (never the token)
ishape() { node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8").trim();const m=t.match(/^http:\/\/127\.0\.0\.1:[0-9]+\/invite\?token[=]([0-9a-f]+)$/);console.log(m?"shape ok, token length "+m[1].length+", digest12 "+require("crypto").createHash("sha256").update(m[1]).digest("hex").slice(0,12):"shape mismatch")' "$1"; }
# idsj <out> <label>=<saved name>…: write {"label":"<id saved in $QA_Q/<saved name>>"} to $QA_Q/<out>; a missing file is skipped and named
idsj() { node -e 'const fs=require("fs"),Q=process.env.QA_Q,r={};for(const a of process.argv.slice(2)){const i=a.indexOf("="),f=Q+"/"+a.slice(i+1);if(fs.existsSync(f))r[a.slice(0,i)]=fs.readFileSync(f,"utf8").trim();else console.log("missing "+a)}fs.writeFileSync(Q+"/"+process.argv[1],JSON.stringify(r));console.log(Object.keys(r).join(", "))' "$@"; }
# devents <id…>: the driver's received channel events whose msg_id or answer_to is one of the ids (envelope meta only)
devents() { node -e 'const ids=new Set(process.argv.slice(1));for(const l of require("fs").readFileSync(process.env.QA_EV+"/E1536S2-drv.txt","utf8").split("\n")){let e;try{e=JSON.parse(l)}catch{continue}const m=e.event&&e.event.meta;if(m&&(ids.has(m.msg_id)||ids.has(m.answer_to)))console.log(JSON.stringify({msg_id:m.msg_id,from:m.from,from_kind:m.from_kind,answer_to:m.answer_to??null,answered_as:m.answered_as??null,answered_by:m.answered_by??null}))}' "$@"; }
# dtool <tool>: the driver's results of that tool call (artifact facts or the error)
dtool() { node -e 'for(const l of require("fs").readFileSync(process.env.QA_EV+"/E1536S2-drv.txt","utf8").split("\n")){let e;try{e=JSON.parse(l)}catch{continue}if(e.tool===process.argv[1]){const a=e.result&&e.result.artifact;console.log(JSON.stringify(a?{id:a.id,creator:a.creator,creatorKind:a.creatorKind??null,creatorUserId:a.creatorUserId??null}:e.result))}else if(e.step&&e.step.tool===process.argv[1])console.log(JSON.stringify({error:e.error}))}' "$1"; }
ENV
cat > "$Q/launch.mjs" <<'JS'
// node "$QA_Q/launch.mjs" hub | browser <mode> [args…] | session <name> <cland args…>   (sealed) the launch's own variables are overlays of fixtureEnvironment, then scratchGitEnvironment; nothing is added afterwards
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const { QA_Q: Q, QA_W: W } = process.env;
if (!W || !/^\/private\/tmp\/qa-e1536s2-/.test(Q ?? '')) throw new Error('not a scratch run');
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const [mode, ...args] = process.argv.slice(2);
let extra, argv, cwd = process.cwd();
if (mode === 'hub') {   // the fakes authoritative and first on PATH, no machine-wide orphan sweep
  const F = `${W}/hub/test/fakes`;
  extra = { PATH: `${F}/claude-code:${F}/codex:${F}/opencode:${process.env.PATH}`, CLAND_CLAUDE_BIN: `${F}/claude-code/claude`, CLAND_CODEX_BIN: `${F}/codex/codex`, CLAND_OPENCODE_BIN: `${F}/opencode/opencode`, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '200', CLAND_CLAUDE_AGENTS_MS: '500' };
  argv = [`${W}/hub/bin/cland.ts`, 'hub', 'start'];
} else if (mode === 'browser') {   // the probe's browser modes: cwd $QA_W, TMPDIR $QA_Q/b
  extra = { TMPDIR: `${Q}/b` }; cwd = W; argv = [`${Q}/probe.mjs`, args[0], `${Q}/p1`, ...args.slice(1)];
} else if (mode === 'session') {   // that launched session's shell identity from its OpenCode config in this project (names only ever printed elsewhere)
  const c = JSON.parse(readFileSync(`.cland/opencode/${args[0]}/opencode.json`, 'utf8')).mcp.servers.cland.environment;
  extra = Object.fromEntries(['CLAND_SESSION_ID', 'CLAND_SESSION_NAME', 'CLAND_LAUNCH_TOKEN', 'CLAND_ROLE', 'CLAND_HUB_FILE'].filter(k => c[k]).map(k => [k, String(c[k])]));
  argv = [`${W}/hub/bin/cland.ts`, ...args.slice(1)];
} else throw new Error(`unknown launch mode ${mode}`);
const env = scratchGitEnvironment(Q, fixtureEnvironment(Q, process.env, {
  XDG_CONFIG_HOME: `${Q}/xdg/config`, XDG_STATE_HOME: `${Q}/xdg/state`, XDG_DATA_HOME: `${Q}/xdg/data`, XDG_CACHE_HOME: `${Q}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid', GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  ...extra,
}), { excludesFile: `${Q}/home/.gitignore-global` });
const child = spawn(process.execPath, argv, { cwd, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
JS
node --check "$Q/launch.mjs" && echo "launcher checked"
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
( . "$Q/env.sh"; echo "sealed nvim: $(command -v nvim); $(nvim --version 2>/dev/null | head -n 1)" )
cat > "$Q/drv-steps.jsonl" <<'STEPS'
{"tool":"ask","args":{"topic":"general","question":"QA ask 1?","options":["QA yes","QA no"]},"save":"ask1"}
{"tool":"ask","args":{"topic":"general","question":"QA ask 2?","options":["QA yes","QA no"]},"save":"ask2"}
{"tool":"ask","args":{"topic":"general","question":"QA ask 3?","options":["QA yes","QA no"]},"save":"ask3"}
{"tool":"ask","args":{"topic":"general","question":"QA ask 4?","options":["QA yes","QA no"]},"save":"ask4"}
{"tool":"ask","args":{"topic":"general","question":"QA ask 5?","options":["QA yes","QA no"]},"save":"ask5"}
{"qa":"file","path":"go-art","ms":21600000}
{"tool":"artifact.create","args":{"kind":"note","title":"QA agent note","content":"agent","topic":"general"}}
STEPS
```

The driver. A real spoke started through the test harness (`spawnSpoke`, which first assigns the role on the project's socket as the human would). It appends its own pid and the spoke's to `$QA_Q/pids`, prints every channel event it receives as `{"event":{content,meta}}`, runs its steps in order and stays connected until `$QA_Q/stop-drv` exists (at most 6 h). `m13` starts it detached (own session) because it must stay alive through m23 and the reset, across separate calls; a plain background job of the call's shell dies with that shell (E-1536 stage 2 run: it had exited before m17). Its presence is shown by `driver ready lines 1` and by the session list row `qa-coord` (`live` true, role `coordinator`), not by `who`: the shell CLI has no `who` command.

```sh
cat > "$Q/drv.mjs" <<'JS'
// node "$QA_Q/drv.mjs" <scratch project> <name> <role> <steps file> <stop file>   (sealed, in that project, stdin /dev/null)
//   {"tool":T,"args":{…},"save":"<name>"}  call a tool, print {"tool","args","result","at"}; an ask id goes to $QA_Q/<name>
//   {"qa":"file","path":"<name>","ms":N}   wait up to N ms (default 60000) until $QA_Q/<name> exists
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
const [cwd, name, role, stepsFile, stop] = process.argv.slice(2);
const QQ = process.env.QA_Q;
if (!cwd || !QQ || !cwd.startsWith(`${QQ}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
const steps = readFileSync(stepsFile, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { spawnSpoke } = await import(`${process.env.QA_W}/hub/test/harness.ts`);
const session = await spawnSpoke({ discover: true, cwd, name, role, sessionId: `qa-${name}` });
appendFileSync(`${QQ}/pids`, `${process.pid}\n${session.pid}\n`);
let printed = 0;
const flush = () => { for (; printed < session.events.length; printed++) console.log(JSON.stringify({ event: session.events[printed].params })); };
const pump = setInterval(flush, 100);
await session.waitForPresence([name]);
console.log(JSON.stringify({ ready: name, pid: session.pid, at: new Date().toISOString() }));
for (const step of steps) {
  try {
    if (step.qa === 'file') {
      const until = Date.now() + (step.ms ?? 60000);
      while (!existsSync(`${QQ}/${step.path}`) && Date.now() < until) await sleep(200);
      console.log(JSON.stringify({ qa: 'file', path: step.path, found: existsSync(`${QQ}/${step.path}`) }));
    } else {
      const result = await session.call(step.tool, step.args ?? {});
      console.log(JSON.stringify({ tool: step.tool, args: step.args, result, at: new Date().toISOString() }));
      if (step.save && result?.ask) writeFileSync(`${QQ}/${step.save}`, String(result.ask));
    }
  } catch (error) { flush(); console.log(JSON.stringify({ step, error: String(error) })); }
  await sleep(300);
}
const until = Date.now() + 6 * 3600 * 1000;
while (!existsSync(`${QQ}/${stop}`) && Date.now() < until) await sleep(200);
flush(); clearInterval(pump);
await session.close();
console.log(JSON.stringify({ closed: name }));
process.exit(0);
JS
```

The probe. It prints one JSON line per fact and never prints a link or invite token, a cookie or the hub secret; the ones it keeps for later rows stay in `$Q` (mode 600). Frame lists are JSON arrays. A string value `"@file:<name>"` becomes the trimmed text of `$QA_Q/<name>`. A frame's `qaSave: [<name>, <dotted path>]` is not sent. On a `topic.send` frame, after the send succeeds, the probe reads `topic.history` for that topic on the same conversation and saves the id of the newest message with exactly the sent text to `$QA_Q/<name>`, one id with a trailing newline (rule 22: a sent message's id comes from topic history, never from the send result); it prints `saved` with `name`, `fromHistory`, `matches` and `found`, and when nothing matches it saves nothing and prints a `BLOCKED` line (the row is then BLOCKED, with every row that reads that id). On every other frame (`topic.answer`, for one) `qaSave` saves that dotted path of the result value, as before. The `facts()` composite branch for `inbox.list` (approvals, asks or archive, each optional) comes before the `messages` branch (E-1536 DoD run correction 9cc2bb99; the earlier both-arrays test let an inbox without `archive` fall through). Web conversations send `hello` with a forged `userId` field, so the welcome name proves the user comes from the cookie.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> <p1 root> [args…]   (sealed; modes page and users run through launch.mjs browser: cwd $QA_W, TMPDIR $QA_Q/b)
// sock <frames> | web <tag> [frames] | wsend <tag> <frames> | plant <name> <cookie tag> | rolecheck <tag> | approval <session> <save>
// db | snap | journal <offset> | audit <offset> | invcheck <labels> [consume] | scan <labels> | page <ids file> <png> <0|1> [live tag] | users <png>
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';
const [mode, root, a1, a2, a3, a4] = process.argv.slice(2);
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV;
if (!W || !Q || !root || !root.startsWith(`${Q}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const req = createRequire(`${W}/package.json`);
const out = (key, value) => console.log(JSON.stringify({ [key]: value }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fill = v => typeof v === 'string' && v.startsWith('@file:') ? readFileSync(`${Q}/${v.slice(6)}`, 'utf8').trim()
  : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
const LINK = /^http:\/\/127\.0\.0\.1:[0-9]+\/auth\?token[=][0-9a-f]{64}$/;
// cland web --no-open from p1, as the human's CLI does; only the link's shape is printed
const mint = () => { const url = execFileSync(process.execPath, [`${W}/hub/bin/cland.ts`, 'web', '--no-open'], { cwd: root, encoding: 'utf8' }).trim(); out('linkShape', LINK.test(url)); return url; };
const token = label => (readFileSync(`${Q}/invite-${label}`, 'utf8').trim().match(/\/invite\?token[=]([0-9a-f]{64})$/) ?? [])[1] ?? '';
const msg = m => ({ id: m.id, text: m.text, from: m.from, fromKind: m.fromKind, userId: m.userId ?? null, userDisplayName: m.userDisplayName ?? null, answerTo: m.answerTo ?? null });
const art = a => ({ id: a.id, title: a.title, creator: a.creator, creatorKind: a.creatorKind ?? null, creatorUserId: a.creatorUserId ?? null });
const facts = v => {
  if (!v || typeof v !== 'object') return { value: v ?? null };
  if (v.artifact) return { artifact: art(v.artifact) };
  if (Array.isArray(v.artifacts)) return { artifacts: v.artifacts.map(art) };
  if (v.message) return { message: msg(v.message) };
  // inbox.list: approvals OR asks OR archive (each may be absent: empty), tested before the messages branch, or the inbox falls through and its asks are lost
  if (Array.isArray(v.approvals) || Array.isArray(v.asks) || Array.isArray(v.archive)) return { approvals: (v.approvals ?? []).map(r => ({ id: r.id, session: r.session, state: r.state, choices: r.choices })), asks: (v.asks ?? []).map(r => r.id), archive: (v.archive ?? []).filter(r => r.outcome).map(r => ({ id: r.id, kind: r.kind, outcome: r.outcome })), messages: (v.messages ?? []).filter(m => String(m.text ?? '').startsWith('QA')).map(msg) };
  if (Array.isArray(v.messages)) return { messages: v.messages.filter(m => String(m.text ?? '').startsWith('QA')).map(msg) };
  if (v.approval) return { approval: { id: v.approval.id, state: v.approval.state, outcome: v.approval.outcome ?? null } };
  if (Array.isArray(v.users)) return { users: v.users.map(u => ({ id: u.id, name: u.name, displayName: u.displayName, role: u.role, state: u.state })) };
  if (v.topic) return { topic: { id: v.topic.id, title: v.topic.title } };
  if (v.user) return { user: { id: v.user.id, name: v.user.name, displayName: v.user.displayName, role: v.user.role, state: v.user.state }, urlShape: typeof v.url === 'string' ? /\/invite\?token[=][0-9a-f]{64}$/.test(v.url) : null };
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
    out(`${frame.id} ${frame.type}${frame.as ? ` as ${frame.as.name}` : ''}`, r === null ? { timeout: true } : r.ok ? { ok: true, ...facts(r.value) } : { ok: false, code: r.code ?? null, error: r.error ?? null });
    if (qaSave && r?.ok && frame.type === 'topic.send') {  // rule 22: a sent message's id comes from its topic's history, never from the send result
      const hid = `${frame.id}h`, hist = wait(f => f.type === 'result' && f.id === hid, 30000);
      send({ type: 'topic.history', topic: frame.topic, id: hid });
      const h = await hist, mine = (h?.ok ? h.value.messages ?? [] : []).filter(m => m.text === frame.text);
      const id = mine.length ? mine[mine.length - 1].id : null;   // the newest exact-text match
      out('saved', { name: qaSave[0], fromHistory: true, matches: mine.length, found: id !== null });
      if (id !== null) writeFileSync(`${Q}/${qaSave[0]}`, `${id}\n`);
      else out('BLOCKED', `no message with the sent text in the topic history for ${qaSave[0]} (rule 22)`);
    } else if (qaSave && r?.ok) writeFileSync(`${Q}/${qaSave[0]}`, String(qaSave[1].split('.').reduce((o, k) => o?.[k], r.value)));
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
// one request on the local socket, the raw result frame (for polling)
async function request(frame) {
  const d = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
  const s = createConnection(d.socket); s.setEncoding('utf8'); s.on('error', () => {});
  await once(s, 'connect');
  return new Promise(resolve => {
    let buf = '', sent = false;
    const timer = setTimeout(() => { s.end(); resolve(null); }, 15000);
    s.on('data', chunk => { buf += chunk; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); let f; try { f = JSON.parse(line); } catch { continue; }
      if (f.type === 'welcome' && !sent) { sent = true; s.write(`${JSON.stringify({ ...frame, id: 'r1' })}\n`); }
      else if (f.type === 'result' && f.id === 'r1') { clearTimeout(timer); s.end(); resolve(f); } } });
    s.write(`${JSON.stringify({ type: 'hello', protocol: 2, secret: d.secret, client: 'nvim' })}\n`);
  });
}
// a Headless Shell page signed in through a fresh `cland web --no-open` link; body(page) does the checks
async function browse(png, phone, body) {
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
    const context = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } }), serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    const page = await context.newPage();
    await page.goto(mint());
    await page.locator('[data-phone]').first().waitFor();
    out('layoutPhone', await page.locator('[data-phone]').first().getAttribute('data-phone'));
    await body(page);
    await page.screenshot({ path: png }); out('screenshot', png);
    await context.close(); await browser.close();
  } catch (error) { out('step', String(error?.message ?? error)); }
  finally { await server.close(); await exited; }
  out('browserGroupAfter', execFileSync('ps', ['-e', '-o', 'pid=,pgid='], { encoding: 'utf8' }).split('\n').map(l => l.trim().split(/\s+/).map(Number)).filter(([, g]) => g === group).length);
}
const general = 'general';
const label = async (page, id) => { const h = page.locator(`[data-message-id="${id}"] header strong`).first(); await h.waitFor(); return h.innerText(); };
switch (mode) {
  case 'sock': await sock(JSON.parse(a1)); break;
  case 'web': {
    const url = mint();
    const r = await fetch(url, { redirect: 'manual' });
    out('redeem', r.status);
    writeFileSync(`${Q}/cookie-${a1}.json`, JSON.stringify({ cookie: (r.headers.get('set-cookie') ?? '').split(';')[0], origin: new URL(url).origin }), { mode: 0o600 });
    await web(a1, a2 ? JSON.parse(a2) : []);
    break;
  }
  case 'wsend': await web(a1, JSON.parse(a2)); break;
  case 'plant': {
    const { cookie, origin } = JSON.parse(readFileSync(`${Q}/cookie-${a2}.json`, 'utf8'));
    const value = randomBytes(32).toString('hex');
    const db = new DatabaseSync(`${root}/.cland/hub.db`);
    try {
      const user = db.prepare('select id from users where name=?').get(a1);
      db.prepare("update users set state='active' where name=?").run(a1);
      db.prepare('insert into web_sessions (id,cookie_hash,created_at,last_used_at,user_id) values (?,?,?,?,?)')
        .run(`qa-${a1}-session`, createHash('sha256').update(value).digest('hex'), Date.now(), Date.now(), user.id);
      out('planted', { name: a1, userId: user.id, state: db.prepare('select state from users where id=?').get(user.id).state });
    } finally { db.close(); }
    writeFileSync(`${Q}/cookie-${a1}.json`, JSON.stringify({ cookie: `${cookie.split('=')[0]}=${value}`, origin }), { mode: 0o600 });
    break;
  }
  case 'rolecheck': await web(a1, [{ type: 'hub.status' }, { type: 'qa.role', name: a1, role: 'qa-test-role' }, { type: 'hub.status' }, { type: 'qa.role', name: a1, role: 'admin' }, { type: 'hub.status' }]); break;
  case 'approval': {
    const seen = new Set(readdirSync(Q).filter(f => /^ap[0-9]+$/.test(f)).map(f => readFileSync(`${Q}/${f}`, 'utf8').trim()));
    let found = null;
    for (let i = 0; i < 120 && !found; i++) {
      const r = await request({ type: 'inbox.list' });
      found = (r?.value?.approvals ?? []).find(x => x.session === a1 && x.state === 'pending' && !seen.has(x.id)) ?? null;
      if (!found) await sleep(500);
    }
    if (found) writeFileSync(`${Q}/${a2}`, found.id);
    out('approval', found ? { id: found.id, session: found.session, kind: found.kind, state: found.state, choices: found.choices } : 'none within 60 s');
    break;
  }
  case 'db': case 'snap': {
    const db = new DatabaseSync(`${root}/.cland/hub.db`, { readOnly: true });
    try {
      out('users', db.prepare('select id, name, display_name, role, state from users order by created, rowid').all().map(r => ({ ...r })));
      out('roles', db.prepare('select name from roles order by name').all().map(r => r.name));
      out('authState', db.prepare('select mode from auth_state').all().map(r => r.mode));
      out('inviteColumns', db.prepare('pragma table_info(user_invites)').all().map(c => c.name));
      out('invites', db.prepare('select u.name as name, i.digest as digest, i.expires as expires, i.state as state from user_invites i join users u on u.id = i.user_id order by i.rowid').all()
        .map(r => ({ name: r.name, digestLength: String(r.digest).length, digest12: String(r.digest).slice(0, 12), state: r.state, ...(mode === 'db' ? { hoursLeft: Math.round((Number(r.expires) - Date.now()) / 36e3) / 100 } : { expires: Number(r.expires) }) })));
      if (mode === 'db') {
        out('messageUsers', db.prepare("select id, text, from_name, user_id from messages where text like 'QA%' order by rowid").all().map(r => ({ ...r })));
        out('webSessionUsers', db.prepare('select id, user_id from web_sessions order by created_at').all().map(r => ({ id: String(r.id).startsWith('qa-') ? r.id : 'minted', userId: r.user_id })));
      }
    } finally { db.close(); }
    break;
  }
  case 'journal': {
    await sleep(2000);
    const file = `${root}/.cland/journal.jsonl`;
    const text = existsSync(file) ? readFileSync(file).subarray(Number(a1)).toString('utf8') : '';
    for (const line of text.split('\n')) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (!['human-send', 'ask-answered', 'inbox-departure', 'event-announced', 'topic-created'].includes(e.event)) continue;
      if (e.event === 'event-announced' && e.kind !== 'artifact') continue;
      out('journal', { event: e.event, id: e.id ?? e.artifact ?? e.topic ?? null, by: e.by ?? null, userId: e.userId ?? null, answered_as: e.answered_as ?? null, answered_by: e.answered_by ?? null,
        outcomeBy: e.outcome?.by ?? null, outcomeUserId: e.outcome?.userId ?? null, ...(e.event === 'human-send' ? { textFree: !line.includes('QA ') } : {}) });
    }
    break;
  }
  case 'audit': {
    await sleep(1000);
    const text = readFileSync(`${root}/.cland/log/hub.log`).subarray(Number(a1)).toString('utf8');
    for (const line of text.split('\n')) { let e; try { e = JSON.parse(line); } catch { continue; } if (e.event === 'audit') out('audit', { tool: e.tool, client: e.client ?? null, session: e.session, userId: e.userId ?? null, outcome: e.outcome ?? null }); }
    break;
  }
  case 'invcheck': {
    // the invite check runs on a backup copy of the scratch hub.db, never on the running hub's file
    const { Users } = await import(`${W}/hub/src/hub/users.ts`);
    const src = new DatabaseSync(`${root}/.cland/hub.db`, { readOnly: true });
    const copy = `${Q}/invite-copy-${Date.now()}.db`;
    try { await backup(src, copy); } finally { src.close(); }
    const db = new DatabaseSync(copy), users = new Users(db), now = Date.now();
    const check = (t, at) => { try { return `ok ${users.checkInvite(t, at).name}`; } catch (e) { return String(e.message); } };
    out('unknown', check(randomBytes(32).toString('hex'), now));
    for (const name of JSON.parse(a1)) {
      const t = token(name);
      const r = { label: name, tokenLength: t.length, digest12: createHash('sha256').update(t).digest('hex').slice(0, 12), now: check(t, now), at23h: check(t, now + 23 * 3600e3), at24h: check(t, now + 24 * 3600e3 + 1000) };
      if (a2 === 'consume') { try { users.consumeInvite(t, now); r.consume = 'ok'; } catch (e) { r.consume = String(e.message); } r.again = check(t, now); }
      out('invite', r);
    }
    db.close();
    break;
  }
  case 'scan': {
    const files = [];
    const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(p); } };
    walk(`${root}/.cland`); walk(EV);
    for (const name of JSON.parse(a1)) {
      const t = token(name);
      out('scan', { label: name, filesScanned: files.length, hits: t.length === 64 ? files.filter(f => readFileSync(f).includes(t)).map(f => f.replace(root, '<p1>').replace(EV, '<EV>')) : ['token unreadable'] });
    }
    break;
  }
  case 'page': {
    const ids = JSON.parse(readFileSync(`${Q}/${a1}`, 'utf8'));
    await browse(a2, a3 === '1', async page => {
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      await page.locator(`[data-object-id="${general}"]`).first().click();
      for (const [name, id] of Object.entries(ids)) out('label', { message: name, shown: await label(page, id) });
      if (a4) {
        const text = `QA ${a4} live ${a3 === '1' ? 'phone' : 'desktop'}`;
        await web(a4, [{ type: 'topic.send', topic: 'general', text, qaSave: [`live-${a3}`, 'message.id'] }]);
        out('label', { message: text, shown: await label(page, readFileSync(`${Q}/live-${a3}`, 'utf8').trim()) });
      }
    });
    break;
  }
  case 'users': {
    await browse(a1, false, async page => {
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      const users = page.getByRole('region', { name: 'Users', exact: true });
      await users.locator('tbody tr').first().waitFor();
      const rows = () => users.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent)));
      out('rows', await rows()); out('header', await users.locator('header').first().textContent());
      await users.getByLabel('Name', { exact: true }).fill('carol');
      await users.getByLabel('Display name', { exact: true }).fill('Carol Q');
      await users.getByRole('button', { name: 'Create user', exact: true }).click();
      await users.getByRole('cell', { name: 'Carol Q', exact: true }).waitFor();
      const link = await users.getByLabel('Invite link', { exact: true }).inputValue();
      out('inviteShape', { matches: /\/invite\?token[=][0-9a-f]{64}$/.test(link), tokenLength: (link.split('token=')[1] ?? '').length });
      out('rowsAfter', await rows()); out('headerAfter', await users.locator('header').first().textContent());
      await users.getByRole('button', { name: 'Dismiss invite' }).click();
      out('inviteFieldsAfterDismiss', await users.getByLabel('Invite link', { exact: true }).count());
      await page.reload();
      if (!(await users.isVisible().catch(() => false))) await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      await users.getByRole('cell', { name: 'Carol Q', exact: true }).waitFor();
      out('inviteFieldsAfterReload', await users.getByLabel('Invite link', { exact: true }).count());
    });
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
process.exit(0);
JS
node --check "$Q/probe.mjs" && node --check "$Q/drv.mjs" && echo "probe and driver checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows that run in p1 call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it. "U" below is jane-q-doe's user id and "A" alex's, as `probe db` prints them in E1536S2-14 and E1536S2-15.

```sh
m00() {   # QA's own shell: build, membership, landings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1536 --json) > "$EV/E1536S2-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=p.stages.find(x=>x.name==="attribution and invites");console.log(JSON.stringify({state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}))' "$EV/E1536S2-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name==="attribution and invites").items.join(" "))' "$EV/E1536S2-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
m01() {   # QA's own shell, read-only in $W: preserved tests, boundaries, web style rules, source strings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  for id in T-1561 T-1562 T-1563 T-1564 T-1565 T-1569 T-1570 T-1571; do
    L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD)
    echo "$id ($L) edited preserved files: $(git -C "$W" diff --name-only "$L^1" "$L" -- hub/test/ask-outcomes.test.ts hub/test/approval-records.test.ts hub/test/approval-restart.test.ts hub/test/artifact-host.test.ts hub/test/artifacts.test.ts hub/test/artifact-upload.test.ts hub/test/human-routing.test.ts nvim/test/thread.test.ts web/test/messages.test.ts web/test/phone-thread.test.ts | wc -l | tr -d ' ')"
    echo "$id adapters/spoke paths: $(git -C "$W" diff --name-only "$L^1" "$L" -- hub/src/adapters hub/src/spoke | wc -l | tr -d ' ')"
    echo "$id web colour literals outside tokens.css: $(git -C "$W" diff "$L^1" "$L" -- web/src ':!web/src/tokens.css' | grep -E '^\+[^+]' | grep -cE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(')"
    echo "$id key listeners outside keymap.ts: $(git -C "$W" diff "$L^1" "$L" -- web/src ':!web/src/keymap.ts' | grep -E '^\+[^+]' | grep -cE "addEventListener\(['\"]key|onKey(Down|Up|Press)")"
  done
  ( cd "$W"
    echo "guard: $(grep -c -F 'auth and user commands require a local human shell' hub/src/hub/dispatch.ts)"
    echo "web users-mode refusal: $(grep -c -F 'web user commands require users mode' hub/src/hub/dispatch.ts)"
    echo "role refusal: $(grep -c -F 'cannot request ${String(frame.type)}' hub/src/hub/web-authority.ts)"
    echo "ask loser: $(grep -c -F 'takes no answer any more' hub/src/hub/asks.ts)"
    echo "approval loser: $(grep -c -F 'approval already answered by ${previous.by} via ${previous.via} at ${previous.at}' hub/src/hub/inbox.ts)"
    echo "invite reasons: $(grep -c -E "throw new Error\('(unknown|used|revoked|expired) invite'\)" hub/src/hub/users.ts)"
    echo "invite URL: $(grep -c -F '/invite?token=' hub/src/hub/web-edge.ts)"
    echo "read-time display name: $(grep -c -F 'userDisplayName: user.displayName' hub/src/hub/store.ts)"
    echo "--as refusal: $(grep -c -F 'user is unknown or not active' hub/src/hub/dispatch.ts)"
    echo "human user writes: $(grep -c -F "'topic.answer', 'topic.create', 'topic.send', 'approval.answer', 'artifact.create'" hub/src/hub/cli-user.ts)"
    echo "CLI --as help lines: $(node hub/bin/cland.ts --help | grep -E '^ +(topic create|topic answer|artifact new)' | tr '\n' '|')" )
}
m02() {   # sealed, in $W: build the bundle the scratch edge and Web tests serve; the typecheck's colour and contrast checks
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD) node $(node --version) nvim $(nvim --version 2>/dev/null | head -n 1)"
  ( cd "$QA_W" && npm run build --workspace web > "$QA_EV/E1536S2-02-build.log" 2>&1; echo "build exit $?"; ls web/dist/index.html
    npm run typecheck > "$QA_EV/E1536S2-02-typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
m10() {   # QA's own shell: T-1571's own test files at the build (named by its landing, not by this brief)
  L=$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1571$' HEAD); echo "PRE: T-1571 landing $L"
  F=$(git -C "$W" diff --name-only --diff-filter=AM "$L^1" "$L" -- '*.test.ts' | tr '\n' ' '); echo "test files of T-1571: $F"
  nt E1536S2-10 $F
  oks E1536S2-10
}
m11() {   # p1: init, hub start, single-mode baseline (messages, web user frames, CLI artifact)
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' '); dist $(ls "$QA_W/web/dist/index.html")"
  git init -q -b dev && git config user.name 'Jane Q. Doe' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1536S2-11-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml) user.name=$(git config user.name)"
  amode
  hubstart; echo "hub start exit $?"
  probe sock '[{"type":"topic.send","topic":"general","text":"QA single words","userId":"forged","qaSave":["m-single-sock","message.id"]}]'
  probe web a '[{"type":"topic.send","topic":"general","text":"QA single web words","userId":"forged","qaSave":["m-single-web","message.id"]},{"type":"user.list"},{"type":"user.add","name":"alex"},{"type":"topic.history","topic":"general"}]'
  artc "artifact (single)" --title "QA single note"
}
m12() {   # p1, Headless Shell: single-mode labels
  echo "PRE: $(amode); hub $(up); dist $(ls "$QA_W/web/dist/index.html")"
  idsj ids-single.json "single sock=m-single-sock" "single web=m-single-web"
  bprobe page ids-single.json "$QA_EV/E1536S2-12-single.png" 0
}
m13() {   # p1: the launched session qa-oc and the driver session qa-coord with its asks
  echo "PRE: $(amode); hub $(up); qa-oc $(srow qa-oc)"
  cland session launch qa-oc --role implementer --harness opencode > "$QA_EV/E1536S2-13-launch.txt" 2>&1; echo "launch exit $?"
  waitrun qa-oc 120
  echo "qa-oc shell identity names: $(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).mcp.servers.cland.environment;console.log(Object.keys(c).sort().join(" "))' .cland/opencode/qa-oc/opencode.json)"
  # detached (own session, so it outlives this call and survives until m25); a plain `&` job is killed when the call's shell exits
  node -e 'const{spawn}=require("node:child_process"),fs=require("node:fs");const c=spawn(process.execPath,process.argv.slice(3),{detached:true,stdio:["ignore",fs.openSync(process.argv[1],"w"),fs.openSync(process.argv[2],"w")]});c.unref();console.log(c.pid)' "$QA_EV/E1536S2-drv.txt" "$QA_EV/E1536S2-drv.err" "$QA_Q/drv.mjs" "$QA_Q/p1" qa-coord coordinator "$QA_Q/drv-steps.jsonl" stop-drv >> "$QA_Q/pids"
  n=0; while [ "$n" -lt 90 ] && ! [ -f "$QA_Q/ask5" ]; do sleep 1; n=$((n+1)); done
  for a in ask1 ask2 ask3 ask4 ask5; do echo "$a $(cat "$QA_Q/$a" 2>/dev/null || echo missing)"; done
  echo "driver ready lines $(grep -c '"ready":"qa-coord"' "$QA_EV/E1536S2-drv.txt")"
  probe sock '[{"type":"inbox.list"}]'
}
m14() {   # p1: the switch prints the first user's invite; single-mode messages read as the first user
  echo "PRE: $(amode); hub $(up); asks saved $(ls "$QA_Q" | grep -c -E '^ask[0-9]$')"
  cland auth mode users > "$QA_Q/switch.out" 2> "$QA_EV/E1536S2-14-switch.err"; echo "switch exit $?"
  head -n 1 "$QA_Q/switch.out"
  sed -n 2p "$QA_Q/switch.out" > "$QA_Q/invite-jane"; chmod 600 "$QA_Q/invite-jane"
  echo "invite line: $(ishape "$QA_Q/invite-jane"); stdout lines $(wc -l < "$QA_Q/switch.out" | tr -d ' ')"
  amode
  cland user list
  probe db
  probe sock '[{"type":"topic.history","topic":"general"}]'
}
# uinv <label> <user args…>: cland user add|invite; prints exit, the first stdout line and stderr; the URL line goes to $QA_Q/invite-<label> (mode 600), only its shape is printed
uinv() { f=$1; shift; cland user "$@" > "$QA_Q/u.out" 2> "$QA_Q/u.err"; x=$?; echo "user $1 $2 exit $x: $(head -n 1 "$QA_Q/u.out") err: $(cat "$QA_Q/u.err")"; sed -n 2p "$QA_Q/u.out" > "$QA_Q/invite-$f"; chmod 600 "$QA_Q/invite-$f"; echo "  invite-$f line: $(ishape "$QA_Q/invite-$f")"; }
m15() {   # p1: user add, user invite, the name rules, invite storage, the invite check and the token scan
  echo "PRE: $(amode); hub $(up); $(cland user list | grep -c '^jane-q-doe  Jane Q. Doe  admin  active$') first-user line"
  uinv alex-1 add alex --display "Alex Smith"
  uinv bob add bob
  uinv alex-2 invite alex
  for n in human hub all admin qa-oc Alex alex; do
    cland user add "$n" > "$QA_Q/u.out" 2> "$QA_Q/u.err"; echo "add $n exit $? stdout lines $(wc -l < "$QA_Q/u.out" | tr -d ' ') err: $(cat "$QA_Q/u.err")"
  done
  cland user list
  probe db
  probe invcheck '["jane","alex-1","alex-2","bob"]' consume
  probe scan '["jane","alex-1","alex-2","bob"]'
}
m16() {   # p1: the human-only guards refuse qa-oc's shell on each guarded frame, before any change
  echo "PRE: $(amode); hub $(up); qa-oc $(srow qa-oc)"
  probe snap > "$QA_Q/snap-before"
  for c in "user add carl" "user invite alex" "user list" "auth mode users" "auth reset"; do
    sesh qa-oc $c > "$QA_Q/g.out" 2> "$QA_Q/g.err"; x=$?
    echo "session shell: cland $c exit $x; guard text $(grep -c -F 'auth and user commands require a local human shell' "$QA_Q/g.err"); invite links $(cat "$QA_Q/g.out" "$QA_Q/g.err" | grep -c '/invite?token='); first err line: $(head -n 1 "$QA_Q/g.err" | grep -v 'token=')"
  done
  probe snap > "$QA_Q/snap-after"
  cmp -s "$QA_Q/snap-before" "$QA_Q/snap-after" && echo "users, invites and mode unchanged" || echo "snapshot changed"
  cland user list > /dev/null; echo "human user list exit $?"
}
m17() {   # p1: two users write; history, deliveries, journal; the per-request role check on the web
  echo "PRE: $(amode); hub $(up); driver ready $(grep -c '"ready":"qa-coord"' "$QA_EV/E1536S2-drv.txt")"; o=$(off); j=$(joff)
  probe web j '[{"type":"web.session"}]'
  probe plant alex j
  probe sock '[{"type":"topic.send","topic":"general","text":"QA jane words","userId":"forged","qaSave":["m-jane","message.id"]}]'
  probe wsend alex '[{"type":"web.session"},{"type":"topic.send","topic":"general","text":"QA alex words","userId":"forged","qaSave":["m-alex","message.id"]},{"type":"user.add","name":"human"},{"type":"user.list"}]'
  probe sock '[{"type":"topic.history","topic":"general"}]'
  probe wsend j '[{"type":"topic.history","topic":"general"}]'
  sleep 2; devents "$(cat "$QA_Q/m-jane")" "$(cat "$QA_Q/m-alex")"
  probe journal "$j"
  probe db | grep -E '"(messageUsers|webSessionUsers)"'
  probe rolecheck alex
  probe audit "$o"
}
m18() {   # p1: asks (first answer wins, --as), topics and artifacts by user; topic.send with as
  echo "PRE: $(amode); hub $(up); $(probe sock '[{"type":"inbox.list"}]' | grep approvals)"; o=$(off); j=$(joff)
  A1=$(cat "$QA_Q/ask1"); A2=$(cat "$QA_Q/ask2"); A3=$(cat "$QA_Q/ask3")
  probe wsend alex '[{"type":"topic.answer","ask":"@file:ask1","option":1,"userId":"forged","qaSave":["m-a1","message.id"]}]'
  run "jane answers ask1 after alex" topic answer "$A1" 1
  run "ask2 --as alex" topic answer "$A2" 1 --as alex
  run "ask3 --as nobody" topic answer "$A3" 1 --as nobody
  run "ask3 --as bob" topic answer "$A3" 1 --as bob
  run "ask3 without --as" topic answer "$A3" 1
  probe sock '[{"type":"inbox.list","archive":true},{"type":"topic.history","topic":"general"}]'
  sleep 2; devents "$A1" "$A2" "$A3"
  run "topic create --as alex" topic create "QA alex topic" --as alex --json
  run "topic create --as nobody" topic create "QA nobody topic" --as nobody
  run "topic create without --as" topic create "QA first-user topic" --json
  artc "artifact --as alex" --as alex --title "QA alex note"
  artc "artifact --as nobody" --as nobody --title "QA nobody note"
  artc "artifact --as bob" --as bob --title "QA bob note"
  artc "artifact without --as" --title "QA first-user note"
  probe wsend alex '[{"type":"artifact.create","kind":"note","title":"QA web note","content":"qa","topic":"general","creatorUserId":"forged"}]'
  probe sock '[{"type":"artifact.upload","topic":"general","files":[{"name":"qa-upload.txt","mime":"text/plain","data":"cWE="}],"creatorUserId":"forged"},{"type":"topic.send","topic":"general","text":"QA as alex words","as":{"name":"alex"},"qaSave":["m-as-alex","message.id"]},{"type":"topic.send","topic":"general","text":"QA as nobody words","as":{"name":"nobody"}},{"type":"topic.send","topic":"general","text":"QA as bob words","as":{"name":"bob"}}]'
  touch "$QA_Q/go-art"; sleep 3; dtool artifact.create
  probe journal "$j"
  probe audit "$o"
}
m19() {   # p1: approvals raised by qa-oc; the first answer wins; approval.answer with as
  echo "PRE: $(amode); hub $(up); qa-oc $(srow qa-oc)"; o=$(off); j=$(joff)
  probe sock '[{"type":"topic.send","topic":"general","to":["qa-oc"],"text":"QA needs approval one"}]'; probe approval qa-oc ap1
  probe wsend alex '[{"type":"approval.answer","approval":"@file:ap1","choice":"once","userId":"forged"}]'
  probe sock '[{"type":"approval.answer","approval":"@file:ap1","choice":"once"}]'
  probe sock '[{"type":"topic.send","topic":"general","to":["qa-oc"],"text":"QA needs approval two"}]'; probe approval qa-oc ap2
  probe sock '[{"type":"approval.answer","approval":"@file:ap2","choice":"once","as":{"name":"alex"}}]'
  probe sock '[{"type":"topic.send","topic":"general","to":["qa-oc"],"text":"QA needs approval three"}]'; probe approval qa-oc ap3
  probe sock '[{"type":"approval.answer","approval":"@file:ap3","choice":"once","as":{"name":"nobody"}},{"type":"approval.answer","approval":"@file:ap3","choice":"once","as":{"name":"bob"}},{"type":"approval.answer","approval":"@file:ap3","choice":"once"}]'
  probe sock '[{"type":"inbox.list","archive":true}]'
  probe journal "$j"
  probe audit "$o"
}
m20() {   # p1: qa-oc's shell with --as alex still acts as qa-oc (the artifact call is refused: no item or request in General)
  A4=$(cat "$QA_Q/ask4"); echo "PRE: $(amode); hub $(up); qa-oc $(srow qa-oc); ask4 $A4"; o=$(off)
  srun "shell topic answer --as alex" qa-oc topic answer "$A4" 1 --as alex
  srun "shell topic create --as alex" qa-oc topic create "QA shell topic" --as alex --json
  sesh qa-oc artifact create --kind note --content qa --topic general --title "QA shell note" --as alex --json > "$QA_Q/a.out" 2> "$QA_Q/a.err"; x=$?
  echo "shell artifact create --as alex exit $x err: $(head -n 2 "$QA_Q/a.err" | tr '\n' ' ')"; [ "$x" = 0 ] && pick '({creator:v.artifact.creator,creatorKind:v.artifact.creatorKind??null,creatorUserId:v.artifact.creatorUserId??null})' < "$QA_Q/a.out"
  probe sock '[{"type":"inbox.list"},{"type":"artifact.list","topic":"general"}]'   # artifact.list shows no "QA shell note"
  run "human answers ask4" topic answer "$A4" 1
  probe audit "$o"
}
m21() {   # p1, Headless Shell: authors on desktop and phone, signed in as jane-q-doe, with alex's live sends
  echo "PRE: $(amode); hub $(up); dist $(ls "$QA_W/web/dist/index.html")"
  idsj ids-authors.json "single sock=m-single-sock" "single web=m-single-web" "jane=m-jane" "alex=m-alex" "alex answer=m-a1" "as alex=m-as-alex"
  bprobe page ids-authors.json "$QA_EV/E1536S2-21-desktop.png" 0 alex
  bprobe page ids-authors.json "$QA_EV/E1536S2-21-phone.png" 1 alex
}
m22() {   # p1, Headless Shell: the Accounts users list and a web-created invite
  echo "PRE: $(amode); hub $(up); $(cland user list | tail -n +2 | wc -l | tr -d ' ') user rows"
  bprobe users "$QA_EV/E1536S2-22-users.png"
  cland user list
  probe db | grep '"invites"'
}
m23() {   # p1: reset revokes invites; single mode again; stand-in --as unchanged
  echo "PRE: $(amode); hub $(up)"; o=$(off); j=$(joff)
  run "reset" auth reset
  amode
  probe snap
  probe invcheck '["jane","alex-2","bob"]'
  probe wsend alex '[]'
  probe web c '[{"type":"user.list"},{"type":"user.add","name":"dave"},{"type":"topic.send","topic":"general","text":"QA single after reset","userId":"forged","qaSave":["m-after-reset","message.id"]},{"type":"topic.history","topic":"general"}]'
  run "single ask5 --as qa-standin" topic answer "$(cat "$QA_Q/ask5")" 1 --as qa-standin
  run "single topic create --as qa-standin" topic create "QA standin topic" --as qa-standin --json
  artc "single artifact --as qa-standin" --as qa-standin --title "QA standin note"
  probe sock '[{"type":"topic.send","topic":"general","to":["qa-oc"],"text":"QA needs approval four"}]'; probe approval qa-oc ap4
  probe sock '[{"type":"approval.answer","approval":"@file:ap4","choice":"once","as":{"name":"qa-standin"}}]'
  probe sock '[{"type":"inbox.list","archive":true}]'
  sleep 2; devents "$(cat "$QA_Q/ask5")"
  probe journal "$j"
  probe audit "$o"
}
m24() {   # p1, Headless Shell: single mode after the reset shows "you" for every human message
  echo "PRE: $(amode); hub $(up)"
  idsj ids-reset.json "single sock=m-single-sock" "jane=m-jane" "alex=m-alex" "alex answer=m-a1" "after reset=m-after-reset"
  bprobe page ids-reset.json "$QA_EV/E1536S2-24-single.png" 0
}
m25() {   # p1: cleanup; judge the fixture-owned census only
  touch "$QA_Q/stop-drv"; n=0; while [ "$n" -lt 30 ] && ! grep -q '"closed":"qa-coord"' "$QA_EV/E1536S2-drv.txt"; do sleep 1; n=$((n+1)); done
  echo "driver closed $(grep -c '"closed":"qa-coord"' "$QA_EV/E1536S2-drv.txt")"
  cland session stop qa-oc > "$QA_EV/E1536S2-25-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-oc 30
  cland hub stop > "$QA_EV/E1536S2-25-hubstop.txt" 2>&1; echo "hub stop exit $?"; sleep 2
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
  ps -Ao pid=,command= > "$QA_Q/ps.txt"; echo "processes naming the scratch root: $(grep -c -F "$QA_Q" "$QA_Q/ps.txt")"; grep -F "$QA_Q" "$QA_Q/ps.txt" | head -20
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e1536s2-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). p1's secret in `$Q/p1/.cland/hub.json`, the sign-in links, the cookies, the files `cookie-*`, `invite-*` and `invite-copy-*.db`, and the session credential are never printed or posted. Record the setup (worktree, `$Q`, `launcher checked`, the zero credential-name count, the `CLAND_` name list, the `sealed nvim:` line, `probe and driver checked`) as check `S0` with `qa-record.sh note`. The name list must hold no `CLAND_SESSION_*`, `CLAND_LAUNCH_TOKEN` or `CLAND_ROLE` from QA's own session. The `sealed nvim:` line names the binary under the build's pinned cache and prints `NVIM v0.12.5` (the tag of `nvim/NVIM_VERSION`); a Homebrew or other inherited `nvim`, or none, makes S0 BLOCKED. Never copy this brief, `env.sh`, `launch.mjs` or `probe.mjs` under `$EV` (rule 15: record digests and line counts only).

## Cases

none. No headless-grid case covers this stage. The Neovim display changes (T-1564 C2, T-1562 C5) are proven by the headless-Neovim test files in E1536S2-04 and E1536S2-05, and the web by Headless Shell checks (E1536S2-12, -21, -22, -24). Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. Under rule 18 the web surfaces this stage changed run in Chrome Headless Shell, not in a real browser:
- the message author labels on desktop and phone layouts (E1536S2-21, screenshots `$EV/E1536S2-21-desktop.png` and `$EV/E1536S2-21-phone.png`);
- single-mode labels (E1536S2-12 `$EV/E1536S2-12-single.png`, E1536S2-24 `$EV/E1536S2-24-single.png`);
- the Accounts users list with web invite creation (E1536S2-22 `$EV/E1536S2-22-users.png`, taken after the invite is dismissed, so no token is on it).

No computer use, no GUI.

## Manual checks

Run in this order. Rows E1536S2-03 to E1536S2-10 run their test files serially from `$W` through `nt`: cover-quiet admission before each row, the one-minute load at or below 10 and the free disk space printed before each file. Targeted files take no suite lease. They never run in parallel with each other or with the scratch rows. Rows E1536S2-11 to E1536S2-25 depend on the p1 state the rows before them leave. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1536 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. For every `nt` row "clean" means: every `exit` line reads `exit 0 <file>`, no `not ok` line and no `# SKIP` line (Neovim and the Headless Shell are present on this run, so a skip is FAIL, not a platform skip).

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1536S2-00 | hub-api | QA | `m00 > "$EV/E1536S2-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the stage line names `attribution and invites` with `qa` affected/after-stage and every member merged; each member, T-1571 included, prints exactly one landing SHA. Otherwise BLOCKED, reported to the requester, nothing else run |
| E1536S2-01 | hub-api | QA | `m01 > "$EV/E1536S2-01.txt" 2>&1` (QA's own shell, read-only) | Every `edited preserved files:` line ends `0`. Every `adapters/spoke paths:` line ends `0` (A6; T-1571's is recorded, and a nonzero count there is read before judging). Every `web colour literals outside tokens.css:` and `key listeners outside keymap.ts:` line ends `0`; a nonzero count is read and is FAIL only when the added line is a colour or key listener. `guard: 1` or more; `web users-mode refusal: 1` or more; `role refusal: 1`; `ask loser: 1`; `approval loser: 1`; `invite reasons: 4`; `invite URL: 1`; `read-time display name: 1`; `--as refusal: 1`; `human user writes: 1`. The `CLI --as help lines` read `topic create <title> [--item T-n] [--json] [--as <name>]`, `topic answer <ask id> <option number> [--as <user or stand-in name>]` and an `artifact new` line; the `artifact new` usage block carries `[--as <user>]` (the second line of its usage) |
| E1536S2-02 | hub-api | QA | `( . "$Q/env.sh"; m02 ) > "$EV/E1536S2-02.txt" 2>&1` | PRE shows Node 24 and a Neovim version line. `build exit 0`, `web/dist/index.html` listed, `typecheck exit 0` (the web typecheck holds the colour-token and 4.5:1 contrast checks; AGENTS.md), `dirty entries 0` |
| E1536S2-03 | hub-api | QA | `nt E1536S2-03 hub/test/message-users.test.ts hub/test/human-routing.test.ts` | clean. `oks` lists test: `users own stored messages, history and coordinator envelopes; legacy single messages follow the first user`; `hub/test/human-routing.test.ts` (unedited by every stage landing, E1536S2-01) passes whole |
| E1536S2-04 | hub-api | QA | `nt E1536S2-04 hub/test/message-display-name.test.ts web/test/message-users.test.ts nvim/test/message-users.test.ts nvim/test/message-users-live.test.ts nvim/test/thread.test.ts web/test/messages.test.ts web/test/phone-thread.test.ts` | clean. `oks` lists Tests: `human display names resolve at read time and disappear in single mode`, `desktop and phone distinguish users with identical display names by id`, `first user sees own messages as you and same-name users by display name, with old wire fallback`, `an open Neovim thread renders the other user from the production live message frame`; the unedited thread files pass whole; every `Web fixture census` line ends `after 0; scratch hub stopped` |
| E1536S2-05 | hub-api | QA | `nt E1536S2-05 hub/test/answer-users.test.ts hub/test/ask-outcomes.test.ts hub/test/approval-records.test.ts hub/test/approval-restart.test.ts web/test/phone-approvals.test.ts nvim/test/inbox-actions.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts` | clean. The answer-users file's cases are generated, one per mode: read their names from the log and compare with its `for (const users of [false, true])` loop; both print `ok`. The web approval card's generated cases (one per `by` of `human` and `alex`) and Neovim's generated approval cases (per view and per `by`) print `ok`; read them from the log. The unedited ask-outcome and approval files pass whole (single-mode and stand-in outcomes, T-1562 C6) |
| E1536S2-06 | hub-api | QA | `nt E1536S2-06 hub/test/artifact-user.test.ts hub/test/artifact-host.test.ts hub/test/artifacts.test.ts hub/test/artifact-upload.test.ts` | clean. `oks` lists Tests: `users-mode human creation and upload retain creator identity in index, audit and journal; agents stay sessions`, `single-mode human artifacts preserve the previous wire shape without a creator user id`; the unedited path files pass whole (T-1563 C5) |
| E1536S2-07 | hub-api | QA | `nt E1536S2-07 hub/test/web-authority-unit.test.ts hub/test/auth-mode.test.ts hub/test/web-authority.test.ts` | clean. `oks` lists Tests: `user authority reads stored roles per call and supports an omitted test-role request`, `local and cookie-authenticated human requests audit their user, including web impersonation refusal`, `the web refuses any as field on every classified request, even a malformed value` |
| E1536S2-08 | hub-api | QA | `nt E1536S2-08 hub/test/invites.test.ts hub/test/user-invites.test.ts hub/test/users.test.ts` | clean. `oks` lists Tests: `invite storage contains only digest and expiry, surviving a new Users owner`, `replacement and reset revoke every open invite`, `names reject reserved words, roles, sessions, duplicates and non-slugs with the rule`, `user creation admits web authority while invite renewal stays local and fields validate`, `user add prints an edge invite for an invited admin`, `auth switch CLI accepts the previous hub result without an invite URL`, `all auth and user commands refuse authenticated session shells before mutation`, `failed auth reload fences invite commands until successful recovery`, `held reset refuses invite commands before users or invites change`, `auth changes stay local while user listing admits web authority and all stay absent from gateway` |
| E1536S2-09 | hub-api | QA | `nt E1536S2-09 web/test/accounts.test.ts` | clean. `oks` lists Tests: `Accounts users fold lists facts and creates one invited admin with an ephemeral invite`, `mounted Accounts clears its users and invite when reconnecting from users to single mode`, `Accounts profile shows the signed-in user display name in users mode`; every `Web fixture census` line ends `after 0; scratch hub stopped` |
| E1536S2-10 | hub-api | QA | `m10 > "$EV/E1536S2-10.txt" 2>&1` (QA's own shell) | PRE names one T-1571 landing SHA. `test files of T-1571:` lists the files the landing adds or changes; at the branch head that was `hub/test/cli-as-user.test.ts` (a file the landing adds beyond it is run too). Every file is clean. Its cases are generated (template-literal titles): the CLI ask cases, one per mode, and the human write matrix, one per mode and per actor (default and `alex`); read their names from the log, compare with the source loops, and confirm every one prints `ok`. If review changed the file set, record which of T-1571 C1–C5 and the frame seams (`topic.send`, `approval.answer`) each listed test covers; a criterion no test covers is judged only by the scratch rows named in the criteria map |
| E1536S2-11 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m11 ) > "$EV/E1536S2-11.txt" 2>&1` | PRE: p1 has no entries, `fakes 3`, the bundle exists. `init exit 0`; `lock 1 executor 1 user.name=Jane Q. Doe`; `mode = "single"`; `hub start exit 0`. `sock`: welcome `nvim`; `q1 topic.send` ok, message `from` `human`, `userId` null, `userDisplayName` null. `web a`: `linkShape` true, `redeem` 302, `upgrade` 101, welcome `human` (the stage-1 lesson: a single-mode web conversation is the human session); `q1 topic.send` ok, `from` `human`, `userId` null; `q2 user.list` and `q3 user.add` refused, each `error` containing `web user commands require users mode`; `q4 topic.history` lists both QA messages with `from` `human`, `userId` and `userDisplayName` null. `artifact (single) exit 0` with `creator` `human`, `creatorKind` `human`, `creatorUserId` null |
| E1536S2-12 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1536S2-12.txt" 2>&1` | PRE: single, hub up, bundle present. `linkShape` true; `profileInScratch` true; `layoutPhone` `false`; both `label` lines (`single sock`, `single web`) show `you`; `screenshot` names `$EV/E1536S2-12-single.png`; no `step` line; `browserGroupAfter` 0. An `unavailable` line is BLOCKED with its reason |
| E1536S2-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1536S2-13.txt" 2>&1` | PRE: single, hub up, qa-oc `absent`. `launch exit 0`; `qa-oc: running <state> <pid>`; the identity names include `CLAND_LAUNCH_TOKEN CLAND_ROLE CLAND_SESSION_ID CLAND_SESSION_NAME` (names only); `ask1` to `ask5` each print an ask id, none `missing`; `driver ready lines 1`; `inbox.list` lists those ask ids. A missing ask or driver line is BLOCKED for the rows that use it (E1536S2-17 deliveries, E1536S2-18, E1536S2-20, E1536S2-23), with `$EV/E1536S2-drv.err` recorded |
| E1536S2-14 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1536S2-14.txt" 2>&1` | PRE: single, hub up, the saved asks counted. `switch exit 0`; first line `jane-q-doe  admin`; `invite line: shape ok, token length 64, digest12 <x>`; `stdout lines 2` (T-1565 C5); `mode = "users"`; `user list` prints `NAME  DISPLAY NAME  ROLE  STATE` and `jane-q-doe  Jane Q. Doe  admin  active`. `db`: `roles` `["admin"]` (T-1570 C4); `authState` `["users"]`; `inviteColumns` `["digest","user_id","expires","state"]`; `invites` holds one row, `jane-q-doe`, `digestLength` 64, `digest12` equal to the invite line's, `state` `open`, `hoursLeft` between 23.9 and 24; `messageUsers` shows both single-mode rows with `user_id` null. `topic.history`: both single-mode messages now read `from` `jane-q-doe`, `userId` U, `userDisplayName` `Jane Q. Doe` (T-1561 C4, A7). Record U from `users` |
| E1536S2-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m15 ) > "$EV/E1536S2-15.txt" 2>&1` | PRE: users, hub up, the first-user line once. `user add alex exit 0: alex  admin  invited`, `invite-alex-1 line: shape ok, token length 64`; `user add bob exit 0: bob  admin  invited`, shape ok; `user invite alex exit 0`: `alex  admin  invited`, shape ok with a `digest12` different from alex-1's. Refusals, each exit 1 with `stdout lines 0`: `human`, `hub` and `all` print `cland: reserved user name: <name>`; `admin` and `qa-oc` print `cland: user name collision with a role or current session: <name>`; `Alex` prints `cland: user name must be a lowercase slug`; `alex` prints `cland: user name must be unique: alex`. `user list` adds `alex  Alex Smith  admin  invited` and `bob  bob  admin  invited`. `db` `invites`: jane-q-doe `open`, alex's first row `revoked`, alex's second `open`, bob `open`; each `digestLength` 64 and `hoursLeft` between 23.9 and 24; record A from `users`. `invcheck`: `unknown` is `unknown invite`; `jane`, `alex-2` and `bob` read `now` `ok <name>`, `at23h` `ok <name>`, `at24h` `expired invite`, `consume` `ok`, `again` `used invite`; `alex-1` reads `revoked invite` for `now`, `consume` and `again`; every `tokenLength` 64 and each `digest12` equals its invite line's. `scan`: every label has `hits` `[]` (no token in p1's `.cland` tree, its logs, journal and `hub.db`, nor under `$EV`) |
| E1536S2-16 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m16 ) > "$EV/E1536S2-16.txt" 2>&1` | PRE: users, hub up, qa-oc running. For each of `user add carl`, `user invite alex`, `user list`, `auth mode users` and `auth reset` from qa-oc's shell: exit 1, `guard text 1`, `invite links 0`, and the first error line is the guard refusal (a credential refusal there is a setup fault: BLOCKED, not FAIL). Then `users, invites and mode unchanged` and `human user list exit 0` (T-1565 C7; the human's success on the other frames is shown by E1536S2-14, E1536S2-15 and E1536S2-23) |
| E1536S2-17 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m17 ) > "$EV/E1536S2-17.txt" 2>&1` | PRE: users, hub up, driver ready 1 (the driver is still alive: the `qa-coord` row of the session list is `live`; the shell CLI has no `who`, so session-list presence is the evidence of its identity). `web j`: `redeem` 302, `upgrade` 101, welcome `jane-q-doe`, `web.session` user U. `planted` alex with A and `state` `active`. `sock` `topic.send` ok: `from` `jane-q-doe`, `fromKind` `human`, `userId` U. `wsend alex`: welcome `alex` (despite the forged `userId`); `web.session` user A; `topic.send` ok: `from` `alex`, `fromKind` `human`, `userId` A; `user.add` `human` refused with `reserved user name: human` (T-1569 C2); `user.list` ok (a web admin passes). Both `topic.history` reads, from the socket and from jane's web conversation, show `QA jane words` as `jane-q-doe`/U/`Jane Q. Doe`, `QA alex words` as `alex`/A/`Alex Smith`, and the single-mode messages as `jane-q-doe`/U. `devents`: one event per message, `from` `jane-q-doe` and `from` `alex` respectively, `from_kind` `human` (T-1561 C2, C3). `journal`: a `human-send` for each id with `userId` U and A, `textFree` true (T-1561 C5). `messageUsers`: the two new rows carry U and A. `rolecheck alex`: `q1 hub.status` ok; `role` alex `qa-test-role`; `q3 hub.status` refused, `code` `forbidden`, `error` `User role qa-test-role cannot request hub.status`; `role` alex `admin` with `roles` `["admin"]`; `q5 hub.status` ok (T-1570 C2, C3). `audit`: every human line carries a `userId`, U for socket calls and A for alex's web calls; the refused `hub.status` line is present |
| E1536S2-18 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m18 ) > "$EV/E1536S2-18.txt" 2>&1` | PRE: users, hub up. Asks: alex's web `topic.answer` ok, message `from` `alex`, `userId` A, `answerTo` ask1. `jane answers ask1 after alex exit 1` with `cland: the ask is answered by alex: "QA ask 1?" takes no answer any more` (T-1562 C3). `ask2 --as alex exit 0` printing `answered <ask2> in General: QA yes` (T-1571 C1). `ask3 --as nobody` and `ask3 --as bob` each exit 1 with `cland: cannot act as user "nobody": user is unknown or not active` and the same for `"bob"` (T-1571 C2), and ask3 stays open for the next call; `ask3 without --as exit 0`. `inbox.list` `archive`: ask1 and ask2 outcomes `by` `alex`, `userId` A; ask3 `by` `jane-q-doe`, `userId` U (T-1571 C3). `topic.history` shows each answer message (`QA yes`) with the outcome's `from` and `userId` and `userDisplayName` `Alex Smith` or `Jane Q. Doe` (T-1562 C7). `devents`: each answer event's `from` matches its outcome's `by`. Topics: `topic create --as alex exit 0` (JSON topic); `--as nobody` exit 1 with `cland: cannot act as user "nobody": user is unknown or not active`; `without --as exit 0`. Artifacts: `--as alex exit 0` with `creator` `alex`, `creatorUserId` A; `--as nobody` and `--as bob` exit 1 with the same refusal naming the user; `without --as exit 0` with `creator` `jane-q-doe`, `creatorUserId` U. alex's web `artifact.create` ok with `creator` `alex`, `creatorUserId` A (the forged field ignored). The socket `artifact.upload` ok with `creator` `jane-q-doe`, `creatorUserId` U. `topic.send as alex` ok: `from` `alex`, `userId` A; `as nobody` and `as bob` refused, `error` `cannot act as user "nobody": user is unknown or not active` and the same for `"bob"` (frame seam). `dtool artifact.create`: `creator` `qa-coord`, `creatorKind` `agent`, `creatorUserId` null (T-1563 C2). `journal`: `ask-answered` and `inbox-departure` for ask1 and ask2 carry `userId`/`outcomeUserId` A, and for ask3 U (T-1562 C4); `event-announced` for each human artifact carries its `userId`, and the agent's none (T-1563 C3); `topic-created` for `QA alex topic` has `by` `alex` and `userId` A, and for `QA first-user topic` `by` `jane-q-doe` and `userId` U. `audit`: the `topic.create` and `artifact.create` lines of the `--as alex` calls carry `userId` A, and those without `--as` U |
| E1536S2-19 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m19 ) > "$EV/E1536S2-19.txt" 2>&1` | PRE: users, hub up, qa-oc running. Each `approval` line names a pending approval of `qa-oc` whose `choices` include `once` (if `none within 60 s` or no `once`, BLOCKED for this row with the inbox recorded). ap1: alex's web `approval.answer` ok with outcome `by` `alex`, `userId` A, `via` `web`; jane's socket answer refused with `error` starting `approval already answered by alex via web at ` (T-1562 C2, C3). ap2 `as alex`: ok, outcome `by` `alex`, `userId` A (T-1571 frame seam). ap3: `as nobody` and `as bob` refused, `error` `cannot act as user "nobody": user is unknown or not active` and the same for `"bob"`; the plain answer ok with `by` `jane-q-doe`, `userId` U. `archive` shows the same outcomes. `journal`: `inbox-departure` for ap1 and ap2 `outcomeUserId` A, ap3 U |
| E1536S2-20 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m20 ) > "$EV/E1536S2-20.txt" 2>&1` | PRE: users, hub up, qa-oc running, ask4 an id. Each qa-oc shell call prints `cland: --as "alex" ignored: this shell is session qa-oc's ($CLAND_SESSION_*), and acts as it` on stderr. `shell topic answer --as alex` exits 1 with a refusal containing `only the human may do this` (inferred for an Implementer shell; the test uses a Coordinator shell and asserts only the exit and the ignored note), and `inbox.list` still lists ask4. `shell topic create --as alex` either exits 1 with a refusal naming qa-oc's role (an Implementer opens only its own item's topic) or exits 0 with its `topic-created` `by` `human` and no `userId` (the session-shell legacy receipt); it is never recorded as alex. `shell artifact create --as alex` exits 1 with `cland: forbidden: artifact.create (artifacts require your own item topic or a delivered request in this topic; General and Agents are the Coordinator’s)` (an Implementer without an item or request cannot create in General), after the ignored `--as` note; no `QA shell note` artifact exists afterwards. Session identity is proven by that refusal and the audit record, not by a created artifact. `human answers ask4 exit 0`. `audit`: every line of qa-oc's calls, the `artifact.create` line included with `outcome` `forbidden`, names `session` `qa-oc` and `userId` null; no line in the window before the human's answer carries A (T-1571 C5) |
| E1536S2-21 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m21 ) > "$EV/E1536S2-21.txt" 2>&1` | PRE: users, hub up, bundle present. `idsj` lists every label (a `missing as alex` line means E1536S2-18's frame-seam send failed; that label is then not judged here). For both pages: `linkShape` true, `profileInScratch` true; `layoutPhone` `false` on the desktop page and `true` on the phone page. `label` shows `you` for `single sock`, `single web` and `jane`, and `Alex Smith` for `alex`, `alex answer` and `as alex`. The live `QA alex live desktop` and `QA alex live phone` sends (alex's web conversation: `upgrade` 101, `topic.send` ok) show `Alex Smith` while the page is open. Screenshots `$EV/E1536S2-21-desktop.png` and `$EV/E1536S2-21-phone.png`; no `step` line; `browserGroupAfter` 0 each (T-1564 C1) |
| E1536S2-22 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m22 ) > "$EV/E1536S2-22.txt" 2>&1` | PRE: users, hub up, the CLI's user rows counted. `rows` lists `["jane-q-doe","Jane Q. Doe","admin","active"]`, `["alex","Alex Smith","admin","active"]`, `["bob","bob","admin","invited"]` in creation order; `header` is `Users` followed by the number of rows listed. After creation: `inviteShape` `matches` true, `tokenLength` 64; `rowsAfter` adds `["carol","Carol Q","admin","invited"]`; `headerAfter` is `Users` followed by the new row total; `inviteFieldsAfterDismiss` 0; `inviteFieldsAfterReload` 0 (the link is shown once). `screenshot` `$EV/E1536S2-22-users.png` (taken after the dismiss); `browserGroupAfter` 0. `cland user list` adds `carol  Carol Q  admin  invited`; `invites` adds one `open` carol row with `digestLength` 64 (T-1569 C1, C2) |
| E1536S2-23 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m23 ) > "$EV/E1536S2-23.txt" 2>&1` | PRE: users, hub up. `reset exit 0` printing `Sign-in mode: single`; `mode = "single"`; `snap`: `authState` `["single"]`, the users rows retained unchanged, and no invite row in state `open` (T-1565 C6). `invcheck`: `jane`, `alex-2` and `bob` read `revoked invite`. `wsend alex`: `upgrade` 401. `web c`: welcome `human`; `user.list` and `user.add` refused with `web user commands require users mode` (T-1569 C3); `topic.send` ok with `from` `human`, `userId` null; `topic.history` shows every message's `userDisplayName` null. `single ask5 --as qa-standin exit 0` printing `answered <ask5> in General: QA yes`; its `archive` outcome `by` `qa-standin` with no `userId`; its `devents` line `answered_as` `stand-in`, `answered_by` `qa-standin`; its journal `ask-answered` `answered_as` `stand-in`, `answered_by` `qa-standin`, `userId` null (T-1571 C4, T-1562 C6). `single topic create --as qa-standin exit 0`; its journal `topic-created` `by` `human`, `userId` null. `single artifact --as qa-standin exit 0` with `creator` `human`, `creatorUserId` null. ap4 `as qa-standin`: ok with outcome `by` `human` and no `userId`. Every `audit` line after the `auth.reset` line has `userId` null |
| E1536S2-24 | web-terminal | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m24 ) > "$EV/E1536S2-24.txt" 2>&1` | PRE: single, hub up. `linkShape` true; `profileInScratch` true; `layoutPhone` `false`; every `label` (`single sock`, `jane`, `alex`, `alex answer`, `after reset`) shows `you` (single mode: "you" everywhere, T-1564 C3); `screenshot` `$EV/E1536S2-24-single.png`; no `step` line; `browserGroupAfter` 0 |
| E1536S2-25 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m25 ) > "$EV/E1536S2-25.txt" 2>&1` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`): `driver closed 1`; `stop exit 0` and `qa-oc: stopped, process gone`; `hub stop exit 0`. No `alive` line names a fixture process: a `cland` hub or `hub serve`, `probe.mjs`, `drv.mjs` or its spoke, a fake `opencode serve`, or a Headless Shell. An `alive` line whose command is unrelated is pid reuse, recorded, not a failure. `processes naming the scratch root: 0` (any listed process is a leftover finding). Then remove `$Q` and the worktree as Build says |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request: a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint qa/briefs/E-1536-stage-2.md` with this filled brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1536-stage-2.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `ca366370d596c27c6859a15f86edf44cfcb7a0df`, and for T-1571 at its branch head `90717aea72320079295b31fdd9d503f63b0e6979` (not landed). Re-check every string at the tested build.

- Verified in source:
  - Messages: `from: user?.name ?? HUMAN`, `userId` and the `human-send` `userId` (`hub/src/hub/core.ts` `sendFromHuman`); the read-time author and `userDisplayName` in users mode only (`hub/src/hub/store.ts` `#messageFromRow`); live human messages re-read through the Store before publication (`core.ts` `#emitMessage`); the `messages.user_id` column; the envelope's `from` and `from_kind` attributes (`hub/src/adapters/contract.ts` `envelope`).
  - Web labels: `you` unless the viewer and message user ids differ, then `userDisplayName` (`web/src/MessageBlock.tsx`); the viewer id from `web.session` (`web/src/connection.ts`); Neovim's viewer from `user.list`'s first row and the CR/LF normalisation (`nvim/lua/cland/init.lua`, `thread.lua`).
  - Asks and approvals: `the ask is ${a.state} by ${a.outcome.by}: "${a.question}" takes no answer any more` (`hub/src/hub/asks.ts`); `approval already answered by ${previous.by} via ${previous.via} at ${previous.at}` (`hub/src/hub/inbox.ts`); the `ask-answered` and `inbox-departure` user ids; the CLI line `answered <ask id> in <topic title>: <the answer>` (`hub/src/cli/inbox.ts`); stand-in attribution `answered_as: 'stand-in', answered_by` (`asks.ts`); client `topic.create` journalled `by` `human` (`hub/src/hub/dispatch.ts`, `core.ts` `createTopic`).
  - Artifacts: `creatorUserId` on create and upload; the `event-announced` artifact record's `userId` (`core.ts`).
  - Web authority: `User role ${user?.role ?? '(unknown)'} cannot request ${String(frame.type)}` with `code: 'forbidden'` (`hub/src/hub/web-authority.ts` `userAuthorityRefusal`).
  - Users and invites: `web user commands require users mode` and `auth and user commands require a local human shell` (`dispatch.ts`). The name refusals `reserved user name: <name>`, `user name collision with a role or current session: <name>`, `user name must be a lowercase slug` and `user name must be unique: <name>` (`hub/src/hub/users.ts` `add`). `unknown invite`, `used invite`, `revoked invite`, `expired invite`, the 64-hex token, its SHA-256 digest and the 24-hour expiry (`users.ts`). The invite URL: `${base}/invite?` followed by the `token` query key and the token (`hub/src/hub/web-edge.ts`). `<name>  <role>  <state>` then the URL from `user add` and `user invite`, and the switch's second line (`hub/src/cli/auth.ts`). A display name defaulting to the name (`hub/src/hub/daemon.ts`).
  - CLI and harness: the `cland: <message>` exit-1 error print (`hub/bin/cland.ts`); the `--as … ignored: this shell is session …'s ($CLAND_SESSION_*), and acts as it` note (`hub/src/cli/actor.ts`); `only the human may do this; this call is <session> [<Role>]'s, by $CLAND_SESSION_ID` (`dispatch.ts`); the OpenCode session config at `.cland/opencode/<name>/opencode.json` holding the session environment (`hub/src/adapters/opencode.ts`, `opencode/server.ts`); the fake OpenCode raising `permission.asked` for `needs approval` (`hub/test/fakes/opencode/fake-opencode.ts`).
  - The web: `web_sessions (id,cookie_hash,created_at,last_used_at,user_id)` and planting an active user with a SHA-256 cookie hash, as `hub/test/answer-users.test.ts` does. Selectors: `section[aria-label="Users"]` (`web/src/accounts/Users.tsx`) and the `Users` fold header, table, `Name`, `Display name`, `Create user`, `Invite link`, `Copy invite` and `Dismiss invite` labels; `data-message-id`, `data-object-id` and `data-phone` attributes (`MessageBlock.tsx`, `AreaObjects.tsx`, `Shell.tsx`).
  - T-1571 at its branch head: `HUMAN_USER_WRITES` (`topic.answer`, `topic.create`, `topic.send`, `approval.answer`, `artifact.create`) and the shell/session exclusion (`hub/src/hub/cli-user.ts`); `cannot act as user ${JSON.stringify(name)}: user is unknown or not active` and the role check of the first and the named user (`dispatch.ts`); `topic-created` `by` the user's name and `userId` (`core.ts` `createTopic`); `--as` on `artifact create` through `actorOf` (`hub/src/cli/artifact.ts`); the help texts `[--as <user or stand-in name>]` and `[--as <user>]` (`hub/src/cli/usage/topic.ts`, `artifact.ts`). The single-mode and session-shell results come from `hub/test/cli-as-user.test.ts`'s assertions: stand-in `topic answer` with `answered_as` `stand-in`; `topic create`, `artifact create` and `approval.answer` with `as` stay `human` with no user id; a session shell's artifact `creator` is the session, and its `topic-created` is `by` `human` with no `userId`.
  - Every literal test title named above is a literal title in its file at dev.
- Inferred, not verified by a run:
  - **T-1571**: any change review makes after the branch head above; the `only the human may do this` refusal for an Implementer shell's `topic answer` (the test uses a Coordinator shell and asserts only the exit and the ignored note).
  - **The scratch hub**: that the qa-oc launch credential in its OpenCode config is accepted for its shell's CLI calls after launch; that the fake OpenCode approval offers `once`; that `spawnSpoke` drivers survive the switch and the reset (they reconnect); that a General message without `to` is delivered to the Coordinator driver and that the driver's `meta` carries `msg_id`, `answer_to`, `answered_as` and `answered_by`; the topic title `General` in `answered … in General`; that `journal.jsonl` records reach the file within the probe's 2 s wait.
  - **The databases and the edge**: that writes to the running scratch hub's `hub.db` (plant, role change) are read by the hub on the next request; that `node:sqlite` `backup` copies the WAL database consistently; that the invite URL base is `http://127.0.0.1:<port>` (no `[web] origin` in a fresh scratch config).
  - **The browser**: that the General thread renders every QA message within the page timeout (no virtualisation hides them); that `[data-phone]`'s first match is the application root; the generated test titles (template literals).

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live sign-in, the live `hub.db` and live Neovim behaviour are not evidence for this stage; p1, the build's files and its tests are.
- **Created ids come from history** (rule 22). A sent message's id is read from `topic.history` (the probe's `saved` line), never from the `topic.send` result; `topic.history` lists the oldest first, so the last exact-text match is the newest. A `saved` line with `found` false is BLOCKED, not a product failure of the send.
- **No overlay after the seal.** The hub, the browser modes and qa-oc's shell start only through `$Q/launch.mjs`. Do not "fix" a failing row with an `env NAME=…` prefix, `TMPDIR=… node …`, or an exported session variable in a sealed subshell.
- **Scanner-safe text.** The brief's patterns spell the query key as `token[=]`; never copy this brief, `env.sh`, `launch.mjs` or `probe.mjs` under `$EV`, where their static text would trip the publication scanner.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- **The invite token is a credential.** Never print it, never put it in a screenshot, a capture or a topic. Record its length and the first 12 hex of its SHA-256 digest only. `user add`, `user invite` and `auth mode users` write their URL lines to `$Q/invite-*`, never to `$EV`. E1536S2-22's screenshot is taken after `Dismiss invite`. `scan` proves the token is absent from the evidence too; a hit under `<EV>` is a QA fault to fix before publication, not a product failure.
- **Display names are not identity.** Decide "you" and authorship by user id: the web compares `message.userId` with the viewer's `web.session` user id, and Neovim with `user.list`'s first id. Two users may share a display name (the test files prove that case on purpose). Read `userId` in history, outcomes and artifacts. A matching display name with a different `userId` is a FAIL, and a different display name with the same id is a rename, not a different user.
- **The web client's sign-in identity is `human` in single mode** (stage-1 lesson): a single-mode web conversation's welcome is `human` and its audit client is `human`, not `web`. In users mode the welcome is the cookie's user name. A `human` welcome in users mode is a FAIL; in single mode it is expected.
- Single mode after the reset still names users in `from` for messages that stored a user id (`#messageFromRow`), but carries no `userDisplayName`, and the web shows "you" for every human message. Judge E1536S2-24 by the labels, and the `from` field only by `userDisplayName` null.
- alex is planted active through `hub.db`, because stage 3's invite page is not in this build. The plant is a fixture; it is not evidence that invited users become active. The role change in `rolecheck` is a fixture too; the evidence is the hub's answer to the next request on the same conversation.
- A credential or identity refusal from qa-oc's shell (an unknown session, a bad launch credential) is a setup fault, not the guard. E1536S2-16 judges the guard text, and a different first error line is BLOCKED.
- Audit and journal windows start at the byte offsets `off` and `joff` printed before the row's actions, never at a timestamp. Audit lines are written when a call settles, in settle order; the `auth.reset` call itself may carry U.
- The driver's events include every message delivered to the Coordinator (the fake OpenCode's `pong:` replies too). `devents` filters by message id; never count all events.
- `answer-users`, the web approval card and Neovim's approval cases have template-literal titles: read their names from the log and compare with the source loops. Exit 0 from the Node test runner with a name that matches nothing is not a pass: confirm the named tests appear on ok lines.
- T-1571 had not landed at writing (read at its branch head): re-read its help, CLI flags, refusal texts and test files at the build before judging any `--as` row. A refusal of `--as` by the CLI's argument parser (`Unknown option '--as'`) on `artifact create` means the build lacks T-1571's flag: FAIL for that row, not a probe fault.
- In users mode a local `--as <name>` names a user, never a stand-in: `topic answer --as alex` records `by` `alex` with `answered_as` `human`, not a stand-in. In single mode only `topic answer` keeps the stand-in; the other writes stay `human`. Do not read a single-mode `creator` `human` after `--as qa-standin` as a failure.
- Process cleanup probes use the fixture-owned census (`$Q/pids`: hub pids, every session row's pid after `waitrun`, the probe, the driver and its spoke, each browser group; plus processes whose command line names `$Q`), registered at launch and checked through exit. A machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093).
- Edit existing keys in initialized configs (`lock_path`, `executor`); never add a second table (A-8634 R12). Second-client checks allow only defaults the new client writes itself.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays and add `scratchGitEnvironment` for Git; a hand-written shell `unset` filter keeps inherited `GIT_*` variables (E-1212 stage 1). Under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097).
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: here the Neovim and Web files must run on this macOS run.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

- Sign-in and pairing (stage 3: T-1566 the invite page with a password, T-1567 the sign-in page and sign-out, T-1568 passkeys, T-1572), so no invite is redeemed through a page and no invited user signs in. Remotes for every user (stage 4).
- T-1584 (the withdrawal of a user's message, deferred from T-1561) and T-1586.
- Real remote hosts; the T4 soak and load repetitions; the full T3/T4 suites and the stage cover pair (the Coordinator's occasion).
- The Neovim workbench on the scratch hub: no headless-grid fixture switches modes; the headless-Neovim test files stand in (E1536S2-04, E1536S2-05).
- The gateway and Telegram/Discord surfaces of attribution: artifacts from a remote are covered by `hub/test/artifact-user.test.ts` only.
- A real browser, computer use, the live hub, a live restart and any change to live sessions, holds or the tracker.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. The Headless Shell instances open only p1's scratch edge (E1536S2-12, -21, -22, -24) or their own Web fixtures (the Web test files), under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered and only the fake harnesses.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "attribution and invites"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1536 stage attribution and invites` or `qa not clear E-1536 stage attribution and invites` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
