# hub/test/scenarios/droplet-verify.test.ts

The delivered-worker scenario uses the process-backed fake provider in a
disposable fixture. It retains host selection, runner execution, accounting,
single delivery and token-containment checks. An omitted executor reuses the
completed remote green; an explicit local request must complete a new local run
and report `Executor local`. Keep both assertions and await the durable result
before auditing the stopped fixture. The watchdog scenario also retains its
captured-process exit checks before directory removal.
