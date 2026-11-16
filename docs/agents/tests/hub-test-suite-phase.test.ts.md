# hub/test/suite-phase.test.ts

T1 exercises the same phase owner that `run-suite.ts` uses in a delivered tree,
including on a droplet. A FakeClock advances to 29,999 ms and 30,000 ms after a
file starts without a first test. The phase emits its file-specific stall and
pre-cleanup native exit/pipe evidence, joins a held cleanup promise and returns
1 even when the native test process exits 0. It publishes ownership start only
after guard installation, and finish after native exit and timeout cleanup join.
The runner keeps its normal writer sweep before pipe-close waiting.
No native process, network or real-time wait is used.

The marker control proves suiteSummary (also used by CLI reports), suiteProgress
and semantic log reduction ignore ownership markers for counts and test facts.
Heartbeat reads stored job facts; artifact publication copies the log without
interpreting these lines. No marker becomes a test or a terminal result.
