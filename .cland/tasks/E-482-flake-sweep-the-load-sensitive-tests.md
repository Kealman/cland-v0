---
id: E-482
kind: epic
title: "Flake sweep: the load-sensitive tests found in v0.1.2"
state: open
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:14:14.206Z
updated: 2026-10-16T15:59:34.818Z
---

## Goal

The load-sensitive tests found during the v0.1.2 run and the start of v0.1.3 are fixed in one place, so that task gates and integrated covers stop going red on known flakes. Each one is made to wait on the state it asserts, never on wall time, and keeps its meaning. This is the retrospective's STOP 4 (A-2783), applied to the backlog the run produced.

## Contents

T-442 (sessions midnight reset), T-445 (suite cleanup observer), T-446 (artifact-browser socket), T-449 (session-stop-races probe.json), T-453 (executor-run lock.break scan), T-463 (session-usage restart publications), T-465 (codex-adapter rateLimitsAt), T-467 (codex-adapter steer recovery) and T-481 (executor-prepare release record).

## Definition of done

Each ticket's Implementer produces its own evidence before merge. It runs the fixed file 5 times serially beside any non-coord local full run, labelled loaded or quiet, and its post-review `cland verify` is the droplet run. At the epic's close, QA re-checks every fixed file once beside a full run and once on a droplet, and its verdict closes the epic. (Coordinator clarification, 2026-10-15 09:57Z.)

- [ ] C1. Every child's file passes 5/5 beside a local full run and once on a Linux droplet.
- [ ] C2. No child weakens an assertion or widens a time bound without a recorded reason.

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-481
        - T-453
        - T-465
        - T-467
        - T-485
      - - T-445
        - T-449
        - T-463
      - - T-446
        - T-442
      - - T-484
  - name: the sweep, part 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-494
      - - T-501
      - - T-509
      - - T-524
      - - T-526
      - - T-528
      - - T-555
      - - T-558
      - - T-560
      - - T-581
```

## Comments

### coord · 2026-10-15T11:05:29.087Z

Gate rule while E-482 is open, a human decision on 2026-10-15 at 11:04Z (ask 9183a54c, answer fb9f8d2a). It replaces the local fallback.

When a droplet verify is red only on known flakes and the task's own files are green, the next step is one more droplet verify at the same head. A head that moved only by shared-fix picks counts as the same. If that run is red only on known flakes, on a different failing test, the two Linux receipts plus the Reviewer's final clear are the merge gate. The same test red twice gets reported. The local slot is reserved for the Coordinator's integrated runs.

### coord · 2026-10-15T12:32:49.963Z

Evidence rule from 2026-10-15 at 12:32Z. Each ticket needs five serial whole-file passes on the Mac, quiet or loaded and labelled, plus the task's droplet verify, which runs the file under 4-worker Linux load. The beside-a-local-full-run requirement is dropped, because after the 12:04Z load spike only one test file runs on the Mac at a time.

### coord · 2026-10-15T13:09:26.232Z

Watch item: subscriptions.test.ts:453/:472 got an extra 'impl idle' event beside 'impl launched' (T-395, A-3003, on a branch without T-486). It's classified as T-486's Codex launch-order race. If it recurs on a head that carries 4db6ed9c, file it as a new ticket, because T-486's fix may then legitimately emit the idle that the test doesn't expect.

### coord · 2026-10-15T15:03:54.833Z

Gate clarification (2026-10-15 15:04Z): the 'own files green' condition of the two-receipt rule applies to the test cases a task's diff changes. A red on another case in the same file counts as known if a ticket covers that case and the diff doesn't touch it (T-467: codex-adapter:561 is T-485's).

### coord · 2026-10-15T15:24:42.537Z

Same-head clarification (2026-10-15 15:24Z): a head that moved by a full origin/dev merge counts like shared picks for the two-receipt rule, provided the Reviewer confirms the task diff against dev is unchanged. This covers merges made before the 15:23Z "pick only" notice (T-497, T-498, T-507). From now on, pick only, and merge dev on conflict or on request.
