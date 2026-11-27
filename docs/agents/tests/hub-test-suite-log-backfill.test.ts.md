# hub/test/suite-log-backfill.test.ts

The interrupted-child case uses actual child finalization, aggregate copy/rename
and parent finalization. Two children supply native 137 and unknown disclosures;
both remain attributed by their shard headers after two aggregation attempts
and two parent finalization retries each. It keeps exactly one marker per child
and one parent provenance footer. Setup and behaviour are separately bounded,
and directory removal joins the owned pipelines first.

`node --test hub/test/suite-log-backfill.test.ts` uses disposable stores, native
large log files and scripted executor receipts. It launches no worker or browser.
The retained-proof case checks one sequential stream per source and zero whole
reads. The stage/cache case uses three 20 MB logs and six concurrent admissions,
retaining the two-source-scan, persisted-identity and 96 MiB heap-growth limits.
Its semantic droplet executor supplies Linux stage receipts on every host; the
single-slot fixture records the whole-stage fallback and never creates a native
worker or real provider resource. This preserves both eligible stage evidence
and executor/OS matching for subsequent epic cache lookups on Linux and macOS.
Setup is separately bounded by `caseDeadlines`; the full stage/cache operation
remains registered through fixture drainage. After concurrent cache admission,
advance the fake scheduler once before awaiting the exact reported receipts;
a start acknowledgement alone does not prove publication. The 50 MB output and
shard case retains a full streaming hash comparison and bounded heap/stream checks.

The stall-census case passes 32 pid/name entries followed by 40 noise lines
through `readSuiteEvidence`, then the capped publication's priority summary.
It checks the complete JSON fact survives and the summary points to its log.
The command-only variant omits the census, proving the pre-inspection exit/EOF
record and capped pointer survive the same streaming reduction and later noise.
