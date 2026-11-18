T-1671: Replace the pending forward-recovery note with durable Codex/OpenCode
generation receipts, rollback checkpoint preservation and conservative handling
of missing or mismatched state. The captured observer remains the current-lifetime
fast path; no role or command changes.

Source review corrections: baseline recovery preserves exact Host identities
without native scope selection/allocation. Durable acknowledgement clears only
completed recovery cache entries; pending/rejected work remains owned. The
all-fake Sessions/SQLite reopen cases are T2, per Coordinator decision c1aff916.
