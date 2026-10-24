# hub/test/executor-spend.test.ts

Retirement preserves the legacy file in place and publishes `spend-retirement.json`
with its bytes beside the new ledger before activating retirement. Tests exercise
this boundary at T1 with injected hub responses, fake time and a scratch HOME/XDG
state directory (`hub/test/executor-spend.test.ts`); socket authentication and
command routing belong at T2. Never exercise this command against the human's
actual state. See [the operational contract](../../../hub/README.md#retiring-legacy-spend-write-through).
