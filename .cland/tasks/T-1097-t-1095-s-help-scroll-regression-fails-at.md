---
id: T-1097
kind: task
title: "T-1095's help-scroll regression fails at 1024×600 on Linux: a row is never fully visible after one PageDown"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
regression_of: T-1095
topic: topic-841
branch: t/T-1097-t-1095-s-help-scroll-regression-fails-at
created: 2026-10-22T07:39:15.709Z
updated: 2026-10-22T08:20:51.206Z
closed: 2026-10-22T08:20:51.206Z
---

## Summary

T-1095's regression `web/test/palette.test.ts` "Items help stays inside small viewports and every row is reachable by keyboard scrolling" failed on Linux in T-1096's run 7be3f149 (A-9016, Linux x64 droplet c-8 lon1, head 7c1469bc on dev 90c54f5a): subtest `1024×600` threw "PageDown reveals open-other: not within 6000 ms", and the parent took 8.494 s against the 5 s new-identity gate. The 1280×720 subtest passed in 1.14 s. The same test passed on Linux in T-1095's own run 47bcfb0a (parent 2.538 s). The step loop requires each next unseen row to become fully visible after one PageDown; a row that straddles a page boundary under Linux font metrics, or a PageDown that lands before focus or scroll settles, can make that never true.

## Acceptance criteria

- [x] C1. The regression still proves, at 1280×720 and 1024×600, that the help dialog stays inside the viewport and that keyboard scrolling (PageDown/End/Home) brings every one of the 32 rows fully into view, without depending on a row being fully visible after exactly one PageDown, and it fails on a planted unbounded `.keys` list (test).
  - done: impl-1097 · 2026-10-22T07:45:43.149Z
  - verified: rev-23 [reviewer] · run rev-20261022-1097-source · 2026-10-22T07:47:05.029Z · commit 1a508be8380a9b3f26f61688ed1a508d64d1d5c1
  - verified: rev-23 [reviewer] · run rev-20261022-1097-source-2 · 2026-10-22T07:52:55.094Z · commit 9782fdbd10898659b5399cca4e32f3544a070e2f
  - verified: rev-23 [reviewer] · run rev-20261022-1097-final · 2026-10-22T08:04:42.451Z · commit 9782fdbd10898659b5399cca4e32f3544a070e2f
  - verified: rev-23 [reviewer] · run rev-20261022-1097-source-3 · 2026-10-22T08:06:02.252Z · commit e2233f5e05b785edd848eaa5c3532f0354129e86
  - verified: rev-23 [reviewer] · run rev-20261022-1097-final-2 · 2026-10-22T08:16:03.239Z · commit e2233f5e05b785edd848eaa5c3532f0354129e86
- [x] C2. The test passes in a mode-free `cland verify` on the Linux droplet at the reviewed head (Web runs once there; the load gate does not repeat Web) and 10/10 in a local Chrome Headless Shell loop at 1024×600 and 1280×720; its Linux parent time is under 5 s or carries a dated allowance (owner E-880, about 1.5× the worst Linux sample), and every executed sample is listed in the item topic (test).
  - done: impl-1097 · 2026-10-22T07:45:43.216Z
  - verified: rev-23 [reviewer] · run rev-20261022-1097-final · 2026-10-22T08:04:42.451Z · commit 9782fdbd10898659b5399cca4e32f3544a070e2f
  - verified: rev-23 [reviewer] · run rev-20261022-1097-final-2 · 2026-10-22T08:16:03.239Z · commit e2233f5e05b785edd848eaa5c3532f0354129e86

## Comments

### impl-1097 · 2026-10-22T07:45:43.443Z

Implemented test-only at 1a508be8, pushed origin. Local original5/5, repaired10/10 both requested viewports; full palette11/11, typecheck pass, lint report-only132 existing findings/zero refusals. A-9023 raw samples; A-9024 planted diff; A-9025/A-9026 unbounded regression traces. C2 local work done; same-head Linux receipt and allowance decision pending clear source review, per amended C2.

### rev-23 · 2026-10-22T07:47:05.029Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1097-source
commit: 1a508be8380a9b3f26f61688ed1a508d64d1d5c1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no Standards/Spec findings. Prearmed native scroll completion, fresh exact all32 PageDown traversal after Home, bounded stable bottom and viewport/End checks preserve C1; original local10/10 and planted-unbounded failures retained in A-9023/A-9024. C1 verified. C2 awaits actual same-head Linux mode-free Web pass and duration/allowance assessment under Coordinator amendment048f36b4. Web not load-repeated. Full review artifact posted in topic.

Criteria: C1 verified.

### rev-23 · 2026-10-22T07:52:55.094Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1097-source-2
commit: 9782fdbd10898659b5399cca4e32f3544a070e2f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta clear: only exact-identity 6.7s E-880 allowance, dated2026-10-22→29, ~1.505× original Linux parent4.451092109s in A-9032. Test blob unchanged46dbe218; C1 refreshed from accepted source/local proof. C2 pending new-head ordinary mode-free Linux receipt. Prior green792 is historical after tree change; actual Web once/empty web-only T2, no load inference.

Criteria: C1 verified.

### impl-1097 · 2026-10-22T08:03:53.560Z

Final same-reviewed-head9782fdbd Linux run994a565b (A-9040) passed2421/2421,no skips: allT1+allT2 hub/Neovim fallback+Web; noT3/T4. Sample2 (once):1280×7202.103866996s,1024×6002.367270904s,parent4.979509666s,within reviewed6.7s datedE-880allowance. Linuxx64c-8lon1,lifetime573s/$0.0398; genericlint/budget/ratchetreport-only; hostcheckpass,remotegatereused. FinalReviewerC2settlement pending; clean pushedsinglecommit,nomerge.

### rev-23 · 2026-10-22T08:04:42.451Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1097-final
commit: 9782fdbd10898659b5399cca4e32f3544a070e2f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear: exact-head A-9040 / 994a565b independently confirms 2421 ordinary passes, 369 file passes, actual T1/all-T2/Web exit0, no load-scoped finishes. Owned Linux sample once: 1280×720 2.103866996s; 1024×600 2.367270904s; parent4.979509666s (<5s and covered by reviewed6.7s allowance). Combined with identical-source local10/10 and planted red in A-9023 plus A-9030/A-9035, C1/C2 verified under amended C2. Linux573s/$0.0398; host38e6b791 reused, report-only diagnostics retained. No T3/T4/QA claim.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-22T08:06:02.252Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1097-source-3
commit: e2233f5e05b785edd848eaa5c3532f0354129e86
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta clear under Coordinator1087a10e: only 7.5s allowance and reason listing both audited Linux samples; E-880 dates unchanged. 7.5s rounds above1.5×worst4.979509666s. Test blob46dbe218 unchanged; C1 refreshed. C2 pending ordinary mode-free evidence at this amended head as directed; prior A-9040 remains historical support.

Criteria: C1 verified.

### impl-1097 · 2026-10-22T08:15:36.052Z

Final amended head e2233f5e: mode-free Linux run ff2091cb (A-9044) passed 2421/2421 with no skips, actual all T1 + all hub/Neovim T2 fallback + Web; no T3/T4. Linux sample 3 executed once: 1280×720 2.010407505 s; 1024×600 2.130948471 s; parent 4.549291425 s. Prior parents 4.451092109 and 4.979509666 s; 7.5 s dated E-880 allowance covers ~1.5× worst. Linux x64 c-8 lon1, lifetime 497 s, cost $0.0345; generic lint/budget/ratchet report-only; host check passed, remote gate reused. Single pushed commit, clean tree, no merge. Final Reviewer settlement pending.

### rev-23 · 2026-10-22T08:16:03.239Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1097-final-2
commit: e2233f5e05b785edd848eaa5c3532f0354129e86
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at amended head: original A-9044 / ff2091cb and task.view agree; independently audited 2421 ordinary passes / 369 file passes, actual T1/all-T2/Web exit0, no load-scoped finishes. Owned Web once: 2.010407505s / 2.130948471s; parent4.549291425s. All three Linux parents remain below5s; reviewed7.5s allowance is ~1.5×worst4.979509666s. C1/C2 verified with source A-9030/A-9043, retained local10/10/planted proof and listed samples. Host9071a5ef reused; report-only warnings retained; no T3/T4/QA claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-22T08:20:51.206Z

Merged b6da38f2643048ea6c8eff8d7897da3c35a23bad onto dev.
