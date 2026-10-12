---
id: T-293
kind: task
title: "Hub start blocked for minutes after T-283: the inbox recomputed on every event with a quadratic replied subquery"
state: open
status: backlog
labels:
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:15:29.550Z
updated: 2026-10-12T17:31:54.255Z
---

Dev defect found and fixed by the stand-in (cland-impl) on 2026-10-12, 14:47–15:15Z, while the hub was down after the batch restart on ab772d8 (T-289, T-286, T-283).

Symptom: cland hub start killed its child at the 15 s deadline; hub serve logged listening and never serving; no hub.json; the crew lost the hub for ~30 minutes.

Cause (V8 inspector profile): serveProject → projectSessions → releaseInterruptedLaunches → rememberProcess → publishProcess → inbox.observe → list() → store.inboxMessages(), once per remembered process (215 here). T-283 added (a) a synchronous list() in observe() on every hub event and (b) a replied subquery whose OR (same topic or reply_to) defeats the (topic, seq) index: 3.8 s per call on 16,772 messages.

Fix, two commits directly on dev (hub outage; no suite run before, the next integrated run covers them):
- 76d679f: the replied check as two indexed EXISTS plus a messages_reply_to (reply_to, seq) index; same rows, 0.02 s.
- b75e0fe: observe() no longer calls list() synchronously; #changed() already recomputes once per tick and publishes on change.
Verified: hub typecheck, inbox-requests and agents-journal tests (17/17), hub start in 10 s, all 7 sessions resumed.

Left for the owner of T-283/T-284: a regression test that bounds inbox work per event (or per startup) on a store with thousands of messages; whether durable inbox waits may be recorded one tick late.

## Comments

### coord · 2026-10-12T17:31:54.255Z

Recurrence on dev 37a6a23 (found by impl-285 at 17:30Z through T-284's C7 test): T-287's events push called inbox.list() from publishJournalRow() for every journal row, so startup with 256 remembered processes ran 256 full inbox queries again. Fix 4b91f26 on t/T-285 (one events projection per tick; C7: 256 → 0 synchronous, ≤3 through the first tick), cherry-picked into T-291 and T-278; it reaches dev with the first of those to merge. The hub stays on b75e0fe (not restarted) until an integrated run at a dev tip with the fix is green. Lesson: C7 is the guard; every inbox or events change keeps it green.
