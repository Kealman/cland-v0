# hub/test/claude-code-schedule.test.ts

Claude re-exec ownership uses the frame/MCP seam in
`claude-code-schedule.test.ts`: the production adapter reads a scripted native
CLI boundary, synthetic PID/start facts and a fake clock in a sealed scratch
project. Production grace is one second from the first missing-PID observation;
a dedicated expiry callback observes native identity before finalizing death,
without waiting for the next liveness tick. Default-window tests prove prompt
genuine exit, reconnect-before-missing-PID ordering and expiry cleanup at stop.
Race fixtures inject a longer virtual window with `ClaudeCodeOptions.reexecGraceMs`.
Native fixture timing uses `fakeClaude(t, { reexecGraceMs: 100 })` via the internal
`CLAND_TEST_CLAUDE_REEXEC_GRACE_MS` hook; the native crash contract advances its
clock only after observing OS exit. Integration tests retain their existing
event/row/screen bounds and final assertions; no death wait is lengthened.
Tests retain the published replacement PID, role, claim and absence of
revocation, with hello before the first missing-PID poll and after both that
poll and the last scheduled native snapshot. A
distinct native id is also learned after launch through discovery and hooks;
a held launch query crosses the grace boundary before the replacement PID is
published, retaining role and claim. Known-PID hook coverage independently
changes the native identity before replacement. Held process-start probes,
with known and unavailable results, cannot overwrite a newer hook identity or
revoke ownership before the next poll reconciles it. A held native query also
returns its earlier snapshot after a newer hook, proving that the same fence
covers discovery as well as process-start probes. A
conflicting native conversation cannot inherit a reused background id and the
original process exits after the grace. `store.test.ts` checks the ten-minute
General decision and cancellation with fake time, including store reopen with
an absent remembered holder, deadline recovery and durable alarm deduplication.
The native Claude contract
keeps the actual process-exit assertion and advances only the hub watcher's
grace after the OS has reaped the fixture PID.
Vacancy shutdown coverage retains the connected-Coordinator `projectHub.stop`
and zero-timer assertions in `project-clock.test.ts`. The core/store regression
closes both before delivering a late disconnect, then checks no database access,
no lifecycle publication and no timer rearming across the notice deadline.

The fake-clock replacement matrix retains the credential from the launch's
private settings, reconnects the own spoke, observes the exact replacement PID
receipt and proves an authenticated shell frame still succeeds. It covers
Coordinator and Implementer roles, discovery/hook identities and held probes.
The standalone scripted native edge uses scratch launch-file storage.
