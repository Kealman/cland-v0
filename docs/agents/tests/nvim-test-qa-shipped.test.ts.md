# nvim/test/qa-shipped.test.ts

`nvim/test/qa-shipped.test.ts` is the T4 walk of the curated shipped QA catalogue:
every case runs through `cland --headless --qa` against a real CLI, a real Neovim and
the fixture hubs, and must exit 0 with a PASS line. The catalogue is the `CATALOGUE`
list: one case per line, grouped by feature (artifacts, explorer, graph, items,
panels, thread) and ascending within a group. A case added by another item changes
its own feature's lines only, so two items that each add a different case merge
without rewriting one long line (T-1020, the conflicts ARTIFACT-001, PANELS-017 and
PANELS-018 caused on 2026-10-20). Two additions inside one feature group still meet
at that group's insertion point; that is a one-line resolution, not a reformat.

The file keeps only the walk. The layout and the set are guarded at T1 in
[`hub/test/qa-shipped-catalogue.test.ts`](../../../hub/test/qa-shipped-catalogue.test.ts),
which reads repository files only: each catalogue case is alone on its own line,
listed once, with its `qa/cases/<ID>.lua` present, and every case is registered
through the one catalogue loop. That guard runs in every T1 batch, so a catalogue
that regresses to one line fails there by case name rather than at the next merge
conflict. The scratch Git merge that proves two branches adding different cases
combine cleanly is task evidence in the item topic (T-1020, A-10628), not a test:
it needs a real Git repository and belongs to no permanent tier. The walk's test
names are unchanged, so `hub/test/durations.json` keeps its per-case budgets.
