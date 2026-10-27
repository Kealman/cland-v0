# hub/test/verdict-commit.test.ts

Arm `reindexedAfter` before each external edit in the provenance regressions.
It waits for a new `task-reindexed` log record for that exact filename, excluding
startup and previous edits, before checking CLI view/list projections. Retain
the restart checks and the final exact source, writer and outcome assertions:
a copied clear verdict must remain file-only after the later hub not-clear.
CLI startup and a successful write are not re-index receipts.

Native hubs remain necessary here for filesystem watcher and restart recovery.
The shared harness condition deadline bounds missing receipts without imposing
a machine-speed promise on the watcher.
