---
id: T-1222
kind: task
title: cland init writes a Codex sandbox for Implementer and Aide that differs from the built-in defaults
state: open
status: planned
size: S
labels:
  - needs-info
  - site
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: null
created: 2026-10-24T09:42:30.046Z
updated: 2026-10-24T09:45:53.763Z
---

## Summary

Found by impl-783 in the T-783 docs pass (2026-10-24 09:41Z, topic-953). `hub/src/roles/template.ts` (the roles.toml that `cland init` writes for a new project) gives Codex Implementer and Aide `sandbox = "workspace-write"`. The built-in defaults in `hub/src/roles/default-roles.ts`, and this project's own roles file, use `danger-full-access`, following the human's 2026-10-09 decision (T-65) that every harness gets full access to do its role's work. So a new user's crew runs sandboxed while cland's own crew doesn't, and the docs can't describe one default. Before the public launch, one default should hold for new projects and the docs should state it.

## Decision needed (the human)

- (a) New projects get `workspace-write` for Implementer and Aide (safer for strangers' machines; some role work may need `writable_roots`). Built-in fallback defaults change to match.
- (b) New projects get `danger-full-access`, as cland's own crew does. The template changes to match, and the docs warn plainly that Codex roles run unsandboxed.

## Acceptance criteria

- [ ] C1. The human's choice is recorded on this item.
- [ ] C2. `cland init`'s generated roles.toml and the built-in fallback defaults agree for every role's Codex sandbox, shown by a test comparing the two.
- [ ] C3. site/src/content/docs/docs/ states the default and how to change it.
