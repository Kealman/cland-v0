---
id: T-176
kind: task
title: "A Lead on an epic: the lead role, session.launch naming an epic gives its lead claim, only the Coordinator launches Leads"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-113
blocked_by: []
topic: topic-91
branch: t/T-176-a-lead-on-an-epic-the-lead-role-session
created: 2026-10-10T15:38:35.506Z
updated: 2026-10-10T19:23:13.308Z
---

## Parent

T-113, slice 1 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `lead` role in `roles.toml` and `cland init`; `session.launch` naming an epic gives the session that node's lead claim, one per node; only the Coordinator launches Leads; the panels show the Lead on its epic.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-176 · 2026-10-10T15:57:08.902Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-2 · 2026-10-10T15:58:33.215Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-3 · 2026-10-10T16:35:55.022Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-176-2 · 2026-10-10T19:22:56.013Z
- [x] C2. Demo: the Coordinator launches `lead-1` on a v0.1 epic, and `@lead T-<epic>` reaches it.
  - done: impl-176 · 2026-10-10T15:47:43.469Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-1 · 2026-10-10T15:55:28.716Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-2 · 2026-10-10T15:58:33.215Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-3 · 2026-10-10T16:35:55.022Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-176-2 · 2026-10-10T19:22:56.013Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-176 · 2026-10-10T15:47:43.864Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-1 · 2026-10-10T15:55:28.879Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-2 · 2026-10-10T15:58:33.215Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-3 · 2026-10-10T16:35:55.022Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-176-2 · 2026-10-10T19:22:56.013Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - verified: rev-13 [reviewer] · run rev-13-20261010-176-1 · 2026-10-10T18:07:28.302Z
  - done: impl-176 · 2026-10-10T19:22:16.426Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-176-2 · 2026-10-10T19:22:56.013Z

## Comments

### impl-176 · 2026-10-10T15:39:58.672Z

Implementation started: inspecting role defaults, launch claim ownership and item/session panel projections. Slice scope is launch-time Lead ownership and direct @lead addressing; subtree permissions and event routing remain later slices.

### rev-12 · 2026-10-10T15:55:29.087Z

verdict: review
result: not clear
by: rev-12 [reviewer]
run: rev-12-20261010-176-1
commit: d9a315827db05ffc6cbac3f8810891c4970626c8

Medium — hub/src/hub/worktrees.ts:156: after role.set lead-1 lead, Coordinator session.launch {name:"lead-1", item:"T-n"} passes permission checks but fails because answerSession forwards undefined request.role and this guard rejects it before Sessions.launch resolves the stored role; hub/README.md:88 explicitly promises preassigned-role resolution. Resolve the effective role before item admission and add a successful preassigned-Lead Coordinator test.

Standards: no material findings. Explicit-role ownership, concurrent admission, grant refusals, root cwd, direct addressing and existing Implementer/Aide routing inspected; clause wording matches the slice. C2 and C3 verified separately under this run. C4 remains unverified: independent typecheck passed, full suite pending. Tests that write temporary projects were not rerun in this read-only reviewer sandbox; targeted execution reported in A-647.

Full separate-axis review: A-651, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-651-t-176-review-at-d9a3158-omitted-role-lead-launch-fails.md.

Criteria: C1 failed (Coordinator launch of a preassigned Lead with omitted role is rejected before stored-role resolution, violating the documented session.launch contract.).

### impl-176 · 2026-10-10T15:56:50.964Z

Reviewer rev-12 found omitted-role Lead launch rejected during item admission. Added a preassigned Coordinator launch tracer test, reproduced the refusal, and now resolve the effective role before item preparation while rechecking an inferred role across async launch authorization. First full suite started at d9a3158; final stable-head suite must follow this fix.

### rev-12 · 2026-10-10T15:58:33.216Z

verdict: review
result: clear
by: rev-12 [reviewer]
run: rev-12-20261010-176-2
commit: 5e90bd7dd6bcff2385f9700dd3814c541b803d64

No remaining high or medium findings. The A-651 defect is fixed: hub/src/hub/worktrees.ts:156 resolves a preassigned role before admission through Sessions.launchRole, and the authorization wrapper rechecks inferred roles across awaits. The Coordinator MCP demo covers both explicit and preassigned Lead launches, ownership, root cwd and direct delivery. Separate Standards and Spec followups found no material issues; the earlier full-item checks remain applicable.

C1–C3 verified. Independent npm run typecheck passed at 5e90bd7. C4 remains unverified pending the stable final-head full suite; read-only sandbox prevented independently rerunning temporary-project E2E tests, so targeted execution evidence comes from A-647/A-655 and inspected test coverage.

Review A-656 if assigned to this artifact title: see the shared re-review artifact in topic-91.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-176 · 2026-10-10T15:59:00.589Z

Reference correction for rev-12-20261010-176-2: its clear review artifact is A-657, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-657-t-176-re-review-at-5e90bd7-clear-c1-c3-verified.md. A-656 is the cancelled old-head suite log (exit 143), not review evidence. C1–C3 were independently verified; C4 awaits the final 5e90bd7 suite.

### coord · 2026-10-10T15:59:06.947Z

Reference correction for rev-12's verdict at 5e90bd7: the re-review artifact is A-657, not A-656. A-656 is impl-176's cancelled suite log, not a test failure. Recorded by the Coordinator at rev-12's request, since Reviewers may only post verdict comments.

### impl-176 · 2026-10-10T16:33:03.210Z

Full suite A-662 found six regressions at 5e90bd7. Targeted repro confirmed the new Sessions.launchRole dependency broke four existing launch seams, fixed kind literals violated configured tracker levels, and role-list insertion changed a CLI refusal diagnostic. Fix resolves omitted item-launch roles in the dispatcher via its existing store and rechecks the assignment across awaits, uses tracker.levels for Lead launch/claim admission, and appends Lead to the diagnostic role list. Added a real-hub custom-container launch test, red before the fix and green after. Existing failing tests remain intact.

### rev-12 · 2026-10-10T16:35:55.022Z

verdict: review
result: clear
by: rev-12 [reviewer]
run: rev-12-20261010-176-3
commit: 88feb1966359ff963ceda0dbb23f6b941dccd372

No remaining high or medium findings. Dispatcher normalization preserves the preassigned Lead launch fix, keeps permission checks on the original frame and rechecks inferred roles across awaits. Removing the Sessions helper restores existing collaborator interfaces. Launch/claim admission now uses configured tracker.levels, and role-list append preserves CLI diagnostics. Separate Standards and Spec delta reviews are complete; prior full-item ownership/refusal/routing/UI checks remain applicable.

Low — hub/src/roles/default-roles.ts:80: the Lead clause says epic or release although configured containers may be named feature or initiative; generic container wording would match the README. Nonblocking.

C1–C3 verified. Independent typecheck and diff check passed at 88feb19; A-663 reports 37 targeted tests passing. Writing E2E tests were inspected, not rerun in this read-only reviewer sandbox. C4 stays unverified until the stable-head full rerun completes.

Review A-664: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-664-t-176-re-review-at-88feb19-regressions-fixed-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-10T18:07:28.302Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-176-1
commit: 88feb1966359ff963ceda0dbb23f6b941dccd372

C4 verified. A-699 records npm run typecheck and the completed all-suite run at the unchanged reviewed head: hub 1029/1029 and Neovim 233/233, with zero failures, cancellations, skipped tests or todos in both phases. The log includes the T-176 explicit/preassigned/configured-container Lead and panel tests. Worktree HEAD and branch match 88feb19 and the worktree is clean. Independent typecheck also passed; writing full suites were inspected from durable evidence rather than rerun in the read-only Reviewer sandbox.

No code delta and no new high/medium findings. Carry forward C1–C3 and the separate Standards/Spec clear review rev-12-20261010-176-3 at this exact commit (A-664). Low — hub/src/roles/default-roles.ts:80 retains the prior nonblocking epic/release wording; corrected instance handover lines are A-665.

Review A-700: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-700-t-176-c4-verification-at-88feb19-full-suite-clear.md. Criteria: C4 newly verified; C1–C3 retain prior exact-head verification.

Criteria: C4 verified.

### impl-176 · 2026-10-10T18:08:35.872Z

Coordinator merge gate found conflicts after dev gained T-143/T-181/T-183. Merging origin/dev at 5f435ad: preserve new task.plan grants for existing roles and T-143's verifier loop; keep Lead role/grants and both Neovim documentation additions. Also align built-in Lead/Coordinator launch clause wording with corrected configured-container handover A-665 while a new permissions suite rerun is required. Targeted permissions/item-lead checks, typecheck, delta review, and persistent full rerun follow.

### rev-13 · 2026-10-10T19:22:56.013Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-176-2
commit: 1e25f991871169c49863dda4e2c0c554c49e1208

No high or medium findings. Finalizes A-706's held merge inspection at the unchanged clean head: both Standards and Spec passes preserve dev plan grants/dispatcher facts, Coordinator-only Lead launch, configured-container ownership/routing, T-143's item loop and Lead/crew documentation. Built-in configured-container clauses now match A-665, fixing the prior low wording finding.

C1–C4 verified. A-721 records complete post-merge typecheck and all-suite output: hub 1043/1043, Neovim 234/234, zero failures/cancellations/skips/todos. The claimant reports command exits 0. Relevant Lead launch/direct-address/container/panel regressions are present. Independent typecheck/diff check and pure permission probes from A-706 remain applicable to the unchanged head. Writing full suites inspected from durable evidence rather than independently rerun in the read-only sandbox.

Final review A-722: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-722-t-176-final-review-1e25f99-merge-and-full-suite-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-10T19:23:13.308Z

Merged f95843fcc6fac6448f4456d478c1a28201feb046 onto dev.
