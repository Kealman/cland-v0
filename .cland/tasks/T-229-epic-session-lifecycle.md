---
id: T-229
kind: epic
title: "Epic: Session lifecycle"
state: closed
criterion_seq: 6
labels:
  - epic
  - v0.1.1
assignee: null
parent: T-227
blocked_by: []
topic: topic-167
branch: null
created: 2026-10-11T17:48:08.410Z
updated: 2026-10-12T02:59:04.542Z
---

## Goal

Sessions stop, die, reconnect and hand over work in ways the hub records correctly: a clean stop is never a death, a stop is never refused on a stale identity, a role request never vanishes, and the hub's process and tracker ownership survive restarts and load.

## Contents

Ten known defects from the v0.1 run (tech debt T-216, decision D21): T-147, T-222, T-226, T-202, T-129, T-102, T-211, T-170, T-103 and T-137.

## Definition of done

QA runs the demo below on `dev` in a scratch project with the fake harnesses and records a clear verdict on this epic with each checkbox verified by its id.

- [ ] C1. A post-merge or manual stop of a Codex, Claude Code or OpenCode session is recorded as stopped, never died, and `cland session stop` succeeds or names a real cause (T-147, T-222).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T02:58:47.280Z · commit 983462e595840fccd0f2d2ab8b7663bd04425b97
- [ ] C2. A role-addressed review or QA request either reaches a verifier or tells the sender exactly why not, with no silent loss (T-226).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T02:58:47.280Z · commit 983462e595840fccd0f2d2ab8b7663bd04425b97
- [ ] C3. Ownership and recovery hold across a hub restart and overlapping doctors: no orphaned processes, no stranded pending cleanup, and a pooled Implementer moves to its next item's worktree (T-129, T-102, T-211).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T02:58:47.280Z · commit 983462e595840fccd0f2d2ab8b7663bd04425b97
- [ ] C4. Reopening a merged item no longer blocks `cland push` or strands a worktree; a nameless spoke retries into a clear refusal (T-170, T-202).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T02:58:47.280Z · commit 983462e595840fccd0f2d2ab8b7663bd04425b97
- [ ] C5. A hung tracker write times out with a named error instead of stalling all tracker work, and OpenCode approvals show their command (T-103, T-137).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T02:58:47.280Z · commit 983462e595840fccd0f2d2ab8b7663bd04425b97
- [ ] C6. hub/README.md and the affected skills describe the changed behaviour.
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T02:58:47.280Z · commit 983462e595840fccd0f2d2ab8b7663bd04425b97

## Plan

```yaml
stages:
  - name: stop and routing
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-147
        - T-222
      - - T-226
      - - T-202
      - - T-249
  - name: ownership and recovery
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-129
        - T-102
      - - T-211
      - - T-170
  - name: tracker and approvals
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-103
      - - T-137
      - - T-252
```

## Comments

### qa-22 · 2026-10-12T02:58:47.280Z

verdict: qa
result: clear
by: qa-22 [qa]
run: qa-2026-10-12-22
commit: 983462e595840fccd0f2d2ab8b7663bd04425b97

| Case | Surface | Result | Evidence |
|---|---|---|---|
| M0 | hub-api | PASS | [M0.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M0.log) |
| M1 | hub-api | PASS | [M1.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M1.log) |
| M2 | hub-api | PASS | [M2.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M2.log) |
| M3 | hub-api | PASS | [M3.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M3.log) |
| M4 | hub-api | PASS | [M4.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M4.log) |
| M5 | hub-api | PASS | [M5.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M5.log) |
| M6 | hub-api | PASS | [M6.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M6.log) |
| M7 | hub-api | PASS | [M7.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M7.log) |
| M8 | hub-api | PASS | [M8.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M8.log) |
| M9 | hub-api | PASS | [M9.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M9.log) |
| M10 | hub-api | PASS | [M10.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M10.log) |
| M11 | hub-api | PASS | [M11.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M11.log) |
| M12 | hub-api | PASS | [M12.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M12.log) |
| M13 | hub-api | PASS | [M13.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M13.log) |
| M14 | hub-api | PASS | [M14.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M14.log) |
| M15 | hub-api | PASS | [M15.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M15.log) |
| M16 | hub-api | PASS | [M16.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M16.log) |
| M17 | hub-api | PASS | [M17.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M17.log) |
| M18 | hub-api | PASS | [M18.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M18.log) |
| M19 | headless-grid | PASS | [M19.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M19.log) |
| M20 | hub-api | PASS | [M20.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M20.log) |
| M21 | hub-api | PASS | [M21.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M21.log) |
| M22 | hub-api | PASS | [M22.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M22.log) |
| M23 | hub-api | PASS | [M23.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/M23.log) |
| PANELS-010 | headless-grid | PASS | [approval-details.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/approval-details.screen.txt), [approval-details.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/approval-details.state.json), [idle-details.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/idle-details.screen.txt), [idle-details.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/idle-details.state.json), [PANELS-010.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/PANELS-010.screen.txt), [PANELS-010.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/PANELS-010.state.json) |

Findings: none (high, medium or low). All 25 checks in scope passed: M0–M23 and PANELS-010.

Build: `983462e595840fccd0f2d2ab8b7663bd04425b97` on dev, unchanged at final recheck. Run: `qa-2026-10-12-22`; QA: `qa-22`. Only the live tracker hold modified the root checkout. No product changes made.

195 targeted tests passed, zero failures/cancellations/skips: M2 14; M3 4; M4 83 (five recovery passes of four plus 63 reservation tests); M5 22; M6 7; M7 10; M8 53; M9 2. Prior A-1489 recovery evidence independently inspected: all 20 isolated and 20 induced-load runs passed with no uncaught rollout error. One test file ran at a time. No integrated suite was run and no machine suite lock was acquired or modified.

Live evidence establishes first-attempt manual stops for Claude Code/Codex/OpenCode and automatic post-merge stop without false death reports; one-time brief delivery; queued verifier durability and explicit refusal; nameless nonconnection; safe merged-item cleanup and local publication; pooled native-context handoff into the next worktree; OpenCode shell/edit/fallback approval text and clearing in the Neovim grid; preserved process identities across restart; and named tracker stalls with bounded shutdown. The held tracker test reported the 5000 ms stall and shut down in 2117 ms, with both writes unpublished, both callers returned errors, and clean restart accepted a new write.

Coordinator rulings (topic-167), original observations preserved in logs:
- M10, `6b619d47-2769-465e-897a-4c2378f31763`: local territory origin is permitted. Only the scratch-local origin existed; no github or network remote.
- M17(d), `ce66af27-d459-4170-a1d1-c784b6754662`: creating a topic for a closed item is correctly refused. Corrected fresh fixture bound its topic before merge; post-merge discussion then local push succeeded directly, with no pending-merge refusal or rerun.
- M19, `3077bc70-64c5-4a74-a1bc-64131a9ee39d`: retained pool size 1 correctly refused the extra launch. Scratch coord restored size 3 through crew set before continuing; root crew untouched.
- M20(c), `6b003bbf-06d1-4826-ada7-290377d1b6f0`: forbidden General pong is expected for Implementers. All three sessions have after-restart injected journal evidence, authenticated spoke audit calls and subsequent idle. No grants changed or messages resent.
- Driver representation correction in M15: queued request retains role recipient `["reviewer"]`, stage queued, with no selected session. Once released it became `["rev"]` exactly once. This was an assertion-shape correction, not a product mismatch.

Criteria verified in this run:
- C1 = M2, M11, M12, M13: stops and accurate refusal.
- C2 = M3, M15: verifier delivery or explicit reason.
- C3 = M4, M5, M6, M18, M20: recovery, termination ownership, pool handoff and restart.
- C4 = M7, M16, M17: merged-item safety and nameless clear refusal under T-202 reading.
- C5 = M8, M19, M21, PANELS-010: tracker stall detection/bounded shutdown under D23; OpenCode approval command. Serving-time fail-fast remains deferred to T-253 by the agreed scope.
- C6 = M22: README and skill contracts present, including OpenCode source-message lookup; no outdated Neovim approval sentence.

M23: all scratch sessions, driver spokes, Neovim and hub stopped; scratch folders removed after evidence capture. Machine lock listing identical to M1. No scratch hub log or journal names the machine suite lock. The live root crew and root stale T-165 worktree were not manipulated.

Evidence includes runs.jsonl, commands/assertions and full outputs in each M*.log, scratch hub log/journal, fake logs, and Neovim screen/state captures. The four M19 screen files show shell command, cleared details, edit fallback and source-less shell fallback.

Artifact: A-1499 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1499-t-229-epic-qa-at-983462e-all-25-checks-clear/report.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
