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
