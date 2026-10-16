---
id: T-585
kind: task
title: claude-code-adapter "discovery and watch share the default 30-second schedule" counts 2 calls instead of 1 on a loaded droplet
state: open
status: review
size: S
rank: 4445
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
  - v0.1.4
assignee: null
parent: E-482
blocked_by: []
topic: topic-403
branch: t/T-585-claude-code-adapter-discovery-and-watch
created: 2026-10-16T08:50:52.161Z
updated: 2026-10-16T17:33:04.606Z
---

## Summary
Integrated cover 0000625b at dev 3a3b4633 (droplet, 2026-10-16 08:49Z) failed hub/test/claude-code-adapter.test.ts:353, "Claude discovery and watch share the default 30-second schedule, and stop works before the next pid arrives": "launch discovery and watch use one call", actual 2. The case passed 3/3 alone on dev on a quiet Mac. Under load the shared schedule apparently fires a second discovery before the watch takes over: either a timer-ordering race in the adapter or a test that counts calls across a boundary load can shift.

## Acceptance criteria
- [x] C1. Find whether a real double discovery happens under load (a product issue: fix the adapter so they share one call) or the test counts across a timing boundary (a test issue), fix the cause, and record it on this item.
  - done: impl-585 · 2026-10-16T17:32:06.901Z
  - verified: rev-30 [reviewer] · run rev-20261016-585-source · 2026-10-16T17:33:04.606Z · commit eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57
- [ ] C2. claude-code-adapter.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.

## Comments

### impl-585 · 2026-10-16T17:30:47.313Z

C1 cause: test counts across a real timing boundary, not duplicate adapter admission. Baseline named case passed (8.134 s). A temporary 3.1 s delay while the first hub was stopped deterministically reproduced 2 !== 1 at 'launch discovery and watch use one call'. Moving the delay before the second launch also reproduced 2 calls; delaying the watcher (600 s poll override) while crossing that same interval reproduced the other receipt exactly: a PID instead of null at 'the next launch does not bypass the schedule'. Both are valid discovery once the 3 s test interval expires; the adapter already shares agentsFlight/lastAgentsAt and persists the floor. Fix uses Node's Date mock with the actual default 30 s interval, real CLI children and frame clients, and reopens projectHub to retain persisted-snapshot proof. Time remains fixed across restart and second launch; explicit 29,999/30,000 ms assertions prove the schedule, then advance another full interval after the last stop to prove no CLI. Bounded observation uses performance.now so failure deadlines do not freeze. First fixed named run passed (3.922 s).

### rev-30 · 2026-10-16T17:33:04.606Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-585-source
commit: eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-585 source review

Clear at eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57, fixed point cb8462c81dbb5daaca59d89b11f4053a8166f48d. Origin task tip matches. Two test/manifest files; adapter source is unchanged. Both review axes performed in-session under no delegation.

## Standards
No findings. The test controls Date only; real CLI child processes, frame clients and liveness timers remain in use. Its bounded observation helper uses performance.now, so freezing wall-clock scheduling does not freeze those assertion deadlines; an outer 30 s test timeout bounds the case. The fake clock is reset explicitly after stopping the reopened hub and in a cleanup hook on failure. Reopening projectHub retains the real persisted adapter state while removing unrelated daemon startup latency; no daemon-PID assertion is being replaced.

The existing test identity and duration allowance seconds remain; only the reason is updated. The initial no-CLI idle window, config-directory check, unknown-PID stop via harness id, shared-call count and final stopped-watch silence are retained. No assertions or production behaviors are relaxed. Read-only diff whitespace check passes.

## Spec
No findings. C1 source/cause record established. The adapter already shares agentsFlight and lastAgentsAt per directory, persists its lastAt/entries state and tests Date.now against the resolved interval. The old 3 s interval could legitimately expire during stop/restart/second launch, so its exactly-one-call and unknown-PID assumptions crossed a legal timing boundary.

A-4073 and the item comment record controlled reproductions: a 3.1 s restart gap yields 2 versus 1 calls; moving the gap before launch does the same; delaying the watcher while crossing the interval yields a discovered PID instead of null. These experiments support the timing-boundary diagnosis for the observed signatures; they are claimant records, not Reviewer executions or direct traces from every historical failure.

The corrected case uses default 30000 ms (still asserting the resolved schedule log), freezes time across first launch and persisted-state reopen, and proves the second launch cannot bypass the shared schedule. At 29999 ms it requires exactly one agents call across real liveness polls; at 30000 ms it observes exactly the second call. After stopping the final watch it advances a full interval and requires no additional CLI calls.

## Validation / criteria
A-4073 reports the fixed named test green in 3.922 s and root typecheck green; the request says ten serial Mac whole-file passes are in progress. Those repetitions and the exact-head droplet whole-file run remain pending. C1 verified; C2 requires all ten Mac whole-file passes plus the normal task droplet receipt. No per-item QA criteria.

Standards 0 findings; Spec 0 findings.
Review artifact A-4074.

Criteria: C1 verified.
