---
id: R-1523
kind: release
version: 0.3.2
title: Close the 0.3 line before 0.4
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-1267
branch: null
created: 2026-10-31T14:43:28.342Z
updated: 2026-10-31T21:05:10.048Z
---

## Goal

Close the 0.3 line before 0.4 ("cland beyond one machine", map M-1511): ship the Telegram stall fix to users, and fix the bugs, debt and follow-ups that would get in the way of remote agent hosts. Those touch session processes, event delivery, sockets, setup and doctor rows, harness adapter versions and merge-queue selection.

## Notes

- Scope: the human's answer on 2026-10-31 at 14:42:58Z (ask f9666976): «0.3.2 со списком «обязательно» + «по желанию»».
  - Must: T-1508 (already landed at 294477b6c), T-1503, T-1506, T-1501, T-1500, T-1510 then T-1488, T-1498, T-1504, T-1505, T-1507.
  - Optional: T-1486, T-1493, T-1494, T-1495, T-953.
  - Left to 0.4: T-489 and T-1229. T-540 is closed as superseded by agent hosts.
- Version 0.3.2: the human named it in that ask. The project version bump is its own item.
- Release approval: not yet given. Ask before the release as the release skill says.

## Comments

### coord · 2026-10-31T21:05:10.048Z

The human, 2026-10-31 21:05Z via Telegram (General msg remote-b78cdec6): «Ок, дальше публикуй релиз, сообщи маркетингу и бери 0.4 дальше». Recorded as the human's release approval for 0.3.2. Version 0.3.2 is the human's choice (ask f9666976, 14:42Z).

Conditions follow the 0.3.1 precedent:
- every item landed or closed;
- the release covers green on Linux droplet and on macOS local;
- the dry-run notes shown in topic-1267 before `cland release`.

The same message starts 0.4 (R-1530). Its implementers launch only after the release, so dev stays frozen for the release run.
