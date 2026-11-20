# Adapters implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Claude's mod observes envelope-bearing turns inside the harness. A native
`UserPromptSubmit` hook for an envelope already seen by the mod keeps its
delivery confirmation but does not update state: its asynchronous child may
start after the mod has completed that turn. Remember at most 64 envelope IDs
per watched session and discard them on unwatch or close. Native-only inputs
and hooks without envelope IDs retain their state signals.

Claude Code's managed Bash `PreToolUse` guard refuses computed rm/rmdir targets
(command substitutions, named variables, xargs and unquoted globs) before native approval stalls
the session. Read its reason, print the path if needed, and retry with every path
written literally, or leave a fresh `mktemp -d` directory in place. Init/update install it for hand-started sessions when `cland`
is on PATH; hub launches/relaunches inject it. Literal paths, `git rm` and heredoc
bodies pass; the guard needs no running hub.

Failed-launch rollback keeps child/file ownership when the captured native exit
receipt misses its post-stop deadline. Preserve that receipt fence; retrying
cleanup must not repeat an acknowledged stop. See the [recovery boundary](../../../docs/hub/adapters-and-sessions.md).

When changing forwarded host clients, preserve their session credentials on CLI,
hook and mod-bridge frames. A host secret never grants human authority. Consult
[host admission](../../../docs/hub/adapters-and-sessions.md#host-secret-admission-and-revocation)
for the deny-by-default boundary and local human revocation procedure.
Remote Claude requires an installed host mod directory and agent capability
`claude-launch-adopt-v1`; the agent owns the single launch discovery and native
worker receipt. Adopt by generation, never by caller PID. Keep CLAND_LAUNCH_TOKEN
in the generation's private 0600 MCP/settings files, outside argv and command
plans; remove them after confirmed stop and retain them on incomplete cleanup.
After tree closure, confirm native stop or positive native absence before
calling the generation receipt’s release callback and deleting private files.
Recover pending cleanup by re-adopting its durable generation after restart.
Keep remote Claude MCP/settings outside generic LaunchFiles undo; its bounded
LaunchSettled callback owns deletion after native settlement. The optional
settleFailedLaunch fallback rebuilds that callback only when the captured observer
is absent; missing state/receipt holds the row and role. Forget acknowledgement
follows durable pending-stop clearance and prunes only settled metadata/cache.
See the failed-launch section in the adapter/session reference for its restart
acknowledgement intent and typed non-admission boundary. An agent command result's
`claudeAdmission` receipt must match the requested generation before SSH maps
`refused-before-spawn` to non-admission. Old replies lacking it stay conservative;
never infer non-admission from an error string or missing worker receipt.
Native `no-process` proof comes from the run owner before spawn or after a no-PID
error and joined close; Claude removes its pending checkpoint before publishing
the generation refusal. Any observed PID or incomplete close retains the fence. Pre-wire cancellation is
proven only by wire() observing its own aborted signal before the request write;
after any write, cancellation alone grants no cleanup authority. Shared incomplete
classification must honor positive owner receipts before any diagnostic-text
fallback, including when an executable or config path contains those words.
A terminal remote Claude PID owns one bounded native settlement and one retry
through restart recovery; recurring liveness/discovery never launches a CLI.
Keep the row and role held with the cleanup-incomplete cause until settlement.
For adopted Claude, a positively exited or replaced pinned birth is settled,
not descendant churn. Unknown identity gets one bounded native re-read; a
persistent unknown remains incomplete. Adopted stop sends TERM to the pinned root
before descendant convergence; two consecutive matching captures authorize
survivor escalation and two empty captures confirm closure within the stop deadline.
Keep the first-census, UID and live pinned-parent ancestry gates; checkpoint every
new birth before signalling it. A pinned live parent can anchor a new child after
the root exits; an unproved orphan cannot. There is no fixed recapture count.
Scripted proof assumes graceful Claude shutdown; real-binary behavior is unverified.
A late orphan without observed ancestry stays held, never signalled by group.
See [agent receipts](../../../docs/agents/host-agent.md#claude-launch-receipts).

OpenCode remote readiness, HTTP and SSE use the same per-session Unix forward.
Keep its host-local URL in the process record for native attach, and cancel the
forward after identity-verified stop or failed-launch rollback using LaunchSettled.
The callback covers the current hub lifetime; post-restart Codex/OpenCode settlement
uses the exact forward receipt persisted with pending files. Preserve it through
rollback checkpoints; missing or mismatched state retains the row and role with
cleanup-incomplete. Preserve the OpenCode adapter/native tests unchanged when
changing this path; the remote lifecycle and cleanup guides name its evidence.
Normal remote exits retain supervision until identity cleanup, client socket and
watch work drain, and forward cancellation settle; failed cancellation retries
before the exit notice.
