# hub/test/suite-log-backfill.test.ts

`node --test hub/test/suite-log-backfill.test.ts` uses disposable stores, native
large log files and scripted executor receipts. It launches no worker or browser.
The retained-proof case checks one sequential stream per source and zero whole
reads. The stage/cache case uses three 20 MB logs and six concurrent admissions,
retaining the two-source-scan, persisted-identity and 96 MiB heap-growth limits.
Setup is separately bounded by `caseDeadlines`; the full stage/cache operation
remains registered through fixture drainage. After concurrent cache admission,
advance the fake scheduler once before awaiting the exact reported receipts;
a start acknowledgement alone does not prove publication. The 50 MB output and
shard case retains a full streaming hash comparison and bounded heap/stream checks.
