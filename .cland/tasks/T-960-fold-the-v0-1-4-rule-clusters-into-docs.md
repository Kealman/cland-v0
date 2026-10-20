---
id: T-960
kind: task
title: Fold the v0.1.4 rule clusters into docs/agents/tests.md and hub/README.md
state: open
status: planned
size: S
labels:
  - ready-for-agent
  - docs
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:53:44.722Z
updated: 2026-10-20T09:53:58.279Z
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

- [ ] C1. Each of the five places above carries its cluster's guidance, with no duplicate of existing text (the evidence quotes each insertion's anchor heading).
- [ ] C2. Rule 9's text names "Waiting for an observable condition" and that section holds the worked examples (Neovim rows, workerPid, tracker frames).
