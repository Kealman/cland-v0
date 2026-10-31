---
id: Q-1519
kind: question
title: Scheduler, pools and host lifecycle in detail
state: open
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1517
  - Q-1513
topic: null
branch: null
created: 2026-10-31T14:35:39.288Z
updated: 2026-10-31T17:03:48.767Z
---

## Question

Scheduler, pools and host lifecycle in detail, after the host prototype and the provider research (map M-1511 round-3 decisions 1–4): defaults for sessions per host by harness, idle_stop and lease length, dense packing details, the "waiting for a host" queue and its visibility in web, Neovim, Telegram and the Agents topic, host rows in doctor, status and the workbenches, the spend ledger line for hosts and the daily cap, failure handling (boot failure, SSH loss, provider rate limits, a host that stops answering while sessions run), `cland host` commands (list, stop, login, status), and the Host interface shape that leaves room for serverless providers. Grilling with the human, in rounds.
