---
id: T-1649
kind: task
title: Per-item guidance keeps landing in the implement skill, making it the remaining merge hotspot
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: null
branch: null
created: 2026-11-03T01:51:41.764Z
updated: 2026-11-16T07:29:27.297Z
---

## Summary

After T-1631 split `hub/README.md`, `.agents/skills/implement/SKILL.md` (143 lines) is the remaining hotspot. Since 2026-11-02 00:00Z, 33 dev commits touched it. Today it caused merge conflicts for T-1588, T-1592, T-1596, T-1601 (twice), T-1615 and T-1631. One automatic merge silently dropped a section (T-1601, caught by a both-parent comparison). Items add subsystem paragraphs to it even though `.agents/skills/implement/CHANGES/T-<n>-*.md` files and `docs/hub/<subsystem>.md` exist.

## What to build

Keep `SKILL.md` to the stable workflow. Move subsystem guidance into `docs/hub/<subsystem>.md`, or into per-subsystem notes the skill points to, and make the per-item `CHANGES/` file the only place an item adds text. Add a lint that refuses item-scoped additions to `SKILL.md`, unless they are an explicit workflow change marked as such.

## Acceptance criteria

- [ ] C1. `SKILL.md` keeps only workflow steps and pointers; every subsystem paragraph moves verbatim to its `docs/hub/` file or subsystem note, proven by a byte-preservation check like T-1631's (test).
- [ ] C2. A lint refuses a change that adds subsystem text to `SKILL.md` and points to the destination; a workflow-change marker allows a deliberate edit (test).
