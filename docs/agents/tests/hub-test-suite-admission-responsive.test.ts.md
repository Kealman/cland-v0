# hub/test/suite-admission-responsive.test.ts

T2 uses `projectHub`, a fake clock, candidate facts and a held or failed local
compatibility boundary. No verification worker starts. Check socket replies
while inspection is held. For a failed inspection, retain the exact reason in
`localBlocked.reason`, its pushed queue frame, unknown local waiter ETA and
`verify queue` CLI rendering. A failed local release recovery also retains the
budget: keep its reason and unknown successor ETA visible until cleanup succeeds,
then require successor admission and error clearance. A successful compatibility
retry clears the old inspection error. Native
process termination and recreated-root admission remain in the T3 cancellation
and recovery files.
