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
