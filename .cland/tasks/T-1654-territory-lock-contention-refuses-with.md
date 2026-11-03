---
id: T-1654
kind: task
title: "Territory lock contention refuses with two different messages: the allow-list test expects 'territory operation holds' but gets 'acquisition deadline reached'"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1597
topic: topic-1360
branch: t/T-1654-territory-lock-contention-refuses-with
created: 2026-11-03T04:59:56.525Z
updated: 2026-11-03T05:28:54.413Z
---

## Summary

The E-1536 stage-4 macOS cover 94521ff5 (A-16171, dev bf486cb6) failed `hub/test/host-allow-list.test.ts` :: "grant and revoke cannot rewrite the allow list while another territory operation holds its lock" in load-gate repetition 4 (4/5 passed). The test expects `/territory operation holds/`, but the refusal was `lock …/.cland/territory.lock: acquisition deadline reached after waiting 5… ms`. After T-1597's bounded revoke wait, lock contention can end in two different refusals, depending on whether the holder is seen before the deadline.

## What to build

Make grant and revoke give one documented refusal for "another territory operation holds the lock", whether the holder is seen at once or the bounded wait reaches its deadline, and name the holder when it is known. Keep the deadline injectable. The test asserts that one refusal class, and passes five load-gate repetitions on macOS and Linux.

## Acceptance criteria

- [x] C1. Grant and revoke against a held territory lock refuse with the same documented message, both when the holder is seen immediately and when the bounded wait reaches its injected deadline (test).
  - done: impl-1654 · 2026-11-03T05:03:24.594Z
  - verified: rev-35 [reviewer] · run rev-35-1654-final-1 · 2026-11-03T05:28:54.299Z · commit a05c1902332999bb848df237c73b586bbf0e398a
- [x] C2. The allow-list contention test passes five load-gate repetitions locally under load (test).
  - done: impl-1654 · 2026-11-03T05:03:25.012Z
  - verified: rev-35 [reviewer] · run rev-35-1654-final-1 · 2026-11-03T05:28:54.299Z · commit a05c1902332999bb848df237c73b586bbf0e398a

## Comments

### impl-1654 · 2026-11-03T05:01:22.204Z

Consumer search before changes: old refusal strings, TerritoryBusy, acquireLockWithRetry, withTerritoryLockAsync and lease APIs searched across hub/src (including colocated tests), hub/test (all tiers), nvim, web, shared, docs, qa and .agents. Production: territory sync/async wrappers; host lease + daemon; merge, merge-batch-territory and merge-batches (typed TerritoryBusy retry); dispatch/daemon/releases/git-maintenance (propagate errors); executor droplet/spend use generic retry helper and retain its diagnostic. Tests: territory-lock, territory-task-branch, worktree-host, host-allow-list, merge-batches, git-maintenance, push, executor-admission-lock/droplet/lock-liveness plus harness/stdio fixture; docs: cland-init-and-update, declining-verifier reference, host-allow-list guide, implement skill; QA T-117. No web/nvim wire or persisted-record shape consumer. Existing generic retry diagnostic stays compatible; territory boundary will normalize typed deadline exhaustion, including when no holder was observed. A-16171 exact failure: expected /territory operation holds/, got 'Error: lock …/.cland/territory.lock: acquisition deadline reached after waiting 5… ms', repetition4, 4/5.

### rev-35 · 2026-11-03T05:04:57.884Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1654-source-1
commit: a05c1902332999bb848df237c73b586bbf0e398a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards/Spec zero findings. Additive LockRetryExhausted retains last observed holder and generic Error/message/cause compatibility; territory boundary normalizes immediate and bounded exhaustion to TerritoryBusy with optional known PID. Abort/filesystem/cleanup failures and acquisition/release behavior remain distinct/unchanged. Contention test retains holder receipt, finally join and final lease assertions, adding immediate/bounded/no-probe typed-message checks; docs/skill/CHANGES migrated. C1/C2 runtime-unverified pending fresh exact-head mode-free verify and independently checked named/repetition evidence. A-16172 exit1 local run remains partial evidence despite claimed functional passes; not a queued/Linux pass. Reviewer ran no checks/probes/browser or edits. Detail A-16174: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16174-t-1654-source-review-unified-territory-contention-refusal.md.

### rev-35 · 2026-11-03T05:28:54.299Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1654-final-1
commit: a05c1902332999bb848df237c73b586bbf0e398a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified, no findings. Exact-head c605830b/A-16177 exit0,4913 pass/zero fail/cancel/skip/todo; independently streamed contention pass, host-allow-list10, executor-admission-lock11 and executor-lock-liveness9 ordinary passes. A-16172 exact contention identity has5 load-gate pass finishes plus ordinary pass; all10 identities likewise5/5. Local darwinarm64 Node24.21/two lanes/peak1m4.88; package overall exit1 remains explicit due unchanged immediate-merge5.117>5s duration rejection, nonblocking per independently read Coordinatorfe2f6e22. Coordinator45f16ad0 explicitly places Linux5/5 in pre-merge batch; not run/claimed here. T0/T1/allT2/Web plus changedT3 allow-list10 once completed; remainingT3 deferred,T4 unexecuted. Uncached Linuxx64 c-8sfo2 Node24.21/Nvim0.12.5, runner tree aec6c25fea893ff5ba1293d1cc4c8d9a00150855, isolated HeadlessShell1248/Chrome156.0.8078.4. Queued budgets/lint/incomplete ratchet/skip checks report-only, skips[]/missing0. QA none; stage cover separate. Reviewer read only, no tests/probes/browser/edits. Detail A-16178: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16178-t-1654-final-evidence-contention-refusal-and-local-repetitions.md.

Criteria: C1 verified, C2 verified.
