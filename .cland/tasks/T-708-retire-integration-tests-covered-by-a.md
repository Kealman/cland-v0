---
id: T-708
kind: task
title: Retire integration tests covered by a scenario plus a T2 equivalent, and close the process-helper baseline outside contract, scenario and lifecycle files
state: closed
status: done
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
updated: 2026-10-18T06:24:43.467Z
closed: 2026-10-18T06:24:43.467Z
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
  - verified: rev-30 [reviewer] · run rev-20261018-708-volume-delta · 2026-10-18T05:52:50.458Z · commit 927ce1cfbacd8258c000881071c30b43bc978194
- [x] C5. Each touched file in the sessions-and-leads group (A-4961) passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify, with every moved test keeping its title and assertion meaning.
  - done: impl-708 · 2026-10-18T06:23:34.050Z
  - verified: rev-30 [reviewer] · run rev-20261018-708-final · 2026-10-18T06:24:12.063Z · commit 927ce1cfbacd8258c000881071c30b43bc978194

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

### rev-30 · 2026-10-18T05:49:42.386Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-708-runtime
commit: 52c5911f2474a0851bda65766e73ad2e1d244fa0
scope: evidence
findings: [{"severity":"medium","text":"The moved visibility identity takes 6.263449173s and fails the hard new-identity 5s duration check; task verification exits 1 before its Neovim phase.","file":"hub/test/visibility-component.test.ts","line":142}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5001: evidence not clear. A-5000/758fe012 exits 1 on the owned hard duration check: visibility-component.test.ts:142, “hundreds of default verdict, death and idle events leave needsYou zero”, 6.263449173s > new-identity 5s limit (log line 36111). All 47 owned files/231 ordinary test receipts pass assertions; 60 owned gates pass 5/5. Overall 2,122 pass/0 assertion fail/5 unrelated prerequisite skips, but the failed hub phase has no subsequent Neovim receipt. Resolve the owned budget failure through the item lead, review any changed head and obtain accepted task evidence. The unrelated report-only Claude ps probe is not the exit cause. C1 source verification remains current; C5 failed. No automatic retry/override/dev merge requested.

Criteria: C5 failed (Exact-head A-5000 exits 1 on the moved visibility test's 6.263449173s > 5s hard duration budget; accepted task verification and Neovim completion remain absent.).

### impl-708 · 2026-10-18T05:51:56.746Z

Coordinator's A-5000 runtime disposition is implemented and pushed at 927ce1cfbacd8258c000881071c30b43bc978194. Representative four-verdict + idle/death case stays T2; exact-title hundreds/200-verdict case moves to T4. Both call assertDefaultEventVisibility; volume-transfer.json in A-5002 proves the shared body matches reviewed 52c5911f except for the count parameter. T4 temporary volume allowance is owned by E-677, observed 6.263449173 s, expires 2026-10-25. Fresh whole-file 5/5 for both changed test files, peak load 3.84; all 48 files/240 selected Mac receipts and refreshed static checks in A-5002. C1 corrected map: 188 same-title T1/T2 moves + 1 exact-title T4 volume transfer; T3 projected cut remains 246.322622 s. C5 remains failed/pending until source review and an accepted new exact-head droplet run.

### rev-30 · 2026-10-18T05:52:50.458Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-708-volume-delta
commit: 927ce1cfbacd8258c000881071c30b43bc978194
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5003: source delta clear, no Standards/Spec findings. Coordinator 85d1b1c3 authorizes representative T2 plus exact-title 200-verdict T4 volume. Extracted assertion/setup body independently matches the reviewed original except its count parameter; T2 uses four alternating verdicts plus idle/death, T4 retains 200. The sole allowance uses observed A-5000 6.263449173s, open E-677 owner, reason and seven-day dates; all baseline/other duration fields unchanged. C1 refreshed for the explicit 188 T1/T2 + one T4 mapping. A-5002 has all 52 matching source hashes and ten fresh whole-file logs/45 passes with no failures/cancellations/skips, peak load 3.84. Failed parent A-5000 remains disclosed. C5 remains unverified pending a passing exact-head task receipt; normal verification may proceed.

Criteria: C1 verified.

### rev-30 · 2026-10-18T06:24:12.063Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-708-final
commit: 927ce1cfbacd8258c000881071c30b43bc978194
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear. A-5017 independently audits A-5013 full exit-zero run 36e6f6ae: 2514 pass, zero failures/cancellations, eight prerequisite skips, full Neovim complete. All 48 scoped files/232 ordinary timing identities have positive reporter lines and match Mac titles; 61 scoped gates pass 5/5 (305 repetitions), no scoped tier trips. A-5002 supplies matching-source 48-file/240-run Mac whole-file evidence. Reviewed representative T2 and retained exact-title T4 volume cases both pass; earlier A-5000 red remains disclosed. C5 verified; C1 remains current from A-5003. Integrated performance/final baseline targets remain T-775/E-677.

Criteria: C5 verified.

### coord · 2026-10-18T06:24:43.467Z

Merged e33ea2a9ca77ad35ced771cec8347a9e878ea14a onto dev.
