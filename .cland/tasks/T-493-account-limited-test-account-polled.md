---
id: T-493
kind: task
title: "account-limited test: account-polled journal count 1 vs 2 after the reset is visible (Linux, under load)"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-330
branch: t/T-493-account-limited-test-account-polled
created: 2026-10-15T12:48:39.376Z
updated: 2026-10-15T23:31:03.735Z
---

## Problem

`hub/test/account-limited.test.ts:221`, 'Claude without a full push learns its reset from one after-hit harness poll', failed on Linux in T-393's droplet verify f322ed1f at 36ecea1f (A-2951). The journal held one account-polled entry where two were expected, after the reset had already been observed. T-393 doesn't touch the file. impl-393 couldn't reproduce it: the whole file passed 5× alone at the task head and once on dev, 60/60 (A-2992). It looks like a race between poll state and journal publication under load.

## Acceptance criteria

- [x] C1. The case waits on the observed second account-polled journal entry, or the poll boundary, rather than reading the count once the reset is visible. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
  - verified: rev-31 [reviewer] · run rev-20261015-493-source · 2026-10-15T22:35:02.290Z · commit ec6ed43b67557eca8eb9f4a1aa5b0ce8ec67a7e6
  - done: impl-493 · 2026-10-15T22:54:24.848Z
- [x] C2. account-limited.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-493 · 2026-10-15T23:30:35.244Z
  - verified: rev-31 [reviewer] · run rev-20261015-493-final · 2026-10-15T23:31:01.796Z · commit ec6ed43b67557eca8eb9f4a1aa5b0ce8ec67a7e6

## Comments

### coord · 2026-10-15T16:50:20.949Z

Second signature in this file: account-limited.test.ts:265, the recent-poll-minimum case, got 1 where 2 was expected. It came from T-498's droplet run cede782f (A-3180), on a head without T-493. Same family as :221, a poll-count read that races journal publication. Cover both in this ticket.

### coord · 2026-10-15T19:02:04.237Z

Third signature in this file: account-limited.test.ts:236/:280, "after-hit read waits for a recent failed poll backoff and duplicate hits share it", expected 2 and got 1 after 18.2 s on Linux. From T-473's droplet run 2df3d3fe (A-3275). Same poll-count race as :221 and :265; fix all three together.

### impl-493 · 2026-10-15T22:28:35.116Z

Starting diagnosis and fix for all three account-polled count signatures; preserving assertions and time bounds. Evidence follows E-482's latest quiet-or-loaded serial Mac rule.

### impl-493 · 2026-10-15T22:34:29.508Z

Committed/pushed ec6ed43b; C1 fix preserves all assertions/time bounds. Deterministic boundary reproduction A-3405 records red (1 != 2) before and 3/3 affected cases green afterwards with the same temporary 250 ms delay, now removed. Typecheck passes. Requested source review; collecting C2 Mac receipts under the shared test window.

### rev-31 · 2026-10-15T22:35:02.290Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-493-source
commit: ec6ed43b67557eca8eb9f4a1aa5b0ce8ec67a7e6
scope: full

Source review clear at ec6ed43b67557eca8eb9f4a1aa5b0ce8ec67a7e6, run rev-20261015-493-source, scope full. Reviewed ec6ed43b^...ec6ed43b: one commit, account-limited.test.ts only. No high, medium or low findings.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, project lifecycle rules or the smell baseline. The test uses its existing bounded observation loop and journal flush helper instead of a fixed delay. Temporary reproduction instrumentation is absent from the commit. Every final assertion and timeout value remains unchanged; diff check passes. Both axes reviewed within this session because the role disables delegation.

## Spec
C1 verified at hub/test/account-limited.test.ts:219-224 and :267-272. Direct Claude polling now observes both the expected reset and exactly one new account-polled receipt for claude-b inside the existing eventually call. The shared false/true deferred-case loop applies the same conjunction to poll minimum and failed-poll backoff. Equality preserves duplicate detection rather than accepting extra polls. Default direct budget and pollDelayMs + 5000 deferred budgets are unchanged.

The root cause is confirmed in unchanged production source: AccountPoller.#run awaits core.publishAccountLimits before emitting account-polled in finally; publishAccountLimits updates the mark before awaiting publication. Seeing the reset therefore cannot establish a future completion-log record, even after flushing earlier journal writes. The commit explains this boundary.

Final count checks, no-early-read assertion, minimum/backoff timestamp difference, duplicate-hit count and restart-retains-mark assertion remain intact. No product behavior or fixture architecture changed. A-3405 reports the original exact 1 != 2 failure with a temporary 250 ms delay before completion logging, then all three affected cases passing with the same probe (3/3). Probe removed; typecheck green reported.

C2 remains unverified pending all five serial whole-file-alone Mac receipts and the exact-reviewed-head droplet verify. Source clear permits verify at this SHA; final clearance needs C2 evidence. No per-item QA criteria and no Reviewer edits/tests.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3409: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3409-t-493-source-clear-at-ec6ed43b.md

Criteria: C1 verified.

### impl-493 · 2026-10-15T23:30:36.823Z

C2 complete at ec6ed43b: A-3456 holds five serial whole-file Mac passes (50/50 cases, 0 fail/skip), with queue/load gates and corrected loaded/quiet labels; A-3440 required droplet verification passed (1861 pass/0 fail/3 skips) and A-3421 extra local verification passed (1864/1864). Final evidence sent to Reviewer; both criteria marked done. No source changes after source review A-3409.

### rev-31 · 2026-10-15T23:31:01.796Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-493-final
commit: ec6ed43b67557eca8eb9f4a1aa5b0ce8ec67a7e6
scope: evidence

Final evidence review clear at unchanged ec6ed43b67557eca8eb9f4a1aa5b0ce8ec67a7e6, run rev-20261015-493-final, scope evidence.

No high, medium or low findings. C1 source verification remains current; C2 verified.

A-3456 checked in full: five serial account-limited.test.ts whole-file Mac runs, each 10/10 passing, 50 total with zero failures/skips/cancellations. Node file times are 97.032 / 104.174 / 99.798 / 90.768 / 85.467 s. Runs 1-4 are correctly labelled loaded (the non-Coordinator local verify was active at admission), run 5 quiet. Each admission snapshot has load <15 and no matching targeted process; higher-load/busy snapshots caused waits. Run 4's controller elapsed time includes its priority-slot SIGSTOP pause; its child Node duration and successful completion are shown separately. The controller pause did not cancel a child. These quiet/loaded serial receipts use E-482's Coordinator evidence amendment at 2026-10-15T12:32:49.963Z, which permits either labelled condition and drops the beside-full-run requirement.

Actual Linux gate A-3440 / e342f30c-3e13-4cac-8baa-c89f1669b0ae already independently checked: exact reviewed head, droplet c-8 lon1, workers 4, 1864 tests / 1861 pass / 0 fail / 3 skip / 0 cancelled, final exit 0. All three changed cases pass in 4.849 / 14.153 / 18.241 s and all 12 Neovim smoke cases pass. Known-duration regression notices are non-failing. Coordinator e41c32a2-f8c2-4f44-bf4e-cfac3f9aab5b directed this fresh actual droplet run after the first run fell back to Mac.

A-3421 is extra same-head Mac gate evidence: 1864/1864, zero failures/skips, all three changed cases and Neovim smoke green. It is not used as Linux evidence. A-3405's removed delay-probe reproduction and original source review A-3409 stand.

Branch still resolves to the exact reviewed SHA, with no new source changes. All criteria verified; no per-item QA criteria. No Reviewer edits/tests.
Review artifact A-3457: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3457-t-493-final-clear-five-mac-passes-and-green-linux-at-ec6ed43b.md

Criteria: C2 verified.
