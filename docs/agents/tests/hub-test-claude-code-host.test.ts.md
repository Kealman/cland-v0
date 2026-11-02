# hub/test/claude-code-host.test.ts

T2 recording-Host tests exercise ClaudeCodeAdapter through its public spawn,
resume, watch, stop and close operations. The fake Host supplies commands, bytes
and process facts; no native harness, remote transport, provider or account runs.
Private launch files live under a disposable tempProject; fixtureEnvironment
supplies scratch HOME, XDG and Git configuration after credential filtering.

The command case checks background flags, model/effort, discovery and stop argv,
cwd, updater environment and launch-token scope. Host-only settings bytes preserve
a human's bgIsolation override. The identity case uses a synthetic Linux birth
and a PID that is never probed locally, including discovery-miss fallback and
signed-out resume. The close case holds the exact Host liveness operation and
checks that close joins its completion before returning, with no late signals. Resume cases hold signed-out liveness, listed identity and
directory-miss fallback liveness, plus the directory scheduling delay. Close
joins the held Host receipt, cancels scheduling waits and rejects resume before
it can return a running process. Each native hold/close wait is bounded. Relaunch-close cases hold identity
after successful background launch: successful cleanup stops that exact new
job and removes its settings file; a refused Host stop makes close explicitly
incomplete and retains its launch owner/private files. The fake has no native
writer, including in the incomplete control.

Run one file at a time, checking disk space before each local run. Preserve
claude-code-adapter.test.ts, claude-code-sessions.test.ts,
claude-code-schedule.test.ts, claude-code-accounts.test.ts and
claude-code-environment.test.ts unedited as behavior controls. The shared Host
contract covers native capture/callback/signal order and absent/reused identities.

Nonlocal process cases build from testHost and processHost. File preparation
explicitly uses localHost operations with fixtureEnvironment on the disposable
project; directory/stat/write/remove operations must succeed before the synthetic
process boundary. Production testHost keeps its named file refusals. They count
one discovery for each of two launches in one interval, observe several Host
liveness receipts and death, retain a missing PID as supervised/running with an
unknown-PID diagnostic, and reopen the adapter for listed and missing restart
resume. The mixed local/nonlocal case checks local persisted polling continues
without a remote query. FakeClock starts at the real current date.

The same-session relaunch case holds a predecessor hook discovery through the
second background launch, then releases the old snapshot. Require a fresh
launch-owned query, the new PID/Linux birth, and no later timer command.

The remote fixture registers query releases at acquisition and releases all
gates before its bounded adapter-close drain. Abandoned-setup controls dispose
before and after the entry receipt without the normal explicit release, join
inspection completion, and retain zero later commands/timers.
