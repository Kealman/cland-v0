# hub/test/suite-cancel.test.ts

T3 owns real worker cancellation, descendant death and restart receipts. The
detached fake harness scenarios use the public verify CLI on a sealed project
with fixture-local compatibility locks. Wait for the fake child's PID/root
receipt before cancelling. One fake recreates the root after its runner dies;
the other retains the inode. A filesystem-boundary observer records any attempt
to remove that exact root while the detached child lives. Keep the final
absence assertion, confirmed child death, cancelled result and next-run success.
Stop the fake before removing its exact root, original and quarantine paths.

The artificial 30-second body hold is ended by cancellation. Polls observe
process death or filesystem receipts; elapsed time is never the asserted fact.
