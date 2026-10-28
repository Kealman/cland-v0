---
id: T-1426
kind: task
title: Queued review requests wait while reviewers sit idle with stale pending markers
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-28T12:40:05.299Z
updated: 2026-10-28T12:40:05.299Z
---

## Summary

Review requests queued "for the next free live Reviewer" weren't delivered for about 40 minutes while three reviewers sat idle. On 2026-10-28, impl-1423 (T-1423, 11:55:33Z, msg 99ecfb37) and impl-1387 (T-1387, ~11:55Z) sent `review request` to `reviewer`, and the hub reported them queued. rev-26, rev-31 and rev-32 were idle the whole time, but `who` listed each with a `pending` review of an item whose review was already done (T-1405, T-1402, T-1406), and rev-34 was busy. When coord assigned both requests by name at 12:37Z, rev-26 cleared T-1423 within 2 minutes and rev-32 confirmed it had "no live pending review". So stale pending markers seem to keep idle reviewers from counting as free.

## Acceptance criteria

- [ ] C1. A reviewer's pending marker clears when its review verdict is recorded, or when the item moves on (ready, merged or closed), and an idle reviewer with no live pending review counts as free (test).
- [ ] C2. A queued review request goes to an idle, free reviewer within one assignment tick (test with one busy and one idle reviewer).

## Notes

Evidence: `who` at 12:37Z (rev-26 pending T-1405, rev-31 pending T-1402, rev-32 pending T-1406, all idle); A-13282 (rev-26 cleared T-1423 at 12:39Z after the direct assignment). Incident in T-204.
