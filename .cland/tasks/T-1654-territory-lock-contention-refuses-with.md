---
id: T-1654
kind: task
title: "Territory lock contention refuses with two different messages: the allow-list test expects 'territory operation holds' but gets 'acquisition deadline reached'"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1597
topic: topic-1360
branch: t/T-1654-territory-lock-contention-refuses-with
created: 2026-11-03T04:59:56.525Z
updated: 2026-11-03T05:01:22.204Z
---

## Summary

The E-1536 stage-4 macOS cover 94521ff5 (A-16171, dev bf486cb6) failed `hub/test/host-allow-list.test.ts` :: "grant and revoke cannot rewrite the allow list while another territory operation holds its lock" in load-gate repetition 4 (4/5 passed). The test expects `/territory operation holds/`, but the refusal was `lock …/.cland/territory.lock: acquisition deadline reached after waiting 5… ms`. After T-1597's bounded revoke wait, lock contention can end in two different refusals, depending on whether the holder is seen before the deadline.

## What to build

Make grant and revoke give one documented refusal for "another territory operation holds the lock", whether the holder is seen at once or the bounded wait reaches its deadline, and name the holder when it is known. Keep the deadline injectable. The test asserts that one refusal class, and passes five load-gate repetitions on macOS and Linux.

## Acceptance criteria

- [ ] C1. Grant and revoke against a held territory lock refuse with the same documented message, both when the holder is seen immediately and when the bounded wait reaches its injected deadline (test).
- [ ] C2. The allow-list contention test passes five load-gate repetitions locally under load (test).

## Comments

### impl-1654 · 2026-11-03T05:01:22.204Z

Consumer search before changes: old refusal strings, TerritoryBusy, acquireLockWithRetry, withTerritoryLockAsync and lease APIs searched across hub/src (including colocated tests), hub/test (all tiers), nvim, web, shared, docs, qa and .agents. Production: territory sync/async wrappers; host lease + daemon; merge, merge-batch-territory and merge-batches (typed TerritoryBusy retry); dispatch/daemon/releases/git-maintenance (propagate errors); executor droplet/spend use generic retry helper and retain its diagnostic. Tests: territory-lock, territory-task-branch, worktree-host, host-allow-list, merge-batches, git-maintenance, push, executor-admission-lock/droplet/lock-liveness plus harness/stdio fixture; docs: cland-init-and-update, declining-verifier reference, host-allow-list guide, implement skill; QA T-117. No web/nvim wire or persisted-record shape consumer. Existing generic retry diagnostic stays compatible; territory boundary will normalize typed deadline exhaustion, including when no holder was observed. A-16171 exact failure: expected /territory operation holds/, got 'Error: lock …/.cland/territory.lock: acquisition deadline reached after waiting 5… ms', repetition4, 4/5.
