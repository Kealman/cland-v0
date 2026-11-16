# hub/test/verify-submission.test.ts

T2 exercises runSuiteCommand through a scratch socket and projectHub with fake
clocks, candidate facts and executor receipts. Hold compatibility inspection
through the CLI's 15-second fake deadline and require a successful admission,
queue position and the same durable id in the queue. This isolates scheduler
inspection from candidate validation; it is not a live-machine timing benchmark.
The output collector is armed before submission: its stdout receipt proves the
actual CLI socket consumed the result. Bound barrier setup and output observation
separately; advance the CLI clock past its deadline only after that receipt.
Finally release compatibility and join both the submission and scheduler work,
including on an assertion failure. No parallel UI round trips establish delivery.
The withheld-reply case retains the previous wire shape and requires exit 75,
the exact check-queue guidance and one submission before any explicit retry.
