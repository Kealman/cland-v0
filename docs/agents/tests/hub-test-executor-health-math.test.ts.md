# hub/test/executor-health-math.test.ts

`node --test hub/test/executor-health-math.test.ts` is T1. Literal Linux counters
and injected scheduling/read/write boundaries prove the `suite machine metrics`
one-second series, load averages, CPU/iowait/steal percentages, and no writes
after stop, including an already queued tick. No native process or wall-clock
wait is involved. Existing aggregate-health and malformed-receipt cases retain
the previous receipt shape.

The fake transport case `delivery survives a snapshot replacement during machine
creation` in `executor-prepare-component.test.ts` (T2) observes the uploaded
sampler, native entry point and runner script, including the shared foreground
timeout, bounded framed append before completion, and a missing-anchor control.
The caller uses whole-callback guarded ownership with bounded setup and retains
its native guard until release/close are confirmed. The pure tests also model a
terminated stalled command, an unavailable writer, and interleaved package
writes without newlines through the same streaming append function.
The fake owner additionally proves TERM before launch, a resistant child without
a close receipt, its bounded machine handoff, and a late close that cannot
overwrite that handoff. Normal native close is the positive control.
The guarded VM status cases in `executor-droplet-component.test.ts` model
supervisor KILL, unavailable/oversize native-exit data, close failure and the
exact previous runner shape. `suite-accounting.test.ts` holds provider deletion
unconfirmed past accounting expiry and through restart, then observes released
lease/no machine before its sole final report with the original native exit.
It does not measure Linux scheduler timing. Real sizing evidence requires paired
unsharded c-8/c-4 workers-2 runs at the same tree, approved by the Coordinator,
after deploying the launcher to the hosting hub.
