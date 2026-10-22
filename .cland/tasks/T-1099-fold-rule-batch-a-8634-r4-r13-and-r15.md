---
id: T-1099
kind: task
title: Fold rule batches A-8634 (R3 technique, R4–R13, R15) and A-9063 (R1–R6) into the docs, skills and brief templates
state: open
status: backlog
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-22T08:50:55.821Z
updated: 2026-10-22T08:57:58.236Z
---

## Summary

The human approved rule batch A-8634 on 2026-10-22 (General, msg a9509902): R1 became rule 18, R2 edited rule 15, and R3 became rule 19. The batch's other recommendations are guidance rather than rules, and are to be folded into the documents A-8634 names: R4 to R13 and R15. This item makes those doc edits; R14 and R16 are dropped.

## Acceptance criteria

- [ ] C1. Each of R4–R13 and R15 from A-8634 appears, in its recommended place (hub/README.md, docs/agents/tests.md, web/README.md, nvim/README.md, the qa, merge, release and writing-for-agents skills), as one short paragraph or bullet in the section A-8634 names, citing the source tickets; the item topic lists each fold with its file and section (doc).
- [ ] C2. Nothing in the folds contradicts rules 15, 17, 18 or 19 as recorded, and each kept upstream skill records the edit in `metadata.changes` (doc).
- [ ] C3. `npm run typecheck` passes and every skill touched still lints (test).
- [ ] C4. The doc parts of batch 2 (A-9063) are folded the same way: R1's techniques into docs/agents/tests.md "Startup reply byte budgets (T-1038)" together with A-8634 R3's consumer inventory, and R2–R6 into the places A-9063 names, including the STAGE-BRIEF.md fixes (whole-directory tracker copy, fixture-owned census, result-frame intervals); the item topic lists each fold (doc).
