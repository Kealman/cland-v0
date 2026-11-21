# hub/test/lifecycle-serialization.test.ts

The Coordinator permission-recheck case supplies a synthetic credential in the
fixture's own in-memory store before submitting the raw CLI frame. Keep caller
authentication separate from the queued grant-revocation assertion. Hold the
native adapter receipt, revoke the grant while stop waits in the lifecycle
queue, and retain the final replacement-process and no-stop assertions.
Drain Sessions before closing its process table.

The T-1267 `shutdown drains a held … resume without restarting supervision or
publishing its result` matrix holds native resume completion (`found`, `alive`)
or the later process-identity probe (`identity`). Observe adapter closure before
releasing each result, then await both the resume rejection and session drain.
Keep the final unchanged process row, zero watch calls, absent resume
publications and released lifecycle assertions. Worker admission and account
initialization finish in a separately bounded before hook (75 seconds through
the shared wait policy). The explicit 2000 ms case bound covers the remaining
fixture setup and lifecycle behavior; admission retains its own 15–60 second
reply bound. Unconditional gate release drains failures before storage closes.
These T1 cases use only a fake adapter and clock.

The shared stageCase owner enrolls the complete callback before acquisition,
fences new steps on cancellation, and retains the native launch guard until
original work joins and resource close returns positively. The fixture captures
hub, table and Sessions ownership before each next acquisition. Failed Sessions
close retains storage; failed table close retains the hub. Cleanup retries the
unconfirmed close before removing the root or restoring seams. Controlled
partial-acquisition cancellation cases exercise actual guarded cleanup with
confirmed close and with a rejected close followed by repair.
