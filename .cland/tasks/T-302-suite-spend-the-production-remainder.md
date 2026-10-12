---
id: T-302
kind: task
title: "Suite spend, the production remainder: territory git operations, verdict reads, doctor probes and identity checks"
state: open
status: backlog
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T19:51:04.098Z
updated: 2026-10-12T19:51:04.098Z
---

## Summary

After T-277 to T-279 the suite still spawns about 21 thousand `git` and 15 thousand `ps` processes per full run, almost all from production paths: live territory operations, the merge gate's verdict reads, the doctor's process probes and process identity checks. Cut them only where correctness and termination safety are provably kept.

## Parent

T-216 Tech debt. Follow-up of epic T-268 (T-267's cuts), filed on the stand-in's answer of 2026-10-12 (D24), which replaced the "at least halved" target with the measured cut.

## What happened

Census A-1610 at 5d92ef5 against the baseline A-1535: git 32,341 → 21,111 (−35%), ps 28,888 → 15,290 (−47%), wall 905 → 706 s, phase leftovers 2 → 0. Remaining git: live async territory operations 9,814, verdict-git 4,452, synchronous territoryGit construction 2,447, verification-tree 982. Remaining ps: doctor 6,442, cleanup listing 5,720, lock identity 2,571.

## What to build

Measure each source again with the census tool, then cut where an operation can read the same answer from fewer processes (batched read-only plumbing within one operation, `cat-file --batch`, `for-each-ref`; probes of captured pids rather than tables) and nothing else changes. The merge gate still reads the exact current head at decision time; no cache spans operations; every foreign-PID identity check before a signal stays fresh. Each cut is named with its census line and covered by a protocol test that proves the same answers (a branch moving mid-operation for git, a reused PID for ps).

## Acceptance criteria

- [ ] A census before and after is published, each cut named with its census line.
- [ ] The merge gate's decisions and the termination safety checks are unchanged, proved by protocol tests on a moving branch and a reused PID.
- [ ] No test is weakened, skipped or retried; the suite is green through `cland verify`.
