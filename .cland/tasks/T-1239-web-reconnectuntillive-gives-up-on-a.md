---
id: T-1239
kind: task
title: "Web reconnectUntilLive gives up on a slow real handshake: offline-asks test fails intermittently"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - bug
  - shared-defect
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-981
branch: t/T-1239-web-reconnectuntillive-gives-up-on-a
created: 2026-10-24T12:27:59.068Z
updated: 2026-10-24T13:09:13.661Z
closed: 2026-10-24T13:09:13.661Z
---

## Summary

Shared defect, flagged by the hub on 2026-10-24 12:26Z. `web/test/asks.test.ts` "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft" fails with `AssertionError: fake-clock hub reconnect is Live; false !== true`, at web/test/harness.ts:53 from asks.test.ts:307.

- It failed in T-1207's verify 74746609 (A-10972, Linux droplet) and in T-1094's run 07b1f675 (A-9808).
- It failed 2 of 5 runs alone on dev 4b617576, local macOS, at machine load of about 10.
- It passed in today's Linux and macOS stage covers.

`reconnectUntilLive` advances the page's fake clock in 250 ms steps, capped at 15 s, inside a 15 s wall-clock wait. Under load, the real WebSocket handshake can outlast the wall budget.

## Acceptance criteria

- [x] C1. `reconnectUntilLive` waits on the real Live receipt within the test's own timeout. Fake-clock advancement keeps its ceiling, but the wall-clock deadline no longer cuts off a slow handshake. Every caller keeps its assertions (test).
  - done: impl-1239 · 2026-10-24T12:33:04.246Z
  - verified: rev-26 [reviewer] · run rev-20261024-1239-final-1 · 2026-10-24T13:01:04.150Z · commit 3034ff5176b28f63d2d28555414b542966373ac3
- [x] C2. The offline-asks test passes 20/20 alone on local macOS in a Coordinator-granted rule-3 window, and in a mode-free Linux droplet run (test).
  - done: impl-1239 · 2026-10-24T13:00:42.380Z
  - verified: rev-26 [reviewer] · run rev-20261024-1239-final-1 · 2026-10-24T13:01:04.150Z · commit 3034ff5176b28f63d2d28555414b542966373ac3

## Comments

### impl-1239 · 2026-10-24T12:30:51.020Z

Baseline unchanged 4b617576: sealed isolated Headless Shell offline-asks passed 10/10 under natural load (~3) and 10/10 under two CPU burners (~3–5), macOS arm64. No duration gate in targeted runs. Asked Coordinator to authorize a temporary held-real-snapshot probe for deterministic red-before-green. Raw logs retained for artifact publication.

### impl-1239 · 2026-10-24T12:33:34.235Z

C1 red-before-green: A-10993 includes actual pre-fix 15000 ms Live timeout and post-fix 22 s passing held-real-snapshot probe under two CPU burners, local macOS arm64, no duration gate. Temporary probe removed. All 11 caller sites across 10 files and final Live assertion unchanged. Review commit 3034ff51 changes only helper plus per-test docs; origin/dev fetched with --no-auto-maintenance and merged before first review. Window B 20-run loop starting at exact committed head; Linux mode-free verification follows source clear.

### impl-1239 · 2026-10-24T12:34:19.263Z

Committed head 3034ff5176b28f63d2d28555414b542966373ac3: offline-asks 20/20 alone passed in Coordinator-granted rule-3 window B, macOS arm64 local, two CPU burners, 12:33:32.057Z–12:34:03.603Z. local:none pre-check and both burner close receipts retained. No duration/load gate in targeted loop. Correction to prior inventory count: 12 helper calls across 10 files, all unchanged. Linux mode-free receipt still pending source clear; C2 not yet marked done.

### rev-26 · 2026-10-24T12:36:48.845Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1239-source-1
commit: 3034ff5176b28f63d2d28555414b542966373ac3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1239 full source review — clear

Head3034ff5176b28f63d2d28555414b542966373ac3, parent/fixed base d76d69fb79ccb2ede084dd04f75a3854a1a66df1. Reviewed git diffd76d69fb...3034ff51 (only Web helper and existing asks guide), task C1/C2, caller inventory, suite timeout invocation, A-10998 native records and Coordinator window decisions. Standards and Spec assessed in-session, no delegation/runtime execution.

## Standards
No findings. The change removes only the independent15 s wall timeout around reconnect receipt polling; it does not increase the fake-clock advancement cap, insert a sleep, change product behavior, relax final assertions, remove caller checks, add native resources/dependencies or alter tiers/fixtures. Existing Playwright evaluation yields to real browser/socket I/O while paused fake time stays bounded. Suite run-suite.ts passes finite --test-timeout; retained standalone collector explicitly uses120000ms. The guide states that direct standalone invocations need a finite test timeout.
All12 helper calls across10 caller files are unchanged: asks, connection, composer, session-actions, topics twice, phone-disconnected twice, area-slots, events, inbox and session-launch. Final exact Live assertion remains. Matching path-headed guide describes ceiling, real receipt, standalone bound and unchanged callers.

## Spec
No findings. The loop waits for rendered "Hub connection" Live under the enclosing test timeout. It advances fake time in250ms increments only while advanced<15000, leaving maximum advancement15000ms; after that it continues yielding/evaluating without more clock advancement. The inner100ms polling interval remains a yield cadence, not a new overall deadline. A delayed real snapshot can complete after the removed wall cutoff. No success is inferred from clock advancement alone.
Coordinator07dd0f4b explicitly authorized the temporary held-snapshot red/green probe and instructed dropping its deliberate16s hold from committed Web tests. A-10998 retains that probe source and original logs; committed asks.test.ts is unchanged. Probe waits for reconnect snapshot, holds real incoming frames, then releases them; route closure clears its timer, fixture cleanup remains. Thus absence of the deliberate slow probe from the committed tier follows the explicit accepted scope, not a missing ordinary regression.

## Evidence
A-10998 retains local Darwin arm64 baseline4b617576: natural10/10 and two-burner10/10 were green, honestly reflecting intermittency. Held-snapshot probe on that base red failed "not within15000ms"; same base + helper fix + identical probe green passed in22173.604334ms (runner22633.507ms), using120000ms enclosing timeout. This development-tree probe is not relabelled as exact-commit ordinary Web timing.

Coordinator grant1b366746-25be-4656-940b-a16db785e5b6 allows two-part exclusive stress windows, max2 burners/5min reproduction and committed-head20-run loop max8min;07dd0f4b permits the temporary probe. Read actual topic decisions as well as artifact claims.
Window B at committed3034ff51:12:33:32.057Z–12:34:03.603Z; queue precheck local:none; two burners, both close receipts recorded. Independently counted20 RUN records,20 native offline-asks successes,20 EXIT0, END passes20/20. Native case durations0.936404459–1.694079709s; actual reported one-minute host load approximately7.46–7.88. Collector stops at first nonzero and uses a sealed disposable environment; stress wrapper bounds its window and closes burners. These are targeted macOS results with no configured duration/load gate, not Linux or full suite evidence.
Web typecheck is reported green in request; no complete original typecheck tool record inspected. Preserve available original command/exit/static receipt provenance without transcription reruns if needed in final evidence.

Disposition: full source clear, findings[]. C1/C2 remain test-dependent/unverified pending same-head configured evidence. Local macOS C2 half has been inspected; Linux mode-free run still required. Submit ordinary configured mode-free verify at unchanged3034ff51, routing result here and to lead; retain actual offline-asks outcome/timing plus overall selection/report-mode scope. Mark C2 done once its stated runtime requirements complete, then request exact-head final evidence settlement. No full-suite/QA/landing claim. Any source change requires fresh review; no post-review dev integration absent Coordinator authorization. Standards0; Spec0 findings.
Durable review A-11005.

### rev-26 · 2026-10-24T13:01:04.150Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1239-final-1
commit: 3034ff5176b28f63d2d28555414b542966373ac3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1239 final same-head evidence review — clear

Head3034ff5176b28f63d2d28555414b542966373ac3, current source review A-11005 unchanged. Original configured log A-11065/run0bc187df-6d93-46bb-9514-7ecd6df936e2 names this exact head; task.view independently confirms passed result and C1/C2 claimant done.

## Standards
No findings. Evidence review only, no source/runtime action by Reviewer. A-11005 already audits unchanged12 caller sites, exact fake-time ceiling/final assertions, enclosing timeout and Coordinator-approved temporary-probe exclusion. MacOS baseline/probe/stress records retain their actual source and targeted scope, not reattributed as Linux configured evidence.

## Criteria
C1 verified across source, authorized held-real-snapshot probe and current full Web receipt. Helper advances paused browser time no more than15000ms while awaiting actual Live under enclosing test timeout; all caller assertions remain. The temporary probe's old helper failed at the removed15000ms wall deadline; helper-fixed development tree passed at22.173604334s once the real snapshot arrived. Coordinator07dd0f4b explicitly required preserving evidence then removing the deliberately slow probe from committed Web code.

All ten caller files pass in configured Web: asks9, connection4, composer8, session-actions9, topics9, phone-disconnected3, area-slots4, events11, inbox23, session-launch10. No caller skip or assertion relaxation. Linux offline-asks exact identity passed1.519108560s.

C2 verified: A-10998 provides committed-head3034ff51 local Darwin arm6420/20 under Coordinator grant1b366746. Source review independently counted20RUN,20 native offline-asks passes,20EXIT0 and END20/20, with local:none precheck, window12:33:32.057Z–12:34:03.603Z, two burners and both close receipts. Native cases0.936404459–1.694079709s. This is targeted authorized macOS stress, not configured load-gate enforcement. Current Linux mode-free receipt supplies the other required platform. Natural10/10 and pre-fix stress10/10 also retained honestly as green intermittent baselines; no hidden failing samples replaced.

## Configured result and limits
Mode-free configured task run, mode full,exit0. T0,allT1,fallback all hub+NeovimT2 and Web complete. Deduplicated native progress2962 ordinary test passes,424 file passes,zero fail/cancel/skip; no actual load-gate identities/repetitions observed (generic runner configuration lines are not repetition evidence). No T3/T4 execution; remaining T3 deferred to periodic dev/integrated occasions.

Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-a3f21456, Nodev24.21.0, Neovimv0.12.5,configured workers2; lifetime673s,cost$0.0467. T0 host check32.057s; remote log explicitly says host gateaa65f90dc84f673881e7cab3bd6b28000c3ed4b5 not repeated (Git identifies tree object). No remote repeated-typecheck claim.
Budgets/lint/ratchet remain report-only:133lint findings/60files, one missing baseline, existing Web items/shell/connection and hub scale/Neovim artifact warnings, projected Web wall over40s. T3 ratchet2195.304s equals base. No enforce-mode budget success inferred; ordinary offline-asks1.519s is below4s Web budget.

Final evidence clear,findings[],C1/C2 all verified across A-11005/A-10998 and exact-head A-11065. QA none/after-stage requires no per-item run. Coordinator owns landing/shared-fix dissemination; retain normal read-only current-dev conflict check without changing reviewed head. Standards0; Spec0 findings.
Durable review A-11066.

Criteria: C1 verified, C2 verified.

### impl-1239 · 2026-10-24T13:01:08.959Z

Same-head mode-free Linux droplet run 0bc187df passed at 3034ff5176b28f63d2d28555414b542966373ac3: T0, all T1, fallback all T2 and Web; 2962/2962. A-11065 contains offline-asks outcome pass at 1.51910856 s (lines 14954–14955), Linux x64 c-8 lon1, lifetime 673 s, cost $0.0467. Duration/test lint gates report-only; host typecheck aa65f90d reused, not repeated; T3 deferred to periodic dev/integrated occasions. C2 marked done; final evidence review queued, no head change.

### coord · 2026-10-24T13:01:36.217Z

Shared fix posted (coord, 13:01Z): commit 3034ff51 went to impl-1207 for T-1207, which has been blocked at 769b33c7 since the offline-asks failure in verify 74746609. The steps there are cherry-pick, delta review and rerun. Any other branch whose Web run hits this test gets the same commit.

### coord · 2026-10-24T13:09:13.661Z

Merged a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5 onto dev.
