---
id: T-490
kind: task
title: "suite-remote-budget test: candidate result not within 20 s when three remote callers run beside the local slot (Linux)"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T11:56:46.304Z
updated: 2026-10-15T11:56:46.304Z
---

## Problem

`hub/test/suite-remote-budget.test.ts:106/:131`, 'three remote callers run together beside the local slot, which a human takes next', failed on Linux with "candidate result: not within 20000 ms". It happened in T-486's droplet verify f45f0ae5 at 47c3b8cf (A-2956), and T-486 doesn't touch the file. T-435 fixed a different case in this file, the missed 'remote budget 1/1 full' notice.

## Acceptance criteria

- [ ] C1. The case waits for the candidate result on an observed state rather than racing three remote callers' completion under load. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
- [ ] C2. suite-remote-budget.test.ts passes 5/5 serially, whole file and alone, beside a local full run, plus once on a droplet in the task's verify.
