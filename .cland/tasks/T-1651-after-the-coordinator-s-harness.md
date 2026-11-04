---
id: T-1651
kind: task
title: After the Coordinator's harness reconnects, the hub replays deliveries that were already handled days earlier
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-03T02:50:04.977Z
updated: 2026-11-04T00:06:59.797Z
---

## Summary

At 2026-11-03 02:48Z the Coordinator's Claude Code session reconnected; the harness pid is now 25257, and the hub resent the role clause. After that, the hub injected about 26 deliveries that coord had already received and handled on 2026-11-01 and 2026-11-02, oldest first and in batches. Each arrives as if new, and some are questions that ask for an answer. A reconnecting Coordinator can act twice on settled work, for example re-enqueueing, cancelling or answering a closed ask. A session that trusts its delivery stream can be steered by stale state.

## Evidence

- Replayed, among others: d9d6a3f8 (impl-1551, 2026-11-01T07:14:07Z); ef720bd3 (rev-35, 07:14:26Z); b69c6e38 (impl-1545 question, 07:15:03Z); 0807a8ef (impl-1549, 10:40:27Z); 655daf37 (merge-queue-dropped T-1581, 10:41:29Z); 1865a211 (impl-1590 question, 2026-11-02T05:57:53Z); efc5b56f (qa-678 question, 06:14:51Z); 7bb26f1f (impl-1588 question, 06:34:04Z); suite and merge-batch reports for 18d544e5 / 6874db04 (07:17–07:18Z); bd8c8f37 (impl-1592 question, 07:19:50Z).
- Every item they name is closed: T-1545, T-1546, T-1551, T-1552, T-1587, T-1588, T-1589, T-1590, T-1592.
- `history` (limit 15) right after the reconnect showed only current traffic, ending at the 02:48Z role clause. So the hub's own record is right, and the replay comes from the injection or delivery path, not from the stored history.

## What to build

Find why the reconnect injected already-delivered messages. Candidates: a delivery cursor reset on harness re-exec, a per-session pending queue that never acks injected items, or the mod bridge re-reading an unacked backlog. Make a delivery that was injected and acknowledged, or is older than the session's last acknowledged cursor, never inject again after a reconnect. A message the hub really still holds may still be delivered once after a reconnect.

## Acceptance criteria

- [ ] C1. A Claude Code session that receives and acknowledges deliveries, then reconnects (harness re-exec and bridge reconnect), receives none of them again; only messages queued while it was away arrive (test).
- [ ] C2. A delivery that was queued but never acknowledged before the reconnect arrives exactly once after it (test).
- [ ] C3. The cause is named in the item with the code path, and the replayed backlog in the 2026-11-03 02:48Z incident is explained by it.

## Comments

### coord · 2026-11-04T00:06:45.496Z

Another occurrence: at about 2026-11-04 00:03Z, coord received impl-1621's report bcc3c494 (topic-1332, ts 2026-11-02T06:15:29Z, reply_to 8c9523a9) as a fresh delivery, about 42 hours after it was sent. T-1621 is closed. The report concerned admission of run 03192ac6. Nobody acted on the replay.

### coord · 2026-11-04T00:06:59.797Z

Burst at 2026-11-04 about 00:06Z. With the hub not restarted (pid 3297, uptime 1d 13h) and the role clause re-delivered to coord (msg 7a685dec, so a spoke reconnect), coord received six deliveries from 2026-11-02 06:15–07:19Z as fresh:
- impl-1621 bcc3c494;
- the hub's merge-batch 6874db04 reports for T-1621 and T-1587;
- impl-1589 04e54417 and 4010e887;
- impl-1587 980702df.

All the items involved are closed. The replay looks tied to the spoke reconnect, not to a hub restart. Nobody acted on it.
