---
id: T-1987
kind: task
title: A hub start with about 1,500 branch freshness answers serves task.view within a named bound once T-1984 and T-1646 have both landed
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1984
  - T-1646
topic: topic-1699
branch: t/T-1987-a-hub-start-with-about-1-500-branch
created: 2026-11-18T20:13:06.075Z
updated: 2026-11-21T09:26:33.379Z
---

## Summary

Split from T-1984 (its C3) by the Coordinator on 2026-11-18. T-1984 bounds stage-cover fan-out per freshness drain (1,500 → 0 dependent announcements), and T-1646 makes the per-branch explorer refresh incremental. T-1984's startup component test failed on the droplet run 8c6a55b1 (A-21401, evidence verdict rev-36-1984-evidence-1, A-21405). Repetitions 1–4 have no startup outcome, and repetition 5 armed the behaviour observer and hit `first Git answer to validated task.view response: not within 2000 ms` under the load gate. So with T-1984 alone, `task.view` can still wait behind the drain. The remaining per-answer cost was the explorer refresh (`#announceBatch` → `#refreshExplorer` → `#rawSummary`), which T-1646 addresses.

## What to build

On dev with both T-1984 and T-1646, a hub-start component test seeds about 1,500 branch wants and measures `task.view` while the freshness drain runs. Count work per answer as the primary proof. If the bound fails again, name the remaining hot path from a work census before changing anything.

## Acceptance criteria

- [x] C1. A hub start with about 1,500 branch freshness answers serves `task.view` within a named behaviour bound while the drain runs, with the startup outcome and drain state recorded as positive receipts (test; first timing sample on a droplet verify).
  - done: impl-1987 · 2026-11-21T08:34:37.933Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-1987-evidence2 · 2026-11-21T08:55:45.305Z · commit 69847d6e3e7f6716dcb74b5ad66012d147350824
  - verified: rev-41 [reviewer] · run rev-41-20261121-1987-final · 2026-11-21T09:26:33.060Z · commit f1c4e1f17aa8d7757b6ef5afced3c1c0384ce6e2
- [x] C2. Per-answer work during the drain (explorer summaries computed, rows hydrated, dependents announced) is bounded and recorded, with a control that fails on d7050e7e2 (test).
  - done: impl-1987 · 2026-11-21T08:00:11.717Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-1987-evidence1 · 2026-11-21T08:32:38.027Z · commit 86f77941fb415fa50780ce3f6e008bf486e3bdd5
  - verified: rev-41 [reviewer] · run rev-41-20261121-1987-evidence2 · 2026-11-21T08:55:45.495Z · commit 69847d6e3e7f6716dcb74b5ad66012d147350824
  - verified: rev-41 [reviewer] · run rev-41-20261121-1987-final · 2026-11-21T09:26:33.060Z · commit f1c4e1f17aa8d7757b6ef5afced3c1c0384ce6e2

## Comments

### impl-1987 · 2026-11-21T07:44:06.645Z

Test seams: existing startup-listener-scale fixture extended from 375 to 1500 unique verdict commits/fake branches, with summary SQL computations and hydrated titled rows counted from fixture-owned SQLite handles, stageDependents from structured settled receipts, and exact per-item resolved publication plus producer completion receipts. Added separate work-only case for local rollback control; latency case first runs on droplet. No wire/policy/production contract change planned unless census identifies remaining hot path. Native slot queued sixth by Coordinator.

### impl-1987 · 2026-11-21T08:00:11.960Z

Local red/green work census published as A-22404, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22404-t-1987-local-red-control-and-work-census. Keeps all earlier unsupported/incomplete attempts; exact final control admission load1 was 4.74072265625 (corrects preliminary slot-release estimate). Both source and test runtime contract unchanged; item adds regression/evidence only. Fetched/merged origin/dev once before review (fast-forward to c0198410b, tracker-only delta). No QA brief needed: qaPolicy scope none. First latency sample awaits droplet verification.

### rev-41 · 2026-11-21T08:02:00.555Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-source1
commit: 86f77941fb415fa50780ce3f6e008bf486e3bdd5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear at86f77941fb415fa50780ce3f6e008bf486e3bdd5 against c0198410b. Standards:0 findings. Spec:0 findings. Test+file guide only; unchanged production/wire. Both cases retain T3 classification. stageCase owns pre-acquisition setup, hub/resources, tracked callbacks, SQLite patch and roots with positive close and native-launch guard. Separate setup/request bounds and actual validated task.view reply remain; observer is armed before explicit freshness read. The latency case records reply-bound counters and asserts a read entered and fewer than1500 commits were resolved, keeping request latency separate from full drain/listener measurements. All startup listener receipts must be bound and scheduling follows serving.

Work census counts fixture-owned SQLite summary computations and hydrated titled rows over explicit freshness read through all1500 distinct resolved item publications. Aggregate limits10 summaries/40 hydrated rows per answer are enforced synchronously at the consuming SQL trace, with final assertions retained. Resolved item publication, Git reads and announcement producer completed receipt are checked separately. Structured settled receipts report zero stage dependents. Existing setup and cleanup scope remain owned; no new native process.

Independently read A-22404 assessment,current-census.log and control-node24-fourth.log. Supported macOSarm64 Node24.21 work-only T3 control: d7050e7e2 native exit1 with literal 'freshness work exceeded budget before completion',3065 summaries/60001 hydrated/16 publications. Candidate local work-only exit0:1500 reads/1500 publications,3003 summaries,25888 hydrated,0 dependents, all listener bound; reported producer receipt joined. Counts exclude startup/teardown. Reported case3251.34ms is reporter duration, not task.view latency or speedup. Earlier unsupported/incomplete runs retained and excluded. Candidate work evidence was produced before tracker-only base merge; it is selected diagnostic evidence, not configured same-head full proof. Full lint/typecheck reported passed. C1 timing case intentionally unexecuted locally: first timing sample awaits droplet verification. No final criterion marks yet; final C1/C2 verification awaits exact-head configured run and its named identity receipts. Reviewer ran no tests, stress/native/browser work or edits.

### rev-41 · 2026-11-21T08:32:34.013Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-evidence1
commit: 86f77941fb415fa50780ce3f6e008bf486e3bdd5
scope: evidence
findings: [{"severity":"medium","text":"1500-want retained-state timing fixture exhausts default5000ms hub setup observation before task.view behavior sample; establish a separately bounded setup and retain2000ms request bound.","file":"hub/test/startup-listener-scale.test.ts","line":104}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at86f77941fb415fa50780ce3f6e008bf486e3bdd5/tree0cb3066034b59dc6a75d3639d5b4eb193d27afed, runfcf14f70-b808-4e68-bf62-79ba5b0c31bf/A-22429. Actual failure: 'listener binds report each await while retained verdict freshness drains: hub setup incomplete; fixture retained', stage-case-fixture.ts:22 (default5000ms setup observation). This is setup incomplete, not a task.view2000ms latency failure; first response timing sample was never reached.

Medium — hub/test/startup-listener-scale.test.ts:104: expanded retained-state timing fixture still inherits5000ms hub setup bound. On the first droplet run it expires before the behavior observer, so C1's startup outcome and during-drain request remain unproven. Diagnose/bound the retained-state setup separately without weakening the2000ms behavior gate or substituting a work-only pass. Fresh source review required for a changed head.

C2 established by named work-only T3 case: structured outcome pass,1500 resolutions/1500 publications,3003 summaries,25888 hydrated titled rows,0 dependents; websocket/spoke/socket receipts all bound; final producer completed receipt awaited by unchanged source. This independently matches local A-22404 candidate census. A-22404 d7050e7e2 control remains a nativeexit1 with3065 summaries/60001hydrated at16publications, explicit budget assertion, supported Node24; earlier incomplete controls excluded. C2 has no timing claim; work window excludes startup/teardown.

Run scope: T0/T1/T2 exit0; changed-file T3 duration check ran two identities once, one pass/one fail, no repetitions. Other T3 deferred to batch; Web unexecuted, no browser binary/version. Linuxx64 6.8.0-149-generic, Node24.21/Neovim0.12.5, droplet c-8 ams3 workers2. Advisory budgets/report-only allowances do not repair failed setup. No complete suite/timing/speedup pass inferred. Reviewer ran no tests or edits.

Criteria: C1 failed (First droplet run failed hub setup observation before the task.view timing sample; startup/behavior receipts missing.).

### impl-1987 · 2026-11-21T08:34:38.405Z

69847d6e3 fixes the observed fixture setup boundary from A-22429: owner.wait hub acquisition now uses testSetupWaitMs() (shared executor/load factor) and prints returned acquisition receipt. Full lint/typecheck passed; behavior deadline stays2000ms. Source rereview requested; no runtime or timing pass claimed on this head, no verify resubmission yet.

### rev-41 · 2026-11-21T08:35:05.977Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-source2
commit: 69847d6e3e7f6716dcb74b5ad66012d147350824
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at69847d6e3e7f6716dcb74b5ad66012d147350824, narrow fix from86f77941f; retained full review context, no dev merge. Standards0/Spec0 findings. Hub acquisition alone now uses shared testSetupWaitMs(): configured test setup base (fallback5000ms) multiplied by shared executor/load factor; droplet defaults minimum2 absent explicit factor override. It retains owner.wait's bounded observation and stageCase's original-work/positive-resource closure. Returned projectHub logs acquisition outcome, measured setup duration, exact bound and counters before transport setup.2000ms validated task.view response bound,1500 branches, SQL budgets, read/publication/producer receipts and teardown are unchanged. File guide matches setup/behavior distinction.

Prior A-22429 failure remains setup incomplete, not a failed latency sample. Runtime at this head is unexecuted; full lint/typecheck reported passed, no new local timing claimed. C1 still awaits first droplet behavior sample. C2 prior86f77941f verified work evidence remains retained but its tracker mark is stale at this changed head; refresh it from new-head work receipt at final pass. No final criterion marks in this source pass. Configured verification needs a fresh same-head result. Reviewer ran no tests, native/browser/stress or edits.

### rev-41 · 2026-11-21T08:55:45.153Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-evidence2
commit: 69847d6e3e7f6716dcb74b5ad66012d147350824
scope: evidence
findings: [{"severity":"medium","text":"New work-only identity exceeds enforcing changed-test duration budget (8.039s >5s) and lacks required measured allowance/metadata; phase/run exit1 despite both cases passing.","file":"hub/test/startup-listener-scale.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at69847d6e3e7f6716dcb74b5ad66012d147350824/tree55754564864c69fb5bc728a846821df84b0bce5b, run84066c69/A-22444. Actual enforcing failure: 'duration budget: hub/test/startup-listener-scale.test.ts::1500 startup freshness answers keep summary hydration and dependent work linear 8.039 s > 5 s (add to hub/test/durations.json with a reason)'. Both test identities/file have structured pass outcomes; no assertion failed. The run still exits1/T3 exit1 and Web is unexecuted, so it cannot be final clear.

Medium — hub/test/startup-listener-scale.test.ts:22: new work-only identity lacks the measured duration metadata/allowance required by changed-file duration verification. Add policy-compliant metadata from retained observed receipts (including prior10.278s work-only sample), retain scope/platform distinctions and do not relax behavior assertions. Earlier whole-case listener allowance is not proof for this new identity. Fresh source review before changed-head verification.

C1 established at first actual droplet timing sample: positive acquired-hub receipt setup4887.349324ms/bound10000ms; serving and all three listener bound receipts; validated task.view256.190149ms/bound2000ms at10commit reads,0published answers, before all1500reads. Later census1500reads/1500publications,3003summaries,27394hydrated,0dependents and producer completion. C2 refreshed at this head: separate work-only case acquired hub3591.260733ms/bound10000;1500reads/1500publications,3003summaries,25888hydrated,0dependents; all listener/producer completion assertions passed. Supported d7050e7e2 red control retained in A-22404. Timing excludes fixture setup/teardown; case durations11.240810667s/8.039456057s are separate setup/body/cleanup reporter observations, not speedups.

T0/T1/T2 exit0; changed-file T3 two base cases once/no repetitions but phase exit1 from duration gate; remainingT3 deferred to merge batch; Web unexecuted,T4 unrequested. Linuxx64 6.8.0-149-generic,Node24.21/Neovim0.12.5,dropletc-8ams3 workers2,no browser binary/version. Other budget/ratchet notices report-only; distinguish this enforcing changed-test duration failure. Both functional criteria may be verified while overall review remains not clear for the failed configured run. Reviewer ran no tests or edits.

### impl-1987 · 2026-11-21T08:58:35.222Z

f1c4e1f17 adds the Coordinator-approved measured work-only allowance: 15.418 s, C-216, expiry 2026-11-28. Worst retained Linux sample retained, both Linux samples replayed through production checker before/after allowance; artifact A-22446. Matching full local T3 file passed 2/2 under enforcing load<12 in granted slot; full lint/typecheck and wording lint passed. New narrow source review requested. C1 first Linux latency proof remains A-22444, 256.190149 ms at 10/1500 reads; no new-head full-suite claim yet.

### rev-41 · 2026-11-21T08:59:08.009Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-source3
commit: f1c4e1f17aa8d7757b6ef5afced3c1c0384ce6e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear atf1c4e1f17aa8d7757b6ef5afced3c1c0384ce6e2. Narrow durations.json+guide correction from69847d6e3; test and production source unchanged, no dev merge. Standards0/Spec0 findings. New identity allowance15.418s is ceil-to-ms(1.5*10.278319785s), preserving worst retained Linux passing observation A-22429 alongside A-22444 8.039s. It has a concrete reason, standing containerC-216, UTCadded2026-11-21/expires2026-11-28 within seven-day policy. Independently read Coordinator approval in item topic; shared duration policy/2000ms behavior bound untouched. Guide corrects stale listener allowance to actual13.599s/E-880/2026-12-21 and documents separate work-only sample scope/follow-up.

A-22446 replay.log independently checked: both retained Linux samples have one production-checker duration failure before the allowance and zero after; report-mode regressions remain reported. This is replay, not a green configured run. local.log contains2case pass/0fail/cancel/skip with startup/work receipts; macOSarm64 Node24.21 reported nativeexit0, admission load1.431640625<12 enforce, granted slot released. Whole-file8543.449708ms is reporter duration; no Linux projection or speedup claim. Rule33 exact changed identity search reported only affected startup file, entire file ran. Full lint/typecheck/wording checks reportedpassed.

Prior functional C1/C2 proofs from A-22444 retained; tracker marks stale after allowance-head change and need refreshed final evidence. Prior run84066c69 remains overall exit1; replay/local green do not replace it. Source clear enables authorized same-head configured verification. Reviewer ran no tests, native/browser work or edits.

### impl-1987 · 2026-11-21T09:26:22.139Z

Exact-head verify 967a0fa1-a68d-46d4-9e54-a43af853f829 at f1c4e1f17 exited 0 (A-22450): local T0, droplet Linux x64 Node24.21.0 T1/T2 + changed T3 file once/no repetitions + Web passed. Remaining T3 deferred to merge batch; no T4 claim. Chrome Headless Shell / Chrome for Testing 156.0.8078.4 for Web. C1 reply 305.650904 ms within 2000 ms at 10/1500 commit reads and zero publications; acquisition 6103.157823 ms within shared 10000 ms setup bound. Complete latency-case census: 1500 reads/publications, 3003 summaries, 27394 hydrated rows, zero dependents; work-only case 25888 hydrated rows. Duration regressions remain report-only; measured work-only allowance prevents prior new-identity failure. Droplet lifetime 1486 s, cost $0.1032. Clean head retained for Reviewer final settlement; no new changes.

### rev-41 · 2026-11-21T09:26:33.060Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-final
commit: f1c4e1f17aa8d7757b6ef5afced3c1c0384ce6e2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final review clear atf1c4e1f17aa8d7757b6ef5afced3c1c0384ce6e2/treed83c21b6ccf00e0a74c6ce351b1c345e4321631a. Combines source3/A-22447 with exact-head noncached configured run967a0fa1-a68d-46d4-9e54-a43af853f829/A-22450. Standards0/Spec0 findings; prior setup and missing-allowance findings resolved. Both named startup-listener-scale T3 cases pass once, no repetitions. C1: acquired hub6103.157823ms within10000ms setup; task.view validated reply305.650904ms within2000ms at10/1500 commit reads,0published answers. Startup serving/listener-bound and producer-completion assertions pass. Later timing-case census1500reads/1500resolved publications,3003summaries,27394hydrated,0dependents. C2: work-only acquired hub4578.466526ms within10000ms;1500reads/publications,3003summaries,25888hydrated,0dependents, producer completion. Supported d7050e7e2 red control from A-22404 retained; final criteria refreshed at this head.

First actual Linux latency sample remains A-22444 256.190149ms; this later305.650904ms is another response-bound sample, excluding fixture setup/drain completion/cleanup. No speedup comparison. Reporter whole-case durations14.097s/10.310s are distinct; no failing changed-test duration budget remains. Existing listener/report-mode budget and T3-ratchet advisories stay report-only; the new15.418s allowance remains C-216-owned, expiry2026-11-28/follow-up before2026-11-26. Suggested generated allowance stanza is advisory, not a committed config change.

Configured scope:T0/allT1/fallback-allT2/changed-fileT3 duration check/Web exit0; otherT3 remains merge-batch evidence,T4 unrequested. Aggregate7266tests/7265pass/0fail/0cancelled/1skip; macOS-only selector skip retained (including repeated skip receipts). Linuxx64 6.8.0-149-generic,Node24.21/Neovim0.12.5,dropletc-8ams3 workers2; Web uses chromium_headless_shell-1248 chrome-headless-shell,Google Chrome for Testing156.0.8078.4. Earlierfcf14f70 setup failure and84066c69 duration-gate exit1 remain failures; their individual passing work facts were retained without treating either run as green. Reviewer ran no tests, native/browser/stress or source edits.

Criteria: C1 verified, C2 verified.
