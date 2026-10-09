# Review and QA through the roles

How a change gets reviewed and checked in slice 1 (spec 4.10 and 6 (g), ticket #41). The roles, their clauses and their permissions are in `.cland/roles.toml` (`hub/src/roles/default-roles.ts` writes the defaults); the tracker's verdict comments are in `hub/README.md`, "The tracker".

## The flow

1. The Coordinator has an item, say `T-12`, whose work is ready: a branch, commits or a diff.
2. It sends a request through the hub to the session holding the role: `send` with `to: ["reviewer"]` (or `["qa"]`, or the holder's name). When no holder is live, it launches one first with `session.launch` and the role; `roles.toml` gives the harness and the model (Reviewer: Codex with `gpt-6.1-sol`; QA: Codex with `gpt-6-astra`), and the first turn is the role's clause.
3. The holder works as its clause says:
   - Reviewer: reads the item with `task.view`, then the changes the request names, read-only, against the spec and the acceptance criteria. It edits nothing.
   - QA: reads the item, then runs shell-level checks, the `cland task` CLI, and where UI is involved a headless Neovim fed with `nvim_input` and read with `screenstring()`. It fixes nothing.

   Neither waits on an approval: what each may touch is its role's sandbox (The Codex sandbox, below).
4. The holder writes its verdict on the item with one `task.comment` (`verdict`, `result`, `run`); the hub adds `by` and writes the header.
5. The holder reports back with `send` to the Coordinator, in the request's topic.

Only Reviewer and QA (`task.comment:verdict`) and the Coordinator (`task.comment`) may write a verdict. Anyone else gets the typed error `forbidden: task.comment:verdict (<Role> may not write verdicts)`, and the refusal shows in Agents.

## The messages

The request's first line is conventional, so the UI can style it later; the rest is free text:

```
review request T-12
Branch t/T-12-closed-items-release-claims, commits a1b2c3..d4e5f6. Check the acceptance criteria of T-12 and spec 4.7; tests are in hub/test/tracker.test.ts.
```

```
qa request T-12
On branch t/T-12-closed-items-release-claims: `cland task list --state open` lists T-12, and the items panel in a headless Neovim shows it.
```

The report's first line is the verdict and the item, then the points that matter:

```
review not clear T-12
High: hub/src/tracker/tracker.ts:212 a closed item keeps its claim.
```

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

A Codex session launched by cland never stops to ask the human, and runs in a sandbox chosen for its role (the human's decision of 2026-10-09, item T-48). Both come from `[<role>.launch]` in `.cland/roles.toml` (`approval`, `sandbox`, `writable_roots`, `network`; `hub/README.md`, "`.cland/roles.toml`") and are read at each launch. With `approval = "never"` a command the sandbox refuses fails, and the session goes on and reports it: nothing shows as `waiting for approval`.

| Role | Writes | Network | Why |
| --- | --- | --- | --- |
| Implementer | its cwd (its worktree), the main worktree, the repository's `.git` and its own `.git/worktrees/<name>`, the temp dir | Unix sockets under `.cland/`, its cwd and the temp dir; loopback; nothing else | It commits on its branch, runs the suite (which starts hubs on Unix sockets and `127.0.0.1` in the temp dir) and talks to the hub with `cland`. |
| Reviewer | nothing | none | It reads the item with `task.view` and the changes with git, and edits nothing. |
| QA | its cwd and the temp dir; the git directories stay read-only | as the Implementer | It runs the checks where it stands and fixes nothing: it has no reason to commit. |

What the sandbox still refuses, whatever the role (macOS, Codex 0.160.0), and what follows from it:

- **File watching.** Seatbelt denies FSEvents, so `fs.watch` fails with `EMFILE` a moment after it starts. A hub started in the sandbox (the suite starts many) polls `.cland/tasks/` and `roles.toml` every 500 ms instead (`task-watch-error` and `roles-unwatched` in its log, each with `polling`).
- **`/bin/ps`.** It is setuid, and seatbelt refuses setuid binaries. The hub reads a process's start time from `ps` before it signals a pid, so in the sandbox it cannot stop a session or break a stale lock. Five tests need that and skip themselves when `ps` fails for the test process itself (never because of where they run: outside a sandbox they run), each printing the reason: in `daemon.test.ts`, `cland hub stop never signals a process that is not the project's hub` and `a stale hub.lock … does not stop a start`; in `claude-code-sessions.test.ts`, `a stop whose claude stop fails falls back to SIGTERM`; and two whole scenarios that end in a stop, `after a hub restart, resume re-finds the app-server` (`codex-adapter.test.ts`) and `a launched OpenCode session` (`opencode-adapter.test.ts`). A sixth, in `edges.test.ts`, needs `sandbox-exec`, which does not nest. A sandboxed `npm test` therefore ends with `fail 0` and `skipped 6`: a skip is not a pass, and a QA verdict reports the count. The whole suite runs in a Claude Code session (the Coordinator's, an Implementer's) or in the human's terminal.
- **Every host but loopback.** A direct connection gets `EPERM`, and Codex's proxy answers 403 and then stops the whole command (`Network access to "github.com" was blocked: domain is not on the allowlist for the current sandbox mode`): `npm install`, `git fetch` and `git push` fail, and so does a longer command the moment any step of it tries a host. Pushing is the Coordinator's decision anyway. The suite's one download, the pinned Neovim, is why a worktree uses the main worktree's cached copy (`nvim/README.md`): run the Neovim tests once in the main worktree before sandboxed sessions need them.
- **The app-servers' sockets** (`.cland/run/`, `$TMPDIR/cland-run/`). An app-server runs any command under any profile for whoever connects (`command/exec`), so a session that reached one would be out of its sandbox.
- **For the Reviewer**, `/usr/bin/git` prints `couldn't create cache file '/tmp/xcrun_db-…'` on stderr with each command (Xcode's shim wants a cache); the command itself works.

What `network = "local"` trusts the role with: the hub's socket takes whoever connects as the human (`hub/README.md`, the CLI's identity). `cland task` run in a launched session's shell acts as the session (`$CLAND_SESSION_ID`), but `cland topic answer`, `cland role set` or `cland hub stop` would act as the human. Codex's default sandbox closed that by accident, at the price of every check waiting on an approval; a Claude Code session was never closed off from it. The Reviewer gets no network, so not this either.

ADR 0003 records that QA runs where Unix sockets are blocked, which is why the UI can reach the hub over stdio. That still holds for a rescue run (The fallback, below) and for any role whose `network` is `none`; a QA session launched with these defaults is no longer such a place.

A project whose root is itself a linked git worktree has no `.git` directory there, so `writable_roots = ["."]` opens no git directory and its sessions cannot commit.

A session in a worktree runs `cland` from the project root (`cd <root> && cland inbox`): the CLI takes the nearest `.git` or `.cland/` for the project, and a worktree has both.

### How it was measured

Against the installed app-server (Codex 0.160.0, macOS), first with `command/exec` under each profile, then in a session the hub launched:

- The legacy `sandbox` of `thread/start` (`workspace-write` with `sandbox_workspace_write.writable_roots` and `network_access`) knows only the whole network or none: Unix sockets and loopback come with the internet or not at all.
- A named permissions profile (`[permissions.<id>]`, selected by `permissions` in `thread/start`) has `network.unix_sockets` (a path to `allow` or `deny`, applied to everything under it) and `network.allow_local_binding`. `network.enabled = true` alone opens every host; with `features.network_proxy = true` everything but the allowed sockets and loopback is closed.
- A profile defined in `thread/start`'s `config` is accepted, the response even names it as active, and then every turn fails with `failed to load workspace requirements`. Defined by `-c` overrides on the app-server's command line it works, and `default_permissions` must be set beside it. Those overrides are on the app-server only, where the adapter already passes the spoke's: the risk spec 9 names is a `-c` on the TUI process (it puts the TUI in embedded mode), and `attach` still gives the TUI none.
- A writable root does not make the git directories under it writable: Codex keeps `<root>/.git` read-only, and the cwd's own git directory (a worktree's `.git/worktrees/<name>`) separately. `git commit` in a worktree passes once both are named `write`.
- The built-in `:workspace` profile, which a launch got before, refused all of it: `connect EPERM …/.cland/hub.sock`, no bind on a socket or on `127.0.0.1`, `index.lock: Operation not permitted` on a commit in a worktree.

## The fallback

When the role session is unavailable (none can be launched, it died, or it does not answer), the Coordinator runs the same brief through `/codex:rescue`:

- review: `/codex:rescue --wait --fresh --model gpt-6.1-sol <brief>`, read-only;
- QA: `/codex:rescue --wait --fresh --model gpt-6-astra <brief>`; long runs go `--background`, then `/codex:status` and `/codex:result`.

Outside Claude Code the same run is `node <codex plugin>/scripts/codex-companion.mjs task --model gpt-6.1-sol "<brief>"`. The Coordinator then records the verdict itself, in the same shape: `task.comment` with `verdict`, `result` and `run` set to the rescue job id, and the text saying it came through `/codex:rescue`. A rescue run is not launched by the hub: it runs in Codex's own default sandbox and declines every approval, so QA through it keeps to what needs neither: shell checks and the one-process headless Neovim (no `--listen`, no `cland`, no test that starts a hub; that sandbox refuses sockets).
