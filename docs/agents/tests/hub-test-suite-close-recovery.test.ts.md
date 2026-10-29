# hub/test/suite-close-recovery.test.ts

Finish barriers use `fakes/finish-poller.ts` with a five-minute backstop that
exits 124. Fake provider close drains owned machine writers and asserts an empty
native cwd census before removing its canonical root, including failure and
cancellation teardown. See the executor-safety guide for the positive census
and short-bound native exit regressions.
