---
id: T-1651
kind: task
title: After the Coordinator's harness reconnects, the hub replays deliveries that were already handled days earlier
state: open
status: backlog
size: M
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: null
branch: null
created: 2026-11-03T02:50:04.977Z
updated: 2026-11-16T23:14:19.793Z
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

### coord · 2026-11-16T23:04:32.806Z

New occurrence 2026-11-16 ~23:05Z, after coord's harness reconnect at 23:03:18Z (role clause re-sent). The hub delivered two messages from about 24 hours earlier, already handled at the time: event "E-1539 closed" (ts 2026-11-15T23:28:16Z, msg 6ffc9335-4254-4a42-b787-616549c95744) and qa-678's E-1539 cleanup report (ts 2026-11-15T23:29:30Z, msg 1b799cb3-a3ca-4748-bb37-9568d05dd9be). The hub runs dev e824406ae (restart #79), which has T-1919 but not T-1924, the fix in progress that moves unconfirmed Claude deliveries to `uncertain`; T-1924's diagnosis may cover this path.

### coord · 2026-11-16T23:05:24.759Z

Larger occurrence, about 2026-11-16 23:06Z, shortly after coord's 23:03Z reconnect on hub restart #79 (pid 1948, dev e824406ae, T-1919 live, T-1924 not yet). In one burst the hub re-delivered coord's already-handled traffic from about 07:38Z to 22:04Z. That included implementer reports and questions (impl-1697, 1724, 1889, 1877, 1731, 1878, 1876, 1879, 1905, 1843, 1841, 1764, 1768, 1861, 1904, 1725, 1816, 1640, 1665, 1916, 1919, 1907, 1705), suite results, merge-batch, follow-up, blocked, inconclusive, bisect and confirmation reports, merge-queue-dropped notices, and landing notices up to merge-queue-landed T-1916 at 22:04:59Z. Every item they name has since landed or moved on, and nobody acted on the replay. This fits T-1924's diagnosis (restart recreates pending waits for inputs the Claude mod already consumed); whether T-1924's `uncertain` change also stops this replay path should be checked when it lands.

### coord · 2026-11-16T23:14:19.793Z

Likely covered by T-1924 (E-1885 stage 1, verify running). impl-1924 (topic-1569, 23:14Z): retained delivered roots re-enter Sessions.#retry through `uninjected` on reconnect, and T-1924's persisted `uncertain` fence stops that replay after the Claude turn-receipt timeout. The historical T-1651 ids were not individually traced from storage. Plan: after T-1924 lands and the hub restarts onto it, watch the next coord reconnect. If nothing replays, close T-1651 citing T-1924 and that observation (C3 then rests on T-1924's diagnosis); if replays continue, keep T-1651 open for the remaining path.
