T-1702: update territory subsystem guidance: receive-pack joins bounded lock backoff for up to 30 seconds; merge retains immediate contention refusal. Lease and native-close fences remain.

Batch regression correction: checkpoint add/relaunch/removal ownership under short territory critical sections; run Host/watch joins outside the lock and revalidate before finalization. Removing rows fence concurrent admissions and retain changed state.

Contention follow-up: both checkpoint admissions join legitimate receives with the shared32second backoff; already-locked callers refuse immediately. Preserve the receive30second cap and the real receive/preflight regression.

Source-review corrections centralize all checkout checkpoints, including public relaunch admission, in the same bounded/unlocked policy. Revalidate task eligibility after lock acquisition and after final asynchronous prune observations; preserve reopened or replaced ownership. Deliberately migrate the independent frozen worktree help consumer.
