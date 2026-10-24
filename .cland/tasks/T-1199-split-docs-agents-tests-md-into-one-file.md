---
id: T-1199
kind: task
title: Split docs/agents/tests.md into one file per test file under docs/agents/tests/ with an index
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-926
branch: t/T-1199-split-docs-agents-tests-md-into-one-file
created: 2026-10-24T06:46:04.520Z
updated: 2026-10-24T06:58:06.662Z
---

## Summary

123 of 166 v0.2 landings edited docs/agents/tests.md (2,929 lines); parallel lanes conflicted on adjacent paragraphs and cost extra review and verify rounds (E-419 stage 2). Absorbs T-1070. Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. Every paragraph moves to the file named after its test file with an index listing them, and two branches that each document a different test merge without conflict in a scratch merge (test).
  - done: impl-1199 · 2026-10-24T06:57:24.166Z
- [x] C2. Palette help expectations are split per area, so area items do not share one list (test).
  - done: impl-1199 · 2026-10-24T06:57:24.233Z

## Comments

### impl-1199 · 2026-10-24T06:54:38.392Z

Implementation in progress: 78 per-test documents plus index; legacy heading anchors retained and guarded. C1 scratch native Git merge went red on the absent directory, then green after the split (local Darwin arm64, working tree). C2 Web test went red on missing palette-help/inbox.json after the bundle was built; with seven per-area literal fixtures, the complete palette file passes 11/11. Original prose block audit finds no absent blocks after only relative-link rebasing and extracting the existing palette sentence. npm run build passed; npm run check and documentation consumer checks follow.
