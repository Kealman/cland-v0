---
id: T-741
kind: task
title: "Eight T2-tagged tests that start git, jq or a check runner: move them to injected readers or retag T3"
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by:
  - T-735
  - T-719
topic: topic-452
branch: t/T-741-eight-t2-tagged-tests-that-start-git-jq
created: 2026-10-17T15:18:07.293Z
updated: 2026-10-17T17:51:35.764Z
---

## Summary

T-735's census (A-4576) shows eight files tagged T2 that start a non-cland child process, so they qualify only for T3: lead-permissions (git/nativeExec), release-item (git), skills-tracker (jq), suite-check (npm check/typecheck runner), suite-dry-run (git), suite-queue-policy (git), territory-cli (git) and verify-all (git). Once T-684 makes the lint refuse, each would block. T-719 adds projectHub's injected Git and process-table answers.

## What to build

For each file, either replace the child with T-719's injected reader or an in-process equivalent (keeping every assertion, with one retained T3 process proof only where the child itself is the behaviour), or retag it T3 with a `// T3: <behaviour>` header. The lint then reports no T2 file below its qualifying tier.

## Acceptance criteria

- [x] C1. All eight files are T2 with no non-cland child process, or T3 with a lifecycle header, and `npm run test:lint` reports none of them below its qualifying tier.
  - done: impl-741 · 2026-10-17T16:43:05.882Z
  - verified: rev-30 [reviewer] · run rev-20261017-741-source · 2026-10-17T16:51:43.578Z · commit 578ed3439e99f00432ac7b5b985a939bc1a6b44d
  - verified: rev-30 [reviewer] · run rev-20261017-741-final · 2026-10-17T17:32:22.850Z · commit 578ed3439e99f00432ac7b5b985a939bc1a6b44d
  - verified: rev-30 [reviewer] · run rev-20261017-741-merge-delta · 2026-10-17T17:51:35.044Z · commit 49c0ef7e998d5a260a9f77661390e1f7a4a546a1
- [x] C2. An audit maps every moved assertion, and each touched file passes 5/5 on the Mac and once in the task's droplet verify.
  - done: impl-741 · 2026-10-17T17:31:36.121Z
  - verified: rev-30 [reviewer] · run rev-20261017-741-final · 2026-10-17T17:32:22.850Z · commit 578ed3439e99f00432ac7b5b985a939bc1a6b44d
  - verified: rev-30 [reviewer] · run rev-20261017-741-merge-delta · 2026-10-17T17:51:35.044Z · commit 49c0ef7e998d5a260a9f77661390e1f7a4a546a1

## Comments

### impl-741 · 2026-10-17T16:36:41.125Z

Inspecting the eight subprocess files and T-719 probe seams. Will record assertion audit and before/after Mac 5-run medians, retain native process proofs where required, and retag the sorted manifest.

### impl-741 · 2026-10-17T16:48:57.846Z

Implemented at 578ed3439e99f00432ac7b5b985a939bc1a6b44d and pushed to origin after fetch/merge origin/dev (up to date). Audit A-4632 maps 46 declarations and retains all 462 original assertion call sites including helpers; raw Mac receipts/checker/lint/census are A-4633. All ten destination test files passed 5/5 serially, no skips, load <15. Sum of file test-time medians 59.407s -> 47.930s including split coverage. Typecheck, test:tiers and test:lint pass; no scoped file below qualifying tier. T2 census: Lead component 0 children, queue policy 0, tracker only its intended CLI. C1 done; C2's Mac/audit evidence is complete, droplet evidence follows clear source review.

### rev-30 · 2026-10-17T16:51:43.578Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-741-source
commit: 578ed3439e99f00432ac7b5b985a939bc1a6b44d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-741 source review — clear

Head578ed3439e99f00432ac7b5b985a939bc1a6b44d, fixed point0ffa17c33df21a4bcb2f0d3830e2c1a220ce01c7. One commit,13 changed files; branch tip independently confirmed. No production change. Read-only review; no Reviewer tests/compiler/census execution.

## Standards
No findings. Six original native files now have explicit T3 behavior headers and matching sorted manifest entries: lead-permissions native worktree/merge races; release-item Git publication/ref/hook/retry contracts; suite-check npm completion/cancellation and writer reaping; suite-dry-run real CLI/native candidate; territory-cli native refs/hooks/pushes; verify-all real Git deciding-path/admission. Their native behavior is retained, not hidden behind T2 labels.

Four Lead rule declarations move to T2 with production adapters/frames, FakeClock, fake projectHub probes and in-process peers. TaskWorktrees' separate execFile reader is replaced with an exact-command no-territory predicate; unexpected commands fail instead of forwarding to a native child. The Codex authorization proof still drives the production adapter at held version/thread-start boundaries, while mocked app-server edges preserve rollback/no turn/client closure assertions. Existing lead-permissions-process remains the native child proof.

heldOperations is extracted byte-identically (apart from export) and registers resource-phase release/join before fixture setup. The controlled early-assertion case now supplies the real mock context to its captured-hook fixture; assertions still prove settlement while root/peer remain usable, followed by root removal. Native retained barriers continue using that ownership helper.

skills-tracker's documented jq program and complete frontier scenario move intact to T3; the T2 parser/tracker rules use fake startup probes. One intended task CLI remains because real stdin bytes are the subject. Its ChildProcess cleanup kills only a still-live owned handle and awaits close before fixture-root cleanup, avoiding the unrelated process-table probe. The exact UTF-8/exit assertions remain.

Queue policy uses the pre-existing SuiteCandidate interface for clean head/tree/selection, retaining production candidate config validation independently. Executor delivery, worker overrides, admission-time config reload, logs and invalid candidate assertions remain. No production seam was added.

## Spec
C1 verified: all eight original files and both destination files are at qualifying tiers; supplied lint agrees for every scoped path. The three remaining T2 destination files have supplied census receipts: Lead component0children, queue policy0, skills-tracker one intended CLI and0non-cland children. Source tracing supports those boundaries. Native Git/npm/jq contracts remain T3.

C2 audit/source portion supported. Reviewed all change hunks and supplied AST audit/checker.46 unique original declarations map to exactly46 destinations;452 declaration assertion sites and462 including helpers are retained. Independent read-only expression/multiplicity comparison also finds462old/465new, no missing original expression and3additional fake-command guards. The extraction preserves exact jq program execution and frontier transitions, held-operation invariants, native worktree/merge races, publication/hooks/refs, npm reaping, and dry-run/verify-all deciding-path assertions. Assertion text alone was not treated as semantic proof: fixture substitutions and retained boundaries were inspected separately.

## Supplied Mac evidence
A-4632/A-4633 contain all eight originals5/5 and all ten destination files5/5. Independent raw receipt/timing audit selects90whole-file logs with460passes,0fail/cancelled/skipped. The initial overlapping release baseline set is excluded and replaced by before-serial5/5; the initial component debug TypeError is retained, explained by the missing fixture mock context and corrected in the reviewed source, not counted as green evidence.

Summed per-file top-level test-time medians59.406702580s→47.929752168s. Separate subprocess-wall median sums62.488213625s→51.503426458s. All split coverage is included; no promised causal speed ratio. Maximum sampled1mload9.099609375. Supplied typecheck/tier/report-only lint green; all ten scoped lint lines have declared tier equal to qualifying tier. No duration manifest/baseline/allowance changes.

Full source clear; findings[]; verify C1 at this exact head. C2 remains unverified until exact-head normal mode-free droplet evidence includes the touched coverage and claimant done mark. Any standing Coordinator submission hold still applies. No per-item QA (none/after-stage).

Standards0findings; Spec0findings.

Durable review: A-4635.

Criteria: C1 verified.

### rev-30 · 2026-10-17T17:32:22.850Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-741-final
commit: 578ed3439e99f00432ac7b5b985a939bc1a6b44d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-741 final evidence review — clear

Exact source-reviewed head578ed3439e99f00432ac7b5b985a939bc1a6b44d remains the branch tip. Current full source verdict rev-20261017-741-source / A-4635 verifies C1. Task view confirms claimant C2 done and passed exact-head droplet5a82d710-55ca-47cc-8da5-cccd309ec90e / A-4664. No source changes. Read-only receipt review; no Reviewer execution.

A-4664 ends exit0. Normal automatic hub-only selection plus Neovim smoke runs host npm run check/typecheck/report-only lint, then144/144 hermetic,1952machine/1947pass+5skip,12/12smoke. Total2108tests/2103pass/0fail/0cancelled/5unrelated prerequisite skips. No hard duration-budget or failed load-gate line.

All ten destination files have actual positive suite-timing receipts, covering every46 original declarations:
lead-permissions2/4.397505049s; Lead component4/1.575651293s; release-item8/4.996945608s; skills-tracker8/1.382878313s; jq contract1/0.485153824s; suite-check3/1.413447757s; suite-dry-run4/2.356661117s; queue-policy1/0.195821958s; territory-cli14/7.605395641s; verify-all1/1.405012001s. Sum25.814472561Linux test-seconds. All five moved identities (four Lead, one jq) pass5/5each,25/25. No touched case skips.

C2 verified with unchanged assertion/source audit A-4635 plus Mac A-4632/A-4633: all ten destination files5/5, independently audited along with originals at source review.46 declarations and462 original assertion expressions including helpers remain mapped, with three extra fake guards. Mac median top-level test-time sum59.406702580s→47.929752168s; separate subprocess-wall sums62.488213625s→51.503426458s. Linux25.814472561s is disclosed separately, not substituted for the Mac comparison. Initial debug red and overlapped original release baseline remain excluded as documented.

C1 remains current: six original native files and jq contract retain T3 headers; three destination components use the injected/native-replaced seams. The prior zero-child/one-intended-CLI census and source boundary review apply unchanged. No production changes or hidden removal of Git/npm/native proofs.

Supplied accounting: c-8lon1 Linuxx64 6.8.0-142-generic,Node24.21.0/Neovim0.12.5,2workers,lifetime1600s,cost$0.1111. Suite1535.82s,peak1mload9.45,extra gate wall6.89s; smoke19.77s completes. T3 ratchet4381.253s versus4358.593s base says would refuse growth in report-only mode; this is explicitly disclosed, not a hard failure or a claim of ratchet compliance. Missing split-file baselines/report-only tier findings also remain visible.

Final evidence clear, findings[], C1/C2 verified across current source and same-head receipt. No per-item QA; no further task run requested. Standards0/Spec0remaining findings.

Durable review: A-4668.

Criteria: C1 verified, C2 verified.

### impl-741 · 2026-10-17T17:32:24.433Z

Exact reviewed head 578ed343 verified green by droplet run 5a82d710-55ca-47cc-8da5-cccd309ec90e (A-4664): 2103 pass, 0 failures, 5 unrelated skips; Linux x64, c-8 lon1, workers 2, lifetime 1600s, $0.1111. A-4667 confirms all 46 scoped declarations in all ten destination files passed without skips; all five moved declarations also passed load gate 5/5. C2 now done. Expected report-only T3 increase +22.660s is exactly the observed seconds of six promoted native files plus the extracted jq contract, broken down in A-4667; Coordinator will refresh T3 base at E-677 stage close before hard budgets. Awaiting final same-head evidence verdict.

### impl-741 · 2026-10-17T17:50:45.900Z

Coordinator-authorized conflict-only dev merge pushed at 49c0ef7e998d5a260a9f77661390e1f7a4a546a1. Only conflict tiers.json; preserved all dev entries outside the ten owned tags, all ten reviewed tags and sorted order. T-690 retag overlap is empty; all twelve task test/support sources are byte-identical to 578ed343. Requested tier/lint checks pass and suite-tiers.test.ts 5/5 serial (40 passing declarations, no skips). Proof/receipts A-4679. Delta review delivered through reviewer. Per Coordinator decision 0b7bafd0-dbea-4826-b0ba-3df1b66366c8, no verify rerun: 5a82d710 remains the execution receipt.

### rev-30 · 2026-10-17T17:51:35.044Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-741-merge-delta
commit: 49c0ef7e998d5a260a9f77661390e1f7a4a546a1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-741 conflict-only delta — clear

Reviewed head49c0ef7e998d5a260a9f77661390e1f7a4a546a1, parents prior final578ed3439e99f00432ac7b5b985a939bc1a6b44d and incoming dev7ae2053ac52cadb75637d3207d1ff364b3cbf2f4. Primary Coordinator0b7bafd0-dbea-4826-b0ba-3df1b66366c8 read directly: authorized rule11 conflict-only merge, preserve ten tags/all outside dev entries, requested lint/tier/five serial checks, no verify rerun; prior5a82d710 stands.

## Standards
No findings. Independent JSON comparison proves the merged manifest is exactly the complete incoming dev map overlaid with ten prior reviewed task tags, sorted. All outside entries and all other manifest fields equal incoming dev. Ten retained tags: T2 lead-permissions-component, skills-tracker, suite-queue-policy; T3 lead-permissions, release-item, skills-tracker-jq, suite-check, suite-dry-run, territory-cli, verify-all. Independent comparison of T-690a1fb7a24 with its parent finds no overlap with those ten paths, so no silent tag override occurred.

All twelve task test/support files independently byte-identical to reviewed578ed343. Own diff against incoming dev remains those twelve and tiers.json only; no own production/fixture edit from conflict resolution. Other source changes are inherited dev.

## Spec/evidence
C1/C2 refreshed with no new assertion mapping or execution claim. Prior A-4635 source and A-4668 final analysis retain all46 declarations and behavior. Linux5a82d710/A-4664 actually ran at578ed343, not at this merge head; its continued acceptance here is the explicit Coordinator disposition above. That receipt has2103pass/zero failures/five unrelated skips, all ten destination files46cases and25/25moved-identity repetitions, Neovim smoke complete. Original accepted Mac5/5 remains unchanged-source evidence.

A-4679 requested checks audited: test:tiers reports43hubfree/236machine; supplied report lint declares all ten at their exact qualifying tiers. Five raw suite-tiers TAP files each8pass/0fail/0cancel/0skip,40passes total. timings.json reports all code0, maximum sampled one-minute load3.78759765625, reported-test median0.716674125s and process-wall median0.872428541s. No Reviewer execution or new task run.

A-4667's expected report-only T3 increase22.660s/0.52% remains disclosed; it reflects promoted native carriers rather than a speed-compliance claim. Primary e73f2be1 assigns the E-677 stage-close base refresh to the Coordinator before hard budgets. No per-item QA.

Standards0/Spec0 findings. Delta clear; verify all C1/C2 at49c0ef7e under the explicit retained-receipt disposition. No verification rerun requested.
Durable review A-4681.

Criteria: C1 verified, C2 verified.
