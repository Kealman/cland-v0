# hub/test/item-summary.test.ts

`item-summary.test.ts` also proves card verdict reasons/rounds/scopes, Decision
previews and agents' text outlines through snapshots and mutation deltas, without
body/comment reads. Closing a task removes its row from the open snapshot; its final delta still
carries the compact closed row. Closing other rows removes card facts from their
snapshot and delta; a bounded by-id page restores them without a body/comment payload. Scoped
verdict history must not emit posted-verdict notifications on close/reopen; the
frame regression retains one genuine new-verdict subscription delivery. The
copied-live boundary asserts its measured items size at or below 50% of 1 MiB. Stage summaries and cover-settlement deltas retain complete
merged/total/status counts; closed tasks without landing receipts do not count
as merged. `progress-counts-component.test.ts` renders unloaded closed stage
members in the plan, explorer and card, then observes a stage-count delta. The
thousand-item startup guard includes card facts and preserves both the eight
reply budgets and the full 1 MiB items-snapshot cap.

`item-summary.test.ts` exercises summaries, provenance, roll-ups, claims/holds,
verdicts, topic activity and bounded closed-text pages through `projectHub` frames
at T2. It also retains the stage-only delta on platform-cover settlement and
checks next through closed-ancestor reopening and reparenting. The ordinary
mutation assertion retains only changed task/ancestor deltas; existing
logger diagnostics record which rows were recomputed. `item-summary-scale.test.ts`
uses 1,000 durable rows and bounds their three-row recomputation at 100 ms,
excluding setup, I/O, transport and freshness probes. This is a local synchronous
measurement, not a whole-request latency claim. T-1038's eight startup byte guards
remain in `startup-replies-scale.test.ts`.


`item-summary.test.ts` tests parent cursors, limits, closed-ancestor retention and
the close-delta/open-set boundary through public frames. The recorded stdio stub
returns every closed kind on parent pages as well; its
legacy full-list scenarios retain closed container and question identities through
archive replacement. Its summary mode retains open rows and their ancestor
chain, including closed legacy parents. The many-closed-container forest asserts
a first-item reply at or below 120 KiB independently of task density,
complete release roll-ups, bounded container pages and nested task retrieval. A second client that
has never fetched closed pages observes an unloaded closed task's removal and
its authoritative done total, then compares a fresh snapshot. `nvim/test/closed-pages.test.ts`
copies the live tracker into a disposable project and renders 105 paged closed
children in a real headless explorer, board and card. It also keeps release counts
while a closed epic is unloaded, unfolds that epic and recursively discovers a
closed release/epic/task archive without duplicate identities. It is T3 for the real client
boundary. `web/test/items.test.ts` observes a 105-child page continuation, close
delta and reload through the real browser. Its separate 105-closed-epic fixture
asserts release progress before loading, container cursor continuation, nested
closed tasks, archived roots and unique rows after reload. A D-hidden regression holds closed
rows unloaded while asserting stage merged/state and global done totals, then
reopens a closed child and retains the final fraction/state assertions. New closed-page screen frames can be
recorded by naming their individual component file; regenerate existing Neovim
protocol/live fixtures with `npm run test:nvim-fixtures -- --from-recordings`.
