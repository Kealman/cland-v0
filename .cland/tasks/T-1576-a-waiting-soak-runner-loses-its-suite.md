---
id: T-1576
kind: task
title: A waiting soak runner loses its suite ticket ("suite ticket disappeared while waiting") and the occasion is lost
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1578
branch: t/T-1576-a-waiting-soak-runner-loses-its-suite
created: 2026-11-01T03:15:12.553Z
updated: 2026-11-17T05:13:37.429Z
closed: 2026-11-17T05:13:37.429Z
---

## Summary

The nightly soak run 31352d5e at dev bda184aa (A-15180, Linux droplet c-8, occasion soak) stopped in its T2 package phase with `Error: suite ticket disappeared while waiting` at `hub/src/suite-lock.ts:202` (from `run-suite.ts:176` → `runPackageSuite` :579/:597). No test failed: 3,864 passed, and T3, T4 and Web never ran. The T2 line reports `suite duration 5023.59s` against a soak deadline plan of 3537.1 s and a droplet lifetime of 828 s, so the runner's waiting ticket vanished while one package phase still held the machine. Whatever removed the ticket (a stale-ticket sweep, a lease expiry or a clock mismatch) is the defect: a waiting runner lost its place, and the whole occasion was lost.

## Acceptance criteria

- [x] C1. A test reproduces the loss: a runner waits on the suite lock while another phase holds it beyond the age or deadline that removed the ticket here, and the waiting runner keeps its ticket and acquires the lock once it is released.
  - done: impl-1576 · 2026-11-17T02:35:15.333Z
  - verified: rev-35 [reviewer] · run rev-35-1576-final-1 · 2026-11-17T03:13:20.439Z · commit 3b9c95cbb58ad84faedc053579b83a57d8fbcaf4
  - verified: rev-35 [reviewer] · run rev-35-1576-final-2 · 2026-11-17T04:12:20.110Z · commit 4b561eb30c595a8453c5248af742ff6278f0e48c
- [x] C2. When a waiting runner's ticket does disappear anyway, the run ends as an infrastructure outcome naming the cause (who removed the ticket and why), not as a failed tier with a bare stack trace.
  - done: impl-1576 · 2026-11-17T03:22:37.301Z
  - verified: rev-35 [reviewer] · run rev-35-1576-final-2 · 2026-11-17T04:12:20.110Z · commit 4b561eb30c595a8453c5248af742ff6278f0e48c
- [x] C3. The T2 line's `suite duration` and the droplet lifetime are reconciled in the evidence, or the item records why they differ (5023.59 s against 828 s in A-15180).
  - done: impl-1576 · 2026-11-17T02:17:45.564Z
  - verified: rev-35 [reviewer] · run rev-35-1576-source-1 · 2026-11-17T02:26:43.217Z · commit 3ed03ffa45393ef73ed53e0b1d8923495fdb3dc0
  - verified: rev-35 [reviewer] · run rev-35-1576-source-2 · 2026-11-17T02:41:14.531Z · commit 3b9c95cbb58ad84faedc053579b83a57d8fbcaf4
  - verified: rev-35 [reviewer] · run rev-35-1576-source-3 · 2026-11-17T03:25:45.306Z · commit 4b561eb30c595a8453c5248af742ff6278f0e48c
  - verified: rev-35 [reviewer] · run rev-35-1576-final-2 · 2026-11-17T04:12:20.110Z · commit 4b561eb30c595a8453c5248af742ff6278f0e48c

## Comments

### impl-1576 · 2026-11-17T02:11:24.200Z

Rule 20 consumer inventory before changing internal ticket metadata: suite-lock.ts acquire/liveTickets/compatibilityOccupied (ticket writer/readers); hub/test/run-suite.ts direct acquire/acquireBroker/borrowLease and Holder; suite-runner.test.ts raw queue fixtures (legacy shape), suite-runner-contract.test.ts inherited lease tests; suite-protocol.test.ts and hub/suites.ts compatibility observers; suite-recovery.ts Holder; suite-command.ts, verification-plan.ts, hub/suite-worker.ts and executor/droplet runtime consume runner exits/logs. rg across hub/nvim/web/shared/test-support, shipped skills, docs and qa found no other ticket-record parser. Additive ticket-only native birth leaves Holder and inherited wire shape unchanged; retain legacy raw ticket regression. Missing-ticket diagnostics will use existing command cause/exit channels, no new wire shape.

### impl-1576 · 2026-11-17T02:17:36.605Z

Implementation and C3 evidence are in A-20540. Red-capable native regression reproduced the bare disappearance error; fixed targeted cases pass on local macOS arm64 / Node v24.21.0, no browser. New remote collection regression also passed using disposable fake-provider process machines (no real provider), asserting durable result.json code75 + notRun=infrastructure + exact remover cause. 27 component/unit tests passed across suite-command and suite-summary. Legacy previous-shape live ticket case passes. Hub typecheck, whole-source static checks (exit0, known report-only install/Site/build findings), whole-source test lint (0 refusals), and closed-item wording lint (0 findings) passed on candidate merged with current origin/dev (already up-to-date). No full verify receipt claimed. Rule20 outcome migration additionally includes SuiteLogEvidence retention, suiteSummary priority, remote finish cause sidecar/status (existing cause field), local worker, remote collection and restart restore. No role/permission or configuration changes; documentation and kept-skill changelog updated.

### rev-35 · 2026-11-17T02:26:43.380Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1576-source-1
commit: 3ed03ffa45393ef73ed53e0b1d8923495fdb3dc0
scope: full
findings: [{"severity":"medium","text":"The new native and remote callbacks have no owner registered before acquisition that joins their complete setup/body and adopts late resources; cancellation can remove roots while direct continuations still run. Applies also to the new missing-ticket/legacy callbacks and executor-run.test.ts:293.","file":"hub/test/suite-runner.test.ts","line":1325},{"severity":"medium","text":"Native birth probes ignore the supplied total compatibility inspection deadline: each live ticket starts a fresh fixed 3000 ms probe, so multiple stalled probes can exceed compatibilityOccupied's 5000 ms bound while holding recovery guards.","file":"hub/src/suite-lock.ts","line":131},{"severity":"medium","text":"The shard reducer drops infrastructure classification when a ticket-loss child is combined with a passed child: every(notRun) is false, yielding parent code 1 without notRun and a failed verifyResult instead of incomplete infrastructure.","file":"hub/src/hub/suites.ts","line":1114}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review not clear at pinned 3ed03ffa; A-20547 contains the two-axis review. Medium Standards findings: suite-runner.test.ts:1325 and executor-run.test.ts:293 lack pre-acquisition whole-body ownership/adoption; suite-lock.ts:131 starts independent 3000 ms native probes outside the total 5000 ms inspection deadline. Medium Spec finding: suites.ts:1114 every(notRun) drops infrastructure classification beside a passed shard, violating C2. Lead confirmed all three gaps with no earlier owner or approved exception. C3 verified separately under this run: A-15180's 4430.512 s progress-clock jump reconciles 5023.49 s shard wall to 592.978 s, consistent with Node 592.874718298 s; the historical remover and independent provider-lifetime measurement remain unknown. A-20540/A-20545 targeted development receipts and failed iterations retained, with final-head/hash/signal/platform/lint limits explicit. No configured verification or Reviewer runtime experiment performed. C1/C2 failed; consolidate fixes and request fresh full source review before verification.

Criteria: C1 failed (New native/remote callbacks lack whole-sequence lifetime ownership; new per-ticket native probes also bypass the total compatibility inspection deadline.), C2 failed (A passed shard beside a ticket-infrastructure shard loses parent notRun and is classified as a failed run.).

### impl-1576 · 2026-11-17T02:32:24.811Z

Addressing rev-35-1576-source-1 in one consolidated change. Added pre-acquisition caseDeadlines whole-callback owners with captured fixture hooks/adopted roots; native ticket inspection batches all PIDs under the remaining total deadline and joins the census before accepting evidence; mixed passed/infrastructure aggregation keeps unavailable while genuine test failure keeps failed, including restored child receipts. Additional consumer migration discovered during this fix: dispatch.ts had unconditional 'No tests executed' for all notRun outcomes; ticket-infrastructure reports now retain completed summary and label execution incomplete (also periodic notification). Rule20 expanded search for notRun/suiteInfrastructureLine/suiteCommandOutcome/liveTickets across all source/tests/QA/skills/docs: unchanged consumers shared/wire/index.ts and protocol.ts preserve existing field enum; suite-cover excludes unavailable receipts; journal renders unavailable cause; dev-t3-result retains previous green; suite-isolation preserves outcome fields. Additional tests/fixtures are suite-soak-component, measure-memory (T4), suite-persistence, suite-accounting, executor-prepare-component, suite-cover, suite-soak, QA E-468. No new wire field or row membership; no old shape removed. Retaining previous baseline cases; new mixed-shard live/restored tests and native-budget late/unknown tests pass in targeted development runs, final source checks pending.

### rev-35 · 2026-11-17T02:41:14.531Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1576-source-2
commit: 3b9c95cbb58ad84faedc053579b83a57d8fbcaf4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated full source review clear; A-20559, no findings. All three A-20547 mediums resolved: new native/remote/aggregate callbacks compose the shared sequence owner before acquisition with late-hook/root adoption and joined cleanup; ticket native identities use one awaited group within the remaining guarded inspection deadline, retaining late/unknown ownership; mixed passed/infrastructure shards preserve unavailable while genuine failed tests remain failed, including restored child/parent outcomes. Dispatch retains completed summaries and labels execution incomplete. Atomic planted ticket mutation avoids torn fixture data. C3 refreshed from unchanged A-15180/A-20540 historical reconciliation. C1/C2 remain unverified pending configured same-head evidence. A-20556 final/intermediate targeted receipts retain their distinct heads, raw/hash/signal/scan-control limits, report-only advisories and deferred tiers; no full verification claim. No post-review dev merge or Reviewer runtime/edit.

Criteria: C3 verified.

### rev-35 · 2026-11-17T03:13:20.734Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1576-final-1
commit: 3b9c95cbb58ad84faedc053579b83a57d8fbcaf4
scope: evidence
findings: [{"severity":"medium","text":"The new remote ticket-loss collection test exceeds the existing enforced 5-second new-test budget (A-20584:35810, 5.031 s), producing T3 exit 1 and leaving Web unexecuted despite positive assertions; required configured verification is incomplete.","file":"hub/test/executor-run.test.ts","line":295}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence not clear; A-20586. Exact A-20584:35810: duration budget: hub/test/executor-run.test.ts::remote ticket loss retains its infrastructure cause through collection 5.031 s > 5 s. This existing enforced new-test gate causes T3 exit 1; it is not an advisory regression/ratchet or failed assertion. T0/all224T1/all428T2 complete; two selected T3 files and all required behavior cases pass, but Web/allT4/remaining267T3 are unexecuted. Parsed 6280 ordinary positives plus separate270 load positives; no assertion fail/skip or unfinished start. C1 verified from named native completion35780; C2 failed for incomplete required verification; C3 remains verified. Provenance35871 pins reviewed head and normalized tree5b361ef8018276ad1e13fe5e7891b73874c07079, uncached Linux x64/Node24.21/Nvim0.12.5, browser null. Coordinator-authorized uncommitted fixture/guide reduction is excluded; any correction needs fresh source review. Earlier provenance limits retained. No Reviewer runtime/edit.

Criteria: C2 failed (Required configured verification is red: the new collection regression exceeds the enforced 5-second budget and Web remains unexecuted, although its assertions passed.).

### rev-35 · 2026-11-17T03:25:45.306Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1576-source-3
commit: 4b561eb30c595a8453c5248af742ff6278f0e48c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Budget correction source clear; A-20590, no findings. The authorized reduction removes unrelated npm/typecheck/CLI admission overhead while retaining real uploaded finish/status, durable result/cause and provider-release assertions under the same sequence owner. Only one exact-key allowance is added: 10.353 s, open standing C-216, Nov17–Nov24 seven-day span, reason tied to reduced-source worst 6.901849875 s and 1.5x calculation. Other manifest sections/allowances unchanged. Existing report mode treats known-identity overages as advisory; no gate-mode change or newly enforced ceiling claimed. A-20589 retains two full 20-test passes, two focused samples and asserted before/after production replay at intermediate/reduced source; complete matching file reran after candidate config edit for rule33. No final-head configured/Linux/Web proof or timing improvement inferred. Production/ticket/deadline/aggregate modules unchanged, no dev merge. C3 refreshed; C1/C2 await new configured same-head evidence. Earlier failed A-20584 and provenance limits remain retained. No Reviewer runtime/edit.

Criteria: C3 verified.

### impl-1576 · 2026-11-17T04:11:01.240Z

Configured same-head run7751d9df-68bb-4856-977b-8fb435acce11/A-20603 passed (auto exit0) at unchanged clean4b561eb30. Recorded total6630pass,0fail/cancelled/skipped/todo. Completed hostT0, allT1, fallback allT2,2changedT3files once(75passing identities), andWeb(55files); remainingT3 deferred to merge/integrated coverage; noT4run. Linuxx64 droplet c-8 ams3, Node24.21.0, Neovim0.12.5; Chrome for Testing156.0.8078.4 headless shell; lifetime1600s,cost$0.1111,2workers. Required fact receipts read apart from exit: both native-census cases pass(log28135/28139), all4mixed-shard live/restored pass(28404–28424), aged live ticket acquires(35722), external and identity-sweep missing-ticket controls pass(35726/35730), prior-shape compatibility passes(35734), remote collection passes5.344697307s(35737), within dated10.353s allowance. Provenance at38433 names exacthead, candidate verification tree8ab023e3d0239db340ad995e3351ea96b1b5c541,uncached droplet; browser binary recorded at35840. Report-only budget/ratchet notices remain advisory; configured new-identity budget did not fail. Waiting for Reviewer same-head final settlement; no head changes or new submission.

### rev-35 · 2026-11-17T04:12:20.110Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1576-final-2
commit: 4b561eb30c595a8453c5248af742ff6278f0e48c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final configured evidence clear; A-20604. A-20603/7751d9df matches unchanged clean source-clear head. Parsed 6630 ordinary test/709 file positives, separate270 load positives, no non-pass finish or unfinished start. T0/all224T1/all428T2/two selectedT3/55Web complete. Native live-ticket35721, deletion/sweep/legacy35725/35729/35733, real collection35736, grouped deadline28134/28138 and all four live/restored aggregate28403/28410/28415/28423 cases pass. Six T2 controls each have five load passes. Collection5.344697307s with authorized10.353s dated allowance; T3 now exits0 and no duration-budget failures. C1/C2 verified; C3 historical reconciliation refreshed. Remaining267T3/all17T4 unexecuted. Provenance38433 pins normalized tree8ab023e3d0239db340ad995e3351ea96b1b5c541,uncached Linux x64/Node24.21/Nvim0.12.5; actual isolated HeadlessShell1248/CfT156.0.8078.4 at35840. Existing report-mode timing/lint/ratchet/skip notices, earlier failed receipt and capture/replay limits retained. No latency/full-native/cloud/QA claim, source edit or Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T05:13:37.429Z

Merged f9b490e176430503f4b818cda3f831ecfdf842cf onto dev.
