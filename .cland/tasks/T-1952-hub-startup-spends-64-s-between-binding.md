---
id: T-1952
kind: task
title: Hub startup spends 64 s between "binding listeners" and "binding web listener", so a restart gap exceeds the 60 s bridge expiry
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1639
branch: t/T-1952-hub-startup-spends-64-s-between-binding
created: 2026-11-17T21:09:36.382Z
updated: 2026-11-19T06:11:38.901Z
closed: 2026-11-19T06:11:38.901Z
---

## Summary

Hub restart #82 (2026-11-17, pid 57331, at ca5f70ca4) had an 87 s gap between stop (21:02:34Z) and serving (21:04:01Z), over the 60 s limit after which a session's mod bridge expires. The startup journal shows 64 s from "binding listeners" to "binding web listener" (21:02:52Z to 21:03:56Z); the journal read took 6.6 s, and every other step under 5 s. impl-1950 traced daemon.ts: that step only awaits the websocket and socket edge creation, and executor recovery starts after serving, so no lease read sits inside it (topic-1605). Background I/O from T-1950's 4,202-lease reads may contend, but that is not measured.

## What to build

Find what the edge creation waits on for 64 s with a startup profile or step-level timing receipts, and bring the step within its normal few seconds. Each startup step's duration is recorded so the next long gap names its step.

## Acceptance criteria

- [x] C1. The cause of the 64 s step is named with evidence, for example a profile, per-await timings or a reproducer on a fake root with many artifacts or leases (test or artifact).
  - done: impl-1952 · 2026-11-19T02:33:38.623Z
  - verified: rev-35 [reviewer] · run rev-35-1952-source-2 · 2026-11-19T03:18:24.327Z · commit daa18bea325fe973fd6a66c9f32002a49a36bf91
  - verified: rev-36 [reviewer] · run rev-36-1952-source-4 · 2026-11-19T04:42:24.673Z · commit 4f49e5145104ced87d58adc93e6e1a72960b77c1
  - verified: rev-36 [reviewer] · run rev-36-1952-final-1 · 2026-11-19T05:07:51.604Z · commit 4f49e5145104ced87d58adc93e6e1a72960b77c1
- [x] C2. After the fix, a fixture hub with the same scale of retained state binds its listeners within a stated budget, and startup records each step's duration (test).
  - done: impl-1952 · 2026-11-19T04:40:40.922Z
  - verified: rev-36 [reviewer] · run rev-36-1952-final-1 · 2026-11-19T05:07:51.605Z · commit 4f49e5145104ced87d58adc93e6e1a72960b77c1

## Comments

### coord · 2026-11-18T06:13:51.239Z

Restart #83 (2026-11-18, dev 303b482b8, with T-1950 live): the step from "binding listeners" to "binding web listener" took 57.7 s again, against 64 s at restart #82. So the released-lease read was not the cause; T-1950's index removed readLease cost (0.4% of a 15-minute profile, down from 7–9%) without shortening this step. Every other startup step is under 6 s, and this one alone keeps hub restarts over the 60 s bridge expiry (gap 78 s at #83). Source: the hub operator session's restart report.

### coord · 2026-11-18T12:31:25.680Z

Restarts #84 and the respawn after it (2026-11-18, dev 93026cbe9, same code and tree): on pid 20702 (clean stop, then start) "binding listeners" → "binding web listener" took 2.0 s, and the gap was 50 s. Four minutes later, on pid 52877 (launchd respawn after a fatal exit without cleanup), the same step took 51.7 s and the gap was 70 s. Restarts #82 and #83 were clean stops too and took 57–64 s, so "clean versus unclean stop" isn't the whole explanation; the step varies between 2 s and 64 s on the same code. Source: the hub operator session's report.

### human · 2026-11-18T19:17:07.579Z

Restart #85, 2026-11-18 18:34:57Z, pid 62039 at d7050e7e2: 'binding web listener' took 148,145 ms (gap 175 s). Restart #86 at 19:10:48Z, pid 71467 running a343e305a code: the same step took 615 ms (gap 23 s). Earlier: 64 s (#82), 57.7 s (#83), 2.0 s (#84), 51.7 s (respawn 52877). (cland-impl)

### impl-1952 · 2026-11-19T00:45:52.297Z

Consumer search for additive hub-startup-listener-completed receipts: daemon log producer; cli/startup-diagnostic.ts reads only existing step starts; measure-memory.ts reads existing starts/serving; startup-ready-component, startup-replies-scale, startup-cleanup, startup-deadline-component and startup-diagnostic tests; docs/hub/coordinator-subscription-procedure.md. Existing step names/shapes remain unchanged, including older-hub diagnostics. No wire reply, setting or admission contract changes.

### impl-1952 · 2026-11-19T00:53:37.373Z

Preliminary red evidence published as A-21461. Full startup scale green is waiting for T-1646 to land and a new native slot (Coordinator instruction). Candidate defers scheduled freshness until serving, yields between answers, and logs each listener await including failures. T2 startup-ready-component: 6/6 pass on the uncommitted candidate, local macOS arm64 Node v24.21.0. Whole-project typecheck passes. Consumer inventory also includes every Tracker.start caller; deferFreshness is optional and defaults false so standalone trackers retain immediate scheduling. The daemon is the only opt-in caller and resumes both listening and stdio-only hubs after serving. Existing freshness workers retain stop drainage ownership over their new immediate yield.

### impl-1952 · 2026-11-19T02:18:34.905Z

Additional consumer inventory for optional onChange batch wrapper / publishTaskBatch: production createHubBase (server.ts) opts in; dispatcher guard invalidation, merge-queue reconciliation and adapter sessions retain the original per-item callback and argument. Legacy single-listener consumers in tracker-summary, merge-policy, stage-closure-component, task-worktrees, freshness and merge-recovery tests remain unchanged and exercise the previous callback shape. ItemChange and task wire frames are unchanged; no nvim, frozen CLI bytes, persisted readers or skill examples use the new optional wrapper. Inspector stack: Store.topics -> HubCore.refreshExplorerContext -> publishTask -> Tracker.announce -> announceBatch -> Freshness.settled/work. Work-count red observed 4 topics reads for a four-item batch; candidate observed 1.

### impl-1952 · 2026-11-19T02:25:48.661Z

Follow-up (S, Tech debt): hub/src/verification-tree.ts committedTree() catches every committedTreeOrThrow rejection into null, including native launch guard refusal; Tracker constructor stageTree default consumes that null as unknown. Coordinator to assess structured failure metadata under rule 39.

### rev-36 · 2026-11-19T02:44:41.688Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1952-source-1
commit: 0aea22c4a875b945f51b4ecc469d48f87717e67e
scope: full
findings: [{"severity":"medium","text":"The new bind timing wrapper logs from finally without containing sink failure. If logging throws after an edge was acquired, bind rejects before ws/spoke/edge assignment and the cleanup owner loses that listener; if acquisition failed, the diagnostic replaces the original failure. Preserve the acquired edge and original outcome through ancillary logging failure, with real edge/cleanup and bind-rejection controls.","file":"hub/src/hub/daemon.ts","line":657},{"severity":"medium","text":"The new scale callback and the batch-work-count callback in startup-ready-component.test.ts:23 acquire fixtures directly without a pre-acquisition whole-caller fence/join or separately named setup bound. Resource helpers do not own the callers' later seed/import/wait/request continuations, so timeout can outlive cleanup and mock/guard restoration. Compose an existing whole-case owner around these affected callbacks, preserving their assertions.","file":"hub/test/startup-listener-scale.test.ts","line":17},{"severity":"medium","text":"The new fake-only batch callback has no positively controlled native-launch guard, and the scale callback installs its guard only after fixture acquisition/seeding. Cover the complete new setup/body/cleanup sequences and explicitly inject any reachable stage-tree/native boundary; keep the existing positive guard and avoid unrelated fixture enrollment.","file":"hub/test/startup-ready-component.test.ts","line":23}]
finding_counts: {"high":0,"medium":3,"low":0}

Full Standards and Spec source review at 0aea22c4a875b945f51b4ecc469d48f87717e67e, tree 1a4b5bdc836fd35b72274e91d133b9cd547c4265, fixed base 3e99d425b after the pre-first-review dev merge. Three medium findings; none high or low. A-21501 records source, calibration, consumer checks and retained-evidence limits.

The new listener timing finally can discard an acquired edge before ws/spoke/edge assignment or replace the original bind error. Both new regression callbacks lack a whole-caller setup/cancellation owner despite resource helpers. The new T2 callback has no positive native-launch guard, while the T3 guard starts after acquisition/seeding. The Implementer confirmed all three in bb9f33bc, without an omitted owner or approved disposition.

The batch-context policy, default-preserving deferred freshness, post-serving resumption in both modes, worker yield/stop join, additive old-reader event shape and stageTree fixture forwarding were checked. The work-count red4!=1 and inspector stack name a concrete repeated full-context refresh; they do not prove every historical long bind had only that cause. Coordinator a72f16af/fe29dfff accepts the 375-want gate and report-only1500; 613785c4 accepts standing E-880. The exact-case15s allowance expires2026-11-26 and explicitly labels Linux projection rather than a Linux sample.

A-21496 retains positive macOS arm64/Node24.21 guarded working-tree T3 outputs:375 wants bind14.352ms/request85.442ms;1500 bind12.333ms/request317.957ms, with exact during-drain response and native code0/signalnull. Their tested whole trees are unknown and differ from exact-head verification. A-21500 enumerates61 distinct pinned T1 filenames with file closes across two attempts; initial init-roots code1/HOME failure, resumed48 positives and prior invalid-owner lint failure remain retained. These are not an aggregate case pass. Final precommit full lint/typecheck exit0 excerpts, unknown raw/native/tree facts, deferred T2/T3/T4/browser/configured phases and incomplete retained QA filename census are explicit. Reviewer ran no tests, probes or scanners; source is clean and unchanged.

C2 failed; C1 remains done but unverified. No criterion verified. This consolidated verdict releases the source/experiment pin for the three scoped corrections. Preserve the calibration, work-count/response assertions and historical failure scopes; request fresh immutable-head source review before configured verification under the Coordinator's window.

Criteria: C2 failed (Listener timing diagnostics can discard acquired edges or replace bind errors, and the new regressions lack complete caller/setup and fake-native boundary ownership.).

### rev-35 · 2026-11-19T03:18:24.327Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1952-source-2
commit: daa18bea325fe973fd6a66c9f32002a49a36bf91
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source CLEAR at clean daa18bea325fe973fd6a66c9f32002a49a36bf91, tree053bda2afffdb01c9e73157ac7401e267326fb7c; fixed base3e99d425b, no post-review dev merge. Standards clear; Spec clear; no findings. A-21528 records closure of A-21501's three findings: both diagnostic sinks are contained without losing acquired listeners/original bind rejection; real Unix-removal/TCP-rebind/error-identity controls use pre-enrolled stageCase with captured-server fallback before helper census; original setup/body/resource/root/guard ownership and separate bounds cover the changed T2/T3 callbacks with explicit stageTree fake. C1 verified for the qualified repeated-topic-context/microtask startup blocker established by A-21496 profile, actual4!=1 work-count red and source; this does not prove every historical long gap had only that cause. Optional default-preserving freshness deferral, both serving modes, yield/stop join, batch callback compatibility and additive old-reader receipts checked. C2 remains unverified pending configured evidence at this head. A-21521 b23-labelled local T3 and62-file native closes, later precommit9/9 T2 fallback rerun and exact-daa full lint/typecheck remain separately scoped; supplied head labels are not independently recomputed per-process Git identities. Calibration375/enforced request2000ms, listener report budget2000ms, historical1500 report-only and E-880/15s/Nov26 allowance unchanged. Source clear permits configured verification at daa under Coordinator window. Reviewer ran no tests/probes or source mutations.

Criteria: C1 verified.

### rev-35 · 2026-11-19T03:53:07.877Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1952-evidence-1
commit: daa18bea325fe973fd6a66c9f32002a49a36bf91
scope: evidence
findings: [{"severity":"medium","text":"Spec: configured a468b778/A-21541 fails the listening-to-serving integration deadline: 'Error: serving receipt after listening: not within 2000 ms'. The 13.191045657s case duration is not a measured gap. Changed scale T3, T4, Web and Neovim T2 remain unexecuted, so final C2 cannot be cleared; preserve this failed round and complete the Coordinator-directed timeline diagnosis before any correction/review/retry.","file":"hub/test/item-summary-scale.test.ts","line":92}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR at unchanged tracked daa18bea325fe973fd6a66c9f32002a49a36bf91, Git tree053bda2a. A-21543 records the literal A-21541 failure, scope/count audit and provisional Coordinator attribution6906b6f4. Autoexit1; T0/T1 exit0, T2 hub shard exit1. Ordinary6165pass/1fail across622files; separate15/15 load case/file receipts pass. All3 new T2 controls base+5/5 pass and duration logging passes, but own scale T3, changed T4, Web and Neovim T2 did not run. Linuxx64/Node24.21 uncached droplet; browsernull. Snapshotefd66180 differs from Git tree; no equality claimed. C1 prior qualified source verification remains; C2 failed, nothing newly verified. Earlier local/profile/source epochs retained separately. No test/probe/source mutation by Reviewer. This consolidated evidence verdict releases the hold for the existing Coordinator-directed dev/candidate timeline diagnosis before edits; changed head requires fresh source review and another window. No test-anchor change approved here.

Criteria: C2 failed (Configured a468b778 failed the listening-to-serving 2000ms integration deadline; the changed same-scale T3 case did not execute.).

### impl-1952 · 2026-11-19T04:18:50.074Z

Configured a468b778 remains failed (A-21541/A-21543); no retry yet. Coordinator-directed unchanged-source timelines: dev2d7fe873 first listening→serving91.307ms/parent4.259s; daa18bea98.332ms/parent11.349s. Inspector after serving names TrackerIndex.#hydrate→#stageSnapshot→#stagesOf→#rawSummary→#refreshExplorer→#announce ancestor recursion→#announceBatch→Freshness.refresh. Test-only red on daa18bea: first batch refreshed E-2/R-1 52 times each, expected1; real hub.status separately timed out after5000ms. Candidate deduplicates source/ancestor refreshes and notifications, yields every16 refreshes, serializes tipsMoved/settled batches separately from the writer queue, and keeps producer ownership through stop. Latest focused T2: first listener→serving60.508ms, serving→status166.750ms during the first batch, counts1/1; local darwin/arm64 Node24.21.0, fake Git/providers, no browser, full configured evidence pending.

Rule20 caller census: #announce is called by #changed (item, old parents, blocked dependents), #announceBatch, ancestor/dependent recursion, file recovery/reload, stage-history/tree completion, useVerify/stage-cover dependents, silent verify refresh and plan ordering. Only #announceBatch opts into prepared rows; all standalone callers retain their refresh path. #announceBatch producers: Freshness.tipsMoved and .settled. Their now-awaitable callback contract is consumed by Tracker; direct test consumers are tracker-summary(T1), freshness and follows-native(T3), retaining synchronous callback compatibility. Freshness.refresh and worker await publication so stop joins both. publishTaskBatch's sole caller is server's optional Tracker.onChange batch wrapper; this remains synchronous, with no flag spanning a yield. Existing per-item onChange callers, ItemChange frames, persisted readers, frozen help bytes, client examples and QA briefs have no changed wire shape.

### rev-36 · 2026-11-19T04:34:59.082Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1952-source-3
commit: a3aaa144aac70d202225f21d8e61ceaa87a515ea
scope: full
findings: [{"severity":"medium","text":"The callback awaits within(plannedStartup(...),15000) without enrolling the original seed sequence independently. On timeout, mkdir/1,000 write continuations can outlive fixtureWork's caller join and race adopted-root removal or seam restoration; allSettled inside the abandoned helper does not retain ownership. Enroll the original work before separately bounding observation and join it before cleanup; preserve scale, setup/behavior bounds and assertions, and correct the guide's failure-path claim.","file":"hub/test/item-summary-scale.test.ts","line":90}]
finding_counts: {"high":0,"medium":1,"low":0}

Source3 not clear at clean a3aaa144aac70d202225f21d8e61ceaa87a515ea, tree2e0ff92934f0498c1add0d3b3a0408c2f6543b23, correction basis daa18bea3/no post-review dev merge. A-21569 records full Standards/Spec review and one medium M1. Implementer fb482ce4 confirms no omitted independent seed owner: line90 retains the deadline wrapper rather than original plannedStartup, so expiry can leave mkdir/writes beyond the whole-caller join. Enroll original work and bound observation separately; keep the 1,000 rows,15second setup observation, first-listener anchor,both2second behavior bounds and final assertions. The matching guide overstates failure-path drainage. No additional blocking source finding. Independent batch queue, unique ancestor/dependent refresh,16row yields,synchronous context wrapper,serialized tipsMoved/settled producer ownership and stop fences/joins were checked; caller census and calibrated20second report-only allowance/receipt-snapshot diagnostic match Coordinator decisions. A-21566 retains61T1/704, T2 11+4, T3 10+4 plus earlier/final scale1+1 and final full static passes with epochs/fingerprints/native-close limits; Reviewer inspected named controls, no runtime. Old a468b778/A-21541 remains failed/partial, not green proof. C2 failed; qualified C1 prior source evidence remains tied to earlier daa head and is not newly verified here. Release pin for this single scoped correction, required checks and fresh immutable-head source review before configured verification.

Criteria: C2 failed (The reworked startup regression can abandon its original fixture-seeding sequence on its setup deadline, allowing cleanup before seed writers finish.).

### rev-36 · 2026-11-19T04:42:24.673Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1952-source-4
commit: 4f49e5145104ced87d58adc93e6e1a72960b77c1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear at clean pushed4f49e5145104ced87d58adc93e6e1a72960b77c1, treeca9b780bfe126d567773e66f5526063e21c04249. A-21576 records Standards/Spec review of the two-file correction against source3, with prior production/census review retained. The exact original plannedStartup promise is now registered with owner.requireClose before its unchanged15s observer. Cleanup joins the original sequence, including writes begun after mkdir, before root release/seam restoration; allSettled is a writer-join receipt, never evidence of successful setup. Matching guide agrees. No production/helper/scale/deadline/first-listener/assertion/T3/allowance/dev-merge change. No findings. C1 reverified from retained qualified context/profile/Inspector and52/52-versus1/1 fixture evidence; no exclusive claim about all historical64s gaps. C2 stays done/unverified for new same-head configured evidence. A-21575 retains local darwin/arm64 Node24.21 full affectedT2 4/4 including actual40.641ms first-listener→serving/201.936ms serving→status with1/1 ancestors; full lint/typecheck native0/signalnull. Initial outer launcher stopped after T2/lint at load8; typecheck was unexecuted there, then resumed alone below8. Prior failed/source epochs and configured a468b778 stay separately scoped, with no new T3/configured/browser proof. Reviewer only read source/metadata/logs; no tests/probes/scanners. Hold released; request the Coordinator's new mode-free verification window at this unchanged head.

Criteria: C1 verified.

### rev-36 · 2026-11-19T05:07:51.605Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1952-final-1
commit: 4f49e5145104ced87d58adc93e6e1a72960b77c1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged clean/pushed4f49e5145104ced87d58adc93e6e1a72960b77c1, source treeca9b780bfe126d567773e66f5526063e21c04249. A-21585 records independent same-head audit of8bd4f353-5443-44d0-a920-e4ce17647a21/A-21583 finished/passed, ownerexit0. C1 qualified cause/profile evidence retained at this head, without exclusive attribution of historical64s gaps. C2 named T2 serving case pass20833, countsE2/R1=1each, first-listening→serving76.826ms and serving→status191.753ms during first read; named duration logging pass27473. Two batch ordering/stop controls, two sink-preservation controls and topic-context control pass base+5distinctload repetitions each. Selected retained-state T3 passes35518, actual bind11.867ms/report-only2000ms, actual task.view160.498ms/enforced2000ms at10commitreads/0publishedanswers. T3 full case4.911782378s is separately scoped from latency and local allowance projection.6906basepasses=6761top-level+145nested, zero fail/cancel/skip/todo;25separateloadpasses;723passingbasefiles231T1/435T2/selected1T3/mapped1T4/55Web. T0/T1/T2/selectedT3/mappedT4/Web exit0; T4 is one base guard only/no repetitions, remainingT3batch-deferred/remainingT4unexecuted. Provenance38160 binds runtime tree566ad2fa6a19ae1b5d59c6f6f7f06dfb74387af2, uncached droplet Linuxx64 6.8.0-147-generic Node24.21/Nv0.12.5 and actual isolated HeadlessShell1248/ChromeTesting156.0.8078.4.107.384s is hostT0step only;1214s/$0.0843 executor accounting. Advisory budgets/ratchet/lint/oldownerdiagnostic remain report-only. Earlier a468b778/A-21541 stays failed/partial with all epoch qualifications retained. No findings or Reviewer runtime. C1/C2verified; hold released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T06:11:38.901Z

Merged db53a0cb9c36b39d634e08b30c3ce56b10766bc0 onto dev.
