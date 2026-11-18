# hub/test/remote-discovery-host.test.ts

T3 uses only the fake SSH binary, fake host and in-process projectHub. The shared sshHostFixture owns the real master/agent descendants and joins its census before removing its disposable root. The test asserts the native socket paths fit 104 bytes including NUL, publishes the canonical file before admission, checks mode and a planted project bearer positive control, changes a discovery secret and observes a refusal before restoring it, checks carrier and hub restart receipts, and observes the next hello refusal after CLI revocation. Reconnect timings are injected; no fixed sleeps.

Readiness regressions inject cooperative cancellation and a noncooperating callback. They observe autonomous retry only after positive drain, and explicit cleanup-incomplete/retained ownership plus rejected stop before the noncooperating fixture is released during disposal. A synthetic RPC timeout is held until a later same-stream receipt. A changed per-host secret replaces a different existing discovery record atomically at 0600; the carrier reaches up only after publication completes.

All nine `eventually` calls are setup or completion observations, with their
reasons beside the calls. They use the shared default wait budget and load
factor. None asserts a product latency bound. Injected readiness, drain and
reconnect timings and the exact `drained(publication, 10)` assertions remain
unchanged. The outer test timeout uses shared load scaling over a 60-second
fixture budget so it does not cancel a valid scaled observation at 10 seconds.

Batch b49635d0 measured the old combined C2/C4/C5 identity at5.307s >5s. C2 file reread, C4 private stable bytes across restart and C5 revoked hello now run as independent cases with all original assertions. Shared fixture setup omits its unused first carrier; the default shared fixture still starts it. These tests inject carrier5ms readiness polling/3s setup bound and10ms reconnect, retaining production100ms/10s defaults. Targeted local load proof uses runSuite for this file only, both shared lease paths, machine resource, loadGate enabled and exact C2/C4/C5 identities: two load-gate lanes run five fresh-process repetitions per selected identity alongside the ordinary file phase. Linux batch repetitions remain deciding evidence; no duration allowance.
