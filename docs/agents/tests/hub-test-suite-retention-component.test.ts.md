# hub/test/suite-retention-component.test.ts

Unindexed controls explicitly exercise report and disposable deletion modes.
They require positive index absence and the newest bounded-inventory mtime past
the floor, preserve indexed/referenced/pinned/young roots and a fresh file inside
an old root, retain a depth-over-budget tree, and assert reason-class counts.
Explicit report mode preserves every directory and claims none; the production
default deletes under the human's one-off rule 27 exception. Inventory byte
size and non-directory entry counts have independent literal expectations.

C6 arms the native rename observer before triggering the real guarded owner,
rewrites a nested file after inventory and rename while root mtime is unchanged,
then requires the restored original root to contain the rewritten bytes and
zero removals. The shared bounded inventory reader is used before rename and
again immediately before removal; this is conservative revalidation, not a
native-writer closure receipt.

Disposable filesystem checks exercise the production suite removal owner, missing
artifacts, reference preservation, tombstone recovery, symlink refusal, shared
admission work, coverage pointers and duration source artifacts. The recovery
cases preserve real map bytes through an interrupted native removal and reject
a missing artifact against the persisted complete requirement set. Report mode
leaves every directory intact. Directory-link and final-file-link receipt controls
independently preserve external receipt bytes and the original/tombstone marker.
Whole cases and manual seams use retentionCase's positive resource-closure fence
before acquisition through original-work/resource cleanup. No provider or
native process is launched. Run with `node --test hub/test/suite-retention-component.test.ts`.
