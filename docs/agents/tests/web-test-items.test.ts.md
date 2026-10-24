# web/test/items.test.ts

`web/test/items.test.ts` copies the tracker files into its disposable root before
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
copied-tracker fixture owns large-model coverage rather than adding an unrelated
full-tracker rescan to the ordering regression. The 300-item transition preserves every rebuild measure and compares
that buffer with an independently armed PerformanceObserver capture.
