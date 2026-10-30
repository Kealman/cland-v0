# hub/test/freshness.test.ts

T3 native Git controls use disposable repositories and sealed fixture environments.
The advisory graph and persistence controls arm their held-owner receipts before
queuing freshness. While that owner is held, wait at most 15 seconds separately
for the entered owner, the original patch-id result and an unrelated foreground
verdict. Keep final semantic assertions for both current values.

Shutdown must remain pending while the entered advisory owner is held and must
join it after release. The persistence control throws from both persistence and
the diagnostic sink; neither may alter the already-published patch-id answer.
Cleanup releases every held owner before joining stop and removing the fixture.
