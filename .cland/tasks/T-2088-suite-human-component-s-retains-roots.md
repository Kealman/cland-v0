---
id: T-2088
kind: task
title: "suite-human-component's \"retains roots and seams after constructor and rejected native close\" fails on dev since T-1995: it expects the masked close rejection, but openDatabase now keeps the primary constructor error"
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
regression_of: T-1995
topic: null
branch: null
created: 2026-11-24T13:49:20.383Z
updated: 2026-11-24T13:59:43.535Z
---

## Summary

T-1995 (landed 7e117f8bb) made openDatabase keep the primary initialization error and attach the cleanup failure as its cause. hub/test/suite-human-component.test.ts:129-132, "report fixture retains roots and seams after constructor and rejected native close", still expects the old masked message /planted native close rejection/. It now sees "Error: planted constructor rejection". Found by impl-2043 in T-2043's verify 0246c37f (A-22981); rev-40 confirmed the attribution (81fc210c, A-22987).

Coordinator bisect, 2026-11-24, running the case alone with `node --test --test-name-pattern="retains roots and seams"`: pass 2/0 at 729550515 (T-1995's parent), fail 1 at 7e117f8bb (T-1995), fail at dev 02de02c5d. T-1995's member verify and batch 44b401d8 didn't select it at blocking strength: the batch ran T2 in report mode only.

## What to build

Update the assertion to the new error contract: the primary error is the constructor rejection, and its cause chain includes the native close rejection. Keep every retained-root, seam and repair proof in the case.

## Acceptance criteria

- [ ] C1. The case passes alone on dev and asserts the primary constructor error plus a cause containing the native close rejection (test, red on dev before).

## Comments

### coord · 2026-11-24T13:56:02.371Z

Canonical fix: commit d28203f1a5951f44a17e1c14cd1b3391526ed57c on T-2043's branch (t/T-2043-…), test-only (hub/test/suite-human-component.test.ts), message "Fixes T-2088". Evidence A-22992: the case alone failed 0/1 before and passes 1/1 after; the whole file passes 7/7; typecheck and test:lint exit 0. Any branch whose verify selects suite-human-component before T-2043 lands takes it with `git cherry-pick d28203f1a`. Close T-2088 when T-2043 lands with this commit.

### coord · 2026-11-24T13:59:43.535Z

The hub raised a shared-defect candidate at 13:59Z. Affected runs so far: T-2043's 0246c37f (A-22981, head 40746f720) and T-2067's 5eff8e17 (A-22997, head 96ce29631), both on dev merge-base 7e117f8bb. Shared fix: cherry-pick d28203f1a (T-2043's branch). impl-2067 has been told to cherry-pick it; T-2043 already carries it at d28203f1a, in verify #3.
