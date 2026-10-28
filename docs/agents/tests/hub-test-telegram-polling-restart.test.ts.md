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
