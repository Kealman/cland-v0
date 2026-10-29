# hub/test/executor-safety.test.ts

T3 keeps native shell, hub-process and detached-watchdog lifecycle boundaries.
The sentinel case uses the normal fixture lifetime while preparing, delivering
and starting each run. It observes the crash run's durable `pgid` before stopping
the hub. After confirmed shutdown, atomically publish an expired lease and set
the same deadline on that run's saved scheduler lease in the stopped database.
The detached watchdog is still the only running owner of cleanup. Observe its
`watchdog.json` confirmed-deletion receipt before restart, then retain the
lifetime-expired result, single report, released resources, spend and sentinel
absence assertions. Shortening a lifetime before delivery spends the expiry
budget on host scheduling and can fail before `pgid`; adding time to the group
wait does not repair that race. No new sleep or wider wall-clock bound is needed.

Restart's scheduler reads its own saved lease as well as the lease file, so the
fixture must update both durable deadline copies. Keep this fixture edit after
shutdown; do not change product expiry, name reservations or cleanup guarantees.

Finish barriers use `fakes/finish-poller.ts`: a five-minute independent backstop
exits 124 if no finish receipt arrives. Normal completion clears the polling
interval and does not wait for the unreferenced backstop. Fixture teardown stops
owned writers before removal and asserts an empty native cwd census. Fake
provider roots are canonicalized so macOS `/var` aliases match `/private/var`
working directories. The provider close regression has a positive npm/child
census before closing without a finish file, after a native npm exit-7 failure,
and after a native npm SIGTERM receipt; a pre-registered acquisition owner drains
setup before disposal, continues independent cleanup after an error, and bounds
the native child-close join. Omitted and aborted setup controls hold native setup after the positive census,
expire or abort its caller observation and expire a close observation, retain
the root, then release setup and confirm the retained teardown removes it.
Bound caller observation around the teardown promise; never memoize an
observation timeout as the teardown result. Register setup release before
case-deadline drainage so failed observations cannot strand that release. The bounded-poller
regression observes exit 124 and its diagnostic with a short injected bound.

Provider close fences new admission synchronously, then joins both direct-call
handlers and HTTP body/handler continuations through their actual settlement.
A transport timeout or closed socket does not release handler ownership.
Held-beforeCreate controls exercise both transports, keep the root until late
release, and confirm the admitted machine exists before close removes the root.
Post-close provider and filesystem mutator calls refuse with a fixed closed
error. Drainage has a separate native 30-second failure budget (or the configured
test wait bound); incomplete drainage retains the root and reports its pending
operation count. Scripted providers retain the same fence without an OS census.

Held-create missing/aborted serving receipts use the same pre-registered fixture
close entry as ordinary teardown. It releases the native gate and cancels both
receipt observers before joining request work or provider close. Keep this
release before the case-deadline owner's pending-work drain; placing it only in
that owner's final hooks creates a cycle when a serving receipt never arrives.

Use separate deadline owners: real elapsed time bounds native acquisition,
serving receipts (including the held-setup entered receipt), process disposal
and native close/drain joins. The independently injected FakeClock bounds only
the caller observations whose expiry the test intentionally advances. Nest
those observations around real-bounded native work; a frozen test clock must
never prevent an incomplete native operation from being reported. Pre-owned
release/cancel hooks run before either owner's pending-work drain.
