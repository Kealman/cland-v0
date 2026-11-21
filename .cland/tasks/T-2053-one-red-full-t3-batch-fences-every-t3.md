---
id: T-2053
kind: task
title: One red full-T3 batch fences every T3 file from the next batch's load-gate baseline, so that batch repeats every identity and times out at 75 min
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-21T09:44:13.651Z
updated: 2026-11-21T09:44:13.651Z
---

## Summary

On 2026-11-21, T-2046's batch 33dcd1f7 was red: 6 failures, a full T3 selection, dropped at 08:19Z. The next batch, d98b2a8d with T-1981 alone (run becd21cf), chose `load gate baselines T3=33dcd1f7`. It reported `repeated identities unknown (confirmed complete 819; completion unknown 5)`, where earlier batches repeated 1 or 2. Both shards hit `run timeout 75m` with no attributable failure, and the hub held the batch as inconclusive.

The cause is in `#readBatchIdentities` (`hub/src/hub/suites.ts`, about lines 1048–1082). A later red receipt "fences" every file it ran ("never resurrect its older proof") and contributes no identities. So a red full-T3 batch removes all T3 files from the baseline, and the next batch treats every T3 identity as unmeasured and repeats it five times. One red batch stalls the merge queue until a newer green integrated receipt exists.

## What to build

A red receipt fences only the files whose identities failed, or failed to complete. Its passing files still contribute their identities. A file with a failed identity keeps its older green proof fenced.

## Acceptance criteria

- [ ] C1. After a red full-T3 batch with one failing file, the next batch's baseline treats that file as unmeasured and every other T3 file as measured from the red run's passing identities (test, red before).
- [ ] C2. A file whose identity failed or didn't complete in the red run is not resurrected from an older green receipt (test).

Evidence: A-22454 and A-22457 (batch d98b2a8d / run becd21cf); 33dcd1f7 (A-22420). Workaround on 2026-11-21: a green Linux stage cover on dev (695cb540) gives the next batch a green baseline.
