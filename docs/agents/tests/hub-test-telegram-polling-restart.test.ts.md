# hub/test/telegram-polling-restart.test.ts

T3 exists because C1 asserts recovery after an actual hub-process kill. Run this
file alone, subject to cover-quiet. `startDaemon` launches only a disposable root
with the shared sealed environment, a fabricated private secret and a loopback
fake Bot API. It does not use a real Telegram token or endpoint.

`SIGKILL mid-update leaves the Telegram offset unconfirmed and restart handles it
once` first observes a production poll. Arm the exact unhandled-update log observer
before queuing the human's update; flush the real hub log and match both event
and update id, ignoring plain startup lines. It injects an edited message: the
native text mirror handles new messages, while this edit has no handler and
stays selected but unconfirmed. Assert the absent durable offset before
`killDaemon` uses its captured native ownership to SIGKILL the fixture and join
all discovered writers. Before signalling, retain the recorded native birth and
the matching live `nativePollerProcesses.inspect` receipt as a positive control.
After cleanup, assert the complete native exited receipt before reopening writers:
`{ alive: false, started: null, identity: null }`. The shared inspection uses the
process-identity helper's Linux Z/X and Darwin SZOMB receipts, or confirmed native
absence. A parent may not have reaped a zombie yet; `kill(pid, 0)` does not prove
that the captured incarnation can still write. Parent reaping is a different
boundary and is not claimed here.

Restart on the same hub.db with `projectHub` and a registered frame-based handler.
Keep native process facts for stale lease recovery. The handler resolves only on
the durable topic.send reply. Retain handler id 1, next poll offset 2, stored
offset 2 and exactly one matching General message. This tests a kill before
handling completion; handlers must separately make replay safe if they wrote
partial effects before a crash. It does not claim a kill after every SQLite
instruction. The committed-input case below covers the next crash boundary.

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
