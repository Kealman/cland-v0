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
publications and released lifecycle assertions. The one-second test bound
covers setup and completion; unconditional gate release drains failures before
fixture storage closes. These T1 cases use only a fake adapter and clock.
