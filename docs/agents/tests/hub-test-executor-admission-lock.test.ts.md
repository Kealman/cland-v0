# hub/test/executor-admission-lock.test.ts

Before taking the test's held ledger/budget lock, wait for the initial
`executor-sweep` journal record through the bounded fixture observer and the
`hub.status {flushLogs: true}` barrier, then assert its zero failures. An
`executor.status` reply observes recovery without joining it and cannot finish
this setup boundary. Keep the contention, cancellation, zero-resource and
drained-wait assertions after setup unchanged.

Hold the scratch ledger lock to prove sweep retries use the executor's injected
wait, including migration reads. The retry receipt releases the holder; await the
completed sweep before shutdown. A second control closes the executor while that
retry is held, awaits sweep completion and verifies the holder's ledger bytes stay
unchanged. Failure cleanup releases the holder and drains writers before directory
removal. Keep the fake clock paired with its wait driver: a bare fake-clock timer
cannot be advanced by the scripted remote driver and can strand shared-cap tests.

For reservation shutdown, hold the scratch budget or spend lock through the
completed `projectHub.stop()` receipt, with a separate three-second stop bound.
Keep the other holder's exact token/bytes and assert that no provider POST or
worker start happened. Release the fixture holder only afterwards, restart the
same scratch project, observe its released lease, then assert `executor.status`
has no active leases or reserved spend. This proves component shutdown drainage;
it does not measure native hub-process exit or provider/network latency.

For sharded close-run planning, use the scripted integrated fixture and observe
the persisted stage job while `suite.start` is still joining planning. An actual
EEXIST from the ledger link is the held-lock setup receipt. For release, hold the
provider size reply before reservation, seed the exact shard ids, then refuse
planning while the ledger is held. Observe the persisted shard-release intent,
stop within three seconds without releasing that holder, and retain the intent
and counted entries until restart. The next hub must settle the entries, remove
the intent and report zero reserved spend. Cleanup releases fixture gates and
holders and joins shutdown before removing either root.
