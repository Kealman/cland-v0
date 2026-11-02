---
id: T-1633
kind: task
title: A batch run whose host check a hub restart killed holds as inconclusive after a green rerun
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
created: 2026-11-02T11:11:55.194Z
updated: 2026-11-02T11:54:41.978Z
---

## Summary

Merge batch 5d4ff9c3 (T-1632, T-1566, T-1621) was admitted as run a18f9a6a at 10:21:53Z, 36 s before hub restart #69. The old hub's stop killed the host-gate check (`tier T0: exit 143; duration 35.33 s`). The new hub re-admitted the run and reran T0 (`exit 0; 72.984 s`), and every tier came back green: 6431 pass, 0 fail, wall 2880 s, $0.189 (log A-15797). The batch was still held: `original a18f9a6a inconclusive: aborted or unavailable worker result`. The Coordinator had to cancel and re-enqueue, which discarded 48 min of green evidence.

## What to build

- When the same run reruns a step after a restart, the later receipt supersedes the earlier aborted one, as long as both are bound to the same run, candidate tree and command.
- A batch whose final receipts are all passing lands. The superseded aborted attempt stays visible in the log and the notice.
- An aborted receipt with no later passing one still holds the batch as inconclusive.
- Separately: there is no Coordinator command to recover a held batch with its retained evidence. Recovery means cancel and re-enqueue. Cancelling members one by one lets the hub re-form a smaller batch from the remaining ones and start it at once: ac1986e3 started T-1632 alone at 11:11:23Z, between my cancel calls.

## Acceptance criteria

- [ ] C1. A batch run whose T0 attempt is aborted by a hub stop and rerun green on the restarted hub, with all tiers green, lands without a hold. A component test restarts the hub during the host gate.
- [ ] C2. An aborted T0 or tier receipt with no later passing receipt for the same run still holds the batch as inconclusive. The existing tests still pass.
- [ ] C3. The landing notice and the log name the superseded aborted attempt, with its exit code and duration.

## Comments

### coord · 2026-11-02T11:54:41.978Z

The cost of the cancel/re-enqueue recovery is confirmed. Stale batch ac1986e3 held the cancelled 10:01:20 T-1632 entry, and its run b10b1e59 went green at 11:54Z (6108 pass, 0 fail, 2508 s, $0.174). It landed nothing, because `merge-batches.ts:164` matches a member by item, head and `enqueued`, and the re-enqueued entry is from 11:11:26. The hub then formed batch 3e1bfcbf with the same three heads. Total loss from one restart: two green runs (93 min of wall time, $0.36) and about 1.6 h of queue time. Coordinator `verify cancel` on the hub-owned run was refused, which is correct: only the human may cancel it.

Scope addition for the fix: a member whose queued request was cancelled and re-enqueued at the same head should keep its batch membership, or the hub should drop a batch at once when a member is cancelled before its run starts. It should never run a batch that can't land.
