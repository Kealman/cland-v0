# hub/test/nvim-frame-refresh.test.ts

`hub/test/nvim-frame-refresh.test.ts` is T1: in-memory catalogs, capture results
and TAP completion receipts, with no child processes or live hub. Run it with
`node --test hub/test/nvim-frame-refresh.test.ts`.

The concurrent-target regression simulates coalesced requests from two completed
targets. It checks publication with fewer distinct frames in full and retained
refreshes, with and without prior slices. Completion requires a successful exit,
positive tests equal to passed tests and explicit zero fail/cancelled/skipped/TODO
counts. A skipped file, one skipped test, absent or incomplete receipt, empty
capture or empty discovery prevents publication; stored catalogs and slices stay
unchanged. These tests do not run the expensive Neovim consumers or establish
live protocol correctness; `nvim/test/scenarios/workbench.test.ts` owns that proof.

The deterministic card regression uses the shared whole-sequence owner with
in-memory capture and publication. It compares catalog and slice bytes with zero
and two optional selections (`R-1`, `T-654`). Previously every requested card
appended a recording, so selection debounce and coalescing changed the catalog.
The recorder eagerly captures each scenario context's cards and criteria,
deduplicates their keys, and refuses an optional card outside that captured set.
The work-count assertion permits two producer calls per item on the first
context and none when an equal context is observed again. No wall-clock bound
or native process is needed for this regression.

The transient-control regression records a valid control-set context before any
card demand, including states replaced before a selection request arrives.
Invalid scenario setup remains accepted by control and fails at the ordinary
projection boundary, preserving the existing projection fault-injection cases.
The append-failure regression injects refusal at both the first and second
record writes. The original exception must escape control capture, fence later
operations, and prevent refresh publication even if its caller catches it.
It also injects failure while the context reader records config: the deferred
catch rechecks the recorder's own write-failure receipt before accepting an
invalid projection, so a nested append failure escapes the original call.

The maintenance command's full replay remains the integration check: run
`npm run test:nvim-fixtures` twice and compare the catalog, all slices, and
`live-protocol-frames.json` after each successful complete run.
