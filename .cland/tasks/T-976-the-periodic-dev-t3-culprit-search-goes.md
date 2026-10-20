---
id: T-976
kind: task
title: "The periodic dev T3 culprit search goes inconclusive on old trees: it applies the live hub's lints to pre-change manifests and can't place files new in the range"
state: open
status: backlog
size: M
labels:
  - needs-triage
  - bug
  - hub
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T15:39:04.758Z
updated: 2026-10-20T15:39:04.758Z
---

## Summary

On 2026-10-20 two culprit searches lost files to the search mechanics rather than to the code under test:
- **Search for b5fc792c:** `fixture-orphans-lifecycle.test.ts` ended inconclusive ("unknown explicit hub shard file", because the file is new inside the range); `scenarios/droplet-verify.test.ts` ended inconclusive ("verify-tiers: duration key has no matching test identity: …demo stop confirms an earlier delete…", the stale key T-956 later removed).
- **Search for cfd6761e:** all four failing files ended inconclusive the same way. Every probe at an older head ran the live hub's T-956 identity lint against that head's manifest.
- **doctor-isolation:** pinned to T-955, which changes only role-clause test files. That points to a probe outcome that depends on a racy test without a repeat. T-965 later removed the race.

## What to build

- A probe at an older head validates manifests with the rules that applied at that head, or skips manifest lint for probe-only runs and says so.
- A failing file that doesn't exist at an older head counts as absent, so the search places it at its first-appearance commit.
- A culprit verdict needs a repeated red/green pair at the boundary before it files a bug.

## Acceptance criteria

- [ ] C1. A T2 test with a fake history shows a stale duration key at an older head no longer makes a probe inconclusive.
- [ ] C2. A file introduced inside the range is placed at its introducing commit.
- [ ] C3. A boundary that flips on repetition is reported as inconclusive (flaky), not filed against a culprit.
