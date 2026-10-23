---
id: T-1125
kind: task
title: Queued messages and Withdraw in the thread
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1124
  - T-1117
topic: topic-893
branch: t/T-1125-queued-messages-and-withdraw-in-the
created: 2026-10-22T15:16:14.021Z
updated: 2026-10-23T05:58:46.054Z
closed: 2026-10-23T05:58:46.054Z
---

## Summary

A message to a busy session shows in the thread as queued with a Withdraw that puts its text back into the composer; once the session's turn has taken it, Withdraw is gone.

## Parent

E-417 (§3.4 the composer, queued messages; choice "Withdraw"; tracer step 4).

## What to build

The thread shows the human's message with its delivery stage from the hub. While no delivery has been injected, the message offers Withdraw; Withdraw sends the hub's withdraw, shows it pending, and on the receipt marks the message withdrawn and puts its text back into the composer (ahead of anything typed since, as Neovim's composer does with a refused message). Once the hub reports the message injected, Withdraw disappears. A refused withdraw keeps the message and shows the hub's reason in its tooltip.

## Acceptance criteria

- [x] C1. A message to a busy fake session shows as queued with Withdraw, and Withdraw marks it withdrawn and puts its text back into the composer (Web test).
  - done: impl-1125 · 2026-10-23T05:20:06.392Z
  - verified: rev-23 [reviewer] · run rev-20261023-1125-final · 2026-10-23T05:54:09.574Z · commit 6f4e9a4717d3db0ed6bcd15e3db697541ca3a1ff
- [x] C2. When the fake session's turn takes the message, its stage moves to injected and Withdraw disappears (Web test).
  - done: impl-1125 · 2026-10-23T05:42:52.488Z
  - verified: rev-23 [reviewer] · run rev-20261023-1125-final · 2026-10-23T05:54:09.575Z · commit 6f4e9a4717d3db0ed6bcd15e3db697541ca3a1ff
- [x] C3. A withdraw the hub refuses leaves the message as it was with the refusal shown (Web test).
  - done: impl-1125 · 2026-10-23T05:09:23.818Z
  - verified: rev-23 [reviewer] · run rev-20261023-1125-final · 2026-10-23T05:54:09.575Z · commit 6f4e9a4717d3db0ed6bcd15e3db697541ca3a1ff

## Comments

### impl-1125 · 2026-10-23T05:01:31.818Z

Preparation: initial npm run build passed on local macOS. Confirmed Web public-frame/fake-spoke seam from E-417 and launch brief; no source edits until T-1124 is present on origin/dev. Existing MessageBlock renders hub delivery stages; planned browser slice will restore into T-1124's per-topic draft store after withdrawal receipt, preserving newer text.

### impl-1125 · 2026-10-23T05:10:44.096Z

Implementation pushed at 5026bf9b3963ad17d92e7600d43033d5b927b09e; C1–C3 done and source review requested from Reviewer in topic-893 (delivered to current role holder). A-9845 records TDD red/green, exact targeted file counts/times and prior failures: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9845-t-1125-implementation-and-targeted-test-evidence.md. Build, full typecheck, static/test lint and required area-slots/key-contexts/palette targeted checks pass locally; composer/messages regressions pass too. Awaiting source verdict before mode-free verify; no per-item QA required by after-stage policy.

### rev-23 · 2026-10-23T05:13:28.774Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1125-source
commit: 5026bf9b3963ad17d92e7600d43033d5b927b09e
scope: full
findings: [{"severity":"medium","text":"Restoration prepends only to draft.text, ignoring pending.text. Withdraw A while newer B is pending and C typed: reload or B refusal restores B/A/C, violating older withdrawn text before newer typing; preserve correct order also on B success.","file":"web/src/composer-drafts.ts","line":49},{"severity":"medium","text":"Aggregate queued/delivered does not prove all recipients retractable. One injected recipient plus one queued recipient stays queued, so Withdraw remains offered after partial injection. Use authoritative eligibility or explicit lead-approved contract disposition; cover two recipients.","file":"web/src/MessageBlock.tsx","line":22}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear, complete M1/M2 set in A-9846. Pending-send draft ordering and partial-injection eligibility need corrections; other source/standards/docs/test audit complete, no lows. C1/C2 failed; C3 runtime unverified. Implementer escalated eligibility seam to lead/Coordinator and must await its decision; no unapproved protocol workaround. Preserve original raw local receipts. Fresh corrected-head source review before verification; after-stage QA separate.

Criteria: C1 failed (Withdraw restoration reorders older text behind a newer pending send on refusal or uncertain reload.), C2 failed (Aggregate queued can include an injected recipient; Withdraw remains offered after irreversible partial injection.).

### impl-1125 · 2026-10-23T05:21:21.055Z

Corrected M1/M2 pushed at bad203ece978c1f67e50654083b2003923ec4c88; fresh source review requested from Reviewer. Coordinator-approved optional withdrawable field now uses shared hub refusal check and preserves aggregate stages/queued-only old-hub fallback. Pending-send insertion boundary preserves withdrawn older text through refusal, success, edits and uncertain reload. C1/C2 re-done; C3 done. Targeted local macOS checks pass; details and actual red excerpts in A-9847: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9847-t-1125-m1-m2-corrections-and-targeted-evidence.md. No dev merge after first source review; mode-free verify remains held for fresh source verdict.

### rev-23 · 2026-10-23T05:23:32.296Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1125-source-2
commit: bad203ece978c1f67e50654083b2003923ec4c88
scope: full
findings: [{"severity":"medium","text":"Visibility replaces cached message outright and core refreshVisibility omits computed withdrawable (core.ts:271). Fresh or held refresh can erase/overwrite false on aggregate queued partial-injection rows and reoffer Withdraw. Publish eligibility and preserve newer exact-id delivery facts; cover both refresh races.","file":"web/src/topic-threads.ts","line":61}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source not clear; M1 resolved, M2 main wire/history/message/delivery path resolved under Coordinator99a45abb. Remaining visibility projection/merge path only; complete audit in A-9848, no lows. C2 failed, C1/C3 runtime unverified. Add held-crossing and fresh post-submission visibility regressions, fresh source review before verify. Local A-9847 is supporting evidence only; retain raw receipts. After-stage QA separate.

Criteria: C2 failed (Visibility refresh erases authoritative false or overwrites newer delivery eligibility, reoffering Withdraw after partial injection.).

### impl-1125 · 2026-10-23T05:25:31.593Z

Remaining M2 visibility path fixed at 786899d37c1903c9aa5893f350b30564aecc4c73 and pushed; fresh Reviewer request delivered. A-9853 records held-before-submission and fresh Web visibility projections, retained newer eligibility/ask patches, actual red and passing targeted/static evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9853-t-1125-visibility-refresh-correction-evidence.md. C2 re-done; all criteria done. Mode-free verify remains held for current-head source verdict.

### rev-23 · 2026-10-23T05:26:08.011Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1125-source-3
commit: 786899d37c1903c9aa5893f350b30564aecc4c73
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear, no findings. A-9854 consolidates A-9846/A-9848 corrections: M1 pending insertion ordering/refusal/success/uncertain reload; M2 Coordinator-approved optional authoritative eligibility at submission plus history/message/delivery/visibility, preserving newer patches across held refreshes and queued-only legacy fallback. Extended two-recipient Web test checks changed layer receipts, fresh false fact and reload exclusion. Protocol/docs/skill provenance match behavior; no permissions changed. Local A-9847/A-9853 supports source only. C1–C3 runtime pending exact-head mode-free verify; preserve original raw receipts and inspect new Web timing samples. After-stage QA separate.

### rev-23 · 2026-10-23T05:30:48.915Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1125-evidence
commit: 786899d37c1903c9aa5893f350b30564aecc4c73
scope: evidence
findings: [{"severity":"medium","text":"A-9855 actual delivered event includes withdrawable:true; exact expected object omits it. Configured T1 fails, leaving T2/Web and final criteria incomplete. Preserve full event/history assertions while updating the approved shape; fresh source review before retry.","file":"hub/src/hub/store.test.ts","line":306}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, source A-9854 stands. A-9856: A-9855/1534733f exits1 at786899d3, Linux T1 762pass/1fail; actual deepEqual adds withdrawable:true at store.test.ts:306. T2/Web did not execute, no new Web timings; generic lint/budget report-only, host gate reused. Exact-shape compatibility gap is attributable to the approved additive field, not a passing product run. Preserve equality/history assertions, correct at new head and obtain source review before verification. No Reviewer-authorized local tests during quiet; C1/C3 runtime also unverified.

Criteria: C2 failed (Configured run fails T1's exact delivery-event expectation after additive withdrawable field; T2/Web did not execute.).

### rev-23 · 2026-10-23T05:33:35.642Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1125-source-4
commit: ea4718c8ba24faf01ea051b5f062399770a2532c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-9858: exact delivery observers retain equality/history checks with approved eligibility; native contract tests preserve acceptance/submission/confirmation and assert true/false/false. Durable fence unchanged; extra submission-only updates limited to ordinary human non-answer input, preserving non-human brief sequences. Prior full/corrected audits stand. A-9857 correctly labels new migrations/restriction unexecuted during quiet; T3 native/stdio expectations remain deferred, no T3 pass inferred. C1–C3 runtime pending fresh mode-free droplet receipt. Restore C2 done (task.view still unchecked after evidence failure), then submit. Preserve original receipts; after-stage QA separate.

### rev-23 · 2026-10-23T05:41:12.498Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1125-evidence-2
commit: ea4718c8ba24faf01ea051b5f062399770a2532c
scope: evidence
findings: [{"severity":"medium","text":"A-9859 fails `b still waits: the stage stays queued / true !== false`: assertion rejects any delivery frame, including newly allowed queued capability updates. Preserve exact queued/TTL guarantees and audit negative/count-only observers; changed head needs source review.","file":"hub/test/human-routing.test.ts","line":135}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-9860 records A-9859/95f5b432 at ea4718c8:2146pass/1fail, T1 passes, partial hub T2 fails, Web absent/no new samples. Actual human-routing:135 no-frame assertion conflicts with intentional queued eligibility updates. Source A-9858 stands; preserve strict stage/eligibility/TTL assertions when correcting observers, then fresh source review. Host gate reused; report-only diagnostics do not change failure. C1/C3 runtime also unverified; T3 expectations remain deferred.

Criteria: C2 failed (T2's no-delivery-frame observer fails on allowed aggregate-queued capability publication; configured Web remains unexecuted.).

### rev-23 · 2026-10-23T05:43:27.419Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1125-source-5
commit: 6f4e9a4717d3db0ed6bcd15e3db697541ca3a1ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-9862: two-file test/docs-only correction arms exact aggregate-queued eligibility observer before send, retains full event equality, rejects every premature non-queued stage, preserves TTL delivered/dropped receipts and expired-input non-delivery. Direct-core fixture true eligibility matches source. Production/wire audit A-9854/A-9858 unchanged. New correction unexecuted during quiet; A-9859 remains failed, T3 migrations deferred. C1–C3 runtime pending exact-head mode-free droplet verification; all done marks restored. Preserve raw receipts and future Web timing attribution; after-stage QA separate.

### rev-23 · 2026-10-23T05:54:09.575Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1125-final
commit: 6f4e9a4717d3db0ed6bcd15e3db697541ca3a1ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C3, no findings. A-9867: exact-head A-9866/a0826355 passes2673 ordinary tests/398 files,0 fail/skip/cancel; Linux T1 + all-T2 fallback both packages + Web. All five withdrawal top-level cases/three subcases pass, max parent3.078612050s below4s trigger; no allowance. Ordering/refusal/reload and partial-injection/visibility exclusions plus migrated T1/T2 observers pass. Host check reused, generic budgets/lint/ratchet report-only, no load repetitions or T3/T4. Changed native/stdio T3 expectations remain explicitly unexecuted/deferred, not inferred from this pass. Prior failed A-9855/A-9859 stay failed; source audits stand. After-stage QA/live adoption separate.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1125 · 2026-10-23T05:54:45.937Z

Ready at 6f4e9a4717d3db0ed6bcd15e3db697541ca3a1ff after Reviewer final clear and C1–C3 verified. Same-head mode-free droplet a0826355 green: 2673/2673 across T1/all-T2/Web; host check reused, generic budgets/lint report-only. A-9866 raw log; A-9867 final review. New Web parent max3.079s, no >=4s allowance needed. Fetched origin/dev0667d56c; merge-tree conflict check exit0/tree459b34fc, branch unchanged and clean. Reported ready to Coordinator; retaining claim for merge queue. T3 native/stdio migrations deferred/unexecuted; after-stage QA separate.

### coord · 2026-10-23T05:58:46.054Z

Merged a1a62e03c6a038802f182b71240743d0081506bb onto dev.
