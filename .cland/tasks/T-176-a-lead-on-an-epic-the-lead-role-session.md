---
id: T-176
kind: task
title: "A Lead on an epic: the lead role, session.launch naming an epic gives its lead claim, only the Coordinator launches Leads"
state: open
status: review
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
updated: 2026-10-10T15:59:06.947Z
---

## Parent

T-113, slice 1 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `lead` role in `roles.toml` and `cland init`; `session.launch` naming an epic gives the session that node's lead claim, one per node; only the Coordinator launches Leads; the panels show the Lead on its epic.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-176 · 2026-10-10T15:57:08.902Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-2 · 2026-10-10T15:58:33.215Z
- [x] C2. Demo: the Coordinator launches `lead-1` on a v0.1 epic, and `@lead T-<epic>` reaches it.
  - done: impl-176 · 2026-10-10T15:47:43.469Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-1 · 2026-10-10T15:55:28.716Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-2 · 2026-10-10T15:58:33.215Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-176 · 2026-10-10T15:47:43.864Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-1 · 2026-10-10T15:55:28.879Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-2 · 2026-10-10T15:58:33.215Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

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
