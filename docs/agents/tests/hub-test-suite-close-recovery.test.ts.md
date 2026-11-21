# hub/test/suite-close-recovery.test.ts

The cancellation case uses scripted machines and the injected hub clock. It
observes both persisted shard-start receipts before cancellation, then checks
one parent result, released leases, empty remote slots and provider deletion.
A whole-case owner enrolls the original callback before guard installation or
fixture acquisition. Its captured cleanup hooks run only after original setup,
body and clock-driver work joins, including late acquisitions. Missing start
receipts are abortable: closing admission rejects and joins the exact original
driver before resource cleanup. A positively controlled native-launch guard
stays installed through cleanup, and restoration requires positive whole-case
and hub/API drainage; failed or unknown drainage retains the guard.
The missing-start control checks the live guard fence, original driver join,
resource-cleanup order and successful guard release after confirmed drainage.
Setup receipt waits use the shared load-scaled budget; they do not assert a
product latency bound. Provider-loss and daemon-restart cases retain native
workers to prove their process lifecycle boundaries.

Finish barriers use `fakes/finish-poller.ts` with a five-minute base scaled by
the shared policy when the producer arms its timer; the backstop
exits 124. Fake provider close drains owned machine writers and asserts an empty
native cwd census before removing its canonical root, including failure and
cancellation teardown. See the executor-safety guide for the positive census
and short-bound native exit regressions.
