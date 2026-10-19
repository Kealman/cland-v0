---
id: T-824
kind: task
title: Measure the median task-run body over the first 20 droplet task runs after T-713
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-human
assignee: null
parent: E-678
blocked_by:
  - T-713
topic: topic-603
branch: t/T-824-measure-the-median-task-run-body-over
created: 2026-10-19T01:56:44.318Z
updated: 2026-10-19T15:25:53.645Z
closed: 2026-10-19T15:25:53.645Z
---

## Summary

The post-merge measurement split from T-713's C5: after T-713 lands, the median task-run body (check through collection) over the first 20 droplet task runs must be 8 minutes or less on c-8 at workers 2. It's measured from live run results, so it can only be verified after T-713 merges and a hub restart puts it live.

## Acceptance criteria

- [x] C1. The median task-run body over the first 20 droplet task runs after T-713 went live is measured against the 8-minute target on c-8 at workers 2; the run ids, per-run bodies and the median are recorded on this item (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).
  - done: impl-824 · 2026-10-19T15:24:46.988Z
  - verified: rev-31 [reviewer] · run rev-20261019-824-final-d65 · 2026-10-19T15:25:30.549Z · commit 998f417800d017b856c3ec7d5418a83e3a33b86d

## Comments

### impl-824 · 2026-10-19T14:54:38.336Z

Measurement published as A-6104: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6104-t-824-first-20-task-runs-median-775-045-s-target-unmet/report.md (topic-603). C1 remains unchecked per Coordinator decision 6c760996-f8d7-443c-a67d-4a24f36bc5a9: negative result, median remote body 775.045 s (12m55.045s) > 480 s by 295.045 s. Sorted middle values are 774.59 and 775.50 s; mean = 775.045 s. Separate admission→original-artifact-publication upper-envelope median = 885.970 s, from middle values 885.811 and 886.129 s.

First 20 uncached item-bound droplet runs after restart #17 (2026-10-19 04:23Z), by admission; all Linux c-8 lon1 / configured workers 2. Failed attempts and retries included. Body is the decimal seconds from the single remote `suite duration …s;` line; phase shard durations are already inside it, and load-gate extra wall is retained. Host check and remote artifact collection/publication sit outside the remote runner duration; report documents the exact boundary limitation and Coordinator's accepted operational metric. Full table, log line excerpts with source numbers, SHA-256 hashes, job provenance, cohort exclusions, hub events and reproducible read-only calculation are in A-6104.

| # | Run id | Log | Remote body s |
|---:|---|---|---:|
|1|2054257a-e0eb-4820-b734-ea331c8f565e|A-5773|935.85|
|2|d0a9d4cf-24d8-4731-9b56-af37f4fe31b3|A-5781|740.61|
|3|4ab2f1c5-8f2a-4174-8505-e8696d4cf463|A-5783|770.97|
|4|95385b26-5706-4573-9f9b-e70c3b428322|A-5791|743.83|
|5|baec0a97-56d7-4274-931e-cf1060b4cb8b|A-5804|774.59|
|6|619a0281-3139-42fe-9b4c-c9029efd8bab|A-5800|222.94|
|7|7a02ff65-1022-409b-a463-8bd0e701c838|A-5807|964.02|
|8|3a6c15a8-f1ed-4cf0-84be-f4447c20f3fd|A-5825|468.37|
|9|6457fd3e-8e1e-4bc8-b6ee-3268ba920030|A-5830|829.28|
|10|42ec3216-1705-41cb-9099-275b7a2b3c86|A-5834|918.05|
|11|af90d071-2d02-4032-8b88-6a19170aaaed|A-5847|737.88|
|12|44d98f8e-67f5-46ef-ad00-d576426f4edb|A-5851|764.92|
|13|8a94e492-d909-4d91-8810-142d080ae896|A-5849|528.49|
|14|52d0fbf4-db76-45ad-ba93-c1a3618d2721|A-5853|775.50|
|15|a8c8b509-8ae9-427d-a75b-878ff441f4b1|A-5855|807.92|
|16|1e761e0d-31ff-49ef-a9c3-b91091034045|A-5857|497.93|
|17|f98bda87-27de-4ddd-b5e5-46e4070896ae|A-5865|800.19|
|18|aab19490-ba38-462e-a356-1d60d75e90d6|A-5881|805.57|
|19|7cd65196-f12f-47e8-aa68-bd7ef4600f44|A-5887|842.28|
|20|55f25e6c-a554-4db1-98ef-dcd86ac4a21e|A-5894|950.57|

No code changes or new suite runs. Evidence arithmetic review requested from Reviewer.

### rev-31 · 2026-10-19T14:57:20.107Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-824-evidence
commit: 998f417800d017b856c3ec7d5418a83e3a33b86d
scope: evidence
findings: [{"severity":"medium","text":"C1 outcome unmet: the independently confirmed first-20 remote-body median is 775.045s, exceeding the required480s by295.045s. Evidence/arithmetic is accurate; this is a negative measured result rather than an evidence defect.","file":".cland/artifacts/A-6104-t-824-first-20-task-runs-median-775-045-s-target-unmet/report.md","line":3}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6114 confirms evidence accuracy. Read-only durable job-history selection exactly matches all20 cohort ids, includes both failed attempts and retries, excludes occasions/child shards/cache hits and correctly identifies the next eligible run. All20 original artifact hashes, single suite-duration lines/numbers and admission→original-artifact operands match runs.json; Linux c-8/workers2 provenance confirmed. Decimal middle values774.59/775.50 produce775.045s; upper-envelope middle values885.811/886.129 produce885.970s. Primary Coordinator6c760996 accepts the operational remote-body metric and separate upper envelope, with host-check/publication boundary limitation disclosed. C1 is unmet, left unchecked and not verified; task verdict not clear reflects the failed480s target, not faulty evidence. No code changes or Reviewer suite runs; no replacement cohort/rerun needed.

Criteria: C1 failed (First20 eligible droplet task runs have median775.045s > required480s; arithmetic and cohort confirmed. C1 remains unchecked/unverified.).

### rev-31 · 2026-10-19T15:25:30.549Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-824-final-d65
commit: 998f417800d017b856c3ec7d5418a83e3a33b86d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear under revised C1/D65; A-6145 records the acceptance change and unchanged negative measurement. Independently read Coordinator045385a5/current criterion: measure and record against target, carry miss to v0.2 E-880; achieving480s is no longer this item's gate. A-6104/A-6114 independently audited first20 cohort, original hashes/duration lines and provenance remain unchanged. Median775.045s from774.59/775.50; miss295.045s (61.468%) retained. Separate admission→artifact median885.970s from885.811/886.129; remote-body versus literal host-check/collection timing limitation disclosed. Revised C1 verified because measurement/table/comparison are recorded, not because target was reached. Supersedes rev-20261019-824-evidence's old-gate not-clear outcome without changing evidence or running suites. No remaining findings under current scope.

Criteria: C1 verified.

### coord · 2026-10-19T15:25:53.645Z

Merged 0ae8402af0ac6857db15e3abfbfd45062f9cfeb2 onto dev.
