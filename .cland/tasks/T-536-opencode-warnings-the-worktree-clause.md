---
id: T-536
kind: task
title: OpenCode warnings, the worktree clause, and the codemode and instructions experiments
state: open
status: planned
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: null
branch: null
created: 2026-10-15T20:59:19.741Z
updated: 2026-10-15T20:59:38.298Z
---

## Summary

E-424 slice 6 (tracer step 6). The doctor warns about OpenCode's free default model and its missing OS sandbox. The clauses forbid moving a session out of its item's worktree. Two measured experiments, `codemode: false` and the clause as instructions, record their results as artifacts on E-424.

## What to build

See E-424's "The codemode experiment", "The instructions experiment", "The warnings" and "The clauses" bullets.

- **Warnings.** The doctor warns when a role launches OpenCode on a free model, which may use the code it sees for training, and that OpenCode has no OS sandbox. Both are warnings, never launch refusals.
- **Clauses.** The role clauses `cland init` writes for roles that may run on OpenCode forbid moving the session out of its item's worktree. Clause changes go in both hub/src/roles/default-roles.ts and .cland/roles.toml.
- **codemode experiment.** It runs in a scratch project holding none of this repository's code: ten scripted turns per setting on the default free model, each asking for one `send`. The measure is the share of turns that deliver the right `send`, and the turn time. The default changes only if `false` is at least as reliable.
- **Instructions experiment.** An adapter option, off by default, carries the role clause as an instruction entry. It is measured once across a forced compaction against the message path. Adoption is the human's later decision, filed in Follow-ups.
- **Results.** Each experiment's result is an artifact on E-424. No provider key is written anywhere.

## Acceptance criteria

- [ ] C1. `cland doctor` shows the free-model training warning and the missing-sandbox warning for a role on a free OpenCode model, and neither refuses a launch.
- [ ] C2. The role clauses for OpenCode roles (both copies) forbid moving a session out of its item's worktree.
- [ ] C3. The codemode measurement is an artifact on E-424 with its decision, and the default changes only where it supports it.
- [ ] C4. The instructions option exists, off by default, its measurement is an artifact on E-424, and the adoption question is filed in Follow-ups.
