---
id: T-708
kind: task
title: Retire integration tests covered by a scenario plus a T2 equivalent, and close the process-helper baseline outside contract, scenario and lifecycle files
state: open
status: review
size: M
criterion_seq: 5
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
topic: topic-476
branch: t/T-708-retire-integration-tests-covered-by-a
created: 2026-10-16T19:59:37.845Z
updated: 2026-10-18T05:25:49.829Z
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

- [x] C1. The inventory is posted as an artifact on this item, mapping every retired or moved test to the scenario step and T1/T2 test that prove its behaviour.
  - done: impl-708 · 2026-10-18T05:12:27.577Z
  - verified: rev-30 [reviewer] · run rev-20261018-708-source-correction · 2026-10-18T05:25:49.829Z · commit 52c5911f2474a0851bda65766e73ad2e1d244fa0
- [ ] C5. Each touched file in the sessions-and-leads group (A-4961) passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify, with every moved test keeping its title and assertion meaning.
  - failed: rev-30 [reviewer] · 2026-10-18T05:24:54.536Z · note The migrated lifecycle-serialization T1 fixture still starts native heartbeat/prune timers through createHubBase's default Clock; correct its clock injection before verification.

## Comments

### coord · 2026-10-17T06:32:40.112Z

Coordinator input from T-696: the account files hold native-contract assertions that the generic in-process fake can't prove. They cover the Claude auth hook and mod behaviour, Codex sparse-read ordering, attach execution, native conversation and pool handoff, PID discovery and network-preload propagation. T-696 keeps them as T3 cases with contract headers and lists them per harness as candidates for the contract files (T-691, T-692, T-693). Before retiring account-file T3 cases, this ticket decides for each one whether it moves into its harness's contract file or stays.

### coord · 2026-10-17T12:27:15.613Z

Candidates from T-699's C1 exception (A-4508): executor sentinel lifecycle/redaction (15.1 s Mac), remote shell/host deadline (12.3 s) and failed replacement table (12.0 s). Retire or shrink each once a T-707 scenario plus a T2 equivalent covers it.

### impl-708 · 2026-10-18T04:48:50.704Z

C1 inventory posted as A-4961 in topic-476: all 213 T3 files grouped, current manifest 2709.371429 s, 511 exact same-title migration mappings, conservative removed weight 600.099163 s and residual target gap 309.272266 s. Native claims retained; no test/source changes. Awaiting lead scope confirmation and parallel ticket split per Coordinator instruction.

### impl-708 · 2026-10-18T05:20:34.111Z

Sessions/leads implementation at 82cd6f2ab45ab3ad479234c720562a4995ecd332, pushed to origin. C1: A-4961 inventory plus A-4976 authorized native Git correction; final exact-title scenario/proof map and audit in A-4983. C5 local part: all 47 affected test files pass whole-file 5/5 serially on Mac (235 runs), peak sampled 1-minute load 9.12; typecheck, tiers and report-only lint exit 0. 189 same-title lower-tier moves, 1 native Git retention, 1 approved duplicate retirement. All 33 lower-tier destination files have zero direct process-helper calls. C5 remains pending the reviewed-head droplet verify. Per-item QA policy is none.

### rev-30 · 2026-10-18T05:24:54.536Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-708-source
commit: 82cd6f2ab45ab3ad479234c720562a4995ecd332
scope: full
findings: [{"severity":"medium","text":"New T1 fixture uses createHubBase's default real Clock, starting native heartbeat and prune intervals; inject a complete FakeClock to satisfy the T1 no-real-time rule.","file":"hub/test/lifecycle-serialization.test.ts","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: medium M1 at lifecycle-serialization.test.ts:23: newly T1 fixture calls createHubBase without a FakeClock, scheduling native heartbeat (core.ts:372) and prune (server.ts:133) intervals. Inject a complete FakeClock and refresh the affected whole-file evidence; child/socket enforcement does not cover this no-real-time rule. Spec: C1 inventory inspection passed; 33 selected source files, 189 exact-title lower-tier moves, approved native Git retention and duplicate retirement reconcile; 25 retained native files are byte-identical. A-4985 records the assertion audit and 235 local receipts (1,155 passes, no failures/cancellations/skips). Correction to its criterion wording: the hub requires a clear verdict for verification marks, so C1 is inspected but remains unverified in this not-clear pass. C5 failed on the declared-tier breach and remains pending task droplet evidence. New head needs source review before verification.

Criteria: C5 failed (The migrated lifecycle-serialization T1 fixture still starts native heartbeat/prune timers through createHubBase's default Clock; correct its clock injection before verification.).

### rev-30 · 2026-10-18T05:25:49.829Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-708-source-correction
commit: 52c5911f2474a0851bda65766e73ad2e1d244fa0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: M1 resolved; one complete FakeClock is shared by createHubBase and ProcessTable, removing native heartbeat/prune timer scheduling from the T1 fixture. Only this fixture changes; no title/assertion or production changes. Spec: unchanged inventory and preservation audit passes; C1 verified. A-4987 records correction inspection, all 49 matching source hashes and five fresh whole-file logs (30 passes, no failures/cancellations/skips or recorded trips). Existing 47-file local evidence remains applicable. C5 stays unverified pending exact-head task droplet evidence; normal diff-selected verification may proceed at this commit.

Criteria: C1 verified.
