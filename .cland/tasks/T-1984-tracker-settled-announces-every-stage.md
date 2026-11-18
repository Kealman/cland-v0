---
id: T-1984
kind: task
title: Tracker settled() announces every stage-cover dependent on each freshness answer, so a hub start with 1,500 branch wants stalls the tracker
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1973
topic: topic-1635
branch: t/T-1984-tracker-settled-announces-every-stage
created: 2026-11-18T19:11:35.700Z
updated: 2026-11-18T23:22:05.960Z
closed: 2026-11-18T23:22:05.960Z
---

## Summary

T-1973 (da95b9681) added, in `tracker.ts:486–487`, `settled: (ids) => { if (this.#stageAncestors.size) ids = [...new Set([...ids, ...this.#stageCoverDependents])]; this.#announceBatch(ids); … }`. Freshness `#work` calls `settled` once per finished want (freshness.ts:358). Every single freshness answer therefore refreshes and announces all stage-cover dependents plus their ancestors, and schedules ready and planned checks for each. After hub restart #85 at d7050e7e2 (pid 62039, 2026-11-18 18:37Z), about 1,548 branch wants each paid that whole-dependents refresh. For more than 17 minutes the tracker answered nothing (task.view 10 s and verify queue 15 s timeouts), with CPU at 100% and six tracker-storage-stalled events. v0-6a's profiles at 18:39:55Z and 18:53Z put 73% inclusive in `#work → settled → #announceBatch → #refreshExplorer → #rawSummary`.

## What to build

Make stage-cover dependents join an announcement only when a settled id can change a stage cover (a job-list revision or a stage member's tip), and at most once per freshness drain or batch, not once per want. Keep T-1973's C1 bound and its equality oracle. Add a regression that settles N wants unrelated to stage covers and counts dependent announcements.

## Acceptance criteria

- [x] C1. Settling 1,500 freshness answers unrelated to stage covers on a synthetic tracker with active stage covers announces stage-cover dependents at most once, shown by an announce-count control that fails on da95b9681 (test, red before).
  - done: impl-1984 · 2026-11-18T20:47:51.832Z
  - verified: rev-36 [reviewer] · run rev-36-1984-final-1 · 2026-11-18T21:18:19.983Z · commit 1a9ee510328c641560613c5f190e31e8a995b2d1
- [x] C2. A settled answer that changes a stage member's tip still refreshes its stage-cover dependents, and T-1973's stage-cover equality oracle is unchanged (test).
  - done: impl-1984 · 2026-11-18T19:24:19.945Z
  - verified: rev-36 [reviewer] · run rev-36-1984-final-1 · 2026-11-18T21:18:19.983Z · commit 1a9ee510328c641560613c5f190e31e8a995b2d1

## Comments

### impl-1984 · 2026-11-18T19:16:51.691Z

Consumer inventory (rules 20/41): FreshnessOptions.settled declared/stored in tracker/freshness.ts, called only by #work; production consumer Tracker constructor. Direct fixture consumers freshness.test.ts (three Freshness constructors; no-op observers and shutdown no-publication assertion). #announceBatch callers: settled and #tipsMoved only. #stageCoverDependents readers: settled fanout, #stageCoversChanged, verifyChanged integrated-change check; writers #stageCover and delete/reload paths. Stage ancestry reader #stageCover/check; ancestryChanged updates candidate index. Wider affected tests: stage-closure-component (C1 budget/equality unchanged), planned-stage, item-summary, tracker-summary, verdict-commit, tracker-native-boundary, custom-roles-component, merge queue/batches/recovery and follows-native. Search of hub/src, hub/test, nvim, web, docs and shipped skills found no wire or persisted reader of settlement batching; wire shapes and frozen help bytes unaffected. New callback semantics retain ids but coalesce by drain. T3 freshness.test remains native and deferred to authorized verification; no local native run.

### impl-1984 · 2026-11-18T19:23:36.122Z

Local validation at source working tree based on d7050e7e2 (darwin/arm64, Node v24.21.0; no browser): production import-graph selected 58 T1 files and reported 3 unresolved consumers (suite-remote-budget, verification-tier-receipts, web-notifications); all 61 ran serially with 700/700 tests pass, no skips. Stage-closure-component before adding C3: 11/11 pass including existing T-1973 5000-job bound and equality oracle unchanged. C1 red literal and green evidence are A-21379. C3 first timing is intentionally deferred to reviewed-head droplet verification. Full lint first found a direct wall-clock assertion in C3; replaced with named bounded observer and retained validated-reply assertion. Final full lint/typecheck pending. No native T3 run or full verification claimed.

### rev-35 · 2026-11-18T19:34:49.417Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1984-source-1
commit: 9c1251aa08ac25ccfdef473ea38c623f44fb1f8a
scope: full
findings: [{"severity":"medium","text":"Standards M1: both new raw-t callbacks lack a pre-acquisition owner for original body/setup, late Tracker/Hub handles and the original task.view request. Enroll the whole case and require writer closure before storage/root disposal and seam restoration.","file":"hub/test/stage-closure-component.test.ts","line":22},{"severity":"medium","text":"Standards M2: injected-Git component cases enroll no positively controlled native-launch guard through setup/body/cleanup; the other case's stageCase guard does not cover them.","file":"hub/test/stage-closure-component.test.ts","line":18},{"severity":"medium","text":"Spec M3: the 2000ms observer is constructed after refreshFreshness, while the first-answer timestamp is diagnostic only. Bind the deadline to the advertised first-answer→validated original reply interval and observe it concurrently with refresh; retain/join the actual request on timeout.","file":"hub/test/stage-closure-component.test.ts","line":77}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear; Standards 2 medium, Spec 1 medium, confirmed by author9dffb8ea. A-21382 records the complete four-file pass. Production batching/shared-ancestry fanout is narrow; stop, job revision and tip paths remain, with no additional product-source finding. Red1500/green0 count evidence and unchanged C2 semantic/5000-job/16-history controls are retained; C2 remains unverified. Reported local T1 700/700, selected component11/11 excluding C3 and full checks0 remain qualified by their source epochs. C3 intentionally has no local sample; that is not a finding. Release hold for one consolidated correction, fresh source review before verify, no unsolicited dev merge or local C3 timing run. Full audit: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21382-t-1984-first-source-review-fixture-ownership-isolation-and-timing-boundary.md.

Criteria: C1 failed (The new count-control fixture lacks whole-callback/setup/resource ownership and positively controlled native isolation.), C3 failed (The startup fixture lacks the same ownership/isolation and does not bind its deadline to the advertised first-answer→validated-response interval.).

### impl-1984 · 2026-11-18T19:37:37.816Z

Consumer census correction from source review: follows-native.test.ts:66–76 is also a direct Freshness settled subscriber, not merely an import-graph neighbor. It checks foreground cached ancestry/containment independently of a held demo lane; remains unchanged T3 and unexecuted locally. Consolidated fix addresses rev-35-1984-source-1 M1–M3 in the new cases only: pre-acquisition stageCase whole-case ownership plus exact resource registration and original request join; existing counted native guard; deadline synchronously armed at first-answer before dispatch and absolute-deadline checked on validated receipt, concurrent with refresh. Local C1 corrected guard/ownership case passes on darwin/arm64 Node24.21.0 (1/1, no C3 execution). Production source untouched since first reviewed head.

### rev-36 · 2026-11-18T19:45:17.254Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1984-source-2
commit: d2ca5ba8b2f65f2033565c12db3aba359b0018e0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21389 records the full corrected-source review at d2ca5ba8b2f65f2033565c12db3aba359b0018e0 / tree 386b10bf80eb3318051c6a4fc5269ef038e25891, fixed base d7050e7e2. Standards and Spec: no remaining findings. Source1 M1–M3 are resolved: both new callbacks pre-enroll stageCase before acquisition, capture exact late Tracker/Hub owners, retain the original request/validation independently, and keep the counted native guard through confirmed cleanup; the named 2000ms observer is armed synchronously at first-answer before request dispatch, checks the absolute deadline after validation, and is observed concurrently with freshness refresh. The final exact-item validated reply and announcement-count assertions remain.

Production source is unchanged since 9c1251aa0. Independently traced per-worker unique settlement batching, stop suppression, relevant shared-ancestry fanout, and preserved tip/job-revision invalidation. Existing 5000-job work control, rejected-head positive control and sixteen-history equality oracle have no body changes. Consumer census includes the direct follows-native subscriber; freshness/follows-native remain T3 and locally unexecuted. Only test/docs changed after source1; no dev merge, clean HEAD equals local origin.

No criterion verified by this source pass. C1/C2/C3 remain implementation-done and await same-head configured evidence. C3 is deliberately unexecuted locally and its first timing sample belongs to reviewed-head droplet verification; absence of a local sample is not a finding. A-21379 retains the exact old-source 1500-dependent failure and fixed zero-fanout control. A-21387 reports corrected local darwin/arm64 Node24.21 C1 1/1, component11/11 excluding C3, full lint/typecheck0, zero refusals and130 report-only findings. Prior61-file T1 700/700 remains its original source epoch. Raw invocation/native metadata absent from the summary artifacts is not inferred. No configured/native T3/full-suite/browser/provider/QA pass is claimed; Reviewer ran no tests, checkers or probes.

Source hold released by this verdict. The unchanged head may verify after the Coordinator grants a window. Any changed head needs fresh source review. No local C3 timing, extra stress/native/provenance run or dev merge requested.

### rev-36 · 2026-11-18T20:11:33.569Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1984-evidence-1
commit: d2ca5ba8b2f65f2033565c12db3aba359b0018e0
scope: evidence
findings: [{"severity":"medium","text":"Spec/evidence C3: the startup response regression fails its base and all five load executions. Four retained load errors report the outer startup outcome incomplete; repetition5 instead reports the named first-answer→validated-task.view deadline. No passing required measurement is established. Preserve both failure classes and positive request/drain/response receipts; whole-case durations do not establish response latency or a root cause.","file":"hub/test/stage-closure-component.test.ts","line":91}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear on current criteria; A-21405 settles failed/partial run8c6a55b1 / A-21401 at exact source-reviewed d2ca5ba8b2f65f2033565c12db3aba359b0018e0. Owner Finished exit1 and task.view failed; runtime tree581122f2b5d22b31376adb5e685cd91000923196, cached:null. Source head/tree remain clean/unchanged. Fail C3; verify none. C1/C2 positive receipts remain retained, not final acceptance from a failed round.

Actual failure distinction: load diagnostics28960/29604/30180/30901 say `validated startup response incomplete; fixture retained`. Fifth31535 instead says `first Git answer to validated task.view response: not within [redacted][redacted][redacted][redacted] ms`; source91–92 supplies its2000ms budget. The earlier setup-only account was corrected and escalated immediately. Base29068/29069 fails19.885586247s; five load failures have whole-case21.111357623/21.136129632/19.647236091/19.193777153/18.599194240s, all retained. These include seeding/setup/cleanup and are not task.view response times. Original request/drain admission and root-removal status remain unknown without positive receipts; the retention message is not filesystem proof.

C1 has basepass28816/28817 plus5distinct load passes/proof29833. The other10 component base cases, including5000-job/equality and pending-landing controls, pass; the component file still fails. T0/T1 pass; T2 fails partial. File audit:229/229T1 pass;388/432T2 observed,387pass/1fail;44nvimT2 unexecuted. Web55/T3248/T417 all unexecuted, browser binary/version null. Base6115=6114pass/1fail; separately220loads=215pass/5fail. The combined6335 completed outcomes explain6329pass/6fail without inflating the base aggregate. Linuxx64 6.8.0-147-generic Node24.21.0/Neovim0.12.5; lifetime935s/$0.0650 is accounting, not suite wall. Report-only case/file budgets and lint notices are separate from the actual observer failures.

Coordinator3c39ba25's C1/C2 landing/C3 follow-up disposition is retained, including both failure classes and combined T-1646 measurement. Current task.view still contains C3, so it fails here; that disposition cannot make this failed round a pass. Authorized owner must record any criterion/test-scope change explicitly; a changed head needs fresh source review before verification. Source2 inspection remains history, not final green. This verdict releases the evidence pin for Coordinator-authorized next work within its existing time box; no deletion, deadline relaxation, local probe or retry is inferred/requested by Reviewer. No source edits or runtime experiments performed.

Criteria: C3 failed (Configured run8c6a55b1 fails the required startup case in base plus5loads; repetitions1–4 report startup outcome incomplete and repetition5 reports the named2000ms behavior observer expired.).

### rev-36 · 2026-11-18T20:19:57.880Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1984-source-3
commit: d61c64aa61f325f292be01bf6518696ae5124fd6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear on the recorded narrowed C1/C2 scope; Standards/Spec no findings. A-21408 covers exact d61c64aa61f325f292be01bf6518696ae5124fd6 / treeae3545c545614438e2f1bf0947d81514e5b2fc99, clean HEAD equals local origin. Coordinator056f9cd9 explicitly authorizes split-now/removal of only the startup variant. Readback confirms C1/C2 only; T-1987 exists under E-1883, blocked by T-1984/T-1646, carrying startup/drain/work receipts and both failed classes. This disposition narrows acceptance; it does not fix C3 or turn old run8c6a55b1 into pass.

Complete two-file change only removes startup invocation/branch/callback plumbing and updates the guide. The surviving false-default C1 path becomes unconditional with the same1500-task/active-cover/count assertions, pre-acquisition stageCase, exact Tracker close owner and counted guard. The entire pre-existing test tail from the ten-plan/5000-job case onward is byte-identical to d2ca5ba8b and d7050e7e2, retaining both semantic/work oracles and pending-landing assertions. Production/tier manifests unchanged; source2/A-21389 full batching/invalidation/consumer basis retained. No dev merge.

A-21407 reports narrowed local darwin/arm64 Node24.21 full lint/typecheck0,130 report-only findings/zero refusals, full component11/11/no skips. Those are local source reports, not new-head configured evidence. Old A-21401/A-21405 remain FAILED/PARTIAL/not clear at d2ca5ba8b with base+5load failures and both classes/all durations. Guide preserves the original source head and T-1987 destination; no passing response-latency claim. Current C1/C2 are done and remain unverified at this source gate. No configured run at d61c64aa6 yet.

Reviewer only read tracker/Git/source/docs/retained artifacts; no edits or runtime/checker/scanner/native/browser/provenance probe. Release source hold. Unchanged head may request Coordinator's next window after impl-1646; any changed head needs fresh source review. No local C3 probe, live restart or rollback is requested/performed by this verdict.

### rev-36 · 2026-11-18T20:43:40.733Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1984-evidence-2
commit: d61c64aa61f325f292be01bf6518696ae5124fd6
scope: evidence
findings: [{"severity":"medium","text":"Standards/evidence: the new C1 case exceeds the enforcing duration gate, 10.381s >5s (A-21412:34500), so T2 and the suite exit1 despite all recorded assertions passing. The future exact-case allowance authorized by Coordinator6aa3dd7b is not present at this head and cannot retroactively make this round pass. Apply only the authorized change, retain count/oracle assertions, and obtain fresh source review before verification.","file":"hub/test/stage-closure-component.test.ts","line":18}]
finding_counts: {"high":0,"medium":1,"low":0}

A-21413 settles FAILED/PARTIAL run6a6430c0 / A-21412 at exact reviewed d61c64aa61f325f292be01bf6518696ae5124fd6. Fail C1; verify none. Literal owner failure34500: `duration budget: hub/test/stage-closure-component.test.ts::unrelated freshness answers do not fan out to stage-cover dependents 10.381 s > 5 s (add to hub/test/durations.json with a reason)`. T2exit1/Finishedexit1/task.view failed agree. This is separate from the report-only2s advisory. No production/count/equality assertion defect is inferred.

C1 base28812/timing28813 passes10.380881949s; all5 distinct loads pass10.628859183/11.048420758/11.895041283/10.841475707/10.991459253s with proof30176. Whole-case durations include seeding/setup/body/cleanup; they are not per-answer or response latency. All11 component cases pass. Positive facts remain retained; no failed round is final acceptance.

T0/T1 exit0; T2 partial exit1. File audit229/229T1 and388/432T2 pass;44nvimT2 unexecuted. Web55/T3248/T417 all unexecuted. Base6114=6032top-level+82nested passes, plus215 separate load passes; hub6329 completed count includes repetitions. Zero observed assertion failures/cancel/skip does not override the duration failure. Clean head/tree unchanged; provenance34583 runtime tree3eba4faf47d163f6696b9f50d9e9f2d95c07433b cached:null, Linuxx64 6.8.0-147-generic Node24.21.0/Neovim0.12.5, browsernull. T0host104.917s step-only; lifetime1071s/$0.0744 is accounting, not suite wall. Other duration/lint/ratchet notices report-only.

Coordinator6aa3dd7b explicitly authorizes future exact-case C-216 allowance16s, expiry2026-11-25, reason `1,500-file fixture setup; work-count bound unchanged`, with C1/oracles unchanged and optimization in a separate follow-up. Not yet applied under this pin; no retroactive pass. This verdict releases the evidence hold for that authorized correction, required checks, fresh source review and new window. C2 remains done/unverified. Prior startup failures/A-21401/A-21405 and C3→T-1987 disposition remain distinct history. Reviewer only read tracker/Git/manifest/retained logs; no edits/runtime/checker/scanner/native/browser/provenance probes or retry performed/requested.

Criteria: C1 failed (Configured run6a6430c0 fails the enforcing new-test duration gate: unrelated freshness answers do not fan out to stage-cover dependents10.381s >5s; all recorded assertions pass but owner exit is1.).

### rev-36 · 2026-11-18T20:50:04.638Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1984-source-4
commit: 1a9ee510328c641560613c5f190e31e8a995b2d1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-21416 records the complete config/docs change at1a9ee510328c641560613c5f190e31e8a995b2d1 / tree60908f73a8d97dfd261fd9f506080a7998394cfa. Standards/Spec no findings. Exact Coordinator6aa3dd7b allowance matches: component C1 case only,16s, ownerC-216, added2026-11-18, expires2026-11-25, reason `1,500-file fixture setup; work-count bound unchanged`. Independent JSON comparison shows removing that entry leaves every other manifest value identical to d61c64aa6; no baseline/global-mode/file/tier allowance change. C-216 is an open standing category; the unchanged production validator's reason/owner/case/date rules accept this shape and seven-day span by source inspection, expiry midnightUTCNov25.

Only durations.json + per-file guide changed16lines; no dev merge, clean HEAD equals local origin. Production, complete component test source and tier manifest are byte-identical to source3. C1 count/ownership/native guard and all semantic/work oracles remain unchanged. Source3/A-21408 current C1/C2 acceptance basis retained; C3 remains T-1987. Guide states bounded authorization, retained failure and separate optimization, without startup/speedup claims.

A-21415 reports local darwin/arm64 Node24.21 full lint/typecheck0,130 report-only findings/zero refusals; durations-refresh8/8, durations-runner-budget3/3, full component11/11/no skips. Rule33 exact key maps to the component case; it was rerun. Reported file/case timings retain their local invocation scope and are not a droplet speedup. Reviewer read parser/JSON/tracker/Git/docs/artifacts only; no parser/checker/runtime/native/browser/provenance execution or edits.

No configured run at this new head; verify no criterion at source gate. C1/C2 are done/unverified pending same-head evidence.6a6430c0/A-21412/A-21413 remains FAILED/PARTIAL with enforcing10.381s>5s despite passing assertions; the new allowance cannot relabel it. Older startup failure history remains distinct. Release source hold; unchanged head may request the Coordinator window. Any further source change needs fresh review.

### rev-36 · 2026-11-18T21:18:19.983Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1984-final-1
commit: 1a9ee510328c641560613c5f190e31e8a995b2d1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final current-head evidence clear; A-21426 records the independent streaming audit of run 4c1779fa-2472-4750-a7c4-edff3a70fc73 / A-21423. Owner result finished/passed exit 0 at source4-reviewed 1a9ee510328c641560613c5f190e31e8a995b2d1; provenance 39180 pins runtime tree af1bca93abe03d797a876d2b19d987dc7a0ed01f and cached:null. Clean HEAD/local origin agree. Standards/Spec have no remaining finding. Verify C1,C2.

All 11 expected component names have positive base finish/timing pairs; file envelope 28905 passes. C1 count-control finish/timing 28804/28805 passes 8.606902915s, with five distinct passing load identities and proof 30140. Whole-case load durations 8.597929959/9.074954897/9.744005770/9.047337164/8.960486357s remain below the reviewed exact-case 16s C-216 allowance. These include fixture setup and are not response latency or a speedup. Current C1 pass proves its asserted <=1 dependent bound, not an independently serialized exact zero. C2 pending-landing true/false, changed-stage/closure, 5000-job work and sixteen-history equality controls all pass with unchanged assertions. Earlier expected red control remains A-21379's original epoch.

All 229 T1, 432 T2 and 55 Web files have exactly one passing base envelope; no missing/nonpass/duplicate/extra file or progress-parse error. Base 6850 = 6705 top-level +145 nested passes, zero fail/cancel/skip; 215 load passes are separate. T0/T1/T2/Web exit 0. All 248 T3/17 T4 remain unexecuted, including native Freshness/follows-native consumers; no all-tier claim. Linux x64 6.8.0-147-generic, Node 24.21.0/Neovim 0.12.5; actual chromium_headless_shell-1248 binary, Google Chrome for Testing 156.0.8078.4, full path in A-21426. T0 host 105.951s is step-only; lifetime 1246s/$0.0865 is executor accounting, not suite wall. Other budget/lint/ratchet notices remain report-only; allowance scope/Nov25 expiry unchanged.

Both old rounds remain failed/partial: 6a6430c0's enforcing 10.381s>5s failure and six durations stay A-21412/A-21413; 8c6a55b1's base+five startup failures and both error classes stay A-21401/A-21405. Current scope is C1/C2 under explicit split; C3/startup and combined T-1646 responsiveness remain T-1987, with no live restart/latency claim. QA scope none. Reviewer read retained data only, no edits/runtime/checker/scanner/native/browser/provenance probes. Release evidence hold for the normal ready/landing gate; no further run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T23:22:05.960Z

Merged e9b6b6d95357fd06bd36c2c84fc8d8c6d5efefa1 onto dev.
