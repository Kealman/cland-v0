# hub/test/telegram-polling-restart.test.ts

T3 exists because C1 asserts recovery after an actual hub-process kill. Run this
file alone, subject to cover-quiet. `startDaemon` launches only a disposable root
with the shared sealed environment, a fabricated private secret and a loopback
fake Bot API. It does not use a real Telegram token or endpoint.

`SIGKILL mid-update leaves the Telegram offset unconfirmed and restart handles it
once` first observes a production poll. Install the fake Bot API's
`setMessageReaction` hold and arm its held-request observer before queuing the
human's text with `/control/say`. The production text handler commits the human
message, then awaits that held feedback before confirming the update. Retain the
original durable message id and `via: telegram`, and assert the absent offset
while feedback is held, immediately before SIGKILL. Unmatched edits confirm
silently and are not a crash boundary.

`killDaemon` uses its captured native ownership to SIGKILL the fixture and join
all discovered writers. Before signalling, retain the recorded native birth and
the matching live `nativePollerProcesses.inspect` receipt as a positive control.
After cleanup, assert the complete native exited receipt before reopening writers:
`{ alive: false, started: null, identity: null }`. The shared inspection uses the
process-identity helper's Linux Z/X and Darwin SZOMB receipts, or confirmed native
absence. A parent may not have reaped a zombie yet; `kill(pid, 0)` does not prove
that the captured incarnation can still write. Parent reaping is a different
boundary and is not claimed here. Retain the held connection's close receipt and
assert the offset is still absent after the kill.

Restart on the same hub.db with `projectHub` and the production Telegram factory.
Keep native process facts for stale lease recovery. Retain next poll offset 2,
stored offset 2, exactly one matching General message and its original durable id.
This tests a native kill while an accepted handler awaits feedback after the
human commit; it does not claim a kill after every SQLite instruction. The
committed-input case below covers the earlier commit-to-adapter-receipt window.

`SIGKILL after Telegram human commit before adapter receipt replays the durable
message once` starts the production Telegram factory in a native daemon with
`CLAND_TEST_CRASH_AT=telegram-input-committed`. The dispatcher hook sends SIGKILL
after `sendFromHuman` returns its committed message and before returning the
frame result. Retain the owned live native birth as a positive control and arm
the exit/poll-close observers before the human update. After the positive native
exit and captured-owner drainage, read one stored human message, no adapter
`telegram.inbound:<id>` receipt and no confirmed offset. Restart with the
production factory and actual process facts for stale-lease recovery. Retain
offset 2, exactly one history row and the original durable id. This proves a
kill in the commit-to-adapter-receipt window; it does not claim every SQLite
instruction, native session execution or real Telegram behavior.

Fake/handler resources stop before Store closure and fixture removal. No held
writer or native connection may outlive teardown. These are selected native
lifecycle identities, not an expansion of the whole T3 tier. Report their measured
Linux duration; ask the Coordinator for an allowance if it reaches three seconds.

Both native cases register `pacingOwner` before acquisition. Initial polls, held
feedback, native connection/poll closes and restart polls use `owner.observe`;
close receipts use its drain mode. Register captured native cleanup before
launch and restart through `owner.start`, so disposal cancels observations,
joins writers and closes storage before fixture removal. Normal native SIGKILL
still joins captured ownership before the restart opens its database.

The `Telegram restart observation owner drains after omitted/aborted setup
receipt` controls hold production text feedback while suppressing the serving
receipt. An independent setup clock or explicit abort ends setup; retain the
exact held connection close, hub stop, zero observations/timers and closed Store.
An intentionally unmatched poll observer must reject under that same owner.

The restart clock continues at the persisted native reaction attempt time plus
the one-second per-chat pacing interval. The default FakeClock epoch precedes
that real daemon attempt and would pin recovery behind a future pacing deadline.
This fixture excludes pacing latency; it preserves the stored attempt and fence.

The Discord history SIGKILL cases use the same native process lifecycle tier.
They seed an exact TEXT cursor, start a native daemon, retain its owned live
birth, then store two fake channel messages and invalidate the session with
4003. The fresh Identify respects the five-second reservation.
`discord-input-committed` kills after the group's outer commit and before the
adapter's frame result; both human rows survive, with the old native cursor.
`discord-page-uncommitted` kills after the first effect inside the group but
before its outer commit; neither row survives. After positive native exit and
captured-owner drainage, retain the frozen selection and old cursor. Restart
through projectHub with actual native process facts and require both ordered
messages exactly once, preserving the original ids for the committed case.
These prove the selected transaction/receipt boundaries, not every SQLite
instruction boundary. Only fake credentials and loopback endpoints are used.
Report Linux duration for the native admission wait and restart.

The Discord native fixture pre-owns acquisition, Store and exit/setup observations
through the shared pacing lifetime and exchange disposer. The Store closes only
after the captured native writers and restarted hub drain. Omitted and aborted
setup controls lose a serving receipt after actual native acquisition, cancel an
unmatched exit observer, and assert exact native exit, closed Store, zero owned
observations/native work and closed fake. Acquisition and shutdown bounds remain
separate; no observation is left running against a removed root.


This existing T3 remote lifecycle file also owns the full-scale Discord C2
620→500 production-frame case. It retains every durable history, overflow,
nonce/silence and independent active-history request assertion from the original
T2 case. Its completion wait is an absolute 10 seconds (loadFactor 1). The
8-second case allowance is owned by E-880 through 2026-11-05. T-1436's
Linux c-8 two-worker receipt A-14104 measured the full case at 5.166 seconds
and its restart-to-completion interval at 4.9214 seconds, before final assertions
and cleanup. This replaces the former 45-second allowance; all native reaction
I/O and final semantic assertions remain. The decoded-row guard passed at
16,545 of 50,000. The external stress probe applies the under-10-second threshold
to each diagnostic sample; A-14086 records all ten loaded macOS samples at
1.603–1.705 seconds on the same executable code (the later header-only change
restores lint admission). Phase timings overlap and include instrumentation.
The native page-commit rollback/kill case has a 10-second E-880 allowance through
2026-11-05, based on A-14104's assertion-passing 6.396-second sample. That run
stopped on its previously missing enforced allowance; Web did not run. The
existing committed-kill 10-second allowance is also owned by E-880.
No file allowance is added while file budgets remain report-only.


Native Discord acquisition has a separate10-second hang guard. It is not a speed
assertion: A-13590 reached the old1-second guard before the native kill boundary
on Linux. Omitted/aborted receipt controls explicitly retain1 second under their
injected setup clock; kill, identity, recovery and shutdown bounds are unchanged.


The full-scale case owns test-only overlapping phase diagnostics in
`discord-history-profile.ts`: SQLite COMMIT/RELEASE time, Store transactions,
synchronous topic.send/fanout, complete reaction calls, fetch-to-headers and
outbox payload rows decoded. The reported intervals overlap and include the
instrumentation overhead; they must not be added. Setup is reset out of these
counters, while restart is included. Each snapshot is taken at the durable
sent-overflow receipt, before the final history assertions and fixture cleanup.
A work guard limits decoded outbox rows to 100 per forwarded input (50,000 at
500); the positive control before indexed reads decoded over three million.
The completion observer queries its captured exact overflow source instead of
busy-decoding the full ledger. Native reaction I/O stays in the measurement.
