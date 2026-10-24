# hub/test/account-fixture-env.test.ts

The executor isolation proof poisons ambient HOME, XDG state and the explicit
executor override with scratch-owned ledgers. Snapshot the hostile HOME before
starting `projectHub` with an injected provider and fake clock.
Seed its fixture ledger with a pruned record for this root to prove hub startup
re-registers it and clears the prune record. Wait for the
`executor-sweep` completion event, then observe `executor.status`'s fixture path
and its durable registration. Stop the hub before taking the final hostile HOME
snapshot and restoring ambient variables. Every inherited ledger stays unchanged;
all executor writes belong to the project's `.cland/executor-state`.
