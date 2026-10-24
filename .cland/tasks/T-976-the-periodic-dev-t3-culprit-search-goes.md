---
id: T-976
kind: task
title: "The periodic dev T3 culprit search goes inconclusive on old trees: it applies the live hub's lints to pre-change manifests and can't place files new in the range"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - bug
  - hub
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-984
branch: t/T-976-the-periodic-dev-t3-culprit-search-goes
created: 2026-10-20T15:39:04.758Z
updated: 2026-10-24T12:56:39.129Z
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

- [x] C1. A T2 test with a fake history shows a stale duration key at an older head no longer makes a probe inconclusive.
  - done: impl-976 · 2026-10-24T12:56:38.504Z
- [x] C2. A file introduced inside the range is placed at its introducing commit.
  - done: impl-976 · 2026-10-24T12:56:38.701Z
- [x] C3. A boundary that flips on repetition is reported as inconclusive (flaky), not filed against a culprit.
  - done: impl-976 · 2026-10-24T12:56:39.013Z

## Comments

### coord · 2026-10-20T19:51:17.588Z

Another data point, 2026-10-20 19:51Z (search for periodic run 8777e86b): the last-green rerun 5cc2e460 at 9ae9a20b passed 20/20 but had 3 platform skips (needs macOS sandbox-exec on Linux), and the search classified it 'inconclusive (file has nonpassing execution receipts)'. A known platform skip that is identical at both ends should not make a passing receipt nonpassing; otherwise every nvim/test/qa.test.ts culprit search on Linux ends inconclusive. The actual culprits here were T-999 and T-1007, fixed by T-1027.

### impl-976 · 2026-10-24T12:50:02.360Z

Test-first progress: C1 T2 reproduced `duration key has no matching test identity: hub/test/example.test.ts::removed old test`, then passed after probe-only hosting lint/tier-projection bypass (candidate commands retained and logged). C2 T2 fake three-merge history now passes with explicit pinned-tree absence receipts and no executor acquisition on absent commits. C3 boundary-pair repetition next; no real droplets or native Git in these fixture histories. Read A-10828 and reruns A-10833/10840/10843/10846 read-only: merge-policy red at 2306692 and 8644953, green receipts at 89e5c30/69b3dc7; no claim about an unobserved culprit.
