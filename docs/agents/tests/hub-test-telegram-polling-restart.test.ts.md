# hub/test/telegram-polling-restart.test.ts

T3 exists because C1 asserts recovery after an actual hub-process kill. Run this
file alone, subject to cover-quiet. `startDaemon` launches only a disposable root
with the shared sealed environment, a fabricated private secret and a loopback
fake Bot API. It does not use a real Telegram token or endpoint.

`SIGKILL mid-update leaves the Telegram offset unconfirmed and restart handles it
once` first observes a production poll. Arm the exact unhandled-update log observer
before queuing the human's update; flush the real hub log and match both event
and update id, ignoring plain startup lines. The default empty registry leaves
that update selected but unconfirmed. Assert the absent durable offset before
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
instruction or end-to-end native mirror behavior.

Fake/handler resources stop before Store closure and fixture removal. No held
writer or native connection may outlive teardown. This is a single native
lifecycle identity, not an expansion of the whole T3 tier. Report its measured
Linux duration; ask the Coordinator for an allowance if it reaches three seconds.
