---
id: T-187
kind: task
title: "The plan view before the start: gp, stages with lanes as columns, QA lines, the approval card"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-187
parent: T-114
blocked_by:
  - T-183
topic: topic-99
branch: t/T-187-the-plan-view-before-the-start-gp-stages
created: 2026-10-10T15:38:38.260Z
updated: 2026-10-10T18:11:28.498Z
---

## Parent

T-114, slice 5 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

`gp`, the header, the stage boxes with lanes as columns, the QA lines, the start and close lines, the approval card with `a`, `d` and `e`, the right column, and the items panel filtered to the epic with stage tags.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-187 · 2026-10-10T18:09:50.510Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-187-2 · 2026-10-10T18:11:28.498Z
- [x] C2. Demo: the human opens `gp` on an epic that has not started; `a` sends the approval request and shows the hub's answer (until T-186 adds approval, the hub's refusal, with the card unchanged).
  - done: impl-187 · 2026-10-10T18:02:22.324Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-187-1 · 2026-10-10T18:04:43.705Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-187-2 · 2026-10-10T18:11:28.498Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-187 · 2026-10-10T18:01:49.093Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-187-1 · 2026-10-10T18:04:43.839Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-187-2 · 2026-10-10T18:11:28.498Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

## Comments

### impl-187 · 2026-10-10T17:52:54.174Z

Claimed in the task worktree. Building the before-start plan view from task.plan show, with gp/palette entry, stage/lane cards and scoped item tags. Hub task.plan currently supports set/show only; a will issue approve and surface the missing-operation refusal without inventing approval state or adding hub approval.

### impl-187 · 2026-10-10T18:01:49.199Z

Implementation committed and pushed at 6ed5f9d. Real-hub/headless-Neovim targeted tests pass (2/2); typecheck passes; nvim README documents the view and approval dependency. Evidence A-697. C1/C3 done; C2 remains unchecked because task.plan approve and approval metadata are absent in the merged hub. The a key exercises and displays the real hub refusal, per Coordinator's bounded assignment. Neovim package suite is next.

### rev-13 · 2026-10-10T18:04:59.769Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-187-1
commit: 6ed5f9d7170754ee4a0938c0014af641967ba671

Medium — nvim/lua/cland/plan.lua:48 (event order at nvim/lua/cland/init.lua:236): resolving ownership after apply_event loses the old epic on child removal/reparenting, so its cached plan is not refetched and misses invalid membership errors. Independent headless probes confirmed both cases.
Medium — nvim/lua/cland/plan.lua:207: header omits available Lead harness/model/state required by §3.13; only the session label is rendered.
Medium — nvim/lua/cland/plan.lua:159: lane rows omit the claim/verdict marks explicitly required by §3.13's shared layout.
Low — nvim/lua/cland/plan.lua:290: valid tilde/longer-backtick Plan fences yield an empty YAML excerpt.
Low — nvim/lua/cland/plan.lua:372: panel header uses raw session name instead of required name [Role] (nvim/README.md:32).
Low, judgment call — possible duplicated effective-QA traversal in plan.lua:120/:168; consider sharing gate/count resolution.

C1 failed. C2/C3 verified separately against Coordinator's revised approval-request/refusal criterion and the docs. C4 unverified pending full Neovim suite. Independent typecheck/diff check and read-only width/owner/event probes passed except the reproduced cache issue; A-697's real daemon/headless 2/2 coverage inspected, not independently rerun in the read-only sandbox. Outside-blocker direction matches the full accepted mockup; no finding there.

Separate Standards/Spec reports and evidence: A-698 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-698-t-187-review-6ed5f9d-live-plan-and-presentation-gaps.md.

Criteria: C1 failed (Removing/reparenting a planned child leaves its old epic cache stale; required Lead harness/model/state and lane claim/verdict marks are missing.).

### impl-187 · 2026-10-10T18:09:50.637Z

Review A-698 fixed and pushed at 53aff50. Former-owner invalidation happens before task replacement/removal, then new-owner invalidation; Lead metadata and lane claim/verdict marks now use the shared session/board facts. Low findings also resolved (role labels, longer/tilde YAML fences, shared effective-policy resolution). Targeted regressions 4/4, typecheck and diff checks pass. Evidence A-702. Original serialized Neovim suite command remains active; final package validation on this new head follows its completion.

### rev-13 · 2026-10-10T18:11:28.498Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-187-2
commit: 53aff50e42c431445d01a24d461012b1af560715

No remaining high or medium findings. A-698's former-owner invalidation, Lead metadata and lane claim/verdict gaps are fixed; source fence support, scoped Lead label and shared effective QA resolution also improved. Separate Standards/Spec delta reviews completed. Independent typecheck, diff check and read-only headless probes passed for ownership invalidation, metadata/marks/source and narrow/wide fitting. A-702's real-hub/stub/headless 4/4 coverage inspected, not independently rerun in read-only sandbox.

Low — nvim/lua/cland/plan.lua:162: verifier hold names still lack role fallback if their session snapshot is absent (nvim/README.md:32); nonblocking.

C1–C3 verified; C4 remains unverified pending the package suite at this fixed head. Review artifact in topic-99: T-187 re-review 53aff50 — C1 fixes clear.

Criteria: C1 verified, C2 verified, C3 verified.
