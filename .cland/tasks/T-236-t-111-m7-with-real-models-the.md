---
id: T-236
kind: task
title: "T-111 M7 with real models: the Coordinator follows through on an Aide's
  decision, run in a scratch project"
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1.1
  - ready-for-agent
assignee: impl-236
parent: E-231
blocked_by: []
topic: topic-150
branch: t/T-236-t-111-m7-with-real-models-the
created: 2026-10-11T17:48:35.701Z
updated: 2026-10-11T20:15:36.442Z
closed: 2026-10-11T20:15:36.730Z
---

## What to build

Run the check deferred from T-111 (M7, decision D19) with real models: in a scratch project, an Aide on real Claude Code records a decision on behalf of the human, and the Coordinator, also on real Claude Code, follows through on it. That means acting on the decision and not merely acknowledging it, as T-111's brief M7 describes. Record the run, its transcript excerpts and the verdict as a QA artifact. This needs no product change unless the run finds one; file any finding as `qa-found`.

## Acceptance criteria

- [x] C1. The run uses real Claude Code sessions for both the Aide and the Coordinator in a scratch project, never the root project's sessions.
  - done: impl-236 · 2026-10-11T20:12:50.854Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T236-1 · 2026-10-11T20:15:07.497Z · commit a1211e1f304f051a1dfb62e504278383300c3e20
- [x] C2. The Coordinator acts on the Aide's decision as M7 expects, shown by the journal and the resulting tracker or session changes.
  - done: impl-236 · 2026-10-11T20:12:51.443Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T236-1 · 2026-10-11T20:15:07.498Z · commit a1211e1f304f051a1dfb62e504278383300c3e20
- [x] C3. A QA artifact records the setup, evidence and verdict.
  - done: impl-236 · 2026-10-11T20:12:51.742Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T236-1 · 2026-10-11T20:15:07.498Z · commit a1211e1f304f051a1dfb62e504278383300c3e20

## Comments

### impl-236 · 2026-10-11T20:06:54.335Z

Claimed; base dev 803a61bc9b06cfc8aead3a7032226b3e94866539. Read T-111 M7 and its qa-15 deferral (D19). Will run real Claude Code Coordinator and aide-1 on claude-sonnet-5-5 in a fresh /tmp project, with all inherited CLAND_* removed. Evidence-only; no suite unless product code changes.

### impl-236 · 2026-10-11T20:13:32.952Z

M7 PASS via direct-send continuation, with real Claude Code Aide and Coordinator on claude-sonnet-5-5. Aide created two tasks, edited a third, and sent a decision; Coordinator called task.rank and changed Beta 30 → 19 before Alpha 20. Evidence A-1366 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1366-t-236-m7-pass-real-aide-decision-and-coordinator-action-t-249-finding (README.md plus command/journal/transcript/tracker/cleanup files). Launch briefs separately failed; Coordinator filed qa-found T-249. Both scratch sessions and scratch hub stopped; all recorded PIDs absent. C1–C3 marked done. Evidence report committed on task branch; no product code or suite.

### rev-17 · 2026-10-11T20:15:07.498Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261011-17-T236-1
commit: a1211e1f304f051a1dfb62e504278383300c3e20

No findings (high/medium/low); Standards and Spec clear. C1 verified from A-1366 scratch launch commands, real Claude Code native transcripts/model records and journal identities; inherited CLAND_* stripped and scratch discovery asserted. C2 verified by Aide's two creates/title edit and decision envelope, Coordinator's native task.rank(T-3,before=T-2), matching journal actor and tracker rank 30→19. No driver/human rank operation. C3 verified by durable artifact A-1366 setup/evidence/PASS and committed qa/reports/T-236.md. Cleanup journal/command records confirm both sessions and hub stopped; final PID/discovery checks recorded. M7 PASS is limited to direct-send continuation; launch-brief failure remains separate qa-found T-249. Evidence-only scope, no product source changes or suite required. Review A-1367: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1367-t-236-review-real-model-m7-evidence-clear-at-a1211e1.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-11T20:15:36.442Z

Merged 98cf016b95a8e714ab51826aabfaf130aa7eaeba onto dev.
