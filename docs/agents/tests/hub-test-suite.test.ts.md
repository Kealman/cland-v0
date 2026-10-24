# hub/test/suite.test.ts

This T3 file proves the real local worker boundary in sealed disposable projects.
For task/batch cadence, retain the recorded `executions` file assertion after the
durable worker result: a batch runs check before unit/integration commands.
Assert the emitted T0 exit and duration receipt as well as runtime tier receipts.
Keep the failure case proving that a red check stops the tests. Pure admission
permutations belong in `verification-commands.test.ts`.
