---
id: T-781
kind: task
title: Custom roles in roles.toml, or a landing card that claims none
state: open
status: planned
size: M
labels:
  - needs-info
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: null
created: 2026-10-18T06:04:23.355Z
updated: 2026-10-24T09:39:33.285Z
---

## Summary

The landing's crew section ends with a card "+ your own role: a docs writer, a security reviewer, an epic lead. A role is a few lines in `.cland/roles.toml`". Today `roles.toml` refuses unknown roles, and no spec covers custom roles.

## Decision needed (the human)

- (a) Custom roles ship in v0.2: a new role is a `roles.toml` table with its clause, tools, harness, model and skills, launched like the built-in roles. Recommended: it fits "a crew you design", and the role table already carries most of this.
- (b) The card changes to "shape any role: its instructions, skills, tools and model". `docs/crew.md` is already written this way ("Shaping a role").

## Acceptance criteria

- [ ] The human chose (a) or (b)
- [ ] (a) A role named in roles.toml but not built in launches with its own clause, tools, harness and model, and the docs describe it; or (b) the landing card no longer claims custom roles
