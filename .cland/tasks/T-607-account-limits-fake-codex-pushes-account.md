---
id: T-607
kind: task
title: account-limits "fake Codex pushes account windows and sparse per-model updates while reads are held" counts 6 where 4 are expected on a loaded Mac
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: E-952
blocked_by: []
topic: topic-718
branch: t/T-607-account-limits-fake-codex-pushes-account
created: 2026-10-16T12:29:35.335Z
updated: 2026-10-20T10:14:07.252Z
closed: 2026-10-20T10:14:07.252Z
---

## Summary

The v0.1.3 macOS release run dbf1b763 at 0e2a0aee (A-3904, darwin arm64, peak load 13.3) failed hub/test/account-limits.test.ts, "fake Codex pushes account windows and sparse per-model updates while reads are held", with `6 !== 4` after 2.17 s. The droplet release run c01507ab at the same head passed it. It looks like a count that depends on timing under load: extra pushes are observed while the reads are held.

## Acceptance criteria

- [x] C1. Every write of the Codex rate-limits fixture is atomic (same-directory temp file plus rename), and account-limits.test.ts passes 20/20 sequential whole-file runs plus a green mode-free verify at the reviewed head.
  - done: impl-607 · 2026-10-20T10:08:08.364Z
  - verified: rev-31 [reviewer] · run rev-20261020-607-final · 2026-10-20T10:08:56.078Z · commit 659a45614b673439286c3bbb6171bef4d6e0fb80

## Comments

### impl-607 · 2026-10-20T09:43:40.307Z

A-7125 triage confirmed the fixture truncate/write window can trigger fake Codex's 6% fallback. Changed only hub/test/account-limits.test.ts: same-directory temp write then rename for all Codex rate-limits snapshots. Existing native-contract T3 waits and assertions retained; no new processes or time waits. Baseline file passed; root npm run typecheck passed. Running 20 complete-file repetitions sequentially, no stress load; source review precedes mode-free verification.

### rev-31 · 2026-10-20T10:00:50.516Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-607-source
commit: 659a45614b673439286c3bbb6171bef4d6e0fb80
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7318: source clear; Standards and Spec findings none. All eight Codex snapshot writes use awaited same-directory temporary write + rename; existing T3 native controls and titles remain intact. A-7292 has twenty complete 2/2 passing local Mac receipts, with controller pause distinguished and maximum 10.664 s covered by the unchanged 12.092415 s E-880 allowance. C1 final mark awaits requested original source attribution and a green exact-head mode-free task gate; no T3 task execution is claimed.

### impl-607 · 2026-10-20T10:08:09.144Z

C1 implemented at unchanged head 659a45614b673439286c3bbb6171bef4d6e0fb80. Atomic Codex fixture publication + 20/20 sequential direct Mac T3 whole-file passes (A-7292, provenance A-7323). Source clear rev-20261020-607-source (A-7318). Same-head mode-free verify 340dc7be-62fe-4c19-8162-b6363999aee5 exit0 (A-7359): Linux x64 droplet c-8 lon1, T1+selected T2 task gate, 570/570 tests, no T3 in task plan. T0 host gate reused at 144cea818fb7b327f58a91808b9662560d64153e, not repeated; test lint and duration ratchet report-only. Droplet lifetime121s cost$0.0084. Final review evidence verdict pending.

### rev-31 · 2026-10-20T10:08:56.078Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-607-final
commit: 659a45614b673439286c3bbb6171bef4d6e0fb80
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7366: final C1 clear. A-7292 twenty serial local Mac whole-file T3 runs pass 40/40 tests, with original controller/pre-commit attribution/pause limits in A-7323. Exact-head mode-free 340dc7be/A-7359 separately passes host/T1/selected T2, 570/570 with no resource/duration diagnostics; it executes no account-limits T3 cases. Native maximum 10.664 s is covered by unchanged exact 12.092415 s allowance. Claimant done present; no source changes.

Criteria: C1 verified.

### coord · 2026-10-20T10:14:07.252Z

Merged 03e2d6129fb70bc2ba098d319662ac4d4adf3c3e onto dev.
