---
id: T-1146
kind: task
title: Restrict the CHANGES and union-attribute wording to kept upstream skills
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-22T16:21:58.628Z
updated: 2026-10-22T16:21:58.628Z
---

## Summary

Low finding L1 from the T-1145 review. The wording in hub/README.md (near line 1697) and the opening comment of hub/src/init/skills.ts describes the per-skill CHANGES file and its merge=union attribute as if every skill had one; only kept upstream skills do. Narrow the wording to them.

## Acceptance criteria

- [ ] C1. hub/README.md and the hub/src/init/skills.ts opening comment name the CHANGES file and union attribute only for kept upstream skills (docs).
