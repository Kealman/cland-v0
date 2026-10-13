---
id: E-231
kind: epic
title: "v0.1.1 hygiene"
state: closed
criterion_seq: 2
labels:
  - epic
  - v0.1.1
assignee: null
parent: R-227
blocked_by: []
topic: topic-155
branch: null
created: 2026-10-11T17:48:08.653Z
updated: 2026-10-11T21:06:42.985Z
---

## Goal

v0.1.1 closes two loose ends from v0.1 that need no design: the top bar's needs-you chip agrees with the inbox, and the Coordinator's follow-through on an Aide's decision is proven with a real model.

## Contents

The bug part of the human's observation 2 (the chip said "needs you 98" while the inbox said "nothing needs you"), and the D19 deferral T-111 M7 run with real Claude Code sessions in a scratch project (decision D21).

## Definition of done

QA runs the demo below on `dev` and records a clear verdict on this epic with each checkbox verified by its id.

- [ ] C1. The needs-you chip and the inbox count the same entries in every layer configuration, covered by a headless test.
  - verified: qa-19 [qa] · run qa-20261011-19-T231-4 · 2026-10-11T21:06:28.221Z · commit ef7c9101ae07f3fdafd1b100280f01d91097c7d8
- [ ] C2. With real Claude Code sessions in a scratch project, the Coordinator follows through on an Aide's decision as T-111 M7 describes, recorded in a QA artifact.
  - verified: qa-19 [qa] · run qa-20261011-19-T231-4 · 2026-10-11T21:06:28.221Z · commit ef7c9101ae07f3fdafd1b100280f01d91097c7d8

## Plan

```yaml
stages:
  - name: hygiene
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-235
      - - T-236
```

## Comments

### qa-19 · 2026-10-11T21:06:28.221Z

verdict: qa
result: clear
by: qa-19 [qa]
run: qa-20261011-19-T231-4
commit: ef7c9101ae07f3fdafd1b100280f01d91097c7d8

| case | surface | result | evidence run and capture |
| --- | --- | --- | --- |
| M0 | hub-api | PASS | qa-20261011-19-T231-1: M0.json |
| M1 | hub-api | PASS | qa-20261011-19-T231-1: M1-nvim-test-needs-you.test.ts-1.json, M1-nvim-test-layers.test.ts-1.json, M1-hub-test-visibility.test.ts-1.json, M1-hub-test-asks.test.ts-1.json, M1-hub-test-asks-cli.test.ts-1.json |
| THREAD-009 | headless-grid | PASS | qa-20261011-19-T231-1: now-count-120.screen.txt, now-count-120.state.json, THREAD-009.screen.txt, THREAD-009.state.json |
| THREAD-010 | headless-grid | PASS | qa-20261011-19-T231-1: now-count-80.screen.txt, now-count-80.state.json, THREAD-010.screen.txt, THREAD-010.state.json |
| M2 | headless-grid | PASS | qa-20261011-19-T231-3: a-s0.json, a-commands.json, a-config.toml |
| M3 | headless-grid | PASS | qa-20261011-19-T231-3: a-s1.json, a-s2.json, a-s3.json, a-s4.json, a-s5.json, a-s6.json, a-s7.json, a-actions.json |
| M4 | headless-grid | PASS | qa-20261011-19-T231-3: a-cold.json |
| M5 | headless-grid | PASS | qa-20261011-19-T231-3: b-s0.json, b-commands.json, b-config.toml |
| M6 | headless-grid | PASS | qa-20261011-19-T231-3: b-muted.json, b-reset.json, b-cold.json, b-actions.json |
| M7 | headless-grid | PASS | qa-20261011-19-T231-3: c-s0.json, c-commands.json, c-config.toml |
| M8 | headless-grid | PASS | qa-20261011-19-T231-3: c-s1.json, c-s2.json, c-s3.json, c-s4.json, c-s5.json, c-s6.json, c-s7.json, c-actions.json, c-cold.json |
| M9 | hub-api | PASS | qa-20261011-19-T231-3: M9.json |
| M10 | hub-api | PASS | qa-20261011-19-T231-3: M10.json |
| M11 | hub-api | PASS | qa-20261011-19-T231-4: M11.json |
| M12 | hub-api | PASS | qa-20261011-19-T231-4: M12.json |
| M13 | hub-api | PASS | qa-20261011-19-T231-4: M13.json |
| M14 | hub-api | PASS | qa-20261011-19-T231-4: M14.json |

High findings: none.
Medium findings: none.
Low product findings: none.

Build: dev ef7c9101ae07f3fdafd1b100280f01d91097c7d8, unchanged through all checks and final build check. Only live tracker files changed. Final verdict run: qa-20261011-19-T231-4. This continuation consolidates PASS evidence from run 1 (M0, M1, THREAD-009/010), run 3 (M2–M10), and run 4 (M11–M14); no completed passing case was needlessly rerun. All commands/captures and original runs.jsonl lines are included.

C1: all five targeted test files passed (3 needs-you + 16 layers + 15 visibility + 11 asks + 4 asks-cli = 49 tests), zero skipped or failed. Both THREAD cases passed. Scratch A/B/C passed all stated count, layer, row and cold-client checks. All pin/mute actions used real workbench keys, with row identity confirmed; no frame fallbacks were needed. Raised role/clear notifications were rendered in Now without counting, while not-clear stayed warn/Watch. C s1 removed the ask from Watch while needsYou remained zero. Commands, inbox JSON, state values and both screen captures are preserved per step.

C2: T-236 is closed with its review marks; A-1366 has all 13 expected files and A-1367 exists. Real Claude Code/Sonnet 5.5 Coordinator and Aide are independently identified by launches and native transcripts. Decision 058935e2-785d-4459-9319-b5b685125da7 was delivered and injected before the sole task.rank, by coord-m7 with {id:T-3,before:T-2}; tracker rank changed 30→19 ahead of Alpha at 20. No human or Aide rank occurred. Cleanup records, present process checks, missing scratch hub discovery and zero matching root-journal rows corroborate isolation. commands.jsonl cland_env={} describes the sanitized subprocess wrapper, not the parent shell. R1 was skipped as requested. T-249 remains outside this epic; M0 recorded it open/in review under T-229.

QA driver interruptions (preserved, superseded by completed checks):
- Run 1 M3 was recorded FAIL when the driver toggled an already-open Topics panel closed; the screenshot itself shows the expected needs-you count 2. This was driver navigation, not a product discrepancy.
- Run 2 M3 was recorded FAIL because a broad TOPICS text search matched the inbox's WAITING FOR YOU · TOPICS subheading. The driver was corrected to inspect the visible Topics buffer. M2–M4 were then rerun in a fresh scratch project under run 3 and all passed.
- Run 3 M11 was recorded FAIL because the assertion counted task.list/task.view reads along with the Aide's mutations. Direct inspection confirmed exactly two task.create and one task.edit; corrected validation of the unchanged artifact completed M11–M14 under run 4. No product or source files were fixed.

Criteria marks: verify C1 and C2 by position, matching the two Definition-of-done texts. There are no failed criteria. Scratch workbenches, drivers, workers and hubs all stopped; final process scan found none of this run's processes. Root sessions were never launched, stopped or reconfigured.


Evidence artifact A-1393: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1393-t-231-qa-clear-hygiene-demo-and-a-1366-verification/README.md. All owned scratch directories removed after cleanup checks.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-11T21:06:42.985Z

Closed on QA run qa-20261011-19-T231-4 (A-1393): clear at dev ef7c910, C1 and C2 verified. M0–M14 and THREAD-009/010 passed, with 49 targeted tests. C2 was checked against A-1366 read-only (T-236's real-model M7 pass). No product findings; the run's own finding during T-236 is T-249.
