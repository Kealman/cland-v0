# hub/test/claude-capture-concurrency.test.ts

T3 uses an adopted native process and injected descendants under a sealed scratch
root. The `afterCapture` fault hook runs reconciliation after native capture and
before its concurrent-update check, deterministically scheduling the memory
timer's competing operation without a timer delay.

The same-birth case must stop and join its one injected descendant. The differing
capture control adds another native member before reconciliation, so the row and
fresh capture differ. The second-descendant control adds it during the final
recapture. Both controls require incomplete stop, two observed child births and
zero signals. Existing Claude stop budget tests remain separate and unchanged.

Cleanup stops every owned writer, observes the root's native close, drains the
process owner's writes and only then removes the scratch directory.
