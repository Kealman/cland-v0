## Coordinator session procedure

Hub-launched Claude Code runs with `DISABLE_AUTOUPDATER=1`, enforced after
credential filtering and in the supervised session settings. Update Claude Code
between sessions. If its process is replaced anyway, the watcher holds the row,
role and claims for a one-second re-exec grace after observing the old PID gone.
Native discovery can adopt a live replacement PID with a verified process start
identity only when it names the same harness session id; a reused background id
alone cannot transfer ownership. Native identity learned after launch by
discovery or a hook is kept in both the watcher and the durable process row.
A hello or bridge reconnect during that grace keeps the session's ownership
while discovery refreshes the PID. A dedicated expiry callback runs the final
native query at the grace boundary, independently of the ordinary liveness
poll; it bypasses the ordinary 30-second native-query
cache, so a reconnect after the last snapshot is still observed. If launch or
resume already owns a native query, the watcher settles it before the final
observation and ownership decision. If the process stays gone, the hub records
the exit and releases ownership after
the grace expires.
An explicit stop still waits for verified termination and publishes its stopped
state directly. Test fixtures can inject `ClaudeCodeOptions.reexecGraceMs` or
use `fakeClaude(t, { reexecGraceMs })` through the internal
`CLAND_TEST_CLAUDE_REEXEC_GRACE_MS` hook; there is no user grace setting or CLI flag.
If a newer native-id hook arrives during discovery or a replacement's
process-start probe, stale results cannot publish a PID or conversation. The next watcher tick
reconciles the newer identity before any grace-expiry exit.

A completed successful `claude agents --json` poll retires a previously listed
job that disappears when its recorded PID is absent or gone, or a matching job
reporting `done`, with `harness-exited` reason `retired`. Default discovery runs every 30 seconds,
with a 15-second native query deadline and a 5-second watcher tick; failed,
signed-out and cached reads cannot prove retirement. Terminal lookup uses the
captured native job id, with a conversation fallback only for legacy rows without
a job id. A known live PID remains supervised through missing native listings,
including hub restart; a remembered conversation alone is not a listing receipt.
A newer state hook fences terminal and state updates from an older query, even
when the native conversation stays unchanged. It still permits verified late PID
acquisition, which retains its own identity and ownership checks. An initial
unlisted launch keeps discovering, and a missing PID retains the re-exec grace above.
A retired Coordinator gets one `coordinator-retired` human inbox message with
`cland session resume <name> --relaunch`. Its durable identity includes the
cland session and native job id; restart preserves it, and successful reconnect
or resume marks that exact notice read. General deduplication does not advance
the Agents journal replay checkpoint. Other roles get the usual exit event.

If the Coordinator stays vacant for ten minutes, the hub posts one `decision`
notice in General naming the last holder and the recovery commands
`cland session resume <name> --relaunch` and `cland role set <name> coordinator`.
It sends no further vacancy alarm while that vacancy lasts; filling the role
cancels a pending alarm and a later vacancy starts a new ten-minute window.
The deadline, last holder and sent-notice receipt survive hub restart. An
absent remembered holder starts monitoring when the reopened hub has no live
Coordinator; restarting an existing vacancy keeps its original deadline.
Hub shutdown cancels vacancy monitoring; late socket closes after terminal core
shutdown cannot write vacancy state, publish transitions or rearm its timer.

For `cland hub stop` reporting `stopped, lock released, process still alive`,
exit 1 means the named PID remains alive after acknowledged shutdown and the
ten-second exit deadline. The CLI leaves it running because it released the
project lock; inspect the shutdown log and owned process before recovery.

Clause procedure (defaults coordinator, project coordinator):

- Use `session.launch` for roles; fix any refused roles.toml key before retrying. `cland session resume <name> --relaunch` keeps conversation, name, role and valid claim. Inspect failures before `cland session resume <name> --fresh` with its brief. Report occupied exclusive roles/lost claims; retake verifier holds.

Clause procedure (defaults coordinator, project coordinator):

- Prune: `session.prune` or `cland session prune --older-than 7d`; preview with `--dry-run`; the journal is retained.

