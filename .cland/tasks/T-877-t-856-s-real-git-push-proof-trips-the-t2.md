---
id: T-877
kind: task
title: T-856's real-Git push proof trips the T2 process boundary; move it to an allowed tier or seam
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-611
branch: t/T-877-t-856-s-real-git-push-proof-trips-the-t2
created: 2026-10-19T13:52:09.532Z
updated: 2026-10-19T18:41:38.962Z
closed: 2026-10-19T18:41:38.962Z
---

## Summary

T-856's C4 proof that the Aide's `cland push` moves the territory's dev runs real Git at T2: prepared-project Git execFileSync, territory spawnSync, a lock-probe spawn, and production push territoryGitAsync execFile. The tier rules permit only the CLI child at T2. That is report-only today (A-6073/A-6074) and accepted for T-856 by the Coordinator, but the case must move to an allowed tier or seam before T2 boundaries enforce.

## Acceptance criteria

- [x] C1. The real territory-push proof runs at a tier whose rules allow those processes (a T3 case with the `// T3:` header), or behind an injected Git seam at T2, keeping the actual territory-dev advancement assertion. The T2 tier-mismatch report for it is gone.
  - done: impl-877 · 2026-10-19T15:38:51.106Z
  - verified: rev-31 [reviewer] · run rev-20261019-877-final · 2026-10-19T15:39:11.413Z · commit 238599f2eb6e5883fbbaab9e90748c921ccb047a

## Comments

### impl-877 · 2026-10-19T15:29:29.825Z

Moved the unchanged onboarding real-publication proof from T2 skills-onboarding.test.ts into existing T3 push.test.ts with an explicit // T3: header; reused its Git helper and retained the native-territory seed, own-shell identity and actual territory dev ref equality. Before: isolated original case fails enforce mode on prepared-project execFileSync. After: all 11 remaining onboarding tests pass (2.044 s) under enforce mode with no tier-mismatch receipt. Root typecheck passes. Running the whole touched T3 file next; Linux T3 evidence remains the landing batch per assignment.

### rev-31 · 2026-10-19T15:31:26.783Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-877-source
commit: 238599f2eb6e5883fbbaab9e90748c921ccb047a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6154 records full relocation/assertion audit. All four moved assertions remain byte-identical/in order, including actual territory-dev advancement; native fixture, committed change, own-shell credentials and in-process Aide remain. Destination embeddedProjectHub is the same original projectHub via existing alias; existing Git helper is equivalent. T2 file removes native case and child_process/prepared-project imports; its other11 declarations remain. Manifest T3 destination and T3 header permit native Git/CLI processes. No production change or added process behavior. A-6150 reports original enforce-mode T2 red, then T2 onboarding11/11 with no tripwire receipt and T3 push14/14, moved case1.397s; typecheck/lint/tier checks green. C1 final verification pending same-head mode-free task receipt confirming T2 boundary; native T3 Linux remains standard landing-batch evidence.

### rev-31 · 2026-10-19T15:39:11.413Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-877-final
commit: 238599f2eb6e5883fbbaab9e90748c921ccb047a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. A-6168 / 552957d0 matches the source-cleared head and branch ref: all 440 ordinary finishes pass, all 212 gates 5/5. The 11 remaining onboarding T2 cases pass with 55 passing repetitions and no tier-mismatch receipts anywhere in the full log; no owned budgets. C1 verified across source-preserved native T3 proof (four original assertions including actual territory-dev advancement), pre-review host push-file evidence and this task gate. The moved native T3 proof was not executed by this Linux task gate and remains subject to the merge batch. One external roles-editor budget 0.608 > 0.5 s is retained in the final evidence artifact, overlapping T-875.

Criteria: C1 verified.

### coord · 2026-10-19T17:55:26.347Z

Landing evidence (Coordinator): batch d64e7778 (T-877, T-878, T-869), run e2e1fea1, tree f23c7b1f, Linux c-8 droplet, T1+T3, exit 0, 1781 passed, 0 failed (A-6303). hub/test/push.test.ts (T3, real territory push): 25 finishes, 0 failures.

### coord · 2026-10-19T18:41:38.962Z

Merged 816cb9d657093d24cd094f98d65b2ef35b98f4f6 onto dev.
