---
id: T-322
kind: task
title: "D25: Implementers verify only after a clear review verdict, at the exact reviewed head (clauses and skills)"
state: open
status: backlog
labels:
  - tech-debt
  - hub
  - ready-for-agent
assignee: null
parent: E-216
blocked_by: []
topic: null
branch: null
created: 2026-10-13T10:34:03.049Z
updated: 2026-10-13T10:34:03.049Z
---

## Summary

Decision D25 (`docs/spec/v0.1.md` §4, 2026-10-13): an Implementer requests review first. When the verdict on its source is clear, it runs `cland verify` at the exact reviewed head. A fix after a verdict needs a new review before a new run. The reason: 79 full runs for 26 merges, and 42% of verdicts not clear, so runs launched alongside a review request mostly burned on the next fix. This item puts the rule into the clauses and the skills.

## What to build

- The Implementer clause, and the Lead clause where it requests review, in `hub/src/roles/default-roles.ts` and in this project's `.cland/roles.toml`. The clause states: "request review first; when the verdict is clear, run `cland verify` at the exact reviewed head; a fix after the verdict needs a new review before a new run".
- The Reviewer clause, if it says it waits for a full run before reviewing source: the Reviewer reviews source first and records the final verdict when the post-verdict run lands at the same head.
- Any skill text that says otherwise: the `merge`, `qa` and `code-review` skills, and `docs/agents/issue-tracker.md` if it describes the loop. Vendored skills record their patch in `skills/PATCHES.md`.
- The tree-hash cache stays: an unchanged head after review reuses an earlier green run. State that in the clause.
- The roles snapshot tests pin the new text.

## Constraints

- No hub behaviour change beyond the clause text. The merge gate and verdict rules are unchanged.
- Tests through the frame protocol where they touch delivery, and snapshot tests for the text.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. English everywhere.
- The Coordinator clause changes if it describes the loop, so the Coordinator relaunches after the merge. The clause rides the next hub restart.

## Acceptance criteria

- [ ] C1. The default Implementer clause, and the Lead clause where it requests review, state the D25 order: review first, verify after a clear verdict at the exact reviewed head, and a new review after a fix. `.cland/roles.toml` carries the same text.
- [ ] C2. The Reviewer clause and the merge, qa and code-review skills agree with the order, with vendored patches recorded.
- [ ] C3. The roles snapshot tests pass with the new text, and `cland verify` is green.
