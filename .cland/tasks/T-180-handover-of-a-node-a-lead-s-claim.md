---
id: T-180
kind: task
title: "Handover of a node: a Lead's claim, subscriptions and note move to the next Lead"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-180
parent: T-113
blocked_by:
  - T-176
  - T-177
topic: topic-115
branch: t/T-180-handover-of-a-node-a-lead-s-claim
created: 2026-10-10T15:38:36.547Z
updated: 2026-10-11T06:13:06.355Z
---

## Parent

T-113, slice 5 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

A node's lead claim moves with the handover note; claims and default subscriptions follow; the `handover` skill drafts a Lead's note.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-180 · 2026-10-11T05:08:05.375Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-180-1 · 2026-10-11T05:10:37.037Z
- [x] C2. Demo: `lead-1` hands its epic to `lead-2` mid-way, and the next verdict's event reaches `lead-2`.
  - done: impl-180 · 2026-10-11T05:08:05.497Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-180-1 · 2026-10-11T05:10:37.037Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-180 · 2026-10-11T05:08:05.657Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-180-1 · 2026-10-11T05:10:37.037Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-180 · 2026-10-11T06:12:27.160Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-180-2 · 2026-10-11T06:12:43.458Z

## Comments

### impl-180 · 2026-10-11T04:56:30.578Z

Claimed task worktree at dev 438e53e. Implementing node-scoped Lead handover records and recovery, transfer of the node claim/default subscriptions, and isolated role.state/note delivery. Tests will exercise the real hub/spoke protocol and fake harness handover/verdict routing; no UI change planned.

### impl-180 · 2026-10-11T05:08:05.788Z

Implemented and pushed 72412bc4c41ead29d20be794e9ec6e1e9a808d6d. Node-scoped records move the Lead claim, note, default subscriptions and pending question endpoints; independent Lead state survives rename/reconnect, and crash replay completes the tracker transfer. Human role.set/CLI names the node explicitly and unseen successors adopt provisional identity. Lead protocol 4/4 (A-1042), final demo/admission 1/1 (A-1047), Coordinator handover 4/4 (A-1043), ask chain 10/10 (A-1046), scoped permissions 5/5 (A-1045), Node24 typecheck pass. Exact two role-file edits in committed docs/agents/T-180-handover.md and durable A-1041. Fetched/merged origin/dev 438e53e before final suite, clean. C1-C3 done; C4 pending full suite.

### rev-13 · 2026-10-11T05:10:37.037Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-180-1
commit: 72412bc4c41ead29d20be794e9ec6e1e9a808d6d

No high or medium findings. Standards/Spec independently clear: synchronous node-scoped role/note/claim transfer preserves claimtime, independent nodes and stable identities; pending questions and derived default subscriptions follow successor. Durable pending record replays after crash; unseen human-selected successors adopt real identity. Live holder, claimed receiver and root Coordinator admission checks precede mutation. Exact role-file replacements match A-1041; handover skill drafts a node note.

Existing real frame/spoke/fake-harness tests prove next verdict reacheslead-2, independence/reconnect/replay/adoption/refusals. A-1042/1043/1045/1046/1047 inspected:24/24, zero fail/cancel/skip/todo. Independent typecheck/diff pass; clean pinned head. Writing suites not independently rerun. No UI change; no per-item QAbrief.

C1–C3 verified. C4 remains unverified pending complete same-head full result, so final readiness withheld. A-1052: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1052-t-180-review-at-72412bc-node-handover-c1-c3-clear-full-suite-pending.md

Criteria: C1 verified, C2 verified, C3 verified.

### impl-180 · 2026-10-11T06:12:27.282Z

Final-head suite 6b6de769 at 72412bc4c41ead29d20be794e9ec6e1e9a808d6d passed typecheck and both package phases: hub 1138/1138, Neovim 253/253, total 1391/1391, no failures/cancellations/skips/todo, exit 0. Durable log A-1090. Confirmed the task worktree remains clean on the tested/pushed head. C4 marked done; rev-13 final verification requested. C1-C3 remain verified from review rev-13-20261011-180-1; exact role-file handover A-1041.

### rev-13 · 2026-10-11T06:12:43.458Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-180-2
commit: 72412bc4c41ead29d20be794e9ec6e1e9a808d6d

No remaining high or medium findings. C4 explicitly verified at clean unchanged72412bc: A-1090 completeallrun6b6de769 executes typecheck+hub1138/1138+Neovim253/253, combined1391/1391,zero fail/cancel/skip/todo,exit0. Fullsuite includes handoverdemo/independentnotes/identity/crashreplay. Noexceptionapplied.

Priorparallel Standards/Spec C1–C3 review A-1052 standsatthissamehead; finalreadinessclear. LeadmarkedC4done. Full durable log inspectedread-only; writing suites notindependentlyrerun, githead/status/diffclean.

A-1091: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1091-t-180-final-c4-at-72412bc-full-1391-1391-clear.md

Criteria: C4 verified.

### coord · 2026-10-11T06:13:06.355Z

Merged 688f28cf196ac623b0e56e80dbc8f8121ed53f3f onto dev.
