# hub/test/verify-submission.test.ts

T2 exercises runSuiteCommand through a scratch socket and projectHub with fake
clocks, candidate facts and executor receipts. Hold compatibility inspection
through the CLI's 90-second fake deadline and require a successful admission,
queue position and the same durable id in the queue. This isolates scheduler
inspection from candidate validation; it is not a live-machine timing benchmark.
The output collector is armed before submission: its stdout receipt proves the
actual CLI socket consumed the result. Bound barrier setup and output observation
separately; advance the CLI clock past its deadline only after that receipt.
Finally release compatibility and join both the submission and scheduler work,
including on an assertion failure. No parallel UI round trips establish delivery.
The withheld-reply case retains the previous wire shape and requires exit 75,
the exact check-queue guidance and one submission before any explicit retry.

The held candidate-inspection regression advances the CLI fake clock 45 seconds
before releasing admission, modelling the retained approximately 40-second local
admission envelope with headroom. The unchanged result shape must produce exit 0
and a run id matching the durable queue. This is deterministic delay injection,
not a claim to reproduce live machine load. Barrier setup and CLI output are
bounded separately; release and join submission/scheduler in finally. Withheld
welcome, dry-run and result cases advance the full 90-second normal deadline.

The candidate-delay case creates fixtureWork before any acquisition, owns the
whole callback with run, registers the barrier release before admission, adopts
the root and late hub/UI/spoke/server acquisitions, and steps setup writes and
requests through the cancellation fence. Settlement joins the callback before
root removal; an incomplete drain retains the root.
