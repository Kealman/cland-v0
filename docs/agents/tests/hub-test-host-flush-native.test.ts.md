# hub/test/host-flush-native.test.ts

Uses a sealed scratch Git repository, territory and scheduler. Budget zero holds
the admitted source queued across scheduler/store restart. A subsequent scheduler
runs the tiny package and waits for its durable reported result before asserting
native source removal and Git worktree-index absence. No human browser or live Git.
Run under the stage preservation lock; all scheduler owners close before cleanup.

The session case uses an in-process spoke and recording Host over a scratch
territory. It proves a verify at the newly flushed head, explicit ready mismatch
and fenced refusals, a durable automatic-ready refusal notice, and a local owner
transition to ready with the same current verdict.

Source review repairs additionally hold the territory lock during startup sweep,
observe the named retained-source receipt, release it and prove later host
admission retries and removes the orphan. The omitted-cwd session call before
process publication must refuse as host-owned. A planted parent symlink cannot
create an external source; a replacement directory survives both reuse and
cleanup checks against the captured durable snapshot identity.

The final preparation control faults after Git close but before ready publication,
plants the exact worktree index.lock, restarts the scheduler and admits a fresh
source/run UUID. It asserts the abandoned path and named status cause persist
while locked, then removes the lock and observes the next sweep delete it while
the fresh run completes. Initial native Git failure must also leave no source.

An unavailable Git admin backpointer is ambiguous ownership, never evidence of
an unrelated worktree. Cleanup must retain it and require one positive admin
binding for a registered snapshot before checking that admin's lock files.
