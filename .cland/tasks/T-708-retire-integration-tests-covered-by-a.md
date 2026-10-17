---
id: T-708
kind: task
title: Retire integration tests covered by a scenario plus a T2 equivalent, and close the process-helper baseline outside contract, scenario and lifecycle files
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-694
  - T-695
  - T-696
  - T-698
  - T-699
  - T-701
  - T-702
  - T-703
  - T-704
  - T-705
  - T-707
topic: null
branch: null
created: 2026-10-16T19:59:37.845Z
updated: 2026-10-17T12:27:15.613Z
---

## Summary

After the class moves (T-691 to T-706) and the scenario set (T-707), many T3 tests prove nothing a scenario step plus a T2 test does not (memo §5.5 step 3; report-slice1 tracer, report-slice3 v01-migration, report-slice4 review-qa, report-slice2 nvim/agents-filters and typecheck). This ticket deletes or moves those, and makes T-684's process-helper rule absolute: fake binaries, `startDaemon` and `spawnSpoke` only in contract, scenario or T3-header lifecycle files.

## What to build

- **An inventory.** For every T3 file that is not a contract, scenario or lifecycle-header file, each test is mapped to a scenario step plus a T2 or T1 test that proves the same behaviour, or kept with a lifecycle header.
- **Known candidates:**
  - `v01-migration.test.ts`: delete, with `bin/migrate-v01-release.ts` if nothing else uses it.
  - `review-qa.test.ts`'s non-Reviewer verdict refusal: delete; it is proven by `permissions`, `permission-integrity` and `tracker`.
  - `nvim/test/agents-filters.test.ts`: fold into the hub file plus a stub-hub screen test.
  - `typecheck.test.ts`: four typecheck runs become one plus the version probe.
  - `nvim/test/needs-you.test.ts`: the count rule becomes a hub T1 test plus one stub screen.
  - `session-holds.test.ts`'s pending-request machine and `store-and-forward.test.ts`'s queue and TTL rules: T2.
  - `hygiene.test.ts`'s rate limit, loop breaker and size cap: T2.
- **The baseline.** `hub/test/lint-baseline.json`'s process-helper counts are zero for every file outside contract, scenario and lifecycle-header files, and the lint refuses any new one there.

## Acceptance criteria

- [ ] C1. The inventory is posted as an artifact on this item, mapping every retired or moved test to the scenario step and T1/T2 test that prove its behaviour.
- [ ] C2. The process-helper counts in the lint baseline are zero outside contract, scenario and T3-header files, and a planted `spawnSpoke` in a T2 file is refused, proved by the lint run and a lint test.
- [ ] C3. A durations refresh from a green integrated run after the merge shows T3 manifest seconds of 1800 s or less, recorded on this item with the per-tier totals.
- [ ] C4. A spawn census of a full run after the merge shows 150 hub process starts or fewer, with the per-file table recorded on this item.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Comments

### coord · 2026-10-17T06:32:40.112Z

Coordinator input from T-696: the account files hold native-contract assertions that the generic in-process fake can't prove. They cover the Claude auth hook and mod behaviour, Codex sparse-read ordering, attach execution, native conversation and pool handoff, PID discovery and network-preload propagation. T-696 keeps them as T3 cases with contract headers and lists them per harness as candidates for the contract files (T-691, T-692, T-693). Before retiring account-file T3 cases, this ticket decides for each one whether it moves into its harness's contract file or stays.

### coord · 2026-10-17T12:27:15.613Z

Candidates from T-699's C1 exception (A-4508): executor sentinel lifecycle/redaction (15.1 s Mac), remote shell/host deadline (12.3 s) and failed replacement table (12.0 s). Retire or shrink each once a T-707 scenario plus a T2 equivalent covers it.
