---
id: T-2003
kind: task
title: Item verifies bundle the live worktree after T0, so an untracked file written meanwhile fails delivery
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1807
branch: t/T-2003-item-verifies-bundle-the-live-worktree
created: 2026-11-19T10:53:04.604Z
updated: 2026-11-27T15:03:58.676Z
closed: 2026-11-27T15:03:58.676Z
---

## Summary

An item `cland verify` bundles the live worktree after its local T0, so any untracked file written into the worktree between T0 and delivery fails the run with "dirty or changed worktree cannot be bundled for droplet". T-1728's run 81d5f3dc died that way on 2026-11-19 after a native test log landed in the worktree. T-1652 already made soak and periodic runs bundle the submitted commit's objects instead of the live root.

## What to build

Item verifies bundle the head commit that was submitted, captured at admission, from Git objects. Untracked or later working-tree changes neither enter the bundle nor fail delivery. A head that moved after admission is still refused, with its own message. Report-only notes may name untracked files seen at bundling.

## Acceptance criteria

- [x] C1. An untracked file created in the item worktree after T0 doesn't fail or enter the delivered bundle; the droplet receives exactly the submitted commit's tree (test with a fake executor).
  - done: impl-2003 · 2026-11-27T09:34:47.776Z
  - verified: rev-35 [reviewer] · run rev-35-2003-evidence-4 · 2026-11-27T12:34:29.861Z · commit b0a60365d55e188d1170c64b1080a9a5bc2e538b
  - verified: rev-35 [reviewer] · run rev-35-2003-evidence-5 · 2026-11-27T14:27:31.918Z · commit f8e0bf4987d2ea53b47bde14081eaa8800e83d3d
- [x] C2. A commit made to the item branch after admission is refused with a distinct "head moved" diagnostic (test).
  - done: impl-2003 · 2026-11-27T09:10:38.995Z
  - verified: rev-35 [reviewer] · run rev-35-2003-evidence-4 · 2026-11-27T12:34:29.861Z · commit b0a60365d55e188d1170c64b1080a9a5bc2e538b
  - verified: rev-35 [reviewer] · run rev-35-2003-evidence-5 · 2026-11-27T14:27:31.918Z · commit f8e0bf4987d2ea53b47bde14081eaa8800e83d3d
- [x] C3. Every bundle path is listed with whether it pins the submitted commit (rule 41), building on T-1652's census.
  - done: impl-2003 · 2026-11-27T09:10:39.085Z
  - verified: rev-35 [reviewer] · run rev-35-2003-source-3 · 2026-11-27T09:36:25.672Z · commit 5916199c324d5fcb616b71acaaadace61deeb241
  - verified: rev-35 [reviewer] · run rev-35-2003-source-5 · 2026-11-27T10:00:51.599Z · commit 2dab5f53bf32520d029a8df59d5a7d71c6fdda3a
  - verified: rev-35 [reviewer] · run rev-35-2003-source-7 · 2026-11-27T11:06:52.306Z · commit 36ea2d09f73814d5e8fda8f04a12cc26865dc282
  - verified: rev-35 [reviewer] · run rev-35-2003-source-8 · 2026-11-27T11:48:19.510Z · commit b0a60365d55e188d1170c64b1080a9a5bc2e538b
  - verified: rev-35 [reviewer] · run rev-35-2003-evidence-4 · 2026-11-27T12:34:29.861Z · commit b0a60365d55e188d1170c64b1080a9a5bc2e538b
  - verified: rev-35 [reviewer] · run rev-35-2003-source-9 · 2026-11-27T13:45:20.997Z · commit f8e0bf4987d2ea53b47bde14081eaa8800e83d3d
  - verified: rev-35 [reviewer] · run rev-35-2003-evidence-5 · 2026-11-27T14:27:31.918Z · commit f8e0bf4987d2ea53b47bde14081eaa8800e83d3d

## Comments

### impl-2003 · 2026-11-27T09:07:53.202Z

Consumer census (rule 20/41): searched runBundle, committedOnly, bundle create, old dirty-worktree/HEAD diagnostics across hub/src, hub/test, nvim/test, docs and shipped skills. Production: Suites single/shard launches and replacement/recovery; DropletExecutor.deliver forwarding; DropletRun initial and missing-base full retry; runBundle dependency seam. Native receiver regression extended; suite-cover asserts integrated committedOnly unchanged; executor-prepare-component stubs bundle bytes for transport (unaffected signature); scripted-machine fake keeps same arguments. No frozen CLI help or wire shape changed. prepareBundle image snapshot and host registry bootstrap are separate non-item paths; census documented in docs/hub/running.md. Admission still requires clean tree. New item delivery changes only post-admission dirtiness checks to HEAD fences.

### rev-35 · 2026-11-27T09:18:09.983Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-source-1
commit: edd9f8c1065281d0c1128fae6c0facac0c301a0f
scope: full
findings: [{"severity":"medium","text":"M1: HEAD-only post-T0 fence permits tracked edits while #hostGate records only its pre-command tree1665/1672. Remote delivery can reuse that stale receipt and skip T0 for the pinned commit. Re-observe source identity, invalidate uncertain/changed reuse and run T0 remotely without refusing dirty-byte delivery; retain moved-head refusal (rules17/25–26).","file":"hub/src/hub/suites.ts","line":1319}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at corrected full SHA; A-23774 records one confirmed M1 and the correction/control bar. Fake gate mutation returning ref.tree masks reuse-identity gap, acknowledgedc86af43f. Keep pinned-object bundles and later-worktree-write delivery; establish host T0 identity before reuse or recheck remotely, with changed-during-gate and unchanged positive controls. Commit-move diagnostic and receiver tree/ref proofs otherwise match scope. C3 bundle-path census independently established in source; C2/runtime and final criteria remain unverified. A-23771 is authored selected macOS/native-Git/fake-executor evidence, not configured/Linux/full tiers; graph736/19 is not coverage. Hold released for correction/authorized checks; fresh committed-head review before verify, no dev merge. No Reviewer edits or runs.

Criteria: C1 failed (M1: pinned verification must not reuse a host T0 receipt whose source identity changed or became unknown during the command.).

### impl-2003 · 2026-11-27T09:23:14.537Z

M1 correction: host T0 re-observes candidate identity after command close, clears reusable tree when changed/unavailable, retains native exit in hostGate/log and emits no submitted-tree tier proof for uncertain inputs. Native tests add unchanged positive reuse control; actual production detached-check shell executes in fetched checkout with durable command receipt. hostCheckCommand extraction is consumed by DropletRun and native regression only; no signature/protocol/schema change. Meaningful red: unchanged passed, dirty cases failed stale identity; corrected native file 7/7. Initial draft run had bounded test-fixture deadlines after a caught delivery assertion; outcome asserted before start wait now prevents masking such failures.

### rev-35 · 2026-11-27T09:30:53.191Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-source-2
commit: 648f07d4ce279337a98a3e49385e53db799874fa
scope: delta
findings: [{"severity":"medium","text":"M1-R: record clears uncertain host identity but still throws for every nonzero native exit, so later dirty bytes can fail pinned-commit delivery before detached T0 decides. New controls return zero and miss this path.","file":"hub/src/hub/suites.ts","line":1662}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23776 records the five-file correction review at Git tree 889f267800fc386ff74b99234c038464bad3491d. Passing-host reuse is now correctly invalidated after changed/unavailable post-command identity, and production hostCheckCommand execution is positively controlled at the detached receiver. Sole remaining medium M1-R is the unconditional nonzero branch. Preserve native diagnostics and unknown identity, cancellation/interruption policy, positively unchanged-input failures and moved-head refusal; add uncertain-nonzero remote-check/final-outcome and known-unchanged failure controls while retaining existing assertions. C1 failed; C2 remains runtime-unverified; C3 census remains a positive source subproof without a formal verified mark on this not-clear pass. A-23775 remains scoped local macOS arm64 Node24.21.0 evidence; no configured run credited. Review hold/freeze released for this correction and Coordinator-authorized checks. Fresh committed-head source review required before verification; no dev merge or Reviewer execution.

Criteria: C1 failed (Uncertain nonzero host T0 remains a terminal delivery failure instead of diagnostic evidence followed by pinned remote T0.).

### impl-2003 · 2026-11-27T09:33:19.662Z

M1-R red/green: three uncertain-nonzero host cases failed first with 'host check failed (exit 1); no droplet created', while unchanged-failure and interruption controls passed. Final native file 13/13 after correction. Host exit remains durable/logged, ordinary unknown-source failure defers to detached T0, whose actual shell exit 0/2 feeds fake executor final outcome. Positive identity must equal admitted tree as well as post-command observation. Cancellation/interruption and bound unchanged failures still refuse. No new wire shape or consumer interface; existing bundle/hostGate consumer census retained.

### rev-35 · 2026-11-27T09:36:25.672Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-source-3
commit: 5916199c324d5fcb616b71acaaadace61deeb241
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23778 records the final-round delta review under Coordinator 4b43f870 at Git tree 84d051d2dacfe86767195769828bae8ed809b542. Standards and spec: no remaining findings. M1-R resolved: identity must match both post-command inputs and admitted tree; uncertain ordinary nonzero host exits retain diagnostics and defer to detached T0, while positively unchanged failure, cancellation and interruption remain authoritative. Six new cases exercise actual production remote-check rendering, native remote exit0/2 and independent final completion, with host exit/log retention and zero-delivery negative controls; prior seven assertions remain. C3 bundle census verified from source; C1/C2 remain run-dependent and unverified. A-23777 and request counts are authored selected local macOS arm64 Node24.21.0 evidence, not configured/Linux/full-tier proof. Prior failures remain historical. Source clear only: request Coordinator window for exact-head configured verify; final evidence settlement still required. No Reviewer execution or edits.

Criteria: C3 verified.

### rev-35 · 2026-11-27T09:47:35.020Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-evidence-1
commit: 5916199c324d5fcb616b71acaaadace61deeb241
scope: evidence
findings: [{"severity":"medium","text":"Configured evidence blocker: A-23783 has a completed Missing expected rejection failure in the Coordinator cap control and a timed-out/cancelled concurrent-key case at line167. Producer code1; attribution unknown; new native bundle controls and later tiers were not executed.","file":"hub/test/suite-coordinator.test.ts","line":191}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23784 records exact same-head failed run0a0559e0, producer code1/empty cause, T0complete0/T1complete1, and literal diagnostics. Final paired log:2320pass/1fail/1cancelled/0skip; frozen producer progress independently retains the timedOut unfinished start. T2/T3/T4/Web unexecuted, browser unknown/unexecuted, report-only budgets. Linuxx64 Node24.21.0 c16nyc1 workers4; recorded run tree0df7ea5f0f24348643bc0f6f809e4f60e7edf27a distinguished from reviewed Git tree84d051d2dacfe86767195769828bae8ed809b542. Unchanged test blob is not causal attribution. No criteria are newly verified or failed from these unrelated controls: C3 remains source-verified; C1/C2 remain unverified because their configured cases did not run. Source3 clear is not a final configured pass. Hold/freeze released for Coordinator432d25c3's exact three-at-head/three-at-base isolated comparisons and scoped diagnosis; no retry authorized by this verdict. Changed head needs fresh source review. Prior failure/evidence history retained; no Reviewer execution or edits.

### impl-2003 · 2026-11-27T09:54:32.147Z

Configured-failure diagnosis: head5916199 red3/3 vs base4464147 green3/3. Two Coordinator tests changed a global fake HEAD before first job's native-equivalent start; HEAD fences refused it and its terminal cleanup freed key capacity. Corrected consumers observe durable start before advancing; production code unchanged. Final2dab5f53b suite-coordinator16/16 in3 committed-head runs. Added pre-acquire/no-machine and after-acquire/release-pending cap controls. Expanded native moving-root stage/epic/release controls plus dev-t3/soak16/16. Typecheck/full lint exit0/refusals0. Evidence artifact records exact red output and source/cap scope; original failed0a0559e0 remains red.

### rev-35 · 2026-11-27T09:59:09.785Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-source-4
commit: 2dab5f53bf32520d029a8df59d5a7d71c6fdda3a
scope: delta
findings: [{"severity":"medium","text":"M2 existing follow-up (S/Bugs): beyond ACCOUNTING_WAIT_MS, release remains unconfirmed but accountingPending can lead to cleaned=true and removal from the Coordinator active-key cap. New control proves only the early refusal window. Unchanged from base, outside C1/C2; routed to lead under Coordinator's explicit last-round follow-up policy.","file":"hub/src/hub/suites.ts","line":641}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23787 corrects A-23786's planned clear-with-follow-up outcome: hub task.comment explicitly refused any clear containing a medium and directed not clear. This is the actual accepted verdict; no clear submission bypass or severity relabeling. Source assessment found no new high/C1/C2-breaking medium in the tests/docs delta; receipt order and original cap/concurrency assertions preserved, expanded five-occasion native controls source-reviewed. M2 is an existing out-of-C1/C2 bug, byte-identical to base, and the new acquired-refusal proof covers only the early window. Coordinator was asked to reconcile its explicit last-round policy with the hub validator; S/Bugs filing requested. No new C1/C2 correction round is requested by this audit. No current-head criteria verification or failure mark added: C1/C2 runtime unverified; C3 historical source proof remains stale at changed head. Original configured0a0559e0/A-23783 remains failed; A-23785 is authored selected local macOS arm64 Node24.21.0 evidence. Hold released; keep source fixed pending Coordinator disposition and no configured submission. No Reviewer edits/execution.

### rev-35 · 2026-11-27T10:00:51.599Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-source-5
commit: 2dab5f53bf32520d029a8df59d5a7d71c6fdda3a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh same-head source assessment after Coordinator12e9fe40's corrected bug-aside disposition, recorded in A-23788. Independent Reviewer judgment: M2 is an existing bug outside this change, now filed as medium T-2119 (Bugs/S); #active and release/accounting-through-cleaned spans match base4464147fe exactly, new scheduler fences precede acquire, and source4 delta changes tests/docs only. Severity unchanged; broader Q2 guarantee withdrawn; early-window proof is not late-release proof. Hub's earlier clear-with-medium refusal and actual not-clear source4 remain historical, without bypass/relabeling. Findings in T-2003's reviewed change: none. Source4 receipt-order corrections preserve cap/concurrency/local-reuse assertions; five moving-root occasions retain pinned producer/source/start/completion controls. C3 reverified from unchanged census at Git tree c7b7ef4f155ec65a6598e683db073ced7b49174c. C1/C2 remain configured-runtime unverified; local A-23785 counts are authored selected macOS arm64 Node24.21 reports. Prior0a0559e0/A-23783 remains failed. Hold released to request Coordinator verification window for unchanged head; no automatic retry or final evidence clearance. No Reviewer edits/execution.

Criteria: C3 verified.

### impl-2003 · 2026-11-27T10:50:21.207Z

Redo rule20/41 census: searched exact 'cannot be bundled', 'dirty or changed worktree', 'names source changes', runBundle/checkWorktree/checkHead across hub/test,nvim/test,web/test,docs,qa and shipped skills, including durations/frozen files. Matching test files: executor-run.test.ts(T3; old dirty-byte consumer corrected), executor-run-rules.test.ts(T1; dirty at admission refusal remains valid), executor-prepare-component.test.ts(T2; injected runBundle transport seam signature unchanged), suite-bundle-native.test.ts(T3; pinned-object regression). Additional matching non-tests: docs/hub/running.md(current census); durations.json(old generated identity renamed to new title preserving historical2.991554 baseline, not a new measurement). No direct matches in nvim/test,web/test,qa briefs or skills. Full matching-file runs before review; targeted changed native cases already2/2 green.

### rev-35 · 2026-11-27T10:50:31.928Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-evidence-2
commit: 2dab5f53bf32520d029a8df59d5a7d71c6fdda3a
scope: evidence
findings: [{"severity":"medium","text":"M3: configured T3 consumer still expects dirty-source refusal after beforeCreate writes/stages source; actual pinned delivery succeeds (auto exit0), so the old regex fails. Migrate this rule20/41 consumer and guide, retaining a positive pinned-tree/no-later-bytes assertion and repeat the full census.","file":"hub/test/executor-run.test.ts","line":39}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23790 audits df19c380/A-23789: producer1/empty cause/unfinished[], T0/T1/T2exit0, T3exit1; T4/Web unexecuted. Literal failure at52713 expected dirty-worktree regex versus actual auto exit0; Coordinator d8eeef18 attributes the missed old-contract consumer to T-2003. All16 native bundle base cases, all16 Coordinator base cases and both capacity controls'5/5 loaded receipts are retained as positive facts, not final proof from a failed round. C1/C2 remain formally unverified; C3 source mark retained, no criteria newly failed/verified by this stale expectation. Linuxx64 Node24.21 c16nyc1 workers4, browser null/unexecuted;9 prerequisite skips and report-mode budgets retained. Run tree91d433547f1ccfc6df5f3cee2bc4a801b804b572 distinguished from Git treec7b7ef4f155ec65a6598e683db073ced7b49174c. Earlier0a0559e0 failure and T-2119 bug-aside remain historical/separate. Audit hold released for Coordinator-authorized consumer correction/checks/census; changed head requires fresh source review before another configured submission. No Reviewer execution or edits.

### impl-2003 · 2026-11-27T10:52:49.190Z

Census timing correction per Coordinator30dda2a9: supersedes earlier comment about preserving2.991554. Old generated identity is deleted from durations.json, with NO replacement baseline key, since pinned delivery performs different work. Verify/batch will treat the retitled case as new; if Linux measurement >=4s the merge budget names a measured ownerE-880 allowance to add afterward. No old duration proof transferred.

### rev-35 · 2026-11-27T11:01:03.912Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-source-6
commit: 8932f5b9f4466adb7d8162f2df5c400a79d84b90
scope: delta
findings: [{"severity":"medium","text":"M4: new caseDeadlines.run/step owns the two changed callbacks but supplies no separately named complete setup/action observation bound; owner.wait is never called. f.result bounds only its own receipt. Add retained owner.wait setup/proof bounds using shared remote load scaling, preserving late acquisition adoption and all final assertions.","file":"hub/test/executor-run.test.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23793: M3 stale refusal consumer resolved with anchored final auto exit0, one receiver, captured HEAD/full tree/path bytes and distinct local mutation; all prior script/timing/lock/test/release assertions retained. Complete refusal/function-name census independently checked. Old duration key deleted without replacement per Coordinator30dda2a9; no timing carried over. Sole medium M4 is confirmed by Implementer a20d5ee6; whole-callback ownership/cleanup bounds do not replace separate setup/action observation deadlines. Narrow bar in artifact, no production redesign or unrelated migration. C1/C2 remain unverified rather than new functional failure marks; C3 source census unchanged but not marked at this not-clear head. A-23791 raw stdout precedes final anchored assertion; A-23792/request final selected counts are local macOS arm64 Node24.21 reports, no configured/Linux pass. Prior two failed runs and separate T-2119 retained. Hold released for correction/Coordinator-authorized checks; fresh committed-head source review before configured verification. No Reviewer execution/edits.

### rev-35 · 2026-11-27T11:06:52.306Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-source-7
commit: 36ea2d09f73814d5e8fda8f04a12cc26865dc282
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23796 records the narrow two-file M4 correction at Git tree41beb23d48febbfa3824906e133a9023d8cb70d7. Complete setup and complete launch/result/receiver proof now have separate named owner.wait observations, per-operation shared remoteWaitMs scaling and retained original continuations; late fixture capture/adoption remains inside the setup producer. All M3 pinned HEAD/tree/original bytes, distinct local mutation, anchored auto exit0, one receiver, script/timing/lock/test/release assertions preserved. No production/duration/census change; old timing key remains deletion-only. Standards/spec findings[]. C3 reverified from unchanged census; C1/C2 remain configured-runtime unverified. A-23794 raw22/22 stdout plus A-23795 authored command/head/exit/platform note remain selected local macOS arm64 Node24.21 evidence; no configured/Linux/browser pass. Prior two configured failures retained; medium T-2119 remains separately filed bug-aside. Hold released to request Coordinator exact-head verification window; no automatic retry/final settlement. No Reviewer execution/edits.

Criteria: C3 verified.

### rev-35 · 2026-11-27T11:45:47.452Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-evidence-3
commit: 36ea2d09f73814d5e8fda8f04a12cc26865dc282
scope: evidence
findings: [{"severity":"medium","text":"Configured duration blocker: migrated identity passes at7.336642972s but exceeds its5s budget (literal7.337s>5s); T3exit1 and Web unexecuted. Coordinator77ae91d2/589453d3 authorizes one exact measured11.006s E-880 allowance, then allowance-only review; current run remains failed.","file":"hub/test/executor-run.test.ts","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23798 audits85d1bc80/A-23797: producer1/empty structured cause/unfinished[], T0/T1/T2exit0/T3exit1. Literal duration refusal at52686; no failed tests. All22 executor-run/all16 native bundle/all16 Coordinator base cases pass, capacity controls5/5 loaded each, retained as facts not final proof from failed round.10loaded+9355pairedbase+3known finish-only passes reconcile9368producer passes;9prerequisite skips retained. C1/C2 remain formally unverified; C3 source7 mark retained. Linuxx64 Node24.21 c16nyc1 workers4, browser null/unexecuted; most other advisory gates report-only. Recorded run treea4fe84f8e3bc087fe1c6dd5c44ca456e5fad4f02 distinguished from Git41beb23d48febbfa3824906e133a9023d8cb70d7. Empty cause is separately filed by Coordinator; T-2119 remains bug-aside. Hold released only for Coordinator's exact allowance/tier-plan/typecheck/lint scope, fresh allowance-only source review and window; no configured retry granted by verdict. All three failed runs retained; no Reviewer execution/edits.

### rev-35 · 2026-11-27T11:48:19.510Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-source-8
commit: b0a60365d55e188d1170c64b1080a9a5bc2e538b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23800: allowance-only source review at Git tree538729bfe1af2f446d72d41836aa244d12d09ab9. Exactly one allow entry matches Coordinator77ae91d2/589453d3: new pinned-delivery identity,11.006s,E-880,Nov27–Dec4, reason displayed7.337s Linuxc16/run85d1bc80/A-23797,1.5x rounded headroom and explicit failed-run distinction. No old baseline transfer, other allowance/test/production/docs/parser/gate change or dev merge. Standards/spec findings[]. C3 reverified from unchanged census; C1/C2 await configured same-head success. A-23799/request local macOS arm64 Node24.21 tier-plan/typecheck/lint reports are selected validation, not configured evidence. All three prior configured failures retained, including empty cause and unexecuted Web/T4; T-2119 remains separate. Hold released to request Coordinator window, no automatic retry/final clearance. No Reviewer execution/edits.

Criteria: C3 verified.

### rev-35 · 2026-11-27T12:34:29.861Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-evidence-4
commit: b0a60365d55e188d1170c64b1080a9a5bc2e538b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head settlement A-23802: d79bbd53/A-23801 producer0/empty cause/unfinished[], finished12:31:59Z, complete exit0 T0/T1/allT2/251selectedT3/Web. All16 named native bundle controls,22 executor-run cases (migrated source7.338620917s<11.006 allowance),16 Coordinator base cases and two capacity controls5/5 loaded,15 admission-rules and70 prepare-component cases have actual paired pass finishes. Source8 plus these facts verifies C1/C2/C3. Git538729bfe1af2f446d72d41836aa244d12d09ab9 and recorded run tree37e76d148bb5477952ee09ee98c5cf24f4e4b6a4 distinguished. Linuxx64 Node24.21/Nvim0.12.5 c16nyc1 workers4; isolated HeadlessShell1248/Chrome156.0.8078.4 Web complete.9862producer passes/12explicit prerequisite skips/0fail; paired counts and3known finish-only rows reconciled separately.25otherT3 and18T4files unexecuted; no full-T3/T4 or macOS claim. Broad advisory checks report mode; reviewed per-case allowance gate passed. cached:null unknown; lifetime2530300ms/cost$0.3514305555555556 are machine totals. All three prior failed rounds/exits/durations retained, not proof; medium T-2119 remains separately filed bug-aside. Findings[]. No Reviewer edits/execution/additional submission.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-2003 · 2026-11-27T13:23:39.189Z

Batch load-gate diagnosis: runLoadGate uses5 fresh processes/identity sequentially, not reused JS process. Guard fork inherited --import load-bootstrap while fixtureEnvironment removed NODE_TEST_CONTEXT/start control; it blocked before IPC handlers. Two local diagnostic lanes0/5 with shortened15s outer backstop were incomplete; Coordinator cleaned10 escaped detached reapers by standing census. Both temp bootstrap roots are confirmed absent. After clearing guard execArgv, normalized actualrunLoadGate lane5/5 passes; additive native exited Promise plus scripted resolved counterpart. Single delivery cases observe positive guard exit and root removal; heavy2-delivery control dropped per74fc5604. New realrunSuite bootstrap regression checks1ordinary+5repeats/6native exits. Guard consumers: remote-fixture native factory and remote-fixture-parent(pid-only); scripted users no fork; same-named fake-native-guard function unrelated.

### impl-2003 · 2026-11-27T13:24:53.381Z

Guard-fork consumer census: direct fixtureGuard caller is remote-fixture.ts; remote-fixture-parent.ts forwards only pid, unchanged. Native remote-fixture test consumers potentially affected under runner bootstraps: demo-release, executor-run, verification-workers, executor-deletion-watchdog, executor-safety, demo, executor-health, suite-remote-process, suite-close-recovery, suite-candidate-remote, suite-close (all hub/test/*.test.ts). Fourteen T2 consumers explicitly use scripted/no-guard mode and retain pid0 plus resolved exited Promise; remote-scripted now checks that receipt. suite-selection.test.ts references the filename as fixture data only. fake-native-guard.ts's same-named function is unrelated. New durations-runner guard regression exercises1ordinary+5actualrunSuite repetitions/6native exits; expensive double-full-delivery control removed per74fc5604. No prior timing baseline copied.

### impl-2003 · 2026-11-27T13:30:13.530Z

Full guard consumer inventory continuation (all paths hub/test/*.test.ts): scripted/no-fork T2 users are suite-soak-component, executor-deletion-confirmation, executor-safety-component, demo-release-component, executor-reap-confirmation, dev-t3-search-component, demo-provisioning, demo-cap, executor-snapshot-confirmation, state-inventory, remote-scripted, executor-prepare-retry, suite-hung-component, executor-admission-lock. Additive exited Promise is resolved for scripted mode; pid/register retained. Native potentially affected users are demo-release, executor-run, verification-workers, executor-deletion-watchdog, executor-safety, demo, executor-health, suite-remote-process, suite-close-recovery, suite-candidate-remote, suite-close. remote-fixture-parent helper emits only pid; no serialization change. suite-selection filename data and fake-native-guard same-name function unaffected. Local full changed files22/22 each and5direct consumers10/17/1/2/5 passed, plus source identity5/5 load lane.

### impl-2003 · 2026-11-27T13:42:59.272Z

Consumer census correction from Reviewer c55b7d81 (read-only source trace at f8e0bf498): A-23807's 25-file factory consumer list was incomplete as an execution closure. Add scenarios/droplet-verify and suite-stage-cover (native T3); cover-quiet through remote-fixture-lifecycle/parent (native T3→T4, pid-only IPC unchanged); suite-close-component and executor-recovery-collection (scripted T2); executor-safety-load (scripted T4); durations-runner direct guard regression (T3). Full execution-consumer closure is 33 files: 15 T3, 16 T2, 2 T4. Existing pid/register readers remain compatible; scripted paths do not fork. This supersedes the earlier closure count without changing the actual local execution selection or claiming coverage of all 33. Source and experiments remain fixed; Reviewer records expanded dispositions in the review artifact.

### rev-35 · 2026-11-27T13:45:20.997Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-source-9
commit: f8e0bf4987d2ea53b47bde14081eaa8800e83d3d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23810 source-clear guard delta at Git tree27a5acf6bf587f02988aeb4e111e3ebd5cd01af9. Dedicated fork clears execArgv while sealed env/IPC ownership remain; additive native-exit promise preserves pid/register, scripted variant resolves without child. Delivery callbacks retain prior setup/action/tree/bytes assertions and observe captured guard exit+exact root removal. New actual runSuite regression requires ordinary+5 fresh-process repetitions,6 positive exit rows and5 completed pass receipts; expensive twice-delivery omitted per Coordinator74fc5604. Standards/spec findings[]. Independently extended item census is33files:15T3/16T2/2T4, including transitive wrappers/parent PID reader; source compatibility documented, not coverage claim. C3 verified; C1/C2 await new-head configured facts. A-23807 authored precommit candidate scope and A-23808/09 local macOS arm64 Node24.21 raw22/22 stdout are not current Linux/browser/full-tier receipts. Oldd79bbd53 green belongs onlyb0a60365; compositeb112be7d stays inconclusive and incomplete diagnostics/three earlier task failures retained. T-2119 separate. Hold released to request Coordinator exact-head window; no automatic retry/final runtime clearance. No Reviewer execution/edits.

Criteria: C3 verified.

### rev-35 · 2026-11-27T14:27:31.918Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-evidence-5
commit: f8e0bf4987d2ea53b47bde14081eaa8800e83d3d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23812 final same-head audit: f5be59c1/A-23811 producer0/empty cause/unfinished[], finished14:24:16Z; complete exit0 T0/T1/allT2/251selectedT3/1mappedT4/Web. New actual-runSuite bootstrap regression passes at43017(3.315008074s), establishing internal ordinary+5 repetition/six positive native-exit assertions; executor-run22passes include both guard-exit/root-removal proofs, source6.148155092s<11.006allowance. All16 bundle controls, Coordinator16base+two5/5load controls, and scripted exit seam pass.33consumer census has32passingfile finishes/286pass+1prereqskip; standalone lifecycleT4 unexecuted, nested cover-quiet raw-PID SIGTERM path pass at42736. C1–C3 verified with source9. Git27a5acf6bf587f02988aeb4e111e3ebd5cd01af9 and recorded tree0e450dd7e00776784f23034ec110f0196e11edcc distinguished. Linuxx64 Node24.21/Nvim0.12.5 c16nyc1 workers4, isolated HeadlessShell1248/Chrome156.0.8078.4 completed.9876producer passes/12explicit skips/0fail reconciled with3known unpaired finish rows.25otherT3/17T4files unexecuted; no fullT4/macOS claim. Broad advisories report mode; lint refusals0. Lifetime2233442ms/cost$0.31020027777777776 are machine totals; cached:null unknown. Old-head green/three task failures/incomplete diagnostics retained; b112be7d composite remains independently inconclusive, not rewritten by this task result. T-2119 separate. Findings[]. No Reviewer execution/edits/signals/additional run.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-27T15:03:58.676Z

Merged cf963a7786f795ede6a4be86d1336eff57484752 onto dev.
