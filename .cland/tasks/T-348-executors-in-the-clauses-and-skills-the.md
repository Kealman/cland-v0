---
id: T-348
kind: task
title: "Executors in the clauses and skills: the Implementer and QA clauses and the merge and qa skills say how a run picks its executor, what a droplet run costs, and what a Linux result proves"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by:
  - T-346
topic: topic-234
branch: t/T-348-executors-in-the-clauses-and-skills-the
created: 2026-10-13T20:53:46.191Z
updated: 2026-10-14T03:42:38.290Z
---

## Summary

The crew learns the executors where it reads its rules: the Implementer and QA clauses, the `merge` and `qa` skills, `docs/agents/tests.md` and one consolidated `hub/README.md` section. They say five things:

- a run goes to the project's executor;
- `--executor local` exists, and when to use it;
- a droplet result names its lifetime and cost;
- no session ever creates a droplet by hand;
- a Linux result is suite evidence, and the macOS-only cases run in the release's final local run.

## Parent

E-271: Remote executors. Definition-of-done checkbox 7: `hub/README.md`, the Implementer and QA clauses and the `merge` and `qa` skills describe the executors, their configuration and their cost. Decisions: D27, the limits and this project's build values, and D25's verify-after-review rule, which stays. Prior work: T-322, which aligned the clauses and the `merge` and `qa` skills with D25 (`skills/PATCHES.md`, "merge and qa").

## What to build

**The clauses.** `hub/src/roles/default-roles.ts` gets one compact sentence each in the Implementer clause (next to the line "Request review first; after a clear source verdict…") and the QA clause (next to the queue line). The sentence says four things:

- `cland verify` runs on the project's executor (`[verification] executor`);
- `--executor local` is for a macOS-only question or when the human asks;
- a droplet result names its platform, lifetime and cost;
- sessions never create, list or delete droplets themselves: the hub does, and `cland executor` belongs to the human and the Coordinator.

The Coordinator clause gets one sentence: `cland executor status|prepare|reap`, re-preparing after a release or a lockfile change, and the hourly tag check staying with the stand-in. Stay inside the clause byte budget that `hub/test/roles.test.ts` guards; trim, never raise the budget.

**The skills.**

- `.agents/skills/merge/SKILL.md`: a green same-head result from either executor satisfies the gate. A Linux droplet result lists the macOS-only cases as skips. They run in the release's final local run ("Release v0.1.2 from the item").
- `.agents/skills/qa/SKILL.md`: a brief's full suite may run on a droplet. The verdict's evidence names the executor, the platform and the cost. A QA run that needs macOS asks for `--executor local`.
- `skills/PATCHES.md`: one entry for both, in the style of T-322's.

**`docs/agents/tests.md`.** The executor line in a result, `--executor`, the fallback notice and what it means for the Implementer (the run still happens, locally), the queue's remote lines, and the cost of a run: about $0.10 for a full suite on c-8 at $0.25 an hour, and twice the hourly price on c-16.

**`hub/README.md`.** Tickets T-343 to 06 each wrote their part. This ticket makes the "Remote executors: droplets" section one coherent read:

- a config table with every key, its default (executor `local`, `remote_budget` 4, `lifetime` 110m, `run_timeout` 75m, `daily_spend_usd` 5, size `c-8`, regions `lon1`, `nyc1`, `sfo2`) and D27's build values for this project (2, 60m, 50m, $3);
- the costs (c-8 and c-16 hourly, the 60 s minimum, snapshot storage);
- the token rules;
- the hand driver's retirement under D27;
- a short "what a Linux result proves" paragraph.

**`GLOSSARY.md`.** Add **Lease**: the hub's durable record of one remote machine, written before its create, held until its deletion is confirmed. The Executor entry (ticket T-342) gains its link to Lease.

**Relaunch note.** A role's clause is fixed at launch. The ticket's report reminds the Coordinator to relaunch the role sessions after the merge.

**Out of scope.** Any behaviour change. The clauses of roles other than the Implementer, QA and the Coordinator.

**Constraints.**

- The byte budget guard in `hub/test/roles.test.ts` and the skills guards stay green, unchanged.
- Tests go through the frame protocol where a clause is checked as delivered (`hub/test/roles.test.ts`). No new seams.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. The Implementer and QA clauses each name `cland verify`'s executor, `--executor local`, the result's lifetime and cost, and that sessions never handle droplets themselves. The Coordinator clause names `cland executor status|prepare|reap`. `hub/test/roles.test.ts` passes with the budget unchanged.
  - done: impl-348 · 2026-10-14T03:42:05.620Z
- [x] C2. The `merge` and `qa` skills say that a Linux result satisfies the gate, and where the macOS-only cases run. `skills/PATCHES.md` records the patch.
  - done: impl-348 · 2026-10-14T03:42:07.000Z
- [x] C3. `docs/agents/tests.md` describes the executor line, `--executor`, the fallback notice, the remote queue lines and the cost of a run.
  - done: impl-348 · 2026-10-14T03:42:08.138Z
- [x] C4. `hub/README.md` has one "Remote executors: droplets" section with the config table (defaults and D27's build values), costs, token rules, the hand driver's retirement and what a Linux result proves. The GLOSSARY has Lease, linked from Executor.
  - done: impl-348 · 2026-10-14T03:42:09.556Z

## Comments

### impl-348 · 2026-10-14T03:34:09.332Z

Implementation plan: compact executor rules next to Implementer review/QA queue guidance and Coordinator controls; retain the roles byte budget and skills guards. Consolidate README config, lifecycle, cost/token rules and Linux evidence; document fallback/remote queue and release-local skips in tests/skills. E-271 comments settle [verification], manual re-prepare and hand-driver retirement at T-346. T-347 owns remote_budget/scheduler changes in parallel; this task documents that final contract.

### impl-348 · 2026-10-14T03:42:28.283Z

Source ready at pushed head 40355dfb0187c09dc4d5eba53e3fcf6447959f3f; full source review requested. Implementation/checks artifact A-2219 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2219-t-348-implementation-and-checks-at-40355dfb.md. Typecheck, delivered default/project role snapshots with unchanged byte budget, QA skill and tracker guards passed. Full verify waits for a clear source verdict. Coordinator: relaunch Coordinator, Implementer and QA sessions after merge; the tracked roles.toml was updated alongside defaults.
