---
id: T-2070
kind: task
title: The web workbench refetches events.list (limit 200) on every event frame, so an open workbench polls the hub 200–400 times a minute
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1762
branch: t/T-2070-the-web-workbench-refetches-events-list
created: 2026-11-24T08:59:12.050Z
updated: 2026-11-25T05:41:34.644Z
closed: 2026-11-25T05:41:34.644Z
---

## Summary

Split from T-2037 (its C3) by the 0.4.1 re-triage A-22763, which the human approved on ask 0d31338f. `web/src/connection.ts` (about lines 653–654) sends a full `events.list` with limit 200 on every `event` frame, so the request rate has no bound. On 2026-11-20, an open workbench made 200–400 calls a minute while the hub ran at 70–94% CPU, and hub.log holds over 408,000 such audit lines.

## What to build

Stop refetching the whole list on every event frame. Apply the pushed event as a delta, or coalesce refetches to at most one per bounded interval. Document the resulting idle and busy request rate. Route any key bindings through `web/src/keymap.ts`, and add no dependency.

## Acceptance criteria

- [x] C1. Under a burst of event frames, the workbench issues at most one `events.list` per bounded interval and shows every event (test).
  - done: impl-2070 · 2026-11-25T02:46:22.913Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2070-final · 2026-11-25T04:16:04.767Z · commit ab48071e8cf2ce489ead771c348f41a365d27150
- [x] C2. The idle `events.list` request rate is bounded and documented in the web docs (test plus doc).
  - done: impl-2070 · 2026-11-25T02:03:06.409Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2070-evidence1 · 2026-11-25T02:39:45.496Z · commit 04eebb500983393d5b66f90a16e5e04e404b7953
  - verified: rev-40 [reviewer] · run rev-40-20261125-2070-source4 · 2026-11-25T02:50:46.821Z · commit ab48071e8cf2ce489ead771c348f41a365d27150
  - verified: rev-40 [reviewer] · run rev-40-20261125-2070-final · 2026-11-25T04:16:04.767Z · commit ab48071e8cf2ce489ead771c348f41a365d27150

## Comments

### impl-2070 · 2026-11-25T01:47:08.241Z

Confirmed connection.ts:654 sent one events.list per pushed event. Red T1 regression: 100 !== 0 before the coalescing window. Implemented one-second single-flight summary reads, with dirty follow-up for events during a read. Local macOS Node v24.21.0 focused T1 web-area-state.test.ts: 17/17 passed; no browser or network. No shared wire shape changes; only main-socket summary refresh scheduling changes. Direct T1 consumer search identifies web-area-state.test.ts; Web connection and Events regressions remain for configured verify.

### rev-35 · 2026-11-25T01:54:18.101Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2070-source-1
commit: deb757edb997ecf0a29a6673dbca51b505df6a1a
scope: full
findings: [{"severity":"medium","text":"Dirty clears before the coalesced read; rejection/timeout with no later event leaves the summary stale forever because catch/finally schedule no retry.","file":"web/src/connection.ts","line":354}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23119: single M1 confirmed by15172ad4. Preserve dirty work across failure and retry inside the existing one-second/single-flight bound; add rejection/timeout recovery with final page/row assertions. Successful/slow reads, sustained60/min and zero idle-after-settlement policy otherwise match source/docs; no wire/dependency/key change. C1 failed, C2 runtime remains pending. Hold positively released for correction/fresh committed source review; no configured submission at this head and no reviewer browser/test execution.

Criteria: C1 failed (Last-burst visibility is lost after a failed/missing summary receipt; no bounded recovery/control or scope exclusion exists.).

### rev-40 · 2026-11-25T01:59:58.446Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2070-source2
commit: c50cf98777ac5621f17ad550fcb4ac1f4643ce07
scope: full
findings: [{"severity":"medium","text":"Resolved summary command can publish its queued success handler after disposal or socket replacement; rejectCommands cannot revoke that promise and success publication lacks stopped/live/admitted-socket fencing.","file":"web/src/connection.ts","line":356}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, M2 medium connection.ts:356, confirmed by implementer c8d89849. Capture admitted socket identity and guard queued success publication and associated finalizer mutations; prove result-then-dispose/reconnect races without losing current dirty demand or final page/row assertions. Prior rev35 M1 failed-read recovery is source-resolved. C1 remains failed; restore done after correction. C2 documented event-triggered60/min and zero settled-idle scope is source-consistent but runtime final pending. No dependency/key/wire change; scripted T1 receipts are not configured Web/browser proof. No Reviewer runs. Standards/Spec A-23135: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23135-t-2070-source-not-clear-at-c50cf9877.md.

Criteria: C1 failed (A resolved old summary read can publish after stop/disconnect/socket replacement; add admitted-socket/epoch publication fencing and deterministic race controls (M2).).

### rev-40 · 2026-11-25T02:06:27.972Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2070-source3
commit: 04eebb500983393d5b66f90a16e5e04e404b7953
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear under Coordinator round3 C1/C2 cap; no findings. Clear bar: one-second single-flight event-triggered reads, complete burst/tail visibility after successful receipt, bounded failed-read recovery, no stale disposal/replacement publication; settled-idle zero periodic reads and scoped sustained60/min docs. M2 now captures admitted socket and fences success/catch/finalizer current/live/open/not-stopped; disposal resets admission, deterministic result-then-stop/close/replacement assertions retained, new socket read succeeds. Prior M1 recovery and burst/rate tests preserved. C1/C2 done restored; both final verification marks remain pending configured exact-head result/named cases. Focused23T1/static exits0 are selected localMacNode24.21 evidence, not configured Web/browser proof. No Reviewer runs. A-23145: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23145-t-2070-source-clear-at-04eebb500.md.

### rev-40 · 2026-11-25T02:39:44.422Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2070-evidence1
commit: 04eebb500983393d5b66f90a16e5e04e404b7953
scope: evidence
findings: [{"severity":"medium","text":"Configured Web case fails: 'unfiltered Inbox updates beside filtered Events: not within 6000 ms'; frozen page clock does not advance the new summary timer, leaving C1 visibility proof incomplete.","file":"web/test/events.test.ts","line":382}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear: same-head runfe5c8e3d/A-23189 failedWeb exit1. Literal error 'unfiltered Inbox updates beside filtered Events: not within 6000 ms' at44078; structured exact case fail42104. Paused browser-clock source supports a missed timer consumer (implementer5af308c7), but no Reviewer reproduction/production attribution claimed. C1 failed; retain all exact Inbox/filtered assertions and use lead/Coordinator attribution/window. C2 independently source/T1-established: burst13676, sustained60/min13691, rejection/timeout recovery13696/13701 allpass with settled-idle assertions; separate verify mark does not clear failed run. T0/T1/fallbackT2/selectedT3 exit0, Web executedfailed, T4 unexecuted. Noncached Linuxc8fra1 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4; advisories report-only. Within C1/C2 cap; no Reviewer runs. A-23192: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23192-t-2070-configured-evidence-not-clear-at-04eebb500.md.

Criteria: C1 failed (Exact configured Web Inbox/filtered-Events coexistence case failed its visible-event receipt deadline; correct/prove clock consumer and request fresh source review before rerun.).

### rev-40 · 2026-11-25T02:50:46.821Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2070-source4
commit: ab48071e8cf2ce489ead771c348f41a365d27150
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear, no findings; A-23205. Test-only clock correction aligns page/hub time, arms rendered Inbox receipt before task.edit, keeps exact count/filter assertions and original3000ms bound. Product coalescer/socket fence unchanged. Condition-wait5→6 is the existing pageUntil becoming a directly counted until driver, not a new observation or wider wait: keep frozen allowance unchanged; report-only advisory does not block. C2 refreshed from unchanged source/docs and previously audited rate/idle receipts; C1 final evidence awaits successful exact-head configured run. Paused/throttled browser timers can delay summary freshness; documented rate is an upper bound, not a one-second wall-time freshness promise. A-23201 local isolated1/1,Events12/12,T1 23/23 are scoped author receipts. Previousfe5c8e3d/A-23189 remains failed; no Reviewer execution.

Criteria: C2 verified.

### impl-2070 · 2026-11-25T04:15:31.790Z

Fresh configured run af94f624-a10a-4a99-b26f-90ed728fe8b1 passed at reviewed head ab48071e8cf2ce489ead771c348f41a365d27150; evidence A-23248. T0/T1/T2/selected T3/Web exit 0; 7627 tests, 7626 pass, 0 fail, 1 skip. Linux x64 droplet c-8 fra1, Node 24.21.0, Headless Shell 156.0.8078.4 revision 1248. Exact previously failing coexistence case now has outcome pass in the log. Remaining T3 is deferred to merge batch, T4 not run; report-only budget findings remain. Prior fe5c8e3d stays failed. Awaiting same-head reviewer C1 settlement; claim retained.

### rev-40 · 2026-11-25T04:16:04.767Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2070-final
commit: ab48071e8cf2ce489ead771c348f41a365d27150
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23250. Exact-headaf94f624/A-23248 passed; canonical1328193d executable match. C1 all9summary generated controls structured pass with each5/5load; complete bursts/tail, singleflight, final rejection/timeout retry and stale disposal/replacement fenced. Corrected split-Inbox identity pass42085 with exact count/filter assertions; all12EventsWeb/23web-area-state bases pass. C2 same-head60/min event-triggered and zero settled-idle controls/docs verified; documented excluded reads and suspended-browser freshness limitation retained. Actual T0/all247T1/fallback448T2/selected7T3/55Web exit0,7626pass1Macskip0fail; T4unexecuted/remainingT3batch. NoncachedLinuxx64 c8fra1 workers2 Node24.21/Nvim.12.5 HeadlessShell1248/CfT156.0.8078.4. Budget/lint notices advisory; frozen wait allowance unchanged. Historicalfe5c8e3d stays failed at its prior head. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T05:41:34.644Z

Merged 5e50762b915e6b14a6f2fe76b2295219907ffa9b onto dev.
