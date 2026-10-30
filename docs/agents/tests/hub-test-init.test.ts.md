# hub/test/init.test.ts

This T3 file uses real Git repositories and sealed scratch HOME/XDG/Git/account
environments through init-fixture and the shared fixture builders. It owns
init/update provisioning, committed-tree boundaries, idempotency and version
updates. Observe completed CLI/Git calls and dispose every writer before removing
the disposable root; never run setup against the live project or human profiles.

The user-settings contract preserves the original Bash PreToolUse hook and
appends exactly one managed synchronous literal-rm guard. Other user hooks,
models, permissions and settings.local.json stay intact. Managed signal hooks
remain asynchronous. Keep this real init/update ownership and test tier unchanged.

T1 shared settings provisioning is covered by init-settings.test.ts; pure payload
recognition by literal-rm.test.ts; T2 native exit/stdin by literal-rm-cli.test.ts;
T2 recorded launch injection by claude-code-environment.test.ts. Shell hook and
native harness/process races remain in init-process.test.ts.

## Repository auto-maintenance (T-1459)

The init/update regression checks local `gc.auto=0` and `maintenance.auto=false`
in the disposable project, territory and linked worktree. Its plain fetch trace
has a pre-init positive control that observes `maintenance run --auto`; after
init and update, fetch completes without maintenance. The doctor regression
checks both reported repositories, advisory drift and unchanged native config.
All Git and CLI work uses the sealed init fixture and disposable roots; no hub,
real account, network or live repository configuration is needed.

The inherited-Git sentinel regression poisons HOME/XDG and Git repository/config
inputs with disposable paths. The in-process init fixture scopes the final
`fixtureEnvironment` after identity/option overlays and restores the worker env.
Direct provision/doctor calls pass the shared sealed environment explicitly.
The sentinel Git config remains byte-identical. With the former identity-only
overlay the control fails (`warn` instead of `ok` for the target repository).
