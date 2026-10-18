---
id: T-674
kind: task
title: suite-timeouts 'verify reports unverified fast-exit pipe cleanup once…' fails under load; fix it and lift its quarantine
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-531
branch: t/T-674-suite-timeouts-verify-reports-unverified
created: 2026-10-16T19:04:11.816Z
updated: 2026-10-18T20:32:29.465Z
---

## Summary

hub/test/suite-timeouts.test.ts "verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor" fails under load. It failed on four runs: b708b845 (A-4021), 6ee9b87c (A-4041), and the two Mac census runs at a8ddbb8c (A-4056 and A-4088's repeat), each time as the only failure in its phase. It went into hub/test/quarantine.json on 2026-10-16 with this item as owner, and the entry expires within seven days.

## What to build

Find whether the case waits on wall-clock time, on a process boundary or on a racing cleanup under load, and fix the cause so it passes on a loaded machine. Keep its assertions' meaning. Prefer an event the case can observe, or an injected clock, over a longer timeout. Remove the quarantine entry in the same change.

## Acceptance criteria

- [x] C1. The cause is recorded on this item and fixed, with the case's assertions unchanged in meaning and its quarantine entry removed in the same commit.
  - done: impl-674 · 2026-10-18T20:27:55.028Z
  - verified: rev-30 [reviewer] · run rev-20261018-674-source · 2026-10-18T20:29:00.857Z · commit 5e425e0b109cd46e44cf1d620067760e9c4fd46e
  - verified: rev-30 [reviewer] · run rev-20261018-674-final · 2026-10-18T20:32:28.704Z · commit 5e425e0b109cd46e44cf1d620067760e9c4fd46e
- [x] C2. suite-timeouts.test.ts passes 10/10 serially as a whole file on the Mac at load above 10, and in the task's droplet verify.
  - done: impl-674 · 2026-10-18T20:32:06.536Z
  - verified: rev-30 [reviewer] · run rev-20261018-674-final · 2026-10-18T20:32:28.704Z · commit 5e425e0b109cd46e44cf1d620067760e9c4fd46e

## Comments

### coord · 2026-10-17T01:50:58.943Z

Coordinator: the quarantine entry for this test reported 'cleared' (20 consecutive green) in integrated cover 3626645c (A-4271). It's removed from hub/test/quarantine.json in the batch after T-635, T-681 and T-659. The 2-worker droplet default (D53) plausibly removed the load that made it fail. This item stays open at low priority: if the test goes red again, it's re-quarantined with this owner, otherwise it closes at E-482's close as not reproduced.

### coord · 2026-10-18T19:40:29.027Z

Recurred 2026-10-18 19:36Z in the E-678 stage-1 macOS run 949a9b43 at c7417944 (local, 2 workers, peak 1-min load 11.59; A-5548, line 47918). "one cleanup warning: not within 15000 ms" at suite-timeouts.test.ts:175, test 21.0 s. It was the run's only failure (2301/2302).

### impl-674 · 2026-10-18T19:43:58.402Z

Draft diagnosis before runtime validation: the fixture's parent yields in async writeFile after spawning the detached pipe holder. A later worker ownership snapshot can capture the child while ancestry remains intact, making cleanup complete and leaving no incomplete-warning to report. Drafted a pre-child ps snapshot barrier that returns only after the parent OS PID is gone, plus an explicit parent-gone/pipe-holder-alive observation before the existing worker receipt wait. Every original assertion is retained. quarantine.json is already empty from the earlier integrated clearing; it remains empty. Validation waits for the Coordinator's Mac all-clear; 20 quiet serial whole-file runs, then an authorized exclusive >10-load proof, host lint/typecheck, source review and exact-head droplet verify.

### impl-674 · 2026-10-18T20:18:38.721Z

Cause confirmed by a temporary post-spawn scheduling-gap probe: with a 2 s delay after writing the pipe-holder PID marker, the original fixture fails with the exact stage symptom, 'one cleanup warning: not within 15000 ms'. Its worker receipt reports a stall with no cleanup-incomplete cause: the later ownership snapshot captured/reaped the child. The same probe with the observed-parent-exit snapshot barrier passes and its receipt contains 'cleanup incomplete: unverified inherited-pipe writer'. The probe/logging was removed and the file compared byte-for-byte to the draft used for 20/20 green quiet serial whole-file runs (all 7 tests/run, 34.952–43.320 s/file). No timeout was increased; every original assertion remains. Awaiting the exclusive >10-load window before C2's 10 serial whole-file runs.

### impl-674 · 2026-10-18T20:27:12.651Z

Mac validation complete: 20/20 quiet serial whole-file passes (A-5566) plus 10/10 serial whole-file passes in the Coordinator's exclusive load window (A-5573), all 7 tests/run. Every recorded 1-min load sample during the load proof exceeded 10; overall minimum 11.0806, final run range 11.1206–17.1616. File durations under load: 36.466–45.785 s. Initial stress was excessive and was reduced immediately as requested. Every generator was reaped and its PID confirmed absent at 20:26:47Z; window released then, ahead of 20:32Z hard stop. No local verify holder was observed. Host checks/source review and same-head droplet verify remain.

### rev-30 · 2026-10-18T20:29:00.857Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-674-source
commit: 5e425e0b109cd46e44cf1d620067760e9c4fd46e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. C1 verified: captured pre-child table remains in flight until observed parent exit, eliminating the ownership-capture gap while retaining every original cleanup warning/successor/foreign-process assertion and existing timeout. Exact missing-warning probe red/green independently audited; diagnostic absent from commit. Quarantine already empty per explicit Coordinator instruction. A-5575 records both axes,20 quiet7/7 files and10 load7/7 files, sample minimum11.0806, excessive-load disclosure/authorized disposition and generator cleanup receipts. C2 awaits accepted exact-head droplet gate. No findings or per-item QA.

Criteria: C1 verified.

### impl-674 · 2026-10-18T20:32:07.115Z

Exact reviewed-head mode-free droplet verify 72b6a0e8-5da2-4e9f-b757-b91c5102cc09 passed at 5e425e0b109cd46e44cf1d620067760e9c4fd46e: 21/21 tests, 0 fail/cancel/skip; hub-selected includes suite-timeouts.test.ts and hub/Neovim smoke. Corrected fast-exit case passed in 8.216 s. Linux x64, Node v24.21.0, Neovim v0.12.5, c-8 lon1, 2 workers; droplet lifetime 137 s / cost $0.0095. Log A-5576. C2 marked done; source verdict rev-20261018-674-source already clear, waiting Reviewer final same-head verdict. Tree/head unchanged and clean.

### rev-30 · 2026-10-18T20:32:28.704Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-674-final
commit: 5e425e0b109cd46e44cf1d620067760e9c4fd46e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged 5e425e0b. Independently audited A-5576/72b6a0e8: all seven suite-timeouts cases and full file positive, target cleanup-warning/successor case8.2156453s; accepted selected gate21/21 including hub+Neovim smoke, zero fail/cancel/skip. Source/red-green A-5575/A-5566 and ten loaded Mac7/7 files A-5573 remain audited; minimum test-time load11.0806 and excess-load/cleanup disposition retained. A-5577 records both axes and evidence limits. C1–C2 verified, no findings or per-item QA.

Criteria: C1 verified, C2 verified.
