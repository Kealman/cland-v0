---
id: T-1146
kind: task
title: Restrict the CHANGES and union-attribute wording to kept upstream skills
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1010
branch: t/T-1146-restrict-the-changes-and-union-attribute
created: 2026-10-22T16:21:58.628Z
updated: 2026-10-24T21:49:19.952Z
---

## Summary

Low finding L1 from the T-1145 review. The wording in hub/README.md (near line 1697) and the opening comment of hub/src/init/skills.ts describes the per-skill CHANGES file and its merge=union attribute as if every skill had one; only kept upstream skills do. Narrow the wording to them.

## Acceptance criteria

- [ ] C1. hub/README.md and the hub/src/init/skills.ts opening comment name the CHANGES file and union attribute only for kept upstream skills (docs).

## Comments

### impl-1146 · 2026-10-24T21:49:19.952Z

Implementation scope: C1 is documentation-only. Narrow the README and skills.ts opening comment so only kept upstream skills own origin metadata, sibling CHANGES and its merge=union attribute. No runtime/shared-contract change or new behavior test; validation is passage inspection, diff check and npm run typecheck.
