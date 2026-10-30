# hub/test/claude-code-schedule.test.ts

`Claude re-exec bridge acknowledgement without a model turn remains unconfirmed`
uses the production adapter with the scripted native CLI, real frame/spoke edges
and FakeClock. Replace the spoke and bridge under the same launch id, acknowledge
the old `injected {message}` wire shape without a turn, then advance the 60-second
confirmation window. Retain the exact `inject-unconfirmed` log and delivered-stage
assertions. An unrelated turn stays insufficient; the exact envelope-bearing
turn-start confirms the delivery even after its deadline. No harness process or
browser is needed for this re-exec connection shape.

`Claude close cancels a held native query and drains its callback before releasing
ownership` is the T2 shutdown regression (T-1261). The scripted `execFile` edge
holds an agents query and records cancellation. Close must remain pending until
the native callback is released; advancing fake time afterwards must start no
new command. The real native timer/PID boundary remains in
[`scenarios/hook-bridge.test.ts`](hub-test-scenarios-hook-bridge.test.ts.md).
An unconditional `finally` releases any held callbacks and awaits close before
after hooks restore the native edge, so a failed assertion cannot strand teardown.

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

The component's `connectUi` supplies a no-op process observer because its positive
PIDs and birth stamps are invented. `scripted Claude frame results skip native
process ownership probes` intercepts synchronous child launches and checks a
positive PID in both launch and list replies before asserting zero probes after
shutdown. Keep the opt-out local to this scripted fixture; FrameClient's default
native accounting remains enabled for native fixtures.

`Claude busy poll after 37 seconds respects pushed idle: true/false` replays
the incident through the production session manager, adapter and frame bridge.
The scripted CLI reports busy after 37 virtual seconds. Explicit `transportClock`
forwarding through projectHub/serveProject/projectSessions/Sessions gives the
manager the same complete FakeClock as the core and adapter; production defaults
to realClock, independently of the core policy clock. The existing server socket
transportClock seam remains scoped to socket liveness. Hook interpretation,
push age, retry stamps and injection admission use the manager's transport clock.
Shared `until` observes the poll signal receipt before the final state read.
With a pushed idle, assert the human send's `delivered` outcome and exactly one
inject carrying its durable message id; without any pushed state, assert the
initial unknown becomes busy. A scratch-source negative control removes only
the busy-poll guard and must fail with actual busy versus expected idle.

The replay uses the shared pacingOwner for hub acquisition and cardWebOwner for
the real HTTP/WebSocket bridge. A synchronous production dispatcher client owns
its close before setup and supplies the local trigger; no new raw connectUi
acquisition is introduced. The bridge buffers frames before the send; shared
`until` reads that buffer by durable id after the owned request, leaving no
separate inject waiter on a failed trigger. The `Claude replay bridge omitted/
aborted setup drains its owner` cases withhold readiness after actual native
acquisition. Deadline/cancellation must join native HTTP/WS close receipts and
leave zero observations or timers before hub stop and root disposal.

Run this T2 file with `node --test hub/test/claude-code-schedule.test.ts` under
fixtureEnvironment. It uses sealed disposable projects with no native Claude,
browser or live retained history. Virtual elapsed time is not delivery latency
or a memory measurement. A local file run takes about four seconds on the Mac.
