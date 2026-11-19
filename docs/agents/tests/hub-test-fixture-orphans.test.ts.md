# hub/test/fixture-orphans.test.ts

T2 uses injected rows, open-file paths, UID, missing-root and termination facts.
`receiptFixtureCase` enrolls the whole original caller in normal/signal cleanup
before setup. Every asynchronous operation crosses an admitted, bounded step;
fixture setup has its own named bound. Roots are adopted by the producer and
receipt cleanup is registered before PID binding. Helper cleanup hooks are
deferred until the original caller and its pending acquisitions join.

The shared positive native guard covers callback, custom-promisify, synchronous
and lower-level spawn forms through setup, assertions and joined directory
cleanup. The final guard verification runs before restoration. Deliberately held
completion barriers register their releases with the closing caller.

The forged-receipt control first observes valid scratch authority, then plants a
source path in disposable roots and exercises the real sweep: no termination
occurs and independent receipt files remain. A source association belongs only
in optional `sourceCheckout`; it never permits scratch disposal to follow source.

Fake-Claude candidates retain the same private PID/birth proof. Their disposable
root is the actual allocated home, while source association and fresh observed
cwd select a process during authorized worktree removal. A matching cwd/argv
without its receipt grants no authority. The imported receipt owner captures
native opens before save/bind can reject. Save failure preserves structured
cause metadata after positive descriptor close and partial unlink; bind failure
keeps the descriptor/file until explicit owner cleanup. Close/remove rejection
still retains its real root/guard and the first attempt's outcomes.
