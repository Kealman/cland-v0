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
