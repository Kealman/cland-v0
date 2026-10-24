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
