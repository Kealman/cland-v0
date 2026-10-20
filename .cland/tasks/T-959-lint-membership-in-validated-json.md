---
id: T-959
kind: task
title: "Lint: membership in validated JSON dictionaries uses Object.hasOwn or a Map, never `in`"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-728
branch: t/T-959-lint-membership-in-validated-json
created: 2026-10-20T09:53:37.650Z
updated: 2026-10-20T09:55:34.726Z
---

## Summary

impl-822 (T-822) found that `key in dict` on a validated JSON dictionary accepts prototype keys like `constructor` or `toString`. Add a static lint so the pattern cannot return.

## What to build

The repository's static lint (npm run check) flags `in` used for membership on plain-object dictionaries in hub/src. Allowed forms are `Object.hasOwn` or a Map. The lint has an inline exemption with a reason for genuine prototype checks. Fix the existing occurrences, or exempt them with a reason, and add prototype-key regression coverage where a key grammar admits such names. This comes from the residue of the rule batch (A-7281), which the human approved on 2026-10-20.

## Acceptance criteria

- [ ] C1. npm run check fails on a scratch `'x' in someRecord` in hub/src, naming file and line.
- [ ] C2. Every existing occurrence is converted or carries an exemption with a reason; the evidence lists them.
- [ ] C3. A regression test shows a prototype key (`constructor`) is refused where the key grammar admits it.

## Comments

### impl-959 · 2026-10-20T09:55:34.726Z

Audited 79 production `in` expressions using the TypeScript AST. Unsafe dictionary uses include OpenAPI comparison keys, task subcommand dispatch and OpenCode active-session dictionaries. Requested supervising lead's scope decision on explicit structural union narrowing exemptions; preserving TypeScript narrowing is the main compatibility consideration. Regression seam is the public existing OpenAPI comparison API and/or task CLI command parser, per C3.
