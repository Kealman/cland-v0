# hub/test/waiting-launch-store.test.ts

T1 exercises ProcessTable with in-memory SQLite. A deletion-failure trigger
proves process publication rolls back while the wait remains. After removing the
trigger, an observer sees the committed process and no wait in the same receipt.
Run `node --test hub/test/waiting-launch-store.test.ts`.


Ordinary puts (including the requested name) preserve waits; a mismatched
admission id rolls back publication. A matching admitted id consumes the
original requested name even when the published worker has another name.
