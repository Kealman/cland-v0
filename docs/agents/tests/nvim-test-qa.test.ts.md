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

The five new receipt/tamper callbacks enter receiptFixtureCase before acquisition.
Their proxy owns normal/signal teardown and guards each late root. Tamper directory,
script and wrapper setup have named bounds. The original QA run is enrolled before
its separate native-ownership setup observer, with immediate rejection handling;
completion is observed on the same owned promise. Closure fences further steps,
refuses launch after a late root allocation, stops an already captured live child
and joins original work/resources before directory cleanup. qa-runner's optional
rootAllocated hook adopts its actual root before environment construction/spawn;
other existing QA callers keep their current behavior.
