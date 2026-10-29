# web/test/items.test.ts

`web/test/items.test.ts` copies the fixed 24-item pinned corpus (excluding the seeded public release) into its disposable root before
starting `projectHub`, then observes the Items tree at 1440×900 in Headless Shell.
Deterministic additional rows retain stage groups, cell/proportional bars, rank
and ordinal facts, claims, holds, verdict rounds, category previews and archives.
CLI status mutations are fenced by the rendered changed row and ancestor meter;
the task keeps focus and selection when it moves. Folds, `D` and `A` persist in
browser-only preferences and are independent between contexts. A separate exact
300-item fixture asserts a completed `cland.items.rebuild` PerformanceMeasure
below 15 ms after a CLI delta: synchronous tree-model work only, excluding setup,
transport and React commit. The durable DOM assertions remain separate.
The test arms each affected ancestor observer before mutation, then retains its
final DOM assertion. It also checks verdict rounds after status/verdict deltas.
`web/test/items-order.test.ts` checks sibling ordering after a rank event followed
by ordinary rank/reparent file changes, using a separate seven-item scratch hub
with unchanged request/DOM bounds and authoritative sibling comparisons. The
separate 300-item fixture owns large-model coverage rather than adding an unrelated
full-tracker rescan to the ordering regression. The 300-item transition preserves every rebuild measure and compares
that buffer with an independently armed PerformanceObserver capture.

The copied snapshot's rendered receipts (including requested stage plans,
status/verdict deltas, folds and live claims/holds) have an explicit 15 s bound for loaded runners. Hold observers
are armed for **both** the task and ancestor before the mutation; the reply alone
never settles the assertion. Missing rows still fail at the bound. Other fixtures
keep the harness's 3 s default and the 300-item model keeps its 15 ms limit.
Diagnostics report copied file count, initial row elapsed time, claim/hold elapsed
time and synchronous model maximum/count. Elapsed row time includes transport,
scheduling and DOM commit; model time excludes those costs. The browser receives
open summaries initially, so the number of copied files is not its model size.
T-1419's Darwin two-worker CPU-load baseline copied 1,418 files but rebuilt only
98–99 initial summaries; a claim receipt took 3,269.9 ms with model work <=0.3 ms.
A subsequent two-worker CPU-load probe naturally reproduced the parent failure:
`First stage` plan hydration exceeded its 3 s row wait (intermediate run 9/10;
claims subtest 10/10). This identifies insufficient receipt headroom rather than
a multi-second model rebuild. Historical Linux hold timeouts remain the original
failure evidence; local evidence does not identify which Linux scheduler or hub
queue supplied its delay.

The copied-tracker verdict regression reports the `task.comment` result elapsed
separately from the rendered verdict row and synchronous model work. Request
elapsed includes the scratch hub queue, storage, transport and scheduling; it
does not attribute those costs individually. Compare model measures only for
the completed verdict transition, after clearing earlier status measurements.
The historic Linux `no result for task.comment within 5000ms` is a request-bound
failure; row-bound evidence alone cannot explain it. Load evidence names the
platform and distinguishes local repetitions from the ordinary Linux Web phase.

Only this fixture's verdict `task.comment` request uses a 15 s result bound;
the shared frame client's 5 s default remains unchanged. The verdict-row observer
is armed before the request and has its independent 15 s bound and final assertion.
T-1423's Darwin two-worker plus CPU baseline passed 10/10: requests ranged from
39.2 to 1,415.8 ms against verdict model maxima of 0.1–0.3 ms. The precise queue
or storage delay in the original Linux failure was not observed. A disposable
5.2 s pre-handler delay control reproduces the old request timeout; it is a
synthetic sensitivity check, not a natural Linux reproduction.

T-1440's temporary 100 ms diagnostic sampler is retained only in recorded probe
evidence (A-13703), not in the shipped test. The approved two-busy-worker probe
at f42e87fd9 retained five green parent runs and every semantic assertion;
raw baseline records include the first two incomplete diagnostic teardown runs.
Safety polling now reads changed paths only, without increasing any request or
rendered-row bound. Historic Linux 5 s attribution remains unobserved locally.
