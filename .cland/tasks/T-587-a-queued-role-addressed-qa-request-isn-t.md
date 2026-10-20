---
id: T-587
kind: task
title: A queued role-addressed QA request isn't delivered when the verifier goes idle
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - hub
assignee: null
parent: E-952
blocked_by: []
topic: topic-712
branch: t/T-587-a-queued-role-addressed-qa-request-isn-t
created: 2026-10-16T10:42:55.641Z
updated: 2026-10-20T10:17:03.277Z
closed: 2026-10-20T10:17:03.277Z
---

## Summary

A `qa request E-387` sent to the `qa` role at 10:28:27Z came back `queued` ("waiting for the next free live verifier for E-387; the hub will deliver automatically"). It stayed undelivered for about 20 minutes, while the only QA session, qa-27, was idle with no holds (`who` at about 10:48Z). The Coordinator resent it to qa-27 by name, and that reached it.

## Context

- At queue time, qa-27 had just recorded its E-423 verdict (10:27:34Z) and released its E-423 hold. It was probably still busy finishing its turn.
- The hub had restarted at 10:13:46Z (pid 29477).
- Likely cause: the queue is drained only on a specific verifier event, such as a hold release or a state change to idle, and that event fired before the request was queued, or isn't wired for that event.

## Acceptance criteria

- [x] C1. A role-addressed review or QA request that is queued while every verifier is busy reaches the first verifier that becomes idle or free, within one state change, including after a hub restart.
  - done: impl-587 · 2026-10-20T10:03:11.118Z
  - verified: rev-26 [reviewer] · run rev-20261020-587-final-1 · 2026-10-20T10:11:54.747Z · commit fb532ce534748556391d34eea7d9293d3aa444de
- [x] C2. A test reproduces the order: verdict, then hold release, then request queued while the verifier's turn is still running, then the verifier goes idle. The request is delivered.
  - done: impl-587 · 2026-10-20T09:51:38.184Z
  - verified: rev-26 [reviewer] · run rev-20261020-587-source-2 · 2026-10-20T10:03:50.689Z · commit fb532ce534748556391d34eea7d9293d3aa444de
  - verified: rev-26 [reviewer] · run rev-20261020-587-final-1 · 2026-10-20T10:11:54.747Z · commit fb532ce534748556391d34eea7d9293d3aa444de

## Comments

### coord · 2026-10-16T12:11:01.529Z

Second instance, 2026-10-16 12:10Z: `qa request E-426` to the `qa` role in topic-372 came back `queued` ("waiting for the next free live verifier for E-426"). qa-27 had released its E-387 hold at 11:35Z and sent its last report at 11:35Z. The Coordinator pointed qa-27 to it by name. The first instance, E-387 at 10:28Z, was delivered 14 minutes later at 10:42:44Z.

### coord · 2026-10-16T12:11:20.213Z

Correction to the 12:11Z entry: the queued E-426 request was assigned to qa-27 at 12:11:13Z, about 1 minute after it was queued. qa-27 was probably still finishing a turn, so this second instance is normal queueing, not the bug. The 10:28Z case (14 minutes while idle) stands.

### impl-587 · 2026-10-20T09:51:37.378Z

Reproduced the queue stall at T2. Correction to Context: drain hooks are present; hasPendingWork counted an old uncertain delivery indefinitely. Read-only live evidence found uncertain tracker-storage-fatal notices for rev-23 and rev-26 with empty pool-handoff values. Coordinator approved excluding uncertain non-verification traffic from staffing, while preserving received/held verification reservations. Fix and tests cover QA/review, restart, exact outage notice, prior-reviewer affinity, pending-to-hold transition and pool reuse. Targeted 15/15 tests, hub typecheck, static checks and diff checks pass; preparing source review.

### rev-26 · 2026-10-20T10:00:53.104Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-587-source-1
commit: 064ed87a2d454dfc705ddc432979b276a2d1e0a4
scope: full
findings: [{"severity":"medium","text":"Delivered→uncertain now frees staffing eligibility, but markUncertain never drains queued verifier requests. If idle arrives while the operational injection is still delivered, that drain remains blocked; the later uncertain receipt leaves a free verifier's request queued until unrelated activity. Same-state idle polls return early. Add the inverse-order held-inject regression and retry the queue at this eligibility change, preserving verification reservations and no replay.","file":"hub/src/hub/core.ts","line":1351}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: no separate finding; existing T1/T2 seams, receipt waits and README match the intended change. Spec: medium core.ts:1351 late uncertainty transition still strands queued work. Existing tests make injection uncertain before idle, so do not cover idle-first ordering. Pending→hold transition, affinity filters and pool reservation otherwise checked. C2 regression shape is present; source is not clear and corrected head requires review before mode-free verify. Reviewer ran no tests.

Criteria: C1 failed (An idle transition before the outstanding operational inject becomes uncertain leaves queued verifier work undrained after eligibility clears.).

### impl-587 · 2026-10-20T10:03:11.038Z

Fixed source review finding M1/C1 at fb532ce5: markUncertain now drains queued verifier requests when delivered operational input stops blocking staffing. Held-inject inverse ordering was observed red: expected ['rev-d'], actual ['reviewer']; verification-reservation control passed. New head's local macOS direct T2 routing file passes 11/11, hub typecheck and diff check pass. No suite/duration gate receipt claimed. Original targeted receipts preserved in A-7325; red stdout A-7327, revised routing stdout A-7328. No origin/dev merge after first review.

### rev-26 · 2026-10-20T10:03:50.689Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-587-source-2
commit: fb532ce534748556391d34eea7d9293d3aa444de
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no finding; held-inject tests observe exact clause/injection/uncertainty receipts, use in-process fake adapters/FakeClock and preserve no-replay assertions. Spec: M1 resolved by draining after durable uncertainty/inbox recording. Operational idle-before-uncertain now frees assignment; uncertain verification remains reserved until verdict. Original restart, affinity, hold and pool protections are unchanged. A-7327 exact red and A-7328 local routing 11/11 green checked; A-7325 preserves original targeted stdout/exits/timings with partial/report-only limits. C2 source verified; C1/final execution stays pending mode-free task receipt at fb532ce5. Reviewer ran no tests.

Criteria: C2 verified.

### impl-587 · 2026-10-20T10:11:45.205Z

Mode-free verification 1e677f9a-9711-48b5-bcd5-e5d708acf3d2 passed at unchanged source-reviewed head fb532ce534748556391d34eea7d9293d3aa444de. Linux x64 droplet c-8 lon1, 380s lifetime, $0.0264. Host check + all admitted T1/T2 passed: 1954 tests, 0 fail/skip/cancel. All eight new resolver/routing identities have 5/5 load-gate receipts in A-7379. T3 was not executed; deferred to periodic dev/integrated occasions per configured batch tiers. Lint and duration/ratchet gates report-only; routing file duration rose 0.823s→2.142s with added cases. Awaiting Reviewer final settlement; no new head changes.

### rev-26 · 2026-10-20T10:11:54.747Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-587-final-1
commit: fb532ce534748556391d34eea7d9293d3aa444de
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no finding. A-7379 exact-head mode-free task gate passed; host check/typechecks green, existing lint/budgets report-only. Routing file 0.823→2.142 s diagnostic remains below T2 file budget; no bounds changed. Spec: C1/C2 verified at fb532ce5 with run1e677f9a, 1954/1954, no failures/skips/cancellations. Parsed actual resolver3/3, routing11/11, crew-launch3/3 base passes and 5/5 repetitions for the fatal-notice T1 plus all seven new T2 identities (QA/review/restart/reservation/late uncertainty); maxima .062599s T1/.439789s T2. Linux c-8 lon1, two workers, lifetime380s/$0.0264; T0–T2 fallback includes Neovim, T3 deferred/not claimed. Source clear A-7334 retained; Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:17:03.277Z

Merged a71d0339845bd203cb978433e766baeb9ce7a3d3 onto dev.
