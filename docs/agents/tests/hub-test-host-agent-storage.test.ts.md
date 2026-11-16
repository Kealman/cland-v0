# hub/test/host-agent-storage.test.ts

T1 uses a controlled filesystem boundary, without importing native process
observation or starting children. Run one file with
`node --test hub/test/host-agent-storage.test.ts`.

`overlapping checkpoints publish complete snapshots in rename completion order`
holds the first sync while a second write publishes. The old shared `.new`
algorithm fails deterministically when the first writer renames the missing
source. The completed second snapshot and the final first snapshot are checked
independently, so the last completed publication wins.

The remaining cases preserve the missing-parent error without recreating a
released root, require failed-sync cleanup after descriptor closure, and prove
that background recovery removes only pid-tagged temps with positive writer-exit evidence.
Live and unknown writers, committed JSON and legacy `.new` files remain intact.
The historical `processes.json.new` open failure is distinct from the reproduced
rename collision; a storage-level missing-parent control does not identify its
original late producer.

Recovery streams directory handles with buffers of 32 entries, yields after
each 32 visited entries, and observes at most 32 candidate PIDs per batch. Its
single pass starts on a scheduled continuation after agent readiness. The
10,000-entry retained-result fixture checks that the first turn reads only 32
entries; closing during the yield joins the iterator and reads no next entry.
Exact external `applied.json` and `restart-result.json` temps are included,
without traversing code generations or deleting unrelated basenames. Missing
directories are tolerated, and symlink directories are not followed.
