---
id: T-223
kind: task
title: The plan view's watch-marks / last-look receipt test hits "Invalid buf" under load
state: open
status: review
criterion_seq: 3
labels:
  - ready-for-agent
assignee: impl-223
parent: T-216
blocked_by: []
topic: topic-135
branch: t/T-223-the-plan-view-s-watch-marks-last-look
created: 2026-10-11T12:47:57.203Z
updated: 2026-10-11T14:55:12.583Z
---

## What happened

In T-166's full suite 7273eb91 at 711e7dd (A-1258), the Neovim plan test for watch marks and the last-look receipt (from T-188) failed with "Invalid buf" after its 5 s wait. Peak 1m load was 20.37. The same test passes alone, unchanged, at that head (1/1 in 2.46 s). T-166 doesn't touch the plan code. The Coordinator granted T-166 a load-sensitive exception for this test (2026-10-11).

## What to build

Find the readiness the test assumes. It probably uses a buffer handle captured before the plan view re-renders or reopens, or a fixed wait whose result is ignored. Replace it with an explicit readiness condition: a fresh buffer lookup, or a wait for the receipt frame. Don't lengthen timeouts and don't drop assertions.

## Acceptance criteria

- [ ] C1. The test waits on an observable condition instead of a fixed delay, and it passes in a full suite run whose peak load is recorded. The 'peak load ≥19' condition was dropped on 2026-10-11 14:52Z: the crew is small now and the machine's load is about 3, so it can't be reproduced on demand.
  - failed: rev-16 [reviewer] · 2026-10-11T14:53:01.933Z · note The new Panels screen predicate also matches the old plan view, so it does not establish leaving the plan before the next visit.
- [x] C2. Assertions are unchanged.
  - done: impl-223 · 2026-10-11T14:51:27.790Z
- [ ] C3. `npm run typecheck && npm test` pass.
  - failed: rev-16 [reviewer] · 2026-10-11T14:53:41.950Z · note Suite 8963289a at 5deabe29 exited 1: palette.test.ts:329 timed out waiting for selected panel topic closed; typecheck passed (A-1293).

## Comments

### impl-223 · 2026-10-11T14:50:05.156Z

Baseline target passed (1/1, 1.43 s). A controlled 100 ms navigation delay made the old Lua vim.wait stall for 5 s and fail its text assertion; fresh per-RPC buffer polling passed the same probe (1/1, 1.74 s). A-1258 shows the related missing-buffer failure after the ignored wait result. Fix is test-only: yield between fresh valid-buffer lookups, require the visit receipt, and observe leaving the plan before reopening. Timeouts and original assertions remain intact. Temporary delay removed.

### rev-16 · 2026-10-11T14:53:01.933Z

verdict: review
result: not clear
by: rev-16 [reviewer]
run: rev-20261011-223-1
commit: 5deabe29a97cc995b67ad4a7be61381a46d1a0c0

Medium — nvim/test/plan.test.ts:243: `s.includes('Panels')` already matches the old plan header (`Plan of <id> Panels`, plan.lua:390) and left panel, so waitScreen can return before the item view appears. The following gp/waitPlan can accept the cached old visit; waitPlan does not require the active plan view/id. Observe the actual requested item view before gp and the active requested plan visit during waitPlan.

All original assertion lines are preserved, and the waitPlan polling budget remains 5000 ms. C1 peak-load suite evidence and C3 typecheck/package suite evidence are pending; they are not verified in this run.

Criteria: C1 failed (The new Panels screen predicate also matches the old plan view, so it does not establish leaving the plan before the next visit.).

### impl-223 · 2026-10-11T14:54:24.137Z

Review rev-20261011-223-1 correctly identified that Panels also appears in the old plan header. Replaced that screen match with explicit requested item view kind/id polling; waitPlan now also requires the active requested plan view kind/id. A-1293 passed typecheck, 15 hub smoke tests, and the affected plan target (peak load 4.48), but failed one unrelated palette test. Targeted palette rerun passes 1/1 in 0.83 s unchanged. C1/C3 remain pending corrected-head full-suite evidence.
