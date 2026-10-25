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
