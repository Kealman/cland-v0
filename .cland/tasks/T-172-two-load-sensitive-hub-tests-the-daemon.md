---
id: T-172
kind: task
title: "Two load-sensitive hub tests: the daemon stop-log order and the handover
  audit read race their background writes"
state: closed
status: done
criterion_seq: 3
labels:
  - ready-for-agent
  - high
assignee: impl-172
parent: E-19
blocked_by: []
topic: topic-110
branch: t/T-172-two-load-sensitive-hub-tests-the-daemon
created: 2026-10-10T10:45:43.912Z
updated: 2026-10-11T01:56:18.782Z
closed: 2026-10-11T01:56:03.334Z
---

## Parent

T-19 (follow-ups). Seen in T-155's full suite on 2026-10-10 (hub 961/964). Both pass alone, twice each, on T-155's head 37dbb8c. T-149's earlier run also failed a handover case that then passed.

## What to build

Two hub tests read state that a background task can change or have not written yet. Each should wait on the event it means, not on the order or timing of others.

1. `hub/test/daemon.test.ts:295` asserts that the last three hub.log events are exactly `['stopping', 'socket-kept', 'stopped']`. An `orphan-sweep-completed` event from the startup sweep can land between them. Assert the subsequence and order of the three stop events, ignoring unrelated events, rather than the last three lines.
2. `hub/test/handover.test.ts:135` reads the audit log right after the handover and finds no `role.handover` record yet. The audit write lags the reply. Poll the audit log for the record, with the existing `eventually` helper, before asserting its fields.

## Acceptance criteria

- [x] C1. Both tests assert the same facts without depending on unrelated events or write timing.
  - done: impl-172 · 2026-10-10T23:46:17.137Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-172-2 · 2026-10-10T23:47:33.960Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-172-3 · 2026-10-10T23:52:31.252Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-172-4 · 2026-10-10T23:58:14.314Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-172-5 · 2026-10-11T01:33:21.498Z
- [x] C2. Each passes 20 consecutive runs alone and under parallel load (four workers).
  - done: impl-172 · 2026-10-11T00:23:28.639Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-172-5 · 2026-10-11T01:33:21.499Z
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-172 · 2026-10-11T01:55:00.002Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-172-6 · 2026-10-11T01:55:41.930Z

## Notes

Size XS. tech-debt; test-only.

## Comments

### coord · 2026-10-10T10:46:16.055Z

Add a third case: nvim/test/thread.test.ts:637, the append performance budget (2 ms). It missed under full-suite load twice on 2026-10-10: 2.075 ms in T-160's run and 2.17 ms in T-167's run. It passes alone (1.5-1.7 ms). Measure it in a way that load cannot fail (a median of N runs, or a budget relative to a calibration run), or move it out of the default suite into a benchmark, without dropping the check.

### coord · 2026-10-10T11:58:38.028Z

Add a fourth case: hub/test/progress.test.ts:43 expected 'delivered' but saw 'queued' in T-168's full run on 2026-10-10. The file passes 11/11 alone, twice on af1403f and once on dev 53a3187. Wait on the delivery stage event, not on a snapshot taken right after the send.

### coord · 2026-10-10T15:56:11.630Z

Add a fifth case: hub/test/request-guard.test.ts:43 asserts the other client waited under BUDGET_MS*2 behind a 500-request flood. It failed under full-suite load in T-143's run on 2026-10-10 and passes alone (14/14 on dev). Measure relative to an unloaded baseline, or assert ordering, not wall-clock.

### coord · 2026-10-10T16:45:30.217Z

Add: subscriptions.test.ts 'codex: events and progress use one ordered next-turn digest, before and after restart' — digest count 3 vs 2 under full-suite load (T-181 run A-667 on 5f03e20); does not reproduce in isolation.

### coord · 2026-10-10T16:57:14.626Z

Add: hub/test/orphan-servers.test.ts ENOTEMPTY on temp-dir cleanup under full-suite load (T-183 run A-676 on d4561fb, 2026-10-10 16:14Z). Remove with retries or wait for the child to exit before rm.

### coord · 2026-10-10T20:32:41.426Z

Add: hub/test/process-cleanup.ts:165 teardown `kill EPERM` under full-suite load. It failed the Neovim terminal-mode case 'a lone Ctrl+Backslash leaves Terminal mode…' after every behaviour assertion had passed (T-190 run A-779 on e512ec2, 2026-10-10 20:29Z). It passes 9/9 in isolation. Handle an EPERM from an already-reaped or re-parented pid in cleanup.

### coord · 2026-10-10T21:05:07.761Z

Add: nvim/test/vboard.test.ts:178. The rank-operation snapshot gets undefined instead of T-14, a request-arrival race in the test fixture, and dev's test has it now (T-177 run A-782, 2026-10-10). T-190 fixes it in a3cd609 (A-787/A-788). The case closes when T-190 merges.

### coord · 2026-10-10T23:36:03.885Z

Add: the PID-reuse recovery case's session.stop hits its 15s timeout under full-suite load (T-203 run A-885, 2026-10-10 23:34Z). It passes alone in 10s (A-888). Also: request-guard now fails alone at 710ms (A-887) with five suites queued on the machine, so its budget needs an unloaded baseline, not a fixed wall-clock limit. Priority raised: these block every item's C4/C5 under the batch rule.

### impl-172 · 2026-10-10T23:37:10.970Z

Claimed at 01ea28d. Baseline targeted request-guard flood reproduced (915 ms > 500 ms); PID-reuse case passes alone in 8.9 s. Handover audit polling and vboard request-arrival fix are already on dev and will be retained/verified. Starting with the three prioritized cases; recorded symptom evidence gives the diagnosis loop its red-capable signal.

### impl-172 · 2026-10-10T23:42:28.069Z

Committed/pushed f1b1c2b12dec5de6924dc261aa0992a053572cae. A-890 records diagnosis/scope; A-891 is the durable verification runner and A-892 proves its interim own-session HubClient artifact+send completion callback. Typecheck passes. Initial targeted checks pass: calibrated flood, PID reuse, cleanup safety10/10, structured Codex digest and thread CPU/parse budgets. Beginning 20 single-file repetitions alone and under a four-worker pool across all recorded cases, including the already-merged handover/vboard fixes and both Neovim cleanup examples.

### rev-13 · 2026-10-10T23:44:59.747Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-172-1
commit: f1b1c2b12dec5de6924dc261aa0992a053572cae

High — hub/test/process-cleanup.ts:175: tolerated whole-group EPERM leaves groups unmarked and current/targets stale. If a fresh probe confirms all captured identities gone/replaced, the next old member still resends SIGKILL(-group), which can kill the replacement group. Settle that group or refresh/reverify before another signal; add a multi-member EPERM probe. This violates requested identity safety and hub/README.md's verified-group ownership rule.

Both review axes identify this defect (Standards medium, Spec high). Root's synthetic OS/signal probe confirms two SIGKILL(-420013) attempts after first replaces both captured identities and throws EPERM; no real signals or file writes. Existing synthetic cleanup10/10, independent typecheck and diff check pass; clean pinned head. Other assertion/order/acknowledgement/consumption/performance checks retain intended facts; relative flood calibration is explicitly permitted.

C1 failed. C2 repetitions and C3 final full suite remain unverified pending fixed-head evidence. Review A-893: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-893-t-172-review-at-f1b1c2b-unsafe-group-retry-after-eperm.md.

Criteria: C1 failed (After group EPERM confirms captured identities gone/replaced, the next old member repeats SIGKILL(-group) using stale ownership, risking unrelated replacements.).

### impl-172 · 2026-10-10T23:46:07.597Z

A-893 review reproduced before correction: the new two-member EPERM safety probe observed two SIGKILL(-group) attempts rather than one (cleanup10/11). Correction records a group attempt before signalling, so ESRCH/confirmed-gone EPERM cannot leave another stale member eligible to signal a replacement group. Live captured-identity EPERM still fails. Superseded f1b1c2b repetitions were terminated through start-identity-verified positive-PID tree cleanup; partial log A-894 is retained, not C2 evidence. Restarting all repetitions on the corrected head.

### rev-13 · 2026-10-10T23:47:33.960Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-172-2
commit: fbf8754df9754c30a80175a4b093af358fc24d4f

No high or medium findings remain. A-893 cleanup defect fixed: process-cleanup.ts:167 marks the group attempted before signalling, preventing another stale member from retrying after EPERM/ESRCH. Fresh EPERM inspection still rejects a live captured identity. New two-member regression requires one group signal and preserves both replacements. Standards and Spec both clear; unchanged full-item C1 assertion review stands.

Independent typecheck/diff check pass; clean pinned head. Synthetic cleanup11/11 passes, zero failures/cancelled/skipped/todo, with mocked OS tables/signals and no file edits. C1 verified. A-894 cancelled pre-fix repetitions are not C2 evidence; C2/C3 remain pending completed fixed-head repetition and final merged-head full-suite evidence. Final readiness is withheld.

Review A-896: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-896-t-172-re-review-at-fbf8754-cleanup-safety-fixed-validation-pending.md.

Criteria: C1 verified.

### impl-172 · 2026-10-10T23:50:07.546Z

Fixed-head four-worker repetitions A-899 stopped on rendering repetition7: CPU append2.118 ms (wall2.120), rewrite31.220 ms, exact parse counts correct, teardown passed. Other cases passed their completed6–7 runs. CPU clock alone does not remove machine contention/frequency variation. Using the Coordinator’s explicit 10:46Z option to move absolute speed budgets out of the default suite into a benchmark without dropping them: default keeps exact cache assertions and append at least8x cheaper than the same-machine warm rewrite; npm run benchmark:thread additionally enforces absolute2ms/35ms CPU limits. Restarting required20-run checks after review of this change; previous partial repetitions are not C2 evidence.

### rev-13 · 2026-10-10T23:52:31.252Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-172-3
commit: e32e8c7955fbecbe61c10d8cdcf2a4a7fbd08bc0

No high or medium findings. Both axes clear: the Coordinator explicitly permits moving the absolute rendering check into a benchmark. npm run benchmark:thread selects the renamed case and enables retained2ms/35ms limits; default retains exact200cold/0warm parse checks and appendCPU at most one eighth of same-machine warm rewrite. A-900's full-render-on-append mutation fails the new comparison, and its production mutation is absent from the clean pinned delta. A-896 cleanup safety stands.

Independent typecheck/diff pass. Durable mutation evidence inspected; writing Neovim tests not independently rerun. Lead reports benchmark1.658/25.235ms; complete benchmark output was not attached and is not counted as independent execution. A-899's superseded partial repetitions are not C2 evidence. C1 verified by cumulative full-item/delta review; C2/C3 remain pending final-head20alone/four-worker repetitions and final merged-head full validation. Final readiness withheld.

Review A-901: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-901-t-172-c1-at-e32e8c7-rendering-benchmark-retained-default-regression-check-clear.md.

Criteria: C1 verified.

### impl-172 · 2026-10-10T23:56:51.055Z

A-906 four-worker repetitions reached14 rounds; only vboard round14 failed with `no row T-21` in select(), before any rank request. The T-190 request-arrival barriers are intact; this is an additional startup race: start() waits for hub:connected before task.list snapshot/render, then select() reads the empty panel. Fix makes selection wait for the actual rendered item row before setting the cursor. Other cases14/14 (vboard13/14) including relative renderer, PID-reuse, cleanup, Codex digest and both cleanup behavior examples. C2/C3 remain pending complete checks.

### rev-13 · 2026-10-10T23:58:14.314Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-172-4
commit: 087f086fd8925f5deb0a0bcf081494ee9eb6b34b

No high or medium findings. Both axes clear: vboard.test.ts:158 waits for the actual rendered item row before the existing exact items-buffer selection. That lookup still fails if absent. All request-arrival barriers and rank/order/next-marker/cursor/refusal/audit assertions remain unchanged. Prior cleanup safety and rendering benchmark/default checks stand.

Independent typecheck/diff pass, clean pinned head. A-902 complete unchanged rendering benchmark now inspected: exit0,1/1, zero fail/cancelled/skipped/todo, CPU1.658/25.235ms and exact200cold/0warm parses; supplements previously reported evidence, not independent execution. A-906 superseded partial repetitions fail vboard round14 and are not C2 evidence. Lead reports current targeted1/1; writing Neovim tests not independently rerun. C1 verified cumulatively; C2/C3 pending complete final-head repetitions and final merged-head full suite. Final readiness withheld.

Review A-908: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-908-t-172-c1-at-087f086-rendered-row-wait-preserves-rank-assertions.md.

Criteria: C1 verified.

### coord · 2026-10-11T00:00:47.464Z

Add: 'ready and the merge gate agree on one fixture: stale patch, unchanged rebase, qa-required=false' timed out at 84s under machine load 17 (T-193 run A-909, 2026-10-11 00:00Z). Also, request-guard failed alone on dev 01ea28d at 3871ms under the same load (A-911). Both point to machine overload from 5 concurrent full suites plus stress runs, as much as to fixture timing.

### impl-172 · 2026-10-11T00:23:28.717Z

A-926 final-head repetitions at clean unchanged087f086 pass every recorded case20/20alone and20/20four-workers. Archive independently parsed:440 single-file invocations,22 phase/case buckets,920tests/pass920, zero failures/cancelled/skipped/todo. Includes cleanup11 safety probes each run, both deleted-project cases, both Neovim cleanup behavior examples, and retained handover/vboard fixes. Four-worker batch was already running when Coordinator's new lock rule arrived and finished under its explicit current-round allowance; subsequent four-worker batches will queue via dev runner. C2 marked done; fetching/merging currentorigin/dev before own complete package validation.

### impl-172 · 2026-10-11T00:25:20.941Z

Coordinator's00:00:47Z comment adds the ready/merge-gate qa-required=false fixture while A-926 was running. Its isolated run on087f086 passes1/1 in20.3s, with unchanged current dev. Adding20alone and20four-worker runs for this additional case; the four-worker phase uses exported dev runSuite with queued /tmp/cland-suite.lock admission. Existing A-926 evidence remains valid for unchanged cases, but C2 verification should wait for the additional case evidence. Own complete package validation follows after a fresh origin/dev fetch/merge.

### coord · 2026-10-11T00:39:35.938Z

Standing rule (Coordinator, 2026-10-11 00:40Z): until T-172 merges, reviewers may verify a full-suite criterion with this item's cases named as exceptions (request-guard flood, PID-reuse stop timeout, thread append budget, cleanup EPERM, ready/merge-gate timeout, vboard rank race). This holds only when both phases ran, each excepted test passes alone on that head, and there is no other failure. The rule ends when T-172 merges.

### coord · 2026-10-11T00:40:47.695Z

Amendment (00:41Z): the request-guard flood test fails alone on dev too (3871ms on 01ea28d, 782ms on T-184's 52ac888, 813ms on T-193's 639dab5), and only T-172's branch passes it. For that test only, the exception condition is 'fails the same way on the merged dev base', not 'passes alone'.

### impl-172 · 2026-10-11T01:29:37.525Z

Additional ready/merge-gate fixture completed20/20alone+20/20four-workers on clean unchanged087f086; A-951 independently parsed40tests/40passes, zero failures/cancelled/skipped/todo. Four-worker phase held the queued machine lock (3214s queuewait,63s execution). Together A-926+A-951 cover480 selected single-file invocations/960 tests. Fetched and conflict-free merged origin/dev33e9cf5 (T-203 suite/T-213 etc.) into bc36fce7e86ea6d371c29cf037ee35dca75c3197, then pushed origin. T-172 patch relative dev remains the reviewed13-file delta. Requesting review and starting own full typecheck+both phases through cland suite on this merged head.

### rev-13 · 2026-10-11T01:33:21.499Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-172-5
commit: bc36fce7e86ea6d371c29cf037ee35dca75c3197

No high or medium findings remain in the merge integration. Standards and Spec reviews are clear. The T-172 patch at bc36fce is identical to the reviewed patch at 087f086 (stable patch-id 767db78b32f7f84d765782eca0d6a077876746bb); incoming artifact/suite integration preserves the affected cases. C1 is verified. C2 is verified by carrying forward A-926 and A-951 on 087f086: 480 successful invocations across 24 complete alone/four-worker buckets, 960 passing tests, no failures, cancellations or skips. These are unchanged-case repetition evidence, not a fresh merged-head full suite. Independent typecheck and diff checks pass on bc36fce. C3 remains pending the merged-head full run; this verdict does not establish final readiness. Evidence: A-952 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-952-t-172-merge-review-at-bc36fce-c1-c2-clear-960-repetition-passes.md.

Criteria: C1 verified, C2 verified.

### impl-172 · 2026-10-11T01:55:00.159Z

Final cland suite all e0a97cbf-24ba-45f6-bd89-50e8c4efb4e0 completed exit0 on clean unchanged merged headbc36fce7e86ea6d371c29cf037ee35dca75c3197. A-980 confirms typecheck passed, hub1103/1103 and Neovim252/252 (1355/1355 total); zero failed/cancelled/skipped/todo. No exception applied. C3 marked done and final reviewer verification requested. Claim retained until merge.

### rev-13 · 2026-10-11T01:55:41.930Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-172-6
commit: bc36fce7e86ea6d371c29cf037ee35dca75c3197

No high or medium in-scope findings. C3 verified: A-980 hub-owned all run e0a97cbf executes typecheck then full npm test and exits0 on bc36fce. Complete hub1103/1103 and Neovim252/252, combined1355/1355; zero fail/cancelled/skipped/todo and no failing-test lines. No exception applied. Counts and command/phase completion independently inspected read-only; writing suites not independently rerun. Current worktree clean and unchanged at the pinned head; diff check passes.

Same-head Standards/Spec and C1/C2 verification from A-952/rev-13-20261011-172-5 stand;480 repetition invocations/960 passes support C2. All criteria now done and verified, so review gate complete for bc36fce. Standing T-172 exceptions end upon actual merge, not this review verdict.

A-981: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-981-t-172-final-c3-at-bc36fce-full-suite-1355-1355-clear.md.

Criteria: C3 verified.

### coord · 2026-10-11T01:56:03.042Z

Merged 4990b6a4c371a78b378c58e35d90fecf671ff0ac onto dev.

### coord · 2026-10-11T01:56:18.782Z

Merged 4990b6a (2026-10-11 01:57Z). The standing exception rule ends for any head that contains 4990b6a. Runs on older heads (T-178 e98771b, T-179 2dcb539, T-186) still carry the old tests, so the rule applies to them until they merge dev.
