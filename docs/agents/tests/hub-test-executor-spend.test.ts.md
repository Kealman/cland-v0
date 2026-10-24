# hub/test/executor-spend.test.ts

Registration and registry sweeps use T1 scratch HOME/XDG state, a fake clock and
injected process identities. Refuse `/`, HOME (including aliases), ordinary
directories, files, missing paths and relative paths before writing a ledger;
canonical project aliases register once. Rename a writer-free registered directory
away, sweep, advance fake time, restore and remove it again to prove the 24-hour
grace resets. Recreate the executor for each sweep to prove persisted recovery.
Restore it again after pruning to prove ownership scans resume before cleanup.
Observe the published primary and legacy `projects` lists and the
`executor-project-pruned` event; retained spend remains reserved. An injected
EACCES defers rather than pruning. No provider operation is needed.
Seed invalid roots in the legacy ledger to prove the same validation removes
existing registrations immediately, with a prune event and retained accounting.
An initialised project with config but no hub discovery/lock survives sweeps past
the missing-root grace; hub presence is never a registration validity condition.

Retirement preserves the legacy file in place and publishes `spend-retirement.json`
with its bytes beside the new ledger before activating retirement. Tests exercise
this boundary at T1 with injected hub responses, fake time and a scratch HOME/XDG
state directory (`hub/test/executor-spend.test.ts`); socket authentication and
command routing belong at T2. Never exercise this command against the human's
actual state. See [the operational contract](../../../hub/README.md#retiring-legacy-spend-write-through).
