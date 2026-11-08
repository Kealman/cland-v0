# Claude Code hooks

`cland init` and `cland update` add a managed synchronous Bash `PreToolUse`
hook. Hub launches and relaunches inject the same `cland hook literal-rm`
handler through private settings. Existing sessions receive it on relaunch.

The guard refuses rm/rmdir targets using command substitutions, backticks,
named variables, xargs or unquoted globs (`*`, `?`, `[...]`), including inside
`bash -c` and `sh -c` scripts. Its exit 2 gives the model a reason and a retry:
print the path first if needed, then write every path literally, or leave a fresh `mktemp -d` directory in place. This avoids
Claude Code's statically-unresolvable-target approval stall under bypass
permissions. Literal paths, `git rm` and here-document bodies pass.

The handler evaluates no shell command and needs no hub, auth or network. It
uses the project's prototype pattern checks, not a complete shell parser or a
security boundary. Missing or malformed payloads pass. Other status hooks stay
asynchronous.

Hand-started sessions require `cland` on PATH. Project hooks stand aside when
`CLAND_SESSION_NAME` is set because the hub injected its own hooks. Init/update
replace only managed hook entries, preserving user hooks and local settings;
invalid project JSON is kept with a diagnostic and must be repaired before the
hook can be provisioned. Do not keep a second project-own literal-rm hook.

On `local`, the hub also watches its launched background jobs through `claude agents --json`.
A fresh successful list that loses a previously listed job without a known live
PID, or reports its matching job `done`, produces `harness-exited` reason `retired`. Default polling
uses a 30-second interval plus the 5-second watcher tick and bounded native I/O;
failed, signed-out or cached reads do not retire jobs. Re-exec keeps its existing
grace. Known live PIDs remain supervised through native discovery failure;
newer hooks block stale terminal/state updates while allowing verified late PID
discovery. A retired Coordinator receives one human inbox remedy, preserved across
restart and cleared on successful reconnect or resume:
`cland session resume <name> --relaunch`. This needs no new hook or role permission.

On a nonlocal Host, launch discovers the worker once; restart resume allows at
most one further discovery. Recurring timers use only Host liveness with the recorded Linux
birth identity. A terminal PID observation triggers one generation-bound native
settlement before exit: at most one stop and one absence confirmation under the
stop deadline. Failed confirmation retains the row, role and private credential
files as cleanup-incomplete; one retry belongs to re-adopt on the next hub start.
Further timer intervals never retry native cleanup. Hooks and the mod bridge carry state. When discovery misses the
PID, the row stays supervised as `running` with an unknown PID and a
`harness-pid-unknown` diagnostic; it performs no PID probe or timed discovery
retry. Explicit resume can discover once.

## Hooks on an SSH Host

Host hooks and the mod bridge read the private generation settings and forwarded
host discovery. CLAND_LAUNCH_TOKEN supplies session authority; the host secret
alone grants none. Host admission targets the authenticated durable session and
accepts a signal native id only when it matches that session's recorded native
conversation. Names and launch generations remain validated. Confirmed stop
removes the private generation files; incomplete ownership retains them.
