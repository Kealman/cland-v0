# hub/test/tracker-component.test.ts

The hand-written-file sequential-id check arms `reindexedAfter` before writing
`T-7-by-hand.md`. Its exact-file `task-reindexed` receipt has a 15-second bound
(scaled by the harness load factor), allowing the healthy watch's 5-second safety
scan plus scheduling margin. Keep the public list and next-id assertions after
the receipt; a file write alone does not prove that indexing completed.

The hand-appended verdict and subscribed-UI title edit use the same pre-armed
receipt. The UI deletion uses `removedAfter`; retain its native task-event
assertion as well as the title and verdict assertions after reindexing.

Run this file through the sealed harness. For the T-1427 load check, run the
`task create writes an item file with the frontmatter and sequential ids` case
ten times in fresh processes, in two lanes with owned CPU load, and retain each
terminal test summary. Whole-file repetition covers the verdict and UI cases as
well. Stop the load worker and join every child before releasing
the granted local load slot. Linux evidence comes from same-head verification.
