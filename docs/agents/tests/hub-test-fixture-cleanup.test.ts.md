# hub/test/fixture-cleanup.test.ts

`hub/test/fixture-cleanup.test.ts` uses disposable roots and a positively guarded
fake-native context; no process launches. It plants an unlink failure after
teardown to observe the durable closure receipt, then executes one literal
alias from a scoped dry run. The alias disappears while its target stays.
Reallocation invalidates closure. Legacy aliases, account, host and suite roots
remain kept, including a planted live-descendant reference. This reference is
an injected observation, not a real process census.

`hub/test/fixture-cleanup-plan.test.ts` is T1, importing only the pure planner.
Its empty-census control never promotes an unproven root to eligible.

Run each with `node --test <file>` on supported Node. These are targeted
filesystem/planner checks, not historical deletion evidence.
