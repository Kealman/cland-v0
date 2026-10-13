---
id: T-322
kind: task
title: "D25: Implementers verify only after a clear review verdict, at the exact reviewed head (clauses and skills)"
state: open
status: review
criterion_seq: 3
labels:
  - tech-debt
  - hub
  - ready-for-agent
assignee: null
parent: E-216
blocked_by: []
topic: topic-201
branch: t/T-322-d25-implementers-verify-only-after-a
created: 2026-10-13T10:34:03.049Z
updated: 2026-10-13T10:50:48.482Z
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

- [x] C1. The default Implementer clause, and the Lead clause where it requests review, state the D25 order: review first, verify after a clear verdict at the exact reviewed head, and a new review after a fix. `.cland/roles.toml` carries the same text.
  - done: impl-322 · 2026-10-13T10:39:49.880Z
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-1 · 2026-10-13T10:50:33.052Z · commit e54bba10d40d0115225b62a98377a411b8e271b7
- [x] C2. The Reviewer clause and the merge, qa and code-review skills agree with the order, with vendored patches recorded.
  - done: impl-322 · 2026-10-13T10:39:50.842Z
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-1 · 2026-10-13T10:50:33.052Z · commit e54bba10d40d0115225b62a98377a411b8e271b7
- [ ] C3. The roles snapshot tests pass with the new text, and `cland verify` is green.

## Comments

### impl-322 · 2026-10-13T10:35:20.373Z

D25 implementation started. Updating default and project clauses, source/final reviewer workflow, merge/QA/code-review/implement skills, and linked test/review guidance. No hub behavior or gate change. Full verification will follow a clear source review at its exact head.

### rev-26 · 2026-10-13T10:50:33.052Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-322-source-1
commit: e54bba10d40d0115225b62a98377a411b8e271b7

Source review under D25: no high/medium finding. C1 default/project clauses implement review-first, exact-head post-clear verification, renewed review after fixes/merge head changes, cache reuse and final-verdict merge ordering. C2 Reviewer and code-review/merge/qa/implement skills plus docs/template agree; vendored patches recorded with unchanged upstream lock hashes. hub/test/roles.test.ts:53–88 pins default/project real-spoke clause delivery including Lead; no production/grant/cache/gate change. C3 remains unverified pending post-verdict full green receipt. T-317 integration needs renewed source review at any changed head before verification; Coordinator relaunch after merge required. Evidence artifact records both review axes.

Criteria: C1 verified, C2 verified.

### impl-322 · 2026-10-13T10:50:48.482Z

Source review clear at e54bba10d40d0115225b62a98377a411b8e271b7, run rev-20261013-322-source-1, C1/C2 verified (A-1912). C3 remains pending. Per Coordinator and Reviewer instructions, waiting for T-317 integration before merging origin/dev, requesting review of that changed head, and submitting exact-head verification in protected machine order.
