# hub/test/suite-check.test.ts

The three native check cases preserve lint/build completion, held-writer
shutdown and startup cancellation before a detached writer is registered. Every
fixture uses a disposable root; cleanup drains npm, discovers remaining root
writers, observes inherited pipe close, then removes the root.

A native exited-state receipt lets shared cleanup settle a zombie without a
signal. The startup cancellation case still waits, with its existing two-second
bound, for kill(pid, 0) ESRCH and keeps the final assertion before root removal.
That is the parent's PID-reaping receipt, separate from an exited-state receipt.
The deterministic after-ps Z/X and macOS SZOMB controls live in
[process cleanup](hub-test-process-cleanup.test.ts.md) and
[system processes](hub-test-system-processes.test.ts.md).
