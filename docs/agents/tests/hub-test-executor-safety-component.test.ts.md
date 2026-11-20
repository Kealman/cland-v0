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

The shared-cap control keeps the first project's reservation active while the
second project's default, fallback-eligible request is admitted. A reachability
probe must not turn that acquisition fallback into a submission refusal. Keep
the local result and warning assertions, failed-delete reservation fence, then
confirmed-release replacement of reserved spend by actual cost and zero reserve.

Admission before the provider-retry assertion uses the same scripted `drive`
as completion. Extra pre-submit provider I/O can expose scratch-ledger lock
contention during acquisition; a raw `verificationSettled()` await cannot
advance its injected retry. Pin this setup with a scratch holder and exact
EEXIST receipt, release it, then drive only product-requested delays while
keeping the original fifteen-second admission bound. The later two-second
provider retry and final released lease/empty provider assertions stay intact.

The provider-retry case enrolls its exact admission `drive` in the scope's
`own` entry before the fifteen-second `receipt` observes it. `own` uses the
existing whole-case owner without reinstalling the native guard. Pass that
owner into `finish` and through `scriptedResult`: each original start, admission,
status/read, report check callback, clock advance and scheduler drive is joined
even if a bounded observer rejects first. Later admission is fenced when closing;
guard/seam/resource teardown waits for those originals. Legacy helper callers
omit the optional owner and keep their existing behavior.

The abandoned-observer control holds the original admission inside real
`finish`, starts owner close after the caller stops observing, and then releases
the producer. Its final order requires original settlement before cleanup.
One I/O turn exposes an incorrectly empty join without an elapsed-time assertion;
no hub, provider or native process is created by this control.
