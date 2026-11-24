# hub/test/test-lint-worker.test.ts

`hub/test/test-lint-worker.test.ts` is T3 because it launches real analysis
children and observes native close before accepting facts. It launches no Git,
network, browser or hub process. A disposable parent fixture uses the shared
environment builder and suite-style preload with `NODE_OPTIONS=8192 MiB` to
assert the child's effective `heap_size_limit` is at most 320 MiB. The connected
control hub does not execute branch code.

The test checks a positive child pid, foreground timer activity while
analysis runs, a 1000 ms maximum observed timer gap during that interval, and
identical cold and child-seeded admission findings. Child startup is outside
the responsiveness measurement; completion samples the final span after the
last tick. A deterministic terminal-stall negative control checks that span.
The shared whole-case owner is installed before launch, separately bounds
startup and completion, stops and joins the child on TestContext cancellation,
and keeps the interval until native close. Cancellation and a throwing started
observer have real-child controls; callback failures retain their original
error through termination. Heap telemetry samples used isolate heap after
each file; it does not measure process RSS or all transient allocation peaks.
The explicit 256 MiB old-generation and 16 MiB semi-space flags bound V8's total
heap to 320 MiB or less; external memory and process RSS are separate.
Fake-native controls cover early launch failure and bounded SIGTERM/SIGKILL
escalation without losing native error/exit metadata. Startup, completion and
close observations each have named load-scaled test bounds.
The parent fixture reports nested native close explicitly; parent escalation
waits for that receipt. A rejected-close control exercises the real directory
removal guard, retains its root and forbids escalation before the receipt,
then retries cleanup and removal after the receipt is published. Parent-root
acquisition has a separate named setup bound.

The T1 companion `test-lint-warmer.test.ts` uses a fake clock to prove five-move
debounce, serial passes, retry eligibility after failure, and joined shutdown
that discards pending requests. `suite-admission-cost.test.ts` injects an
in-process analyzer so its fake Git never reaches a native child; it also proves
warmer shutdown cancels and joins the active analysis owner.
That shutdown case enrolls its whole callback before setup and retains a
success-only close guard on the shared root through cancellation.
