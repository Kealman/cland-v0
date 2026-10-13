---
id: T-221
kind: task
title: "Cut the hub suite further: 40% shorter and under 5 minutes, measured
  back to back against dev"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
assignee: impl-221
parent: C-216
blocked_by:
  - T-214
topic: topic-133
branch: t/T-221-cut-the-hub-suite-further-40-shorter-and
created: 2026-10-11T10:13:17.213Z
updated: 2026-10-11T13:41:15.272Z
---

## Context

T-174 cut the hub phase from 999 s (A-1120, peak load 19.1) to 674 s at 80f356a (A-1177, peak load 15.6), 32.5% shorter. It merged on an amended ≥30% gate (cland-impl, 2026-10-11 10:20Z). The compile cache was dropped because of a Node 24 fault, now T-220. A-1156 assesses the three slowest test families. This item takes the rest of the gain. It is high priority, but it comes after T-214 (phases by diff).

## What to build

Fixture, setup and cleanup work on the slow families from A-1156 and T-174's C1 inventory. Keep the same seams and assertions, and skip no test.

## Acceptance criteria

- [ ] C1. The slow families named in A-1156 and T-174's C1 inventory are shortened. Every test that stays above 5 s is listed with its reason.
  - verified: rev-15 [reviewer] · run rev-20261011-15-T221-r2 · 2026-10-11T13:33:32.378Z
- [ ] C2. The hub phase is measured on this head and on a dev base run back to back, in the same load window. Both durations and their peak loads are recorded as an artifact. The head is at least 40% shorter than the A-1120 baseline (999 s), or at least 40% shorter than the paired dev run scaled to that baseline. Under 5 minutes is the target.
- [x] C3. No production defaults change. Test-only knobs are documented in hub/README.md.
  - done: impl-221 · 2026-10-11T11:31:03.771Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T221-r2 · 2026-10-11T13:27:52.791Z
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-221 · 2026-10-11T13:27:42.392Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T221-r2 · 2026-10-11T13:27:52.556Z

## Comments

### coord · 2026-10-11T11:08:34.641Z

Baseline note: T-174's real gain at equal load is 26.7% (732 s vs 999 s at about 19 peak load, A-1204). The 40% target is measured against 999 s at comparable load, with a dev run back to back.

### impl-221 · 2026-10-11T11:25:18.870Z

Baseline targeted runs established: doctor 18/18 in 74.917s (healthy parent 53.502s), index-lock parser case 10.497s (complete family still running), and linked-worktree discovery measured separately. First hypothesis: fake tool version/auth calls pay the MCP SDK import cost despite not using MCP. Moving imports into session/server paths preserves all responses and CLI seams; targeted doctor rerun underway. Full phase evidence will be paired against dev.

### rev-15 · 2026-10-11T12:19:10.460Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T221
commit: 6c70d8d7e8949401aed7a54383918bd565f58207

Medium — hub/test/tracker-ready.test.ts:146: fresh suite 949de498 (A-1251) fails the qa_default per-item=false rebased merge-gate case, so C4 does not pass. Typecheck passed; hub 1210/1211; Neovim did not run. This is outside Coordinator decision 667acf62's two moved-draft exceptions and cannot count as the first six-worker safety run. Failure cause is not established. Prior code review remains clear (A-1219); C1 inventory and C2 paired timing remain pending. Follow-up evidence artifact records duration 659.129s, peak load 25.10, and the exact exception boundary.

Criteria: C4 failed (Fresh suite 949de498 exits 1: tracker-ready.test.ts:146 times out at the rebased merge gate; Neovim phase never runs. Outside Coordinator run-1 exception.).

### impl-221 · 2026-10-11T12:20:03.381Z

Six-worker experiment A-1251 rejected per Coordinator: hub1210/1211, unchanged tracker-ready rebased merge-gate timeout; hub659.129s at peak25.10, no Neovim phase. Restored4workers in faa659f. Paired dev job75757803was cancelled by Coordinator before completion, so no paired timing claim is made. Applied supplied Neovim test fix7eb519c via cherry-pick8c75d7f; merging currentdev and running local typecheck/unchanged tracker-ready before new adjacent final4head/dev4pair. Original assertions retained.

### coord · 2026-10-11T13:41:15.272Z

Closed: gate not met, branch not merged (cland-impl decision, option a, 2026-10-11 13:45Z). The paired timing back to back: head 8ad5c69 hub phase 696.8 s at peak 14.9 (A-1271), dev 4846a44 695.4 s at peak 17.8 (A-1278), so no measurable gain. Six workers were rejected after a load timeout at peak 25.1 (A-1251). The fixture work shortened the doctor, index-lock and linked-worktree families by 2–7 s each without moving the phase. The inventory of all 145 hub tests over 5 s, with reasons, is A-1276. The cleanup and fake-harness changes stay on t/T-221-… unmerged, since they carry risk without a measured benefit. The suite side is exhausted at about 30% below the 999 s baseline (all of it from T-174); the next gains are queue-side (T-215, T-218), v0.1.1.
