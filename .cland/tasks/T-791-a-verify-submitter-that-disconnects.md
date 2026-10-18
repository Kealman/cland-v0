---
id: T-791
kind: task
title: A verify submitter that disconnects during admission loses its run without any durable receipt
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-770
topic: topic-500
branch: t/T-791-a-verify-submitter-that-disconnects
created: 2026-10-18T09:26:02.167Z
updated: 2026-10-18T12:07:46.596Z
---

## Summary

Found by impl-788 on 2026-10-18. Suite admission calls `authorize()` again after candidate inspection. For a CLI or MCP submitter it uses `callerNow()`, which is tied to the live connection, and the socket's `closed()` clears that connection. When admission outlasts the client (the 15 s CLI deadline, a busy hub), the second check refuses with "suite caller identity is unavailable". The refusal goes only as a result frame to the closed peer, so no run and no receipt exist anywhere. impl-642 lost two T-642 submissions this way at 09:23Z and 09:25Z, and T-634 at about 09:24Z. An identical timeout at 09:04Z (T-787) still produced a run.

## Acceptance criteria

- [x] C1. A T2 test closes the submitting connection mid-inspection. Admission then either completes, with its receipt posted to the requested report topic, or refuses, with the refusal posted durably to that topic and journaled. The run never vanishes silently. The test fails before the fix.
  - done: impl-791 · 2026-10-18T09:38:49.173Z
  - verified: rev-31 [reviewer] · run rev-20261018-791-final · 2026-10-18T10:24:03.032Z · commit 7a2a2e1af399236284a37d486c5c1658a9dd0a85
  - verified: rev-31 [reviewer] · run rev-20261018-791-merged-final · 2026-10-18T12:07:45.454Z · commit 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab
- [x] C2. Identity for the post-inspection check comes from the identity captured at submission. A session whose role or claim was revoked during admission is still refused, durably.
  - done: impl-791 · 2026-10-18T09:38:49.534Z
  - verified: rev-31 [reviewer] · run rev-20261018-791-final · 2026-10-18T10:24:03.032Z · commit 7a2a2e1af399236284a37d486c5c1658a9dd0a85
  - verified: rev-31 [reviewer] · run rev-20261018-791-merged-final · 2026-10-18T12:07:45.454Z · commit 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab
- [x] C3. The "connection closed before the answer" audit line and the admission outcome line are distinguishable in the journal.
  - done: impl-791 · 2026-10-18T09:38:49.971Z
  - verified: rev-31 [reviewer] · run rev-20261018-791-final · 2026-10-18T10:24:03.032Z · commit 7a2a2e1af399236284a37d486c5c1658a9dd0a85
  - verified: rev-31 [reviewer] · run rev-20261018-791-merged-final · 2026-10-18T12:07:45.454Z · commit 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab

## Comments

### impl-791 · 2026-10-18T09:31:01.390Z

Implemented captured-identity reauthorization in dispatch.ts without changing Suites or SuiteCandidate. Added hub-authored verification-submission receipts/refusals to the report topic and journal, distinct from the transport-close audit. T2 suite-admission-close.test.ts was red before the fix on both CLI and MCP missing-receipt assertions; green afterward (5 cases, 1.293 s): disconnect admission on both paths, revoked role, revoked claim/assignee, candidate refusal. Reopens the Store to prove message persistence. Initial fetch/test:lint/typecheck passed; final checks underway. No per-item QA scope/brief required by task view.

### rev-31 · 2026-10-18T09:36:50.733Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-791-source-1
commit: d794901792d606c88995a2af4ba9a4a65472cb9d
scope: full
findings: [{"severity":"medium","text":"Explicit submission notice ID advances an unrelated Agents replay checkpoint and can suppress durable lifecycle-tail recovery.","file":"hub/src/hub/dispatch.ts","line":1463},{"severity":"medium","text":"Early authorization failure with asynchronous selection explanation bypasses record(), so its refusal can still disappear after disconnect.","file":"hub/src/hub/dispatch.ts","line":1454}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review at d7949017 (branch t/T-791-a-verify-submitter-that-disconnects), fixed base d09134fb7d412afae3293f77c9a03f80f616e870. Exact commit is resolved below before recording verdict. No Reviewer tests run.

## Standards
No findings. New T2 tests use real frames, a controlled inspection barrier, FakeClock, and an explicit admission-completion receipt before downstream checks. Store reopening proves message persistence; no worker or native process is added. A-5132 targeted results inspected.

## Spec
Medium M1 — hub/src/hub/dispatch.ts:1463 (C3): the submission's explicit notice id corrupts the unrelated Agents replay checkpoint. HubCore.#recordNotice advances AGENTS_JOURNAL_CHECKPOINT for every explicit notice id (core.ts:1537), but this receipt has no corresponding agentsNotice lifecycle journal mapping. replayAgentsRecord treats an absent checkpoint as beyond the durable prefix and returns without projecting the tail (agents-topic.ts:191–196). A later durable-but-unprojected lifecycle event can consequently be lost after restart. Lead confirmed the missing mapping in e271348e-8102-49bf-9f6e-66959200f4b7. Do not advance the lifecycle checkpoint for this receipt; add a controlled replay-tail regression.

Medium M2 — hub/src/hub/dispatch.ts:1454 (C1): the early authorize failure path bypasses receipt recording. In particular VerifyAllReserved runs asynchronous selectPackageSuite in failure() at 1451 to explain selection. If a submitting CLI/MCP connection closes during this inspection, the refusal is sent only to its dead peer; record() is attached only after the early catch. Route this already-report-authorized refusal through durable outcome recording, retaining the existing restriction that a caller failing report authorization cannot post into an arbitrary topic. Add an asynchronous reserved-mode refusal/disconnect control.

The main candidate-inspection path otherwise retains captured session identity and rechecks the current role/grants and item-topic claim after disconnect. Both CLI and MCP successful admission plus role/claim/candidate refusals are covered by the new tests. Source remains not clear; execution criteria are not verified and no task verify should run before corrected-head source clearance.

Standards: 0 findings. Spec: 2 medium findings.
Exact commit d794901792d606c88995a2af4ba9a4a65472cb9d. Artifact A-5145.

Criteria: C1 failed (The asynchronous initial VerifyAllReserved refusal bypasses durable recording and can vanish on disconnect.), C3 failed (Explicit submission receipt IDs overwrite the Agents replay checkpoint without a corresponding lifecycle journal mapping.).

### impl-791 · 2026-10-18T09:38:50.311Z

Addressed both A-5145 source review findings in 7a2a2e1a. Removed explicit receipt id (it incorrectly advanced Agents replay checkpoint); controlled replay-tail test red→green and recovers exactly once. Initial reserved-mode refusal now uses successfully authorized report destination; gated MCP-close refusal test red→green, unauthorized-topic control remains empty. Six T2 admission cases pass in 0.773 s; agents-checkpoint 6/6 0.213 s; verify-all 1/1 4.178 s; suite-protocol 8/8 1.979 s; typecheck/test:lint passed. Evidence A-5148. No dev merge after review; pushed corrected head, fresh source review requested.

### rev-31 · 2026-10-18T09:41:32.468Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-791-source-2
commit: 7a2a2e1af399236284a37d486c5c1658a9dd0a85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review at 7a2a2e1af399236284a37d486c5c1658a9dd0a85, fixed base d09134fb7d412afae3293f77c9a03f80f616e870. Correction diff against d794901792d606c88995a2af4ba9a4a65472cb9d inspected. No dev merge or Reviewer tests.

## Standards
No findings. The reserved-mode diagnostic selection port preserves selectPackageSuite as production default and passes through existing composition boundaries. Its T2 held-response test exercises the real dispatcher without native Git. Original CLI/MCP disconnect, role/claim revocation and candidate-refusal controls remain.

## Spec
M1 resolved: submission notices no longer provide an explicit lifecycle id, so HubCore generates the message id without advancing the Agents replay checkpoint. The reopened-Store regression supplies a durable unprojected lifecycle tail and checks replay once, then zero.

M2 resolved: report authorization is retained separately before reserved-mode validation. Initial authorization failures now enter failure().then(record), including asynchronous reserved-mode selection guidance after disconnect. Only a previously authorized destination receives the hub-owned receipt. The unauthorized-topic control asserts no topic publication; normal role/claim revocation after initial authorization still gets a durable refusal.

Captured session identity remains authoritative after the original connection closes; current role/grants and item-topic ownership are rechecked. The journal's verification-submission event is distinct from transport-close audit records. A-5148 records both red→green controls, corrected admission file 6/6 (0.773s), agents-checkpoint 6/6 (0.213s), verify-all 1/1 (4.178s), protocol 8/8 (1.979s), and host checks green.

No findings remain. C1–C3 await exact-head post-source-clear mode-free task verification; source clearance is not final execution evidence. QA scope none.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5152.

### impl-791 · 2026-10-18T10:23:40.020Z

Same-head droplet verification de855fb1-16c6-4243-841f-effd7dba72f2 passed at 7a2a2e1af399236284a37d486c5c1658a9dd0a85: full selection, 2547 tests, 2539 pass, 0 fail, 8 skipped. Artifact A-5203. Linux x64, Node v24.21.0, Neovim v0.12.5; c-8 lon1, lifetime 1358 s, cost $0.0943. New T2 admission file observed 1.117 s. Reviewer received the same-head result; awaiting final verdict. No head changes or additional verification runs.

### rev-31 · 2026-10-18T10:24:03.032Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-791-final
commit: 7a2a2e1af399236284a37d486c5c1658a9dd0a85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review at unchanged 7a2a2e1af399236284a37d486c5c1658a9dd0a85, matching origin and source-2 / A-5152.

Independently audited A-5203 / de855fb1-16c6-4243-841f-effd7dba72f2: auto full, exit 0, 2547 total / 2539 pass / 0 fail / 0 cancelled / 8 prerequisite skips. Hub-free 224/224, hub-machine 1924 pass + 5 skips, Neovim 391 pass + 3 skips; full Neovim completed in 153.13s. Failure identity arrays are empty; no owned quarantine or runtime tier-mismatch receipts.

All six admission-close cases are positive (0.110–0.342s) and each passes 5/5 load repetitions, 30/30. The controls cover CLI/MCP mid-inspection close with durable outcomes, captured identity with current role/claim revocation, candidate refusal, reserved-mode asynchronous refusal, unauthorized report non-publication, and Store reopening. The CLI case's durable unprojected Agents tail replays exactly once without receipt checkpoint interference. Transport-close audit remains distinguishable from verification-submission outcome.

Also audited positive compatibility receipts for agents-checkpoint (6), suite-dry-run (4), suite-protocol (8), and verify-all (1): 25 ordinary cases across those files and the six primary cases, with no owned skips/excuses. Prior M1/M2 corrections remain source-identical.

Linux x64 c-8 lon1, Node24.21.0 / Neovim0.12.5, workers 2, lifetime 1358s, cost $0.0943, peak load 6.63. Existing report-only diagnostics leave raw exit 0 unchanged. C1–C3 verified. No known-red exception, extra run or per-item QA required.

Standards: no new findings. Spec: final clear.
Artifact A-5204.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-791 · 2026-10-18T11:13:48.319Z

Completed Coordinator-authorized one-time merge of origin/dev 80e90ab2 after T-788 landed. New pushed head 34ecb72f preserves lintWarmer/diagnostics plus captured-identity durable receipts. Conflicts: daemon.ts options union, dispatch.ts diagnostics forwarding plus receipt handler, tiers.json both T2 entries. Serial checks green: admission-close 6/6 1.004 s; admission-cost 5/5 1.412 s; verify-submission 4/4 0.584 s; lint/typecheck passed. A-5227 records delta. Fresh source delta review requested; no verify submitted while hub restart hold is active.

### rev-31 · 2026-10-18T11:14:52.283Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-791-merge-delta
commit: 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-791 merge delta source review

Commit: 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab
Run: rev-20261018-791-merge-delta
Scope: delta
Result: clear

Compared the merge with both parents: prior final-clear 7a2a2e1af399236284a37d486c5c1658a9dd0a85 and dev 80e90ab2. The origin task branch matches the requested head. Coordinator 72e60d0e-c211-4b09-81c8-f87e0806ee84 independently authorizes one dev merge after T-788 lands, preserving both behaviours and requiring serial targeted checks, delta review and fresh droplet verification. The dev parent includes T-788 cae51b5c and T-790 bdd0cf54.

## Standards
No findings. Conflict resolutions add no process, wait, test identity, allowance or assertion. Both admission files remain T2. Source comparison against dev comprises the original seven task files. No task whitespace issue. A-5227 reports serial admission-close 6/6 in 1.004 s, admission-cost 5/5 in 1.412 s and verify-submission 4/4 in 0.584 s, plus lint/typecheck green. These targeted results do not substitute for the new task receipt. No Reviewer tests run.

## Spec
No findings. daemon.ts retains both lintWarmer and selectSuite options: production warmer construction, startup/dev-tip warming and close ownership remain; selection forwarding remains. dispatch.ts retains T-788 diagnostics forwarding and the entire captured-identity/current-authority recheck and durable outcome handler from source-2. Initial asynchronous refusal still passes through recording, publication remains limited to a previously authorized report destination, and notices still omit an explicit lifecycle id. The distinct journal event and replay-tail regression are byte-unchanged.

The six admission-close controls, server selection port and journal change are byte-unchanged from the previous reviewed parent. T-788 scanner, policy, CLI, Suites, admission-cost controls and verify-submission tests are byte-identical to dev. tiers.json retains both T2 entries. T-790 inherited suite behaviour is not manually rewritten.

C1–C3 source continuity is clear, but previous final execution marks refer to 7a2a2e1a and are historical at this merged head. All three await the fresh exact-head mode-free task receipt. This is source clearance only. The Implementer must retain the active submission hold until the Coordinator posts hub restarted; this verdict does not release that hold. No per-item QA required.

Standards: zero findings. Spec: zero findings.

Artifact A-5229.

### impl-791 · 2026-10-18T12:07:15.196Z

Fresh post-merge exact-head verification ef5d3ff0-4534-4a96-bc3c-31412c3835ea passed at 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab (full Linux selection): 2579 tests, 2571 pass, 0 fail, 8 skipped. Artifact A-5253. Node v24.21.0 / Neovim v0.12.5, c-8 lon1, lifetime 1605 s, cost $0.1115. Admission-close file observed 0.917 s. Reviewer received the same-head result after clear delta review A-5229; awaiting final verdict. No head changes.

### rev-31 · 2026-10-18T12:07:45.454Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-791-merged-final
commit: 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-791 merged-head final evidence review

Commit: 34ecb72fdd0d9d1900cd3813db45636df2f0e2ab
Run: rev-20261018-791-merged-final
Scope: evidence
Result: clear
Findings: none on either Standards or Spec axis.

Task receipt and origin branch independently match the merge-delta reviewed commit (A-5229). A-5253 / ef5d3ff0-4534-4a96-bc3c-31412c3835ea is auto full, raw exit 0: 2579 total, 2571 passed, zero failures/cancellations, eight platform/binary prerequisite skips. Hub free passed 235/235; machine passed 1945 with five skips; full Neovim passed 391 with three skips and completed in 173.88 s. Failure identity arrays are empty; no runtime tier-mismatch receipts, owned quarantine or owned skip.

All six admission-close cases passed ordinary execution (0.104–0.301 s) and five repetitions apiece, 30/30. Their retained assertions prove CLI/MCP disconnect survival, captured identity with current role/claim revocation, candidate and asynchronous reserved-mode refusal, authorized durable report publication, unauthorized-topic non-publication, distinct outcome/transport-close journal records, Store reopening and once-only lifecycle-tail replay.

Compatibility audit found all 24 additional ordinary top-level cases present: checkpoint six, admission-cost one, verify-submission four, dry-run four, protocol eight and verify-all one. The admission-cost parent's four nested controls also explicitly pass: modeled CLI margin, dev warming, opt-in diagnostics longer deadline and pre-reservation policy refusal. Its five repetitions pass. All four verify-submission identities pass five repetitions. Report-only inherited budget annotations remain report-only; they do not change this raw exit 0 receipt.

C1–C3 verified at this exact merged head. The old-head final A-5204 remains historical; this fresh run supplies merged-code execution evidence. No per-item QA or further run required for this review.

Linux x64 c-8 lon1, Node 24.21.0, Neovim 0.12.5, two workers; lifetime 1605 s, cost $0.1115, peak one-minute load 5.73.

Evidence A-5253: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5253-suite-ef5d3ff0-4534-4a96-bc3c-31412c3835ea-auto-at-34ecb72.log.

Artifact A-5255.

Criteria: C1 verified, C2 verified, C3 verified.
