# hub/test/suite-timeouts.test.ts

This T3 file proves real verifier command stalls, per-test timeouts and process
tree termination. Keep the hung fixture's normal timeout check and its setup and
assertion failure controls together. The generated hung worker persists its own
PID and its Node test runner PID before waiting indefinitely. Read a complete
JSON receipt, capture those identities while live, then assert both PIDs are
reaped after the exact job's terminal result and native timeout diagnostic.

The hung case registers cleanup before constructing the suite fixture. On early
failure it asks that fixture's verifier to cancel the exact job and waits for
its terminal cleanup receipt before closing sockets or removing the project.
Do not rely on the launch snapshot, hub shutdown or directory removal to kill
an active verifier tree. The failure controls run this same case in sealed
subprocesses with a 120-second test timeout so native expiry cannot hide missing
cleanup. They fail before PID registration and after it. A third control splits the
stdout PID receipt before the array, holds the remainder until a scratch-file
acknowledgement, then fails after ownership registration. The parent waits for a
complete newline-delimited JSON record, validates the owned root and two distinct
positive PIDs within the existing setup bound, and asserts it observed the
partial record before resuming it. A prefix or pipe chunk never completes setup; the
parent observes the deliberate failure, process close, both dead PIDs and the
removed project. Parent ownership is a safety net after the assertions, not
passing cleanup evidence. Setup, execution and pipe drainage have bounded waits.

Run the full file serially five times for T-450's cleanup repetition criterion.
Run `--test-name-pattern='hung fixture reaps|verify fails a named hung'` for the
narrow regression loop. This uses no browser or provider account. Each nested
runner uses `runnerFixtureEnvironment` after its final control overlay.
The phase-sweep backstop is covered separately in
[suite-runner.test.ts](hub-test-suite-runner.test.ts.md).
