---
id: T-960
kind: task
title: Fold the v0.1.4 rule clusters into docs/agents/tests.md and hub/README.md
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - docs
assignee: null
parent: E-952
blocked_by: []
topic: topic-730
branch: t/T-960-fold-the-v0-1-4-rule-clusters-into-docs
created: 2026-10-20T09:53:44.722Z
updated: 2026-10-20T09:56:34.088Z
---

## Summary

The human approved the v0.1.4 rule batch (A-7281) on 2026-10-20, and four of its clusters go into docs rather than the rulebook. Write them into the named sections, worded as guidance for the subsystem they concern.

## What to build

Read A-7281 clusters 1, 2, 4, 7 and 10, then write:

- **docs/agents/tests.md, "Fixtures":** fake time advances only after the boundary is observed (cluster 2).
- **docs/agents/tests.md, a new "When you move or split tests" list under "Test placement and review":** the assertion map, timing over every destination file, native claims at a named T3 boundary, fixtures that are faithful to production (cluster 7).
- **docs/agents/tests.md, "Waiting for an observable condition":** the worked examples for rule 9 (cluster 1).
- **hub/README.md, "Reloading project configuration":** human-owned config edits validate with the consumer's parser (cluster 4).
- **hub/README.md, "Verification commands":** evidence is reused only on exact identity (cluster 10).

Cite no ticket lists, and do not restate what those sections already say. Docs only, no code.

## Acceptance criteria

- [x] C1. Each of the five places above carries its cluster's guidance, with no duplicate of existing text (the evidence quotes each insertion's anchor heading).
  - done: impl-960 · 2026-10-20T09:56:32.075Z
- [x] C2. Rule 9's text names "Waiting for an observable condition" and that section holds the worked examples (Neovim rows, workerPid, tracker frames).
  - done: impl-960 · 2026-10-20T09:56:33.123Z

## Comments

### impl-960 · 2026-10-20T09:56:32.044Z

Implemented and pushed 7c509c5b8d74b7dc415fa8fa3d022101e801b249 on t/T-960-fold-the-v0-1-4-rule-clusters-into-docs. A-7300 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7300-t-960-five-documentation-insertions-and-review-evidence.md) quotes all five heading anchors and maps clusters to insertions; confirms rule 9's section pointer and Neovim rows/workerPid/tracker-frame examples. git diff --check passed; fetched and merged origin/dev before first review (already up to date). Docs only: no tests/typecheck/verify executed or needed per launch brief. qaPolicy scope none; no qaCriteria.
