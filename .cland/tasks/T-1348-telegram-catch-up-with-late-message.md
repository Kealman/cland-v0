---
id: T-1348
kind: task
title: Telegram catch-up with late-message times, the gap line and the offline and recovery lines
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1343
topic: null
branch: null
created: 2026-10-26T19:09:07.793Z
updated: 2026-10-26T19:09:15.367Z
---

## Summary

After an outage the Telegram chat gets late messages marked with when they were written, then one gap line "N General messages missed since 13:20" when N is above 0. After 3 minutes offline General gets one offline line, and one recovery line when the remote returns.

## What to build

Catch-up from what Telegram kept, each late inbound message marked ("written on Telegram at 13:20; the hub was down until 13:24"). The gap line comes from T-1324's missed count. The offline and recovery lines go to General. A remote shows as connected only after a recent successful exchange. Outages are made while the hub runs, since after a plain hub restart the gap is almost always 0. Spec §3.9.

## Acceptance criteria

- [ ] C1. A 10-second fake outage with three General posts ends in one gap line "3 General messages missed since …", and a late inbound message is marked with its written time (test).
- [ ] C2. A four-minute outage under an injected clock also writes "Telegram remote offline since …: <reason>" to General and one recovery line (test).
