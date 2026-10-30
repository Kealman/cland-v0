# hub/test/prerequisite-process.test.ts

T3: real native children prove smoke startup, cancellation, escalation and root
removal ordering; no hub or browser starts. Run this file alone through the local
single-file grant. It uses the same cliSmokeOwner as the report command.

The owner registers ownDirectory.beforeRemove and the test stop barrier before
any copy or launch, owns preparation writes, observes setup independently of the
run bound, and uses abortable acquisition to prevent late spawn after cancellation.
It retains the child handle and ownProcess identity/group; TERM gets a bounded
grace before KILL and owned process cleanup. Native close (including pipes) plus
identity cleanup must finish before removal. Missing close or write drainage
retains the directory with explicit incomplete diagnostics; it is never clear.

Controls: omitted IPC readiness reaches a setup deadline and joins SIGTERM close;
aborted pre-spawn acquisition has no PID; a ready TERM-resistant process reaches
the run deadline and joins SIGKILL close. Each prints its native code/signal,
closed state, forced flag and root-presence receipt. The final filesystem
assertion proves removal followed the receipt. Setup deadlines do not claim run
timing, and signals do not stand in for native close. Homes/XDG/Git and provider
filtering use fixtureEnvironment after all overlays. Output is bounded and
redacted before capture; no capture exports include fixture homes.

Source2 M4 adds a native wrapper gate before application imports or eval. Its
positive IPC gate receipt precedes identity capture; only a nonempty captured
birth identity and matching registered detached group allow the admission frame.
Missing/throwing capture leaves the gate unreleased and root fenced even after
native close. The failed-capture controls assert the gate receipt, unreleased
admission, native close and retained root, then explicitly reconcile the closed,
unreleased wrapper before removing it. That narrow reconciliation is forbidden
once admission was attempted. A separate fast-parent control publishes its writer's
PID from a native receipt, observes root-parent close, and asserts the writer's
captured process is absent after owned descendant settlement and before removal.
