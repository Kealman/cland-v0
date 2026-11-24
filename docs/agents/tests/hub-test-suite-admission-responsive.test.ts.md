# hub/test/suite-admission-responsive.test.ts

T2 uses `projectHub`, a fake clock, candidate facts and a held or failed local
compatibility boundary. Worker receipts are faked. Check socket replies
while inspection is held. For a failed inspection, retain the exact reason in
`localBlocked.reason`, its pushed queue frame, unknown local waiter ETA and
`verify queue` CLI rendering. A failed local release recovery also retains the
budget: keep its reason and unknown successor ETA visible until cleanup succeeds,
then require successor admission and error clearance. A successful compatibility
retry clears the old inspection error. Native
process termination and recreated-root admission remain in the T3 cancellation
and recovery files.

The detached-launch regression holds the first fake local start after admission,
admits a second requester, then throws from the first start. Require its persisted
failure cause and posted suite result, and the two starts in queue order. An
unhandled rejection fails the test runner.

The fake executor-entry receipt has a separate `fake executor-entry setup`
deadline through the shared load-scaled `until` helper. Its held-receipt
regression uses an injected clock and load factor: it remains pending at the
unscaled bound and fails with the stage name at the scaled bound. Admission,
output setup and the existing final result assertions retain their own waits.
