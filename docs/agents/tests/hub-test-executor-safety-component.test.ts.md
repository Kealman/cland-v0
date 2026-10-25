# hub/test/executor-safety-component.test.ts

`hub/test/executor-safety-component.test.ts` uses the scripted provider and
in-process hub (T2). The foreign-live-lease case and completion helpers live in
`hub/test/executor-safety-case.ts` so the load guard repeats the same assertions.

`finish` observes durable start and admission settlement before explicitly
finishing the worker. It checks the done receipt, then joins each admitted
scheduler/sweep operation through `drive` before another fake-clock step and
waits for the exact run's persisted topic report. One `clock.advance(1000)` is
not collection: native I/O can schedule a retry after it, or need a later poll.
The provider-retry regression requests 2000 ms during cleanup and asserts the
successful report, released lease and absence of provider resources. It goes
red at the original 15 s completion bound with the old single-step helper.

Run the component file with `node --test hub/test/executor-safety-component.test.ts`.
This uses sealed disposable fixtures and no browser or real provider. The load
proof is separate: see [the T4 guard](hub-test-executor-safety-load.test.ts.md).
