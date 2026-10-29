---
id: T-410
kind: task
title: Identify fast detached inherited-pipe writers after a stalled run so the hub can reap them
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1218
branch: t/T-410-identify-fast-detached-inherited-pipe
created: 2026-10-14T13:09:09.281Z
updated: 2026-10-29T20:43:35.852Z
closed: 2026-10-29T20:43:35.852Z
---

## Summary

T-385 ends a stalled verify run even when one detached child is left that can't be verified. It writes to the run's inherited stdio but was reparented before any ownership snapshot. The run reports "cleanup incomplete" and warns the human, and the queue moves on. Safely identifying such a writer after its ancestry is lost would let the hub reap it instead of only warning.

## Evidence (impl-385, 2026-10-14)

- macOS Node stdio uses Unix sockets. Structured `lsof` output reports peer-like addresses with no usable inode or own-endpoint field.
- Getting the stream file descriptors directly needs Node's private handles.
- An exact kernel endpoint mapping needs platform-specific inspection and validation, macOS and Linux each.

## Acceptance criteria

- [x] C1. On macOS and Linux, the hub identifies the processes holding the write end of a run's stdio pipe or socket after their parent exits, with a documented method and its failure modes.
  - done: impl-410 · 2026-10-29T20:16:55.295Z
  - verified: rev-31 [reviewer] · run rev-20261029-410-final1 · 2026-10-29T20:37:16.591Z · commit 7d56932027fd73e27800ba10f3bfd8c5c4e88375
- [x] C2. The stall path reaps identified writers. Unidentifiable ones stay reported as now, and unrelated processes are never touched.
  - done: impl-410 · 2026-10-29T20:16:55.401Z
  - verified: rev-31 [reviewer] · run rev-20261029-410-final1 · 2026-10-29T20:37:16.591Z · commit 7d56932027fd73e27800ba10f3bfd8c5c4e88375
- [x] C3. A regression spawns a fast detached writer that inherits the pipe and proves it is reaped on both platforms. The Linux run happens on a droplet.
  - done: impl-410 · 2026-10-29T20:16:55.510Z
  - verified: rev-31 [reviewer] · run rev-20261029-410-final1 · 2026-10-29T20:37:16.591Z · commit 7d56932027fd73e27800ba10f3bfd8c5c4e88375

## Comments

### impl-410 · 2026-10-29T19:32:01.883Z

Seams: existing T3 suite-timeouts real verifier/fast-exit fixture (native writer death and unrelated-process preservation), plus cheapest pure parser controls for endpoint evidence. Parent E-1444 has no feature-specific spec sections; this is verifier lifecycle follow-up. Investigating native endpoint mapping; no public wire/schema change intended. Consumers searched: suiteCommand callers suite-worker and git-maintenance; cleanup cause consumer hub/dispatch, suite-worker-cause tests; suite-timeouts/suite-check/run-suite lifecycle fixtures; hub/README and docs/agents/tests.md timeout policy; implement skill process guidance. Preserve cause/refusal and old wire shape.

### impl-410 · 2026-10-29T19:40:01.379Z

Consumer inventory before ownership extension: suiteCommand production callers hub/src/hub/suite-worker.ts and hub/src/release-web.ts; suite limits/worker/compatibility cleanup retain their return shape and cause text. Existing cleanup-incomplete reader hub/src/hub/dispatch.ts (Agents/Inbox/journal warning), suite-worker-cause.test.ts and suite-timeouts.test.ts remain compatible; denied-census control retains previous warning behavior. Process ownership/signalling stays through endProcess/system-processes native-birth admission; system-processes/process-identity/process-cleanup fixtures and executor cancellation/watchdogs unaffected (no shared contract edit). Searched production, tests across tiers, docs/agents, qa/briefs, shipped skills, startup and persisted run readers for suiteCommand/cleanup-incomplete/inherited-pipe. No frame/schema/CLI fields or role grants change. Docs: hub README native method/failure modes, shared timeout procedure, per-file test guide, implement skill+CHANGES. Local darwin arm64 Node v24.21.0: initial fast-writer red showed cleanup incomplete; full touched T3 file passed 13/13, then reduced new case passed (~8.60s) and readiness-receipt refinement passed native census. Root typecheck passed. No browser, remote executor or full suite yet. Linux unconditional native census fails with explicit prerequisites if unsupported; droplet verify remains required after source review.

### rev-31 · 2026-10-29T19:43:09.290Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-410-source1
commit: eb6cc99295ae9f044c9207ed2dcc3439bffe2545
scope: full
findings: [{"severity":"medium","text":"M1: denied-census injection matches Darwin-only script text, so Linux executes successful census and cannot establish preserved unknown-writer warning behavior. Use a platform-independent owned launch selector and positive denial receipt, retaining original assertions.","file":"hub/test/suite-timeouts.test.ts","line":347},{"severity":"medium","text":"M2: unconditional duplication of both streams fails when one channel already reached EOF/closed while a detached writer retains the other. Ignore unusable descriptor slots and add stdout-only/stderr-only native controls with observed opposite EOF, birth refusal and unrelated preservation.","file":"hub/src/stdio-writers.ts","line":95}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated source1 not clear; M1/M2 only, A-14058. Existing birth/endProcess authority and no-grant fallback remain; source correction/runtime proof pending. Local reported macOS13/13/fast-writer refinements are separately attributed, not Linux. No Reviewer executions or signals. Replacement source review before verification; Coordinator sizes new long cases from Linux receipt.

Criteria: C1 failed (Single-channel inherited writers are missed when the opposite closed stream invalidates descriptor duplication.), C2 failed (Linux denied-census control does not deny the inspector, so unknown-writer fallback and preservation proof are incomplete.), C3 failed (Required Linux droplet and asymmetric inherited-stream regressions remain pending corrected source and runtime evidence.).

### impl-410 · 2026-10-29T19:43:49.262Z

Source1 M1/M2 addressed: platform-independent denial matches the inspector's public duplicated-descriptor launch and persists a positive refusal receipt; original warning/Inbox/journal/mute/successor assertions remain. Single-channel native controls observed sibling EOF before census and failed red (actual [] vs writer PID); ignoring closed stream slots made stdout-only/stderr-only green. Both controls retain changed-birth refusal, explicit native reaping and unrelated same-cwd survival. Typecheck caught optional pidIdentity in the new test, corrected to null and root typecheck passed. Full touched file rerun underway on the replacement tree. No dev merge or verification since source1.

### rev-31 · 2026-10-29T19:46:38.582Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-410-source2
commit: 50a1047f05171c075de63daced54f1c766e1c60a
scope: full
findings: [{"severity":"medium","text":"M3: detached writer ownership is acquired only after awaited readiness marker, after parent exit. Omitted/aborted acquisition can escape recorded cleanup and root removal. Pre-register an independent acquisition/close owner before spawn, fence parent exit until ownership captured, and prove omitted/aborted setup disposal without moving the tested census earlier.","file":"hub/test/suite-timeouts.test.ts","line":421}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear, A-14065. M1/M2 source corrections are resolved; new fixture-lifetime M3 only. Native syscall source/unchanged warning and endpoint assertions retained. Local macOS15/15/typecheck is reported evidence, not Linux or Reviewer execution. Consolidation complete; replacement source review before configured verification.

Criteria: C3 failed (New single-channel regression can orphan its detached writer when readiness observation fails before ownProcess(writer).).

### rev-31 · 2026-10-29T19:52:33.283Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-410-source3
commit: 8b01f98ce7744d27c0c7a991f1c40f79daec9502
scope: full
findings: [{"severity":"medium","text":"M3 remains partial: beforeDirectories errors do not prevent subsequent directory removal, and ownProcess(undefined) supplies no test-context removal fence. Bind the same dispose operation to beforeRemove and prove forced incomplete-stop/close preserves root until recovery.","file":"hub/test/stdio-writer-fixture.ts","line":34}]
finding_counts: {"high":0,"medium":1,"low":0}

Source3 not clear; IPC acquisition/parent fence resolves earlier M3 gap, but failed disposal must fence removal. A-14077 supersedes A-14076 with corrected tree162b9c4feedf06858fb021f9b93ad415bf72408b; I wrote the earlier tree incorrectly before rev-parse returned. Reviewed commit/findings unchanged. M1/M2 remain resolved. Consolidated audit complete; replacement source review before verification. No Reviewer executions.

Criteria: C3 failed (The new fixture can remove its root after failed writer disposal because its owner lacks an actual beforeRemove fence.).

### rev-31 · 2026-10-29T19:56:48.117Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-410-source4
commit: 66c31a9d9783178bcf7a9246b205ca80a5fcc8c9
scope: full
findings: [{"severity":"medium","text":"M3 remains: tempProject already registered an unfenced ownDirectory closure. A second ownDirectory with beforeRemove does not replace it; device/inode equality lets the earlier automatic callback remove the root after disposal failure. Use a single fenced owner and test actual automatic teardown retention/recovery.","file":"hub/test/stdio-writer-fixture.ts","line":38}]
finding_counts: {"high":0,"medium":1,"low":0}

Source4 not clear, M3 only; A-14081 exact commit/tree. Explicit owner.remove is fenced, but automatic teardown's earlier tempProject callback is not. M1/M2 and IPC acquisition fixes retained. Consolidated audit complete; replacement source review before configured verification. Reported local five-case/typecheck evidence remains separate from pending Linux facts. No Reviewer execution.

Criteria: C3 failed (The earlier tempProject directory cleanup still bypasses the added disposal fence after incomplete writer stop.).

### rev-31 · 2026-10-29T19:59:44.285Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-410-source5
commit: 3609d33a63f4a5f856d27a04d3183c9a75d856c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source5 full source clear; A-14084, tree0275e4d4. M3 resolved by one fenced root owner and actual registered automatic-teardown retention/recovery control; M1/M2 remain resolved. No runtime criteria verified: local six-case/typecheck report stays macOS-specific, Linux/droplet and long-case allowance sizing pending configured verification/Coordinator. No Reviewer execution. Final original-record evidence review before ready.

### rev-31 · 2026-10-29T20:02:14.139Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-410-evidence1
commit: 3609d33a63f4a5f856d27a04d3183c9a75d856c4
scope: evidence
findings: [{"severity":"medium","text":"Hard host T0 test-lint refusal: new import precedes required first-comment T3 process-behaviour header. A-14088 has no droplet or runtime case evidence. Restore owning header under unchanged guard, source-review correction before verification.","file":"hub/test/suite-timeouts.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Original dd570fee/A-14088 not clear; A-14092 audit. Host typecheck/build/static checks pass but hard lifecycle lint refusal prevents droplet creation; counts unavailable, projected tiers not executed. C1–C3 Linux facts remain unverified. Preserve failed original; source correction before new verification. No Reviewer execution.

### rev-31 · 2026-10-29T20:02:58.398Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-410-source6
commit: 86176d6253aa5a7417d8441ae03e64e0ba06dad2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source6 clear, A-14095. Exact diff restores unchanged two-line T3 header before imports; no executable/lint-policy changes. Source5 behavior audit retained. Failed dd570fee/A-14088 remains host-only/no Linux evidence. Reported local unchanged guard now refuses0; C1–C3 runtime/allowance pending. One new mode-free verify then final original-record evidence review. No Reviewer execution.

### rev-31 · 2026-10-29T20:16:38.981Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-410-evidence2
commit: 86176d6253aa5a7417d8441ae03e64e0ba06dad2
scope: evidence
findings: [{"severity":"medium","text":"Original e94493d7/A-14101 exits1 on enforced new-case duration: fast-exit inherited-pipe regression passes9.726985410s but exceeds5s without allowance. Coordinator disposition/manifest source review before retry; printed suggested14.591s is not approval. Web unrun.","file":"hub/test/suite-timeouts.test.ts","line":218}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence2 not clear, A-14102. All3920 completed ordinary plus75 load samples pass; selected T3 all19 once including native writer/asymmetric/cleanup controls. Hard duration gate fails despite pass receipts; Web absent. Preserve original Linux facts and prior host-only failure separately. C1–C3 final verification/ready held pending allowance disposition and passing exact-head evidence. No Reviewer execution or unchanged-head retry requested.

### rev-31 · 2026-10-29T20:17:23.821Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-410-source7
commit: 7d56932027fd73e27800ba10f3bfd8c5c4e88375
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source7 clear; A-14103. Sole manifest entry+measured baseline exactly match Coordinator fdabfa56:15s/E-880/2026-10-29→11-05 with measured Linux9.727s reason. Existing allowances/suggestions untouched; executable source6 audit retained. Original A-14101 stays failed partial/Linux19 pass/Web absent; A-14088 host-only separate. C1–C3 final runtime verification pending new exact-head configured receipt. No Reviewer execution.

### rev-31 · 2026-10-29T20:37:16.591Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-410-final1
commit: 7d56932027fd73e27800ba10f3bfd8c5c4e88375
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, C1–C3 verified; A-14110 originalA-14108 audit. 4219ordinary+75separate loads pass;19selectedT3 identities once, including kernel writer ownership, birth refusal, unknown-writer warning/preservation, fast-exit reaping, asymmetricEOF and root-preserving recovery. Fastwriter10.910730483s<approved15s. MacOS local evidence A-14060/A-14082 retains old-head/platform attribution; no final-head full19macOS claim. T0/T1/allT2/selectedT3/Web complete,remainingT3/T4 absent; report-only warnings/gate-reuse retained. FailedA-14088/A-14101 separate. No Reviewer executions or all-tier claim; QA none.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-29T20:43:35.852Z

Merged f2b934b72ede8259acaf110d89834e6ad02dfa33 onto dev.
