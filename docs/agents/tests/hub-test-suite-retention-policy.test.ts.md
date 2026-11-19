# hub/test/suite-retention-policy.test.ts

Pure T1 tests cover per-occasion recency, explicit references and unsettled runs.
Report classification also exercises the fixed seven-day floor, including its
exact boundary, unknown completion dates and future dates.
They import no native execution module. Run with `node --test hub/test/suite-retention-policy.test.ts`.
