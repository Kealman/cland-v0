# hub/test/claude-capture-concurrency.test.ts

T3 uses an adopted native process and injected descendants under a sealed scratch
root. The `afterCapture` fault hook runs reconciliation after native capture and
before its concurrent-update check, deterministically scheduling the memory
timer's competing operation without a timer delay.

The public owner.capture(worker) call exercises the guard at its fault seam
before stop consumes the prepared pins. The same-birth case stops and joins its injected descendant. The differing
capture control adds a native member before reconciliation, leaving conflicting
observers; it requires incomplete stop with zero signals. T-1678 intentionally
changes the second-descendant control: a second native child injected just before
the pinned root TERM is now joined through root-first stop and bounded convergence. The original
same-set republish acceptance remains covered separately.

Cleanup stops every owned writer, observes the root's native close, drains the
process owner's writes and only then removes the scratch directory.

The additional legacy-direct case sends the previous stop argument shape
(PID and birth, without captured pins). A fresh live owner creates its own
admission baseline before root TERM; caller-supplied or serialized metadata
cannot create that authority. Native root/child closure remains required.
