# nvim/test/launcher-input-load.test.ts

T4 identity: `launcher Insert receipt holds 20/20 under parallel load`. Runs the
same failed/empty model-answer case as `launcher-component.test.ts` twenty times,
in ten parallel batches of two. Each child owns its sealed headless Neovim and
recorded stdio stub through the ordinary fixture. Each case asserts two native
`TextChangedI` notifications, the rendered one-line reasons, no popup and both
exact outbound launch models. The parent requires twenty completed cases and
forty model-input receipts; a missing receipt or failed child fails the guard.

`hub/test/tiers.json` maps the launcher component and shared model fixture to
this guard. A mode-free task verify runs it once on its admitted executor; C1
requires a Linux droplet result at the reviewed head. T4 repetitions are excluded
from the load gate, so the one guard invocation supplies exactly twenty cases.
T4 has no tier budget, but the separate 5 s new-identity gate still applies in
report mode. Run `69adb5aa` at `1bee70f9` (A-11758, Linux x64 c-8 lon1) passed the
parent in 7.12978769 s and every child without skips; it failed only that generic
gate. The dated E-1282 allowance records 11 s (1.5 times that passing sample,
rounded upward to whole seconds as directed by the Coordinator). It does not relax the input bound or reduce
the twenty cases.
Do not run this stress guard by hand alongside other work; use suite capacity.
No browser, native harness or real hub process is part of this seam.
