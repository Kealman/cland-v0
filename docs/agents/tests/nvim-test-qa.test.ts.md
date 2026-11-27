# nvim/test/qa.test.ts

The shared builder's QA projection retains existing QA/Node inputs and removes
all fixture/caller CLAND authority, including both root keys, executor state and
three loopback API sentinels. ENV-001 stays unchanged. The allocator's fixed-root
preload and exec shim live inside its own run directory; CLAND_NODE points there.
The argument descriptor pins bytes and device/inode/mode/size. Missing/tampered
shim and preload controls require a structured not-started refusal. Every stdio
hub spawn, including reconnect, repeats the owner check. This is an accidental
mismatch/reuse boundary, not an OS executable fence. A read-only fallback grants
nothing. OWNERS-001 positively reads persisted scratch-only receipts under both
stdio and stub hubs, so nonfatal fallback cannot hide a missing grant.
Keep SHELL-001's real
stdio run and the environment-sealing stub run as separate checks before
attributing later QA expectations. The ordinary dump client receives its grant
from this file's actual tempDir allocation, never from startClient.

This T3 file runs real headless Neovim and owned fixture hubs. Run it serially in
the native slot, with logs outside the source tree. Sandbox cases may skip when
the platform lacks sandbox-exec; report those skips separately.

The wrapper pid-file observation uses `eventually` and `testWaitMs` from
`hub/test/until.ts`: its named setup bound inherits `CLAND_TEST_WAIT_MS` and
`CLAND_TEST_LOAD_FACTOR` (including the droplet default). The timeout case keeps
its exact BLOCKED, exit 2 and process-group-gone assertions; setup headroom does
not change the product's two-second deadline. To reproduce the old fixed-bound
failure, hold publication of the wrapper-written pid until 10.5 seconds after
the pid observer starts, then publish it and join the writer before teardown.

The process-group absence check uses the same load-scaled setup wait. Only
signal-zero ESRCH confirms absence; every other probe error fails immediately
with its literal code. The pure `hub/test/qa-process-group.test.ts` regression injects
ESRCH, EPERM and EIO without launching or signalling a native process.

Every callback enters receiptFixtureCase before acquisition, including the
fixture-writer CLI and ordinary dump client. Its proxy owns normal/signal
teardown and guards each late root. Directory, script, wrapper and dump-client
setup have named bounds. The original QA run is enrolled before
its separate native-ownership setup observer, with immediate rejection handling;
completion is observed on the same owned promise. Closure fences further steps,
refuses launch after a late root allocation, stops an already captured live child
and joins original work/resources before directory cleanup. qa-runner's optional
rootAllocated hook adopts its actual root before environment construction/spawn.
Both QA files use the shared ownedQa helper in qa-runner.ts. The injected runner
in case-deadlines.test.ts interrupts held root acquisition and captured child
setup without native launches; its stop request and independently held close
have separate receipts. The dump control calls the actual createClient with a
guarded fake spawn and a real local RPC socket holding nvim_ui_attach. The
optional started observer receives the child before connect/attach; the shared
ownedDumpClient enrolls its close immediately and can stop it during setup.
Both controls check root retention while close is unresolved, then publish and
observe close, join the original work and exercise actual guarded removal.
Fallback releases and joins are registered before acquisition. The signal-readiness
observer is armed before starting the QA call.

The dump control also interrupts before listen: fallback fences fake native
admission synchronously, closes the nested owner before joining setup, and
publishes no child-close receipt for an acquisition that was never admitted.
Its retained late attempt must reach the refusing fence with no listener left.

KEYS-002 retains its 120-second product timeout. Its original run, completion
observer and owner teardown opt into that allowance plus shared testDeadlineMs
setup/closure headroom. The native-startup observer and other steps keep their
existing setup bound; other callers retain their defaults. The generated
fake-clock cases prove setup still expires at its setup bound, completion can
cross the full product allowance, and a closing owner joins that longer work.
These are simulated-clock receipts, not a 120-second timing measurement.
