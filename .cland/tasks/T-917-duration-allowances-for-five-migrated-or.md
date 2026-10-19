---
id: T-917
kind: task
title: "Duration allowances for five migrated or renamed T3 identities that failed stage cover #1's budget"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-659
branch: t/T-917-duration-allowances-for-five-migrated-or
created: 2026-10-19T22:41:23.592Z
updated: 2026-10-19T22:56:53.574Z
closed: 2026-10-19T22:56:53.574Z
---

## Summary

Stage cover #1 (Linux ad5da9f3 / A-6763 and macOS 781169bb / A-6767 at b62bf16c) has hard `duration budget:` failures for test identities that are new or renamed since the last durations refresh. Their timings come from the process-helper migration (T-896–T-903) and from T-668's rename. Each says "add to hub/test/durations.json with a reason".

## What to build

Add allowances to `hub/test/durations.json`, owner E-677, expiring in 7 days, each with a reason naming the migration or rename, at the larger observed value plus 20 %, for exactly:
- hub/test/executor-run.test.ts::host check failure creates no machine; remote typecheck stops tests and failed tests retain failures (13.132 s Linux, 13.73 s macOS; renamed by T-668)
- hub/test/merge-checkout-lifecycle.test.ts::a crash before the integration ref moves retains checkout recovery and can merge after restart (5.33 s Linux, 6.51 s macOS)
- hub/test/merge-recovery-native.test.ts::a close write failure reports merged follow-up failure; retry closes and prunes without a second commit (5.149 s macOS)
- hub/test/merge-recovery-native.test.ts::retrying a completed merge preserves staged deletion and reversion of its touched files (5.789 s macOS)
- hub/test/session-resume-lifecycle.test.ts::a stopped Claude Implementer resumes its conversation, role and item claim and receives its clause again (6.833 s Linux, 5.48 s macOS)
If an allowance for a renamed identity's old name still exists, remove it.

## Acceptance criteria

- [x] C1. The five allowances exist with reason, owner and expiry, and the durations lint/test passes.
  - done: impl-917 · 2026-10-19T22:43:04.494Z
  - verified: rev-30 [reviewer] · run rev-20261019-917-final · 2026-10-19T22:52:33.177Z · commit 0d6f31f730277a1075fe16ba63fb80ef1bf91f16
- [x] C2. A replay of A-6763's and A-6767's budget checks against the new manifest shows no `duration budget:` line (a small script or the existing budget test over the logs), with the receipt in the report.
  - done: impl-917 · 2026-10-19T22:43:05.181Z
  - verified: rev-30 [reviewer] · run rev-20261019-917-source · 2026-10-19T22:44:09.190Z · commit 0d6f31f730277a1075fe16ba63fb80ef1bf91f16
  - verified: rev-30 [reviewer] · run rev-20261019-917-final · 2026-10-19T22:52:33.177Z · commit 0d6f31f730277a1075fe16ba63fb80ef1bf91f16

## Comments

### impl-917 · 2026-10-19T22:43:04.475Z

Implemented at 0d6f31f730277a1075fe16ba63fb80ef1bf91f16: exactly five dated E-677 allowances plus two stale identity removals; retained manifest data unchanged. Duration lint, 17 duration tests and typecheck pass. Full-log replay: A-6763 3→0 and A-6767 5→0 budget failures over 2916 timing records each. Receipt published in item topic.

### rev-30 · 2026-10-19T22:44:09.190Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-917-source
commit: 0d6f31f730277a1075fe16ba63fb80ef1bf91f16
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6769. Exactly five dated E-677 allowances at task maxima +20%, two stale-key removals, no retained allowance or other-section change. Owner confirmed open; reasons/UTC expiry match seven-day policy. Independent JSON and raw timing-record audit of all 2916 records per artifact corroborates A-6768: A-6763 three→zero and A-6767 five→zero unknown duration-budget failures under unchanged rules; C2 verified. C1 allowance fields established but lint/durations-test pass requires exact-head mode-free runtime evidence. Existing measurements are not speed improvements; no tier/budget broadening. QA none; no Reviewer tests.

Criteria: C2 verified.

### rev-30 · 2026-10-19T22:52:33.177Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-917-final
commit: 0d6f31f730277a1075fe16ba63fb80ef1bf91f16
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-6786. Independently audited A-6784/467b5536:1909/1909, zero fail/cancel/skip/TODO, zero tier/resource mismatch or budget-overrun rows. durations.test.ts is T3 and excluded from task run; requested original targeted evidence is now preserved in A-6785:17 distinct passes,17/17, zero nonpasses, exit0, plus live-owner lint PASS/full replay zero failures and typecheck exit0. Tested manifest bytes were committed unchanged per receipt. Source A-6769 plus current gate and qualified local duration proof settle C1; C2 full-record replay audit retained. No Linux T3 or speed-improvement claim. QA none; no Reviewer tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T22:56:53.574Z

Merged bc614559c06e377b96ccf1b494a390d986772a94 onto dev.
