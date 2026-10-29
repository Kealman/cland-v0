# hub/test/suite-remote-process.test.ts

`hub/test/suite-remote-process.test.ts` is T3: the native project hub, fake
DigitalOcean API and real delivered shell prove process completion separately
from failed spend settlement. All projects, account paths, keys and machines
belong to sealed disposable fixtures; the provider is always fake.

`finished remote runs free both budget slots despite failed spend settlement`
keeps the spend ledger fault in place until the original runs finish and both
waiters are admitted. Admission is not completion: each waiter can still own
native SSH-key generation or watchdog work before its terminal failure while
the ledger and create faults remain set.
Await each waiter's exact `suite:<id>` terminal report in its own item topic,
assert exit 1, and only then restore the ledger and return. Retain the original
exit 0/exit 1, admission, queue and confirmed-deletion assertions, together with
the fixture's native resource leak check.

For a deterministic early-return control, temporarily wrap `ssh-keygen` in the
fake machine's `bin` directory after the first two runs reach their barriers.
Delay the waiters' native invocation, record their PIDs inside the fixture, and
check their terminal result files at the old return boundary. The assertion
must fail before the terminal waits are added and pass with the same delay after
them. This control proves the missing completion boundary; attribute a reported
native resource leak separately using its creation stack. Remove temporary
wrappers and stack capture before committing.

The macOS regression probe repeats this exact identity ten times in two lanes
of five fresh Node processes alongside an owned CPU worker. Observe CPU progress
for every repetition, complete TAP summaries and every runner's native close;
stop and join the CPU worker before reporting capacity released. This deliberate
load needs exclusive local capacity approved by the Coordinator, or a queued
verification lease. A normal targeted file run does not start CPU load.

Finish barriers use `fakes/finish-poller.ts` with a five-minute backstop that
exits 124. Fake provider close drains owned machine writers and asserts an empty
native cwd census before removing its canonical root, including failure and
cancellation teardown. See the executor-safety guide for the positive census
and short-bound native exit regressions.
