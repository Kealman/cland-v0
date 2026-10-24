# hub/test/suite-scheduling.test.ts

T-1232 drives nightly soak and periodic dev T3 timers through suiteUnit's
FakeClock with candidate inspection and skip-notice failures. Join settled I/O,
assert both the original skip log and secondary notice-failure log, then assert
status and queue reads still work. This is T1: no Git, worker or provider runs.
