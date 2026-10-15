---
id: T-469
kind: task
title: "Every stage-close cover carries a Linux proof: the sharded droplet run plus the Mac run, both required by the stage gate"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by: []
topic: topic-316
branch: t/T-469-every-stage-close-cover-carries-a-linux
created: 2026-10-15T09:13:16.034Z
updated: 2026-10-15T23:28:54.203Z
---

## Summary

Retrospective A-2783, START 3: 6 of 6 droplet task runs went red on Linux-only tests, and those defects surfaced only after the switch. A stage closes only when its integrated cover has passed on both platforms: T-395's sharded droplet run (Linux) and the local Mac run.

## What to build

The stage gate (`#stageCurrent` and the plan's `after-stage` close) accepts the stage-close run as evidence only when it holds a green Linux droplet result (the T-395 `--occasion stage` run) and a green macOS result at the same tree. `cland verify --occasion stage` runs both, or names the one missing. hub/README.md and the plan-epic skill say so.

## Acceptance criteria

- [x] C1. A stage with a green Mac cover but no green Linux droplet result at the same tree stays open, and `task plan show` names the missing platform.
  - done: impl-469 · 2026-10-15T20:20:12.775Z
  - verified: rev-30 [reviewer] · run rev-20261015-469-final · 2026-10-15T22:57:32.640Z · commit c09435d4e4a337e6aec09058cd392b004df5bcd0
- [x] C2. With both green at the same tree, the stage closes, proven by a fake-provider test.
  - done: impl-469 · 2026-10-15T20:20:13.848Z
  - verified: rev-30 [reviewer] · run rev-20261015-469-final · 2026-10-15T22:57:32.640Z · commit c09435d4e4a337e6aec09058cd392b004df5bcd0
- [x] C3. hub/README.md and the plan-epic skill describe the two-platform stage gate.
  - done: impl-469 · 2026-10-15T20:20:15.204Z
  - verified: rev-30 [reviewer] · run rev-20261015-469-source-correction · 2026-10-15T20:30:36.543Z · commit a54d2083b7b3bf2bc80712bf0ac9162e29a45b08
  - verified: rev-30 [reviewer] · run rev-20261015-469-refresh-delta · 2026-10-15T21:28:47.078Z · commit 6d7ef2e58241111b07783af70df96504ba6dd203
  - verified: rev-30 [reviewer] · run rev-20261015-469-startup-delta · 2026-10-15T22:28:52.919Z · commit c09435d4e4a337e6aec09058cd392b004df5bcd0
  - verified: rev-30 [reviewer] · run rev-20261015-469-final · 2026-10-15T22:57:32.640Z · commit c09435d4e4a337e6aec09058cd392b004df5bcd0
  - verified: rev-30 [reviewer] · run rev-20261015-469-merge-delta · 2026-10-15T23:28:54.203Z · commit fbd2d2c6206c09c70da8ef6c22ee92859bbabbf2

## Comments

### impl-469 · 2026-10-15T19:20:23.567Z

Implementation in progress: same-tree Linux stage and macOS full receipts now feed after-stage closure and QA freshness; plan and run reports name missing platforms/tree. Existing stage-QA fixtures now supply historical completed platform receipts; a fake-provider end-to-end test exercises Mac-only rejection, mismatched trees, both-platform closure, cache separation and next-stage activation. Typecheck passes. Targeted test window is shared with T-512/T-502 merge checks.

### impl-469 · 2026-10-15T19:36:11.366Z

Checkpoint during Coordinator cover-quiet/restart hold: implementation pushed as fb9354d747d247f8f5c3a3583667f912ab4a4bb1 after clean merge of current origin/dev including T-512 and T-519. New fake-provider platform gate 1/1 green (15.52s with measured allowance), stage-QA 12/12 green (43.58s) before that final merge. Resume on restart notice: planned-stage, suite-close, verification-tree; rerun new platform gate on merged T-512 path; final typecheck/shard lint; then source review before cland verify. No review/verify submitted during hold. Design/validation note A-3293.

### impl-469 · 2026-10-15T20:21:07.145Z

Source review requested from Reviewer at fe41f7facb01d3aaa71582b53bc1c73adf81fb59, pushed to local origin after current dev integration. All 31 targeted cases are green; final typecheck, shard lint and diff check pass. Detailed artifact A-3324. Fixed original query-budget regression without changing its assertion, and proved report-delivery retry advances the next stage. C1-C3 marked done; no per-item QA criteria. Waiting for clear source verdict before exact-head Linux verification.

### rev-30 · 2026-10-15T20:22:45.698Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-469-source
commit: fe41f7facb01d3aaa71582b53bc1c73adf81fb59
scope: full

Source review T-469 not clear at fe41f7facb01d3aaa71582b53bc1c73adf81fb59, fixed point merged dev1a7120a975817e690c3c806e3ae6b3cc54228ffd.

Medium — hub/src/hub/suites.ts:341–344: stage-droplet cache lookup builds its findLast candidate set from stageCovers(), which already discards every failed, pending or unreported attempt (:187). Consequently a green stage-droplet run A followed by a newer fresh failed stage-droplet run B at the same tree/selection/workers/size can return A on the next nonfresh stage request; B is removed before newest-attempt selection. This contradicts the preserved source comment at339 and README:2088 that a newer failed/pending fresh attempt supersedes older green evidence. It can report a cached green after the current stage attempt failed. Filter for stage/executor provenance independently of success, select the newest applicable noncancelled attempt, then apply outcome/report/completion/artifact checks. Retain historical completed-stage proof behavior separately. Add a public regression: qualifying green stage run -> same-key fresh failed run -> subsequent stage request must execute/refuse reuse; also cover a pending/unreported stage attempt so it cannot resurrect the old green.

Standards axis: the above is a documented cache-contract regression. Other reviewed boundaries remain consistent: historical committed-tree lookup uses a private Git index, immutable landing->cover ancestry runs off-request with retry notification, and recovered report eligibility notifies planned-stage scheduling. Diff whitespace passes. No Reviewer edits/tests.

Spec axis: two-platform receipt gating is otherwise present for every after-stage stage including scope none, with independent QA for non-none scope. Linux proof checks stage provenance and all sharded Linux/green children (or documented one-slot fallback); Mac proof requires local Darwin. Stage snapshots require landings covered by an ancestral Linux build and same-tree Mac, completed history survives later descendants, rollback invalidates ancestry, and public plan/results name missing platforms/tree. Per-item gate logic is retained. These source facts do not waive the cache blocker.

A-3324 targeted evidence reviewed: requester reports31 cases (stage-cover1, stage-QA12, planned-stage10, close7, verification-tree1), typecheck/shard lint green; source fixtures preserve query-budget assertions and add platform/QA/report-recovery/next-stage checks. New15.60s allowance has measured lifecycle reason. The positive cache-separation fixture does not exercise newer failed/pending attempts. Validation supplied is not proof of that negative history.

No criterion marks are added on this not-clear source pass. The finding concerns required cache/evidence validity rather than an invented failure of the direct C1/C2 happy-path scenarios. C3 docs are present but final marks wait for corrected source and gate. Do not submit full verification at this head. Fix, targeted regression evidence and a new source-review request are required before the next run. No per-item QA criteria.

### impl-469 · 2026-10-15T20:29:39.451Z

A-3325 cache-supersession finding fixed in a54d2083b7b3bf2bc80712bf0ac9162e29a45b08, pushed; no dev merge after first review. Failed and unreported stage negative-history cases were each observed red before the fix and green after it. Full stage-cover file3/3 and ordinary cache file6/6 green; measured allowances committed; final typecheck/shard lint/diff check pass. Source re-review requested with artifact A-3326. No full verification submitted; Coordinator new-droplet hold remains in force.

### rev-30 · 2026-10-15T20:30:36.543Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-469-source-correction
commit: a54d2083b7b3bf2bc80712bf0ac9162e29a45b08
scope: delta

Source re-review T-469 clear at a54d2083b7b3bf2bc80712bf0ac9162e29a45b08, delta from previously reviewed fe41f7facb01d3aaa71582b53bc1c73adf81fb59. No high, medium or low findings remain. A-3325's cache supersession blocker is resolved.

Standards: the findLast population now filters only same tree/mode/selected-subset/workers/size, cancellation exclusions and stage executor/occasion provenance. It includes newer failed, pending or unreported attempts; the existing success/report/finished/artifact checks run only after newest-attempt selection. Stage platform/sharded-proof eligibility follows those checks instead of prefiltering them. This restores the documented latest-attempt supersession contract while leaving historical completed-stage proof selection separate and unchanged. No dev merge after first review; source delta is suites.ts plus two public regressions and measured duration entries.

Spec/negative history: new fake-provider cases seed qualifying Linux stage green, then same-tree fresh failed or successful-but-unreported attempt, then nonfresh stage request. Both require no cache hit and a newly executed green, with report recovery and all droplets collected. Failure trigger lives outside the candidate checkout, preserving same-key identity. The blocked-report case observes completed outcome and loop-breaker error before the third request, then unmutes and joins both reports. Requester recorded red against fe41f7fa (old green reused) and green after fix. A-3326 reports complete stage-cover3/3 (34.71s, prior platform/history/QA/report-recovery case retained) plus ordinary cache6/6 (31.28s). The two new11.13s/11.12s allowances have measured multi-run lifecycle reasons, preserve prior budgets/values and keep file below60s. Typecheck/shard lint reported green; whitespace check is clear.

Broader first-pass source facts remain: every after-stage stage including scope none requires completed same-tree local Darwin and Linux stage-droplet evidence; scoped stages independently require current QA at that tested tree. Landings must be contained in an ancestral Linux build, rollback removes eligibility, later descendants retain completed historical proof. Plan/results name missing platforms/tree, report recovery notifies next-stage scheduling, and historical tree lookup uses a private index. Per-item gates stay unchanged. Both README and plan-epic guidance describe the two-platform requirement; C3 source verified.

C1/C2 final runtime marks remain pending acceptable exact-head post-source verification. Prior targeted cases and A-3326 do not substitute for that gate. Coordinator f2fe5d34-ccf9-4967-988f-b42faab2c740 currently holds NEW DROPLET verifies until E-387 stage run has bundled; existing runs finish, targeted/local-only work is separately permitted. This clearance does not lift that hold. After its explicit release, submit one exact-head diff-selected Linux verification; any changed head needs new source review.

No Reviewer tests, edits, merges or provider calls.

Criteria: C3 verified.

### impl-469 · 2026-10-15T20:40:03.086Z

Source correction clear at a54d2083 (A-3327), C3 verified. After explicit hold release, submitted cland verify with no mode and --executor droplet --fresh, report topic-316 to Reviewer rev-30 and item lead. Run 59810133-257b-4b3f-8004-6a766be94a76 is queued position1. Exact reviewed head remains clean and unchanged. Awaiting hub result before final evidence review.

### rev-30 · 2026-10-15T21:04:30.192Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-469-linux-first
commit: a54d2083b7b3bf2bc80712bf0ac9162e29a45b08
scope: evidence

Evidence review T-469 not clear at a54d2083b7b3bf2bc80712bf0ac9162e29a45b08.

Medium — hub/src/tracker/tracker.ts:1803 and hub/test/task-card.test.ts:113: integrated verification callbacks enumerate this.#index.list() and refresh plans globally. Linux receipt A-3351 observes one full tracker hydration where completion must perform zero, failing the bounded/coalesced completion contract. Restrict refresh to indexed affected stage containers rather than restoring full-list work on every integrated run update; preserve the existing zero-full-list assertion.

Medium — hub/test/planned-stage.test.ts:260: stage landing uses 10456 tracker queries with 64 unrelated items and eight unrelated plans, exceeding the existing <10000 budget. This is the task's modified stage path, not an admitted known outside flake. Diagnose stage-cover/planned refresh work and keep the query assertion; the new proof gate must preserve unrelated-plan isolation. Exact root cause of this count remains under Implementer diagnosis, so no unsupported attribution of every excess query to a specific callback.

A-3351 /59810133 is actual Linux c-8 lon1, exit1, 1831 pass/two failures/three platform skips. Typecheck and hub phases completed; Neovim was not reached. Query failure details at lines4132–4144; full-list assertion at4147–4162. Duration-regression notices are separate and do not explain these functional assertions.

Standards: source/cached-attempt correction A-3327 remains the reviewed implementation, but these runtime regressions block final clearance. Spec: C1/C2 platform-proof runtime marks remain pending a successful post-correction gate; C3 source documentation mark remains current. No failure is inferred for the platform criteria from the unrelated general query budgets themselves; the concrete performance regressions still make this review not clear.

Implementer d35abfc7 confirms diagnosis of the added refresh callbacks, no unchanged flake retry, preservation of both assertions, and targeted reproduction only after T-427's exclusive timing window. An implementation correction requires a new source review before another verification. No Reviewer tests, edits, merges or provider actions.
Evidence path: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3351-suite-59810133-257b-4b3f-8004-6a766be94a76-auto-at-a54d208.log.

### impl-469 · 2026-10-15T21:27:42.815Z

A-3358 completion regression corrected and pushed at6d7ef2e58241111b07783af70df96504ba6dd203. Task-card6/6:46 completion queries/0 full lists/0 item reads. Stage-cover whole file3/3;69.595432s loaded test sum recorded as measured file allowance. Requested clean dev/task landing comparison: devf8000c3d9645, task9788/9795; close7833/7834/7901; all original query assertions retained. Coordinator approved proceeding in7b0c7a3f. #tipsMoved/#hydrate/Worktrees unchanged; no post-review dev merge. A-3378 carries evidence. Source delta review requested; verification waits for stage close admitted.

### rev-30 · 2026-10-15T21:28:47.078Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-469-refresh-delta
commit: 6d7ef2e58241111b07783af70df96504ba6dd203
scope: delta

Delta source review T-469 clear at 6d7ef2e58241111b07783af70df96504ba6dd203, parent reviewed a54d2083b7b3bf2bc80712bf0ac9162e29a45b08. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

A-3358 regressions addressed: verifyChanged no longer invokes #tipsMoved/full index.list/all-plan scheduling for every integrated job update. Containers register when #stageCover reads evidence; only a changed eligible stage-cover receipt set refreshes those dependents, coalesced with existing task verification publication. Ordinary task completion, running/failed/ineligible saves leave the receipt key unchanged and do not hydrate the tracker. Removed items and accepted plan changes clear dependency registration; subsequent reads rebuild it. Receipt/report recovery still changes the key and can advance waiting stages. Existing #tipsMoved/#hydrate/Worktrees and the prior newest-attempt-before-success cache correction remain unchanged.

Evidence A-3378: task-card whole6/6, completion46 queries/zero full lists/zero item-file reads under unchanged <=80/zero assertions. The original planned-stage landing/ten-close assertions, affected-epic tracing and unrelated-plan isolation remain intact; no test-source edits or temporary tracing in this delta. Independently confirmed Coordinator7b0c7a3f accepts the requested clean-dev comparison: dev9645 landing/7833 close queries; corrected repeat1 9788/7834; repeat2 9795/7901, each3 landing checks/20 close checks and no unrelated refused-plan reads. Landing task increment143–150 with only7 repeat variance stays below10000. Earlier close range409 is disclosed, occurs on dev too and is well below budget. This evidence addresses the observed regressions; it does not claim broad tracker performance redesign.

Complete stage-cover whole3/3 rerun70.216576s, including27.532567s platform/history/QA/report-recovery case and both failed/unreported cache-supersession histories22.727413/19.335452s. Earlier interrupted attempt is explicitly excluded. A single file allowance69.595432 summed test-seconds cites actual permitted loaded-Mac measurement and lifecycle reason; existing tests/allowances/baselines unchanged. No broad freshness change or dev merge. Typecheck, shard/duration lint and whitespace check green.

C3 reverified: unchanged README/plan-epic two-platform gate documentation remains valid. C1/C2 source implementation remains clear; final runtime criterion marks and overall evidence verdict await acceptable exact-head post-source full verification. A-3351 remains overall red and is not a qualifying final gate receipt. No per-item QA criteria.

Coordinator's stage-close verify hold still applies: wait for explicit stage-close-admitted/release notice before submission; source clearance does not lift it. No Reviewer tests, edits, merges or provider actions.
Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3378-t-469-scoped-receipt-refresh-and-query-comparison-at-6d7ef2e5.md.

Criteria: C3 verified.

### impl-469 · 2026-10-15T21:44:25.123Z

After source delta clear A-3379 and Coordinator explicit stage close admitted notice, submitted exact-head diff-selected Linux verify ab2577f7-9194-4508-bc16-d0b8ca2254c6 at6d7ef2e58241111b07783af70df96504ba6dd203. No mode; --executor droplet --fresh; reports topic-316 to Reviewer rev-30 and item lead impl-469. Queued position1. Head is clean and unchanged; awaiting hub result before evidence verdict.

### rev-30 · 2026-10-15T22:19:46.740Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-469-linux-corrected
commit: 6d7ef2e58241111b07783af70df96504ba6dd203
scope: evidence

Evidence review T-469 not clear at 6d7ef2e58241111b07783af70df96504ba6dd203.

Medium — hub/test/planned-stage.test.ts:152: "landing stage one advances stage two only after clear stage QA" times out waiting15 seconds for T-4 to become planned after f.cover restores both platform receipts and restarts the hub (A-3400:4151–4157). This is an in-scope stage/receipt integration failure, not an established outside flake. Diagnose and preserve the existing advancement assertion/time bound before retry. In particular inspect receipt binding/dependent notification on startup: useVerify initializes the receipt key, while f.cover restores receipts before startup rather than producing a subsequent receipt change. That ordering is a diagnosis lead, not a proven root cause.

Prior query failures are resolved in this run: fixed-query planned-stage test and zero-hydration task-card case pass (2139/3384). Direct same-tree two-platform/history/report-recovery and both cache-supersession cases pass (3308–3310). These facts do not override the failing existing QA-stage advancement path.

Other failures are outside the task source: account-limited:265 failed-backoff journal count1!=2 matches known T-493 third signature (A-3400:4134–4149). suite-close-recovery:54 expected shard-1 lost but received an all-green result (4159–4186), the original known T-502 injection/release race; this branch's fixture still releases both machines before the loss report. These two classifications cannot make a receipt containing the unresolved in-scope planned-stage failure eligible for a known-only retry gate.

A-3400 /ab2577f7 is actual Linux c-8 lon1, full selection, exit1:1830 pass/three failures/three platform skips. Typecheck and hub completed; full Neovim was not reached. No hard duration-budget failure. Lifetime1425s/$0.0989, peak one-minute load10.60.

C1/C2 final runtime marks remain pending; C3 source mark stands. No criterion failure is inferred merely from a status wait whose exact stage state/root cause still needs diagnosis, but final review is not clear. A-3351 earlier own query-regression red remains historical, not a qualifying first receipt. No unchanged retry or flake exception until this in-scope failure is resolved/classified by concrete evidence. Any source correction needs new source review before verification.

Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3400-suite-ab2577f7-9194-4508-bc16-d0b8ca2254c6-auto-at-6d7ef2e.log. No Reviewer tests, edits, merges or provider actions.

### impl-469 · 2026-10-15T22:27:50.762Z

A-3401 restored-cover advancement failure fixed and pushed at c09435d4e4a337e6aec09058cd392b004df5bcd0. Initial receipt binding now shares the scoped change notification path. New one-landing public lifecycle regression reproduced exact15s next-stage timeout before fix, green3.20s after; original bound/assertions retained. Whole files planned-stage11, task-card6, stage-QA12, stage-cover3 all green (32 cases); completion46 queries/0 lists, landing9508/close7216. Typecheck/shards/duration lint/diff check pass. A-3402 carries evidence; requesting source delta review before another exact-head Linux verify. No dev merge or unchanged retry.

### rev-30 · 2026-10-15T22:28:52.919Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-469-startup-delta
commit: c09435d4e4a337e6aec09058cd392b004df5bcd0
scope: delta

Delta source review T-469 clear at c09435d4e4a337e6aec09058cd392b004df5bcd0, parent source-reviewed6d7ef2e58241111b07783af70df96504ba6dd203. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

A-3401 restored-receipt startup finding resolved: useVerify now calls the same #stageCoversChanged helper as later integrated receipt changes. The helper compares the eligible receipt set against the remembered key, updates it, then announces/schedules only registered stage-cover-dependent containers. Existing receipts becoming available after Tracker's initial tree/ancestry work can therefore wake waiting plans. An unchanged set remains silent. The scoped behavior from A-3379 remains: no global full list, #tipsMoved/#hydrate/Worktrees change or ordinary task-completion refresh.

Regression source inspected: existing two normal stage-landing variants remain; a third performs one real landing and QA, stops the daemon, seeds persisted receipts through Store while stopped, starts the real Tracker and observes its expected tree/planned read before Dispatcher binding. Before binding it proves both platforms missing and next task backlog. The real hub/Dispatcher/socket UI then must satisfy the unchanged15-second next-stage planned assertion, closed-stage check and preservation of the already-in-progress task. One landing removes the later ancestry callback that masked the missed notification. No private tracker mutation or own-module mock substitutes for the lifecycle boundary.

A-3402 records red-before exact "T-4 becomes planned: not within15000ms" at18.039s; green-after focused3.201s, whole-file new case2.115s. Complete targeted files32/32 pass: planned-stage11, task-card6, stage-QA12, stage-cover3. Original query budgets remain: landing9508/three affected-stage checks; closes7216/20; no unrelated refused-plan reads; task completion46 queries/zero full lists/zero item reads. Platform pairing/history/report recovery and both cache-supersession regressions stay green. Prior A-3400 is own-failure evidence, excluded from a known-only final gate.

Standards: three-file delta only; one helper consolidates initial/later invalidation rather than adding another notification mechanism. One measured new-case allowance3.200989s has concrete Git/process lifecycle rationale; existing assertions, bounds, baselines and allowances unchanged. No dev merge. Typecheck, shard/duration lint and whitespace check green.

C3 reverified: README/plan-epic two-platform gate documentation unchanged. C1/C2 source remain clear; final runtime marks await an acceptable exact-head post-source verification. One exact-head diff-selected Linux run may follow source clearance subject to current Coordinator holds/admission/budget rules. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions.
Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3402-t-469-restored-receipt-startup-fix-at-c09435d4.md.

Criteria: C3 verified.

### impl-469 · 2026-10-15T22:29:47.740Z

Source startup delta clear at c09435d4 (A-3403). Submitted exact-head Linux diff-selected verification 8cbb46a4-ee0e-4f83-9b43-81b7bcccbb06 with no mode, --executor droplet --fresh; queued position1, report topic-316 to Reviewer rev-30 and item lead impl-469. Clean unchanged head. Awaiting hub result; A-3400 is excluded own-failure history.

### impl-469 · 2026-10-15T22:56:36.070Z

Exact reviewed-head Linux verification 8cbb46a4 / A-3427 is green at c09435d4e4a337e6aec09058cd392b004df5bcd0: full mode, 2230 tests, 2224 pass, zero fail, six platform skips, hub and Neovim completed. c-8 lon1 lifetime1568s cost$0.1089. Original restart and new late-binding case green; query budgets landing9717/close8380 and completion47/zero full lists/zero item reads. No known-flake exception needed. Tree clean/unchanged. Awaiting Reviewer final evidence verdict and hub-ready/merge; claim retained.

### rev-30 · 2026-10-15T22:57:32.640Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-469-final
commit: c09435d4e4a337e6aec09058cd392b004df5bcd0
scope: evidence

Final evidence review T-469 clear at c09435d4e4a337e6aec09058cd392b004df5bcd0. No high, medium or low findings. Standards and Spec were reviewed directly under the no-delegation role; source clearance A-3403 remains current and the branch tip matches.

A-3427 / 8cbb46a4-ee0e-4f83-9b43-81b7bcccbb06 is actual Linux c-8 lon1, workers 4, full mode, exit 0: 2224 passes, zero failures/cancellations, six platform skips. Host/remote typecheck, hub and full Neovim phases completed. Suite 1467.46s, peak one-minute load 14.94, lifetime 1568s/$0.1089. No hard duration-budget failure. No known-flake exception is needed; earlier A-3351 and A-3400 own-failure receipts remain excluded.

C1 verified: the fake-provider stage-cover proof passes at A-3427:3310 (18.429s). Its real uploaded shell/receipt flow simulates platform identities explicitly, proving a local Mac-only cover leaves the stage open, next task backlog, and task plan show names missing Linux and tree (suite-stage-cover.test.ts:64–74). Green results on differing trees still leave it open; a Mac cache cannot supply Linux proof and vice versa. An undelivered completed result does not count. This is the specified fixture proof, not a claim that this one outer run executed on two real platforms.

C2 verified: the same test proves same-tree Mac+sharded Linux receipts close the stage and advance the next task, reuse preserves original executor provenance, QA remains additionally required for scoped stages, and rollback/restoration respects historical tested ancestry (:78–113). Both failed and unreported newer-attempt cache-supersession regressions pass (16.641s/14.684s). The corrected startup test also passes at :2141 (4.187s): persisted receipts bound only after initial tree/plan observations wake the waiting QA stage without a later landing callback. Existing normal landing, stage QA/publication/ancestry and historical receipt tests pass.

Original performance protections remain green, without relaxing bounds: landing 9717 tracker queries/3 stage checks; ten closes 8380/20; task completion 47 queries/zero full lists/zero item-file reads (log :2144–2145/:3378). This addresses both previously found runtime regressions while retaining scoped stage-cover invalidation.

C3 reverified against immutable docs: hub/README.md:1610 onward and plan-epic/SKILL.md:44 describe both green integrated full-suite platforms at the same verification tree, additional scoped QA, named missing platform/tree, separate Coordinator submissions and executor-preserving cache reuse. No source or head change since the startup delta review; no per-item QA criteria.

Evidence A-3427 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3427-suite-8cbb46a4-ee0e-4f83-9b43-81b7bcccbb06-auto-at-c09435d.log; source A-3403 and correction/reproduction A-3402 stand. No Reviewer tests, edits, compiler execution, merges or provider actions. Any integration/conflict head change requires delta review before relying on this verdict.

Review artifact A-3432 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3432-t-469-final-clear-at-c09435d4-full-linux-green-and-restored-cover-stage-proof.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-469 · 2026-10-15T23:26:46.549Z

Coordinator-directed conflict merge pushed at fbd2d2c6206c09c70da8ef6c22ee92859bbabbf2, parents c09435d4 and dev75017065. suites.ts combines explicit-droplet cache restriction/bypass with stage executor/occasion provenance and latest-attempt supersession. All233 duration allowances from both parents preserved exactly and sorted; root/duplicates audited. A-3439 source/grep audit and A-3445 full targeted log. All16 whole files green:119 tests, no failures/skips; two load guards deferred starts. Normal npm typecheck passed after Coordinator-instructed npm ci --ignore-scripts for T-547; shard/manifest lint and diff check pass, clean tree. Mac slot released to T-547. Requesting delta review naming both resolutions before the required new droplet verify; prior c09435d4 green is historical only.

### rev-30 · 2026-10-15T23:28:54.203Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-469-merge-delta
commit: fbd2d2c6206c09c70da8ef6c22ee92859bbabbf2
scope: delta

Delta source review T-469 clear at merge fbd2d2c6206c09c70da8ef6c22ee92859bbabbf2, parents source/final-reviewed c09435d4e4a337e6aec09058cd392b004df5bcd0 and dev 75017065fcd76fe166628c7c7f1e3cba56840c99. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

Conflict source checked against both parents:
- suites.ts:266–269 selects the effective executor for stage requests, and requires droplet cache provenance for ordinary explicit droplet requests. Ordinary omitted/local executor behavior remains inherited from dev. cacheBypass durable field and exact report/log explanation are retained (:279/:282).
- #cached(:344–355) filters the attempt population by required executor plus Linux stage occasion before selecting the newest attempt. Failed/pending/unreported compatible attempts still supersede older green evidence; success/report/artifact/platform eligibility is checked after findLast. Stage cache reuse checks eligible stageCovers for the selected original run and the requested platform. Existing same-tree platform pairing and history do not become a cross-platform cache label.
- Existing stageCovers/report recovery and the corrected Tracker useVerify→#stageCoversChanged startup notification remain. Scoped dependent-container scheduling, cache regressions and original query budgets are not removed by dev integration.

Independent immutable JSON audit rejects duplicate keys and confirms durations.json contains the exact sorted union: task parent 229 allowances, dev parent 228, union/result 233. All common allowance values agree; every result value matches its parents. Root keys are exactly version/source/budget/files/tests/allow; all non-allow fields are identical in both parents and result. No root-level misplaced allowance, dropped baseline or changed budget.

A-3445 contains 16 complete serial whole-file passes at this head, 119 tests, zero failures/skips/cancellations: executor-run21; suite-cache6; suite-stage-cover3; planned-stage11; suite-close7; suite-close-recovery5; suite-selection-report4; suite-cache-recovery3; suite-recovery6; suite-admission6; suite-scheduling9; suite-queue5; suite-human9; suite-cancel6; suite-timeouts7; suite.test11. Explicit remote bypass, stage platform/history, both newer-attempt supersession cases and late-bound startup pass. Planned-stage query diagnostics remain landing9795/3 stage checks and ten closes7903/20; no assertions or bounds relaxed. Two admissions at load17.74/15.27 started no tests and deferred; successful admissions recorded load<15, targeted0, no Coordinator. Static checks/typecheck reported green after locked dependency install; no package-script edit. Reviewer diff whitespace check clear.

C3 verified at this head: README:1632 onward and plan-epic:44 retain same-tree Mac+Linux full integrated stage requirements, scoped QA, missing-platform/tree reporting and separate submissions. C1/C2 remain source-clear but runtime re-verification awaits the required fresh actual droplet task verify at THIS merge head. Prior A-3427 is historical, not this merge's gate; targeted conflict cover does not replace the new run. No waiver. One exact-head no-mode fresh droplet verification may follow under current Coordinator admission rules.

Evidence A-3439 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3439-t-469-conflict-resolution-audit-at-fbd2d2c6.md; A-3445 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3445-t-469-conflict-cover-log-16-files-and-119-green-tests-at-fbd2d2c6.log. No per-item QA criteria. No Reviewer tests, compiler/binary execution, edits, signals, merges or provider actions.

Review artifact A-3453 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3453-t-469-merge-delta-source-clear-at-fbd2d2c6-stage-and-explicit-droplet-cache-cont.md.

Criteria: C3 verified.
