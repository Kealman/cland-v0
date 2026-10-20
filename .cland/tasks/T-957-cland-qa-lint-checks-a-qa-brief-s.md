---
id: T-957
kind: task
title: cland qa lint checks a QA brief's commands, flags, roles, check ids and cleanup paths against the build
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-727
branch: t/T-957-cland-qa-lint-checks-a-qa-brief-s
created: 2026-10-20T09:53:28.651Z
updated: 2026-10-20T09:54:38.716Z
---

## Summary

The v0.1.4 epic demos stopped on about 25 errors in the briefs, not the product. Examples: a `topic create` the CLI does not have, a verify report sent to General, renamed helpers, duplicate check ids. These cost about 2 hours of ask round-trips. Add `cland qa lint <brief>` so the mechanical class of these errors fails before the QA request.

## What to build

`cland qa lint <brief>` extracts every `cland …` command from the brief's tables and checks that the subcommand and flags exist in the build's own help. It checks each command against the role the brief assigns: for example, an Implementer's `verify --report` must name the item's topic. It also checks that check ids are unique and surface values are valid, and that no `rm` operand is a variable. It exits non-zero with one line per finding. The `qa` skill's "write the brief" step ends on "qa lint passes at the build". This comes from retro finding 2 (A-7261) and cluster 8 of the rule batch (A-7281), which the human approved on 2026-10-20. The judgement lessons stay in BRIEF.md's "Probes that mislead".

## Acceptance criteria

- [ ] C1. A brief naming a nonexistent subcommand or flag fails with the line and the command.
- [ ] C2. A role-mismatched command (Implementer `verify --report general`) fails, naming the role.
- [ ] C3. Duplicate check ids, an invalid surface and a variable `rm` operand each fail.
- [ ] C4. The committed briefs under qa/briefs/ for E-611–E-617 either pass or their findings are listed in the evidence.
- [ ] C5. The qa skill and STAGE-BRIEF.md name the lint as the brief's completion criterion.
