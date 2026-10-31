---
id: T-1503
kind: task
title: A merge-queue landing never notifies the session that enqueued the item
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1268
branch: t/T-1503-a-merge-queue-landing-never-notifies-the
created: 2026-10-31T08:09:11.590Z
updated: 2026-10-31T15:24:31.258Z
---

## Summary

When the merge queue lands an item, the Coordinator that enqueued it gets no delivery. The journal records `task-merged` and the announced `T-n closed` event, but nothing reaches the enqueuing session, so it sleeps until the next heartbeat.

## Evidence

- T-1502 was enqueued by coord at 06:53Z on 2026-10-31. The batch result reached coord at 06:59:37Z. Then `task-merged` (rowId e567a951) and the announcement `T-1502 closed` (rowId 81b5f837) were written at 06:59:40Z. The journal has no `acked` or `injected` for either toward coord.
- coord stayed idle until the 07:37:19Z heartbeat showed `In flight (0)`. The 0.3.1 release cover was submitted 38 minutes after the landing.
- This is the same class as the 2026-10-19 one-hour stall: no event may wake the Coordinator after a landing.

## Acceptance criteria

- [x] C1. A landing from the merge queue delivers one report to the enqueuing session and to the item's claimant, in the item topic, naming the item, the landed commit and the batch.
  - done: impl-1503 · 2026-10-31T15:00:47.366Z
  - verified: rev-26 [reviewer] · run rev-20261031-1503-evidence-1 · 2026-10-31T15:24:30.709Z · commit 2fcd2ffd8f3b62d23f8f94cf69746cddc5586baa
- [x] C2. A test enqueues an item from a fake Coordinator session, lands it through the queue and asserts exactly one delivered landing report. Before the fix, the test asserts that none arrived.
  - done: impl-1503 · 2026-10-31T14:47:12.259Z
  - verified: rev-26 [reviewer] · run rev-20261031-1503-evidence-1 · 2026-10-31T15:24:30.709Z · commit 2fcd2ffd8f3b62d23f8f94cf69746cddc5586baa

## Comments

### impl-1503 · 2026-10-31T14:45:23.340Z

Consumer audit: landing notice adds an ordinary report, no reply/schema changes. Producers: dispatch.ts batch land callback, TaskMerges.merge result and merge-batches.ts retry/completion flow. Consumers searched by task-merged, merge-batch-result, MergeQueueEntry, noticeTo, BatchBoundary.land across hub/web/nvim/shared tests, qa/briefs, docs and .agents: batch reports and suite/accounting reports unchanged; CLI merge replies, queue/snapshot readers and legacy wire shapes unchanged. Existing HubCore.noticeTo owns durable message/delivery deduplication. Test seam per C2: projectHub public merge frame with fake Coordinator, fake executor and sealed landing boundary.

### impl-1503 · 2026-10-31T14:48:46.742Z

Consumer audit correction M1: frozen help composition in hub/test/fixtures/cli-usage/commands.json is also an owning consumer of MERGE_USAGE (cli-usage-fixture.ts composes exports.json and help.txt). Updated only that row after complete compatibility and native help guards reproduced red. Green compatibility 1/1 and native help 5/5; command-help 18/18 and native usage-merge 2/2 pass. All local macOS, isolated native help/Git roots, no browser.

### rev-26 · 2026-10-31T14:50:53.919Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1503-source-1
commit: 1facd75311589db125ec9beca6dc28339f58a3fd
scope: full
findings: [{"severity":"medium","text":"M1: changed MERGE_USAGE lacks owning frozen commands.json row migration, breaking unchanged compatibility/native help expectations. Preserve complete red/green and update only owning metadata.","file":"hub/src/cli/usage/merge.ts","line":2},{"severity":"medium","text":"M2: report obligation exists only after awaited merge; crash after durable close loses it because recovered batches skip isLanded entries and claim/queue are released. noticeTo null is ignored. Persist/reconcile captured landing report obligation and settle only on durable notice; prove crash/reopen and missing-notice retries.","file":"hub/src/hub/dispatch.ts","line":326},{"severity":"medium","text":"M3: captured session IDs become names before awaiting merge and fallback to old names; rename/reuse can lose or retarget delivery. Keep durable IDs through synchronous notice admission; prove held-landing rename/reuse and shared-recipient dedup.","file":"hub/src/hub/dispatch.ts","line":318},{"severity":"medium","text":"M4: new full fixture/hub/UI/spoke setup has no separate pre-registered deadline/acquisition owner; projectHub cleanup registers only after startup. Compose shared owner before root work, retain/join late acquisitions, add omitted/aborted controls and pre-own held work release/join.","file":"hub/test/merge-queue.test.ts","line":573}]
finding_counts: {"high":0,"medium":4,"low":0}

A-14885 consolidated full source not clear M1–M4. New happy-path fake Coordinator queue/native channel test is a valid sealed-Git component seam, but does not establish recovery/identity/lifecycle guarantees. Reported local32/32/typecheck/lint receipts remain partial evidence; no reviewer tests run. Lead working-tree M1 red/green and proposed M2/M3 changes are separate from this frozen head. Complete all fixes together, preserve original raw native output/tree identities and request fresh pushed-head source review before configured verify. C2runtime-unverified; no dev merge authorized.

Criteria: C1 failed (Landing report is not durably recoverable after close and can lose or retarget captured recipients across a rename.).

### impl-1503 · 2026-10-31T14:54:03.910Z

M2/M3 consumer extension: new internal MergeLandingReports consumed only by dispatch queue startup/entries/changed/land; captures pending obligations before merge and compares persisted merge receipt tip+branch and closed state before report. New HubCore.noticeToSessions is used only by that owner; existing noticeTo, public protocol and clients remain unchanged. Pending meta is not part of wire snapshots. Legacy hubs/stores without the optional meta key mean no pending reports. New tests retain original wire-compatible report shape and use real session delivery. M4 uses existing caseDeadlines rather than a new fixture owner; complete shared owner file passed 2/2 local macOS, and full queue file passed 36/36. No browser, native merge sealed/fake executor. Typecheck passed again.

### rev-26 · 2026-10-31T14:59:12.318Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1503-source-2
commit: 7be169ec16d391909612c44d166842870c60c9ea
scope: full
findings: [{"severity":"medium","text":"M5: captured obligation survives positive prelanding refusal/rebuild; same-head re-enqueue in new batch leaves two matching obligations and duplicate batch-keyed reports. Retire only proven nonlanding attempts, preserving uncertain/recoverable effects; retain refused-retry control.","file":"hub/src/hub/merge-landing-reports.ts","line":17},{"severity":"medium","text":"M6: any unresolved captured id blocks every recipient. Human CLI id=human has no session row, preventing claimant report; missing/pruned claimant blocks known requester. Admit/settle available IDs independently under same durable report, human topic receipt, unresolved delivery retained; prove later reconnect one delivery each.","file":"hub/src/hub/core.ts","line":2021}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14901 consolidated source2 not clear only M5/M6. M1–M4 closed: owning help row, durable premerge obligation/reopen/null-notice recovery, captured-ID rename fence/shared dedup, shared caseDeadlines acquisition/drain composition. Lead self-audit reports refused-retry red2!=1 and human enqueue red0!=1 with subsequent working-tree corrections; they do not change this frozen head. No additional findings. Complete fixes and fresh exact pushed-head source review before configured verify. C2runtime-unverified; local36queue/shared2/static receipts summarized A-14893 remain partial and preserve interrupted predecessor.

Criteria: C1 failed (A refused/re-enqueued same head can report twice, and an unavailable recipient or human CLI actor prevents known recipients from being notified.).

### impl-1503 · 2026-10-31T15:00:21.687Z

Source3 M5/M6: definite pre-landing refusal/base rebuild retires its pending attempt; source2 red refused-retry produced two reports, corrected green produces one. Human enqueue red blocked claimant (0 vs1), fixed by topic receipt without synthetic human-session recipient. New Store.appendNoticeRecipients internal consumer is only HubCore.noticeToSessions; owner callback now returns durable message id + pending IDs, retaining unresolved IDs and admitting others independently. Store extends same report/identity-bound deliveries, updates thread run and binds progress, publishing only new recipients; no wire/schema change. Startup missing-recipient red0 vs1 at source2; corrected test receives requester first then late recipient with same message id, one channel event each. Final full queue file 38/38 local macOS/fake executor/no browser/native merge sealed. Native help guards remain green from M1. No dev merge after review.

### rev-26 · 2026-10-31T15:03:23.374Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1503-source-3
commit: 2fcd2ffd8f3b62d23f8f94cf69746cddc5586baa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14907 source3 clear, M1–M6closed. Definite nonlanding refusal/rebuild retires only that attempt; recoverable/unknown effects retain obligation. Human topic receipt and independent captured-ID settlement let available recipients receive one stable report; later recipients append only missing durable delivery without repeating requester. Store mutation+pending settlement atomic, publication aftercommit. Existing rename/reuse/shared/null-notice/crash-image/deadline controls retained; new refused/human/late-recipient assertions meaningful. Local38queue/typecheck/lint0reported inA14902/topic, report122/59/0refusals/T1484advisory retained; no reviewer execution/fullsuite/nativeGit/cloud claim. C1/C2done/runtime-unverified. One configured mode-free verify at frozen2fcd2ffd8, then original-record evidence review; preserve original raw generated-case/native-exit outputs.

### rev-26 · 2026-10-31T15:24:30.709Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1503-evidence-1
commit: 2fcd2ffd8f3b62d23f8f94cf69746cddc5586baa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14933 original-record evidence clear (corrects A-14931's uncertain T4 anchor to22722→22723). Original4bf2d597/A-14928 nativeexit0 at exact source3 head;5036 complete matching start/finish identities,4447ordinary test passes+519file passes, separate35loadtest+35loadfile passes, zero adverse/duplicates/missing; five failure arrays empty. Seven generated landing/recovery cases each base1+distinct sequential load5/5. Pinned source rechecked exact item/topic/commit/batch/recipients/one-frame assertions, rename/reuse/shared/human/refusal/null-admission/startup/late-recipient same-message controls. C1/C2 verified. Component fakeGit/LocalExecutor seam, no native-dev landing claim. T0host/T1/allfallbackT2inclNeovim/selectedT4once/Web0;T3/otherT4unexecuted. Remote typecheck reusedhost. Candidate4a56dc5d vsGitd62bc differs only1525excludedtracker/rulespaths. Linuxx64 dropletc8lon1Node24.21/Nvim.12.5; actualisolatedShell1248Chrome156.0.8078.4;cache/occasionnull;skips[];budget/lintreportmode122/59zero refusalsT1484advisory retained. Coordinator5606bfbb disposition preserves original head evidence; authorized later devmerge/delta and Coordinatorverifyall still outstanding, no new-head green claim.

Criteria: C1 verified, C2 verified.
