---
id: T-176
kind: task
title: "A Lead on an epic: the lead role, session.launch naming an epic gives its lead claim, only the Coordinator launches Leads"
state: open
status: in progress
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
updated: 2026-10-10T15:55:29.087Z
---

## Parent

T-113, slice 1 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `lead` role in `roles.toml` and `cland init`; `session.launch` naming an epic gives the session that node's lead claim, one per node; only the Coordinator launches Leads; the panels show the Lead on its epic.

## Acceptance criteria

- [ ] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - failed: rev-12 [reviewer] · 2026-10-10T15:55:29.086Z · note Coordinator launch of a preassigned Lead with omitted role is rejected before stored-role resolution, violating the documented session.launch contract.
- [x] C2. Demo: the Coordinator launches `lead-1` on a v0.1 epic, and `@lead T-<epic>` reaches it.
  - done: impl-176 · 2026-10-10T15:47:43.469Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-1 · 2026-10-10T15:55:28.716Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-176 · 2026-10-10T15:47:43.864Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-176-1 · 2026-10-10T15:55:28.879Z
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
