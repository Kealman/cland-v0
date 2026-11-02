---
id: T-1630
kind: task
title: Merge bisect blocks when the failing test file belongs to the omitted member
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
created: 2026-11-02T07:20:05.309Z
updated: 2026-11-02T08:06:27.539Z
---

## Summary

When a merge batch fails on a test file that one member introduced, the bisect's omit-that-member candidate cannot run the failing file (it does not exist there), and the hub blocks the whole batch with `unknown explicit hub shard file: <file>` and "Waiting for human or Coordinator action". The remaining members are innocent by construction but stall until a Coordinator intervenes.

## Evidence

Batch 6874db04 (T-1621, T-1587, T-1589), run 18d544e5 at candidate 2915b42b, 2026-11-02 07:17Z: T1 failed only `hub/test/state-paths-lint.test.ts` (added by T-1621). The diagnosis job omit-0 (without T-1621) blocked at 07:19:16Z with `unknown explicit hub shard file: hub/test/state-paths-lint.test.ts`. Coordinator cancelled T-1587 and T-1589 (07:19:29Z/07:19:31Z) and re-enqueued them; a batch 30449177 of the same two members then ran on run b21c2e05.

## What to build

A failing file that is absent from an omit candidate attributes the failure to the omitted member: the omitted member is dropped with that reason and the remaining members continue to their landing run, without a human or Coordinator action. Cancelling and re-enqueueing members of a blocked batch must not leave a duplicate batch and queue entry for the same heads.

## Acceptance criteria

- [ ] C1. A batch whose only failing file was added by one member drops that member with a reason naming the file and lands the others after their own run, with no blocked state (test).
- [ ] C2. The blocked notice for a genuinely unrunnable candidate names the members and the recovery command (test).
- [ ] C3. Cancelling a member of a blocked batch and re-enqueueing it leaves exactly one queue entry or batch membership for that head (test).

## Comments

### coord · 2026-11-02T08:06:27.539Z

Follow-up evidence (coord, 2026-11-02 08:07Z): batch 30449177 (T-1587 and T-1589, run b21c2e05) finished green at 08:01Z but landed nothing. Both members had been cancelled and re-enqueued while that batch was forming, so its result was discarded. A new batch, f57a84aa (T-1627, T-1587, T-1589, run 4dfec4ec), then re-ran the same heads, which cost about 40 min of droplet time and the queue position. C3 should cover this case. Either a green batch whose members were re-enqueued at unchanged heads lands them, or the re-enqueue joins the batch that is forming.
