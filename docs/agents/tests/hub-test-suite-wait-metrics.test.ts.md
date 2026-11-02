# hub/test/suite-wait-metrics.test.ts

Queue wait tests use `Suites`, its public snapshot and durable journal with the
T-685 `FakeClock`. Startup performs no metrics snapshot; the first tick records
the current UTC hour. Further ticks and a same-hour store reopen must not duplicate
it. Advance across hourly boundaries and flush the journal before comparing its
persisted samples with the public queue metrics. Block fake time for long gaps
so the test does not execute thousands of unrelated scheduler ticks.

The shutdown regressions use `projectHub`, holding maintenance recovery through
its injected promise so shutdown cannot finish before the clock advances. They
cover both shutdown before the first sample and shutdown after a running sample,
advancing through the first second and a new UTC hour. Finally release recovery,
join shutdown and check the durable log's `stopping`/`stopped` span. The tests
use no native hub process and do not change `daemon.test.ts`.
