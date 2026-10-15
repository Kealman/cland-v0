---
id: T-508
kind: task
title: "heartbeat test: run-digest aging case fails once and leaves the test runner hanging (Mac, quiet)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-454
topic: topic-311
branch: t/T-508-heartbeat-test-run-digest-aging-case
created: 2026-10-15T15:33:39.730Z
updated: 2026-10-15T18:42:16.681Z
---

## Problem

`hub/test/heartbeat.test.ts:155`, 'the digest includes running and queued runs and ages timeouts and ended runs without results', failed in a quiet whole-file run on the Mac (2.413 s), in impl-506's fifth T-506 repetition on 2026-10-15 at about 15:31Z. The four earlier runs were green. The runner then hung after printing every case, without a final summary, which suggests a timer or handle the case leaves open. It's T-454's test, so it's rework of T-454.

## Acceptance criteria

- [x] C1. The case's aging of timed-out and ended runs depends only on a controlled clock and observed state, and the case closes every timer and handle so the runner exits. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-508 · 2026-10-15T17:56:30.048Z
- [x] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, each run exiting on its own, plus once on a droplet in the task's verify.
  - done: impl-508 · 2026-10-15T18:38:45.997Z

## Comments

### coord · 2026-10-15T15:35:06.843Z

Correction from impl-506 at 15:34Z: once the runner was stopped, the flushed log showed the real failure. It was ENOTEMPTY on rmdir of the scratch dir cland-suite-cli-* during the run-digest case teardown, not a clock assertion. That is the same family as T-498 (rm racing a live writer), so the fix is in the teardown. C1 should read: teardown waits for, or retries past, the live writer, and the runner exits.

### impl-508 · 2026-10-15T17:38:37.401Z

Investigating the corrected teardown failure (ENOTEMPTY on cland-suite-cli-*), rather than changing clock assertions. Mac tests wait while the local verify slot belongs to Coordinator. Will retain every existing assertion and produce five serial whole-file runs plus reviewed-head droplet verify.

### impl-508 · 2026-10-15T17:40:17.525Z

Historical failure predates T-393 (10fa25e2) by about one minute. That merged change already waits for both run results before fixture teardown and stops an embedded hub before removing its directory. Skipping a new stress reproduction/minimisation while local: coord holds the Mac: the original ENOTEMPTY receipt and this exact one-case lifecycle provide the regression seam. Ranked causes: (1) unobserved queued worker still writing at removal (addressed on success by T-393); (2) native Coordinator t.after skipped after the cleanup error, stranding its MCP client/spoke (still present); (3) hub writes still in flight (embedded stop now awaited before removal). Scope: keep assertions/deadlines, make settlement run even after an assertion failure, and register the Coordinator in ownership cleanup.

### coord · 2026-10-15T17:47:47.564Z

Impact: the run-digest hang now costs whole verifies. T-396's droplet run 8d628041 hit the 50 min remote timeout (exit 124, $0.21, A-3213), stuck in "the digest includes running and queued runs…". This ticket is the priority among the heartbeat lane.

### rev-30 · 2026-10-15T17:57:52.925Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-508-source
commit: f7643725299cdd3176341f583178d476629d0cf8
scope: full

Source review T-508 clear at f7643725299cdd3176341f583178d476629d0cf8, fixed point 9bc15ce821eb85b0254d7bf034481b857d11ff18.
Standards: no high/medium/low findings. Review performed directly under no-delegation role. Only the heartbeat run-digest case changes, plus its cleanup import. Coordinator spoke now registers onCleanup; the existing ownership hook disposes every resource despite individual errors, then stops hubs, removes directories and checks leaks. Native after-hook ordering can no longer skip this spoke close after a directory cleanup error.
Spec: no high/medium/low findings. Reviewed C1 against Coordinator's explicit corrected item comment: fix teardown/live writers and runner exit, not the aging assertions. Original running/past-timeout, queued/human and ended-without-report digest assertions and their 2500ms bounds remain. The normal success path still submits two runs and requires their two exact report IDs.
The finally block runs after any digest assertion failure: it releases the finish barrier, observes an atomic result.json completion receipt for every tracked submitted run with bounded eventually, restores report permission, then starts a separate bounded exact-report wait. This satisfies rule 10's completion-before-report separation; queued/running concurrency observations remain before release. Receipt publication is the worker's final operation after command/lease cleanup; ownership teardown additionally drains captured processes and the embedded hub before removing the root (rules 9/12). A receipt wait failure stays a failure; no blanket suppression or widened deadline.
Commit cb1c2c43 records the live queued writer/ENOTEMPTY and skipped native-spoke-cleanup causes. A-3212 diagnosis and A-3222 partial evidence read. Three quiet serial whole-file Mac runs at 176e4df7 each pass 9/9 and exit naturally (19.899–20.833s); changed digest case approximately 3.09–3.12s. Confirmed heartbeat source byte-identical at requested f7643725 after tracker-only integration. These are three passes, not the five required by C2.
No criteria finally verified on this source pass: C1's cleanup structure is source-established but final runner-exit settlement and C2's remaining two Mac files plus droplet receipt remain pending. No new QA brief required by item policy. Diff whitespace check passes; requester reports typecheck green. Source clear permits one exact-head droplet verification while the remaining Mac files wait for their authorized quiet window. No Reviewer tests, edits or provider calls.

### impl-508 · 2026-10-15T17:58:16.682Z

Source clear at f7643725299cdd3176341f583178d476629d0cf8 (Reviewer rev-20261015-508-source, A-3225). Submitted exact-head droplet verify after that verdict. Three quiet whole-file Mac passes in A-3222 (9/9 each; 19.90–20.83s; changed digest case 3.09–3.12s), natural exits. Remaining two passes are waiting on guard-only automation for the executing local impl-510 suite; no concurrent Mac test or suite cancellation. Candidate unchanged except tracker-only pre-review merge after those passes. C2 remains pending full evidence.

### impl-508 · 2026-10-15T18:09:55.392Z

Mac portion of C2 complete: five serial whole-file heartbeat.test.ts passes, 9/9 every time with natural exits (3 quiet +2 loaded). Runs4/5 at exact reviewed f7643725 beside non-Coordinator T-510 suite were authorized by Coordinator decision 1b124f76 / clarification63b9252c; load13.31/11.64, no other targeted file. Wall27.71/28.61s, changed digest3.20/4.20s. Targeted window released to T-459 and T-512 at18:09:06Z. Complete evidence artifact publication hit `artifact reservation moved`; original partial artifact A-3222 remains. Linux receipt263c9910 pending; C2 remains open until it arrives.

### rev-30 · 2026-10-15T18:11:01.772Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-508-mac-evidence
commit: f7643725299cdd3176341f583178d476629d0cf8
scope: evidence

T-508 Mac evidence pass clear at unchanged source-reviewed f7643725299cdd3176341f583178d476629d0cf8. No new source findings.
A-3233 contains five serial whole heartbeat files, each 9/9, 45 passing cases total, zero failures/skips/cancellations, with natural exits and no forced stops. Runs 1–3 are quiet at source-identical 176e4df7, already checked against f7643725; runs 4–5 are at exact reviewed head and labelled loaded beside non-Coordinator T-510 verification. Coordinator 1b124f76-537f-4af4-8664-f4e4a9673679 explicitly permits those labelled loaded passes under load<15 with no local:coord and no other targeted file. Admission loads for loaded runs are 13.31 and 11.64.
Changed digest case completes in 3.095/3.111/3.120/3.202/4.197s; whole files exit naturally in 19.899–28.607s. This establishes the Mac portion under the explicit routing decision; no false five-quiet/alone claim.
C1/C2 final verification remains pending the exact-head droplet result. task.view shows 263c9910-b5b7-43bb-940f-61e17a02ef5a launching at this head. Check actual executor/platform before claiming Linux because fallback/cache evidence may be local. No additional source review or duplicate run needed while that request is pending. No Reviewer tests or edits.

### impl-508 · 2026-10-15T18:38:46.943Z

C2 file-level evidence complete: A-3233 five serial whole-file Mac passes (3 quiet +2 loaded; 9/9 natural exits each) plus actual Linux c-8 droplet verify263c9910/A-3259 at reviewed f7643725. Linux heartbeat file all9 green, changed digest5.8069s (log1317/4544), file exits without hang. Overall run remains red: executor-run:190 startReplyLost PROCESSWRAP leak-check failure and rule-sessions over-cap clause duration5.133s>5. Neither is touched by T-508; exact E-482 classification not yet established, reported to supervising Lead. Gate remains pending classification and accepted evidence; no source change or retry submitted.

### rev-30 · 2026-10-15T18:39:20.720Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-508-linux-first
commit: f7643725299cdd3176341f583178d476629d0cf8
scope: evidence

T-508 first Linux evidence not clear at unchanged source-reviewed f7643725299cdd3176341f583178d476629d0cf8. A-3259 / 263c9910 is actual Linux c-8, exit 1: 1781 pass / 2 reported failures / 3 platform skips; no cancellation. The two reported failures are the executor-run parent and its startReplyLost nested case.
All nine heartbeat cases complete green, including changed digest case 5.807s (:4544), with no heartbeat teardown failure or hang. A-3233's accepted five Mac files remain valid. This establishes own-file execution evidence but not the final gate.
Medium gate blocker / aside Bugs S — hub/test/executor-run.test.ts:190, startReplyLost: projectHub strict cleanup observes PROCESSWRAP after expected resource closure (A-3259:4028–4055). The parent remote-start reconciliation case fails with it. No exact known-item classification is established in the request; do not call it a known flake or automatically retry under the two-receipt rule yet. Root cause is not established by this receipt.
Medium gate blocker / aside Tech debt XS — hub/test/durations.json, missing allowance for hub/test/rule-sessions.test.ts::a clause larger than the send cap reaches a session whole on assignment and reconnect: 5.133s exceeds the hard 5s budget (A-3259:5749). This is a different identity from d5442c61's existing rule-session exception. Lead classification/shared allowance needed.
No new T-508 source defect established; C1/C2 final verification remains pending acceptable gate disposition. Requester already reported both asides to lead and is holding unchanged head, with no duplicate run. No Reviewer tests, edits or provider calls.

### rev-30 · 2026-10-15T18:41:47.227Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-508-delta
commit: c90f7f3847b47971050c884e7c0d58aa8ee57e79
scope: delta

Delta source review T-508 clear at c90f7f3847b47971050c884e7c0d58aa8ee57e79, parent f7643725299cdd3176341f583178d476629d0cf8. No high, medium or low findings.
Standards: only hub/test/durations.json changes. Heartbeat test blob is byte-identical. Parsed comparison finds zero removed or changed files/tests/allow entries. The seven new allowances are six already integrated/previously reviewed demo lifecycle exceptions plus Coordinator-posted 7cdf2dd0's over-cap clause exception at 5.133s with A-3259 provenance. Source measurement provenance retains the integrated demo receipt; Unicode escaping/reformatting changes no parsed values.
Spec: resolution follows the requested exact-dev-manifest approach for a task with no owned duration entries. Commit pins dev 7cdf2dd0c71a050153b43f05be791bd88f2f0240; resolved manifest is byte-identical to fetched origin/dev at review. No dev merge, production behavior, heartbeat assertion or timing-bound change. No extra local run is needed for this shared-only manifest delta.
Confirmed Coordinator 7d765303 and fbb61c7f in topic history: A-3259/263c9910 counts as first Linux receipt; its PROCESSWRAP startReplyLost failure is now T-523, and 7cdf2dd0 covers the independent clause budget. Heartbeat was 9/9, changed digest5.807s and naturally completed. A-3233's five Mac files remain accepted, including the two explicitly authorized loaded runs.
C1/C2 final marks remain pending the accepted second receipt. Source clear permits exactly the directed --executor droplet --fresh verify once remote is <=3/4, under current Coordinator throttle; no duplicate/local test run requested. No Reviewer tests, edits or provider calls.

### impl-508 · 2026-10-15T18:42:16.681Z

Coordinator fbb61c7f accepted first receipt263c9910/A-3259: external executor PROCESSWRAP leak is now E-482 T-523; clause budget covered by shared7cdf2dd0. Pick conflicted; resolved per Coordinator18:26 rule by taking origin/dev manifest exactly, no task-owned allowances. Resolution c90f7f38 preserves all prior semantic values and heartbeat source; Reviewer delta clear rev-20261015-508-delta/A-3264. Checked remote3/4, clean exact reviewed c90f7f38; submitted second fresh droplet c19b825b-2c28-4e9e-a3dd-fd8c0a6689ad with no mode, --executor droplet --fresh. Awaiting same-head result; no new head changes.
