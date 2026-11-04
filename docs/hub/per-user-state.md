## Per-user state

These files belong to the user and are shared by every project hub on the host,
including scratch QA and Implementer hubs. They stay outside the project's
committed `.cland/` state.

The hub resolves retained user state through `hub/src/state-paths.ts`:
`CLAND_EXECUTOR_STATE`, otherwise `XDG_STATE_HOME/cland`, otherwise
`HOME/.local/state/cland`. The ledger, lock, migration record and retirement
receipt share that directory. Legacy spend reconciliation keeps its existing
HOME path. The source inventory in `hub/test/state-paths-inventory.ts` names
exact exceptions and reasons for machine locks, candidate trees, short Unix
sockets and harness configuration. New paths must stay project-local or register
there; `state-paths-lint.test.ts` rejects unregistered home/temp paths and
unguarded macOS commands. Machine runtime paths need no persistent volume;
harness configuration stays in its selected HOME or configuration directory.
The host agent owns the Node-only resolver in `host/agent/state-paths.ts`; the
hub's `state-paths.ts` re-exports that same function. It resolves Claude's
existing account root with `hostClaudeConfigDirectory(commandEnv, agentEnv)`:
command `CLAUDE_CONFIG_DIR`,
otherwise command `HOME/.claude`, otherwise agent `HOME/.claude`. These are host
environments; the hub user's HOME is never consulted. The inventory names the
host agent as owner of this configuration and its generation-owned job records.
Launch still requires a real agent-owned account directory with mode 0700.
Per-host short socket fallbacks register each flagged node and immediate parent
expression in the same item, with a reason naming the OS path bound; see the
[registration procedure](../agents/tests/hub-test-state-inventory.test.ts.md).

| File | Owner and contents |
| --- | --- |
| `~/.config/cland/accounts.toml` | The human maintains the harness account names, harnesses and directories or database paths; no secrets. An absolute `XDG_CONFIG_HOME` changes the base directory. `cland init` creates no registry. See [Accounts and limits](accounts-and-limits.md#accounts-and-limits). |
| `~/.local/state/cland/spend.json` | The hub maintains the primary executor spend ledger across projects: project, lease, run, size, cost reservations, settled cost and times; no token. `$XDG_STATE_HOME` changes the state base; `$CLAND_EXECUTOR_STATE` overrides the ledger directory for tests and disables legacy migration and write-through. See [leases, cleanup and spend](running.md#leases-cleanup-and-spend). |
| `~/.cland/executor/spend.json` | Until explicit retirement, the hub reconciles this legacy ledger with the primary ledger and writes mutations through to it first so older project hubs still respect the shared cap. Retirement leaves these bytes in place and records a snapshot beside the new ledger; see [retiring legacy spend write-through](running.md#retiring-legacy-spend-write-through). |
| `~/.local/state/cland-nvim/` | The workbench Neovim's own state, including `nvim.log` and restart snapshots. `$XDG_STATE_HOME` changes the state base. T-830 sets `NVIM_APPNAME=cland-nvim` to keep this separate from the hub's `cland/` state and clears an inherited `NVIM_LOG_FILE`. See [the Neovim launcher](../../nvim/README.md). |


<!-- Implementation guidance moved from the implement skill. -->

For per-user hub state, import `userStateDirectory(env)` from
`hub/src/state-paths.ts`; keep the executor override, XDG and HOME precedence.
Register new machine runtime paths with exact expressions and reasons in
`hub/test/state-paths-inventory.ts`. Use the sealed `projectHub` `userState`
fixture option for default HOME/XDG state tests. File guidance:
`docs/agents/tests/hub-test-state-inventory.test.ts.md`.

| Host-local retained file | Owner and contents |
| --- | --- |
| `<host run directory>/ref-watches.json` | Agent ref-watch owner; atomic 0600 checkpoint of task worktree paths, branches and attempted heads, confirmed remote tips, native launch/birth bindings, result/decision checkpoints and ref/reflog metadata signatures. Restored on agent restart; removed entries after unwatch. No credentials or reflog history. Sibling `.new` is joined atomic-write staging. |
| `<host run directory>/ref-git-proxy` | Agent-owned atomic 0700 executable invoking the standalone Unix proxy at this run directory's git.sock; publication overrides clone executables with this path. |
| `<host run directory>/ref-push/<launch ID>.log` | Producer-private diagnostic file, mode 0600; storage remains until positive native closure and durable result checkpoint. The bounded redacted command tail is in the JSON result receipt; existing launches/processes records retain native ownership. |
| `<host run directory>/ref-push/<launch ID>.json` | Bounded Git producer result, atomic0600; exact launch/native identity, pushed SHA, exit and redacted diagnostic tail after command/pipes close. Missing receipt keeps native uncertainty fenced. No environment or credential URL. |

Host attach records are private host runtime state, resolved by
`host/attach.ts:attachRecordPath(runDirectory, name)` under the admitted agent
run folder, never the hub HOME. `attach/<sha256(name)>.json` is mode 0600 with a
0700 parent. The launch transaction owns publication and rollback; a relaunch
replaces it. Retained stopped-session records are inert because attach rechecks
the native birth. See [terminal attach](ssh-host.md#terminal-attach).

| Project-local runtime path | Owner and lifetime |
| --- | --- |
| `.cland/run/host-verify/<UUID>` | Verification scheduler's detached territory source at the admitted SHA/branch. One source per pending run; retained while queued/running/unreported, including across hub restart. Removed after executor writers settle and evidence reports; startup sweeps sources with no surviving pending run. This is a hub-local source, never a host session directory. |

Host verification sources also retain private sibling `<UUID>.json` receipts
with captured root/parent/directory identities and completed-preparation state.
The scheduler checkpoints the admitted receipt on its job and revalidates it
before execution/removal. Replacement directories stay retained with a named cause. Preparing receipts
are abandoned, never completed; a new admission gets a fresh source/run UUID.
A bounded 250 ms Git-lock census gates abandoned cleanup; locked sources remain
listed in `hub.status.hostSnapshotLeftovers` (null before the initial census). Transient startup cleanup failures are isolated and
retried on later admission; they do not poison the scheduler's lifetime.
