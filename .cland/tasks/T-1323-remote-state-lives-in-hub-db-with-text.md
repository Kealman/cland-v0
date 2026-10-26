---
id: T-1323
kind: task
title: Remote state lives in hub.db with TEXT ids, and a poller lease keeps one gateway per project
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: null
branch: null
created: 2026-10-26T02:28:46.856Z
updated: 2026-10-26T02:28:46.856Z
---

## Summary

A remote's state lives in `hub.db`, with no separate file: pairings, waiting codes and per-stranger reply counts, cursors, the poller lease, Discord's identify count, the outbox tables and the map from chat messages to cland messages, topics and asks. One gateway per project consumes a token, enforced by a lease.

## What to build

Store migrations add the remote tables. Discord ids are stored as TEXT, since they exceed JavaScript's safe integers and `node:sqlite` reads 64-bit integers back lossily. The poller lease records the pid and start time. A gateway that meets a held lease at start waits for it for up to 60 seconds and kills nothing; reuse the hub's precise process identity (T-543) for the liveness check. Spec §3.1 and §3.9.

## Acceptance criteria

- [ ] C1. Remote state written before a hub restart reads back unchanged after it, a chat id above 2^53 included, with no state file outside `hub.db` (test).
- [ ] C2. A second gateway on the same `hub.db` waits on the held lease for up to 60 seconds, signals and stops nothing, and takes the lease once it is released or its holder is provably dead (test).
