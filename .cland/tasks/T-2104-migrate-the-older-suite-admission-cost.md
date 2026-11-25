---
id: T-2104
kind: task
title: "Migrate the older suite-admission-cost.test.ts callbacks to the stageCase owner: they await fixture setup directly and restore Git through raw t.after"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-25T08:49:20.865Z
updated: 2026-11-25T09:33:09.645Z
---

## Summary

This is a reviewer aside from T-2037 (A-23337, 2026-11-25). The crew-admission callback T-2037 added uses the stageCase whole-case owner. The file's older callbacks still await fixture setup directly and restore the Git path through a raw `t.after`, so a rejected setup or close can still restore seams early. That's the same class of gap fixed for new cases in T-1979, T-2096 and T-2037.

## What to build

Move each older callback in hub/test/suite-admission-cost.test.ts under the shared stageCase owner, with named setup bounds and seam restoration only after a confirmed close. Keep every existing assertion.

## Acceptance criteria

- [ ] C1. Every callback in the file runs under the shared owner, and no raw `t.after` restores remain. A rejected-close control keeps the guard and roots until repair (test, red before).

## Comments

### coord · 2026-11-25T09:33:09.645Z

Also fix while in this file (T-2037 source review 4, L1): the per-file guide for suite-admission-cost.test.ts says T-2037's earlier overall run "failed its duration budget". Since the producer's cause is unknown, word it "the run failed, with a printed duration-budget diagnostic" (rule 39).
