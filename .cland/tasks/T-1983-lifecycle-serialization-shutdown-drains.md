---
id: T-1983
kind: task
title: lifecycle-serialization "shutdown drains a held found resume" times out at its fixed 2 s test bound on macOS dev, alone and at low load
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1695
branch: t/T-1983-lifecycle-serialization-shutdown-drains
created: 2026-11-18T18:59:49.929Z
updated: 2026-11-21T08:53:22.835Z
---

## Summary

`hub/test/lifecycle-serialization.test.ts:44` "shutdown drains a held found resume without restarting supervision or publishing its result" fails with `'test timed out after 2000ms'` (2003 ms). It failed on dev d7050e7e2 run alone on macOS at a 1-minute load of 4.05 (Coordinator, 18:50Z on 2026-11-18). It failed twice on T-1646's head, including once alone at load 5.9. The `alive` and `identity` variants of the same loop pass, and the file passed T1 in the macOS stage cover cf666f3c at d7050e7e2 an hour earlier, so it's intermittent. The machine was healthy: swap 819 MB, `ps -A` 0.04 s.

## What to build

Name what the `found` path waits on beyond the 2 s per-test bound. Candidates are a native identity or process inspection for the found process's pid, or a supervision drain without a receipt. Fix the wait to observe its producing receipt, or move a real native boundary behind the injected fake (rule 38). Keep the assertions unchanged.

## Acceptance criteria

- [x] C1. The cause is named from evidence: the step the `found` case spends its 2 s on, with a native-call census or timestamps (rule 39).
  - verified: rev-40 [reviewer] · run rev-40-20261121-1983-source2 · 2026-11-21T08:11:01.733Z · commit 44e58b48fc7d350d1223ab2e63acdb6dda713bb8
  - done: impl-1983 · 2026-11-21T08:11:35.154Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1983-final · 2026-11-21T08:53:22.834Z · commit 44e58b48fc7d350d1223ab2e63acdb6dda713bb8
- [x] C2. The case passes 20/20 alone on macOS at an ambient load below 8 and 20/20 under a load gate of 10 (native slot), assertions unchanged (evidence).
  - done: impl-1983 · 2026-11-21T08:25:16.419Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1983-C2-evidence · 2026-11-21T08:26:37.198Z · commit 44e58b48fc7d350d1223ab2e63acdb6dda713bb8
  - verified: rev-40 [reviewer] · run rev-40-20261121-1983-final · 2026-11-21T08:53:22.835Z · commit 44e58b48fc7d350d1223ab2e63acdb6dda713bb8

## Comments

### impl-1983 · 2026-11-21T07:42:17.691Z

Preliminary diagnosis: found-only T1 runs with positively controlled fixtureNativeGuard passed twice on macOS Node v24.21.0 (114 ms and 36 ms), with no native child calls. Traced setup completed at 30.84 ms, then adapter entry, closure and lifecycle drain were observed. Cause remains unconfirmed. Worker admission is inside the first case explicit 2 s bound; later variants reuse setup. Awaiting Coordinator native slot for reproduction/C2 and T-2046 landing before selecting fix. Details in topic-1695.

### impl-1983 · 2026-11-21T07:47:28.371Z

Diagnosis slot completed and released. A-22386 holds 10/10 guarded found-only receipts at measured load 4.34–4.52, case times 69–396 ms; no native launches. Original timeout not reproduced, C1 remains unknown, C2 outstanding. Asked lead about a controlled delayed-admission reproduction after T-2046 lands; no fix selected.

### impl-1983 · 2026-11-21T07:50:28.766Z

Controlled red A-22391: in-process disposable admission responder held suite.slot/check reply 2200 ms. Found case cancelled at 2003.121 ms with exact test timed out after 2000ms, before tempProject completion or adapter entry. Producer timestamps received 853.52 ms / reply 3056.49 ms. Setup admission is inside first-case timeout. Proposed fix: initialize worker in separately bounded before hook; preserve explicit 2 s behavior timeout and all assertions. Awaiting T-2046 landing before finalizing.

### impl-1983 · 2026-11-21T07:54:07.439Z

Source committed/pushed at 518d635f38024742f80897291b75232676addb2b, branch t/T-1983-lifecycle-serialization-shutdown-drains. Current origin/dev c0198410b merged before source review. Controlled red A-22391, preload A-22392, controlled green and full changed-file 9/9 A-22394. Full npm run test:lint exit 0, 0 refusals; full npm run typecheck exit 0 on macOS Node v24.21.0. Lint ran before tracker-only merge; merged tracker wording recheck passed 0 findings. Initial source review requested before C2 repetitions per Coordinator decision; C2 remains outstanding, no configured verify run yet.

### rev-35 · 2026-11-21T07:56:40.889Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1983-source-1
commit: 518d635f38024742f80897291b75232676addb2b
scope: full
findings: [{"severity":"medium","text":"M1: Newly added native guard is unfenced and the fixture/callback lacks pre-acquisition ownership; rejected Sessions close can skip DB/hub closure while guard restoration still runs. Require complete original-work/partial-acquisition ownership and positive resource closure before root/seam release, with failure controls.","file":"hub/test/lifecycle-serialization.test.ts","line":32},{"severity":"low","text":"L1: Guide says the 2000 ms bound covers setup, but admission now runs in a separately bounded before hook. Describe that separation and retain the exact lifecycle behavior bound.","file":"docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md","line":16}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear; A-22398. M1 medium: fixtureNativeGuard defaults unfenced, fixture registers cleanup after hub/table/Sessions construction, and Sessions close rejection skips later closure while guard restores. Implementer confirms no encompassing owner/control (2e3c1968). Require shared pre-acquisition callback/resource ownership and positive close before root/seam restoration, retaining cancellation/rejected-cleanup proof. L1 low: file guide incorrectly says exact 2000 ms test bound covers setup; update for separate admission before hook. Coordinator e5db4743 explicitly accepts delayed admission seam for C1; retained producer timestamps/red/green establish that controlled setup boundary, not all historical scheduling. Every existing case body/timeout/assertion is byte-unchanged. C1 diagnostic proof is retained but verification awaits corrected fix; C2 remains unchecked and both 20/20 occasions outstanding. Local nine-case report is not campaigns/configured evidence. No Reviewer execution/edit. Hold releases for one consolidated correction and fresh source review.

Criteria: C1 failed (Accepted controlled admission diagnosis is retained, but newly introduced fixture guard lacks whole-callback/partial-acquisition and positive-close cleanup controls; correct before verification.).

### impl-1983 · 2026-11-21T08:08:55.445Z

M1/L1 consolidated correction pushed at 44e58b48fc7d350d1223ab2e63acdb6dda713bb8. A-22409 records pre-acquisition whole-callback/fenced-cleanup ownership, four real-fixture cancellation/positive-close controls and exact-head 13/13. Full typecheck and full test:lint exit 0 on final source bytes; 0 lint refusals. Guide corrected. Initial source review 2 requested; C2 campaigns/configured verify remain pending. No dev merge after first source review.

### rev-40 · 2026-11-21T08:11:01.733Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1983-source2
commit: 44e58b48fc7d350d1223ab2e63acdb6dda713bb8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; Standards0/Spec0 findings. M1 resolved by pre-acquisition complete-callback stageCase ownership, fenced retry cleanup, captured partial resources/root and positive required closes before storage/root/native-seam release. Four actual fixture/registered-cleanup controls prove held-abort and rejected table/Sessions-close retention, repair, confirmed close/root ENOENT/restoration. L1 corrected: separate admission before hook versus unchanged explicit2s lifecycle bound; all original body/assertions retained. C1 verified under Coordinatore5db4743 accepted delayed-admission seam: A-22391 producer timestamps and exact2s cancellation before adapter; A-22394 same hold green after before hook. Prior source epochs/historical-cause limits remain explicit. C1 checkbox currently cleared by source1; claimant done bookkeeping remains. C2 two20/20macOS campaigns remain pending; A-22409 reported13/13 at ambient18.97 is not C2 or configured evidence. Await Coordinator campaign/verify windows, no slot/final-ready grant. No Reviewer runtime/probes/edits.

Criteria: C1 verified.

### rev-40 · 2026-11-21T08:26:37.198Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1983-C2-evidence
commit: 44e58b48fc7d350d1223ab2e63acdb6dda713bb8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C2 campaign evidence clear; no findings. Independently checked every A-22427 attempt/native exit and original exact-name reporter proof:20/20 ambient launchload5.3037–5.8491<8 and20/20 launchload10.6836–14.0664>=10/<19, all exit0 and passed:true, ordered gates/proofs match. macOS localNode24.21.0/no browser, found-only selections; not full tiers. Burner34576 stop matches12workers exit0/rootRemoved:true/native parentexit0. Worker auto-pause at14 is recorded; no continuous active-burn/load claim. Earlier incomplete burner invocation remains excluded, unknown metadata not reconstructed. Campaign source pin supplied, per-child Git/native signal/duration fields not emitted/unknown; timestamp spans are not process timing. Original assertion/2000ms bound unchanged. C1 source mark stands. Final acceptance still awaits admitted same-head configured6532e3ef, not yet a pass. No Reviewer execution/probe/edit.

Criteria: C2 verified.

### impl-1983 · 2026-11-21T08:27:34.831Z

Both C2 campaigns verified by Reviewer at unchanged44e58b48f (A-22427/A-22428):20/20 ambient<8 and20/20 stress>=10/<19. Single configured mode-free verify admitted as6532e3ef-4888-4ea7-ab58-2ee3fa40d327. Local T0 receipt exit0/64.119s observed in suite.log line107; verify window released. Configured remaining phases/result pending, no pass claimed and no resubmission. Native/stress slot already released and handed to T-2046.

### impl-1983 · 2026-11-21T08:52:21.919Z

Configured run6532e3ef passed at exact reviewed44e58b48f, artifact A-22440. Local T0 exit0; Linux x64 droplet c-8 ams3 completed all T1, fallback-all T2 and Web exit0. Aggregate7268 tests:7267 pass,0 fail/cancelled,1 macOS-only selector skip. Streamed structured receipts independently confirm all13 lifecycle cases pass and each of4 new ownership identities5/5 load-gated. Browser Chrome Headless Shell build1248 / Google Chrome for Testing156.0.8078.4; Node24.21.0. Budget/test-lint findings remain report-only. T3 deferred to merge batch, T4 not run. Droplet lifetime1448s/cost$0.1006. Source unchanged/clean; Reviewer has same-head result for final settlement; no rerun.

### rev-40 · 2026-11-21T08:53:22.835Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1983-final
commit: 44e58b48fc7d350d1223ab2e63acdb6dda713bb8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; no findings. Same-head/executable-tree A-22440/6532e3ef passed T0/allT1/fallbackT2/Web:7267pass/1Mac-only selector skip/0fail/cancel. Independently checked all13 lifecycle generated names and each4 ownership controls' base+5 positive finishes/5of5 load gates. Unchanged explicit2000ms bound/assertions, repaired cleanup/root/native-seam proof retained. C1 uses current accepted controlled-admission diagnosis/source2A-22415; C2 uses current macOS40/40 campaign auditA-22428, separate from Linux configured proof. Prior epochs, missing timing/provenance, paused burner and excluded preliminary attempt retained; no historical cause/latency speedup invented. NoncachedLinuxx64c8ams3 Node24.21/Nvim0.12.5; HeadlessShell1248/CfT156.0.8078.4. T3 merge batch/T4unexecuted; budgets/lint report-only. No Reviewer runtime/probes/edits.

Criteria: C1 verified, C2 verified.
