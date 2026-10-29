# hub/test/suite.test.ts

This T3 file proves the real local worker boundary in sealed disposable projects.
For task/batch cadence, retain the recorded `executions` file assertion after the
durable worker result: a batch runs check before unit/integration commands.
Assert the emitted T0 exit and duration receipt as well as runtime tier receipts.
Keep the failure case proving that a red check stops the tests. Pure admission
permutations belong in `verification-commands.test.ts`.

For cleanup-preserved identity recovery, use `launchWorker()` from the shared
suite fixture before stopping the hub or editing its saved job. It waits for the
worker PID in `hub.status` and registers process ownership; `launch()` may return
a queued snapshot with a null PID. The held-admission regression keeps the local
slot occupied, observes that null launch reply through the CLI, then releases
admission and asserts the actual worker PID and its successful completion.
Retain the cleanup error's persisted-row/terminal-frame fence and live-worker,
no-report and natural-completion assertions. T-1420's unchanged baseline did not
reproduce the historical Linux failure in five loaded macOS runs; the controlled
regression proves the setup gap independently.
