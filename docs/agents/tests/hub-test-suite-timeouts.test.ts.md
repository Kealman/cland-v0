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

The fast-exit writer regression holds a pre-child ps snapshot until the parent
exits, preventing ancestry capture. The exact verifier result precedes assertions
of native writer death and unrelated same-cwd process survival.
Run on macOS and on a Linux droplet. The denied-census control preloads a sealed
spawn wrapper that fails only the endpoint inspector; it retains the incomplete
warning, Inbox/journal uniqueness, muted-result and successor-admission assertions.
The native census case checks actual endpoints plus changed-birth refusal.

The denied-census preload selects the Perl launch carrying the duplicated stdio
streams, independently of the platform script, and persists its refusal receipt.
The stdout-only and stderr-only native controls observe the unused channel's EOF
and parent exit before census. Each retains changed-birth refusal, exact writer
death after termination and unrelated same-cwd process survival.

`stdio-writer-fixture.ts` registers its disposal fence before spawning. IPC
acquisition captures the native writer independently of file readiness; the
parent remains alive until the owner explicitly releases it. Normal census
starts after that release, observed parent exit and the unused channel's EOF.
Omitted/aborted readiness controls dispose through the same owner, abort and join
readiness observations, retain late IPC acquisition and require native close plus
writer death while the disposable root still exists.

The same idempotent disposal promise also guards the root's `beforeRemove`.
A forced incomplete-stop control observes removal refusal and the live writer's
retained root, then explicitly recovers the owner, observes native close with the
root present, and only then removes it. Recovery resets a failed disposal attempt;
ordinary removal never retries a failed stop implicitly.

The fixture allocates its own disposable root and registers exactly one directory
owner with `beforeRemove`; callers do not pass a root already owned by
`tempProject`. The automatic-teardown regression captures and executes the actual
`cleanupSteps` callback registered through `after`, including all directory
callbacks, as the process-cleanup tests do. It proves the root survives the first
failed teardown, explicit recovery observes native close with the root present,
and a second teardown removes it. Resource cleanup calls the owner's current
idempotent disposal rather than caching a separate rejected lifecycle promise.
