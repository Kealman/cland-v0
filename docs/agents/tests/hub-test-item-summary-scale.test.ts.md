# hub/test/item-summary-scale.test.ts

Startup explorer regressions use `item-summary-scale.test.ts` at T2: a thousand
durable rows with a planned epic and retained verdicts count recompute batches.
The serving case arms the existing task-write gate before startup, observes the
listening and serving receipts separately, and keeps an unscaled two-second
monotonic gap assertion. It then observes the held planned write, proves a status
reply while it is held, releases it and observes the planned status. Fixture
setup has its own bound. No real daemon or browser is needed. The diagnostic
`hub/scripts/measure-startup.ts` copies durable live inputs into a sealed scratch
root; its measurements are diagnostic evidence, not a suite receipt.
