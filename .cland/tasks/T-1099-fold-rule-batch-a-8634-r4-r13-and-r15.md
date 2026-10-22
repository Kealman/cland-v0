---
id: T-1099
kind: task
title: Fold rule batches A-8634 (R3 technique, R4–R13, R15) and A-9063 (R1–R6) into the docs, skills and brief templates
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-846
branch: t/T-1099-fold-rule-batch-a-8634-r4-r13-and-r15
created: 2026-10-22T08:50:55.821Z
updated: 2026-10-22T10:47:03.353Z
---

## Summary

The human approved rule batch A-8634 on 2026-10-22 (General, msg a9509902): R1 became rule 18, R2 edited rule 15, and R3 became rule 19. The batch's other recommendations are guidance rather than rules, and are to be folded into the documents A-8634 names: R4 to R13 and R15. This item makes those doc edits; R14 and R16 are dropped.

## Acceptance criteria

- [x] C1. Each of R4–R13 and R15 from A-8634 appears, in its recommended place (hub/README.md, docs/agents/tests.md, web/README.md, nvim/README.md, the qa, merge, release and writing-for-agents skills), as one short paragraph or bullet in the section A-8634 names, citing the source tickets; the item topic lists each fold with its file and section (doc).
  - done: impl-1099 · 2026-10-22T10:35:18.153Z
  - verified: rev-31 [reviewer] · run rev-20261022-1099-source · 2026-10-22T10:37:43.829Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01
  - verified: rev-31 [reviewer] · run rev-20261022-1099-final · 2026-10-22T10:47:03.245Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01
- [x] C2. Nothing in the folds contradicts rules 15, 17, 18 or 19 as recorded, and each kept upstream skill records the edit in `metadata.changes` (doc).
  - done: impl-1099 · 2026-10-22T10:35:18.232Z
  - verified: rev-31 [reviewer] · run rev-20261022-1099-source · 2026-10-22T10:37:43.830Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01
  - verified: rev-31 [reviewer] · run rev-20261022-1099-final · 2026-10-22T10:47:03.245Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01
- [x] C3. `npm run typecheck` passes and every skill touched still lints (test).
  - done: impl-1099 · 2026-10-22T10:35:18.282Z
  - verified: rev-31 [reviewer] · run rev-20261022-1099-final · 2026-10-22T10:47:03.245Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01
- [x] C4. The doc parts of batch 2 (A-9063) are folded the same way: R1's techniques into docs/agents/tests.md "Startup reply byte budgets (T-1038)" together with A-8634 R3's consumer inventory, and R2–R6 into the places A-9063 names, including the STAGE-BRIEF.md fixes (whole-directory tracker copy, fixture-owned census, result-frame intervals); the item topic lists each fold (doc).
  - done: impl-1099 · 2026-10-22T10:35:18.335Z
  - verified: rev-31 [reviewer] · run rev-20261022-1099-source · 2026-10-22T10:37:43.830Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01
  - verified: rev-31 [reviewer] · run rev-20261022-1099-final · 2026-10-22T10:47:03.245Z · commit 23c4154d436aff02d148d18f57b3a9e529205d01

## Comments

### impl-1099 · 2026-10-22T10:34:22.895Z

Drafted all approved A-8634/A-9063 folds across ten docs/templates, including rule-number pointers and writing-for-agents metadata.changes. Local macOS checks passed on the docs working tree: npm run typecheck (hub, Neovim, shared wire, Web), qa lint qa/briefs/E-413-stage-2.md, upstream skill provenance lint and valid YAML frontmatter for all four touched skills. Preparing exact review head after origin/dev integration.

### rev-31 · 2026-10-22T10:37:43.830Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1099-source
commit: 23c4154d436aff02d148d18f57b3a9e529205d01
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at23c4154d/treee9fb0578. A-9093 records Standards/Spec review against original A-8634/A-9063, exact named destinations/citations, current rules15/17/18/19 and upstream metadata. Topic fold inventory checked. C1/C2/C4 verified; C3 awaits exact-head mode-free check/verification. A-9092 original local pre-commit typecheck/provenance/frontmatter/QA-lint evidence accepted with disclosed source limits; no reviewer tests, browser,QA or suite pass claimed. No merge enqueue.

Criteria: C1 verified, C2 verified, C4 verified.

### impl-1099 · 2026-10-22T10:46:43.574Z

Mode-free verification ca43d275-f718-40fa-a976-11f76efa2dd6 finished passed at reviewed head 23c4154d436aff02d148d18f57b3a9e529205d01. A-9100 is the original log. Linux x64 6.8.0-142-generic droplet c-8 lon1, Node 24.21.0, Neovim 0.12.5; lifetime 462 s, cost $0.0321. T1, fallback full T2 (hub and Neovim), and Web completed, 2435 tests / 2435 pass / zero fail, cancelled or skipped. T3/T4 absent. Typecheck was host-gate reuse at fb4563a5a9bf0763024966617371c87f70dc7132, explicitly not repeated remotely. Test lint and duration budgets were report-only, with diagnostic findings retained in the log; no enforce-mode budget pass is claimed. Source head unchanged; awaiting Reviewer's C3/final evidence settlement. No merge enqueue.

### rev-31 · 2026-10-22T10:47:03.245Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1099-final
commit: 23c4154d436aff02d148d18f57b3a9e529205d01
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C4 at unchanged23c4154d/treee9fb0578. A-9101 audits exact-head ca43d275/A-9100:2435/2435,LinuxT1/fullfallbackT2/Weball0; host check typecheck/build/static/provenance completed,0refusals. Original four-skill frontmatter and QA-lint receipts A-9092 retained with source limits; source folds/rule compatibility A-9093. Docs-only,no new test/load repetition claim; T3/T4/QA not claimed. Report-only diagnostics qualified. No merge/enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
