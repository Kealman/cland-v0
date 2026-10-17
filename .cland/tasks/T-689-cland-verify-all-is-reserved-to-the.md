---
id: T-689
kind: task
title: cland verify all is reserved to the Coordinator, the human and occasions; task runs use the diff selection
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-413
branch: t/T-689-cland-verify-all-is-reserved-to-the
created: 2026-10-16T19:59:28.743Z
updated: 2026-10-17T03:26:13.413Z
closed: 2026-10-17T03:26:13.413Z
---

## Summary

142 of 475 task runs were full because a session typed `all`, mostly for the flaky gate's second receipt, experiments and briefs (report-strategy §1.3). With quarantine (T-657) in place, the memo reserves `all` to the Coordinator and occasions (memo §5.2.6, §5.5 step 1). The flaky gate's second run (spec v0.1.3 §5) becomes an ordinary diff-selected verify.

## What to build

A `verify` request with mode `all` (CLI `all` or `--all`, MCP `mode: "all"`) from a session that holds neither the Coordinator role nor the human's shell is refused with `verify-all-reserved`, naming the diff selection it would get without the mode. The Coordinator, the human shell and `--occasion` requests keep `all`. Integrated `dev` runs stay full as today. `docs/agents/tests.md`, the Implementer and Lead clause lines that mention `all`, and spec v0.1.4's flaky-gate sentence say the second receipt is a diff-selected run; the clause change stays within `roles.test.ts`'s byte headroom.

## Acceptance criteria

- [x] C1. An Implementer's `cland verify all` and MCP `verify` with mode `all` are refused with `verify-all-reserved` and leave no queue entry, proved by CLI and frame tests.
  - done: impl-689 · 2026-10-16T23:43:09.841Z
  - verified: rev-30 [reviewer] · run rev-20261017-689-final · 2026-10-17T01:51:07.713Z · commit 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3
  - verified: rev-30 [reviewer] · run rev-20261017-689-merged-final · 2026-10-17T03:26:05.993Z · commit b0896ddba41244e18d3eafcbe533032ecb877aff
- [x] C2. The Coordinator's and the human shell's `all` and any `--occasion` request are admitted, proved by the same tests.
  - done: impl-689 · 2026-10-16T23:43:10.056Z
  - verified: rev-30 [reviewer] · run rev-20261017-689-final · 2026-10-17T01:51:07.713Z · commit 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3
  - verified: rev-30 [reviewer] · run rev-20261017-689-merged-final · 2026-10-17T03:26:05.993Z · commit b0896ddba41244e18d3eafcbe533032ecb877aff
- [x] C3. `docs/agents/tests.md`, the role clauses and `docs/spec/v0.1.4.md` describe the reserved mode and the diff-selected second receipt, and `roles.test.ts` passes its byte headroom.
  - done: impl-689 · 2026-10-16T23:43:10.329Z
  - verified: rev-30 [reviewer] · run rev-20261016-689-source · 2026-10-16T23:44:50.171Z · commit 19be0a95a8303ecca6ffef474a2d4790a920c5b2
  - verified: rev-30 [reviewer] · run rev-20261017-689-executor-correction · 2026-10-17T01:08:48.123Z · commit 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3
  - verified: rev-30 [reviewer] · run rev-20261017-689-final · 2026-10-17T01:51:07.713Z · commit 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3
  - verified: rev-30 [reviewer] · run rev-20261017-689-dryrun-merge · 2026-10-17T02:43:10.982Z · commit b0896ddba41244e18d3eafcbe533032ecb877aff
  - verified: rev-30 [reviewer] · run rev-20261017-689-merged-final · 2026-10-17T03:26:05.993Z · commit b0896ddba41244e18d3eafcbe533032ecb877aff

## Comments

### impl-689 · 2026-10-16T23:29:19.096Z

Implementation started. Agreed acceptance seams: verify CLI and suite.run/verify frame admission. Will refuse explicit all before queue admission and retain occasion/Coordinator/human behavior; docs and role clause changes remain scoped.

### impl-689 · 2026-10-16T23:34:36.363Z

Implemented e70ea5a7: shared CLI/MCP admission checks hub-held role, refuses all before scheduler entry, and describes auto diff selection. Added T2 frame/CLI proof and actual MCP check in existing selection-report test; existing fixture callers now auto, while tests requiring forced full use Coordinator. Docs and Implementer/Lead clauses updated; QA default's stale exception removed. origin/dev merged (already current). Typecheck and test:tiers pass at committed head; serial touched-file checks underway.

### rev-30 · 2026-10-16T23:44:50.171Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-689-source
commit: 19be0a95a8303ecca6ffef474a2d4790a920c5b2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-689 full source review clear at 19be0a95a8303ecca6ffef474a2d4790a920c5b2 on t/T-689-cland-verify-all-is-reserved-to-the. Fixed point incoming dev 8c0a2b8fc959f13f7c915be39f08ebc6eb515783; git diff 8c0a2b8f...19be0a95, including the pre-review merge of T-686. Origin tip matches. Task hold/spec/criteria read; both axes reviewed in-session under the no-delegation role.

## Standards

No findings. The new verify-all component is T2 with a declared header, projectHub and real session/UI frames; CLI subprocesses exercise the CLI contract and Git processes prepare the fixture. It launches no package worker: a planted hand-holder keeps admitted jobs observable until cancellation. The CLI all/--all permutations reuse one fixture. No literal sleep, timer wait or elapsed-time assertion is added. The actual MCP refusal is added to the existing T3 selection-report contract rather than launching another binary fixture. Existing process/restart/cache/queue tests retain their lifecycle scenarios; this change does not add processes to them.

## Spec

No findings. Both CLI and MCP suite.start routes enter the same startSuite admission closure. It checks current caller identity and reporting permissions, then refuses explicit mode all for a session that does not currently hold Coordinator and has no occasion. Hub-held role is re-read, so a stale CLAND_ROLE shell hint does not grant the exception. The closure is retained as the existing scheduler reauthorization callback.

VerifyAllReserved maps to a structured verify-all-reserved result with describeSelection(selectPackageSuite(cwd, auto)), before calling Suites.start on the initial refusal. No job/queue/worker/lease reservation is made there; automatic selection may perform its existing Git fetch/read work. The human caller remains actor null. An occasion bypasses only this new reserved-mode condition, then must still pass the existing Coordinator/QA-epic role check and Suites.start's integrated clean dev, fresh fetched-head and full-mode proof. Integrated dev automatic selection remains full; suites.ts itself is unchanged.

The new real-frame/CLI test covers Implementer all and --all refusals, the automatic mode/reason/deciding path, unchanged empty queue/suite state, current hub role promotion despite stale shell hints, Coordinator frame/CLI admission and human CLI/frame admission. Existing suite-close tests retain authorized Coordinator occasions and QA epic, plus unauthorized/task-head/non-full refusals. The selection-report test exercises the real MCP verify tool's typed refusal/no new suite, then promotes the caller for the original forced-full assertion.

Fixture default mode becomes auto; corresponding result-label assertions change all to auto without dropping their exit/count/cleanup assertions. The cache test whose subject requires different effective full/reduced modes explicitly promotes its fixture caller to Coordinator and retains forced all. This preserves the distinction rather than weakening that assertion.

C3 documentation is established: docs/agents/tests.md, v0.1.4's flaky-gate sentence, shipped/project Implementer and Lead clauses, QA default and QA skill consistently reserve all and direct a diff-selected second receipt. roles.test.ts adds both clause assertions and retains its existing 512-byte headroom check beneath MAX_TEXT_BYTES; raw A-4257 shows both default/project snapshots and all eight role cases green.

A-4257 records all thirteen serial touched/compatibility files green below load 15: roles, verify-all, suite, admission, cache/recovery, candidate, human, queue/recovery/scheduling, selection-report and close. The new component takes 1.375 test-seconds (1.616 Node total); no allowance added. Typecheck and tier lint reported green at the committed head; independent whitespace check passes. Reviewer performed read-only inspection only, no tests/compiler/provider.

C3 verified from source/docs and the exact-head headroom receipt. C1/C2 and final runtime verdict remain pending accepted exact-head normal mode-free droplet verification. Source clearance does not lift the Coordinator's daily-spend submission hold; wait for its explicit lift. No per-item QA criteria. Standards 0 findings; Spec 0 findings.
Review artifact A-4258.

Criteria: C3 verified.

### impl-689 · 2026-10-17T01:07:25.412Z

Fixed the missed private executor fixture after red run a4c094d5/A-4259. Pushed 2e2015be: two-line auto-mode migration, existing assertion meaning retained. Red repro confirmed both policy refusals; full executor.test.ts now 3/3 green (5.60s), typecheck and tier lint pass. No dev merge per rule 11. Coordinator confirmed pid-identity database lock is an existing E-482 flake; left unchanged. Requesting new source review before retry.

### rev-30 · 2026-10-17T01:08:48.123Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-689-executor-correction
commit: 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-689 delta source clear at 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3, compared with source-reviewed 19be0a95a8303ecca6ffef474a2d4790a920c5b2. Origin tip matches. Only two lines in hub/test/executor.test.ts change; no production edit or dev merge. Standards and Spec: no remaining findings in this delta.

A-4259 / a4c094d5-7056-467b-87d5-21034e291760 remains a failed prior-head receipt. Its detailed executor failures explicitly say verify-all-reserved at the private fixture's launch helper, before platform/legacy-recovery assertions could run. The separate pid-identity failure says SQLite database is locked. The Implementer reports Coordinator classifying that as existing E-482; this source review neither needs nor substitutes a known-red gate exception.

The corrected fixture keeps its Implementer caller and requests auto instead of all. This fixture has no Git selection baseline, so its existing conservative full fallback still executes the same package scripts. The recovered legacy result assertion changes only the request-mode label to auto; it still requires exit 0. Platform evidence, worker PATH Node/candidate pin, receipt and journal comparisons, exactly-once recovery across restarts, local executor fallback and cleanup assertions remain unchanged.

Inspected remaining explicit-all CLI/frame/fixture sites: intentional refusal proofs; human UI/shell requests; Coordinator-promoted cache, cover and selection fixtures; authorized occasions and their deliberate refusal tests; stored historical result/job records. No additional session caller migration issue found in this audit.

A-4260 reports bounded reproduction of the two executor policy failures, then the whole corrected executor.test.ts 3/3 green (5.60 seconds) with typecheck/tier lint green at this head. Independent whitespace check passes. Prior A-4257 and A-4258 source/docs evidence remain applicable to unchanged feature bytes; Reviewer executed no test/compiler/provider.

C3 refreshed because its docs/clauses and previously audited headroom proof are unchanged by these two lines. C1/C2 and final gate remain pending a fresh accepted exact-head mode-free droplet result. A-4259 is retained as red evidence, not promoted to a pass. No per-item QA. New verification must respect the Coordinator's current submission disposition.
Review artifact A-4263.

Criteria: C3 verified.

### rev-30 · 2026-10-17T01:51:07.713Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-689-final
commit: 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-689 final evidence clear at unchanged source-reviewed 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3. Audited durable A-4270 / 9019fe48-7838-4465-b99f-1944f3da65c4 and matching passed task verification record.

Normal mode-free request selected full because of the shared protocol change. Full hub plus Neovim exits 0: 2438 total, 2430 pass, zero fail, eight prerequisite/platform skips. Hub free 41 pass; machine 1999 pass/5 skips; Neovim 390 pass/3 skips. No hard duration-budget or load-gate failure.

C1: the new T2 explicit-all admission case passes ordinarily (1.775591280 seconds) and 5/5 repetitions. Its real CLI all/--all and session-frame checks retain typed verify-all-reserved, automatic diff reason/deciding path and empty queue/suite state. The existing selection-report MCP contract also passes (4.285789447 seconds), including the actual verify tool refusal and no extra suite.

C2: the same T2 case proves current hub-held Coordinator role admission despite stale shell hints, Coordinator CLI/frame all, and human CLI/frame all. All seven suite-close cases pass, retaining authorized Coordinator/QA epic occasions, one-slot ordinary integrated batches, cache behavior and unauthorized/task-head/non-full/fresh-fetch refusals. Existing occasion policy is preserved rather than permitting arbitrary occasion flags.

The missed private executor fixture is corrected in this exact run: all three executor cases pass, including worker PATH/platform receipt/journal evidence (3.126728492 seconds) and exactly-once restored legacy result (4.400131891 seconds). Prior A-4259's two owned verify-all-reserved failures therefore do not recur. This does not recast A-4259 as green or establish unrelated historical SQLite causality.

C3: source/docs and role-clause evidence A-4258/A-4263 remain unchanged; both default/project snapshot cases pass again (2.307/2.349 seconds), including the existing clause byte-headroom assertions and new reserved-all/diff-second-receipt wording. The touched automatic cache/admission/queue/recovery/scheduling fixture paths execute in the completed full run.

All C1-C3 claimant done marks are present. Verify all; Standards and Spec have no findings. Linux x64 c-8 lon1, two workers, suite 2397.04 seconds, peak load 10.09, reported lifetime 2472 seconds/cost $0.1717. No further task run or per-item QA required. Reviewer performed only read-only evidence inspection.
Review artifact A-4273.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-17T02:43:10.982Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-689-dryrun-merge
commit: b0896ddba41244e18d3eafcbe533032ecb877aff
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-689 merge-resolution source clear at b0896ddba41244e18d3eafcbe533032ecb877aff, parents prior final-clear 2e2015bec656fda4ff9a5abb7356ca5a17b4f3a3 and incoming dev 341e5ff2eef02eaed1367d85bcda733b2c63a428. Origin tip matches. Read primary Coordinator 0be14c58 authorizing this conflict pass, matching-file checks and fresh verification. Standards and Spec: no findings.

The dispatcher resolution preserves T-681's optional report/topic fallback and report-free dry-run send/artifact exemption. That exemption is conditional only on dryRun without report; stable caller identity, the current hub-held Coordinator/occasion restriction on explicit all, and existing occasion authorization remain outside it. dryRun is forwarded to Suites.start, preserving the early no-job preview return. VerifyAllReserved still produces the typed refusal with automatic selection before initial scheduler entry and on reauthorization failure. T-635 models.list is retained in the session CLI frame set and its native handler.

The existing T2 test adds report-free auto-preview success with dryRun true and unchanged empty suites/queue, followed by report-free explicit-all preview refusal with verify-all-reserved and still-empty state. Original CLI/frame/human/Coordinator assertions remain. No new process, timing wait, test file or allowance is added by the manual resolution.

Independent literal identifier inventory confirms all 17 matching hub/Neovim files named by the conflict search. A-4281 records every one green once serially below load 15, plus the pure suite-tier-report file (18 files total); verify-all 1.80s, dry-run 2.12s, models 8.97s, shell 30.07s. Committed-head typecheck and tier lint pass recorded; independent whitespace check passes. Incoming tier map is preserved exactly with only verify-all.test.ts T2 added, keys sorted. Shipped/project role clause bytes match the prior task parent.

C3 documentation/headroom source proof refreshed. C1/C2 and final merged-tree runtime gate remain pending fresh exact-head mode-free droplet verification. A-4270/A-4273 are historical prior-head green/final evidence, not verification of this merge. The batch restart/rollout remains Coordinator-owned. Reviewer executed only read-only inspection; no tests/compiler/provider and no per-item QA.
Review artifact A-4282.

Criteria: C3 verified.

### rev-30 · 2026-10-17T03:26:05.993Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-689-merged-final
commit: b0896ddba41244e18d3eafcbe533032ecb877aff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-689 final merged-head evidence clear at unchanged source-reviewed b0896ddba41244e18d3eafcbe533032ecb877aff. Audited complete A-4289 / a43a1fe2-2e27-4207-aaac-5e84161308f7 and matching passed task verification record. This is the fresh gate for source resolution A-4282, not reuse of A-4270.

Normal mode-free verification selected full for shared protocol. Full hub+Neovim exits 0: 2454 tests, 2446 pass, zero fail, eight prerequisite/platform skips. Free phase 44 pass; machine 2011 pass/5 skips; Neovim 391 pass/3 skips. No hard duration-budget or load-gate failure.

C1/C2: verify-all T2 case passes ordinarily (3.119262026 seconds) and 5/5 repetitions. It preserves the original session CLI/frame refusal/no-queue, human and current-Coordinator admission proofs; its merge additions prove report-free auto preview returns dryRun true with empty state, while report-free all preview is still refused as verify-all-reserved. The real MCP selection-report contract passes with its typed refusal/no extra suite. All suite-close occasion/batch cases pass, retaining QA epic/Coordinator authority and unauthorized/task-head/non-full/fresh-fetch checks.

All 17 independently inventoried matching merge-review files execute in this receipt. In particular, the four T-681 dry-run/report/projection/legacy cases pass (CLI 0.964997235 seconds), six T-635 model cases pass, full Neovim shell executes, and both corrected executor fixture cases plus source contract pass. This covers the combined model handler, report-free permission exemption, reserved-all guard and dryRun forwarding in the exact merged tree.

C3: both default/project clause snapshots pass again (2.526/2.538 seconds), including byte headroom and reserved-mode/diff-second-receipt wording; source/docs are unchanged from A-4282. Current task view has all claimant done marks. Verify C1-C3; Standards and Spec have no findings.

Linux x64 c-8 lon1, two workers, suite 2430.44 seconds, peak 9.74, reported lifetime 2502 seconds/cost $0.1738. Final clear at this head; Coordinator owns the subsequent batch merge/restart. No further task run or per-item QA required. Reviewer performed only read-only evidence inspection.
Review artifact A-4290.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-17T03:26:13.413Z

Merged 977cc20a7b317de7da122dc6a7f368ca3cfbd8e6 onto dev.
