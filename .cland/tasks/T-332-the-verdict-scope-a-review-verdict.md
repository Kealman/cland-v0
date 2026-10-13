---
id: T-332
kind: task
title: "The verdict scope: a review verdict records full, delta or evidence, through --scope on cland task comment and MCP task.comment, and the Reviewer clause and the code-review skill say which"
state: open
status: planned
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by:
  - T-331
topic: null
branch: null
created: 2026-10-13T14:04:09.652Z
updated: 2026-10-13T19:30:24.288Z
---

## Summary

A review verdict records its scope: `full`, `delta` or `evidence`. `cland task comment --verdict review` and MCP `task.comment` refuse a review verdict without one, and a QA verdict carries none. The Reviewer clause and the `code-review` skill say which scope applies, so the later measurement can count first-pass yield on full reviews only.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.12 (the scope of a review verdict on the verdict record, and the metric set). Decided in T-255. GLOSSARY: Verdict. Research: `docs/research/model-performance.md` on `research/model-performance`, section 8.

## What to build

**The record.** `Verdict` in `hub/src/tracker/item.ts` gains `scope?: 'full' | 'delta' | 'evidence'`.

- `serializeComment` writes `scope: <value>` in the verdict header after `run` and `commit`. `VERDICT_LINE` and `commentOf` read it back. `verdictOfText` carries it.
- A verdict written before this ticket has no scope. It reads unchanged and counts as unknown.
- The index stores it in a new `scope` column of `tracker_verdicts` and `tracker_written_verdicts` (`hub/src/tracker/index-db.ts`). `IndexedVerdict` carries it, so `task.view`, `task.list` and the `task` event show it.
- The `verdict posted` event text names it, for example `verdict posted review clear · full · rev-12`.

**The rule.** `VerdictInput` in `hub/src/tracker/tracker.ts` gains `scope`. `tracker.comment` checks it.

- A review verdict without a scope is refused, naming `full, delta or evidence`.
- A QA verdict with a scope is refused. Stage QA verdicts are QA verdicts.
- The merge gate ignores the scope. `gateVerdicts` in `hub/src/tracker/gate-verdicts.ts` and `qaSatisfied` are unchanged.

**The CLI and MCP.** `--scope full|delta|evidence` on `cland task comment` (`hub/src/cli/task.ts`), with its `TASK_USAGE` line. `cland task view` prints the scope in the verdict line. MCP `task.comment` in `hub/src/spoke/task-tools.ts` gains `scope` with its enum.

**The Reviewer clause.** In `hub/src/roles/default-roles.ts` and this repo's `.cland/roles.toml`, one short sentence: give `scope` full for a first review or a reworked design, delta after `dev` moved under a reviewed branch, evidence for suite evidence alone. T-322's guard in `hub/test/roles.test.ts` keeps the delivered clause at least 512 bytes under 8192.

**The skill and the docs.**

- `code-review` is vendored. Its "Hub review requests" part records the verdict with `--scope` and says which. Record the patch in `skills/PATCHES.md`.
- `docs/review-and-qa.md`: "The verdict" section names the scope and its three values.
- `docs/agents/issue-tracker.md` and its template: the `task comment` line names `--scope`.
- `GLOSSARY.md`: the Verdict entry adds "and, for a review, its scope".
- `hub/README.md`: the verdict header and the index carry the scope.

**Relaunch.** The MCP schema and the Reviewer clause change. Reviewer sessions relaunch after the merge to take both.

**Demo** (the epic's words). A review verdict without `--scope` is refused.

**Out of scope.** The launch's model and sub-agents (T-333). Showing the scope on the card (E-276). Any gate or metric that reads the scope.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293), with no synchronous full tracker hydration per event (the T-321 lesson). The scope comes from the index.
- Any panel test waits on state, never on a sleep. Every key goes through the action registry. This ticket adds neither.
- Every role's delivered clause stays at least 512 bytes under 8192 (T-322).
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. Item tests: the `scope` header round-trips for each value. A verdict file without it reads unchanged with no scope.
- [ ] C2. On a temporary project with a real hub, `cland task comment --verdict review` without `--scope` is refused naming the three values. With `--scope delta` it records, and `cland task view` and `--json` show it. A QA verdict with `--scope` is refused.
- [ ] C3. Through a real spoke, MCP `task.comment` from a Reviewer session gets the same refusal and records the scope when given.
- [ ] C4. `task.list` and the `task` event carry the scope from the index. The existing merge gate tests (`hub/test/merge.test.ts`, `hub/test/review-qa.test.ts`, `hub/test/verdict-commit.test.ts`) pass with scoped verdicts and decide as before.
- [ ] C5. The Reviewer clause states the rule. The roles snapshot tests pin it, and every role's delivered clause stays at least 512 bytes under 8192, for the defaults and for `.cland/roles.toml`.
- [ ] C6. The `code-review` skill records `--scope`, and `skills/PATCHES.md` records the patch. `docs/review-and-qa.md`, `docs/agents/issue-tracker.md` with its template, `GLOSSARY.md` and `hub/README.md` describe the scope.
