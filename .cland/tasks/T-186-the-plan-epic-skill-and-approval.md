---
id: T-186
kind: task
title: "The plan-epic skill and approval: drafting a plan, [plan] approval,
  task.plan approve, per-group lanes"
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1
  - ready-for-agent
assignee: impl-186
parent: E-114
blocked_by:
  - T-183
topic: topic-111
branch: t/T-186-the-plan-epic-skill-and-approval
created: 2026-10-10T15:38:38.001Z
updated: 2026-10-11T04:54:40.018Z
closed: 2026-10-11T04:54:40.230Z
---

## Parent

T-114, slice 4 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The skill drafts a plan from the epic's tickets, their blocking edges and criteria, and the crew, and sets it; `[plan] approval`; `task.plan approve` by the human or an Aide; the clauses follow the stage order; `per-group` gives one session per lane.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-186 · 2026-10-11T01:47:56.151Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-2 · 2026-10-11T01:49:18.181Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-3 · 2026-10-11T02:38:36.130Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-5 · 2026-10-11T03:39:32.611Z
- [x] C2. Demo: `plan-epic` on an epic yields a valid plan; with `approval = "human"`, nothing launches until it is approved.
  - done: impl-186 · 2026-10-11T01:47:56.549Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-2 · 2026-10-11T01:49:18.181Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-3 · 2026-10-11T02:38:36.130Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-5 · 2026-10-11T03:39:32.611Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-186 · 2026-10-11T01:41:31.594Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-1 · 2026-10-11T01:46:15.531Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-2 · 2026-10-11T01:49:18.181Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-3 · 2026-10-11T02:38:36.130Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-5 · 2026-10-11T03:39:32.611Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-186 · 2026-10-11T04:53:31.570Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-6 · 2026-10-11T04:54:19.162Z
- [x] C5. Demo: the human approves an unstarted epic with `a` on the plan view's approval card (T-187), and the card shows the approved state.
  - done: impl-186 · 2026-10-11T01:41:31.697Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-2 · 2026-10-11T01:49:18.181Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-3 · 2026-10-11T02:38:36.130Z
  - verified: rev-14 [reviewer] · run rev-20261011-186-5 · 2026-10-11T03:39:32.611Z

## Comments

### impl-186 · 2026-10-11T01:36:32.148Z

Implementing task.plan approve across protocol/MCP/CLI with human/Aide authorization, persisted approval tied to the accepted plan, an approval launch prerequisite, the real Neovim approval card, and the shipped plan-epic skill with dependency-aware drafting. Stage/lane staffing remains role-guided per §3.10.

### rev-14 · 2026-10-11T01:46:15.325Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-186-1
commit: ee510e2343f979516c5e8c4b993200b54f6296d8

Medium — hub/src/tracker/tracker.ts:869: requested epic is excluded from the approval scan, so an item-bound Implementer spawns and claims an unapproved epic (C2).
Medium — .agents/skills/plan-epic/draft.mjs:3: provisioned helper depends on target-project yaml; a non-Node project fails module resolution before reading tickets (C1/C2).
Medium — hub/src/hub/worktrees.ts:162–166: approval traversal/hash checks after awaits run outside resumed, violating hub/README.md:391 request timing (C1).
Actual memory Tracker/TaskWorktrees diagnostic confirms pending-epic spawn and two unmeasured checks; import.meta.resolve confirms the copied-helper dependency failure. No edits or package tests by Reviewer. Separate Standards/Spec evidence and probe source: A-975 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-975-t-186-review-not-clear-at-ee510e2-approval-admission-and-installed-draft.md.
C3 docs/exact role handover checked separately. C4 pending complete suite; C5 source looks implemented but retained headless log not yet inspected.

Criteria: C1 failed (Provisioned draft helper cannot resolve yaml without a target-project dependency; new approval checks also escape measured lifecycle continuations.), C2 failed (Item-bound Implementer launch on the pending epic itself bypasses approval because only ancestors are checked; installed drafting also fails.).

### impl-186 · 2026-10-11T01:48:05.939Z

Corrected rev-20261011-186-1 findings in e52999e: installed draft helper uses only Node built-ins and emits its fixed YAML shape; the regression invokes the cland-init-provisioned helper from a clean target project. Approval admission now includes the requested epic and every new approval check runs inside resumed. Targeted logs retained as A-976 (2 approval/draft tests), A-977 (5 real-hub headless plan tests incl gp/a), A-978 (typecheck). The full suite submitted earlier remains pending; C4 awaits final-head evidence.

### rev-14 · 2026-10-11T01:49:18.181Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-186-2
commit: e52999eab497d0a7659e468898af5a9e9f981467

No high or medium findings remain. Standards and Spec clear: copied helper uses only Node built-ins, installed-location regression accepts the draft, admission includes the requested epic, and all new checks run inside resumed. Independent memory Tracker/TaskWorktrees probe confirms pending-epic refusal before spawn, approved launch and four measured checks; stale/missing task approval still refuses. C1/C2 verified with complete A-976 2/2; C3 unchanged exact role handover A-971; C5 complete A-977 real-hub headless 5/5 including gp/a. Both logs have zero failures/cancellations/skips. A-978 retains typecheck output. C4 awaits complete corrected-head package evidence; pending older-head suite does not qualify. Evidence A-979 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-979-t-186-corrected-review-clear-at-e52999e-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### rev-14 · 2026-10-11T02:38:36.130Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-186-3
commit: 7db8e440ef7f338006a1a02f0ebd244587816cb6

No high or medium findings. Standards and Spec clear: exact Aide fixture now includes task.plan per §3.10 while retaining exhaustive boundary assertions; all upstream T-172 changes retained. Production, corrected helper/admission/timing, UI and roles unchanged from e52999e. C1/C2/C3/C5 reverified from retained A-979/A-976/A-977 and exact A-971 handover plus integration review. Actual default-tools assertion diagnostic passes and confirms non-Aide approval stays forbidden. C4 awaits complete fresh-head package evidence; no T-172 exception applies. A-991's old fixture failure and unreached Neovim do not validate this head. Evidence A-994 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-994-t-186-aide-fixture-and-t-172-merge-clear-at-7db8e44-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### impl-186 · 2026-10-11T03:12:26.702Z

Final full suite 97d1507b-7385-4014-b02b-f9568e21deb5 passed at 7db8e440ef7f338006a1a02f0ebd244587816cb6 after merging origin/dev 4990b6a. Typecheck and both hub and Neovim package phases passed: 1367 tests, 1367 passed, zero failures/cancellations/skips. Complete retained log A-1005. C4 marked done; all implementation criteria are done. Requesting Reviewer verification of C4; prior clear source review already verified C1/C2/C3/C5.

### rev-14 · 2026-10-11T03:12:49.552Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-186-4
commit: 7db8e440ef7f338006a1a02f0ebd244587816cb6

No high or medium findings remain. Identical clean head retains A-994 Standards/Spec and C1/C2/C3/C5 clearance; exact A-971 role handover unchanged. C4 verified from complete A-1005: typecheck succeeds; hub1115/1115 and Neovim252/252, combined1367/1367; both phases zero failure/cancellation/skip/todo, final exit0. No exception applied. HEAD and clean status checked read-only; no edits or tests by Reviewer. Verification covers this head; later integration requires fresh evidence. Final evidence A-1006 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1006-t-186-final-c4-verified-at-7db8e44-complete-package-exit-0.md.

Criteria: C4 verified.

### impl-186 · 2026-10-11T03:32:05.663Z

Integrating origin/dev 75b133d after T-178/T-179. Resolved roles.toml/default-roles.ts/permissions.ts by retaining Lead subtree lifecycle grants, ask grants and scoped plan grants, and replacing obsolete transitional role wording. Running targeted integration tests and typecheck before a fresh-head delta review/full package run.

### impl-186 · 2026-10-11T03:37:30.874Z

Pushed integration head 2155c21111c6787333c791021662946078b13155 after merging origin/dev 75b133d. Nine targeted single-file runs pass 57/57 with no fail/cancel/skip/todo (A-1015); typecheck passes (A-1012). Updated exact role handover is A-1009. Requesting delta review and fresh full suite; prior 7db8e44 package clearance does not cover the new head.

### rev-14 · 2026-10-11T03:39:32.611Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-186-5
commit: 2155c21111c6787333c791021662946078b13155

No high or medium findings. Standards/Spec clear: merged grants retain Lead lifecycle, asks and scoped planning; both subtree and human/Aide-only approval guards remain. Native boundaries receive the measured approval wrapper; requested epic/ancestor admission and dependency-free helper are intact. Complete A-1015 nine targeted files pass 57/57 with zero failure/cancellation/skip/todo, including real gp/a card; A-1012 typecheck retained. Independent memory admission probe passes with all five approval checks measured; combined grants and exact A-1009 line locations checked. C1/C2/C3/C5 verified. C4 predecessor marks reset separately and remains unverified pending complete current-head package evidence; no exception applies. Evidence A-1016 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1016-t-186-t-178-t-179-integration-clear-at-2155c21-fresh-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### impl-186 · 2026-10-11T04:18:26.919Z

A-1025 full package run stopped after hub1133/1134 with sole known T-210 verifier refusal-message mismatch. Head remains clean 2155c21. Standalone verifier test passes 1/1 with zero failures/cancellations/skips (A-1027). Coordinator explicitly permits named T-210 exception and assigns race correction to that item; requested C4 supplemental review and submitting complete same-head Neovim suite.

### impl-186 · 2026-10-11T04:53:31.803Z

C4 supplemental evidence complete at unchanged clean 2155c21111c6787333c791021662946078b13155. A-1037 Neovim suite passes253/253, typecheck and final exit0, zero fail/cancel/skip/todo. Combined with A-1025 hub1133/1134 (sole known T-210 refusal-message mismatch) and A-1027 unchanged standalone verifier1/1 pass, this satisfies Coordinator's explicitly named T-210 exception. Marked C4 done and requesting Reviewer verification; no source changes.

### rev-14 · 2026-10-11T04:54:19.162Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-186-6
commit: 2155c21111c6787333c791021662946078b13155

No high or medium findings. Same clean head retains A-1016 Standards/Spec and C1/C2/C3/C5 clearance plus exact role handover A-1009. C4 verified under Coordinator b0c8a676's named T-210 exception: hub/test/lead-permissions.test.ts:115 verifier-launch case receives standing-worktree rather than launch-reservation refusal. A-1025 typecheck passes, hub1133/1134 has solely that failure; A-1027 standalone verifier1/1 passes; A-1037 same-head typecheck/Neovim253/253 passes exit0. Both phases complete, all summaries zero other failures/cancellations/skips/todo; T-210 remains unmerged. No other exception applied; original all-run exit1 is retained. HEAD/status checked read-only; no edits/reruns by Reviewer. Evidence A-1038 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1038-t-186-final-c4-verified-at-2155c21-with-named-t-210-exception.md.

Criteria: C4 verified.

### coord · 2026-10-11T04:54:40.018Z

Merged 438e53e9ff3105ea878688ccbeb02822334b4284 onto dev.
