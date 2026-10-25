---
id: T-323
kind: task
title: Plan navigation issued before the initial task and ladder snapshots is discarded instead of deferred
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - needs-triage
  - nvim
assignee: null
parent: E-1283
blocked_by: []
topic: topic-1046
branch: t/T-323-plan-navigation-issued-before-the
created: 2026-10-13T10:43:14.266Z
updated: 2026-10-25T12:07:54.387Z
closed: 2026-10-25T12:07:54.387Z
---

## Summary

Right after the workbench connects, a plan navigation can be lost. `gp` or `:Cland view plan T-n` issued before the task list and the ladder snapshots arrive is refused with "gp: select an epic or an item in an epic". When the snapshots arrive, the plan is not reopened. Found by impl-317 on 2026-10-13 while fixing the plan.test.ts flake (T-292's case).

## Evidence

- After the hub announces connected, the `task.list` and `hub.status` tracker snapshots can still be pending.
- `gp` and `:Cland view plan T-2` call `plan.owner` synchronously. When the task or the ladder is absent, the command says "gp: select an epic or an item in an epic" and discards the navigation.
- A controlled replay with the stub hub's held `hub.status` confirms it, even when T-2 is already in the task snapshot. The owner is nil before the release and T-2 afterwards, but the plan stays unopened.

## What to build

Keep or defer the requested navigation until its task and ladder preconditions settle, then open it. If they settle without the item, say so. Cover it with a Neovim headless test on the stub hub that delays the initial snapshots.

## Acceptance criteria

- [x] C1. `gp` and `:Cland view plan <id>` issued before the initial snapshots open the plan once they arrive, or report clearly that the item is not an epic or in one.
  - done: impl-323 · 2026-10-25T11:45:55.831Z
  - verified: rev-26 [reviewer] · run rev-20261025-323-evidence-1 · 2026-10-25T12:01:51.934Z · commit 1f708c1f7503f4043e6e701e41b236b4431c0fb5
- [x] C2. A headless test on the stub hub with delayed `hub.status` and `task.list` covers both outcomes.
  - done: impl-323 · 2026-10-25T11:45:56.331Z
  - verified: rev-26 [reviewer] · run rev-20261025-323-evidence-1 · 2026-10-25T12:01:51.934Z · commit 1f708c1f7503f4043e6e701e41b236b4431c0fb5

## Comments

### coord · 2026-10-13T18:53:49.891Z

Pattern note (2026-10-13): three Neovim test flakes today came from keys pressed before the initial or reconnect snapshots landed. They were the plan view (b5b67ad, T-292), the palette (7210621, T-301), and the shell reconnect unscheduled-heading search (T-331's shared fix). Each was fixed in the test with a readiness wait. Making the product defer actions until their snapshots settle would close the class, so consider T-323's scope wider than gp alone.

### coord · 2026-10-13T19:40:55.933Z

Second product case, from T-340 (impl-340, A-2046, 2026-10-13): the session launcher can consume a role selection before role.list arrives. It then leaves harness, model and effort unfilled even after the role response. launcher.sync records the unknown role in seen.role and fills defaults only on a role change. A controlled 1000 ms role.list replay shows the missing reviewer defaults. T-340 fixes only the test's readiness, so this belongs in T-323's product scope: actions that need snapshots must defer, or re-apply, once the snapshots land.

### impl-323 · 2026-10-25T11:30:23.784Z

Clean inherited worktree. A-11669 confirms scope is the two named connect races: plan navigation before task.list + hub.status, and launcher role before role.list. Using existing T2 stub-hub/headless-client seams as required by C2 and triage; no wire/schema/permission change planned.

### rev-26 · 2026-10-25T11:44:37.490Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-323-source-1
commit: bfea7e84c0357a7beebdba0c14e907bfa3e0e490
scope: full
findings: [{"severity":"medium","text":"M1: current-view table equality resurrects stale deferred plan navigation after another view then previous-centre restores the original table. Invalidate on actual navigation transition/generation and add held-snapshot away/back cancellation control.","file":"nvim/lua/cland/plan.lua","line":77}]
finding_counts: {"high":0,"medium":1,"low":0}

Full in-session Standards/Spec audit complete, A-11838; consolidated finding M1 only. Pending view-table equality can become true again because layout.back restores the original history table, resurrecting stale plan navigation. Add away/back held-snapshot regression and real transition invalidation; preserve both-order outcome/latest-plan/error tests. Launcher delayed defaults and typed-value preservation otherwise match the two named race scopes. Old recording records/nodes retained unchanged; local A-11832 remains summary with source/capture limits. Request fresh committed source review before verification; no Linux/load/QA/landing pass claimed.

Criteria: C1 failed (Deferred plan request survives an intervening other-view/previous-view sequence and can reopen after newer navigation.).

### rev-26 · 2026-10-25T11:46:33.974Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-323-source-2
commit: 1f708c1f7503f4043e6e701e41b236b4431c0fb5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source audit A-11838 carried forward; M1 resolved, A-11842. Four-file sole-parent correction explicitly cancels pending plan requests on layout.show/successful back, preventing history-table resurrection. Real space-space held-snapshot regression retains original view/no notice/zero plan-fetch receipts; latest-plan, one-way cancellation, error and both-order outcome/defaults tests retained. Both axes clear, no new findings. A-11841 original red/green/static/existing-launcher excerpts and source/capture limits inspected. C1/C2 final runtime pending one ordinary configured exact-head receipt; no Linux/load/QA/landing claim.

### rev-26 · 2026-10-25T12:01:51.934Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-323-evidence-1
commit: 1f708c1f7503f4043e6e701e41b236b4431c0fb5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR, A-11872, carrying full source-2/A-11842. Original A-11869 independently decoded:3195 ordinary test passes/440 files; separately95 actual load test passes across19 new identities, exactly5 each. All12 gp/command×epic/unparented/missing×snapshot-order cases, four replacement/cancellation/error controls including away/back, and three delayed-role/typed-value controls pass. M1 base0.385103294s+5/5. Existing mapped launcherT4 parent6.847172858s and20children pass;40native receipt diagnostic retained, one base execution/no T4 load repetitions. T0/allT1/fallbackallT2/T4/Web green on Linuxx64; noT3/fullsoak. Host prepared-tree check and report-onlylint/timing diagnostics separately attributed; no budget/QA/landing claim. C1/C2 verified, zero findings on both axes; Coordinator owns affected after-stageQA/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T12:07:54.387Z

Merged 9b3ae9f9c7bdce401899ddb5f0e555cc222d4098 onto dev.
