---
id: T-536
kind: task
title: OpenCode warnings, the worktree clause, and the codemode and instructions experiments
state: open
status: review
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-379
branch: t/T-536-opencode-warnings-the-worktree-clause
created: 2026-10-15T20:59:19.741Z
updated: 2026-10-16T16:12:06.758Z
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

## Comments

### impl-536 · 2026-10-16T15:53:52.234Z

Implementation uses the existing E-424 seams: doctor CLI against a scratch project/fake binaries, and a real projectHub with fake OpenCode HTTP/MCP. Added warnings (free selection/known free IDs, OS sandbox), worktree guardrail in all override-capable role clauses in both copies, and default-off roleInstructions/CLAND_OPENCODE_ROLE_INSTRUCTIONS with replacement and message fallback. Targeted red→green warnings and instructions tests pass; typecheck exit 0. Real-model experiments are running in empty scratch projects with allowlisted HOME/XDG/OPENCODE_DB, no inherited provider keys.

### impl-536 · 2026-10-16T16:11:48.732Z

C1/C2 implemented in 47c18d54ace34f85fa22330ad4915dd7cd06450c (source commit ff388ff7 plus pre-review origin/dev merge). Typecheck at the merged review head: npm run typecheck exit 0. Targeted files run separately: doctor.test.ts 23/23; opencode-adapter.test.ts 19/19; follow-up bare big-pickle#high warning case passes (6.844s), with a reasoned duration allowance. C3: A-3950 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3950-e-424-codemode-experiment-keep-default-8-10-vs-7-10 records 8/10 default vs 7/10 false; default unchanged. C4: final A-3977 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3977-e-424-final-instructions-comparison-and-readiness-controls contains the completed paired compactions and readiness rerun; instruction control delivered correct sends before/after manual compaction, while message control stalled. Comparison is preliminary/inconclusive for adoption; option stays off. A-3977 completes the preliminary A-3973 note. Human adoption follow-up is T-619. Per Coordinator decision in topic-379, publish in item topic and Coordinator copies A-3950/A-3977 to E-424 after merge. All real servers ran on empty scratch HOME/XDG/database with no inherited provider keys; process exits observed and lsof found no remaining experiment writers. QA policy none/after-stage; no per-item QA brief.
