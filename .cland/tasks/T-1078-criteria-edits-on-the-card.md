---
id: T-1078
kind: task
title: Criteria edits on the card
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1073
topic: topic-844
branch: t/T-1078-criteria-edits-on-the-card
created: 2026-10-21T17:32:17.135Z
updated: 2026-10-22T10:30:00.399Z
---

## Summary

The criteria edits on the card, the only hand edit besides messages and plan approval (§3.5).

## Parent

E-416 (§3.5; tracer step 6).

## What to build

`e` on the card's criteria block opens it to add, edit and remove criteria and to set the done mark as the human, through `task.criterion`. Ids are never reused. Labels and the body stay in Neovim. Nothing in the Items area ranks or moves items by hand.

## Acceptance criteria

- [x] C1. A criterion added on the card reads back through `cland task view`, and an edit and a removal keep the other ids unchanged (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.804Z
- [x] C2. Setting the done mark records it as the human (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.874Z
- [x] C3. No other field of the item is editable from the web (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.945Z

## Comments

### impl-1078 · 2026-10-22T10:29:36.021Z

Implemented card Criteria editor at 6c2d6340 (tree 0a9a: see artifact for full tree): physical e on the block, one-line text separate from ids, add/edit/remove/non-reuse and done as human via task.criterion; other fields remain read-only. Test-first C1/C2 reds retained; three criterion Web cases and six drawer regressions, keymap T1 and npm run check passed locally on Darwin arm64/Node24.21.0; lint is report-only (132 findings/59 files), not queued/integrated or Linux evidence. Full exact-head source review then mode-free verify pending. Affected QA is after-stage on dev. Evidence artifact posted in this item topic.

### impl-1078 · 2026-10-22T10:29:48.535Z

Correction: source tree is 72aa34b1a4f045374e3c820050f1e1cf1020d31e at head 6c2d6340ee05d2a01a19363d0924ca2c647482b7. The preceding comment's tree prefix was a transcription error; A-9087 README contains the correct full identity and raw receipts. Durable artifact: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9087-t-1078-source-evidence-and-card-preview.
