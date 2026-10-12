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
updated: 2026-10-12T15:15:29.550Z
---

Dev defect found and fixed by the stand-in (cland-impl) on 2026-10-12, 14:47–15:15Z, while the hub was down after the batch restart on ab772d8 (T-289, T-286, T-283).

Symptom: cland hub start killed its child at the 15 s deadline; hub serve logged listening and never serving; no hub.json; the crew lost the hub for ~30 minutes.

Cause (V8 inspector profile): serveProject → projectSessions → releaseInterruptedLaunches → rememberProcess → publishProcess → inbox.observe → list() → store.inboxMessages(), once per remembered process (215 here). T-283 added (a) a synchronous list() in observe() on every hub event and (b) a replied subquery whose OR (same topic or reply_to) defeats the (topic, seq) index: 3.8 s per call on 16,772 messages.

Fix, two commits directly on dev (hub outage; no suite run before, the next integrated run covers them):
- 76d679f: the replied check as two indexed EXISTS plus a messages_reply_to (reply_to, seq) index; same rows, 0.02 s.
- b75e0fe: observe() no longer calls list() synchronously; #changed() already recomputes once per tick and publishes on change.
Verified: hub typecheck, inbox-requests and agents-journal tests (17/17), hub start in 10 s, all 7 sessions resumed.

Left for the owner of T-283/T-284: a regression test that bounds inbox work per event (or per startup) on a store with thousands of messages; whether durable inbox waits may be recorded one tick late.
