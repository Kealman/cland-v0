# hub/test/executor-lock-liveness.test.ts

Use the T1 scratch-files and injected-process-table seam for lock ownership.
Cancel both the injected retry wait and the default fake-clock timer, retaining
the other holder's bytes and checking the default timer is cleared. To prove
late acquisition, hold the filesystem link receipt after the real lock exists,
cancel, then release the receipt. Acquisition must remain joined until it has
released its own token; keep the final absent-lock/guard assertions and a
successful successor acquisition. Do not race cancellation against an unowned
acquisition promise and leave its late result detached.

These cases own file I/O only. Register their test-local `t.after` drain before
creating `scratchMachine`, whose later hook removes the directories. Abort and
unblock pending work, release fixture locks, join acquisition, then restore the
filesystem fault. A direct process-cleanup import requires a higher tier even
when only its generic cleanup callback is used.
