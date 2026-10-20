---
id: T-956
kind: task
title: durations.ts refresh --add-only, and a manifest check for duration keys with no matching test
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-729
branch: t/T-956-durations-ts-refresh-add-only-and-a
created: 2026-10-20T09:53:22.452Z
updated: 2026-10-20T10:49:24.943Z
closed: 2026-10-20T10:49:24.943Z
---

## Summary

At a stage close, `node hub/test/durations.ts refresh <log>` rewrites every allowance to the cover's timings. In the v0.1.4 run it would have shrunk 329 allowances and dropped 15. So the Coordinator hand-merged only the new baselines with Node (dc71dac8). Add an add-only mode, and a check that refuses exact keys that no test identity matches.

## What to build

`durations.ts refresh --add-only <log>` adds baselines for tests and files missing from the manifest. It leaves existing baselines and allowances byte-for-byte unchanged, keeps number formatting and prints what it added. The manifest validation refuses an exact duration key or census expectation that names no existing test identity. This comes from retro finding 4 (A-7261) and cluster 6 of the rule batch (A-7281), which the human approved on 2026-10-20. Update docs/agents/tests.md's stage-close step, and the memory-backed habit, to use `--add-only` until T-931 decides how allowances refresh.

## Acceptance criteria

- [x] C1. `refresh --add-only` on a log with new tests adds exactly their entries; a diff of the other entries is empty.
  - done: impl-956 · 2026-10-20T10:05:56.167Z
  - verified: rev-32 [reviewer] · run rev-20261020-956-final · 2026-10-20T10:28:58.099Z · commit 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa
  - verified: rev-32 [reviewer] · run rev-20261020-956-final-2 · 2026-10-20T10:44:46.534Z · commit 20c933a97bf61672293d7b04ed10354b59959ee3
- [x] C2. Manifest validation refuses a key with no matching test identity and names it.
  - done: impl-956 · 2026-10-20T10:21:14.757Z
  - verified: rev-32 [reviewer] · run rev-20261020-956-final · 2026-10-20T10:28:58.099Z · commit 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa
  - verified: rev-32 [reviewer] · run rev-20261020-956-final-2 · 2026-10-20T10:44:46.534Z · commit 20c933a97bf61672293d7b04ed10354b59959ee3
- [x] C3. docs/agents/tests.md's stage-close step names `--add-only`.
  - done: impl-956 · 2026-10-20T10:05:58.666Z
  - verified: rev-32 [reviewer] · run rev-20261020-956-source-2 · 2026-10-20T10:10:28.954Z · commit 82273fcb64bf9d49835413a7180a91e0563b5e88
  - verified: rev-32 [reviewer] · run rev-20261020-956-source-3 · 2026-10-20T10:21:41.085Z · commit 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa
  - verified: rev-32 [reviewer] · run rev-20261020-956-final · 2026-10-20T10:28:58.099Z · commit 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa
  - verified: rev-32 [reviewer] · run rev-20261020-956-delta · 2026-10-20T10:37:24.464Z · commit 20c933a97bf61672293d7b04ed10354b59959ee3
  - verified: rev-32 [reviewer] · run rev-20261020-956-final-2 · 2026-10-20T10:44:46.534Z · commit 20c933a97bf61672293d7b04ed10354b59959ee3

## Comments

### impl-956 · 2026-10-20T09:58:18.815Z

Scope clarified by Coordinator in topic-729: no census-expectation artifact exists, so check duration tests/allow keys and file baselines at both admission paths. Coordinator authorized deleting the 20 stale keys in this item, with surviving entry bytes preserved and mapping evidence; no new-name baselines or allowance value edits.

### impl-956 · 2026-10-20T10:06:22.482Z

Source ready at ab0e67bef0004e4e2ab5ddb5e8d318a80bbe7bdb, pushed to origin after pre-review merge of origin/dev 2e381e6d. A-7345 records all 20 removed stale keys, replacements and byte-preservation comparison. Same-head local macOS T0 `npm run check` exit 0; targeted T1/T3 45/45 passed. Affected admission/merge files 12/12 passed before clean dev merge. Existing lint/duration policy is report-only. Source review queued; no full-suite/integrated receipt claimed. Mode-free hub verification follows a clear source verdict.

### rev-32 · 2026-10-20T10:08:14.373Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261020-956-source
commit: ab0e67bef0004e4e2ab5ddb5e8d318a80bbe7bdb
scope: full
findings: [{"severity":"medium","text":"The new refresh --add-only CLI invocation passes only cwd to execFile, inheriting HOME/XDG/Git/provider/account settings and lacking bounded fixture ownership. Route the changed CLI regression through a disposable sealed environment with scratch HOME/XDG/Git config, withoutExecutorCredentials applied last, and owned cancellation/close cleanup (rule 15).","file":"hub/test/durations.test.ts","line":45}]
finding_counts: {"high":0,"medium":1,"low":0}

## Standards

Medium — hub/test/durations.test.ts:45: The new refresh --add-only CLI invocation passes only cwd to execFile, inheriting HOME/XDG/Git/provider/account settings and lacking bounded fixture ownership. Route the changed CLI regression through a disposable sealed environment with scratch HOME/XDG/Git config, withoutExecutorCredentials applied last, and owned cancellation/close cleanup (rule 15).

Other reviewed source has no blocking findings. At base 608ca7715b64ef9979544fc5c2f04c7a5b2b8df8 (the actual merged dev parent), the T-956 diff excludes already-landed T-757/T-804 changes. The extracted identity matcher retains the duration ratchet's literal/template/computed semantics. Both working-tree and immutable lint read the boundary's own source set. New T1 formatting regressions check number spellings/allowance bytes and idempotence; immutable regression distinguishes dirty checkout repair from pinned tree repair. README, --help, stage-close agent docs, project Coordinator clause and merge skill match the add-only workflow.

## Spec

No functional findings. Add-only merges existing files/tests over newly observed data and retains allowances untouched, then inserts only missing map entries without reserializing old values. Source metadata updates are separate. C2 refuses unmatched duration tests/allow/file keys with the named key; computed titles intentionally remain uncertain. Coordinator excluded the absent census artifact and authorized deletion of the twenty stale production keys; the production manifest diff contains deletions only. C3 names --add-only in the stage-close step.

Source not clear at ab0e67bef0004e4e2ab5ddb5e8d318a80bbe7bdb pending the local fixture-isolation fix; no functional criterion is failed by this standards finding, and runtime-dependent C1/C2 remain unverified. No Reviewer runtime execution. Supplemental A-7345 reports macOS arm64/local T0 check at this head and targeted 45/45 T1/T3 tests, plus 12/12 affected admission/merge tests before the clean dev merge. Diagnostic lint/budget report mode is not a suite receipt. External Coordinator memory remains Coordinator-owned.

Totals: Standards 1 medium; Spec 0.

### impl-956 · 2026-10-20T10:09:11.927Z

Reviewer medium isolation finding fixed in 82273fcb (pushed): changed CLI regression uses scratchMachine + commandIn; final env filtered with withoutExecutorCredentials there and in new immutable regression. Local macOS targeted affected cases 2/2, typecheck exit 0. Requested fresh source review; no verification submitted before verdict.

### rev-32 · 2026-10-20T10:10:28.954Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-956-source-2
commit: 82273fcb64bf9d49835413a7180a91e0563b5e88
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No remaining findings at 82273fcb64bf9d49835413a7180a91e0563b5e88. Rechecked the original T-956 change and correction: the changed CLI regression now uses scratchMachine/commandIn for both full and add-only refresh, with scratch cwd/HOME/XDG/Git configuration, final withoutExecutorCredentials filtering, command timeout/cancellation ownership and close/result drainage before directory removal. The new immutable native regression uses the same final filter. Prior medium isolation finding resolved; no production source or dev merge changed after the first review.

## Spec

No findings. Add-only entry splicing retains old baseline/allowance bytes and number spellings, adds only missing entries and prints additions; source metadata is updated separately. Working-tree and immutable identity checks use their own source reader, retaining the existing literal/template/computed title semantics. Authorized stale-key cleanup remains deletion-only. CLI help, README, merge skill, project Coordinator clause and stage-close agent docs match the new flow. C3 verified by source.

Source clear only. C1/C2 final marks await mode-free same-head evidence plus retained targeted native proof, because task T0–T2 does not execute the durations.test.ts T3 CLI/immutable contracts. At this corrected tree the Implementer reports local macOS typecheck exit 0 and the two affected native cases 2/2 under a name pattern; all other cases were not rerun. Earlier A-7345 retains 45/45 targeted T1/T3 context and the authorized twenty-key mapping, not a full suite. No Reviewer runtime execution.

Totals: Standards 0; Spec 0.

Criteria: C3 verified.

### rev-32 · 2026-10-20T10:16:57.031Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261020-956-evidence-red
commit: 82273fcb64bf9d49835413a7180a91e0563b5e88
scope: evidence
findings: [{"severity":"medium","text":"The shared duration fixture writes an empty one.test.ts but allows one.test.ts::recorded. New identity validation correctly refuses it, breaking both tier-planning regressions in the same-head T1 run. Seed a real recorded source identity while preserving the existing legacy-history assertions; keep identity validation enforced.","file":"hub/test/suite-tier-report.test.ts","line":51}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence verdict not clear at 82273fcb64bf9d49835413a7180a91e0563b5e88.

Actual A-7399 failure output (both cases): `Error: duration key has no matching test identity: hub/test/one.test.ts::recorded`, with lintDurations at suite-shards.ts:187 and callers suite-tier-report.test.ts:66 and :88. Failed tests are `tier planning enforces supplied legacy allowance history without a repository` and `planner history defaults to Git unless a duration snapshot is injected`.

Medium — hub/test/suite-tier-report.test.ts:51: The shared duration fixture writes an empty one.test.ts but allows one.test.ts::recorded. New identity validation correctly refuses it, breaking both tier-planning regressions in the same-head T1 run. Seed a real recorded source identity while preserving the existing legacy-history assertions; keep identity validation enforced.

Run b550550f-048f-41e2-8b1c-25fdb0b4f4a9 is fresh, mode-free, same-head Linux x64 6.8.0-142-generic droplet c-8 lon1 (Node v24.21.0): exit 1; T1 exit 1, 573 reported tests with 571 passes and 2 failures. T2 never executed (observed unavailable), not a passing/zero-duration receipt. The interruption envelope separately reports 588 completed/586 passed/2 failed; it is not the tier's census. Host typecheck at 93813e251d8c15db931a6f304baef115b5f59ebc was reused, not repeated remotely. Lint/budget diagnostics were report-only; source identity refusal is enforced.

Classified as missing fixture migration for the new identity policy, not a flake or infrastructure issue. C2 failed pending integration repair. C1/C3 are not established as a green task run by this partial receipt. Push the fixture correction and request fresh source review before retrying mode-free verification. No Reviewer tests or rerun.

Criteria: C2 failed (Same-head T1 verification fails two suite-tier-report fixtures: recorded allowance has no source identity because one.test.ts is empty.).

### rev-32 · 2026-10-20T10:21:41.085Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-956-source-3
commit: 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No findings at 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa. Rechecked the original implementation and fixture-only correction from 82273fcb: three files changed, adding planted test identities or the previously missing Neovim source/tier. Existing assertions are unchanged. No production lint or duration-manifest changes, no dev merge, no new process or wall-clock wait. Sealed native CLI regressions from the previous review remain intact.

## Spec

No findings. The A-7399 failure was an empty suite-tier-report source declaring ::recorded; it now supplies that literal identity while preserving both legacy-history assertions. Audited soak fixtures likewise supply declared load/first/second/slow titles. Close-run fixtures now supply the declared Neovim test file with T3 assignment in both the source manifest and scripted duration context. Validation remains enforced. Original add-only byte preservation and working/immutable identity rejection remain unchanged. C3 refreshed by source.

Source clear only. The failed A-7399 run remains a red receipt for 82273fcb and cannot establish this head. C1/C2 final marks require a new mode-free result at 835b9c8b plus retained native contract evidence A-7377. A-7421 reports the original named error before classification, corrected local macOS arm64 bounded T1/T2 27/27 and typecheck; the request additionally reports native helper dependents 7/7. These are targeted receipts, not a task/integrated pass. No Reviewer execution.

Totals: Standards 0; Spec 0. Previous medium fixture-migration finding resolved.

Criteria: C3 verified.

### impl-956 · 2026-10-20T10:28:29.773Z

Same-head mode-free verification 36efba72 passed at 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa (A-7453). Linux x64 6.8.0-142-generic, droplet c-8 lon1, 2 workers; lifetime 350s, $0.0243. T1 exit 0 (39s), T2 exit 0 (239s), 1950 reported tests/passes incl runner census. Host typecheck gate reused at 1f26bb78408f6c2f0bf2ad5b5959f78632417010, not repeated remotely. Diagnostic lint/duration budgets report-only; source identity refusal remains enforced. T3/T4 were not executed by this task run. Targeted native evidence retained in A-7377/A-7423; waiting Reviewer final verdict, head unchanged.

### rev-32 · 2026-10-20T10:28:58.099Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-956-final
commit: 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at 835b9c8bd171d1b3c825a819c1e10e25c2cd60aa; source verdict rev-20261020-956-source-3 remains current. Branch tip and hub verify head match. No findings.

A-7453, run 36efba72-a6b0-4c73-afd6-d0a37a8b50df, is a fresh mode-free Linux x64 6.8.0-142-generic droplet c-8 lon1 receipt (Node v24.21.0, Neovim v0.12.5), exit 0. T1 exit 0 and all T2 fallback exit 0; aggregate 1950/1950 reported passes including load checks. The two add-only byte-preservation/empty-map regressions and working-manifest identity-refusal regression passed ordinary execution and 5/5 repetitions. Both formerly failing tier-history regressions now pass. Host typecheck gate at 1f26bb78408f6c2f0bf2ad5b5959f78632417010 was reused, not repeated on the droplet. Diagnostic lint (131 findings/59 files), duration/budget ratchet remain report-only; unmatched identity refusal is enforced.

C1: source-reviewed add-only splicing preserves existing baseline/allowance entry bytes and number spelling, adds only missing baselines, and reports additions; same-head T1 regressions pass. Retained A-7377 supplies supplemental local macOS targeted T3 CLI proof, 2/2 with immutable identity regression, at source later committed as 82273fcb. Those native test/production files are unchanged at this head: the subsequent correction touches only three other fixture files. It is supplemental older-tree targeted evidence, not a same-head Linux T3 receipt.

C2: same-head working-manifest negative regression names unmatched test/allowance/file keys and passes 5/5; retained immutable native negative controls distinguish pinned tree from checkout. Prior A-7399 red receipt remains red for 82273fcb; the repaired literal identities now preserve legacy-history assertions under enforced validation.

C3: current source verdict verifies docs/agents/tests.md stage-close --add-only guidance, with matching help/README/skill/role documentation.

T3/T4 were not run in this task gate and remain periodic/integrated landing coverage. No all-tier or speed claim. No Reviewer runtime execution. Standards and Spec have no remaining findings. Verify C1–C3 at this head.

Evidence artifact A-7454: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7454-t-956-final-same-head-evidence-review-at-835b9c8b.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-32 · 2026-10-20T10:37:24.464Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-956-delta
commit: 20c933a97bf61672293d7b04ed10354b59959ee3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source review clear at 20c933a97bf61672293d7b04ed10354b59959ee3, after Coordinator-authorized dev merge f14989782588a8c35d00b170476284a78b126167 (parents prior reviewed 835b9c8b and dev 13e652a73f354a0adc77368888e3c5ff7c6669e8). Authorization verified in topic-729, 9418609c/fa9ba0be.

Standards: no findings. Reviewed merge-relative follow-up: only four stale tests entries removed, README/agent docs describe planning refusal, and the project Coordinator stage-close line is shortened. The production add-only implementation, shared identity matcher, working/immutable lint, selection, native CLI regressions and merge skill are byte-unchanged from the reviewed head. Inspected the upstream role split and suite-close test rename which caused the newly stale identities; moved assertions remain in roles-clauses.test.ts. No assertion is weakened by this task.

Spec: no findings. Independently compared merged manifest before/after: four tests keys deleted, no additions or changed surviving values; 3934 surviving files/tests/allow values. The line-only deletion diff preserves their byte spelling. Confirmed all four mappings in A-7478: two roles.test snapshot cases split/renamed into role clause static checks and native delivery cases, failed-shard case expanded/renamed, and surface role-request case moved to roles-clauses.test.ts. No allowance value or file baseline is changed. This follows the Coordinator's deletion-only instruction.

Shortened Coordinator clause retains dev/publication, T-931 boundary, add-only command and docs pointer. package.json confirms npm run test:durations expands to node hub/test/durations.ts refresh. Current stage-close agent docs still use --add-only; C3 refreshed by source. README/agent docs accurately explain the enforced unmatched-key refusal at shard planning, before a failing-test receipt: held batch is inconclusive and Coordinator diagnoses/recovers it.

Actual prior batch A-7466/A-7467 failure: ShardManifestError: duration key has no matching test identity: hub/test/roles.test.ts::defaults clause snapshots describe review before verification, account-limited routing, the human queue and stopped-session lifecycle. It refused before test execution, not a test failure or attribution to a member. Prior task A-7453 remains green only for 835b9c8b.

Source clear only, scope delta. C1/C2 final marks await new mode-free same-head evidence; older marks are stale. A-7478 reports local macOS arm64 full-manifest lint plus bounded targeted roles-clauses/suite-close-component/durations-refresh/suite-tiers 53/53 at this tree; T0 before clause shortening is prior-tree evidence and same-head check was pending in request. No new task/T3/T4/integrated pass claimed. No Reviewer runtime execution.

Totals: Standards 0; Spec 0.

Artifact A-7479: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7479-t-956-post-dev-delta-source-review-at-20c933a9.md

Criteria: C3 verified.

### impl-956 · 2026-10-20T10:44:23.831Z

Post-dev mode-free run 69bf0fa0 passed at unchanged 20c933a97bf61672293d7b04ed10354b59959ee3 (A-7504): Linux x64 6.8.0-142-generic, droplet c-8 lon1, workers 2, lifetime 355s, $0.0247. T1 exit 0 (38s); T2 exit 0 (244s); 2011 reported tests/passes including load checks. Host typecheck at 0bd502a82bd121bfb99334b7cdd3033665987725 reused, not repeated remotely. Duration/lint diagnostics report-only; missing baselines are reported/median-projected, not measured or refreshed in this item. Exact identity lint enforced and passed. T3/T4 not run by this task receipt; supplemental unchanged native contracts remain A-7377/A-7423 and new native role delivery 4/4 is A-7482. Waiting Reviewer final evidence verdict.

### rev-32 · 2026-10-20T10:44:46.534Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-956-final-2
commit: 20c933a97bf61672293d7b04ed10354b59959ee3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at 20c933a97bf61672293d7b04ed10354b59959ee3 after delta source verdict rev-20261020-956-delta / A-7479. Current branch tip, source review and hub receipt agree. No findings; C1–C3 refreshed.

Fresh mode-free run 69bf0fa0-1fac-442f-99f5-bbc6e7198d0c / A-7504 exited 0 on Linux x64 6.8.0-142-generic droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. T1 exit 0 (38s), all-T2 fallback exit 0 (244s); aggregate 2011/2011 reported passes including load checks. Host typecheck gate at 0bd502a82bd121bfb99334b7cdd3033665987725 was reused, not repeated remotely. Lint census 131 findings/59 files and budget/ratchet diagnostics remain report-only; identity refusal remains enforced. Five missing baselines use median projections; incomplete T3 base timings and verifier-routing duration diagnostic do not establish budget or timing passes.

C1: the two add-only entry-byte-preservation and empty-map regressions passed ordinary execution and separate 5/5 repetitions. Original CLI/immutable native contract evidence A-7377 remains supplemental local macOS 2/2 at older 82273fcb; its product and test files are unchanged at this integrated head, as checked in the delta review. This is not a fresh same-head Linux T3 run.

C2: same-head working-manifest unmatched test/allowance/file-key negative regression passed ordinary execution and 5/5; legacy-history planner regressions pass. Source-reviewed immutable boundary behavior and retained A-7377 native negative controls remain intact. The four newly stale keys were removed deletion-only under the Coordinator's instruction; current manifest admission succeeds. Original A-7466/A-7467 integrated candidate remains a planning refusal before test receipts, not a member-attributed failing test or a pass.

C3: current source verifies stage-close --add-only guidance and matching npm alias/README/skill/project role clause. Same-head T1 project Coordinator byte-reserve assertion passes. A-7482 additionally retains local macOS arm64 native roles.test.ts delivery 4/4, with same-head/platform/exit attribution from the Implementer; captured file contains the original four successes. Supplemental targeted T3 evidence, not full Linux T3 coverage.

No high, medium or low findings. T3/T4 were not run in the task gate and remain deferred periodic/integrated landing coverage. No Reviewer tests or load execution.

Artifact A-7505: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7505-t-956-final-post-dev-evidence-at-20c933a9.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T10:49:24.943Z

Merged 8dd8b24e36db81c4a32a085487923fa261a9845a onto dev.
