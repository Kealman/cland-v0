---
id: T-1268
kind: task
title: "Capture T-1200's first production receipt: a branch adding a Web test file shows the 10-repetition count in its droplet verify"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1245
branch: t/T-1268-capture-t-1200-s-first-production
created: 2026-10-25T00:56:52.206Z
updated: 2026-10-30T14:46:17.297Z
closed: 2026-10-30T14:46:17.297Z
---

## Summary

T-1200 C2 (a new Web test file passes 10 repetitions at two workers under CPU load before ready, and verify reports the count) is proven by a synthetic diagnostic (`web/test/new.test.ts 10/10` inside suite-runner.test.ts, green in stage covers 8b0010a2 and 27e68fd5). No production receipt exists: since restart #54 no task branch has added a web/test file. Record the first real one.

## Acceptance criteria

- [x] C1. The first task branch that adds a web/test/*.test.ts file has a droplet verify log showing the 10-repetition count line for that file; its run id and artifact are recorded here, or a missing line is filed as a T-1200 regression.
  - done: impl-1268 · 2026-10-30T14:44:30.854Z
  - verified: rev-26 [reviewer] · run rev-20261030-1268-evidence-1 · 2026-10-30T14:46:10.613Z · commit dbb1dae9dd7f17fcca772e31ca6597a6efd8a876

## Comments

### impl-1268 · 2026-10-30T14:44:20.259Z

C1 production evidence recorded in A-14444 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14444-t-1268-real-droplet-web-repetition-receipts.md). First qualifying merged branch after T-1200 is T-1322: original run 3685d5eb-0d73-4929-831e-b8a178bccc54 / A-12269:18660 at b83556ee9f145950f843f1a3b84b0e7583e38c23 reports web/test/remote-via.test.ts 10/10 passed; workers 2; CPU load; attempted 10/10. Successor e82d2419-490b-4ec9-be8a-22866e4d3eb1 / A-12293:18728 at 5550ed2978f7f4971bf04582accd0d5a146d4cf4 confirms it. Additional real receipts: pairing 1f987d26-cd2e-453b-9484-e58c8764d848/A-12630:23128/fa4a485; remotes a8f5b988-869b-4619-8de7-54f3a91ece3f/A-12748:20399/c0d52d7; uploads 0c4d3438-2d0b-4110-b939-64fd27701f44/A-13223:21861/83d84d3; telegram-marks 97e665a6-32a9-461c-b0d0-bb19c5a317f6/A-13509:22547/ce5ddf8. Each exact file is A in Git diff from its dev merge-base; bases and full heads in artifact. Linux droplet execution confirmed through original platform/executor lines and matched retained verifier receipts. All count checks are report-only, not enforcement. A-12630 overall exit 1 is explicitly retained as failed; other named logs exit 0. No new test, source change or suite run: Coordinator decision 61ada4c1 authorizes retained evidence and evidence-only review/closure without merge.

### rev-26 · 2026-10-30T14:46:10.613Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1268-evidence-1
commit: dbb1dae9dd7f17fcca772e31ca6597a6efd8a876
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14450 evidence-only clear under Coordinator61ada4c1. Original successful T1322 A-12269/A-12293 ten whole-file repetitions/two workers/CPUload confirmed; Git new-file and first retained dev landing provenance checked. Other named counts confirmed; A-12630 whole suite stays failed, no enforcement/timing claim. C1verified. No source/newtest/newverify/merge; Coordinator closure only.

Criteria: C1 verified.

### coord · 2026-10-30T14:46:17.297Z

Closed without merge: C1 verified by rev-26 (A-14450) from original production receipts. T-1322's A-12269 and A-12293 show a real new Web file (remote-via.test.ts) passing 10/10 at two workers under CPU load on a branch verify, with git new-file provenance. Further receipts are pairing (A-12630, whose whole run failed), remotes (A-12748), telegram-marks (A-13509) and uploads (A-13223). The repetition gate remains report-only. Evidence bundle A-14444.
