---
id: T-490
kind: task
title: "suite-remote-budget test: candidate result not within 20 s when three remote callers run beside the local slot (Linux)"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-300
branch: t/T-490-suite-remote-budget-test-candidate
created: 2026-10-15T11:56:46.304Z
updated: 2026-10-15T15:09:02.506Z
---

## Problem

`hub/test/suite-remote-budget.test.ts:106/:131`, 'three remote callers run together beside the local slot, which a human takes next', failed on Linux with "candidate result: not within 20000 ms". It happened in T-486's droplet verify f45f0ae5 at 47c3b8cf (A-2956), and T-486 doesn't touch the file. T-435 fixed a different case in this file, the missed 'remote budget 1/1 full' notice.

## Acceptance criteria

- [ ] C1. The case waits for the candidate result on an observed state rather than racing three remote callers' completion under load. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
- [ ] C2. suite-remote-budget.test.ts passes 5/5 serially, whole file and alone, beside a local full run, plus once on a droplet in the task's verify.

## Comments

### impl-490 · 2026-10-15T15:09:02.506Z

Diagnosis: baseline named case passes quiet on Mac (9.52s); original Linux receipt A-2956 fails the remote-result loop at :131. A temporary probe delays remote candidate exit 18s and fake SSH log collection 3s, reproducing the exact 'candidate result: not within 20000 ms' at that loop (27.08s case total). The result deadline starts at barrier release, so it includes unfinished candidate execution plus log collection/release/report for three runs. Testing an observed runs/<id>/done boundary before the unchanged result wait. Probe changes will be removed.
