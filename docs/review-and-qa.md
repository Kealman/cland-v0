# Review and QA through the roles

How an item’s lead runs review and QA until the hub marks it ready (v0.1 §3.7–3.9). The roles, their clauses and their permissions are in `.cland/roles.toml` (`hub/src/roles/default-roles.ts` writes the defaults); the tracker's verdict comments are in `hub/README.md`, "The tracker".

## The flow

1. The Coordinator launches an Implementer for an item and, when QA is needed, writes and commits `qa/briefs/T-<n>.md` with the `qa` skill and gives its path to the Implementer. It launches Reviewer and QA holders when needed.
2. The Implementer’s claim makes it the item lead. It commits and pushes to `origin`, sets `task.edit` status `review`, and sends `review request T-<n>` to `reviewer` with the branch/head, criteria and scope. When a QA brief was supplied it also sends `qa request T-<n>` to `qa`, naming that committed brief and build. Without a brief it requests review only; if QA is required, it reports blocked to the Coordinator.
3. Reviewer and QA accept requests from the live claimant in `task.view` or the Coordinator, and take a `task.hold` beside the claim. Reviewer reads the changes against the spec and criteria, read-only. QA follows the brief and records each case in `.cland/qa/runs.jsonl`, fixing nothing.
4. Each verifier writes one `task.comment` verdict with `result`, `run` and the checked `commit`, then reports to `lead T-<n>` in the request’s topic. The address resolves to the live claimant, or the Coordinator when unclaimed; for closed or unknown items use `coordinator` directly.
5. The lead fixes not-clear findings, verifies and pushes a new head, and requests the affected review or QA again itself. It reports blocked when it needs a verifier, a brief or a decision. Clear verdicts need no Coordinator relay.
6. The hub checks that the gate’s required verdicts are clear and current and marks the item `ready`. That status event reaches the Coordinator once and starts its turn, standing for the lead’s ready report. The Coordinator uses the `merge` skill to land it; the lead keeps its claim until merge.

Use `send` kind `progress` for routine status notes: they wait for the recipient’s next turn. Requests and verdicts use `report` (the default), blockers use `question` or `report`, and decisions use `decision`; these start turns. Coordinator reports to the human appear in Watch, while answers needing attention use `question` or `decision` in Now.

Default subscriptions give the lead its item’s status/verdict and verifier death or long idle, digested at its next turn. The Coordinator covers the tree outside active leads and receives a lead’s death or long idle; `ready` is the immediate merge-action exception. Use `subscribe` for additional subjects and `subscriptions` to inspect them instead of polling. An explicit Coordinator subscription to a claimed item widens its traffic, so avoid one when measuring the one-delivery loop.

Only Reviewer and QA (`task.comment:verdict`) and the Coordinator (`task.comment`) may write a verdict. Anyone else gets the typed error `forbidden: task.comment:verdict (<Role> may not write verdicts)`, and the refusal shows in Agents.

## Criteria in a verdict

Reviewer and QA read the stable criterion ids from `task.view`. A clear verdict can verify selected ids or every criterion with its run:

```sh
cland task comment T-12 "Checked the criteria" --verdict review --result clear --run rev-12 --verified C1,C3
cland task comment T-12 "All checked" --verdict review --result clear --run rev-13 --verified all
cland task comment T-12 "Reconnect failed" --verdict qa --result "not clear" --run qa-12 --failed "C2=Reconnect drops the clause"
```

Repeat `--failed "C<n>=note"` for multiple failures. The MCP `task.comment` tool takes `verified: "C1,C3"` or `"all"`, or `failed: [{ criterion: "C2", note: "Reconnect drops the clause" }]`. Wire requests carry those fields inside the `verdict` object. Verification requires a clear verdict; failures require a not-clear verdict and a nonempty, single-line note. Reviewer and QA need `task.criterion:verify` beside their verdict grant; the Coordinator and human may record verdicts but cannot mark verified or failed criteria.

A verdict and its marks publish in one tracker write. An unknown id names that id and refuses the whole verdict. Malformed criteria and revoked grants also refuse the write. A concurrent save before publication refuses without recording the verdict; a late in-place save through an old editor handle retains the captured `.conflict` source named in the error for recovery before retry, following `task.criterion`'s existing policy. Such a refused late write creates no hub verdict evidence or thread report, even if the tentative item text is already at the live path. Verification keeps done marks; failure replaces done and verification with its note, unchecks the checkbox and reopens the task in progress, just like `task.criterion fail`. Legacy criteria receive ids on first touch.

The hub posts a report in the item's bound topic, or Agents when it has none. It lists the marked ids in text and carries structured `criteria: [{ id, mark: "verified" | "failed", note? }]` for the thread. Use `all` only after checking every criterion; unchecked criteria remain unverified. Separate verification and failure marks still use `task.criterion` with the id and run or note.

`cland merge` and automatic `ready` require every criterion to have both done and verified marks, alongside the existing current clear review and any required QA verdict. A checkbox alone does not count. The `criteria-incomplete` refusal names every incomplete criterion and its missing marks. Adding an unmarked criterion or failing one returns a ready task to in progress. An item with no criteria passes the criteria check. A separate Reviewer/QA verification mark also satisfies it.

The human's `cland merge T-12 --override "reason"` bypasses verdicts and criteria together; sessions cannot override. When it skips incomplete criteria, the merge gate records `merge-criteria-overridden` in the journal with the item, override reason, and each criterion's id, text and missing marks. This audit records the bypass during merge validation; Git conflicts and touched local edits still refuse.

For an item already in flight with legacy checkboxes, the claiming Implementer marks the first criterion done with `cland task criterion T-12 done C1`; this assigns stable ids in list order. Read `task view` again for the ids and mark the remaining criteria done. The Coordinator, human or Aide can also mark done. Then Reviewer or QA checks the criteria and records a clear verdict with `--verified all` or the checked ids. An existing clear verdict without these marks leaves the gate closed. The refusal describes this path, so the item can finish on its existing branch.

## Epic closure by QA (D16)

The epic planning role belongs to `tracker.levels[1]`, including renamed hierarchies. QA runs that container's Definition-of-done demo on `dev` from the Coordinator's committed brief. Container criteria include the checkboxes under `## Definition of done` and `## Acceptance criteria`; `task.view` exposes their stable ids. Record the verdict on the epic with `commit` equal to the full `dev` SHA and `verified` listing the tested ids (`all` only when every criterion passed). Without an explicit commit, an epic verdict records the local `dev` tip.

`cland task close T-<epic>`, `task.edit` resulting in closure (including kind conversion with `status: done`), and re-import closure of an existing epic require no open children, the latest hub-written QA verdict to be clear and written by a QA session on the exact current `dev` commit, and every criterion to have a QA verification mark from that verdict's run. Review verdicts, older-run marks and task patch equivalence do not satisfy epic closure. Epics need no Implementer done mark or review verdict. Refusals name missing QA evidence or incomplete criterion ids. A failed criterion or not-clear verdict reopens a container without giving it a task status.

The human shell's `cland task close T-<epic> --override "reason"` skips QA evidence and criteria, with `epic-close-overridden` recording the reason and unmet criteria in the journal. Sessions cannot override, and open children still refuse. Releases retain their own path through `cland release --item`; the human accepts the release once. This replaces the interim text-only criterion and deferred-check rules in `qa/briefs/T-107.md` steps 6a and 6b: deferred or blocked epic criteria remain unverified and prevent closure.

## The messages

The request's first line is conventional, so the UI can style it later; the rest is free text:

```
review request T-12
Branch t/T-12-closed-items-release-claims, commits a1b2c3..d4e5f6. Check the acceptance criteria of T-12 and spec 4.7; tests are in hub/test/tracker.test.ts.
```

```
qa request T-12
Brief qa/briefs/T-12.md, branch t/T-12-closed-items-release-claims, head d4e5f6. Run the committed brief at that build.
```

The report's first line is the verdict and the item, then the points that matter:

```
review not clear T-12
High: hub/src/tracker/tracker.ts:212 a closed item keeps its claim.
```

## Turning on the QA workflow in an existing project

`cland update` brings the `qa` skill (`.agents/skills/qa/`) and the managed `.cland/.gitignore` line `qa/`, and never rewrites `.cland/roles.toml`: a project's roles are its own, and the new defaults reach it only through these edits. A project initialised after T-62 has all of it.

1. Run `cland update`, then `git status`: `.agents/skills/qa/` and `.cland/.gitignore` changed. `.cland/qa/` is ignored from now on.
2. In `.cland/roles.toml`, add `"qa"` to the existing `skills` list of the Coordinator and of the QA role, keeping what is there (QA's default list is then `["qa", "diagnosing-bugs"]`).
3. In the QA clause, replace the bullets for the request, the work, the verdict and the fallback with the current ones (`hub/src/roles/default-roles.ts`, `[qa]`): the request names the brief `qa/briefs/T-<n>.md` and the `qa` skill is the whole job; the work is each case through `sh .agents/skills/qa/qa-record.sh`; the verdict gives `commit` and is `clear` only when every case in scope passed; the fallback is `/codex:rescue --background --fresh --model gpt-6-astra`.
4. In the Coordinator clause, use the current item-lead loop from `hub/src/roles/default-roles.ts`: the Coordinator writes the brief before launch, the lead requests its own review and QA, and the Coordinator merges on the hub’s immediate `ready` event. Keep the fallback bullet with the QA rescue form `"Run the QA brief in qa/briefs/T-<n>.md exactly"`, the append of the returned lines to `.cland/qa/runs.jsonl`, the note that the merge gate does not count a verdict the Coordinator records, and filing each finding as an item labelled `qa-found` and `needs-triage`.
5. Optional, for a restricted QA sandbox: under `[qa.launch]` with `sandbox = "workspace-write"` and no `writable_roots`, QA's are `[".cland/qa"]` already. A written `writable_roots` replaces them, so keep `".cland/qa"` in it.
6. The hub re-reads `roles.toml` when it changes: the next QA launch and the next assignment use it. Reconnect or reassign a running session to deliver the refreshed clause; relaunch when changing launch policy.
7. Adopt the current Implementer and Reviewer clauses too: the Implementer requests review/QA itself and reports blocked, and Reviewer/QA accept requests from the item lead. Keep project-specific launch settings and permissions. `cland update` does not apply these clause edits for you.

## The brief

A QA request names a brief: `qa/briefs/T-<n>.md`, committed with the work and self-contained, because a rescue run cannot ask. The Coordinator writes it with the `qa` skill (`.agents/skills/qa/`; `BRIEF.md` there is the template). A brief has:

- the item, and the build: its branch and a rule that resolves without the request (the tip of that branch in the item's worktree when the run starts; the run records the commit it ran; a dirty worktree, or a request naming a commit other than the tip, is `BLOCKED`);
- the cases: ids of `qa/cases/<ID>.lua`, run with `cland --headless --qa` (spec 4.10, `nvim/README.md`, "QA cases"), each with its surface: `headless-grid` (the default, needs no grant), `tmux` (grant 2), `web-terminal` (grant 1) or `hub-api`;
- the manual checks: a command and its expected outcome each;
- what is out of scope, and the grants the run needs (none by default).

Each case file opens with its catalogue header, a comment block with `id`, `title`, `preconditions`, `expected`, `since` and `regression`, so the case catalogue is `qa/cases/`. The brief ends with the procedure (run in order, fix nothing, `clear` only when every case in scope passed), because the run reads only the brief.

## The runs

A run is the pass over a brief, with an id of the QA session's own (`qa-<date>-<n>`). `sh .agents/skills/qa/qa-record.sh` (`cland init` copies skills without the executable bit), run from the item's worktree, runs a case (or records a manual check or another surface) and appends **one JSON line per case** to `.cland/qa/runs.jsonl` of the project, not the worktree's copy:

```json
{"ts":"2026-10-09T15:20:03Z","item":"T-62","run":"qa-2026-10-09-1","case":"SHELL-001","build":"29fe14f","surface":"headless-grid","method":"cland --headless --qa qa/cases/SHELL-001.lua","result":"PASS","exit_code":0,"evidence":[".cland/qa/T-62/qa-2026-10-09-1/SHELL-001.screen.txt",".cland/qa/T-62/qa-2026-10-09-1/SHELL-001.state.json"],"session":"qa-1"}
```

- `ts` UTC; `item` and `run` as above; `case` the case id (`M1`, `M2`… for the brief's manual checks); `build` the short commit of the worktree that was run; `surface` is `headless-grid`, `tmux`, `web-terminal` or `hub-api`; `method` is the command run; `result` is `PASS`, `FAIL`, `INCONCLUSIVE` or `BLOCKED`; `exit_code` is 0 for PASS, 1 for FAIL, 2 for INCONCLUSIVE and BLOCKED; `evidence` are paths relative to the project root; `session` is the QA session (`$CLAND_SESSION_NAME`), or `rescue` for a rescue run.
- `item` is exactly `T-<digits>`; `run` and `case` are single path components (letters, digits, `.`, `_`, `-`, not starting with `.` or `-`), because they name the evidence tree; the script refuses anything else (exit 64) and a line it cannot serialize (exit 70), appending nothing.
- Evidence (the grid and state dumps, captures) goes in `.cland/qa/T-<n>/<run>/`. Both live under `.cland/qa/`, which the managed `.cland/.gitignore` ignores (decision D14): runs are the machine's record, the verdict on the item is the project's. The QA role's `workspace-write` default for `writable_roots` is `.cland/qa`, the only place outside its worktree a restricted QA session writes.
- A rescue run reaches neither the hub nor, usually, `.cland/qa`: its captures go to the temp dir (or, failing that, inline on stderr) and it prints each line. The Coordinator runs `sh .agents/skills/qa/qa-record.sh recover T-<n> <run> <captures-dir> <lines-file>`, which copies and verifies the captures into `.cland/qa/T-<n>/<run>/`, rewrites the evidence paths and appends only the lines whose captures were all copied (exit 73 names each line it could not; the `qa` skill, "Recovering a rescue run").

The verdict that follows is one `task.comment` with `verdict qa`, `result`, `run` and `commit` (the full SHA that was run; the hub otherwise takes the branch tip). It is `clear` only when **every** case in scope passed. A FAIL, BLOCKED or INCONCLUSIVE case makes it `not clear`, and the text names the case. The text opens with the case table (case, surface, result, evidence). Each finding becomes an item labelled `qa-found` and `needs-triage`, which the Coordinator files.

## The verdict

A comment on the item whose first lines are the header, then the findings ranked by severity (high, medium, low), each with file:line, or for QA the command and what it showed:

```
### rev-1 · 2026-10-08T12:38:26.729Z

verdict: review
result: not clear
by: rev-1 [reviewer]
run: rev-2026-10-08-1

- high: hub/src/tracker/tracker.ts:212 a closed item keeps its claim.
- low: hub/README.md:440 the example lacks `--run`.
```

`verdict` is `review` or `qa`, `result` is `clear` or `not clear`, `by` is the session with its role (the hub writes it), `run` is the writer's id for that pass. A later verdict of the same kind supersedes the earlier one.

## Where the verdict shows

- `cland task view T-12` (and `task.view`) lists each comment, verdicts as `[verdict review: not clear, by rev-1 [reviewer], run rev-2026-10-08-1]`, and returns `verdicts` in `--json`.
- `cland task list --verdict review=clear` (or `qa="not clear"`, and `task.list` with `verdict`) lists the items whose latest verdict of that kind matches.
- The item view in the Neovim UI (ticket #36) shows the verdicts in its own section, and the board shows the latest verdict of each kind on the card ("review clear", "qa not clear", red for not clear). Until #36 lands, the CLI is the display.

## The Codex sandbox

The human's second decision of 2026-10-09 (T-65, superseding T-48's defaults) is that every session of every harness must be able to do any work its role needs. Codex Implementer and QA launches therefore default to `approval = "never"` and `sandbox = "danger-full-access"`, the equivalent of Claude Code's auto mode. Harness choice no longer depends on whether Codex's restricted sandbox can run a check. Reviewer stays read-only with no network.

These values come from `[<role>.launch]` in `.cland/roles.toml` (`approval`, `sandbox`, `writable_roots`, `network`; `hub/README.md`, ".cland/roles.toml") and are read at each launch and relaunch. Existing sessions keep their policy until relaunched. With `approval = "never"` a command a chosen sandbox refuses fails; nothing waits for the human to approve it.

| Role | Sandbox default | Network | Why |
| --- | --- | --- | --- |
| Implementer | `danger-full-access` | full | It can commit, install dependencies, run watchers, inspect processes and launch real harnesses as its work needs. |
| Reviewer | `read-only` | none | It reads the item with `task.view` and the changes with git, and edits nothing. |
| QA | `danger-full-access` | full | It can exercise the same product and checks on any harness, including real child harnesses. Its clause still says to fix nothing. |

Full access changes the command sandbox, not the role: the hub still checks tool and CLI calls against the session's role, and pushing remains the Coordinator's explicit decision. Real-session verification of the new defaults is recorded on T-65 after merge, hub restart and relaunch.

### Optional T-48 profile

Projects that choose a restricted sandbox can still set `approval = "never"`, `sandbox = "workspace-write"` and `network = "local"` explicitly; add `writable_roots = ["."]` for an Implementer that needs the main worktree and its git directories. Without `writable_roots`, a restricted QA session gets `.cland/qa` (its runs and evidence); an Implementer gets none, so it writes only in its cwd and the temp dir, and git directories stay read-only. Omitted keys inherit the current role defaults, so specifying just `workspace-write` leaves the network full for Implementer and QA.

The following limitations were measured under that restricted profile (macOS, Codex 0.160.0); they do not describe the new full-access defaults:

- **File watching.** Seatbelt denies FSEvents, so `fs.watch` fails with `EMFILE` a moment after it starts. A hub started in the sandbox (the suite starts many) polls `.cland/tasks/` and `roles.toml` every 500 ms instead (`task-watch-error` and `roles-unwatched` in its log, each with `polling`).
- **`/bin/ps`.** It is setuid, and seatbelt refuses setuid binaries. The hub reads a process's start time from `ps` before it signals a pid, so in the sandbox it cannot stop a session or break a stale lock. Six tests need that and skip themselves when `ps` fails for the test process itself (never because of where they run: outside a sandbox they run), each printing the reason: in `daemon.test.ts`, `cland hub stop never signals a process that is not the project's hub` and `a stale hub.lock … does not stop a start`; in `claude-code-sessions.test.ts`, `a stop whose claude stop fails falls back to SIGTERM`; and two whole scenarios that end in a stop, `after a hub restart, resume re-finds the app-server` (`codex-adapter.test.ts`) and `a launched OpenCode session` (`opencode-adapter.test.ts`); plus the Coordinator shell stop/resume scenario (`cli-identity.test.ts`, added in T-49). A seventh, in `edges.test.ts`, needs `sandbox-exec`, which does not nest. A passing restricted-profile hub suite therefore reports `skipped 7`: a skip is not a pass, and a QA verdict reports the count. The full suite needs a session with full access or the human's terminal.
- **Every host but loopback.** A direct connection gets `EPERM`, and Codex's proxy answers 403 and then stops the whole command (`Network access to "github.com" was blocked: domain is not on the allowlist for the current sandbox mode`): `npm install`, `git fetch` and `git push` fail, and so does a longer command the moment any step of it tries a host. Pushing is the Coordinator's decision anyway. The suite's one download, the pinned Neovim, is why a worktree uses the main worktree's cached copy (`nvim/README.md`): run the Neovim tests once in the main worktree before sandboxed sessions need them.
- **The app-servers' sockets** (`.cland/run/`, `$TMPDIR/cland-run/`). An app-server runs any command under any profile for whoever connects (`command/exec`), so a session that reached one would be out of its sandbox.
- **For the Reviewer**, `/usr/bin/git` prints `couldn't create cache file '/tmp/xcrun_db-…'` on stderr with each command (Xcode's shim wants a cache); the command itself works.

What `network = "local"` gives the role: the hub's socket, and so the `cland` CLI. A launched session's shell carries `$CLAND_SESSION_ID`, and the hub takes every CLI call from it as that session's: `cland task` within its role's permissions, reading (`cland inbox`, `cland role list`) allowed, and the human's commands (`cland topic answer`, `cland role set`) refused; stopping a session or the hub is the Coordinator's alone (T-49; `hub/README.md`, "The CLI in a session's shell"). The identity is the shell's environment: a session that unset the variables would be taken for the human, as any process holding the socket is. The Reviewer gets no network, so not the socket either.

ADR 0003 records that QA runs where Unix sockets are blocked, which is why the UI can reach the hub over stdio. That still holds for a rescue run (The fallback, below) and for any role whose `network` is `none`; a QA session launched with these defaults is no longer such a place.

Under the restricted profile, a project whose root is itself a linked git worktree has no `.git` directory there, so `writable_roots = ["."]` opens no git directory and its sessions cannot commit.

A session in a worktree runs `cland` where it stands: the CLI finds the project's hub from a linked worktree (T-44), and the hub's socket is among the allowed ones.

### How the T-48 profile was measured

Against the installed app-server (Codex 0.160.0, macOS), first with `command/exec` under each profile, then in a session the hub launched:

- The legacy `sandbox` of `thread/start` (`workspace-write` with `sandbox_workspace_write.writable_roots` and `network_access`) knows only the whole network or none: Unix sockets and loopback come with the internet or not at all.
- A named permissions profile (`[permissions.<id>]`, selected by `permissions` in `thread/start`) has `network.unix_sockets` (a path to `allow` or `deny`, applied to everything under it) and `network.allow_local_binding`. `network.enabled = true` alone opens every host; with `features.network_proxy = true` everything but the allowed sockets and loopback is closed.
- A profile defined in `thread/start`'s `config` is accepted, the response even names it as active, and then every turn fails with `failed to load workspace requirements`. Defined by `-c` overrides on the app-server's command line it works, and `default_permissions` must be set beside it. Those overrides are on the app-server only, where the adapter already passes the spoke's: the risk spec 9 names is a `-c` on the TUI process (it puts the TUI in embedded mode), and `attach` still gives the TUI none.
- A writable root does not make the git directories under it writable: Codex keeps `<root>/.git` read-only, and the cwd's own git directory (a worktree's `.git/worktrees/<name>`) separately. `git commit` in a worktree passes once both are named `write`.
- The built-in `:workspace` profile, which a launch got before, refused all of it: `connect EPERM …/.cland/hub.sock`, no bind on a socket or on `127.0.0.1`, `index.lock: Operation not permitted` on a commit in a worktree.

## The fallback

When the role session is unavailable (none can be launched, it died, or it does not answer), the Coordinator runs the same brief through `/codex:rescue`:

- review: `/codex:rescue --wait --fresh --model gpt-6.1-sol <brief>`, read-only;
- QA: `/codex:rescue --background --fresh --model gpt-6-astra "Run the QA brief in qa/briefs/T-<n>.md exactly"`, then `/codex:status` and `/codex:result` (`--wait` for a short brief).

Outside Claude Code the same run is `node <codex plugin>/scripts/codex-companion.mjs task --model gpt-6.1-sol "<brief>"`. The Coordinator then records the verdict itself, in the same shape: `task.comment` with `verdict`, `result` and `run` set to the rescue job id, and the text saying it came through `/codex:rescue`. For QA the run's output holds the case lines and the verdict (the `qa` skill, "If you are a rescue run"); the Coordinator appends the lines to `.cland/qa/runs.jsonl`. The item view shows the verdict as the Coordinator's, and the merge gate does not count it (decision D5): only a verdict the hub recorded for a session holding the QA role does. A rescue run is not launched by the hub: it runs in Codex's own default sandbox and declines every approval, so QA through it keeps to what needs neither: shell checks and the one-process headless Neovim (no `--listen`, no `cland`, no test that starts a hub; that sandbox refuses sockets).
