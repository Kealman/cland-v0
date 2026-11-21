---
id: T-1985
kind: task
title: A non-HubLocked termination-ownership acquisition rejection drops an already native-verified grace child before it is retained, so a reparented descendant can escape cancellation
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1758
topic: topic-1697
branch: t/T-1985-a-non-hublocked-termination-ownership
created: 2026-11-18T19:54:52.553Z
updated: 2026-11-21T12:17:04.833Z
closed: 2026-11-21T12:17:04.833Z
---

## Summary

Deferred from T-1758's final review round (rev-39, head 500f78de4, under the review-loop cap). In `TerminationOwner.capture` grace discovery, HubLocked and timeout failures loop and keep cleanup incomplete. A non-HubLocked acquisition rejection, though, propagates before `owned.set`/`onCaptured` for a grace child whose native identity was already verified. If the parent then exits before a retry, that child has no retained receipt and can escape the cancelled run's cleanup. Not reproduced yet; found by source review. Set regression-of T-1758 once T-1758 closes.

## What to build

Retain a verified grace child's identity before any acquisition step that can reject. Or have such a rejection keep the cleanup incomplete with the identity retained, never dropped. Use a deterministic fault-injection seam on the reservation or acquisition step, and keep T-1758's self/ancestor fence and no-authority-from-missing-identity rules.

## Acceptance criteria

- [x] C1. With an injected non-HubLocked acquisition rejection after a grace child's native identity is verified, followed by parent exit, the child stays tracked and is confirmed dead (native exit or ESRCH absence) or the cancel stays incomplete (test, red before).
  - done: impl-1985 · 2026-11-21T08:03:03.462Z
  - verified: rev-35 [reviewer] · run rev-35-1985-evidence-2 · 2026-11-21T11:34:31.382Z · commit cd7f1fcc57eaa1a2351af1e5acc7be149fe91b06
- [x] C2. T-1758's partial-validation and grace sibling-order regressions pass unchanged (test).
  - done: impl-1985 · 2026-11-21T07:56:15.814Z
  - verified: rev-35 [reviewer] · run rev-35-1985-evidence-2 · 2026-11-21T11:34:31.382Z · commit cd7f1fcc57eaa1a2351af1e5acc7be149fe91b06

## Comments

### impl-1985 · 2026-11-21T07:42:39.967Z

Consumer audit: grace capture sequencing in system-processes.ts changes no wire/schema shape. TerminationOwner.capture has one production caller (endProcess extend). onCaptured consumers: LocalExecutor retains per-lease native births, prune-processes retains pending cleanup, fixture-processes retains fixture descendants; all need the receipt before a fallible acquisition. endProcess callers include adapters/processes, host/local, suite-command, orphans and git-command-owner. Searched field/function/import names across hub/src, hub/test, nvim/test, docs, shipped skills and QA briefs; merge-recovery test fake already publishes before awaits, other consumers unchanged. Existing T-1758 cases unchanged. New regression red: retry confirms death of the retained reparented child, actual live pid 420101 vs []; green with fix 5/5 targeted synthetic process cases on macOS Node 24.21.0. Full suite pending Coordinator after source review.

### impl-1985 · 2026-11-21T07:43:02.509Z

Audit correction: the third onCaptured production consumer is git-command-owner.ts (retains native identities during Git cleanup), not fixture-processes.ts. fixture-processes.ts calls endProcess through its injected native boundary without onCaptured. LocalExecutor and prune-processes are the other two. No consumer API changes.

### rev-35 · 2026-11-21T07:47:39.948Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1985-source-1
commit: 26a0d4e2418616e9b42a80f1e815115c25c06a40
scope: full
findings: [{"severity":"high","text":"M1: Per-child acquisition can reject before later already-verified grace siblings/nested descendants are retained; parent exit then loses those identities on retry. Publish the complete eligible verified reachable set before the first acquisition and add multi-child rejection/reparenting controls.","file":"hub/src/system-processes.ts","line":252},{"severity":"medium","text":"M2: New systemProcessProbe callback lacks pre-acquisition whole-callback cancellation ownership, separate setup bound and registered child-close fence; timeout/finally covers normal settlement only. Migrate this caller to the shared owned fixture/child lifecycle while preserving the isolated subprocess and assertions.","file":"hub/test/suite-cancel.test.ts","line":28}]
finding_counts: {"high":1,"medium":1,"low":0}

Full source not clear; A-22387. Spec M1 high: extend still awaits per child, so rejecting the first acquisition before parent exit/reparenting leaves later already-verified siblings or reachable nested descendants unpublished. Retain the complete eligible verified discovery set before any fallible acquisition, then acquire; add multi-child/nested controls. Standards M2 medium: new raw callback/systemProcessProbe path lacks whole-callback pre-acquisition cancellation ownership, separate setup bound and registered child-close fence. Preserve its legitimate isolated subprocess and actual cancellation assertions. Implementer confirms both gaps from retained source (a0f0ccd8/c30eecc6). Existing T-1758 test suffix is byte-unchanged; C2 is unchecked in task.view and remains unverified. A-22384 local red/green/check counts are authored reported evidence, not configured or raw inspected finish proof. No Reviewer execution/edit. C1 failed; hold releases for one consolidated correction and fresh exact-head source review before Coordinator full verify all.

Criteria: C1 failed (Acquisition rejection can still lose later verified grace siblings/nested descendants, and the new control lacks whole-callback/child cancellation ownership; correct both with retained controls.).

### impl-1985 · 2026-11-21T07:54:21.952Z

Source1 consolidated correction: expanded rejection regression now removes both parent and first child, leaving a verified sibling and nested descendant. Red at source1 behavior: AssertionError retry confirms death of the retained reparented child, actual live PIDs 420102/420103 vs []. extend now synchronously publishes the entire reachable verified set before any capture await; acquisition/HubLocked/timeout implementation unchanged. New context option on systemProcessProbe uses existing shared fixtureWork, separately bounded setup/spawn, explicit callback+native close, and root guard. Guarded cancellation control holds close and proves root retention, then close and removal. Initial control failed register fixture restoration before admission; prearmed restoration fixed it. Final targeted run: 7 passed, 0 failed (two acquisition cases, ownership control, four unchanged T-1758 cases), local macOS Node24.21 synthetic Darwin, load 6.202. Native slot released to impl-1987. No configured verification submitted.

### rev-35 · 2026-11-21T08:00:04.177Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1985-source-2
commit: d3743356e2f521bf93733e56d60357489ec6482c
scope: full
findings: [{"severity":"medium","text":"M2 residual: root presence while child close is held proves ordinary disposal ordering only; no removal attempt/entry receipt exercises the real guarded remover. Drive ownDirectory/guardDirectoryRemoval under held close with independent retention/guard receipts, then prove removal after the same close completes (rule 42).","file":"hub/test/suite-cancel.test.ts","line":65}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear for one residual M2 control gap; A-22402. Product M1 resolved: complete verified reachable sibling/nested set is published synchronously before acquisition. Probe implementation now uses pre-acquisition fixtureWork, separate root/spawn setup bounds and callback+native-close ownership. Existing T-1758 bodies remain byte-unchanged; no dev merge. Residual medium at suite-cancel.test.ts:65: pending settlement/stat(root) plus later ENOENT does not exercise a real removal attempt/guard while close is held. Implementer confirms absence (b2c2c79b). Add an independent guard/removal-attempt receipt through actual guarded remover, retention while close is unresolved, then allowed removal after that same close; preserve existing assertions. C1 remains failed, C2 checked but unverified. A-22399 reported seven-case local evidence is not configured/full-suite proof. No Reviewer execution/edit. Hold releases for the narrow control correction and fresh source review; production correction may remain fixed.

Criteria: C1 failed (Product sibling/nested retention is corrected, but probe control must independently exercise real guarded root removal while child close remains unresolved (rule 42).).

### rev-35 · 2026-11-21T08:09:58.334Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1985-source-3
commit: cd7f1fcc57eaa1a2351af1e5acc7be149fe91b06
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear, findings=[]; A-22411. Residual M2 resolved: control invokes the actual guarded ownDirectory remover under held child close, requires an independent guard receipt tied to that same native close and completion of the removal attempt, then interrupted callback rejection and ENOENT. Existing assertions remain. Product/helper exactly match accepted source2; complete verified reachable-set retention and owned probe lifecycle carry unchanged. Original T-1758 test suffix is byte-identical to base c0198410b; no dev merge. A-22408 reports seven targeted local synthetic checks and final lint/typecheck, not a configured/full-suite receipt; older evidence remains separately scoped. Both C1/C2 checked, run-dependent verification pending. No Reviewer execution/edit. Hold releases; Coordinator-owned full verify all follows at unchanged head under the item-specific plan, then final same-head evidence review. No Implementer verify submission.

### rev-35 · 2026-11-21T09:45:25.442Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1985-evidence-1
commit: cd7f1fcc57eaa1a2351af1e5acc7be149fe91b06
scope: evidence
findings: [{"severity":"medium","text":"Configured evidence incomplete: Coordinator cancelled run563338a3 for scheduling before required suite-cancel/T3 cases executed. No observed source/test defect; final acceptance awaits the already ordered same-head full retry."}]
finding_counts: {"high":0,"medium":1,"low":0}

Final evidence incomplete/not clear; A-22459. task.view confirms563338a3/A-22458 cancelled, exit143 at exact source3-reviewedcd7f1fcc5. Coordinator368dd3a5 explicitly cancelled for dev-cover/queue scheduling, unrelated to T-1985, and ordered same-head full resubmission after cover. Actual finishes: all241T1 pass; T2 67started/65pass/2inflight/376unstarted. No suite-cancel events; all273T3/18T4/55Web unexecuted. Partial2089base and2893completed accounting are retained distinctly, not a suite pass. No observed criterion failure or new source defect: C1/C2 remain checked/unverified, no false failure/verification marks for unexecuted tests. Source3 clearance remains current; no edit or new source review needed for unchanged-head retry. Linuxc8ams3 Node24.21 Nvim0.12.5; browserunknown. No Reviewer execution/edit/submission. Hold releases; preserve cancelled occasion and follow Coordinator retry order without duplicate.

### rev-35 · 2026-11-21T11:34:31.382Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1985-evidence-2
commit: cd7f1fcc57eaa1a2351af1e5acc7be149fe91b06
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-22477, findings=[]. Full01fecbe0/A-22476 finished/passed at source3-reviewedcd7f1fcc5; refs unchanged. Typed starts/pass finishes confirm all7 required regressions; new3 each base+5 distinct load passes, unchanged4 T-1758 each base pass. Actual successful file receipts match all241T1/443T2/273T3/55Web; T0 exit0. Producer9440pass/13prerequisite skips/0fail/cancel; no18T4 runtime claim. Linux x64 c-8ams3 Node24.21 Nvim0.12.5, isolated HeadlessShell1248/Chrome for Testing156.0.8078.4. Canonical0875a8e9 differs by definition from Git38f9c96b. Report-only budgets/lint not enforced timing proof. Verify C1/C2 current. Prior cancelled563338a3/A-22458 remains partial/cancelled under Coordinator scheduling order, preserved A-22459; no relabelled occasion. No Reviewer execution/edit/rerun. Hold releases, no duplicate run or manual Coordinator relay.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T12:17:04.833Z

Merged 55479f075e6dbcec4f98201f16c3e8fd2cd8b42b onto dev.
